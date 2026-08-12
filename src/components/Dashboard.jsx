import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import patternsData from '../data/patternsData.json';
import booksData from '../data/booksData.json';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    user,
    isPro,
    problems,
    completedProblems,
    completedPatterns,
    toggleProblemCompletion,
    togglePatternCompletion,
    loginWithGoogle,
    logoutUser,
    upgradeToPro,
    resetProStatus,
    theme,
    toggleTheme,
    activeTab,
    setActiveTab,
    selectedCategories,
    setSelectedCategories,
    searchTerm,
    setSearchTerm,
    expandedPatterns,
    setExpandedPatterns
  } = useApp();

  const handleCategoryClick = (cat) => {
    if (cat === "All") {
      setSelectedCategories(["All"]);
      return;
    }

    setSelectedCategories(prev => {
      const filtered = prev.filter(c => c !== "All");
      if (filtered.includes(cat)) {
        const next = filtered.filter(c => c !== cat);
        return next.length === 0 ? ["All"] : next;
      } else {
        return [...filtered, cat];
      }
    });
  };
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const handleUpgradeClick = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      console.log("⚡ [AlgoFlow Frontend] Fetching Razorpay configurations...");
      const configRes = await fetch(`${BACKEND_URL}/api/config`);
      if (!configRes.ok) throw new Error("API server dynamic config offline.");
      
      const configData = await configRes.json();
      const keyId = configData.keyId;

      if (keyId) {
        console.log("⚡ [AlgoFlow Frontend] Contacting full-stack server for order token...");
        const orderRes = await fetch(`${BACKEND_URL}/api/create-order`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: 29900, // ₹299.00 in paise
            currency: "INR",
            receipt: `rzp_${Math.random().toString(36).substr(2, 6)}_${Date.now()}`
          })
        });

        if (!orderRes.ok) {
          const errData = await orderRes.json();
          throw new Error(errData.error || "Failed to create secure transaction order token.");
        }

        const orderData = await orderRes.json();
        console.log("🟢 [AlgoFlow Frontend] Secure order token received:", orderData.order_id);

        const options = {
          key: keyId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "AlgoFlow Pro",
          description: "One-Time Lifetime Premium Access",
          image: user.photoURL || "https://img.icons8.com/color/96/google-logo.png",
          order_id: orderData.order_id,
          handler: async function (response) {
            console.log("🟢 [AlgoFlow Frontend] Checkout successful. Verifying payment...");
            try {
              const verifyRes = await fetch(`${BACKEND_URL}/api/verify-payment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                })
              });

              if (!verifyRes.ok) {
                const errData = await verifyRes.json();
                throw new Error(errData.error || "Cryptographic signature validation failed.");
              }

              console.log("🟢 [AlgoFlow Frontend] Payment verified! Upgrading profile...");
              await upgradeToPro();
              alert(`🎉 Welcome to AlgoFlow Pro!\n\nYour account has been upgraded successfully.\nTransaction ID: ${response.razorpay_payment_id}`);
            } catch (verifyErr) {
              console.error("❌ [AlgoFlow Frontend] Transaction verification rejected:", verifyErr);
              alert(`❌ Payment Verification Failed!\n\nSecurity signature mismatch. Your membership was NOT upgraded.\n\nDetails: ${verifyErr.message}`);
            }
          },
          prefill: {
            name: user.displayName || "",
            email: user.email || ""
          },
          theme: {
            color: "#f54e00" // Brand Cursor Orange
          },
          modal: {
            ondismiss: function() {
              console.log("ℹ️ [AlgoFlow Frontend] Checkout dismissed by user.");
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (failedResponse) {
          console.error("❌ [AlgoFlow Frontend] Razorpay Standard Payment Error:", failedResponse.error);
          alert(`❌ Payment Failed!\n\nReason: ${failedResponse.error.description || "Unknown failure"}`);
        });
        rzp.open();
      } else {
        triggerSandboxFallback();
      }
    } catch (err) {
      console.warn("⚠️ [AlgoFlow Frontend] Server-side checkout pipeline failed, trying fallback...", err);
      triggerSandboxFallback();
    }
  };

  const triggerSandboxFallback = () => {
    const success = confirm("💳 [Simulated Razorpay Checkout]\n\nThis is a mock transaction gateway because live keys are not configured or the server is running offline.\n\nClick 'OK' to simulate a successful payment of ₹299.\nClick 'Cancel' to mock a cancelled/failed transaction.");
    if (success) {
      upgradeToPro();
      alert("🎉 [Simulated Success] Welcome to AlgoFlow Pro! Sandbox upgrade completed successfully.");
    } else {
      alert("Payment Cancelled.");
    }
  };

  const categories = ["All", ...patternsData.map(c => c.cat)];

  const handleTogglePatternExpand = (patternName) => {
    setExpandedPatterns(prev => ({
      ...prev,
      [patternName]: !prev[patternName]
    }));
  };

  const getProblemSlug = (title) => {
    return title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '-');
  };

  // Filter patterns and problems based on search and category
  const filteredPatternsData = patternsData.map(category => {
    const hasAll = selectedCategories.includes("All");
    if (!hasAll && !selectedCategories.includes(category.cat)) {
      return null;
    }

    const filteredPatterns = category.patterns.map(pattern => {
      // Filter examples based on search term
      const matchedExamples = pattern.examples.filter(ex => {
        const matchesSearch = ex.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
      });

      const matchesPatternName = pattern.name.toLowerCase().includes(searchTerm.toLowerCase());

      if (matchedExamples.length === 0 && !matchesPatternName) {
        return null;
      }

      return {
        ...pattern,
        matchedExamples: matchedExamples
      };
    }).filter(Boolean);

    if (filteredPatterns.length === 0) {
      return null;
    }

    return {
      ...category,
      patterns: filteredPatterns
    };
  }).filter(Boolean);

  // Statistics calculation
  const totalProblemsCount = patternsData.reduce((acc, cat) => {
    return acc + cat.patterns.reduce((sum, p) => sum + p.examples.length, 0);
  }, 0);
  
  const completedCount = completedProblems.size;
  const completionPercentage = totalProblemsCount > 0 ? Math.round((completedCount / totalProblemsCount) * 100) : 0;

  const totalPatternsCount = patternsData.reduce((acc, cat) => acc + cat.patterns.length, 0);
  const completedPatternsCount = completedPatterns.size;

  return (
    <div className="app-container">
      {/* 1. GLASSMORPHISM NAVBAR HEADER */}
      <header>
        <div className="header-backdrop-glow"></div>
        <div className="header-content">
          <div className="title-area">
            <h1 className="glow-title">
              <span className="logo-icon-wrap"><i className="fa-solid fa-diagram-project"></i></span>
              <span className="brand-name">AlgoFlow</span>
            </h1>
            <p>Elevate your problem-solving. Master <span className="highlight-accent">algorithmic patterns</span> and crack the coding <span className="highlight-accent">interview</span>.</p>
          </div>

          <div className="right-header-controls">
            
            {/* User Info / Profile Avatar dropdown */}
            {user ? (
              <div 
                className={`user-profile ${showProfileDropdown ? 'active' : ''}`}
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                style={{ position: 'relative' }}
              >
                <div className="user-avatar">
                  {user.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="user-name">{user.displayName}</span>
                <i className="fa-solid fa-chevron-down user-chevron"></i>
                
                {showProfileDropdown && (
                  <div className="profile-dropdown" style={{ display: 'flex' }} onClick={(e) => e.stopPropagation()}>
                    <div className="dropdown-user-info">
                      <span className="dropdown-user-name">{user.displayName}</span>
                      <span className="dropdown-user-email">{user.email}</span>
                    </div>
                    <div className="dropdown-sync-status">
                      <span className="status-dot green"></span>
                      <span>Cloud Status Synced</span>
                    </div>
                    {isPro ? (
                      <div className="pro-banner">
                        <i className="fa-solid fa-crown"></i> Pro Premium Active
                      </div>
                    ) : (
                      <button className="dropdown-item" onClick={() => { handleUpgradeClick(); setShowProfileDropdown(false); }}>
                        <i className="fa-solid fa-bolt" style={{ color: 'var(--primary)' }}></i> Upgrade to Pro
                      </button>
                    )}
                    <button className="dropdown-item logout" onClick={() => { logoutUser(); setShowProfileDropdown(false); }}>
                      <i className="fa-solid fa-arrow-right-from-bracket"></i> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="auth-btn" onClick={() => setShowAuthModal(true)}>
                <i className="fa-solid fa-circle-user"></i> Sign In
              </button>
            )}

            {/* View Tabs Controller */}
            <div className="tabs-controller">
              <button 
                className={`tab-btn ${activeTab === 'patterns' ? 'active' : ''}`}
                onClick={() => setActiveTab("patterns")}
              >
                <i className="fa-solid fa-folder-tree"></i> DSA Patterns
              </button>
              <button 
                className={`tab-btn ${activeTab === 'books' ? 'active' : ''}`}
                onClick={() => setActiveTab("books")}
              >
                <i className="fa-solid fa-book-bookmark"></i> Study Library
              </button>
            </div>

            <button 
              className="theme-toggle-btn" 
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              <i className="fa-solid fa-circle-half-stroke"></i>
            </button>

          </div>
        </div>
      </header>

      {/* 2. STATS PREPARATION WIDGET PANEL */}
      <div className="stats-panel" id="stats-panel">
        <div className="stat-card">
          <div className="stat-icon"><i className="fa-solid fa-percent"></i></div>
          <div className="stat-info">
            <div className="stat-val">{completionPercentage}%</div>
            <div className="stat-label">Overall Solved</div>
            <div className="progress-bar-container">
              <div className="progress-fill" style={{ width: `${completionPercentage}%` }}></div>
            </div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon"><i className="fa-solid fa-code"></i></div>
          <div className="stat-info">
            <div className="stat-val">{completedCount} / {totalProblemsCount}</div>
            <div className="stat-label">Problems Solved</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon"><i className="fa-solid fa-list-check"></i></div>
          <div className="stat-info">
            <div className="stat-val">
              {completedPatternsCount} / {totalPatternsCount}
            </div>
            <div className="stat-label">Patterns Mastered</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon"><i className="fa-solid fa-bookmark"></i></div>
          <div className="stat-info">
            <div className="stat-val">{booksData.length}</div>
            <div className="stat-label">Reference Books</div>
          </div>
        </div>
      </div>

      {/* 3. CONTROLS PANEL (SEARCH & PILL FILTERS) */}
      <div className="controls-panel">
        <div className="search-wrapper">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input 
            id="search" 
            type="text" 
            placeholder="Search patterns, details, canonical questions or books..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
          />
        </div>
        
        {activeTab === "patterns" && (
          <div className="filters-row" id="filters-row">
            <span className="filter-label">Categories:</span>
            <div className="filters">
              {categories.map(cat => {
                const isSelected = selectedCategories.includes(cat);
                return (
                  <button 
                    key={cat} 
                    className={`filter-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => handleCategoryClick(cat)}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. MAIN VIEWS LAYOUT PORTPORTS */}
      <main style={{ marginTop: '24px' }}>
        {activeTab === "patterns" ? (
          /* PATTERNS SECTION CATALOG GRID */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {filteredPatternsData.map(category => (
              <div key={category.cat} className="category-section">
                <div className="cat-header">
                  <span className="cat-dot-large" style={{ background: category.color }}></span>
                  <h2 className="cat-title">{category.cat}</h2>
                  <span className="cat-count">
                    {category.patterns.length} {category.patterns.length === 1 ? 'Pattern' : 'Patterns'}
                  </span>
                </div>

                <div className="patterns-grid">
                  {category.patterns.map(pattern => {
                    const isExpanded = !!expandedPatterns[pattern.name];
                    const numExamples = pattern.examples.length;
                    const matchedCount = pattern.matchedExamples ? pattern.matchedExamples.length : numExamples;
                    const isPatternCompleted = completedPatterns.has(pattern.name);
                    
                    return (
                      <div 
                        key={pattern.name} 
                        className={`pattern-card ${isExpanded ? 'expanded' : ''} ${isPatternCompleted ? 'completed' : ''}`}
                        onClick={() => handleTogglePatternExpand(pattern.name)}
                      >
                        <div className="card-top">
                          <div className="pattern-meta" onClick={(e) => e.stopPropagation()}>
                            <span 
                              className={`pattern-checkbox ${isPatternCompleted ? 'checked' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePatternCompletion(pattern.name, pattern.examples);
                              }}
                              style={{ marginRight: '10px', cursor: 'pointer', fontSize: '1.05rem', display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}
                            >
                              <i className={`fa-solid ${isPatternCompleted ? 'fa-circle-check' : 'fa-circle'}`} style={{ color: isPatternCompleted ? 'var(--primary, #f54e00)' : 'var(--hairline-strong, #ccc)' }}></i>
                            </span>
                            <span className="pattern-name">{pattern.name}</span>
                          </div>
                          <span className="expand-icon">
                            <i className="fa-solid fa-chevron-down"></i>
                          </span>
                        </div>

                        <p className="pattern-idea">{pattern.idea}</p>

                        <div className="badges-row">
                          <span className={`badge ${
                            pattern.difficulty.toLowerCase() === 'easy' ? 'badge-easy' : 
                            pattern.difficulty.toLowerCase() === 'medium' ? 'badge-medium' : 'badge-hard'
                          }`}>
                            {pattern.difficulty}
                          </span>
                          <span className="badge badge-complexity">{pattern.complexity}</span>
                        </div>

                        <div className="card-details" onClick={(e) => e.stopPropagation()}>
                          <div className="detail-section">
                            <div className="detail-title"><i className="fa-solid fa-circle-question"></i> When to Use</div>
                            <div className="detail-body">{pattern.when}</div>
                          </div>

                          <div className="detail-section">
                            <div className="detail-title"><i className="fa-solid fa-terminal"></i> Examples & stubs ({matchedCount})</div>
                            <div className="example-pills">
                              {(pattern.matchedExamples || pattern.examples).map(ex => {
                                const slug = getProblemSlug(ex);
                                const isCompleted = completedProblems.has(slug);
                                const isScraped = problems.some(p => p.slug === slug);

                                return (
                                  <div key={ex} className={`example-pill ${isCompleted ? 'solved' : ''}`}>
                                    <span 
                                      className={`problem-checkbox ${isCompleted ? 'checked' : ''}`}
                                      onClick={() => toggleProblemCompletion(slug, pattern.name, pattern.examples)}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <i className={`fa-solid ${isCompleted ? 'fa-square-check' : 'fa-square'}`}></i>
                                    </span>
                                    {isScraped ? (
                                      <>
                                        <span 
                                          className="problem-link"
                                          onClick={() => navigate(`/problem/${slug}`)}
                                          style={{ cursor: 'pointer', paddingRight: '2px' }}
                                        >
                                          {ex}
                                        </span>
                                        <a 
                                          href={`https://leetcode.com/problems/${slug}`} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          title="View on LeetCode"
                                          style={{
                                            padding: '4px 8px 4px 2px',
                                            color: 'var(--muted)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            opacity: 0.6,
                                            transition: 'opacity 0.2s, color 0.2s'
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.opacity = '1';
                                            e.currentTarget.style.color = 'var(--primary)';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.opacity = '0.6';
                                            e.currentTarget.style.color = 'var(--muted)';
                                          }}
                                        >
                                          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '10px' }}></i>
                                        </a>
                                      </>
                                    ) : (
                                      <a 
                                        href={`https://leetcode.com/problems/${slug}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="problem-link"
                                      >
                                        {ex} <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '10px' }}></i>
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {pattern.tip && (
                            <div className="pro-tip">
                              <div className="pro-tip-title">
                                <i className="fa-solid fa-lightbulb"></i> Interviewer Tip
                              </div>
                              <div className="pro-tip-body">{pattern.tip}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* STUDY HANDBOOKS LIBRARY VAULT VIEW */
          <div className="library-list">
            {booksData.map(book => {
              const hasAccess = user && isPro;
              return (
                <div 
                  key={book.title} 
                  className={`book-list-item ${!hasAccess ? 'locked' : ''}`}
                >
                  <div className="book-list-meta">
                    <div className="book-list-icon">
                      <i className="fa-solid fa-file-pdf"></i>
                    </div>
                    <div className="book-list-details">
                      <h3 className="book-list-title">
                        {book.title}
                        {!hasAccess && <span className="book-locked-tag"><i className="fa-solid fa-lock"></i> Locked</span>}
                      </h3>
                      <span className="book-list-author">{book.author}</span>
                      <p className="book-list-desc">{book.desc}</p>
                    </div>
                  </div>
                  
                  <div className="book-list-actions">
                    {hasAccess ? (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <a 
                          href={`/${book.path}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="book-list-btn"
                          title="View PDF Book"
                        >
                          <i className="fa-solid fa-eye"></i>
                        </a>
                        <a 
                          href={`/${book.path}`} 
                          download
                          className="book-list-btn"
                          title="Download PDF"
                        >
                          <i className="fa-solid fa-download"></i>
                        </a>
                      </div>
                    ) : (
                      <button 
                        className="unlock-pro-btn"
                        onClick={handleUpgradeClick}
                      >
                        <i className="fa-solid fa-lock"></i> Unlock Vault
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 5. GOOGLE AUTHENTICATION MODAL */}
      {showAuthModal && (
        <div className="mock-modal-overlay" style={{ display: 'flex' }} onClick={() => setShowAuthModal(false)}>
          <div className="mock-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="mock-modal-title">Sign In to Save Progress</h3>
            <div className="mock-modal-subtitle" style={{ marginBottom: '24px' }}>
              Connect with your Google account to sync notes, completed problems, and Pro membership across all your devices.
            </div>
            
            <button 
              className="google-sign-in-btn"
              onClick={async () => {
                await loginWithGoogle();
                setShowAuthModal(false);
              }}
              style={{
                width: '100%',
                padding: '12px',
                background: '#ffffff',
                border: '1px solid var(--hairline-strong)',
                borderRadius: '6px',
                color: '#3c4043',
                fontSize: '15px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              <img 
                src="https://img.icons8.com/color/48/google-logo.png" 
                alt="Google Logo" 
                style={{ width: '20px', height: '20px' }} 
              />
              Continue with Google
            </button>

            <button 
              onClick={() => setShowAuthModal(false)}
              style={{ 
                width: '100%',
                padding: '10px', 
                background: 'transparent', 
                border: 'none', 
                borderRadius: '6px', 
                color: 'var(--muted)', 
                cursor: 'pointer',
                marginTop: '12px',
                fontSize: '14px'
              }}
            >
              Keep Browsing as Guest
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
