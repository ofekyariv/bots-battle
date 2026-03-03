// ============================================================
// 🏴‍☠️ Bots Battle — Scoring System
// ============================================================
//
// Exponential scoring (from the original Pirates game):
//   1 island  →  1 pt/tick
//   2 islands →  2 pts/tick
//   3 islands →  4 pts/tick
//   4 islands →  8 pts/tick
//   5 islands → 16 pts/tick
//
// Formula: 2^(totalIslandValue - 1)
//
// Island.value counts as a scoring multiplier:
//   - Normal island: value = 1
//   - Treasure island: value = 2 (counts as 2 in the formula)
//
// This creates dramatic swings and comeback potential —
// controlling more islands is disproportionately rewarded.
// ============================================================

import type { Island, PlayerState } from './types';

// ─────────────────────────────────────────────
// Core Formulae
// ─────────────────────────────────────────────

/**
 * Points earned per tick for a given total island value held.
 *
 * Formula: 2^(totalValue - 1)
 *   totalValue = sum of island.value for all owned islands
 *
 * Returns 0 if no islands are held.
 *
 * @example
 * pointsPerTick(0)  // → 0
 * pointsPerTick(1)  // → 1
 * pointsPerTick(2)  // → 2
 * pointsPerTick(3)  // → 4
 * pointsPerTick(5)  // → 16
 */
export function pointsPerTick(totalValue: number): number {
  if (totalValue <= 0) return 0;
  return Math.pow(2, totalValue - 1);
}

/**
 * Sum the scoring value of all islands owned by a player.
 * Normal islands contribute 1; treasure islands contribute their `value` (2+).
 *
 * @param islands  All islands on the map
 * @param owner    Which player to sum for
 * @returns        Total `island.value` for all islands owned by `owner`
 */
export function totalIslandValue(islands: Island[], owner: 'player1' | 'player2'): number {
  return islands.filter((i) => i.owner === owner).reduce((sum, i) => sum + i.value, 0);
}

/**
 * Count the number of islands (not their total value) owned by a player.
 * Useful for `PlayerState.islandsHeld` and UI display.
 *
 * @param islands  All islands on the map
 * @param owner    Which player to count for
 * @returns        Number of islands whose `owner` matches the given player
 */
export function countIslands(islands: Island[], owner: 'player1' | 'player2'): number {
  return islands.filter((i) => i.owner === owner).length;
}

// ─────────────────────────────────────────────
// Tick Scoring
// ─────────────────────────────────────────────

/**
 * Calculate score deltas for one tick.
 *
 * @param islands  All islands on the map (ownership is read to compute values)
 * @returns        `[player1Delta, player2Delta]` — the points each player earns this tick
 *
 * @example
 * const [p1pts, p2pts] = scoreTick(state.islands);
 * p1Score += p1pts;
 * p2Score += p2pts;
 */
export function scoreTick(islands: Island[]): [number, number] {
  const p1Value = totalIslandValue(islands, 'player1');
  const p2Value = totalIslandValue(islands, 'player2');
  return [pointsPerTick(p1Value), pointsPerTick(p2Value)];
}

// ─────────────────────────────────────────────
// PlayerState Updates
// ─────────────────────────────────────────────

/**
 * Apply one tick of scoring to both player states.
 * Mutates `player1` and `player2` in-place: updates `score`, `lastTickPoints`, `islandsHeld`.
 *
 * @param islands          All islands on the map
 * @param player1          Player 1's state (mutated)
 * @param player2          Player 2's state (mutated)
 * @param currentP1Score   Player 1's cumulative score before this tick
 * @param currentP2Score   Player 2's cumulative score before this tick
 * @returns                `{ p1Score, p2Score }` — updated cumulative scores after this tick
 */
export function applyScoreTick(
  islands: Island[],
  player1: PlayerState,
  player2: PlayerState,
  currentP1Score: number,
  currentP2Score: number,
): { p1Score: number; p2Score: number } {
  const [p1Delta, p2Delta] = scoreTick(islands);

  player1.score = currentP1Score + p1Delta;
  player1.lastTickPoints = p1Delta;
  player1.islandsHeld = countIslands(islands, 'player1');

  player2.score = currentP2Score + p2Delta;
  player2.lastTickPoints = p2Delta;
  player2.islandsHeld = countIslands(islands, 'player2');

  return { p1Score: player1.score, p2Score: player2.score };
}

// ─────────────────────────────────────────────
// Score Projection
// ─────────────────────────────────────────────

/**
 * Project how many ticks it would take to reach `targetScore` from
 * `currentScore` at the given island holding rate.
 *
 * @param currentScore  Starting score
 * @param targetScore   Score threshold to reach
 * @param totalValue    Current total island value (determines rate via `pointsPerTick`)
 * @returns             Ticks needed (rounded up), or `Infinity` if no islands are held
 *
 * @example
 * // Is the enemy going to win before we can? Plan accordingly.
 * const enemyTicks = ticksToReachScore(state.enemyScore, state.targetScore, enemyValue);
 */
export function ticksToReachScore(
  currentScore: number,
  targetScore: number,
  totalValue: number,
): number {
  const rate = pointsPerTick(totalValue);
  if (rate === 0) return Infinity;
  const needed = targetScore - currentScore;
  if (needed <= 0) return 0;
  return Math.ceil(needed / rate);
}

/**
 * How many points would be earned over `ticks` ticks at a given island holding rate?
 *
 * @param totalValue  Total island value currently held
 * @param ticks       Number of ticks to project forward
 * @returns           `pointsPerTick(totalValue) * ticks`
 *
 * @example
 * // Would I win if I held 3 islands for the remaining ticks?
 * const remaining = state.maxTicks - state.tick;
 * const wouldEarn = projectedScore(3, remaining);
 */
export function projectedScore(totalValue: number, ticks: number): number {
  return pointsPerTick(totalValue) * ticks;
}

// ─────────────────────────────────────────────
// Score Summary (for debugging / UI)
// ─────────────────────────────────────────────

/**
 * Snapshot of both players' scoring state at a given moment.
 * Used by the HUD and post-game stats panel.
 * Build via {@link getScoreSummary}.
 */
export interface ScoreSummary {
  /** Player 1's current cumulative score */
  player1Score: number;
  /** Player 2's current cumulative score */
  player2Score: number;
  /** Number of islands player 1 currently holds */
  player1IslandsHeld: number;
  /** Number of islands player 2 currently holds */
  player2IslandsHeld: number;
  /** Points player 1 earns per tick at current holdings */
  player1PointsPerTick: number;
  /** Points player 2 earns per tick at current holdings */
  player2PointsPerTick: number;
  /** Total island value player 1 holds (sum of `island.value`) */
  player1TotalValue: number;
  /** Total island value player 2 holds */
  player2TotalValue: number;
  /** Which player is currently ahead, or `"tied"` */
  leader: 'player1' | 'player2' | 'tied';
  /** Absolute score difference between the two players */
  scoreDiff: number;
}

/**
 * Build a complete score summary for UI display.
 *
 * @param islands   All islands on the map
 * @param p1Score   Player 1's current cumulative score
 * @param p2Score   Player 2's current cumulative score
 * @returns         Full {@link ScoreSummary} including rates, values, leader, and diff
 */
export function getScoreSummary(islands: Island[], p1Score: number, p2Score: number): ScoreSummary {
  const p1Value = totalIslandValue(islands, 'player1');
  const p2Value = totalIslandValue(islands, 'player2');

  const player1PointsPerTick = pointsPerTick(p1Value);
  const player2PointsPerTick = pointsPerTick(p2Value);

  const leader: 'player1' | 'player2' | 'tied' =
    p1Score > p2Score ? 'player1' : p2Score > p1Score ? 'player2' : 'tied';

  return {
    player1Score: p1Score,
    player2Score: p2Score,
    player1IslandsHeld: countIslands(islands, 'player1'),
    player2IslandsHeld: countIslands(islands, 'player2'),
    player1PointsPerTick,
    player2PointsPerTick,
    player1TotalValue: p1Value,
    player2TotalValue: p2Value,
    leader,
    scoreDiff: Math.abs(p1Score - p2Score),
  };
}
