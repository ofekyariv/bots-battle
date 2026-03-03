'use client';

import { useEffect, useRef } from 'react';
import type { ConsoleOutputProps, LogLevel } from './types';

const levelColor: Record<LogLevel, string> = {
  info: '#94a3b8',
  success: '#86efac',
  error: '#f87171',
  warn: '#fbbf24',
};

const levelBg: Record<LogLevel, string> = {
  info: 'transparent',
  success: 'rgba(134,239,172,0.04)',
  error: 'rgba(248,113,113,0.06)',
  warn: 'rgba(251,191,36,0.06)',
};

export function ConsoleOutput({ logs, onClear, collapsed, onToggle }: ConsoleOutputProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collapsed) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, collapsed]);

  return (
    <div
      className="flex flex-col shrink-0"
      style={{
        height: collapsed ? '36px' : '180px',
        borderTop: '1px solid #1e3a5f',
        background: '#050a14',
        transition: 'height 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        role="button"
        aria-label={collapsed ? 'Expand console output' : 'Collapse console output'}
        aria-expanded={!collapsed}
        tabIndex={0}
        className="flex items-center justify-between px-3 py-1.5 shrink-0 cursor-pointer select-none focus:outline-none focus:ring-inset focus:ring-1 focus:ring-gold/40"
        style={{ background: '#0a0e1a', borderBottom: collapsed ? 'none' : '1px solid #1e3a5f' }}
        onClick={onToggle}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onToggle()}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-semibold" style={{ color: '#64748b' }}>
            {collapsed ? '▶' : '▼'} CONSOLE
          </span>
          {logs.length > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-mono"
              style={{ background: '#1e3a5f', color: '#94a3b8' }}
            >
              {logs.length}
            </span>
          )}
          {logs.some((l) => l.level === 'error') && (
            <span className="text-xs" style={{ color: '#f87171' }}>
              ● errors
            </span>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            aria-label="Clear console output"
            className="text-xs px-2 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-gold/40"
            style={{ color: '#475569' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Log lines */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-0.5">
          {logs.length === 0 ? (
            <p style={{ color: '#334155' }}>Run Test or save your bot to see output here.</p>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex gap-2 px-2 py-0.5 rounded"
                style={{ background: levelBg[log.level] }}
              >
                <span style={{ color: '#334155' }}>{log.ts}</span>
                <span style={{ color: levelColor[log.level] }}>{log.msg}</span>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
