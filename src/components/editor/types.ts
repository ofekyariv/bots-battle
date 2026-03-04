// ─────────────────────────────────────────────
// Shared types for the Editor components
// ─────────────────────────────────────────────

import type { BotMeta, BotWithCode } from '@/lib/api/bots';

export type LogLevel = 'info' | 'success' | 'error' | 'warn';

export interface LogEntry {
  id: number;
  level: LogLevel;
  msg: string;
  ts: string;
}

export type DiffLine = { type: 'same' | 'added' | 'removed'; content: string };

export type EditorLanguage = 'javascript' | 'typescript' | 'python' | 'kotlin' | 'csharp' | 'java' | 'swift';

export interface WinRecord {
  wins: number;
  losses: number;
  draws: number;
  total: number;
}

/** Lightweight version history entry (stored client-side only for the current session) */
export interface BotVersion {
  code: string;
  savedAt: string;
  note?: string;
}

// ── Component prop types ──────────────────────────────────────────

export interface ConsoleOutputProps {
  logs: LogEntry[];
  onClear: () => void;
  collapsed: boolean;
  onToggle: () => void;
}

export interface BotSelectorProps {
  savedBots: BotMeta[];
  currentBotId: string | null;
  isDirty: boolean;
  showBotDropdown: boolean;
  setShowBotDropdown: (v: boolean | ((prev: boolean) => boolean)) => void;
  showDeleteConfirm: string | null;
  setShowDeleteConfirm: (id: string | null) => void;
  onNew: () => void;
  onLoad: (bot: BotWithCode) => void;
  onDelete: (id: string) => void;
}

export interface LanguageToggleProps {
  editorLanguage: EditorLanguage;
  onLanguageChange: (lang: EditorLanguage) => void;
  currentBotId: string | null;
}

export interface EditorSidebarProps {
  sidebarTab: 'docs' | 'history' | 'examples';
  setSidebarTab: (tab: 'docs' | 'history' | 'examples') => void;
  onLoadExample?: (code: string) => void;
  versions: BotVersion[];
  currentCode: string;
  onRestore: (code: string) => void;
  editorLanguage?: EditorLanguage;
}

export interface EditorToolbarProps {
  savedBots: BotMeta[];
  currentBotId: string | null;
  isDirty: boolean;
  botName: string;
  setBotName: (name: string) => void;
  record: WinRecord;
  saveStatus: { ok: boolean; msg: string } | null;
  llmCopyStatus: 'idle' | 'copied' | 'error';
  showBotDropdown: boolean;
  setShowBotDropdown: (v: boolean | ((prev: boolean) => boolean)) => void;
  showDeleteConfirm: string | null;
  setShowDeleteConfirm: (id: string | null) => void;
  editorLanguage: EditorLanguage;
  onLanguageChange: (lang: EditorLanguage) => void;
  onNew: () => void;
  onLoad: (bot: BotWithCode) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
  onRunTest: () => void;
  onCopyForLLM: () => void;
  isAuthenticated: boolean;
}

// Re-export API types for convenience
export type { BotMeta, BotWithCode };
