// ============================================================
// 🏴‍☠️ Storage Schemas — Zod validation for all stored types
// ============================================================

import { z } from 'zod';

// ─────────────────────────────────────────────
// BotVersion
// ─────────────────────────────────────────────

export const BotVersionSchema = z.object({
  code: z.string(),
  savedAt: z.string(),
  note: z.string().optional(),
});

export type BotVersion = z.infer<typeof BotVersionSchema>;

// ─────────────────────────────────────────────
// SavedBot
// ─────────────────────────────────────────────

export const BotLanguageSchema = z.enum(['javascript', 'typescript', 'python', 'kotlin', 'csharp', 'java', 'swift']);

export type BotLanguage = z.infer<typeof BotLanguageSchema>;

export const SavedBotSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  language: BotLanguageSchema.optional().default('javascript'),
  createdAt: z.string(),
  updatedAt: z.string(),
  versions: z.array(BotVersionSchema).default([]),
});

export type SavedBot = z.infer<typeof SavedBotSchema>;

/** Lightweight metadata without code or versions — for listing */
export type BotMeta = Omit<SavedBot, 'code' | 'versions'>;

// ─────────────────────────────────────────────
// MatchResult
// ─────────────────────────────────────────────

export const MatchResultSchema = z.object({
  botId: z.string(),
  opponent: z.string(),
  result: z.enum(['win', 'loss', 'draw']),
  timestamp: z.string(),
});

export type MatchResult = z.infer<typeof MatchResultSchema>;

// ─────────────────────────────────────────────
// PlayerOpponentRecord
// ─────────────────────────────────────────────

export const PlayerOpponentRecordSchema = z.object({
  opponentId: z.string(),
  wins: z.number().int().min(0),
  losses: z.number().int().min(0),
  draws: z.number().int().min(0),
});

export type PlayerOpponentRecord = z.infer<typeof PlayerOpponentRecordSchema>;

// ─────────────────────────────────────────────
// BotStyle
// ─────────────────────────────────────────────

export const BotStyleSchema = z.enum(['aggressive', 'defensive', 'balanced']);
export type BotStyle = z.infer<typeof BotStyleSchema>;

// ─────────────────────────────────────────────
// GameSettings
// ─────────────────────────────────────────────

export const GameSettingsSchema = z.record(z.string(), z.number()).nullable();

// ─────────────────────────────────────────────
// Full data export (for backup/restore)
// ─────────────────────────────────────────────

export const StorageExportSchema = z.object({
  version: z.number(),
  exportedAt: z.string(),
  bots: z.array(SavedBotSchema),
  matchResults: z.array(MatchResultSchema),
  playerRecords: z.record(z.string(), PlayerOpponentRecordSchema),
  botStyles: z.record(z.string(), BotStyleSchema),
  gameSettings: z.record(z.string(), z.number()).nullable().optional(),
  lastEditedBotId: z.string().nullable().optional(),
  lastOpponent: z.string().nullable().optional(),
});

export type StorageExport = z.infer<typeof StorageExportSchema>;

// ─────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────

/**
 * Parse & validate an array of SavedBot, filtering out corrupted entries with a warning.
 */
export function parseBotArray(raw: unknown, context = 'bots'): SavedBot[] {
  if (!Array.isArray(raw)) {
    console.warn(`[storage/${context}] Expected array, got ${typeof raw}. Resetting.`);
    return [];
  }
  return raw.reduce<SavedBot[]>((acc, item) => {
    const result = SavedBotSchema.safeParse(item);
    if (result.success) {
      acc.push(result.data);
    } else {
      console.warn(`[storage/${context}] Corrupted bot entry skipped:`, result.error.issues);
    }
    return acc;
  }, []);
}

/**
 * Parse & validate an array of MatchResult, filtering out corrupted entries.
 */
export function parseMatchResultArray(raw: unknown, context = 'match-results'): MatchResult[] {
  if (!Array.isArray(raw)) {
    console.warn(`[storage/${context}] Expected array, got ${typeof raw}. Resetting.`);
    return [];
  }
  return raw.reduce<MatchResult[]>((acc, item) => {
    const result = MatchResultSchema.safeParse(item);
    if (result.success) {
      acc.push(result.data);
    } else {
      console.warn(`[storage/${context}] Corrupted match result skipped:`, result.error.issues);
    }
    return acc;
  }, []);
}
