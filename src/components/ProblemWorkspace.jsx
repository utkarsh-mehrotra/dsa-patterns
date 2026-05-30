import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import * as monaco from 'monaco-editor';
import { WebSocketMessageReader, WebSocketMessageWriter, toSocket } from 'vscode-ws-jsonrpc';
import { MonacoLanguageClient } from 'monaco-languageclient';
import { CloseAction, ErrorAction } from 'vscode-languageclient';

export default function ProblemWorkspace() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { completedProblems, toggleProblemCompletion } = useApp();

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
            const initialCases = data.examples.map(ex => {
              // Extract the value part if there is an equals sign, otherwise keep as is
              let stdin = ex.input;
              if (stdin.includes('\n')) {
                stdin = stdin.split('\n').map(l => l.includes('=') ? l.split('=')[1].trim() : l).join('\n');
              } else if (stdin.includes(',')) {
                // If it's a comma-separated inputs line e.g., nums = [2,7,11,15], target = 9
                stdin = stdin.split(',').map(tok => tok.includes('=') ? tok.split('=')[1].trim() : tok).join('\n');
              } else if (stdin.includes('=')) {
                stdin = stdin.split('=')[1].trim();
              }
              return stdin;
            });
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

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/lsp/${socketLanguage}`;

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
    const initialCode = savedCodesRef.current[selectedLanguage] || currentStubObj.code;

    // Create editor instance
    const editor = monaco.editor.create(editorRef.current, {
      value: initialCode,
      language: selectedLanguage === 'python3' ? 'python' : selectedLanguage,
      theme: 'vs-dark',
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
    const targetCode = savedCodesRef.current[lang] || stubObj.code;

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
    monacoRef.current.setValue(originalStubObj.code);
    savedCodesRef.current[selectedLanguage] = originalStubObj.code;
  };

  // 10. Execute Code Sandbox Endpoint
  const handleRunCode = async (isSubmit = false) => {
    if (!monacoRef.current || !problem) return;
    
    setIsRunning(true);
    setRunResult(null);
    setActiveConsoleTab('result');
    setIsConsoleCollapsed(false);

    const userCode = monacoRef.current.getValue();
    const currentInput = testCases[activeTestCaseIndex] || '';

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          language: selectedLanguage === 'python3' ? 'python' : selectedLanguage,
          code: userCode,
          stdin: currentInput
        })
      });

      if (response.ok) {
        const data = await response.json();
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
        </div>
        <div className="sandbox-header-right">
          <span className={`sandbox-difficulty-badge ${problem.difficulty.toLowerCase()}`}>
            {problem.difficulty}
          </span>
          {completedProblems.has(slug) && (
            <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <i className="fa-solid fa-circle-check"></i> Solved
            </span>
          )}
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
            <div className="sandbox-title-row">
              <h2 className="sandbox-problem-title">{problem.title}</h2>
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
              
              {/* Constraints container */}
              {problem.constraints && problem.constraints.length > 0 && (
                <div className="sandbox-constraints-block">
                  <div className="sandbox-constraints-title">Constraints:</div>
                  <ul className="sandbox-constraints-list">
                    {problem.constraints.map((c, idx) => (
                      <li key={idx} dangerouslySetInnerHTML={{ __html: c }}></li>
                    ))}
                  </ul>
                </div>
              )}
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
                    <div className="sandbox-output-loading-container">
                      <div className="sandbox-skeleton-pulse" style={{ width: '40px', height: '40px', borderRadius: '50%' }}></div>
                      <span>Compiling and Running...</span>
                    </div>
                  ) : runResult ? (
                    <div className="sandbox-output-pre-container">
                      
                      {/* Metric specs */}
                      <div className={`sandbox-output-spec-header ${runResult.code === 0 ? 'success' : 'error'}`}>
                        <span>{runResult.code === 0 ? '🟢 Finished' : '❌ Error'}</span>
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
            <p className="success-desc" style={{ fontSize: '14px', color: '#a1a1aa', margin: '12px 0 24px' }}>
              Your solution code has successfully passed all test cases! The problem has been marked as completed on your dashboard.
            </p>
            
            <div className="success-receipt-box" style={{ background: '#121214', border: '1px solid #27272a', padding: '16px', borderRadius: '8px', marginBottom: '24px', textAlign: 'left' }}>
              <div className="receipt-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="receipt-label" style={{ color: '#71717a' }}>Status:</span>
                <span className="receipt-value" style={{ color: '#10b981', fontWeight: 'bold' }}>Accepted</span>
              </div>
              <div className="receipt-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="receipt-label" style={{ color: '#71717a' }}>Language:</span>
                <span className="receipt-value" style={{ color: '#e4e4e7' }}>{selectedLanguage === 'cpp' ? 'C++' : selectedLanguage === 'java' ? 'Java' : 'Python 3'}</span>
              </div>
              <div className="receipt-row" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="receipt-label" style={{ color: '#71717a' }}>Runtime:</span>
                <span className="receipt-value" style={{ color: '#ffa116' }}>{runResult ? runResult.time : '12ms'}</span>
              </div>
            </div>

            <button 
              className="success-action-btn"
              onClick={() => {
                setShowSolvedModal(false);
                navigate('/dashboard');
              }}
              style={{ width: '100%', padding: '12px', background: '#ffa116', color: '#09090b', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
