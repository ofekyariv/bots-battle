// ============================================================
// 🏴☠️ Bots Battle — Language Registry Types
// Single source of truth for all language support
// ============================================================

import type { BotIsland, BotOwner, BotShip } from '@/engine/types';

// ─────────────────────────────────────────────
// Language IDs
// ─────────────────────────────────────────────

export type LanguageId =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'kotlin'
  | 'java'
  | 'csharp'
  | 'swift';

// ─────────────────────────────────────────────
// Helper signatures
// ─────────────────────────────────────────────

/** Canonical helper names matching BOT_HELPERS keys */
export type HelperName =
  | 'distanceTo'
  | 'distanceToSq'
  | 'angleTo'
  | 'nearestIsland'
  | 'nearestIslandOwnedBy'
  | 'islandsOwnedBy'
  | 'islandsNotMine'
  | 'nearestEnemy'
  | 'shipsNear'
  | 'shipsSortedByDistance'
  | 'freeShips'
  | 'wouldDieAt'
  | 'aliveCount'
  | 'scoreRate'
  | 'idle'
  | 'move';

/** Per-language signature string for a single helper */
export interface HelperSignature {
  /** Canonical helper name (camelCase, matches BOT_HELPERS) */
  canonicalName: HelperName;
  /** Native function call signature in this language */
  signature: string;
  /** Short description */
  description: string;
  /** Return type in the language's type system */
  returnType: string;
  /** Usage example in this language */
  example: string;
}

// ─────────────────────────────────────────────
// Command API
// ─────────────────────────────────────────────

/** How commands are created in a given language */
export interface CommandApi {
  /** Code snippet that produces an idle command */
  idle: string;
  /** Code snippet that produces a move command (x and y are placeholder variable names) */
  move: string;
  /** Optional: move using a target object with x,y fields */
  moveToObject?: string;
  /** Brief description of the command API for this language */
  description: string;
}

// ─────────────────────────────────────────────
// Sandbox
// ─────────────────────────────────────────────

export type SandboxType = 'js-direct' | 'transpile-to-js' | 'remote-compile';

export interface SandboxConfig {
  type: SandboxType;
  /** Human-readable description of the execution model */
  description: string;
  /** Whether this sandbox has async init (remote compile) */
  isAsync: boolean;
  /** Estimated latency label */
  latency: 'instant' | 'low' | 'high';
}

// ─────────────────────────────────────────────
// Sample bot
// ─────────────────────────────────────────────

export interface SampleBot {
  name: string;
  description: string;
  /** Full bot code in this language */
  code: string;
}

// ─────────────────────────────────────────────
// Main language config
// ─────────────────────────────────────────────

export interface LanguageConfig {
  /** Unique language identifier */
  id: LanguageId;
  /** Human-readable name */
  displayName: string;
  /** Monaco editor language identifier */
  monacoLanguage: string;
  /** Default file extension (without dot) */
  fileExtension: string;
  /** Brand color for UI (hex or CSS color) */
  color: string;
  /** Emoji icon for this language */
  icon: string;

  /** How commands are created in this language */
  commandApi: CommandApi;

  /** Per-language signatures for all 14 helpers */
  helperSignatures: Record<HelperName, HelperSignature>;

  /** Language-specific type stubs injected into editor (for intellisense / docs) */
  typeDefinitions: string;

  /** Starter code template shown to new users */
  starterCode: string;

  /** Sample bots demonstrating strategies */
  sampleBots: SampleBot[];

  /** Doc snippets for API reference sidebar */
  docSnippets: {
    /** Snippet showing the tick() function signature */
    tickSignature: string;
    /** Snippet showing how to return a command */
    commandUsage: string;
  };

  /** Sandbox execution model config */
  sandbox: SandboxConfig;
}
