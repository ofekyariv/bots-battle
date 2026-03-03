// ============================================================
// 🏴‍☠️ Storage — barrel export
// ============================================================
// Imports all sub-modules and re-exports their public APIs.
// Also provides exportAllData() and importAllData() for backup/restore.
// ============================================================

// ─────────────────────────────────────────────
// Re-export everything from sub-modules
// ─────────────────────────────────────────────

export type { BotVersion, SavedBot, BotMeta, BotLanguage } from './schemas';
export type { MatchResult, PlayerOpponentRecord, BotStyle } from './schemas';
export type { StorageExport } from './schemas';

export { STORAGE_VERSION } from './migrations';
export { runMigrations } from './migrations';

// Bot CRUD
export {
  uuid,
  saveBot,
  loadBot,
  loadBotFull,
  listBots,
  deleteBot,
  getBotById,
  deleteBotById,
  saveOrUpdateBot,
  addBotVersion,
  renameBotById,
  botExists,
  exportBots,
  importBots,
} from './bots';

// Match results & player records
export {
  recordMatchResult,
  getMatchResults,
  getBotRecord,
  recordPlayerResult,
  getPlayerRecordVsOpponent,
} from './matches';

// Bot styles
export { setBotStyle, getBotStyle } from './matches';

// Game settings & misc persistence
export {
  saveGameSettings,
  loadGameSettings,
  saveLastOpponent,
  loadLastOpponent,
  saveLastPlayer1,
  loadLastPlayer1,
  saveLastPreset,
  loadLastPreset,
  setLastEditedBotId,
  getLastEditedBotId,
} from './matches';

// ─────────────────────────────────────────────
// Backup / Restore
// ─────────────────────────────────────────────

import { _readAllBots, _writeAllBots } from './bots';
import { _readMatchResults, _readPlayerRecords, _readBotStyles } from './matches';
import { StorageExportSchema } from './schemas';
import { STORAGE_VERSION } from './migrations';

/**
 * Export all stored data as a JSON string.
 * Includes bots, match results, player records, bot styles, and misc settings.
 */
export function exportAllData(): string {
  const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

  const payload = {
    version: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    bots: _readAllBots(),
    matchResults: _readMatchResults(),
    playerRecords: _readPlayerRecords(),
    botStyles: _readBotStyles(),
    gameSettings: isBrowser
      ? (() => {
          try {
            const raw = localStorage.getItem('bots-battle:settings');
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        })()
      : null,
    lastEditedBotId: isBrowser ? localStorage.getItem('bots-battle:last-edited-bot-id') : null,
    lastOpponent: isBrowser ? localStorage.getItem('bots-battle:last-opponent') : null,
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Import all data from a JSON string produced by exportAllData().
 * mode "merge" — adds bots/results not already present (by id)
 * mode "replace" — overwrites all existing data
 */
export function importAllData(json: string, mode: 'merge' | 'replace' = 'merge'): void {
  const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  if (!isBrowser) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    throw new Error(`importAllData: invalid JSON — ${e instanceof Error ? e.message : String(e)}`);
  }

  const result = StorageExportSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `importAllData: data does not match expected schema — ${result.error.issues
        .map((i) => i.message)
        .join(', ')}`,
    );
  }

  const data = result.data;

  if (mode === 'replace') {
    _writeAllBots(data.bots);
    localStorage.setItem('bots-battle:match-results', JSON.stringify(data.matchResults));
    localStorage.setItem('bots-battle:player-records', JSON.stringify(data.playerRecords));
    localStorage.setItem('bots-battle:bot-styles', JSON.stringify(data.botStyles));
    if (data.gameSettings != null) {
      localStorage.setItem('bots-battle:settings', JSON.stringify(data.gameSettings));
    }
    if (data.lastEditedBotId) {
      localStorage.setItem('bots-battle:last-edited-bot-id', data.lastEditedBotId);
    }
    if (data.lastOpponent) {
      localStorage.setItem('bots-battle:last-opponent', data.lastOpponent);
    }
    return;
  }

  // Merge mode: add only items not already present (by id)
  const existingBots = _readAllBots();
  const existingBotIds = new Set(existingBots.map((b) => b.id));
  _writeAllBots([...existingBots, ...data.bots.filter((b) => !existingBotIds.has(b.id))]);

  const existingMatches = _readMatchResults();
  // For match results we don't have stable IDs — only append if merging by timestamp+botId
  const existingMatchKeys = new Set(existingMatches.map((m) => `${m.botId}:${m.timestamp}`));
  const newMatches = data.matchResults.filter(
    (m) => !existingMatchKeys.has(`${m.botId}:${m.timestamp}`),
  );
  localStorage.setItem(
    'bots-battle:match-results',
    JSON.stringify([...existingMatches, ...newMatches]),
  );

  // Player records: add or update (take max of existing/incoming)
  const existingPlayerRecords = _readPlayerRecords();
  for (const [id, record] of Object.entries(data.playerRecords)) {
    if (!existingPlayerRecords[id]) {
      existingPlayerRecords[id] = record;
    }
    // Don't overwrite existing records in merge mode
  }
  localStorage.setItem('bots-battle:player-records', JSON.stringify(existingPlayerRecords));

  // Bot styles: merge (don't overwrite existing)
  const existingStyles = _readBotStyles();
  for (const [id, style] of Object.entries(data.botStyles)) {
    if (!(id in existingStyles)) {
      existingStyles[id] = style;
    }
  }
  localStorage.setItem('bots-battle:bot-styles', JSON.stringify(existingStyles));
}
