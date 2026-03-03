'use client';

import { useState, useRef, useEffect } from 'react';
import type { LanguageToggleProps, EditorLanguage } from './types';

const LANG_META: Record<EditorLanguage, { label: string; emoji: string; color: string }> = {
  javascript: { label: 'JavaScript', emoji: '🟡', color: '#fde047' },
  typescript: { label: 'TypeScript', emoji: '🔵', color: '#93c5fd' },
  python:     { label: 'Python',     emoji: '🐍', color: '#86efac' },
  kotlin:     { label: 'Kotlin',     emoji: '🟣', color: '#c4b5fd' },
  java:       { label: 'Java',       emoji: '☕', color: '#f97316' },
  csharp:     { label: 'C#',         emoji: '🔷', color: '#10b981' },
  swift:      { label: 'Swift',      emoji: '🦅', color: '#f43f5e' },
};

const LANGS: EditorLanguage[] = ['javascript', 'typescript', 'python', 'kotlin', 'csharp', 'java', 'swift'];

export function LanguageToggle({
  editorLanguage,
  onLanguageChange,
  currentBotId,
}: LanguageToggleProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANG_META[editorLanguage];
  const isLocked = currentBotId !== null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Locked: show static badge for existing bots
  if (isLocked) {
    return (
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold"
        style={{ background: '#1e3a5f', color: current.color, opacity: 0.8 }}
        title="Language is set when creating a bot"
      >
        {current.emoji} {current.label}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative" style={{ zIndex: 50 }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors"
        style={{ background: '#1e3a5f', color: current.color }}
        aria-label="Select language"
        aria-expanded={open}
      >
        {current.emoji} {current.label} ▾
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 rounded shadow-lg overflow-hidden"
          style={{ background: '#111827', border: '1px solid #1e3a5f', minWidth: '160px' }}
        >
          {LANGS.map((lang) => {
            const meta = LANG_META[lang];
            const isActive = lang === editorLanguage;
            return (
              <button
                key={lang}
                onClick={() => { onLanguageChange(lang); setOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs font-semibold text-left transition-colors hover:bg-[#1e3a5f]"
                style={{
                  color: isActive ? meta.color : '#94a3b8',
                  background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                }}
              >
                <span>{meta.emoji}</span>
                <span>{meta.label}</span>
                {isActive && <span className="ml-auto" style={{ color: meta.color }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
