// ============================================================
// 🏴☠️ Bots Battle — Replay Format
// ============================================================
//
// Replay is stored as an array of tick snapshots.
// Each snapshot captures the complete state at that tick,
// allowing full replay without re-running the game engine.
// ============================================================

import type { FullGameState, Ship, Island, GameResult } from '@/engine/types';

// ─────────────────────────────────────────────
// Replay types
// ─────────────────────────────────────────────

/** Minimal ship state for replay (stripped to essentials) */
export interface ReplayShip {
  id: number;
  owner: 'player1' | 'player2';
  x: number;
  y: number;
  alive: boolean;
  isCapturing: boolean;
  turnsToRevive: number;
  combatPressure: number;
}

/** Minimal island state for replay */
export interface ReplayIsland {
  id: number;
  x: number;
  y: number;
  radius: number;
  owner: 'player1' | 'player2' | 'neutral';
  teamCapturing: 'player1' | 'player2' | 'none';
  captureProgress: number;
  value: number;
}

/** One tick snapshot in the replay */
export interface ReplayTick {
  tick: number;
  player1Score: number;
  player2Score: number;
  ships: ReplayShip[];
  islands: ReplayIsland[];
}

/** Complete replay data for a match */
export interface MatchReplay {
  /** All tick snapshots, one per tick played */
  ticks: ReplayTick[];
  /** Final game result */
  result: GameResult;
  /** Map dimensions for renderer */
  mapWidth: number;
  mapHeight: number;
  /** Game configuration used */
  tickRateMs: number;
  numShipsPerPlayer: number;
}

// ─────────────────────────────────────────────
// Snapshot builder
// ─────────────────────────────────────────────

/**
 * Build a ReplayTick snapshot from the current FullGameState.
 * Called after each tick during a server-side match run.
 */
export function buildReplayTick(state: FullGameState): ReplayTick {
  return {
    tick: state.tick,
    player1Score: state.player1Score,
    player2Score: state.player2Score,
    ships: state.ships.map((s) => ({
      id: s.id,
      owner: s.owner as 'player1' | 'player2',
      x: s.x,
      y: s.y,
      alive: s.alive,
      isCapturing: s.isCapturing,
      turnsToRevive: s.turnsToRevive,
      combatPressure: s.combatPressure,
    })),
    islands: state.islands.map((i) => ({
      id: i.id,
      x: i.x,
      y: i.y,
      radius: i.radius,
      owner: i.owner as 'player1' | 'player2' | 'neutral',
      teamCapturing: i.teamCapturing as 'player1' | 'player2' | 'none',
      captureProgress: i.captureProgress,
      value: i.value,
    })),
  };
}

// ─────────────────────────────────────────────
// Size estimation
// ─────────────────────────────────────────────

/**
 * Estimate the JSON size of a replay in bytes.
 * Uses a rough heuristic: ~200 bytes per tick per ship + island overhead.
 *
 * @param numTicks         Number of ticks in the replay
 * @param numShips         Total number of ships (both players combined)
 * @param numIslands       Number of islands on the map
 * @returns                Estimated size in bytes
 */
export function estimateReplaySize(
  numTicks: number,
  numShips: number,
  numIslands: number,
): number {
  // Per-tick overhead: tick number + scores = ~40 bytes
  const perTickOverhead = 40;
  // Per-ship per-tick: ~80 bytes (id, x, y, alive, etc.)
  const perShipPerTick = 80;
  // Per-island per-tick: ~100 bytes
  const perIslandPerTick = 100;
  // Metadata overhead
  const metadataOverhead = 500;

  return (
    metadataOverhead +
    numTicks * (perTickOverhead + numShips * perShipPerTick + numIslands * perIslandPerTick)
  );
}

/**
 * Format estimated replay size as a human-readable string.
 * @param bytes  Estimated size in bytes
 * @returns      Formatted string like "1.4 MB" or "320 KB"
 */
export function formatReplaySize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}
