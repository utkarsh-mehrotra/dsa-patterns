import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import * as monaco from 'monaco-editor';
import { WebSocketMessageReader, WebSocketMessageWriter, toSocket } from 'vscode-ws-jsonrpc';
import { MonacoLanguageClient } from 'monaco-languageclient';
import { CloseAction, ErrorAction } from 'vscode-languageclient';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

// Splits a LeetCode-style example input string ("nums = [2,7,11,15], target = 9")
// into its top-level parameters, treating "," and "\n" as delimiters only
// when they occur outside array/object brackets and quoted strings - so a
// single array-typed parameter's own internal commas are never mistaken for
// parameter boundaries.
function splitTopLevelParams(str) {
  const parts = [];
  let depth = 0;
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '"' && (i === 0 || str[i - 1] !== '\\')) {
      inQuotes = !inQuotes;
    }
    if (!inQuotes) {
      if (c === '[' || c === '{') depth++;
      if (c === ']' || c === '}') depth--;
    }
    if (!inQuotes && depth === 0 && (c === ',' || c === '\n')) {
      parts.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  if (current.trim() !== '') parts.push(current);
  return parts;
}

// Converts a LeetCode example's "input" field into a newline-per-parameter
// value for display/editing in the testcase textarea (one clean line per
// parameter, stripped of each "name =" prefix). This is a *display* format
// only - see stdinForExecution() for why it can't be sent to the backend
// as-is.
function toTestcaseStdin(input) {
  return splitTopLevelParams(input)
    .map(tok => {
      tok = tok.trim();
      const eqIdx = tok.indexOf('=');
      return eqIdx !== -1 ? tok.slice(eqIdx + 1).trim() : tok;
    })
    .join('\n');
}

// The compiler backend's drivers read stdin via a single getline/readLine
// call and split *that one line* on top-level commas - they were never
// designed to read one parameter per line. Converts the testcase textarea's
// newline-per-parameter display format into the single comma-joined line
// the backend actually expects.
function stdinForExecution(testcaseValue) {
  return testcaseValue
    .split('\n')
    .map(l => l.trim())
    .filter(l => l !== '')
    .join(',');
}

// Extracts the class name and every method name from a problem's pristine
// starter body. Python only: single-line `class X:` / `def y(` patterns are
// reliable to detect via regex, unlike C++/Java where multi-line signatures,
// templates, and overloads make static extraction too fragile to safely act
// on without risking false positives against genuinely correct code.
function getPythonRequiredIdentifiers(stubBody) {
  const classMatch = stubBody.match(/class\s+(\w+)/);
  const className = classMatch ? classMatch[1] : null;
  const methodNames = Array.from(stubBody.matchAll(/def\s+(\w+)\s*\(/g)).map(m => m[1]);
  return { className, methodNames };
}

// Proactively checks that the user's edited body still defines the expected
// class and every required method, *before* sending it to the judge. Catches
// the most common source of confusing "AttributeError: no attribute" /
// "NameError: name not defined" tracebacks: a missing or renamed class/method.
// Python happily parses that as valid (just structurally wrong) rather than
// raising a clear error the way a missing brace in C++/Java would, so the
// failure only ever surfaced at runtime, several steps removed from the
// actual mistake. Returns a human-readable explanation, or null if the
// required class and methods are all present.
function checkPythonStructure(userCode, stubBody) {
  const { className, methodNames } = getPythonRequiredIdentifiers(stubBody);
  if (!className) return null;

  const classRe = new RegExp(`class\\s+${className}\\b`);
  if (!classRe.test(userCode)) {
    return `Your code doesn't define \`class ${className}:\` — this judge calls your solution through that exact class. Make sure you kept (or restored) the class declaration from the starter code.`;
  }

  const missing = methodNames.filter(name => !(new RegExp(`def\\s+${name}\\s*\\(`)).test(userCode));
  if (missing.length > 0) {
    const list = missing.map(m => `\`${m}\``).join(', ');
    const noun = missing.length > 1 ? 'methods' : 'a method named';
    const pronoun = missing.length > 1 ? 'these methods' : 'this method';
    return `Your \`${className}\` class is missing ${noun} ${list}. The judge calls ${pronoun} directly, so the name (and capitalization) must match the starter code exactly.`;
  }
  return null;
}

// Best-effort rewrite of a handful of well-known "structural mismatch" error
// shapes (missing/misnamed method or class) into a clear one-line
// explanation. Runs after a real failed execution, across all three
// languages - unlike checkPythonStructure(), this never blocks anything, it
// only adds context on top of an error that already happened, so an
// imprecise or missed match just falls back to the unmodified raw error.
function friendlyStructureHint(stderr, language) {
  if (!stderr) return null;

  if (language === 'python3') {
    let m = stderr.match(/AttributeError: '(\w+)' object has no attribute '(\w+)'/);
    if (m) {
      return `Your \`${m[1]}\` class doesn't define a method named \`${m[2]}\`. Double-check the method name matches the starter code exactly (including capitalization) — the judge calls it directly.`;
    }
    m = stderr.match(/NameError: name '(\w+)' is not defined/);
    if (m) {
      return `Your code doesn't define \`${m[1]}\` — make sure you kept the \`class ${m[1]}:\` line from the starter code.`;
    }
    if (/IndentationError/.test(stderr)) {
      return `There's an indentation problem in your code. Python needs your method(s) to stay indented inside the class body — a method starting at column 0 is no longer part of the class.`;
    }
  }

  if (language === 'java') {
    let m = stderr.match(/symbol:\s+method\s+(\w+)/);
    if (m) {
      return `Your class doesn't define a method named \`${m[1]}\` with the expected parameters — check the exact method name and signature against the starter code.`;
    }
    if (/class \w+ is public, should be declared in a file named/.test(stderr)) {
      return `Remove the \`public\` keyword before \`class\` — this judge compiles your class alongside its own \`Main\` class in the same file, so only one class per file can be \`public\`.`;
    }
  }

  if (language === 'cpp') {
    let m = stderr.match(/has no member named ['"]?(\w+)['"]?/);
    if (m) {
      return `Your class doesn't define a member named \`${m[1]}\` — check the exact method name against the starter code.`;
    }
    m = stderr.match(/'(\w+)' was not declared in this scope/);
    if (m) {
      return `\`${m[1]}\` isn't declared — check the exact class/method name against the starter code.`;
    }
  }

  return null;
}

export default function ProblemWorkspace() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { completedProblems, toggleProblemCompletion, theme, toggleTheme } = useApp();

  const [problem, setProblem] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('cpp');
  const [fontSize, setFontSize] = useState(14);
  const [splitWidth, setSplitWidth] = useState(50);
  const [consoleHeight, setConsoleHeight] = useState(176);
  const [isConsoleCollapsed, setIsConsoleCollapsed] = useState(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState('testcase');
  
  // Custom test cases and inputs
  const [testCases, setTestCases] = useState([]);
  const [activeTestCaseIndex, setActiveTestCaseIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  
  // Solved state and modal
  const [isSolved, setIsSolved] = useState(false);
  const [showSolvedModal, setShowSolvedModal] = useState(false);

  // Notes tab state
  const [showNotes, setShowNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [notesStatus, setNotesStatus] = useState('Saved');

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const lspClientRef = useRef(null);
  const socketRef = useRef(null);
  const savedCodesRef = useRef({});
  const consoleHeightRef = useRef(consoleHeight);
  consoleHeightRef.current = consoleHeight;

  // 1. Fetch problem definition from local json
  useEffect(() => {
    const fetchProblem = async () => {
      try {
        const response = await fetch(`/leetcode_data/${slug}.json`);
        if (response.ok) {
          const data = await response.json();
          setProblem(data);

          // Populate default testcases from problem examples
          if (data.examples && data.examples.length > 0) {
            const initialCases = data.examples.map(ex => toTestcaseStdin(ex.input));
            setTestCases(initialCases);
          } else {
            setTestCases(['']);
          }

          // Load saved notes for this problem
          const storedNotes = localStorage.getItem(`dsa_notes_${slug}`);
          if (storedNotes) {
            setNotesText(storedNotes);
          }
        } else {
          console.error('Failed to fetch problem data');
          navigate('/dashboard');
        }
      } catch (err) {
        console.error('Error fetching problem details:', err);
        navigate('/dashboard');
      }
    };
    fetchProblem();
  }, [slug, navigate]);

  // 2. Manage the body sandbox-active class layout
  useEffect(() => {
    document.body.classList.add('sandbox-active');
    return () => {
      document.body.classList.remove('sandbox-active');
    };
  }, []);

  // 3. Auto-save notes
  useEffect(() => {
    if (!problem) return;
    setNotesStatus('Saving...');
    const timer = setTimeout(() => {
      localStorage.setItem(`dsa_notes_${slug}`, notesText);
      setNotesStatus('Saved');
    }, 1000);
    return () => clearTimeout(timer);
  }, [notesText, slug, problem]);

  // 4. Connect Language Server Protocol (LSP) WebSocket Client
  const connectLanguageServer = (lang, editor) => {
    // Clean up existing LSP client and websocket connection
    if (lspClientRef.current) {
      try {
        lspClientRef.current.stop();
      } catch (e) {}
      lspClientRef.current = null;
    }
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
    }

    const socketLanguage = lang === 'python3' ? 'python' : lang;
    if (!['cpp', 'python', 'java'].includes(socketLanguage)) return;

    let wsUrl = "";
    if (BACKEND_URL) {
      const base = BACKEND_URL.replace(/^http/, 'ws');
      wsUrl = `${base}/lsp/${socketLanguage}`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/lsp/${socketLanguage}`;
    }

    console.log(`[Monaco LSP] Connecting to WebSocket: ${wsUrl}`);
    const webSocket = new WebSocket(wsUrl);

    webSocket.onopen = () => {
      try {
        const socket = toSocket(webSocket);
        const reader = new WebSocketMessageReader(socket);
        const writer = new WebSocketMessageWriter(socket);

        const languageClient = new MonacoLanguageClient({
          name: `${lang.toUpperCase()} Language Client`,
          clientOptions: {
            documentSelector: [lang === 'python3' ? 'python' : lang],
            errorHandler: {
              error: () => ({ action: ErrorAction.Continue }),
              closed: () => ({ action: CloseAction.DoNotRestart })
            }
          },
          connectionProvider: {
            get: async () => ({ reader, writer })
          }
        });

        languageClient.start();
        lspClientRef.current = languageClient;
        socketRef.current = webSocket;
        console.log(`[Monaco LSP] Client started successfully for ${lang}`);

        reader.onClose(() => {
          console.log(`[Monaco LSP] Connection closed by remote.`);
          languageClient.stop();
        });
      } catch (err) {
        console.error('[Monaco LSP] Error starting language client:', err);
      }
    };

    webSocket.onerror = (err) => {
      console.warn('[Monaco LSP] WebSocket error:', err);
    };
  };

  // 5. Initialize Monaco Editor
  useEffect(() => {
    if (!problem || !editorRef.current) return;

    // Load initial code stub for language
    const currentStubObj = problem.code_stubs.find(stub => stub.lang_slug === selectedLanguage) || problem.code_stubs[0];
    const initialCode = savedCodesRef.current[selectedLanguage] || currentStubObj.body || currentStubObj.code;

    // Create editor instance
    const editor = monaco.editor.create(editorRef.current, {
      value: initialCode,
      language: selectedLanguage === 'python3' ? 'python' : selectedLanguage,
      theme: theme === 'dark' ? 'vs-dark' : 'vs',
      fontSize: fontSize,
      fontFamily: "'JetBrains Mono', monospace",
      minimap: { enabled: false },
      automaticLayout: true,
      tabSize: 4,
      scrollBeyondLastLine: false,
      padding: { top: 16, bottom: 16 }
    });

    monacoRef.current = editor;
    window.editorInstance = editor;

    // Listen for editor value changes to save state in memory
    editor.onDidChangeModelContent(() => {
      const codeValue = editor.getValue();
      savedCodesRef.current[selectedLanguage] = codeValue;
    });

    // Establish WebSocket LSP connection
    connectLanguageServer(selectedLanguage, editor);

    return () => {
      if (editor) {
        editor.dispose();
      }
      if (lspClientRef.current) {
        try {
          lspClientRef.current.stop();
        } catch (e) {}
      }
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (e) {}
      }
      window.editorInstance = null;
    };
  }, [problem]);

  // 6. Handle language selection updates
  const handleLanguageChange = (lang) => {
    setSelectedLanguage(lang);
    if (!monacoRef.current || !problem) return;

    // Save current code to cache
    const currentCodeValue = monacoRef.current.getValue();
    savedCodesRef.current[selectedLanguage] = currentCodeValue;

    // Load stub for new language
    const stubObj = problem.code_stubs.find(stub => stub.lang_slug === lang) || problem.code_stubs[0];
    const targetCode = savedCodesRef.current[lang] || stubObj.body || stubObj.code;

    // Update Monaco editor model language and value
    const model = monacoRef.current.getModel();
    monaco.editor.setModelLanguage(model, lang === 'python3' ? 'python' : lang);
    monacoRef.current.setValue(targetCode);

    // Reconnect LSP WebSocket server
    connectLanguageServer(lang, monacoRef.current);
  };

  // 7. Update Font Size
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.updateOptions({ fontSize: fontSize });
    }
  }, [fontSize]);

  // 7b. Update Monaco Editor Theme dynamically
  useEffect(() => {
    if (monacoRef.current) {
      monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
    }
  }, [theme]);

  // 8. Draggable dividers effects
  const handleSplitMouseDown = (e) => {
    e.preventDefault();
    const container = document.getElementById("sandbox-split-container");
    const resizer = document.getElementById("sandbox-resizer");
    if (!container || !resizer) return;

    resizer.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const overlay = document.createElement("div");
    overlay.id = "sandbox-drag-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.zIndex = "9999";
    overlay.style.cursor = "col-resize";
    document.body.appendChild(overlay);

    const onMouseMove = (moveEvent) => {
      const containerRect = container.getBoundingClientRect();
      const offsetLeft = moveEvent.clientX - containerRect.left;
      let percentage = (offsetLeft / containerRect.width) * 100;
      if (percentage < 20) percentage = 20;
      if (percentage > 85) percentage = 85;

      setSplitWidth(percentage);
      if (monacoRef.current) {
        monacoRef.current.layout();
      }
    };

    const onMouseUp = () => {
      resizer.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const overlayEl = document.getElementById("sandbox-drag-overlay");
      if (overlayEl) overlayEl.remove();
      
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      
      if (monacoRef.current) {
        monacoRef.current.layout();
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleConsoleMouseDown = (e) => {
    e.preventDefault();
    const resizer = document.getElementById("sandbox-console-resizer");
    const drawer = document.getElementById("sandbox-console-drawer");
    if (!resizer || !drawer) return;

    resizer.classList.add("dragging");
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";

    const startY = e.clientY;
    const startHeight = consoleHeightRef.current;
    
    setIsConsoleCollapsed(false);

    const overlay = document.createElement("div");
    overlay.id = "sandbox-console-drag-overlay";
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.zIndex = "9999";
    overlay.style.cursor = "row-resize";
    document.body.appendChild(overlay);

    const onMouseMove = (moveEvent) => {
      const dY = moveEvent.clientY - startY;
      let newHeight = startHeight - dY;
      if (newHeight < 80) newHeight = 80;
      if (newHeight > 450) newHeight = 450;

      setConsoleHeight(newHeight);
      if (monacoRef.current) {
        monacoRef.current.layout();
      }
    };

    const onMouseUp = () => {
      resizer.classList.remove("dragging");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const overlayEl = document.getElementById("sandbox-console-drag-overlay");
      if (overlayEl) overlayEl.remove();

      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);

      if (monacoRef.current) {
        monacoRef.current.layout();
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  // 9. Reset current language code
  const handleResetCode = () => {
    if (!problem || !monacoRef.current) return;
    const originalStubObj = problem.code_stubs.find(stub => stub.lang_slug === selectedLanguage) || problem.code_stubs[0];
    const originalCode = originalStubObj.body || originalStubObj.code;
    monacoRef.current.setValue(originalCode);
    savedCodesRef.current[selectedLanguage] = originalCode;
  };

  // 10. Execute Code Sandbox Endpoint
  const handleRunCode = async (isSubmit = false) => {
    if (!monacoRef.current || !problem) return;
    
    setIsRunning(true);
    setRunResult(null);
    setActiveConsoleTab('result');
    setIsConsoleCollapsed(false);

    const userCode = monacoRef.current.getValue();
    const currentInput = stdinForExecution(testCases[activeTestCaseIndex] || '');
    const activeStubObj = problem.code_stubs.find(stub => stub.lang_slug === selectedLanguage) || problem.code_stubs[0];
    const fullCode = (activeStubObj.prefix != null && activeStubObj.suffix != null)
      ? activeStubObj.prefix + userCode + activeStubObj.suffix
      : userCode;

    if (selectedLanguage === 'python3' && activeStubObj.body) {
      const structureIssue = checkPythonStructure(userCode, activeStubObj.body);
      if (structureIssue) {
        setRunResult({ stdout: '', stderr: structureIssue, code: 1 });
        setIsRunning(false);
        return;
      }
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          language: selectedLanguage === 'python3' ? 'python' : selectedLanguage,
          code: fullCode,
          stdin: currentInput
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.code !== 0 && data.stderr) {
          const hint = friendlyStructureHint(data.stderr, selectedLanguage);
          if (hint) {
            data.stderr = `Hint: ${hint}\n\n--- Raw error ---\n${data.stderr}`;
          }
        }
        setRunResult(data);
        console.log('[Runner Result]', data);
        
        // If they click Submit and code runs successfully without compile error
        if (isSubmit && data.code === 0) {
          // Verify code output equals expected output for the selected case
          const expectedOut = problem.examples[activeTestCaseIndex] 
            ? problem.examples[activeTestCaseIndex].output.trim() 
            : '';
          const actualOut = data.stdout ? data.stdout.trim() : '';

          if (actualOut === expectedOut || expectedOut === '' || actualOut.includes(expectedOut)) {
            // Mark solved!
            toggleProblemCompletion(slug, problem.title);
            setIsSolved(true);
            setShowSolvedModal(true);
          }
        }
      } else {
        setRunResult({
          stdout: '',
          stderr: 'API compilation server returned error state.',
          code: 500
        });
      }
    } catch (e) {
      console.error(e);
      setRunResult({
        stdout: '',
        stderr: `Failed to connect to executor compiler backend: ${e.message}`,
        code: 500
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (!problem) {
    return (
      <div className="sandbox-workspace-panel" style={{ height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <div className="sandbox-skeleton-container" style={{ width: '80%', height: '300px' }}>
          <div className="sandbox-skeleton-pulse" style={{ height: '40px', width: '30%' }}></div>
          <div className="sandbox-skeleton-pulse" style={{ height: '200px', width: '100%' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div id="sandbox-view" className="active" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      
      {/* 1. TOP BAR NAVBAR */}
      <header className="sandbox-header">
        <div className="sandbox-header-left">
          <button className="sandbox-back-btn" onClick={() => navigate('/dashboard')}>
            <i className="fa-solid fa-arrow-left"></i> Back
          </button>
          <div className="sandbox-header-divider"></div>
          <span className="sandbox-header-title">{problem.title}</span>
          <span className={`sandbox-difficulty-badge ${problem.difficulty.toLowerCase()}`} style={{ marginLeft: '12px' }}>
            {problem.difficulty}
          </span>
          {completedProblems.has(slug) && (
            <span style={{ fontSize: '12px', color: 'var(--semantic-success)', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }}>
              <i className="fa-solid fa-circle-check"></i> Solved
            </span>
          )}
        </div>
        <div className="sandbox-header-right">
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
            <i className="fa-solid fa-circle-half-stroke"></i>
          </button>
        </div>
      </header>

      {/* 2. DYNAMIC SPLIT PANELS SECTION */}
      <div className="sandbox-split-container" id="sandbox-split-container">
        
        {/* Left Side: Description / Notes Panel */}
        <div 
          className="sandbox-description-panel" 
          id="sandbox-desc-panel"
          style={{ width: `${splitWidth}%` }}
        >
          <div className="sandbox-title-section">
            <div className="sandbox-title-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 className="sandbox-problem-title" style={{ margin: 0 }}>{problem.title}</h2>
              <a
                href={`https://leetcode.com/problems/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                title="View on LeetCode"
                className="sandbox-leetcode-link"
              >
                View on LeetCode <i className="fa-solid fa-arrow-up-right-from-square"></i>
              </a>
            </div>
            
            {/* Tabs for Description or Notes */}
            <div className="tabs-controller" style={{ width: 'fit-content', marginTop: '12px' }}>
              <button 
                className={`tab-btn ${!showNotes ? 'active' : ''}`}
                onClick={() => setShowNotes(false)}
              >
                <i className="fa-solid fa-align-left"></i> Description
              </button>
              <button 
                className={`tab-btn ${showNotes ? 'active' : ''}`}
                onClick={() => setShowNotes(true)}
              >
                <i className="fa-solid fa-pen-to-square"></i> Notes
              </button>
            </div>
          </div>

          {!showNotes ? (
            /* Problem details */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div
                className="sandbox-body-content"
                dangerouslySetInnerHTML={{ __html: problem.description }}
              />
            </div>
          ) : (
            /* Notes text area panel */
            <div className="pattern-notes-container" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', background: 'transparent', border: 'none', padding: 0 }}>
              <div className="notes-header-row">
                <span className="notes-header-title">
                  <i className="fa-solid fa-sparkles" style={{ color: '#ffa116' }}></i> Personal Reference Notes
                </span>
                <span className={`notes-status-badge ${notesStatus === 'Saving...' ? 'saving' : ''}`}>
                  {notesStatus}
                </span>
              </div>
              <textarea 
                className="pattern-notes-textarea"
                placeholder="Jot down notes, time complexity bounds, or core strategies for this problem..."
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                style={{ flexGrow: 1, height: '100%', minHeight: '300px' }}
              />
            </div>
          )}
        </div>

        {/* Separator draggable bar */}
        <div 
          className="sandbox-resizer" 
          id="sandbox-resizer"
          onMouseDown={handleSplitMouseDown}
        >
          <div className="sandbox-resizer-line"></div>
        </div>

        {/* Right Side: Monaco IDE Editor */}
        <div className="sandbox-workspace-panel" style={{ width: `${100 - splitWidth}%` }}>
          
          {/* Options toolbar */}
          <div className="sandbox-options-bar">
            <div className="sandbox-options-bar-left">
              <select 
                className="sandbox-lang-select"
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
              >
                <option value="cpp">C++</option>
                <option value="python3">Python 3</option>
                <option value="java">Java</option>
              </select>
              
              <button className="sandbox-option-btn" onClick={handleResetCode}>
                <i className="fa-solid fa-rotate-right"></i> Reset Code
              </button>
            </div>

            <div className="sandbox-options-bar-right">
              <span className="sandbox-font-size-label">Font:</span>
              <input 
                type="range" 
                min="10" 
                max="24" 
                value={fontSize} 
                onChange={(e) => setFontSize(parseInt(e.target.value))}
                className="sandbox-font-slider"
              />
              <span className="sandbox-font-val">{fontSize}px</span>
            </div>
          </div>

          {/* Monaco Mount element */}
          <div className="sandbox-monaco-container" ref={editorRef}></div>

          {/* Draggable console bar */}
          <div 
            className="sandbox-console-resizer" 
            id="sandbox-console-resizer"
            onMouseDown={handleConsoleMouseDown}
          >
            <div className="sandbox-console-resizer-line"></div>
          </div>

          {/* Actions drawer & terminal console */}
          <div className="sandbox-console-dock">
            
            {/* Drawer headers */}
            <div className="sandbox-console-header">
              <div className="sandbox-console-header-left">
                <button 
                  className={`sandbox-console-toggle ${isConsoleCollapsed ? 'collapsed' : ''}`}
                  onClick={() => setIsConsoleCollapsed(!isConsoleCollapsed)}
                >
                  Console <i className="fa-solid fa-chevron-down"></i>
                </button>
                <div className="sandbox-console-header-divider"></div>
                
                <button 
                  className={`sandbox-console-tab ${activeConsoleTab === 'testcase' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveConsoleTab('testcase');
                    setIsConsoleCollapsed(false);
                  }}
                >
                  Testcase
                </button>
                <button 
                  className={`sandbox-console-tab ${activeConsoleTab === 'result' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveConsoleTab('result');
                    setIsConsoleCollapsed(false);
                  }}
                >
                  Result
                </button>
              </div>
            </div>

            {/* Expanded drawer screen */}
            <div 
              className={`sandbox-console-drawer ${isConsoleCollapsed ? 'collapsed' : ''}`}
              id="sandbox-console-drawer"
              style={{ height: `${consoleHeight}px` }}
            >
              {activeConsoleTab === 'testcase' ? (
                /* Edit custom inputs view */
                <div className="sandbox-stdin-view">
                  <div className="sandbox-testcase-tabs-row">
                    {testCases.map((_, idx) => (
                      <button 
                        key={idx}
                        className={`sandbox-testcase-pill ${activeTestCaseIndex === idx ? 'active' : ''}`}
                        onClick={() => setActiveTestCaseIndex(idx)}
                      >
                        Case {idx + 1}
                      </button>
                    ))}
                    {testCases.length < 5 && (
                      <button 
                        className="sandbox-add-case-btn"
                        onClick={() => {
                          setTestCases([...testCases, '']);
                          setActiveTestCaseIndex(testCases.length);
                        }}
                      >
                        +
                      </button>
                    )}
                  </div>
                  <textarea 
                    className="sandbox-stdin-textarea"
                    placeholder="Enter custom stdin inputs here..."
                    value={testCases[activeTestCaseIndex] || ''}
                    onChange={(e) => {
                      const next = [...testCases];
                      next[activeTestCaseIndex] = e.target.value;
                      setTestCases(next);
                    }}
                  />
                </div>
              ) : (
                /* Run Results view */
                <div className="sandbox-output-view">
                  {isRunning ? (
                    <div className="sandbox-output-loading-container" style={{ padding: '24px 0' }}>
                      <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '20px', color: 'var(--primary)' }}></i>
                      <div style={{ color: 'var(--ink)', fontSize: '0.85rem', fontWeight: '500' }}>
                        Compiling solution...
                      </div>
                    </div>
                  ) : runResult ? (
                    <div className="sandbox-output-pre-container">
                      
                      {/* Metric specs */}
                      <div className={`sandbox-output-spec-header ${runResult.code === 0 ? 'success' : 'error'}`}>
                        <span>
                          {runResult.code === 0 ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <i className="fa-solid fa-circle-check" style={{ color: 'var(--semantic-success)' }}></i> Finished
                            </span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <i className="fa-solid fa-circle-xmark" style={{ color: 'var(--semantic-error)' }}></i> Error
                            </span>
                          )}
                        </span>
                        <div style={{ display: 'flex', gap: '16px' }}>
                          <span className="sandbox-output-spec-val-badge">Runtime: <b>{runResult.time || 'N/A'}</b></span>
                          <span className="sandbox-output-spec-val-badge">Memory: <b>{runResult.memory || 'N/A'}</b></span>
                        </div>
                      </div>

                      {/* stdout display */}
                      {runResult.stdout !== undefined && runResult.stdout !== null && runResult.stdout !== '' && (
                        <div>
                          <span className="sandbox-output-pre-label stdout">Standard Output:</span>
                          <pre className="sandbox-output-pre">{runResult.stdout}</pre>
                        </div>
                      )}

                      {/* stderr / compile errors */}
                      {runResult.stderr !== undefined && runResult.stderr !== null && runResult.stderr !== '' && (
                        <div>
                          <span className="sandbox-output-pre-label stderr">Standard Error:</span>
                          <pre className="sandbox-output-pre error">{runResult.stderr}</pre>
                        </div>
                      )}

                      {/* Empty display */}
                      {(!runResult.stdout && !runResult.stderr) && (
                        <div style={{ color: '#71717a', textAlign: 'center', padding: '12px' }}>
                          Program executed successfully returning empty stdout streams.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: '#71717a', textAlign: 'center', paddingTop: '20px' }}>
                      Click "Run Code" to compile and run your solution code.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions button row */}
            <div className="sandbox-console-actions-row">
              <button 
                className="sandbox-action-btn-secondary"
                onClick={() => setIsConsoleCollapsed(!isConsoleCollapsed)}
              >
                {isConsoleCollapsed ? 'Expand Console' : 'Hide Console'}
              </button>

              <div className="sandbox-actions-right">
                <button 
                  className="sandbox-action-btn-run" 
                  onClick={() => handleRunCode(false)}
                  disabled={isRunning}
                >
                  <i className="fa-solid fa-play"></i> Run Code
                </button>
                <button 
                  className="sandbox-action-btn-submit"
                  onClick={() => handleRunCode(true)}
                  disabled={isRunning}
                >
                  <i className="fa-solid fa-paper-plane"></i> Submit Code
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* 3. PREMIUM CONGRATULATIONS SOLVED MODAL */}
      {showSolvedModal && (
        <div className="success-modal-overlay" style={{ display: 'flex' }}>
          <div className="success-modal">
            <span className="success-goggles">
              <i className="fa-solid fa-trophy"></i>
            </span>
            <h3 className="success-title">Congratulations!</h3>
            <p className="success-desc">
              Your solution code has successfully passed all test cases! The problem has been marked as completed on your dashboard.
            </p>
            
            <div className="success-receipt-box">
              <div className="receipt-row">
                <span className="receipt-label">Status:</span>
                <span className="receipt-value" style={{ color: 'var(--semantic-success)', fontWeight: 'bold' }}>Accepted</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Language:</span>
                <span className="receipt-value">{selectedLanguage === 'cpp' ? 'C++' : selectedLanguage === 'java' ? 'Java' : 'Python 3'}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Runtime:</span>
                <span className="receipt-value" style={{ color: 'var(--timeline-done)' }}>{runResult ? runResult.time : '12ms'}</span>
              </div>
            </div>

            <button 
              className="success-action-btn"
              onClick={() => {
                setShowSolvedModal(false);
                navigate('/dashboard');
              }}
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
