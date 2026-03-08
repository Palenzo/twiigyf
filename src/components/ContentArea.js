import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { apiCircuitBreaker, CircuitOpenError } from '../utils/circuitBreaker';
import { cacheGet, cacheSet } from '../utils/apiCache';
import './ContentArea.css';

/* ── Stable code-block sub-component (own copy state) ───────────── */
function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const lang = language || 'text';
  const showNumbers = !['text', 'bash', 'shell'].includes(lang) && lang !== 'text';

  return (
    <div className="code-block">
      <div className="cb-header">
        <span className="cb-lang">{lang}</span>
        <button className="cb-copy" onClick={copy}>
          {copied ? '✓ Copied!' : '⎘ Copy'}
        </button>
      </div>
      {language && language !== 'text' ? (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={lang}
          showLineNumbers={showNumbers}
          wrapLongLines={false}
          customStyle={{
            margin: 0,
            borderRadius: '0 0 8px 8px',
            fontSize: '13.5px',
            lineHeight: '1.55',
            overflowX: 'auto',
          }}
          lineNumberStyle={{ color: '#555', minWidth: '2.2em' }}
          PreTag="div"
        >
          {code}
        </SyntaxHighlighter>
      ) : (
        <div className="cb-plain">
          <pre><code>{code}</code></pre>
        </div>
      )}
    </div>
  );
}

/* ── Heading renderer – adds anchor id ─────────────────────────── */
function makeHeading(Tag) {
  return function Heading({ children, ...props }) {
    const text = Array.isArray(children)
      ? children.map((c) => (typeof c === 'string' ? c : '')).join('')
      : String(children ?? '');

    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    return <Tag id={id} {...props}>{children}</Tag>;
  };
}

/* ── Right-side Table of Contents ───────────────────────────────── */
function PageTOC({ subsections }) {
  if (!subsections?.length) return null;
  return (
    <aside className="page-toc">
      <div className="toc-title">Contents</div>
      <ul className="toc-list">
        {subsections.map((sub) => (
          <li key={sub.anchor}>
            <a href={`#${sub.anchor}`} className="toc-link">
              {sub.title.replace(/^\d+\.\s*/, '')}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/* ── Breadcrumb ─────────────────────────────────────────────────── */
function Breadcrumb({ title }) {
  return (
    <div className="breadcrumb">
      <a href="/">Home</a>
      <span className="bc-sep">›</span>
      <span>Interview Prep</span>
      <span className="bc-sep">›</span>
      <span className="bc-current">{fmtTitle(title)}</span>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */
export default function ContentArea({ sections }) {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [cbOpen, setCbOpen]   = useState(false);

  const idx  = sections.findIndex((s) => s.slug === slug);
  const prev = sections[idx - 1];
  const next = sections[idx + 1];

  useEffect(() => {
    if (!slug) return;

    // ── Tier-1: in-memory cache — instant render, no loading flash ──
    const cacheKey = `section:${slug}`;
    const cached   = cacheGet(cacheKey);
    if (cached) {
      setData(cached);
      setLoading(false);
      setCbOpen(false);
      window.scrollTo({ top: 0 });
      return;
    }

    // ── Cache miss: fetch from API via circuit breaker ──
    setLoading(true);
    setData(null);
    setCbOpen(false);

    let attempts = 0;
    const MAX    = 3;
    const DELAYS = [0, 3000, 8000];
    const BASE   = process.env.REACT_APP_API_URL || '';

    const attempt = () => {
      apiCircuitBreaker
        .call(() =>
          fetch(`${BASE}/api/sections/${slug}`)
            .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
        )
        .then((d) => {
          cacheSet(cacheKey, d); // memory-only (bodies are large)
          setData(d);
          setLoading(false);
          setCbOpen(false);
          window.scrollTo({ top: 0 });
        })
        .catch((err) => {
          if (err instanceof CircuitOpenError) {
            setCbOpen(true);
            setLoading(false);
            return;
          }
          attempts++;
          if (attempts < MAX) setTimeout(attempt, DELAYS[attempts]);
          else setLoading(false);
        });
    };

    attempt();
  }, [slug]);

  /* react-markdown custom components */
  const components = useCallback(
    () => ({
      h1: makeHeading('h1'),
      h2: makeHeading('h2'),
      h3: makeHeading('h3'),
      h4: makeHeading('h4'),

      /* Inline code */
      code({ inline, className, children, ...props }) {
        const match = /language-(\w+)/.exec(className || '');
        const language = match ? match[1] : null;
        const code = String(children).replace(/\n$/, '');

        if (inline) {
          return <code className="ic" {...props}>{children}</code>;
        }
        return <CodeBlock code={code} language={language} />;
      },

      /* Tables */
      table({ children }) {
        return (
          <div className="tbl-wrap">
            <table className="gfg-tbl">{children}</table>
          </div>
        );
      },

      /* Blockquote → callout */
      blockquote({ children }) {
        return <div className="callout">{children}</div>;
      },

      /* Links open externally */
      a({ href, children }) {
        const isExternal = href?.startsWith('http');
        return (
          <a
            href={href}
            className="content-a"
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
          >
            {children}
          </a>
        );
      },

      /* Paragraphs */
      p({ children }) {
        return <p className="para">{children}</p>;
      },

      /* Lists */
      ul({ children }) { return <ul className="content-ul">{children}</ul>; },
      ol({ children }) { return <ol className="content-ol">{children}</ol>; },
      li({ children }) { return <li className="content-li">{children}</li>; },

      hr() { return <hr className="content-hr" />; },

      strong({ children }) {
        return <strong className="content-strong">{children}</strong>;
      },
    }),
    []
  );

  /* Strip the leading H1 (we render it as the article title) */
  const body = data?.content
    ? data.content.replace(/^# [^\n]*\n/, '').trim()
    : '';

  if (loading) {
    return (
      <div className="ca-loading">
        <div className="ca-spinner" />
        <p>Loading section…</p>
      </div>
    );
  }

  if (cbOpen) {
    return (
      <div className="ca-error">
        ⚠️ Service temporarily unavailable — circuit breaker tripped.
        Please wait ~30 seconds and navigate back to this section.
      </div>
    );
  }

  if (!data) {
    return <div className="ca-error">Section not found.</div>;
  }

  return (
    <div className="ca-outer">
      {/* Article */}
      <article className="article">
        <Breadcrumb title={data.title} />

        <header className="art-header">
          <h1 className="art-title">{fmtTitle(data.title)}</h1>
          <div className="art-tags">
            <span className="tag green">Data Science</span>
            <span className="tag green">Swiigy Interview</span>
            {data.subsections?.length > 0 && (
              <span className="tag gray">{data.subsections.length} topics</span>
            )}
          </div>
          <div className="art-divider" />
        </header>

        <div className="art-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={components()}
          >
            {body}
          </ReactMarkdown>
        </div>

        {/* Prev / Next navigation */}
        <nav className="art-nav">
          {prev ? (
            <button className="nav-btn nav-prev" onClick={() => navigate(`/section/${prev.slug}`)}>
              <span className="nav-arrow">←</span>
              <div className="nav-info">
                <span className="nav-hint">Previous</span>
                <span className="nav-section-name">{fmtTitle(prev.title)}</span>
              </div>
            </button>
          ) : <div />}

          {next ? (
            <button className="nav-btn nav-next" onClick={() => navigate(`/section/${next.slug}`)}>
              <div className="nav-info">
                <span className="nav-hint">Next</span>
                <span className="nav-section-name">{fmtTitle(next.title)}</span>
              </div>
              <span className="nav-arrow">→</span>
            </button>
          ) : <div />}
        </nav>

        {/* Back to top */}
        <button className="back-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          ↑ Back to Top
        </button>
      </article>

      {/* Right TOC */}
      <PageTOC subsections={data.subsections} />
    </div>
  );
}

function fmtTitle(t = '') {
  const words = t.split(' ');
  return words
    .map((w) => {
      if (['&', 'vs', 'for', 'of', 'and', 'or', 'the', 'in'].includes(w.toLowerCase()))
        return w.toLowerCase();
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}
