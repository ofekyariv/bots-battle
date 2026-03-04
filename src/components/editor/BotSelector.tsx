'use client';

import { useEffect } from 'react';
import { getBot } from '@/lib/api/bots';
import { getBotRecord } from '@/lib/storage';
import type { BotSelectorProps } from './types';
import type { BotLanguage } from '@/lib/api/bots';

// ── Language badge helpers ────────────────────────────────────────

const LANG_BADGE: Record<BotLanguage, { label: string; bg: string; color: string }> = {
  javascript: { label: 'JavaScript', bg: 'rgba(234,179,8,0.15)',   color: '#fde047' },
  typescript: { label: 'TypeScript', bg: 'rgba(59,130,246,0.15)',  color: '#93c5fd' },
  python:     { label: 'Python', bg: 'rgba(34,197,94,0.15)',   color: '#86efac' },
  kotlin:     { label: 'Kotlin', bg: 'rgba(168,85,247,0.15)', color: '#c4b5fd' },
  java:       { label: 'Java',  bg: 'rgba(249,115,22,0.15)', color: '#f97316' },
  csharp:     { label: 'C#',    bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  swift:      { label: 'Swift', bg: 'rgba(244,63,94,0.15)',  color: '#f43f5e' },
};

function LanguageBadge({ language }: { language?: BotLanguage }) {
  const style = language ? LANG_BADGE[language] : LANG_BADGE.javascript;
  return (
    <span
      style={{
        display: 'inline-block',
        background: style.bg,
        color: style.color,
        fontSize: '0.6rem',
        fontFamily: 'monospace',
        fontWeight: 600,
        padding: '0 5px',
        borderRadius: '3px',
        lineHeight: '16px',
        verticalAlign: 'middle',
        marginLeft: '5px',
        letterSpacing: '0.02em',
      }}
    >
      {style.label}
    </span>
  );
}

export function BotSelector({
  savedBots,
  currentBotId,
  isDirty,
  showBotDropdown,
  setShowBotDropdown,
  showDeleteConfirm,
  setShowDeleteConfirm,
  onNew,
  onLoad,
  onDelete,
}: BotSelectorProps) {
  // Close dropdown on outside click
  useEffect(() => {
    if (!showBotDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-bot-dropdown]')) return;
      setShowBotDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBotDropdown, setShowBotDropdown]);

  return (
    <div className="relative shrink-0" data-bot-dropdown onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setShowBotDropdown((v) => !v)}
        aria-label={`My Bots${savedBots.length > 0 ? ` (${savedBots.length})` : ''}, ${showBotDropdown ? 'collapse' : 'expand'}`}
        aria-expanded={showBotDropdown}
        aria-haspopup="listbox"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors"
        style={{ background: '#1e3a5f', color: '#94a3b8', minWidth: '120px' }}
      >
        🏴‍☠️ My Bots {savedBots.length > 0 && `(${savedBots.length})`} ▾
      </button>

      {showBotDropdown && (
        <div
          className="absolute top-full left-0 mt-1 rounded-lg overflow-hidden z-50"
          style={{
            background: '#111827',
            border: '1px solid #d97706',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            minWidth: '280px',
            maxHeight: '320px',
            overflowY: 'auto',
          }}
        >
          {/* New bot */}
          <button
            onClick={() => {
              setShowBotDropdown(false);
              onNew();
            }}
            className="w-full text-left flex items-center gap-2 px-3 py-2.5 hover:bg-blue-900/20 transition-colors"
            style={{ borderBottom: '1px solid #1e3a5f' }}
          >
            <span className="text-sm" style={{ color: '#d97706' }}>
              ✦ New Bot
            </span>
          </button>

          {savedBots.length === 0 ? (
            <div className="px-4 py-3 text-xs" style={{ color: '#475569' }}>
              No saved bots yet. Write one and save it!
            </div>
          ) : (
            savedBots.map((bot, i) => {
              const rec = getBotRecord(bot.id);
              return (
                <div
                  key={bot.id}
                  className="flex items-center justify-between px-3 py-2.5 hover:bg-blue-900/20 group"
                  style={{
                    borderBottom: i < savedBots.length - 1 ? '1px solid #1e3a5f' : 'none',
                  }}
                >
                  <button
                    className="flex-1 text-left"
                    onClick={async () => {
                      if (isDirty && !confirm('Unsaved changes will be lost. Continue?')) return;
                      try {
                        const full = await getBot(bot.id);
                        onLoad(full);
                        setShowBotDropdown(false);
                      } catch {
                        // Bot fetch failed — ignore
                      }
                    }}
                  >
                    <span
                      className="text-sm font-medium block"
                      style={{ color: currentBotId === bot.id ? '#f5a623' : '#e2e8f0' }}
                    >
                      {bot.name}
                      <LanguageBadge language={bot.language} />
                      {currentBotId === bot.id && (
                        <span className="ml-2 text-xs" style={{ color: '#d97706' }}>
                          ← current
                        </span>
                      )}
                    </span>
                    <span className="text-xs block" style={{ color: '#475569' }}>
                      {new Date(bot.updated_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {rec.total > 0 && (
                        <span className="ml-2">
                          <span style={{ color: '#86efac' }}>{rec.wins}W</span>
                          <span style={{ color: '#94a3b8' }}>/</span>
                          <span style={{ color: '#f87171' }}>{rec.losses}L</span>
                          {rec.draws > 0 && <span style={{ color: '#fbbf24' }}>/{rec.draws}D</span>}
                        </span>
                      )}
                    </span>
                  </button>

                  {showDeleteConfirm === bot.id ? (
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => onDelete(bot.id)}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: '#dc2626', color: 'white' }}
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: '#1e3a5f', color: '#94a3b8' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(bot.id);
                      }}
                      className="text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity ml-2"
                      style={{ background: '#1e3a5f', color: '#94a3b8' }}
                      title={`Delete ${bot.name}`}
                      aria-label={`Delete ${bot.name}`}
                    >
                      🗑
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
