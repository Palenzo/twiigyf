import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ContentArea from './components/ContentArea';
import { apiCircuitBreaker, CircuitOpenError } from './utils/circuitBreaker';
import { cacheGet, cacheSet } from './utils/apiCache';
import './App.css';

function App() {
  const [sections, setSections]     = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 900);
  const [loading, setLoading]       = useState(true);
  const [waking, setWaking]         = useState(false);
  const [cbOpen, setCbOpen]         = useState(false);
  const [fetchKey, setFetchKey]     = useState(0); // bump to retry after CB trip

  const API_BASE = process.env.REACT_APP_API_URL || '';

  useEffect(() => {
    // ── Tier-1: serve from cache instantly (memory or localStorage) ──
    const cached = cacheGet('sections', true);
    if (cached) {
      setSections(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    setCbOpen(false);

    let attempts = 0;
    const MAX    = 5;
    const DELAYS = [0, 3000, 6000, 10000, 15000];

    const attempt = () => {
      if (attempts > 0) setWaking(true);

      apiCircuitBreaker
        .call(() =>
          fetch(`${API_BASE}/api/sections`)
            .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        )
        .then((data) => {
          cacheSet('sections', data, true); // persist to localStorage
          setSections(data);
          setLoading(false);
          setWaking(false);
          setCbOpen(false);
        })
        .catch((err) => {
          if (err instanceof CircuitOpenError) {
            // Circuit tripped – stop retrying, show degraded UI
            setCbOpen(true);
            setLoading(false);
            setWaking(false);
            return;
          }
          attempts++;
          if (attempts < MAX) setTimeout(attempt, DELAYS[attempts]);
          else { setLoading(false); setWaking(false); }
        });
    };

    attempt();
  // fetchKey is intentional: bumping it re-runs this effect on manual retry
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE, fetchKey]);

  /* Reading progress */
  useEffect(() => {
    const bar = document.getElementById('progress-bar');
    const onScroll = () => {
      const doc = document.documentElement;
      const scrolled = doc.scrollTop;
      const total = doc.scrollHeight - doc.clientHeight;
      if (bar) bar.style.width = total > 0 ? `${(scrolled / total) * 100}%` : '0%';
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Router>
      <div id="progress-bar" style={{ width: '0%' }} />
      <Navbar onMenuToggle={() => setSidebarOpen((v) => !v)} />
      <div className="app-body">
        <Sidebar
          sections={sections}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className={`main-wrap ${sidebarOpen ? 'shifted' : ''}`}>
          {loading ? (
            <div className="splash">
              <div className="spinner" />
              <p>{waking ? '⏳ Server is waking up, please wait…' : 'Loading guide…'}</p>
            </div>
          ) : cbOpen ? (
            <div className="splash">
              <p className="cb-msg">⚠️ Service temporarily unavailable — too many failed requests.</p>
              <p className="cb-sub">The circuit breaker has tripped. Please wait ~30 seconds before retrying.</p>
              <button
                className="retry-btn"
                onClick={() => { setCbOpen(false); setLoading(true); setFetchKey((k) => k + 1); }}
              >
                ↺ Retry now
              </button>
            </div>
          ) : (
            <Routes>
              <Route
                path="/"
                element={
                  sections.length > 0 ? (
                    <Navigate to={`/section/${sections[0].slug}`} replace />
                  ) : null
                }
              />
              <Route
                path="/section/:slug"
                element={<ContentArea sections={sections} />}
              />
            </Routes>
          )}
        </main>
      </div>
    </Router>
  );
}

export default App;
