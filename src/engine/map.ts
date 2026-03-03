// ============================================================
// 🏴‍☠️ Bots Battle — Map Generation
// ============================================================
//
// Responsibilities:
//   1. Place `numIslands` islands randomly with minimum spacing
//   2. Keep islands out of player safe zones
//   3. Keep islands away from map edges
//   4. Calculate per-player spawn points (evenly distributed inside
//      their safe zone)
//
// All functions are pure (no side effects). Seed via your own PRNG
// if you need deterministic maps (e.g. for replays).
// ============================================================

import type { GameConfig, Island, MapData, Owner, SpawnPoint } from './types';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Minimum island-to-edge margin as a fraction of captureRadius */
const EDGE_MARGIN_FACTOR = 3.5;

/** Minimum island-to-island spacing as a multiple of captureRadius */
const MIN_SPACING_FACTOR = 3;

/** How many placement attempts before giving up on an island */
const MAX_ATTEMPTS_PER_ISLAND = 2000;

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Generate a complete map: islands + spawn points.
 *
 * Islands are placed randomly in the central "playable" area
 * (excluding safe zones and edge margins). Minimum spacing between
 * islands is enforced to prevent crowding.
 *
 * Spawn points are evenly distributed vertically within each
 * player's safe zone.
 *
 * @param config  Full game config (must include numIslands, mapWidth, etc.)
 * @returns       MapData with islands[] and spawnPoints[]
 */
export function generateMap(config: GameConfig): MapData {
  const islands = generateIslands(config);
  const spawnPoints = generateSpawnPoints(config);
  return { islands, spawnPoints };
}

/**
 * Generate islands only (without spawn points).
 * Useful when you need to regenerate the map mid-session.
 *
 * Islands are placed **symmetrically** around the horizontal center line
 * (`y = mapHeight / 2`) so both players (top vs bottom) face an identical
 * strategic layout — fair for competitive play.
 *
 * Strategy:
 *   - If `numIslands` is even: place N/2 islands in the top half, mirror each
 *     one to the bottom half at `(x, mapHeight - y)`.
 *   - If `numIslands` is odd: place `(N-1)/2` mirrored pairs + one island on the
 *     center line (`y = mapHeight / 2`).
 *
 * @param config  Full game config
 * @returns       Array of islands with `owner: "neutral"` and `captureProgress: 0`
 */
export function generateIslands(config: GameConfig): Island[] {
  const {
    mapWidth,
    mapHeight,
    numIslands,
    captureRadius,
    safeZoneWidth,
    islandEdgeMargin = 150,
  } = config;

  // Effective edge margin: the larger of the capture-radius-based margin
  // and the explicit islandEdgeMargin config value. Clamped so that at least
  // 30% of the map height remains playable.
  const captureBasedMargin = captureRadius * EDGE_MARGIN_FACTOR;
  const maxEdgeMargin = mapHeight * 0.25;
  const effectiveEdgeMargin = Math.min(Math.max(captureBasedMargin, islandEdgeMargin), maxEdgeMargin);

  const minSpacing = captureRadius * MIN_SPACING_FACTOR;

  // Playable X range: edge margin on left/right.
  const xMin = effectiveEdgeMargin;
  const xMax = mapWidth - effectiveEdgeMargin;

  // Playable Y range: keep islands out of safe zones (top/bottom) AND beyond edge margin.
  const yMin = Math.max(effectiveEdgeMargin, safeZoneWidth);
  const yMax = mapHeight - Math.max(effectiveEdgeMargin, safeZoneWidth);
  const yCenter = mapHeight / 2;

  const playableWidth = xMax - xMin;
  const playableHeight = yMax - yMin;

  if (playableWidth <= 0 || playableHeight <= 0) {
    console.warn(
      '[map] Playable area is too small for current config — placing islands without constraints',
    );
    return generateIslandsFallback(config);
  }

  const islands: Island[] = [];
  const hasCenter = numIslands % 2 === 1;
  const numPairs = Math.floor(numIslands / 2);

  // ── 1. Place mirrored pairs in top half ───────────────────────────────
  // Top half Y range: [yMin, yCenter - minSpacing/2]
  // Pulled back by minSpacing/2 so the mirrored island also clears the center.
  const topYMax = yCenter - minSpacing / 2;
  const topPlayableHeight = topYMax - yMin;

  if (topPlayableHeight > 0) {
    let pairAttempts = 0;
    while (islands.length < numPairs * 2 && pairAttempts < MAX_ATTEMPTS_PER_ISLAND * numPairs) {
      pairAttempts++;

      const x = xMin + Math.random() * playableWidth;
      const y = yMin + Math.random() * topPlayableHeight;

      // Candidate mirror on the bottom side
      const mirrorY = mapHeight - y;

      // Ensure both the candidate and its mirror clear all already-placed islands
      if (!hasMinSpacing(x, y, islands, minSpacing)) continue;
      if (!hasMinSpacing(x, mirrorY, islands, minSpacing)) continue;

      // Place top island then its mirror
      islands.push(makeIsland(islands.length, x, y, config));
      islands.push(makeIsland(islands.length, x, mirrorY, config));
    }

    if (islands.length < numPairs * 2) {
      console.warn(
        `[map] Could only place ${islands.length / 2}/${numPairs} island pairs with ` +
          `minSpacing=${minSpacing.toFixed(0)}. Consider reducing numIslands or captureRadius.`,
      );
    }
  }

  // ── 2. Place single center island (for odd numIslands) ────────────────
  if (hasCenter) {
    let centerAttempts = 0;
    let placed = false;
    while (!placed && centerAttempts < MAX_ATTEMPTS_PER_ISLAND) {
      centerAttempts++;
      const x = xMin + Math.random() * playableWidth;
      if (hasMinSpacing(x, yCenter, islands, minSpacing)) {
        islands.push(makeIsland(islands.length, x, yCenter, config));
        placed = true;
      }
    }
    if (!placed) {
      console.warn('[map] Could not place center island — map may be too crowded.');
    }
  }

  return islands;
}

/**
 * Generate spawn points for both players.
 *
 * Player 1 spawns on the BOTTOM side (y = mapHeight - safeZoneWidth / 2).
 * Player 2 spawns on the TOP side (y = safeZoneWidth / 2).
 * Ships are distributed evenly across the map width.
 *
 * @returns SpawnPoint array ordered: all player1 first, then player2
 */
export function generateSpawnPoints(config: GameConfig): SpawnPoint[] {
  const { mapWidth, mapHeight, shipsPerPlayer, safeZoneWidth } = config;
  const points: SpawnPoint[] = [];

  const p1Y = mapHeight - safeZoneWidth / 2;
  const p2Y = safeZoneWidth / 2;

  for (let i = 0; i < shipsPerPlayer; i++) {
    // Distribute ships evenly across the full width with equal margins
    const x = (mapWidth / shipsPerPlayer) * (i + 0.5);

    points.push({ owner: 'player1', x, y: p1Y });
    points.push({ owner: 'player2', x, y: p2Y });
  }

  return points;
}

// ─────────────────────────────────────────────
// Safe zone queries (used by engine to enforce boundaries)
// ─────────────────────────────────────────────

/**
 * Is the given Y coordinate inside player 1's safe zone?
 * Player 1 safe zone: `y > mapHeight - safeZoneWidth` (bottom side).
 *
 * @param y       The Y coordinate to test
 * @param config  Game config (uses `mapHeight` and `safeZoneWidth`)
 * @returns       `true` if the coordinate is in player 1's protected zone
 */
export function isInP1SafeZone(y: number, config: GameConfig): boolean {
  return y > config.mapHeight - config.safeZoneWidth;
}

/**
 * Is the given Y coordinate inside player 2's safe zone?
 * Player 2 safe zone: `y < safeZoneWidth` (top side).
 *
 * @param y       The Y coordinate to test
 * @param config  Game config (uses `safeZoneWidth`)
 * @returns       `true` if the coordinate is in player 2's protected zone
 */
export function isInP2SafeZone(y: number, config: GameConfig): boolean {
  return y < config.safeZoneWidth;
}

/**
 * Clamp a position to stay within the map bounding box `[0, mapWidth] × [0, mapHeight]`.
 * Does NOT account for safe zones — use {@link isInP1SafeZone} / {@link isInP2SafeZone} for that.
 *
 * @param x       Unclamped X position
 * @param y       Unclamped Y position
 * @param config  Game config (uses `mapWidth` and `mapHeight`)
 * @returns       The position clamped to the map boundary
 */
export function clampToMap(x: number, y: number, config: GameConfig): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(config.mapWidth, x)),
    y: Math.max(0, Math.min(config.mapHeight, y)),
  };
}

/**
 * Is `(x, y)` a valid, passable position for a ship owned by `owner`?
 *
 * Returns `false` if:
 * - The position is outside the map boundaries, OR
 * - The ship is player 2 and would enter player 1's safe zone, OR
 * - The ship is player 1 and would enter player 2's safe zone
 *
 * @param x       Target X position
 * @param y       Target Y position
 * @param owner   The player who owns the ship being moved
 * @param config  Game config (uses `mapWidth`, `mapHeight`, `safeZoneWidth`)
 * @returns       `true` if the position is valid and reachable for this ship
 */
export function isPassableFor(x: number, y: number, owner: Owner, config: GameConfig): boolean {
  if (x < 0 || x > config.mapWidth) return false;
  if (y < 0 || y > config.mapHeight) return false;
  if (owner === 'player2' && isInP1SafeZone(y, config)) return false;
  if (owner === 'player1' && isInP2SafeZone(y, config)) return false;
  return true;
}

// ─────────────────────────────────────────────
// Private helpers
// ─────────────────────────────────────────────

function makeIsland(id: number, x: number, y: number, config: GameConfig): Island {
  return {
    id,
    x,
    y,
    radius: config.captureRadius,
    owner: 'neutral',
    teamCapturing: 'none',
    captureProgress: 0,
    captureTurns: config.captureTurns,
    value: 1,
  };
}

/** True if (x, y) is at least `minSpacing` from every existing island */
function hasMinSpacing(x: number, y: number, existing: Island[], minSpacing: number): boolean {
  const minSq = minSpacing * minSpacing;
  for (const island of existing) {
    const dx = island.x - x;
    const dy = island.y - y;
    if (dx * dx + dy * dy < minSq) return false;
  }
  return true;
}

/**
 * Fallback: place islands anywhere on the map when the playable area
 * is too small for proper spacing. Used for extreme configs.
 */
function generateIslandsFallback(config: GameConfig): Island[] {
  const { mapWidth, mapHeight, numIslands } = config;
  const islands: Island[] = [];
  for (let i = 0; i < numIslands; i++) {
    islands.push(
      makeIsland(
        i,
        50 + Math.random() * (mapWidth - 100),
        50 + Math.random() * (mapHeight - 100),
        config,
      ),
    );
  }
  return islands;
}
