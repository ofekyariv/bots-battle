'use client';

import { useState } from 'react';
import { highlight } from './CodeBlock';
import { ALL_LANGUAGE_IDS, getLanguage } from '@/lib/languages/registry';
import type { LanguageId } from '@/lib/languages/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type DocLanguage = LanguageId;

export interface LanguageCodes {
  javascript?: string;
  typescript?: string;
  python?: string;
  kotlin?: string;
  java?: string;
  csharp?: string;
  swift?: string;
}

// ─────────────────────────────────────────────
// Language config — derived from registry
// ─────────────────────────────────────────────

/** Convert a hex color like #F7DF1E to rgba(r,g,b,alpha) */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const ALL_LANGS: DocLanguage[] = ALL_LANGUAGE_IDS;

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function MultiLangCodeBlock({
  code,
  defaultLang = 'javascript',
}: {
  code: LanguageCodes;
  defaultLang?: DocLanguage;
}) {
  const available = ALL_LANGS.filter((l) => code[l] !== undefined);

  const initLang = available.includes(defaultLang) ? defaultLang : (available[0] ?? 'javascript');
  const [selected, setSelected] = useState<DocLanguage>(initLang);

  if (available.length === 0) return null;

  const selectedLangConfig = getLanguage(selected);
  const selectedColor = selectedLangConfig.color;
  const selectedBorder = hexToRgba(selectedColor, 0.4);

  return (
    <div style={{ margin: '1rem 0' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: '-1px' }}>
        {available.map((lang) => {
          const langConfig = getLanguage(lang);
          const lc = langConfig.color;
          const bg = hexToRgba(lc, 0.18);
          const lb = hexToRgba(lc, 0.4);
          const label = langConfig.displayName;
          const isActive = selected === lang;
          return (
            <button
              key={lang}
              onClick={() => setSelected(lang)}
              style={{
                background: isActive ? bg : '#0f172a',
                color: isActive ? lc : '#475569',
                border: isActive ? `1px solid ${lb}` : '1px solid #1e3a5f',
                borderBottom: isActive ? '1px solid #070b14' : '1px solid #1e3a5f',
                padding: '3px 11px',
                fontSize: '0.72rem',
                fontFamily: 'monospace',
                cursor: 'pointer',
                borderRadius: '4px 4px 0 0',
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.12s',
                zIndex: isActive ? 1 : 0,
                position: 'relative',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      {/* Code panel */}
      <pre
        className="code-block"
        style={{
          borderRadius: '0 6px 6px 6px',
          marginTop: 0,
          borderColor: selectedBorder,
          borderTopColor: selectedBorder,
        }}
        dangerouslySetInnerHTML={{ __html: highlight((code[selected] ?? '').trim()) }}
      />
    </div>
  );
}
