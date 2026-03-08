import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './Sidebar.css';

const SECTION_META = {
  'statistics-probability':      { icon: '📊', label: 'Statistics & Probability' },
  'linear-algebra':              { icon: '🔢', label: 'Linear Algebra' },
  'python-programming':          { icon: '🐍', label: 'Python Programming' },
  'data-structures-algorithms':  { icon: '🌳', label: 'DS & Algorithms' },
  'pandas-numpy':                { icon: '🐼', label: 'Pandas & NumPy' },
  'sql':                         { icon: '🗄️',  label: 'SQL' },
  'machine-learning':            { icon: '🤖', label: 'Machine Learning' },
  'deep-learning':               { icon: '🧠', label: 'Deep Learning' },
  'model-evaluation':            { icon: '📈', label: 'Model Evaluation' },
  'practice-problems':           { icon: '✏️',  label: 'Practice Problems' },
  'interview-tips':              { icon: '💡', label: 'Interview Tips' },
};

export default function Sidebar({ sections, isOpen, onClose }) {
  const { pathname } = useLocation();
  const activeSlug = pathname.split('/').pop();
  const [expanded, setExpanded] = useState(new Set([activeSlug]));

  // Auto-expand the newly active section
  useEffect(() => {
    setExpanded((prev) => new Set([...prev, activeSlug]));
  }, [activeSlug]);

  const toggle = (slug) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });

  return (
    <>
      {isOpen && <div className="sb-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Sidebar header */}
        <div className="sb-header">
          <span className="sb-emoji">📚</span>
          <div className="sb-title-block">
            <span className="sb-title">DS Interview</span>
            <span className="sb-subtitle">Complete Guide</span>
          </div>
        </div>

        {/* Topic count */}
        <div className="sb-meta">
          {sections.length} Sections &nbsp;·&nbsp; Swiigy Prep
        </div>

        {/* Navigation */}
        <nav className="sb-nav">
          {sections.map((sec, idx) => {
            const meta = SECTION_META[sec.slug] || { icon: '📄', label: fmtTitle(sec.title) };
            const isActive = sec.slug === activeSlug;
            const isOpen_ = expanded.has(sec.slug);

            return (
              <div key={sec.slug} className="sb-group">
                {/* Section row */}
                <div className={`sb-item ${isActive ? 'active' : ''}`}>
                  <NavLink
                    to={`/section/${sec.slug}`}
                    className="sb-link"
                    onClick={() => {
                      toggle(sec.slug);
                      if (window.innerWidth <= 900) onClose();
                    }}
                  >
                    <span className="sb-num">{String(idx + 1).padStart(2, '0')}</span>
                    <span className="sb-icon">{meta.icon}</span>
                    <span className="sb-label">{meta.label}</span>
                    {sec.subsections?.length > 0 && (
                      <span className="sb-arrow">{isOpen_ ? '▾' : '›'}</span>
                    )}
                  </NavLink>
                </div>

                {/* Sub-sections */}
                {isOpen_ && isActive && sec.subsections?.length > 0 && (
                  <div className="sb-subs">
                    {sec.subsections.map((sub) => (
                      <a
                        key={sub.anchor}
                        href={`#${sub.anchor}`}
                        className="sb-sub"
                        onClick={() => { if (window.innerWidth <= 900) onClose(); }}
                      >
                        <span className="sb-dot">›</span>
                        {sub.title}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sb-footer">
          Made for <span>Swiigy</span> interview prep 🍊
        </div>
      </aside>
    </>
  );
}

function fmtTitle(t) {
  return t.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
