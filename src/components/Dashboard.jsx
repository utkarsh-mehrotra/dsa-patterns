import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import patternsData from '../data/patternsData.json';
import booksData from '../data/booksData.json';

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    user,
    isPro,
    problems,
    completedProblems,
    toggleProblemCompletion,
    loginMockUser,
    logoutUser,
    upgradeToPro
  } = useApp();

  const [activeTab, setActiveTab] = useState("patterns");
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedPatterns, setExpandedPatterns] = useState({});
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [mockName, setMockName] = useState("");
  const [mockEmail, setMockEmail] = useState("");

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
    if (activeCategory !== "All" && category.cat !== activeCategory) {
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
                <div className="user-avatar" style={{ background: '#ffa116', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#121212', fontWeight: 'bold', fontSize: '13px' }}>
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
                      <button className="dropdown-item" onClick={() => { upgradeToPro(); setShowProfileDropdown(false); }}>
                        <i className="fa-solid fa-bolt" style={{ color: '#ffa116' }}></i> Upgrade to Pro
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
                <i className="fa-solid fa-circle-user"></i> Guest Sign In
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
              {patternsData.reduce((acc, cat) => acc + cat.patterns.length, 0)}
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
              {categories.map(cat => (
                <button 
                  key={cat} 
                  className={`filter-btn ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
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
                  <span className="cat-dot-large" style={{ background: category.color, boxShadow: `0 0 10px ${category.color}` }}></span>
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
                    
                    return (
                      <div 
                        key={pattern.name} 
                        className={`pattern-card ${isExpanded ? 'expanded' : ''}`}
                        onClick={() => handleTogglePatternExpand(pattern.name)}
                      >
                        <div className="card-top">
                          <div className="pattern-meta" onClick={(e) => e.stopPropagation()}>
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
                                      onClick={() => toggleProblemCompletion(slug, pattern.name)}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <i className={`fa-solid ${isCompleted ? 'fa-square-check' : 'fa-square'}`}></i>
                                    </span>
                                    {isScraped ? (
                                      <span 
                                        className="problem-link"
                                        onClick={() => navigate(`/problem/${slug}`)}
                                        style={{ cursor: 'pointer' }}
                                      >
                                        {ex} <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '10px' }}></i>
                                      </span>
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
              const hasAccess = isPro;
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
                      <a 
                        href={`/${book.path}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="book-list-btn primary"
                      >
                        <i className="fa-solid fa-download"></i> View PDF
                      </a>
                    ) : (
                      <button 
                        className="unlock-pro-btn"
                        onClick={upgradeToPro}
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

      {/* 5. GUEST AUTHENTICATION MODAL */}
      {showAuthModal && (
        <div className="mock-modal-overlay" style={{ display: 'flex' }}>
          <div className="mock-modal">
            <h3 className="mock-modal-title">Sign In to Save Progress</h3>
            <div className="mock-modal-subtitle">Save progress to your personal dashboard</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '20px' }}>
              <input 
                type="text" 
                placeholder="Enter display name..." 
                className="mock-auth-input"
                value={mockName}
                onChange={(e) => setMockName(e.target.value)}
                style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', outline: 'none' }}
              />
              <input 
                type="email" 
                placeholder="Enter email address..." 
                className="mock-auth-input"
                value={mockEmail}
                onChange={(e) => setMockEmail(e.target.value)}
                style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', color: '#fff', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button 
                  className="mock-auth-submit-btn"
                  onClick={() => {
                    loginMockUser(mockName, mockEmail);
                    setShowAuthModal(false);
                  }}
                  style={{ flex: 1, padding: '10px', background: '#ffa116', color: '#121212', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Sign In
                </button>
                <button 
                  onClick={() => setShowAuthModal(false)}
                  style={{ padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#a1a1aa', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
