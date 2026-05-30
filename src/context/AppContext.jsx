import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [completedProblems, setCompletedProblems] = useState(new Set());
  const [completedPatterns, setCompletedPatterns] = useState(new Set());
  const [notes, setNotes] = useState({});
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load static catalog metadata or list of problems
  useEffect(() => {
    // In production, we fetch problem listings from server or statically compile them.
    // For now, we dynamically check the catalog listings.
    const loadProblems = async () => {
      try {
        // We will fetch problem database list
        const res = await fetch('/api/problems-metadata');
        if (res.ok) {
          const data = await res.json();
          setProblems(data);
        } else {
          // Statically compile standard list if metadata API is offline
          setProblems([]);
        }
      } catch (e) {
        console.warn("API Problems metadata offline, loading client defaults.");
      } finally {
        setLoading(false);
      }
    };
    loadProblems();
  }, []);

  // Initialize Auth & LocalStorage Progress
  useEffect(() => {
    // Load local auth
    const storedUser = localStorage.getItem("dsa_mock_user");
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        setUser(u);
        setIsPro(u.isPro || localStorage.getItem("dsa_isPro") === "true");
      } catch (e) {
        localStorage.removeItem("dsa_mock_user");
      }
    }

    // Load local progress state
    const localProblems = localStorage.getItem("dsa_completed_problems");
    const localPatterns = localStorage.getItem("dsa_completed_patterns");
    if (localProblems) {
      try {
        setCompletedProblems(new Set(JSON.parse(localProblems)));
      } catch (e) {}
    }
    if (localPatterns) {
      try {
        setCompletedPatterns(new Set(JSON.parse(localPatterns)));
      } catch (e) {}
    }

    // Load user scoped notes
    const loadedNotes = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("dsa_notes_")) {
        const name = key.replace("dsa_notes_", "");
        loadedNotes[name] = localStorage.getItem(key) || '';
      }
    }
    setNotes(loadedNotes);
  }, []);

  // Sync to local storage on changes
  useEffect(() => {
    if (completedProblems.size > 0) {
      localStorage.setItem("dsa_completed_problems", JSON.stringify(Array.from(completedProblems)));
    }
  }, [completedProblems]);

  useEffect(() => {
    if (completedPatterns.size > 0) {
      localStorage.setItem("dsa_completed_patterns", JSON.stringify(Array.from(completedPatterns)));
    }
  }, [completedPatterns]);

  // Auth actions
  const loginMockUser = (name, email) => {
    const mockUser = {
      uid: "mock_" + Date.now(),
      displayName: name || "Developer Guest",
      email: email || "guest@algoflow.com",
      isPro: isPro
    };
    setUser(mockUser);
    localStorage.setItem("dsa_mock_user", JSON.stringify(mockUser));
  };

  const logoutUser = () => {
    setUser(null);
    setIsPro(false);
    localStorage.removeItem("dsa_mock_user");
    localStorage.removeItem("dsa_isPro");
  };

  // Progress actions
  const toggleProblemCompletion = (problemId, patternId) => {
    const nextProblems = new Set(completedProblems);
    if (nextProblems.has(problemId)) {
      nextProblems.delete(problemId);
    } else {
      nextProblems.add(problemId);
    }
    setCompletedProblems(nextProblems);

    // Dynamic pattern check - check if all problems in this pattern are completed
    // (This will be calculated in components, but we trigger standard updates)
  };

  const setProblemNote = (slug, text) => {
    setNotes(prev => {
      const nextNotes = { ...prev, [slug]: text };
      localStorage.setItem(`dsa_notes_${slug}`, text);
      return nextNotes;
    });
  };

  // Checkout Upgrade
  const upgradeToPro = () => {
    setIsPro(true);
    localStorage.setItem("dsa_isPro", "true");
    if (user) {
      const updatedUser = { ...user, isPro: true };
      setUser(updatedUser);
      localStorage.setItem("dsa_mock_user", JSON.stringify(updatedUser));
    }
  };

  return (
    <AppContext.Provider value={{
      user,
      isPro,
      problems,
      loading,
      completedProblems,
      completedPatterns,
      notes,
      loginMockUser,
      logoutUser,
      toggleProblemCompletion,
      setProblemNote,
      upgradeToPro
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
