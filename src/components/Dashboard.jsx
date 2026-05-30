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
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  // Filter patterns and problems based on search and category
  const filteredPatternsData = patternsData.map(category => {
    if (activeCategory !== "All" && category.cat !== activeCategory) {
      return null;
    }

    const filteredPatterns = category.patterns.map(pattern => {
      // Filter examples based on search term
      const matchedExamples = pattern.examples.filter(ex => {
        const slug = getProblemSlug(ex);
        const matchesSearch = ex.toLowerCase().includes(searchTerm.toLowerCase());
        // Verify if we actually have this problem scraped locally
        const isScraped = problems.some(p => p.slug === slug);
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

  const handleOpenProblem = (title) => {
    const slug = getProblemSlug(title);
    navigate(`/problem/${slug}`);
  };

  return (
    <div className="dsa-app-layout">
      {/* Dynamic Glow Overlay */}
      <div className="radial-glow" id="radial-glow"></div>

      {/* HEADER NAVBAR */}
      <header className="dsa-header">
        <div className="dsa-header-left">
          <div className="dsa-logo">
            <i className="fa-solid fa-code-fork"></i>
          </div>
          <span className="brand-name">AlgoFlow</span>
          <div className="dsa-header-divider"></div>
          <span className="brand-tagline">DSA Reference Catalog</span>
        </div>

        <div className="dsa-header-right">
          {isPro ? (
            <span className="pro-badge-active">
              <i className="fa-solid fa-crown"></i> Pro Active
            </span>
          ) : (
            <button className="pro-upgrade-btn" onClick={upgradeToPro}>
              <i className="fa-solid fa-bolt"></i> Upgrade to Pro
            </button>
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="user-profile-avatar" title={user.email}>
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <button className="dsa-header-action-btn" onClick={logoutUser}>
                Sign Out
              </button>
            </div>
          ) : (
            <button className="dsa-header-action-btn" onClick={() => setShowAuthModal(true)}>
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* STATS BREADCRUMB HERO BLOCK */}
      <section className="dashboard-stats-card">
        <div className="stats-header-row">
          <div>
            <h1 className="stats-hero-title">Master the Technical Interview</h1>
            <p className="stats-hero-subtitle">Visual dynamic roadmap mapping key algorithmic categories and textbook patterns.</p>
          </div>
          <div className="stats-numeric-progress-circle">
            <span className="stats-numeric-val">{completionPercentage}%</span>
            <span className="stats-numeric-label">Completed</span>
          </div>
        </div>

        <div className="stats-grid-row">
          <div className="stats-mini-card">
            <span className="stats-mini-label">Overall Progress</span>
            <span className="stats-mini-val">{completedCount} / {totalProblemsCount}</span>
            <span className="stats-mini-caption">Curated high-frequency LeetCode templates</span>
          </div>
          <div className="stats-mini-card">
            <span className="stats-mini-label">Active Patterns</span>
            <span className="stats-mini-val">
              {patternsData.reduce((acc, cat) => acc + cat.patterns.length, 0)} Patterns
            </span>
            <span className="stats-mini-caption">Spanning {patternsData.length} core DSA categories</span>
          </div>
          <div className="stats-mini-card">
            <span className="stats-mini-label">PDF Textbook Vault</span>
            <span className="stats-mini-val">{booksData.length} Handbooks</span>
            <span className="stats-mini-caption">{isPro ? "All fully unlocked" : "Requires premium upgrade"}</span>
          </div>
        </div>
      </section>

      {/* FILTER CONTROLS TAB BAR */}
      <div className="dsa-tab-filters-row">
        <div className="tab-filters-left">
          <button 
            className={`dsa-tab-btn ${activeTab === 'patterns' ? 'active' : ''}`}
            onClick={() => setActiveTab("patterns")}
          >
            <i className="fa-solid fa-cubes"></i> Patterns catalog
          </button>
          <button 
            className={`dsa-tab-btn ${activeTab === 'books' ? 'active' : ''}`}
            onClick={() => setActiveTab("books")}
          >
            <i className="fa-solid fa-book"></i> Textbook Vault
          </button>
        </div>

        {activeTab === "patterns" && (
          <div className="tab-filters-right">
            <div className="dsa-search-wrapper">
              <i className="fa-solid fa-magnifying-glass search-icon"></i>
              <input 
                type="text" 
                placeholder="Search patterns or problems..." 
                className="dsa-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* CATEGORY PILL ROW (For Patterns Tab) */}
      {activeTab === "patterns" && (
        <div className="dsa-category-pills-row">
          {categories.map(cat => (
            <button 
              key={cat} 
              className={`cat-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* MAIN VIEWPORT LAYOUT */}
      <main className="dsa-main-content">
        {activeTab === "patterns" ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {filteredPatternsData.map(category => (
              <div key={category.cat} className="dsa-category-section">
                <div className="category-section-title-row">
                  <span className="category-indicator-dot" style={{ background: category.color }}></span>
                  <h2 className="category-section-title">{category.cat}</h2>
                </div>

                <div className="patterns-card-grid">
                  {category.patterns.map(pattern => {
                    const isExpanded = !!expandedPatterns[pattern.name];
                    const numExamples = pattern.examples.length;
                    const matchedCount = pattern.matchedExamples ? pattern.matchedExamples.length : numExamples;

                    return (
                      <div key={pattern.name} className="pattern-card">
                        <div className="pattern-card-header-row">
                          <div>
                            <span className="pattern-difficulty-badge">{pattern.difficulty}</span>
                            <h3 className="pattern-card-title">{pattern.name}</h3>
                          </div>
                          <span className="pattern-complexity-label">{pattern.complexity}</span>
                        </div>

                        <p className="pattern-core-idea">
                          <strong>Core Concept:</strong> {pattern.idea}
                        </p>

                        <div className="pattern-meta-block">
                          <strong>When to Use:</strong> {pattern.when}
                        </div>

                        <div className="interviewer-tip-callout">
                          <i className="fa-solid fa-lightbulb"></i>
                          <span><strong>Interviewer Tip:</strong> {pattern.tip}</span>
                        </div>

                        {/* Expandable problems list */}
                        <div className="patterns-examples-section">
                          <button 
                            className="expand-examples-btn"
                            onClick={() => handleTogglePatternExpand(pattern.name)}
                          >
                            <span>Examples ({matchedCount})</span>
                            <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                          </button>

                          {isExpanded && (
                            <div className="examples-dropdown-list">
                              {(pattern.matchedExamples || pattern.examples).map(ex => {
                                const slug = getProblemSlug(ex);
                                const isCompleted = completedProblems.has(slug);
                                const isScraped = problems.some(p => p.slug === slug);

                                return (
                                  <div key={ex} className="example-item-row">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <input 
                                        type="checkbox" 
                                        className="example-complete-checkbox"
                                        checked={isCompleted}
                                        onChange={() => toggleProblemCompletion(slug, pattern.name)}
                                      />
                                      <span className={`example-name ${isCompleted ? 'completed' : ''}`}>
                                        {ex}
                                      </span>
                                    </div>
                                    {isScraped ? (
                                      <button 
                                        className="example-workspace-launch-btn"
                                        onClick={() => handleOpenProblem(ex)}
                                      >
                                        <i className="fa-solid fa-terminal"></i> Open Workspace
                                      </button>
                                    ) : (
                                      <span className="example-external-reference-label">
                                        Reference Only
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
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
          /* HANDBOOKS LIBRARY VAULT VIEW */
          <div className="books-section-grid">
            {booksData.map(book => (
              <div key={book.title} className="book-card">
                <div className="book-cover-mock">
                  <i className="fa-solid fa-file-pdf pdf-mock-icon"></i>
                  <span className="book-cover-mock-title">{book.title}</span>
                  <span className="book-cover-mock-author">{book.author}</span>
                </div>
                <div className="book-card-details">
                  <h3 className="book-card-title">{book.title}</h3>
                  <span className="book-card-tagline">{book.tagline}</span>
                  <p className="book-card-desc">{book.desc}</p>
                  <div className="book-tags-row">
                    {book.tags.map(t => (
                      <span key={t} className="book-tag-pill">{t}</span>
                    ))}
                  </div>
                  {isPro ? (
                    <a 
                      href={`/${book.path}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="book-access-btn"
                    >
                      <i className="fa-solid fa-download"></i> View / Download Textbook
                    </a>
                  ) : (
                    <button className="book-locked-btn" onClick={upgradeToPro}>
                      <i className="fa-solid fa-lock"></i> Upgrade to Unlock Handbooks
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* AUTHENTICATION MODAL */}
      {showAuthModal && (
        <div className="mock-auth-modal-overlay">
          <div className="mock-auth-modal-content">
            <button className="modal-close-btn" onClick={() => setShowAuthModal(false)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
            <h3 className="mock-modal-title">Sign In to Save Progress</h3>
            <div className="mock-modal-subtitle">Save progress to your personal dashboard</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '20px' }}>
              <input 
                type="text" 
                placeholder="Enter display name..." 
                className="mock-auth-input"
                value={mockName}
                onChange={(e) => setMockName(e.target.value)}
              />
              <input 
                type="email" 
                placeholder="Enter email address..." 
                className="mock-auth-input"
                value={mockEmail}
                onChange={(e) => setMockEmail(e.target.value)}
              />
              <button 
                className="mock-auth-submit-btn"
                onClick={() => {
                  loginMockUser(mockName, mockEmail);
                  setShowAuthModal(false);
                }}
              >
                Sign In Guest Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
