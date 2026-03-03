'use client';

import { useState } from 'react';
import type { EditorSidebarProps, EditorLanguage, BotVersion, DiffLine } from './types';
import { getAllHelperSignatures } from '@/lib/languages/helpers';
import { getLanguage } from '@/lib/languages/registry';
import type { LanguageId, SampleBot } from '@/lib/languages/types';
// ─────────────────────────────────────────────
// Simple line-by-line diff (LCS-based)
// ─────────────────────────────────────────────

function computeDiff(oldCode: string, newCode: string): DiffLine[] {
  const a = oldCode.split('\n');
  const b = newCode.split('\n');

  // For large files limit to avoid O(m*n) blowup
  if (a.length > 500 || b.length > 500) {
    return [
      ...a.map((l) => ({ type: 'removed' as const, content: l })),
      ...b.map((l) => ({ type: 'added' as const, content: l })),
    ];
  }

  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = m,
    j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'same', content: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'added', content: b[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'removed', content: a[i - 1] });
      i--;
    }
  }
  return result;
}

// ─────────────────────────────────────────────
// Version History Panel
// ─────────────────────────────────────────────

function VersionHistoryPanel({
  versions,
  currentCode,
  onRestore,
}: {
  versions: BotVersion[];
  currentCode: string;
  onRestore: (code: string) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const selectedVersion = selectedIdx !== null ? versions[selectedIdx] : null;
  const diffLines = selectedVersion ? computeDiff(selectedVersion.code, currentCode) : [];
  const addedCount = diffLines.filter((l) => l.type === 'added').length;
  const removedCount = diffLines.filter((l) => l.type === 'removed').length;

  const handleRestore = () => {
    if (!selectedVersion) return;
    if (
      confirm(
        `Restore this version from ${new Date(selectedVersion.savedAt).toLocaleString()}?\nThe current code will be saved as a new version first.`,
      )
    ) {
      onRestore(selectedVersion.code);
      setSelectedIdx(null);
    }
  };

  if (versions.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center flex-1 gap-3 p-4"
        style={{ color: '#475569' }}
      >
        <span className="text-4xl">📜</span>
        <p className="text-sm text-center">No version history yet.</p>
        <p className="text-xs text-center" style={{ color: '#334155' }}>
          Save your bot or click &quot;Use in Battle&quot; to auto-create versions.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0a0e1a' }}>
      {/* Version list */}
      <div
        className="overflow-y-auto"
        style={{
          flex: selectedVersion ? '0 0 auto' : '1',
          maxHeight: selectedVersion ? '200px' : undefined,
          borderBottom: selectedVersion ? '1px solid #1e3a5f' : 'none',
        }}
      >
        <div className="p-2 flex flex-col gap-1">
          {versions.map((v, idx) => {
            const isSelected = selectedIdx === idx;
            const isLatest = idx === 0;
            return (
              <button
                key={v.savedAt}
                onClick={() => {
                  setSelectedIdx(isSelected ? null : idx);
                  setShowDiff(false);
                }}
                className="w-full text-left rounded px-3 py-2 transition-colors"
                style={{
                  background: isSelected ? '#1e3a5f' : 'rgba(14,30,60,0.4)',
                  border: `1px solid ${isSelected ? '#d97706' : '#1e3a5f'}`,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-xs font-semibold truncate"
                    style={{ color: isSelected ? '#f5a623' : '#e2e8f0' }}
                  >
                    {v.note ?? 'Manual save'}
                  </span>
                  {isLatest && (
                    <span
                      className="text-xs px-1.5 rounded shrink-0"
                      style={{ background: '#059669', color: 'white' }}
                    >
                      latest
                    </span>
                  )}
                </div>
                <span className="text-xs block mt-0.5" style={{ color: '#475569' }}>
                  {new Date(v.savedAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-xs block mt-0.5 font-mono" style={{ color: '#334155' }}>
                  {v.code.split('\n').length} lines
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected version detail */}
      {selectedVersion && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Actions bar */}
          <div
            className="flex items-center gap-2 px-3 py-2 shrink-0"
            style={{ background: '#0d1425', borderBottom: '1px solid #1e3a5f' }}
          >
            <span className="text-xs flex-1" style={{ color: '#94a3b8' }}>
              {new Date(selectedVersion.savedAt).toLocaleString()}
            </span>
            <button
              onClick={() => setShowDiff((v) => !v)}
              className="text-xs px-2 py-1 rounded transition-colors"
              style={{
                background: showDiff ? '#1e3a5f' : 'transparent',
                color: '#94a3b8',
                border: '1px solid #1e3a5f',
              }}
            >
              {showDiff ? '📄 Code' : '⟺ Diff'}
              {!showDiff && addedCount + removedCount > 0 && (
                <span className="ml-1">
                  <span style={{ color: '#86efac' }}>+{addedCount}</span>
                  <span style={{ color: '#f87171' }}>/{removedCount}</span>
                </span>
              )}
            </button>
            <button
              onClick={handleRestore}
              className="text-xs px-3 py-1 rounded font-semibold transition-colors"
              style={{ background: '#d97706', color: '#0a0e1a' }}
            >
              ↩ Restore
            </button>
          </div>

          {/* Code / Diff view */}
          <div
            className="flex-1 overflow-auto font-mono text-xs p-2"
            style={{ background: '#050a14' }}
          >
            {showDiff ? (
              <div>
                {addedCount + removedCount === 0 ? (
                  <p className="text-center py-4" style={{ color: '#475569' }}>
                    No differences from current code.
                  </p>
                ) : (
                  diffLines.map((line, i) => (
                    <div
                      key={i}
                      className="px-2 py-0.5 whitespace-pre leading-relaxed"
                      style={{
                        background:
                          line.type === 'added'
                            ? 'rgba(134,239,172,0.1)'
                            : line.type === 'removed'
                              ? 'rgba(248,113,113,0.1)'
                              : 'transparent',
                        color:
                          line.type === 'added'
                            ? '#86efac'
                            : line.type === 'removed'
                              ? '#f87171'
                              : '#475569',
                        borderLeft: `3px solid ${
                          line.type === 'added'
                            ? '#86efac'
                            : line.type === 'removed'
                              ? '#f87171'
                              : 'transparent'
                        }`,
                      }}
                    >
                      <span className="select-none mr-2" style={{ color: '#334155' }}>
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
                      </span>
                      {line.content}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <pre className="whitespace-pre-wrap" style={{ color: '#e2e8f0' }}>
                {selectedVersion.code}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// API Docs Sub-components (declared outside to avoid re-creation on render)
// ─────────────────────────────────────────────

function C({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: '0.85em' }}>{children}</code>
  );
}

function PropRow({ name, type, desc }: { name: string; type: string; desc: string }) {
  return (
    <div className="rounded p-2.5" style={{ background: '#0d1425', border: '1px solid #1e3a5f' }}>
      <div className="flex items-baseline gap-2 flex-wrap mb-1">
        <C>{name}</C>
        <span style={{ color: '#6366f1', fontFamily: 'monospace', fontSize: '0.8em' }}>{type}</span>
      </div>
      <p className="text-xs" style={{ color: '#94a3b8' }}>
        {desc}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Language-aware function reference — driven by registry
// ─────────────────────────────────────────────

function FunctionsReference({ lang }: { lang: EditorLanguage }) {
  const sigs = getAllHelperSignatures(lang as LanguageId);
  return (
    <div className="flex flex-col gap-2">
      {sigs.map((fn) => (
        <div
          key={fn.canonicalName}
          className="rounded p-2.5"
          style={{ background: '#0d1425', border: '1px solid #1e3a5f' }}
        >
          <code
            className="text-xs block mb-1 font-mono"
            style={{ color: '#fbbf24' }}
          >
            {fn.signature}
          </code>
          <p className="text-xs" style={{ color: '#94a3b8' }}>
            {fn.description}
          </p>
          <code
            className="text-xs block mt-1 font-mono"
            style={{ color: '#475569' }}
          >
            {fn.example}
          </code>
        </div>
      ))}
    </div>
  );
}

function ApiDocsSidebar({ editorLanguage = 'javascript' }: { editorLanguage?: EditorLanguage }) {
  const [activeSection, setActiveSection] = useState<string>('helpers');

  const sections = [
    { id: 'helpers', label: 'Helpers', emoji: '🛠️' },
    { id: 'gamestate', label: 'GameState', emoji: '🌐' },
    { id: 'ship', label: 'Ship', emoji: '🚢' },
    { id: 'island', label: 'Island', emoji: '🏝️' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#0a0e1a' }}>
      {/* Section nav */}
      <div
        className="flex flex-wrap gap-1 p-2 shrink-0"
        style={{ background: '#111827', borderBottom: '1px solid #1e3a5f' }}
      >
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className="px-2 py-1 rounded text-xs font-semibold transition-colors"
            style={{
              background: activeSection === s.id ? '#d97706' : '#1e3a5f',
              color: activeSection === s.id ? '#0a0e1a' : '#94a3b8',
            }}
          >
            {s.emoji} {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 text-sm" style={{ color: '#e2e8f0' }}>
        {activeSection === 'helpers' && (
          <div className="flex flex-col gap-3">
            <h3 className="font-bold text-base" style={{ color: '#f5a623' }}>
              🛠️ {getLanguage(editorLanguage as LanguageId).displayName} Helpers
            </h3>
            <FunctionsReference lang={editorLanguage} />
          </div>
        )}
        {activeSection === 'gamestate' && (
          <div className="flex flex-col gap-3">
            <h3 className="font-bold text-base" style={{ color: '#f5a623' }}>
              🌐 GameState
            </h3>
            <PropRow
              name="tick"
              type="number"
              desc="Current tick (0-based). Increments every 120ms by default."
            />
            <PropRow name="maxTicks" type="number" desc="Total ticks in the game (default: 15000)." />
            <PropRow name="mapWidth / mapHeight" type="number" desc="Map dimensions in world units (default: 700 × 1000)." />
            <PropRow name="islands" type="BotIsland[]" desc="All islands on the map." />
            <PropRow name="myShips" type="BotShip[]" desc="Your ships — includes dead ones (check alive)." />
            <PropRow name="enemyShips" type="BotShip[]" desc="Opponent's ships — includes dead ones." />
            <PropRow name="myScore / enemyScore" type="number" desc="Current scores." />
            <PropRow name="targetScore" type="number" desc="First to this score wins (default: 10000)." />
            <PropRow name="config" type="GameConfig" desc="All game settings (speeds, radii, durations)." />
          </div>
        )}
        {activeSection === 'ship' && (
          <div className="flex flex-col gap-3">
            <h3 className="font-bold text-base" style={{ color: '#f5a623' }}>
              🚢 BotShip
            </h3>
            <PropRow name="id" type="number" desc="Stable ship ID — never changes during a game." />
            <PropRow name="x / y" type="number" desc="Current position." />
            <PropRow name="alive" type="boolean" desc="false while respawning." />
            <PropRow name="isCapturing" type="boolean" desc="true if inside an island capture radius (position flag only — ship still fights normally)." />
            <PropRow name="turnsToRevive" type="number" desc="0 if alive; countdown ticks until respawn (default respawn delay: 20 ticks)." />
            <PropRow name="initialX / initialY" type="number" desc="Fixed respawn position inside your safe zone." />
            <PropRow name="combatPressure" type="number" desc="Consecutive ticks this ship has been outnumbered (0 = safe). Reaches combatKillDelay (default 8) before dying." />
          </div>
        )}
        {activeSection === 'island' && (
          <div className="flex flex-col gap-3">
            <h3 className="font-bold text-base" style={{ color: '#f5a623' }}>
              🏝️ BotIsland
            </h3>
            <PropRow name="id" type="number" desc="Stable island ID — never changes during a game." />
            <PropRow name="x / y" type="number" desc="Island center position." />
            <PropRow name="radius" type="number" desc="Capture proximity radius — ships must be within this to contribute." />
            <PropRow name="owner" type="'me'|'enemy'|'neutral'" desc="Current owner from your perspective." />
            <PropRow name="teamCapturing" type="'me'|'enemy'|'none'" desc="Who is advancing the capture timer." />
            <PropRow name="captureProgress" type="number" desc="Ticks of capture progress. Range: 0→captureTurns for neutral; 0→captureTurns×2 for enemy islands." />
            <PropRow name="captureTurns" type="number" desc="Ticks to fully capture from neutral (default: 15). Enemy islands take 2× this." />
            <PropRow name="value" type="number" desc="Scoring weight: 1 = normal, 2+ = treasure island." />
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// Examples Panel
// ─────────────────────────────────────────────

const DIFFICULTY_EMOJI: Record<string, string> = {
  Rusher: '🟢',
  Balanced: '🟡',
  Admiral: '🔴',
};

const DIFFICULTY_LABEL: Record<string, string> = {
  Rusher: 'Simple',
  Balanced: 'Medium',
  Admiral: 'Complex',
};

function ExamplesPanel({
  editorLanguage,
  onLoadExample,
}: {
  editorLanguage?: string;
  onLoadExample?: (code: string) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const langId = (editorLanguage ?? 'javascript') as LanguageId;
  const lang = getLanguage(langId);
  const samples: SampleBot[] = (lang?.sampleBots ?? []).filter(bot => bot.name === 'Rusher');

  if (samples.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 p-4" style={{ color: '#475569' }}>
        <span className="text-4xl">📂</span>
        <p className="text-sm text-center">No examples for this language yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 overflow-y-auto h-full">
      <p className="text-xs" style={{ color: '#64748b' }}>
        Click a bot to preview, then load it into the editor.
      </p>
      {samples.map((bot) => {
        const isOpen = expanded === bot.name;
        const emoji = DIFFICULTY_EMOJI[bot.name] ?? '⚪';
        const label = DIFFICULTY_LABEL[bot.name] ?? '';
        return (
          <div
            key={bot.name}
            style={{
              background: '#0f1f3a',
              border: '1px solid #1e3a5f',
              borderRadius: '6px',
              overflow: 'hidden',
            }}
          >
            {/* Header row */}
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
              style={{ background: 'transparent' }}
              onClick={() => setExpanded(isOpen ? null : bot.name)}
            >
              <span>{emoji}</span>
              <span className="font-semibold text-sm flex-1" style={{ color: '#e2e8f0' }}>
                {bot.name}
              </span>
              {label && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: '#1e3a5f', color: '#94a3b8' }}
                >
                  {label}
                </span>
              )}
              <span style={{ color: '#64748b' }}>{isOpen ? '▲' : '▼'}</span>
            </button>

            {/* Description */}
            <p className="px-3 pb-2 text-xs" style={{ color: '#64748b' }}>
              {bot.description}
            </p>

            {/* Expanded preview + load button */}
            {isOpen && (
              <div style={{ borderTop: '1px solid #1e3a5f' }}>
                <pre
                  className="p-3 text-xs overflow-auto"
                  style={{
                    background: '#07111f',
                    color: '#94a3b8',
                    maxHeight: '260px',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre',
                  }}
                >
                  {bot.code}
                </pre>
                {onLoadExample && (
                  <div className="p-2">
                    <button
                      onClick={() => onLoadExample(bot.code)}
                      className="w-full text-xs py-1.5 rounded font-semibold transition-colors"
                      style={{ background: '#d97706', color: '#0a0e1a' }}
                    >
                      ⬆️ Load into Editor
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// EditorSidebar — tab container
// ─────────────────────────────────────────────

export function EditorSidebar({
  sidebarTab,
  setSidebarTab,
  versions,
  currentCode,
  onRestore,
  editorLanguage,
  onLoadExample,
}: EditorSidebarProps) {
  return (
    <div className="flex flex-col overflow-hidden w-full h-full">
      {/* Tab bar */}
      <div
        className="flex shrink-0"
        style={{ background: '#111827', borderBottom: '1px solid #1e3a5f' }}
      >
        <button
          onClick={() => setSidebarTab('docs')}
          className="px-4 py-2 text-xs font-semibold transition-colors"
          style={{
            background: sidebarTab === 'docs' ? '#0a0e1a' : 'transparent',
            color: sidebarTab === 'docs' ? '#f5a623' : '#64748b',
            borderBottom: sidebarTab === 'docs' ? '2px solid #d97706' : '2px solid transparent',
          }}
        >
          📖 API Docs
        </button>
        <button
          onClick={() => setSidebarTab('history')}
          className="px-4 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5"
          style={{
            background: sidebarTab === 'history' ? '#0a0e1a' : 'transparent',
            color: sidebarTab === 'history' ? '#f5a623' : '#64748b',
            borderBottom: sidebarTab === 'history' ? '2px solid #d97706' : '2px solid transparent',
          }}
        >
          📜 History
          {versions.length > 0 && (
            <span
              className="text-xs px-1.5 rounded-full"
              style={{ background: '#1e3a5f', color: '#94a3b8' }}
            >
              {versions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setSidebarTab('examples')}
          className="px-4 py-2 text-xs font-semibold transition-colors"
          style={{
            background: sidebarTab === 'examples' ? '#0a0e1a' : 'transparent',
            color: sidebarTab === 'examples' ? '#f5a623' : '#64748b',
            borderBottom: sidebarTab === 'examples' ? '2px solid #d97706' : '2px solid transparent',
          }}
        >
          💡 Examples
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {sidebarTab === 'docs' ? (
          <ApiDocsSidebar editorLanguage={editorLanguage} />
        ) : sidebarTab === 'examples' ? (
          <ExamplesPanel editorLanguage={editorLanguage} onLoadExample={onLoadExample} />
        ) : (
          <VersionHistoryPanel
            versions={versions}
            currentCode={currentCode}
            onRestore={onRestore}
          />
        )}
      </div>
    </div>
  );
}
