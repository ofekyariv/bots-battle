// ============================================================
// 🏴‍☠️ Bots Battle — Island Capture Logic
// ============================================================
//
// Capture rules (v2):
//
//   1. An island is MINE, THEIRS, or NEUTRAL — no ship-count concept.
//   2. Neutral island: park ANY ships (even 1) in capture radius for
//      captureTurns ticks → you own it.
//   3. Enemy island: neutralize first (captureTurns ticks), then
//      capture (captureTurns more ticks) = 2× captureTurns total.
//   4. CONTESTED: if BOTH teams have ships in the capture radius
//      simultaneously → progress is PAUSED. Neither side advances.
//   5. ABANDONED: if ALL ships leave the radius while capture is in
//      progress → progress RESETS to 0. Leave and come back = start over.
//   6. Ships do NOT lose combat eligibility by being near an island.
//      isCapturing is a tracking flag only — it does not exclude ships
//      from combat. Combat near islands works exactly like everywhere else.
//
// ============================================================

import type { GameConfig, Island, Ship } from './types';
import { distanceTo } from './helpers';

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Evaluate and advance capture timers for every island.
 *
 * For each island:
 *   1. Count alive ships per team within capture radius
 *   2. If BOTH teams present → contested, pause progress (no change)
 *   3. If EMPTY (no ships) → reset any in-progress capture to 0
 *   4. If ONLY ONE team present → advance their capture progress
 *      (even a single ship is enough)
 *   5. If the owning team regains sole presence → reset attacker progress
 *   6. If progress reaches the required threshold → transfer ownership
 *
 * Does NOT modify `isCapturing` flags — those are managed by
 * `GameEngine.markCapturingShips()` called before this function.
 *
 * @param ships    All ships (read-only; only alive ships affect capture)
 * @param islands  All islands (mutated in-place: `teamCapturing`, `captureProgress`, `owner`)
 * @param config   Game config (uses `captureRadius`)
 */
export function resolveCaptureProgress(ships: Ship[], islands: Island[], config: GameConfig): void {
  const { captureRadius } = config;
  const alive = ships.filter((s) => s.alive);

  for (const island of islands) {
    // Gather ships within this island's capture radius
    const nearby = alive.filter((s) => distanceTo(s, island) <= captureRadius);
    const p1Count = nearby.filter((s) => s.owner === 'player1').length;
    const p2Count = nearby.filter((s) => s.owner === 'player2').length;

    if (p1Count === 0 && p2Count === 0) {
      // Empty — no ships near island.
      // Reset any in-progress capture (leave and come back = start over).
      if (island.teamCapturing !== 'none') {
        island.captureProgress = 0;
        island.teamCapturing = 'none';
      }
      continue;
    }

    if (p1Count > 0 && p2Count > 0) {
      // Contested — both teams present. Pause progress for everyone.
      continue;
    }

    // Only one team has ships here
    const majority = p1Count > 0 ? 'player1' : 'player2';
    const minority = majority === 'player1' ? 'player2' : 'player1';

    if (island.owner === majority) {
      // Owning team has sole presence — reset any pending attacker progress
      if (island.teamCapturing === minority) {
        island.captureProgress = 0;
        island.teamCapturing = 'none';
      }
      // Island already owned — nothing else to do
      continue;
    }

    // Attacker (sole team present) is advancing
    advanceCapture(island, majority);
  }
}

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

/**
 * Advance capture progress for `team` on `island` by one tick.
 *
 * Handles:
 *   - Switch of capturing team (resets progress)
 *   - Neutral island capture (captureTurns ticks)
 *   - Enemy island neutralization + capture (captureTurns * 2 ticks)
 *   - Ownership transfer when progress threshold is reached
 */
function advanceCapture(island: Island, team: 'player1' | 'player2'): void {
  // Safety: already owned by this team (shouldn't happen here, but guard it)
  if (island.owner === team) return;

  // If a different team was previously advancing, reset their work
  if (island.teamCapturing !== 'none' && island.teamCapturing !== team) {
    island.captureProgress = 0;
  }

  // Mark this team as the capturer
  island.teamCapturing = team;

  // Advance the counter
  island.captureProgress++;

  // Determine required ticks based on current owner:
  //   Neutral → captureTurns
  //   Enemy   → captureTurns (neutralize) + captureTurns (capture) = 2×
  const required = island.owner === 'neutral' ? island.captureTurns : island.captureTurns * 2;

  if (island.captureProgress >= required) {
    // Fully captured!
    island.owner = team;
    island.captureProgress = 0;
    island.teamCapturing = 'none';
  }
}

// ─────────────────────────────────────────────
// Capture state helpers (for renderer / bots)
// ─────────────────────────────────────────────

/**
 * Is this island currently in the neutralization phase?
 * (i.e., owned by one team but being neutralized before full capture)
 * Only meaningful when `island.owner !== 'neutral'`.
 *
 * @param island  The island to check
 * @returns       `true` if owned but capture progress is < `captureTurns` (phase 1 of 2)
 */
export function isNeutralizing(island: Island): boolean {
  return (
    island.owner !== 'neutral' &&
    island.teamCapturing !== 'none' &&
    island.captureProgress > 0 &&
    island.captureProgress < island.captureTurns
  );
}

/**
 * Is this island in the final capture phase (neutralized, now being claimed)?
 * Returns `true` when `captureProgress >= captureTurns` on a previously-owned island.
 *
 * @param island  The island to check
 * @returns       `true` if the island has been neutralized and is now being captured
 */
export function isCapturingFinalPhase(island: Island): boolean {
  return (
    island.owner !== 'neutral' &&
    island.teamCapturing !== 'none' &&
    island.captureProgress >= island.captureTurns
  );
}

/**
 * Effective capture progress as a 0.0–1.0 fraction of total required.
 * Accounts for both neutral (1× captureTurns) and enemy (2× captureTurns) islands.
 *
 * @param island  The island to measure
 * @returns       Fraction in `[0, 1]` — `0` means no progress; `1` means just captured
 */
export function captureProgressFraction(island: Island): number {
  if (island.teamCapturing === 'none') return 0;
  const required = island.owner === 'neutral' ? island.captureTurns : island.captureTurns * 2;
  return Math.min(1, island.captureProgress / required);
}

/**
 * Returns per-island capture summaries for debugging / visualisation.
 *
 * @param ships    All ships in the game
 * @param islands  All islands on the map
 * @param config   Game config (uses `captureRadius`)
 * @returns        One entry per island with ship counts, owner, progress, and fraction
 */
export function getCaptureStats(
  ships: Ship[],
  islands: Island[],
  config: GameConfig,
): Array<{
  islandId: number;
  p1ShipsNear: number;
  p2ShipsNear: number;
  owner: string;
  teamCapturing: string;
  captureProgress: number;
  progressFraction: number;
}> {
  const { captureRadius } = config;
  const alive = ships.filter((s) => s.alive);

  return islands.map((island) => {
    const nearby = alive.filter((s) => distanceTo(s, island) <= captureRadius);
    const p1ShipsNear = nearby.filter((s) => s.owner === 'player1').length;
    const p2ShipsNear = nearby.filter((s) => s.owner === 'player2').length;

    return {
      islandId: island.id,
      p1ShipsNear,
      p2ShipsNear,
      owner: island.owner,
      teamCapturing: island.teamCapturing,
      captureProgress: island.captureProgress,
      progressFraction: captureProgressFraction(island),
    };
  });
}
