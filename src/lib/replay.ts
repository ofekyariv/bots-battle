// ============================================================
// 🏴‍☠️ Replay — save / load / list / delete full game replays
//
// Each replay stores:
//   • metadata  — bot names, result, timestamp, tick count
//   • frames    — one FullGameState snapshot every 5 ticks
//
// Saved to localStorage. Capped at MAX_REPLAYS (FIFO eviction).
// ============================================================

import type { FullGameState, GameResult } from '@/engine/types';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const STORAGE_KEY = 'bots-battle:replays';
const MAX_REPLAYS = 10;

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ReplayMetadata {
  /** Unique ID — timestamp-based */
  id: string;
  /** Display name for player 1's bot */
  player1Name: string;
  /** Display name for player 2's bot */
  player2Name: string;
  /** Final game result */
  result: GameResult;
  /** ISO timestamp string when the replay was saved */
  savedAt: string;
  /** Total number of frames stored (= ceil(totalTicks / FRAME_INTERVAL)) */
  frameCount: number;
  /** Total game ticks (for duration display) */
  totalTicks: number;
  /** Tick rate in ms (for duration display) */
  tickRateMs: number;
}

export interface ReplayData {
  metadata: ReplayMetadata;
  /** Recorded frames — one every FRAME_INTERVAL ticks */
  frames: FullGameState[];
}

// ─────────────────────────────────────────────
// Internal: localStorage index
// ─────────────────────────────────────────────

function loadIndex(): ReplayMetadata[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY + ':index');
    return raw ? (JSON.parse(raw) as ReplayMetadata[]) : [];
  } catch {
    return [];
  }
}

function saveIndex(index: ReplayMetadata[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY + ':index', JSON.stringify(index));
  } catch (e) {
    console.warn('[replay] Failed to save index:', e);
  }
}

function replayKey(id: string): string {
  return `${STORAGE_KEY}:${id}`;
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Save a recorded replay to localStorage.
 * Evicts the oldest entry when the cap is exceeded.
 *
 * @param frames   The recorded FullGameState frames
 * @param metadata Metadata about this replay (bot names, result, etc.)
 * @returns The id of the saved replay
 */
export function saveReplay(
  frames: FullGameState[],
  metadata: Omit<ReplayMetadata, 'id' | 'savedAt' | 'frameCount'>,
): string {
  if (typeof window === 'undefined') return '';

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const fullMeta: ReplayMetadata = {
    ...metadata,
    id,
    savedAt: new Date().toISOString(),
    frameCount: frames.length,
  };

  const data: ReplayData = { metadata: fullMeta, frames };

  try {
    localStorage.setItem(replayKey(id), JSON.stringify(data));
  } catch (e) {
    console.warn('[replay] Failed to save replay data:', e);
    return '';
  }

  // Update index (FIFO cap)
  const index = loadIndex();
  index.push(fullMeta);

  // Evict oldest entries over the cap
  while (index.length > MAX_REPLAYS) {
    const evicted = index.shift()!;
    try {
      localStorage.removeItem(replayKey(evicted.id));
    } catch {
      // ignore
    }
  }

  saveIndex(index);
  return id;
}

/**
 * Load a full replay by id.
 * Returns null if not found.
 */
export function loadReplay(id: string): ReplayData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(replayKey(id));
    return raw ? (JSON.parse(raw) as ReplayData) : null;
  } catch {
    return null;
  }
}

/**
 * List all saved replay metadata (most recent first).
 */
export function listReplays(): ReplayMetadata[] {
  return [...loadIndex()].reverse();
}

/**
 * Delete a replay by id.
 */
export function deleteReplay(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(replayKey(id));
  } catch {
    // ignore
  }
  const index = loadIndex().filter((m) => m.id !== id);
  saveIndex(index);
}
