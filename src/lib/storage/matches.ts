// ============================================================
// 🏴‍☠️ Storage / Matches — match results, player records,
//   bot styles, game settings, and last-state persistence
// ============================================================

import { runMigrations } from './migrations';
import { parseMatchResultArray, PlayerOpponentRecordSchema, BotStyleSchema } from './schemas';
import type { MatchResult, PlayerOpponentRecord, BotStyle } from './schemas';

// Re-export types
export type { MatchResult, PlayerOpponentRecord, BotStyle };

// ─────────────────────────────────────────────
// Storage keys
// ─────────────────────────────────────────────

const MATCH_RESULTS_KEY = 'bots-battle:match-results';
const PLAYER_RECORDS_KEY = 'bots-battle:player-records';
const BOT_STYLES_KEY = 'bots-battle:bot-styles';
const GAME_SETTINGS_KEY = 'bots-battle:settings';
const LAST_EDITED_KEY = 'bots-battle:last-edited-bot-id';
const LAST_OPPONENT_KEY = 'bots-battle:last-opponent';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

// ─────────────────────────────────────────────
// Match result tracking
// ─────────────────────────────────────────────

function readMatchResults(): MatchResult[] {
  if (!isBrowser()) return [];
  runMigrations();
  try {
    const raw = localStorage.getItem(MATCH_RESULTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parseMatchResultArray(parsed);
  } catch (e) {
    console.warn('[storage/matches] readMatchResults failed:', e);
    return [];
  }
}

function writeMatchResults(results: MatchResult[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(MATCH_RESULTS_KEY, JSON.stringify(results));
}

/**
 * Record the outcome of a match for a specific bot.
 */
export function recordMatchResult(
  botId: string,
  opponent: string,
  result: 'win' | 'loss' | 'draw',
): void {
  const results = readMatchResults();
  results.push({
    botId,
    opponent,
    result,
    timestamp: new Date().toISOString(),
  });
  writeMatchResults(results);
}

/**
 * Get all match results, optionally filtered to a specific bot.
 */
export function getMatchResults(botId?: string): MatchResult[] {
  const all = readMatchResults();
  if (!botId) return all;
  return all.filter((r) => r.botId === botId);
}

/**
 * Get win/loss/draw counts for a bot.
 */
export function getBotRecord(botId: string): {
  wins: number;
  losses: number;
  draws: number;
  total: number;
} {
  const results = getMatchResults(botId);
  return {
    wins: results.filter((r) => r.result === 'win').length,
    losses: results.filter((r) => r.result === 'loss').length,
    draws: results.filter((r) => r.result === 'draw').length,
    total: results.length,
  };
}

// ─────────────────────────────────────────────
// Player records vs pre-built opponents
// ─────────────────────────────────────────────

function readPlayerRecords(): Record<string, PlayerOpponentRecord> {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(PLAYER_RECORDS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    // Validate each entry
    const result: Record<string, PlayerOpponentRecord> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const r = PlayerOpponentRecordSchema.safeParse(value);
      if (r.success) {
        result[key] = r.data;
      } else {
        console.warn(`[storage/matches] Invalid player record for "${key}" skipped.`);
      }
    }
    return result;
  } catch (e) {
    console.warn('[storage/matches] readPlayerRecords failed:', e);
    return {};
  }
}

/**
 * Record the outcome of a battle against a pre-built opponent.
 */
export function recordPlayerResult(opponentId: string, result: 'win' | 'loss' | 'draw'): void {
  if (!isBrowser()) return;
  const records = readPlayerRecords();
  if (!records[opponentId]) {
    records[opponentId] = { opponentId, wins: 0, losses: 0, draws: 0 };
  }
  if (result === 'win') records[opponentId].wins++;
  else if (result === 'loss') records[opponentId].losses++;
  else records[opponentId].draws++;
  localStorage.setItem(PLAYER_RECORDS_KEY, JSON.stringify(records));
}

/**
 * Get the player's overall record against a specific pre-built opponent.
 */
export function getPlayerRecordVsOpponent(opponentId: string): {
  wins: number;
  losses: number;
  draws: number;
  total: number;
} {
  const records = readPlayerRecords();
  const r = records[opponentId];
  if (!r) return { wins: 0, losses: 0, draws: 0, total: 0 };
  return {
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    total: r.wins + r.losses + r.draws,
  };
}

// ─────────────────────────────────────────────
// Bot style tagging
// ─────────────────────────────────────────────

function readBotStyles(): Record<string, BotStyle> {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(BOT_STYLES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const result: Record<string, BotStyle> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const r = BotStyleSchema.safeParse(value);
      if (r.success) {
        result[key] = r.data;
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Manually tag a bot's combat style. */
export function setBotStyle(botId: string, style: BotStyle): void {
  if (!isBrowser()) return;
  const styles = readBotStyles();
  styles[botId] = style;
  localStorage.setItem(BOT_STYLES_KEY, JSON.stringify(styles));
}

/**
 * Get a bot's combat style.
 * Returns the manually set style if present, otherwise auto-detects from win/loss history.
 */
export function getBotStyle(botId: string): BotStyle {
  const styles = readBotStyles();
  if (styles[botId]) return styles[botId];

  const results = getMatchResults(botId);
  if (results.length < 3) return 'balanced';

  const winsVsHard = results.filter(
    (r) => r.result === 'win' && (r.opponent === 'Hunter' || r.opponent === 'Balanced'),
  ).length;
  const winsVsAggressive = results.filter(
    (r) => r.result === 'win' && (r.opponent === 'Rusher' || r.opponent === 'Random'),
  ).length;

  if (winsVsHard > winsVsAggressive) return 'defensive';
  if (winsVsAggressive > winsVsHard) return 'aggressive';
  return 'balanced';
}

// ─────────────────────────────────────────────
// Game settings persistence
// ─────────────────────────────────────────────

export function saveGameSettings(config: object): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(GAME_SETTINGS_KEY, JSON.stringify(config));
  } catch {
    // quota exceeded or private-browsing — fail silently
  }
}

export function loadGameSettings(): Record<string, number> | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(GAME_SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, number>;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Last-opponent persistence
// ─────────────────────────────────────────────

export function saveLastOpponent(opponentId: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(LAST_OPPONENT_KEY, opponentId);
  } catch {
    // fail silently
  }
}

export function loadLastOpponent(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(LAST_OPPONENT_KEY);
}

// ─────────────────────────────────────────────
// Last player1 bot persistence
// ─────────────────────────────────────────────

const LAST_PLAYER1_KEY = 'bots-battle:last-player1';

export function saveLastPlayer1(botId: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(LAST_PLAYER1_KEY, botId);
  } catch {
    // fail silently
  }
}

export function loadLastPlayer1(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(LAST_PLAYER1_KEY);
}

// ─────────────────────────────────────────────
// Last match preset persistence
// ─────────────────────────────────────────────

const LAST_PRESET_KEY = 'bots-battle:last-preset';

export function saveLastPreset(preset: string): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(LAST_PRESET_KEY, preset);
  } catch {
    // fail silently
  }
}

export function loadLastPreset(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(LAST_PRESET_KEY);
}

// ─────────────────────────────────────────────
// Last-edited bot persistence
// ─────────────────────────────────────────────

export function setLastEditedBotId(id: string | null): void {
  if (!isBrowser()) return;
  if (id) {
    localStorage.setItem(LAST_EDITED_KEY, id);
  } else {
    localStorage.removeItem(LAST_EDITED_KEY);
  }
}

export function getLastEditedBotId(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(LAST_EDITED_KEY);
}

// ─────────────────────────────────────────────
// Internal access for export/import utilities
// ─────────────────────────────────────────────

export {
  readMatchResults as _readMatchResults,
  readPlayerRecords as _readPlayerRecords,
  readBotStyles as _readBotStyles,
};
