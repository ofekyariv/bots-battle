// ============================================================
// 🏴‍☠️ Bots Battle — Combat Resolution
// Per-ship radius evaluation (from original Pirates game):
//   - Count enemy vs. friendly ships in each ship's attack radius
//   - More enemies than friendlies → ship is destroyed
//   - Ships near islands (isCapturing) fight exactly like any other ship —
//     proximity to an island does NOT remove combat eligibility
// ============================================================

import type { GameConfig, Ship } from './types';
import { distanceTo } from './helpers';

// ─────────────────────────────────────────────
// Head-On Collision
// ─────────────────────────────────────────────

/**
 * Detect and resolve head-on collisions: two enemy ships that ended up
 * at (or very close to) the same position after movement.
 *
 * Both ships are destroyed when this happens.
 * Collision threshold: 1 unit (ships basically share the same point).
 *
 * Called AFTER movement, BEFORE combat radius evaluation.
 *
 * @param ships   All ships in the game (mutated in-place: `alive=false`, `turnsToRevive` set)
 * @param config  Game config (uses `respawnDelay`)
 */
export function resolveCollisions(_ships: Ship[], _config: GameConfig): void {
  // No-op: head-on collisions are disabled.
  // Ships at the same position are handled by radius combat (equal = both survive).
}

// ─────────────────────────────────────────────
// Per-Ship Radius Combat
// ─────────────────────────────────────────────

/**
 * Evaluate and apply combat for one tick.
 *
 * For EACH alive ship:
 *   - Count friendly ships (same owner) within attackRadius
 *   - Count enemy ships (different owner) within attackRadius
 *   - If enemies > friendlies → ship is marked for destruction
 *
 * All kills are applied simultaneously (not sequentially) so the order
 * of iteration does not affect the outcome.
 *
 * Ships near islands (`isCapturing === true`) participate in combat
 * exactly like any other ship — they can attack, be attacked, and
 * provide support to allies. `isCapturing` only affects capture progress
 * tracking, not combat.
 *
 * Modifies ships in-place (sets `alive=false`, `turnsToRevive=respawnDelay`).
 *
 * Combat examples:
 *   - 1v1  → both survive (1 friendly [self], 1 enemy — equal)
 *   - 2v1  → lone ship dies (1 friendly [self] vs 2 enemies)
 *   - 3v2  → the 2 die; the 3 survive
 *   - 2v2  → depends on relative positioning within each ship's radius
 *
 * @param ships   All ships in the game (mutated in-place)
 * @param config  Game config (uses `attackRadius` and `respawnDelay`)
 */
export function resolveCombat(ships: Ship[], config: GameConfig): void {
  const { attackRadius, respawnDelay, combatKillDelay } = config;
  const alive = ships.filter((s) => s.alive);
  const toKill = new Set<number>();

  for (const ship of alive) {
    // Count self as a friendly — equal numbers means survival
    let friendliesInRadius = 1; // self
    let enemiesInRadius = 0;

    for (const other of alive) {
      if (other.id === ship.id) continue;
      if (distanceTo(ship, other) > attackRadius) continue;

      if (other.owner === ship.owner) {
        friendliesInRadius++;
      } else {
        enemiesInRadius++;
      }
    }

    if (enemiesInRadius > friendliesInRadius) {
      ship.combatPressure++;
      if (ship.combatPressure >= combatKillDelay) {
        toKill.add(ship.id);
      }
    } else {
      ship.combatPressure = 0;
    }
  }

  // Apply all kills simultaneously
  for (const ship of ships) {
    if (toKill.has(ship.id)) {
      ship.alive = false;
      ship.turnsToRevive = respawnDelay;
      ship.combatPressure = 0;
    }
  }
}

// ─────────────────────────────────────────────
// Respawn Processing
// ─────────────────────────────────────────────

/**
 * Tick down respawn counters and revive ships whose timer has reached 0.
 * Revived ships are placed back at their fixed initial (spawn) position.
 *
 * @param ships  All ships (mutated in-place; dead ships have `turnsToRevive` decremented)
 */
export function processRespawns(ships: Ship[]): void {
  for (const ship of ships) {
    if (ship.alive || ship.turnsToRevive <= 0) continue;

    ship.turnsToRevive--;
    if (ship.turnsToRevive === 0) {
      ship.alive = true;
      ship.x = ship.initialX;
      ship.y = ship.initialY;
      ship.isCapturing = false;
      ship.combatPressure = 0;
    }
  }
}

// ─────────────────────────────────────────────
// Debug / Analysis
// ─────────────────────────────────────────────

/**
 * Returns a breakdown of combat stats for each alive ship.
 * Useful for debugging bot behaviour and visualising threat levels.
 * All alive ships participate — `isCapturing` does not exempt from combat.
 *
 * @param ships   All ships in the game
 * @param config  Game config (uses `attackRadius`)
 * @returns       One entry per alive ship with friendly/enemy counts and death prediction
 */
export function getCombatStats(
  ships: Ship[],
  config: GameConfig,
): Array<{
  shipId: number;
  owner: string;
  friendliesInRadius: number;
  enemiesInRadius: number;
  wouldDie: boolean;
  combatPressure: number;
}> {
  const { attackRadius } = config;
  const alive = ships.filter((s) => s.alive);

  return alive.map((ship) => {
    let friendliesInRadius = 1; // self
    let enemiesInRadius = 0;

    for (const other of alive) {
      if (other.id === ship.id) continue;
      if (distanceTo(ship, other) > attackRadius) continue;
      if (other.owner === ship.owner) {
        friendliesInRadius++;
      } else {
        enemiesInRadius++;
      }
    }

    return {
      shipId: ship.id,
      owner: ship.owner,
      friendliesInRadius,
      enemiesInRadius,
      wouldDie: enemiesInRadius > friendliesInRadius,
      combatPressure: ship.combatPressure,
    };
  });
}
