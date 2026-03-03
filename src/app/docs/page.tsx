'use client';

import { useEffect, useRef, useState } from 'react';
import { TableOfContents } from '@/components/docs/TableOfContents';
import { DocSection } from '@/components/docs/DocSection';
import { docSections } from '@/lib/constants/docs-content';
import { ROUTES } from '@/lib/routes';

export default function DocsPage() {
  const [activeId, setActiveId] = useState<string>('quick-start');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const sections = document.querySelectorAll('.doc-section');
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    sections.forEach((s) => observerRef.current?.observe(s));
    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <>
      <style>{`
        /* ── Syntax highlighting ── */
        .hl-keyword { color: #c084fc; }
        .hl-string  { color: #86efac; }
        .hl-number  { color: #fb923c; }
        .hl-comment { color: #64748b; font-style: italic; }
        .hl-type    { color: #38bdf8; }

        /* ── Code blocks ── */
        .code-block-wrapper { position: relative; margin: 1rem 0; }
        .code-label {
          font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase;
          color: #f5a623; background: #1a2235; border: 1px solid #d97706;
          border-bottom: none; padding: 3px 10px; display: inline-block;
          border-radius: 4px 4px 0 0; font-family: monospace;
        }
        .code-block {
          background: #070b14; border: 1px solid #1e3a5f;
          border-radius: 0 6px 6px 6px; padding: 1rem 1.25rem; overflow-x: auto;
          font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
          font-size: 0.82rem; line-height: 1.65; color: #e2e8f0; white-space: pre;
        }
        .code-label + .code-block { border-radius: 0 6px 6px 6px; }

        /* ── Doc sections ── */
        .doc-section { scroll-margin-top: 80px; padding-bottom: 2.5rem; }

        /* ── Prop tables ── */
        .prop-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin: 1rem 0; }
        .prop-table th { background: #1a2235; color: #f5a623; text-align: left; padding: 8px 12px; border-bottom: 2px solid #d97706; font-family: monospace; }
        .prop-table td { padding: 7px 12px; border-bottom: 1px solid #1e3a5f; vertical-align: top; color: #cbd5e1; }
        .prop-table tr:hover td { background: #0f172a; }
        .prop-table .prop-name { color: #38bdf8; font-family: monospace; }
        .prop-table .prop-type { color: #c084fc; font-family: monospace; font-size: 0.8rem; }
        .prop-table .prop-default { color: #fb923c; font-family: monospace; font-size: 0.8rem; }

        /* ── Sidebar nav ── */
        .toc-link { display: block; padding: 4px 0; font-size: 0.82rem; transition: color 0.15s; cursor: pointer; }
        .toc-link:hover { color: #f5a623; }
        .toc-link.active { color: #f5a623; font-weight: 600; }
        .toc-link.depth-0 { color: #94a3b8; margin-top: 10px; font-weight: 500; }
        .toc-link.depth-1 { color: #64748b; padding-left: 14px; border-left: 2px solid #1e3a5f; margin-left: 4px; }
        .toc-link.active.depth-1 { border-left-color: #f5a623; }

        /* ── Callout boxes ── */
        .callout { border-left: 3px solid; padding: 0.75rem 1rem; margin: 1rem 0; border-radius: 0 6px 6px 0; font-size: 0.88rem; }
        .callout-tip    { border-color: #22c55e; background: #052e16; color: #86efac; }
        .callout-warn   { border-color: #f59e0b; background: #1c1003; color: #fde68a; }
        .callout-danger { border-color: #ef4444; background: #1a0303; color: #fca5a5; }
        .callout-info   { border-color: #38bdf8; background: #020f1a; color: #bae6fd; }

        /* ── Section headings ── */
        .h1 { font-size: 1.8rem; font-weight: 700; color: #f5a623; margin-bottom: 0.4rem; font-family: Georgia, serif; }
        .h2 { font-size: 1.25rem; font-weight: 600; color: #fbbf24; margin: 1.5rem 0 0.75rem; border-bottom: 1px solid #1e3a5f; padding-bottom: 0.35rem; }
        .h3 { font-size: 1rem; font-weight: 600; color: #38bdf8; margin: 1.2rem 0 0.5rem; font-family: monospace; }
        .lead { color: #94a3b8; line-height: 1.7; margin-bottom: 1.25rem; }
        p { color: #cbd5e1; line-height: 1.7; margin-bottom: 0.75rem; }
        strong { color: #f1f5f9; }
        code { font-family: monospace; background: #1a2235; color: #38bdf8; padding: 2px 6px; border-radius: 4px; font-size: 0.82em; }
        ul, ol { padding-left: 1.5rem; margin-bottom: 0.75rem; }
        li { color: #cbd5e1; line-height: 1.75; }
        li strong { color: #f1f5f9; }

        /* ── Combat table ── */
        .combat-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin: 1rem 0; }
        .combat-table th { background: #1a2235; color: #f5a623; text-align: left; padding: 8px 12px; border-bottom: 2px solid #d97706; }
        .combat-table td { padding: 7px 12px; border-bottom: 1px solid #1e3a5f; color: #cbd5e1; font-family: monospace; }
        .combat-table tr:hover td { background: #0f172a; }

        /* ── Score table ── */
        .score-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin: 1rem 0; }
        .score-table th { background: #1a2235; color: #f5a623; text-align: center; padding: 10px; border-bottom: 2px solid #d97706; }
        .score-table td { padding: 9px 12px; border-bottom: 1px solid #1e3a5f; text-align: center; color: #e2e8f0; }
        .score-table tr:hover td { background: #0f172a; }
        .score-big { color: #22c55e; font-weight: 700; font-size: 1.1em; }

        /* ── Bot mode badges ── */
        .mode-badge { display: inline-block; padding: 2px 10px; border-radius: 99px; font-size: 0.78rem; font-weight: 600; font-family: monospace; margin-right: 4px; }
        .mode-capture  { background: #14532d; color: #86efac; }
        .mode-retreat  { background: #450a0a; color: #fca5a5; }
        .mode-assault  { background: #431407; color: #fed7aa; }
        .mode-defend   { background: #1c1003; color: #fde68a; }
      `}</style>

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
        <TableOfContents activeId={activeId} />

        <main style={{ flex: 1, padding: '2rem 2.5rem', maxWidth: 880, overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '2.5rem' }}>
            <h1 className="h1">📜 The Captain&apos;s Scrolls</h1>
            <p className="lead" style={{ fontSize: '1.05rem' }}>
              The complete Bot API reference for <strong>Bots Battle</strong>. Everything your code
              needs to command pirate ships, capture islands, and dominate the seas — one
              tick at a time.
            </p>
            <div className="callout callout-tip">
              <strong>⚡ New to Bots Battle?</strong> Start with{' '}
              <a href="#quick-start" style={{ color: '#4ade80' }}>
                Quick Start
              </a>{' '}
              to get a bot running in under 5 minutes, then come back here for the full reference.
            </div>
          </div>

          {/* All sections */}
          {docSections.map((s) => (
            <DocSection key={s.id} id={s.id}>
              {s.content}
            </DocSection>
          ))}

          {/* Footer */}
          <div
            style={{
              marginTop: '3rem',
              paddingTop: '2rem',
              borderTop: '1px solid #1e3a5f',
              textAlign: 'center',
              color: '#475569',
              fontSize: '0.85rem',
            }}
          >
            <p>⚓ Fair winds and following seas, Captain.</p>
            <p style={{ marginTop: '0.25rem' }}>
              <a href={ROUTES.play} style={{ color: '#f5a623' }}>
                ⚔️ Play now
              </a>
              {' · '}
              <a href={ROUTES.editor} style={{ color: '#f5a623' }}>
                ✏️ Open Editor
              </a>

            </p>
          </div>
        </main>
      </div>
    </>
  );
}
