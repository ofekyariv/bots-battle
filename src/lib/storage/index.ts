// ============================================================
// 🏴‍☠️ Storage — barrel export
// ============================================================
// Bots are now stored server-side only (PostgreSQL via API).
// This module only exports match results, player records,
// bot styles, and game settings (still localStorage).
// ============================================================

export type { MatchResult, PlayerOpponentRecord, BotStyle } from './schemas';

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
