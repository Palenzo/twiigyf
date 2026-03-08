import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import ContentArea from './components/ContentArea';
import './App.css';

function App() {
  const [sections, setSections] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 900);
  const [loading, setLoading] = useState(true);

  const API_BASE = process.env.REACT_APP_API_URL || '';
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const MAX = 5;
    const DELAYS = [0, 3000, 6000, 10000, 15000];

    const attempt = () => {
      if (attempts > 0) setWaking(true);
      fetch(`${API_BASE}/api/sections`)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then((data) => { setSections(data); setLoading(false); setWaking(false); })
        .catch(() => {
          attempts++;
          if (attempts < MAX) setTimeout(attempt, DELAYS[attempts]);
          else { setLoading(false); setWaking(false); }
        });
    };
    attempt();
  }, [API_BASE]);

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
