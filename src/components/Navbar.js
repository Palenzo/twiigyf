import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Navbar.css';

/* Persist theme across page loads */
function getInitialTheme() {
  try {
    return localStorage.getItem('theme') || 'light';
  } catch { return 'light'; }
}

export default function Navbar({ onMenuToggle }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [theme, setTheme]       = useState(getInitialTheme);
  const navigate = useNavigate();

  /* Apply theme attribute to <html> */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const handleSearch = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (!val.trim()) { setResults([]); return; }
    setSearching(true);
    fetch(`/api/sections`)
      .then((r) => r.json())
      .then((sections) => {
        const q = val.toLowerCase();
        const matched = sections.filter((s) =>
          s.title.toLowerCase().includes(q) ||
          s.subsections?.some((sub) => sub.title.toLowerCase().includes(q))
        );
        setResults(matched.slice(0, 8));
        setSearching(false);
      });
  };

  const goTo = (slug) => {
    navigate(`/section/${slug}`);
    setQuery('');
    setResults([]);
  };

  return (
    <nav className="navbar">
      {/* Left: hamburger + brand */}
      <div className="nav-left">
        <button className="hamburger" onClick={onMenuToggle} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
        <a href="/" className="brand">
          <span className="brand-icon">🍊</span>
          <span className="brand-name">
            <span className="brand-swiigy">Swiigy</span>
            <span className="brand-sub">DS Guide</span>
          </span>
        </a>
      </div>

      {/* Centre: search */}
      <div className="nav-search-wrap">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search topics…"
            value={query}
            onChange={handleSearch}
            onBlur={() => setTimeout(() => setResults([]), 200)}
          />
          {searching && <span className="search-spin" />}
        </div>
        {results.length > 0 && (
          <div className="search-dropdown">
            {results.map((s) => (
              <button key={s.slug} className="search-item" onMouseDown={() => goTo(s.slug)}>
                <span className="si-title">{fmt(s.title)}</span>
                <span className="si-count">{s.subsections?.length || 0} topics</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: tags + theme toggle */}
      <div className="nav-right">
        <span className="nav-tag">Data Science</span>
        <span className="nav-tag accent">Interview Prep</span>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </nav>
  );
}

function fmt(t) {
  return t.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}
