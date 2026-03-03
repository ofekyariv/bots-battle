'use client';

import { BotSelector } from './BotSelector';
import { LanguageToggle } from './LanguageToggle';
import type { EditorToolbarProps } from './types';

export function EditorToolbar({
  savedBots,
  currentBotId,
  isDirty,
  botName,
  setBotName,
  record,
  saveStatus,
  llmCopyStatus,
  showBotDropdown,
  setShowBotDropdown,
  showDeleteConfirm,
  setShowDeleteConfirm,
  editorLanguage,
  onLanguageChange,
  onNew,
  onLoad,
  onDelete,
  onSave,
  onRunTest,
  onCopyForLLM,
}: EditorToolbarProps) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 shrink-0 flex-wrap"
      style={{
        background: '#111827',
        borderBottom: '2px solid var(--gold-dark)',
        minHeight: '52px',
      }}
    >
      {/* Language dropdown */}
      <LanguageToggle
        editorLanguage={editorLanguage}
        onLanguageChange={onLanguageChange}
        currentBotId={currentBotId}
      />

      {/* My Bots dropdown */}
      <BotSelector
        savedBots={savedBots}
        currentBotId={currentBotId}
        isDirty={isDirty}
        showBotDropdown={showBotDropdown}
        setShowBotDropdown={setShowBotDropdown}
        showDeleteConfirm={showDeleteConfirm}
        setShowDeleteConfirm={setShowDeleteConfirm}
        onNew={onNew}
        onLoad={onLoad}
        onDelete={onDelete}
      />

      {/* Divider */}
      <div className="w-px h-6 shrink-0" style={{ background: '#1e3a5f' }} />

      {/* Bot name */}
      <div className="flex items-center gap-1.5" style={{ maxWidth: '200px' }}>
        <input
          type="text"
          value={botName}
          onChange={(e) => setBotName(e.target.value)}
          placeholder="Bot name…"
          aria-label="Bot name"
          className="flex-1 min-w-0 px-2 py-1.5 rounded font-mono text-sm font-semibold outline-none"
          style={{
            background: '#0a0e1a',
            border: `1px solid ${isDirty ? '#d97706' : '#1e3a5f'}`,
            color: '#f5a623',
            width: '160px',
          }}
          onKeyDown={(e) => e.key === 'Enter' && onSave()}
        />
        {isDirty && (
          <span className="text-xs shrink-0" style={{ color: '#d97706' }}>
            ●
          </span>
        )}
      </div>

      {/* Win/Loss record */}
      {currentBotId && record.total > 0 && (
        <span
          className="text-xs font-mono shrink-0 px-2 py-1 rounded"
          style={{ background: '#0a0e1a', border: '1px solid #1e3a5f' }}
        >
          <span style={{ color: '#86efac' }}>{record.wins}W</span>
          <span style={{ color: '#475569' }}>/</span>
          <span style={{ color: '#f87171' }}>{record.losses}L</span>
          {record.draws > 0 && (
            <>
              <span style={{ color: '#475569' }}>/</span>
              <span style={{ color: '#fbbf24' }}>{record.draws}D</span>
            </>
          )}
        </span>
      )}

      {/* Save */}
      <button
        onClick={onSave}
        aria-label="Save bot (Ctrl+S)"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors shrink-0"
        style={{
          background: isDirty ? '#d97706' : '#1e3a5f',
          color: isDirty ? '#0a0e1a' : '#94a3b8',
        }}
        title="Save bot (Ctrl+S)"
      >
        💾 Save
      </button>

      {/* Save status */}
      {saveStatus && (
        <span
          className="text-xs font-mono shrink-0"
          style={{ color: saveStatus.ok ? '#86efac' : '#f87171' }}
        >
          {saveStatus.msg}
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Keyboard hint */}
      <div
        className="hidden lg:flex items-center gap-3 text-xs shrink-0"
        style={{ color: '#334155' }}
      >
        <span>
          <kbd className="px-1 rounded" style={{ background: '#1e3a5f', color: '#475569' }}>
            Ctrl+S
          </kbd>{' '}
          save
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-6 shrink-0" style={{ background: '#1e3a5f' }} />

      {/* Run Test */}
      <button
        onClick={onRunTest}
        aria-label="Run test battle"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors shrink-0"
        style={{ background: '#059669', color: 'white' }}
      >
        ▶ Run Test
      </button>

      {/* Copy for LLM */}
      <button
        onClick={onCopyForLLM}
        aria-label="Copy bot code and API reference to clipboard for an LLM"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-colors shrink-0"
        style={{
          background:
            llmCopyStatus === 'copied'
              ? '#059669'
              : llmCopyStatus === 'error'
                ? '#dc2626'
                : '#1e3a5f',
          color: llmCopyStatus === 'copied' || llmCopyStatus === 'error' ? 'white' : '#94a3b8',
        }}
        title="Copy bot code + full API reference to clipboard for any LLM"
      >
        {llmCopyStatus === 'copied'
          ? '✅ Copied!'
          : llmCopyStatus === 'error'
            ? '❌ Failed'
            : '📋 Copy for LLM'}
      </button>

    </div>
  );
}
