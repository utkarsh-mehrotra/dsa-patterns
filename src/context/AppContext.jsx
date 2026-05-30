import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, googleProvider } from '../config/firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isPro, setIsPro] = useState(false);
  const [completedProblems, setCompletedProblems] = useState(new Set());
  const [completedPatterns, setCompletedPatterns] = useState(new Set());
  const [notes, setNotes] = useState({});
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem("dsa_theme") || 'light');

  // Sync visual body classes with theme changes
  useEffect(() => {
    if (theme === 'dark') {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    localStorage.setItem("dsa_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Load static catalog metadata or list of problems
  useEffect(() => {
    const loadProblems = async () => {
      try {
        const res = await fetch('/api/problems-metadata');
        if (res.ok) {
          const data = await res.json();
          setProblems(data);
        } else {
          setProblems([]);
        }
      } catch (e) {
        console.warn("API Problems metadata offline, loading client defaults.");
      }
    };
    loadProblems();
  }, []);

  // Listen to Firebase Auth and pull cloud progress dynamically
  useEffect(() => {
    console.log("⚡ [AlgoFlow Context] Establishing Firebase Auth State listener...");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        console.log("🟢 [AlgoFlow Auth] Google user authenticated:", firebaseUser.uid);
        const userDocRef = doc(db, "users", firebaseUser.uid);

        try {
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            console.log("🟢 [AlgoFlow Sync] Found existing Firestore user document. Merging cloud states...");
            const cloudData = docSnap.data();

            setIsPro(cloudData.isPro || false);
            setCompletedProblems(new Set(cloudData.completedProblems || []));
            setCompletedPatterns(new Set(cloudData.completedPatterns || []));
            setNotes(cloudData.notes || {});

            setUser({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || "Google User",
              email: firebaseUser.email || "",
              photoURL: firebaseUser.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80",
              isPro: cloudData.isPro || false
            });
          } else {
            console.log("ℹ️ [AlgoFlow Sync] No cloud document found. Creating profile and merging local guest progress...");
            
            // Extract current local guest storage states (problems and patterns progress)
            const localProblemsStr = localStorage.getItem("dsa_completed_problems");
            const localPatternsStr = localStorage.getItem("dsa_completed_patterns");

            const localProblems = localProblemsStr ? JSON.parse(localProblemsStr) : [];
            const localPatterns = localPatternsStr ? JSON.parse(localPatternsStr) : [];
            const localIsPro = false; // Newly created profiles always start with Pro deactivated (locked)

            // Gather local note widgets
            const localNotes = {};
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith("dsa_notes_")) {
                const noteName = key.replace("dsa_notes_", "");
                localNotes[noteName] = localStorage.getItem(key) || '';
              }
            }

            // Create firestore entry
            const initialData = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || "",
              displayName: firebaseUser.displayName || "Google User",
              isPro: false,
              completedProblems: localProblems,
              completedPatterns: localPatterns,
              notes: localNotes,
              lastSynced: Date.now()
            };

            await setDoc(userDocRef, initialData);
            console.log("🟢 [AlgoFlow Sync] Created fresh user document. Local progress merged (Pro Locked).");

            setIsPro(false);
            setCompletedProblems(new Set(localProblems));
            setCompletedPatterns(new Set(localPatterns));
            setNotes(localNotes);

            setUser({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || "Google User",
              email: firebaseUser.email || "",
              photoURL: firebaseUser.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80",
              isPro: localIsPro
            });
          }
        } catch (e) {
          console.error("❌ [AlgoFlow Sync] Error synchronizing cloud document, falling back to local defaults:", e);
          setUser({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || "Google User",
            email: firebaseUser.email || "",
            photoURL: firebaseUser.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80",
            isPro: false
          });
        }
      } else {
        console.log("ℹ️ [AlgoFlow Auth] Guest Mode: Loading offline storage configurations (Always Free/Locked).");
        setUser(null);
        setIsPro(false); // Guest mode is strictly locked

        // Load offline guest states (progress only)
        const localProblems = localStorage.getItem("dsa_completed_problems");
        const localPatterns = localStorage.getItem("dsa_completed_patterns");

        if (localProblems) {
          try { setCompletedProblems(new Set(JSON.parse(localProblems))); } catch (e) {}
        } else {
          setCompletedProblems(new Set());
        }

        if (localPatterns) {
          try { setCompletedPatterns(new Set(JSON.parse(localPatterns))); } catch (e) {}
        } else {
          setCompletedPatterns(new Set());
        }

        const guestNotes = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("dsa_notes_")) {
            const name = key.replace("dsa_notes_", "");
            guestNotes[name] = localStorage.getItem(key) || '';
          }
        }
        setNotes(guestNotes);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync state changes back to Firestore if user is authenticated
  const toggleProblemCompletion = async (problemId, patternName, patternProblems) => {
    const nextProblems = new Set(completedProblems);
    if (nextProblems.has(problemId)) {
      nextProblems.delete(problemId);
    } else {
      nextProblems.add(problemId);
    }
    setCompletedProblems(nextProblems);
    localStorage.setItem("dsa_completed_problems", JSON.stringify(Array.from(nextProblems)));

    const nextPatterns = new Set(completedPatterns);
    if (patternName && patternProblems) {
      const allSolved = patternProblems.every(ex => {
        const slug = ex.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-');
        return slug === problemId ? !completedProblems.has(problemId) : completedProblems.has(slug);
      });

      if (allSolved) {
        nextPatterns.add(patternName);
      } else {
        nextPatterns.delete(patternName);
      }
      setCompletedPatterns(nextPatterns);
      localStorage.setItem("dsa_completed_patterns", JSON.stringify(Array.from(nextPatterns)));
    }

    if (auth.currentUser) {
      try {
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(userDocRef, {
          completedProblems: Array.from(nextProblems),
          completedPatterns: Array.from(nextPatterns),
          lastSynced: Date.now()
        }, { merge: true });
        console.log("🟢 [AlgoFlow Sync] Problem progress synced to cloud.");
      } catch (err) {
        console.error("❌ [AlgoFlow Sync] Firestore problem sync error:", err);
      }
    }
  };

  const togglePatternCompletion = async (patternName, patternProblems) => {
    if (!patternName || !patternProblems) return;
    
    const nextPatterns = new Set(completedPatterns);
    const nextProblems = new Set(completedProblems);

    const isCompleted = nextPatterns.has(patternName);
    if (isCompleted) {
      nextPatterns.delete(patternName);
      patternProblems.forEach(ex => {
        const slug = ex.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-');
        nextProblems.delete(slug);
      });
    } else {
      nextPatterns.add(patternName);
      patternProblems.forEach(ex => {
        const slug = ex.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-');
        nextProblems.add(slug);
      });
    }

    setCompletedPatterns(nextPatterns);
    setCompletedProblems(nextProblems);

    localStorage.setItem("dsa_completed_patterns", JSON.stringify(Array.from(nextPatterns)));
    localStorage.setItem("dsa_completed_problems", JSON.stringify(Array.from(nextProblems)));

    if (auth.currentUser) {
      try {
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(userDocRef, {
          completedPatterns: Array.from(nextPatterns),
          completedProblems: Array.from(nextProblems),
          lastSynced: Date.now()
        }, { merge: true });
        console.log("🟢 [AlgoFlow Sync] Pattern progress synced to cloud.");
      } catch (err) {
        console.error("❌ [AlgoFlow Sync] Firestore pattern sync error:", err);
      }
    }
  };

  const setProblemNote = async (slug, text) => {
    setNotes(prev => {
      const nextNotes = { ...prev, [slug]: text };
      localStorage.setItem(`dsa_notes_${slug}`, text);

      if (auth.currentUser) {
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        setDoc(userDocRef, {
          notes: nextNotes,
          lastSynced: Date.now()
        }, { merge: true }).catch(err => {
          console.error("❌ [AlgoFlow Sync] Firestore notes sync error:", err);
        });
      }
      return nextNotes;
    });
  };

  const upgradeToPro = async () => {
    setIsPro(true);
    localStorage.setItem("dsa_isPro", "true");

    if (user) {
      const updatedUser = { ...user, isPro: true };
      setUser(updatedUser);

      try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
          isPro: true,
          lastSynced: Date.now()
        }, { merge: true });
        console.log("🟢 [AlgoFlow Sync] Pro membership successfully upgraded on Firestore!");
      } catch (err) {
        console.error("❌ [AlgoFlow Sync] Firestore Pro upgrade sync error:", err);
      }
    }
  };

  const resetProStatus = async () => {
    setIsPro(false);
    localStorage.removeItem("dsa_isPro");

    if (user) {
      const updatedUser = { ...user, isPro: false };
      setUser(updatedUser);

      try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
          isPro: false,
          lastSynced: Date.now()
        }, { merge: true });
        console.log("🟢 [AlgoFlow Sync] Pro status reset to false in Cloud Firestore.");
      } catch (err) {
        console.error("❌ [AlgoFlow Sync] Cloud Firestore reset error:", err);
      }
    }
  };

  // Google Authenticators
  const loginWithGoogle = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("❌ [AlgoFlow Auth] Google authentication error:", err);
      alert(`Google Sign-In Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const logoutUser = async () => {
    try {
      setLoading(true);
      await signOut(auth);
      console.log("🟢 [AlgoFlow Auth] Google user successfully signed out.");
    } catch (err) {
      console.error("❌ [AlgoFlow Auth] Sign out error:", err);
    } finally {
      setLoading(false);
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
      loginWithGoogle,
      logoutUser,
      toggleProblemCompletion,
      togglePatternCompletion,
      setProblemNote,
      upgradeToPro,
      resetProStatus,
      theme,
      toggleTheme
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
