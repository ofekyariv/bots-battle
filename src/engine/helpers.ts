// ============================================================
// 🏴‍☠️ Bots Battle — Bot Helper Functions
// ============================================================
//
// These functions are injected into bot scope at runtime so players
// can call them from their tick() implementations without imports.
//
// All helpers are pure (no side effects) and operate on the
// bot-facing types (BotShip, BotIsland) that arrive in tick().
// ============================================================

import type { BotIsland, BotOwner, BotShip } from './types';

// ─────────────────────────────────────────────
// Geometry utilities
// ─────────────────────────────────────────────

/**
 * Euclidean distance between two {x, y} points.
 *
 * @param a  First point (any `{x, y}` object: Ship, Island, coordinate literal, …)
 * @param b  Second point
 * @returns  The straight-line distance in map units
 *
 * @example
 * distanceTo(ship, island)  // → 142.8
 */
export function distanceTo(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Angle in radians from `from` to `to`.
 * 0 = right, π/2 = down, -π/2 = up, π = left.
 *
 * @param from  Starting point
 * @param to    Destination point
 * @returns     Angle in radians in the range `[-π, π]`
 *
 * @example
 * const angle = angleTo(ship, target);
 * const vx = Math.cos(angle) * speed;
 * const vy = Math.sin(angle) * speed;
 */
export function angleTo(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Squared Euclidean distance — cheaper than {@link distanceTo} when you only
 * need to compare distances (avoids the sqrt).
 *
 * @param a  First point
 * @param b  Second point
 * @returns  `dx² + dy²` — compare against `radius²` instead of `radius`
 *
 * @example
 * if (distanceToSq(ship, enemy) < attackRadius * attackRadius) { ... }
 */
export function distanceToSq(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// ─────────────────────────────────────────────
// Island helpers
// ─────────────────────────────────────────────

/**
 * Returns the nearest island to a ship (or any `{x,y}` point).
 *
 * @param ship     Reference position
 * @param islands  Candidate islands (pass a filtered subset to narrow results)
 * @returns        The closest island by Euclidean distance, or `null` if the array is empty
 *
 * @example
 * const target = nearestIsland(ship, state.islands);
 * if (target) return { type: 'move', target };
 */
export function nearestIsland(
  ship: { x: number; y: number },
  islands: BotIsland[],
): BotIsland | null {
  if (islands.length === 0) return null;
  return islands.reduce((best, island) =>
    distanceTo(ship, island) < distanceTo(ship, best) ? island : best,
  );
}

/**
 * Filter islands by owner from this bot's perspective.
 *
 * @param islands  The islands array from `GameState`
 * @param owner    `"me"` | `"enemy"` | `"neutral"`
 * @returns        All islands matching the given owner
 *
 * @example
 * const mine    = islandsOwnedBy(state.islands, "me");
 * const neutral = islandsOwnedBy(state.islands, "neutral");
 * const notMine = [...islandsOwnedBy(state.islands, "enemy"),
 *                  ...islandsOwnedBy(state.islands, "neutral")];
 */
export function islandsOwnedBy(islands: BotIsland[], owner: BotOwner): BotIsland[] {
  return islands.filter((i) => i.owner === owner);
}

/**
 * Islands that are NOT owned by this bot (enemy + neutral).
 * Useful for "capture nearest uncaptured island" strategies.
 *
 * @param islands  The islands array from `GameState`
 * @returns        All islands with `owner !== "me"`
 *
 * @example
 * const targets = islandsNotMine(state.islands);
 * const nearest = nearestIsland(ship, targets);
 * if (nearest) return { type: 'move', target: nearest };
 */
export function islandsNotMine(islands: BotIsland[]): BotIsland[] {
  return islands.filter((i) => i.owner !== 'me');
}

/**
 * Returns the nearest island that matches `owner`.
 * Returns `null` if no such island exists.
 *
 * @param ship     The ship (or any `{x,y}` point) to measure from
 * @param islands  All islands from `GameState`
 * @param owner    `"me"` | `"enemy"` | `"neutral"`
 * @returns        The closest matching island, or `null`
 *
 * @example
 * // Rush the nearest neutral island
 * const neutral = nearestIslandOwnedBy(ship, state.islands, "neutral");
 * if (neutral) return { type: 'move', target: neutral };
 *
 * @example
 * // Defend: head back toward my nearest owned island if I'm far from it
 * const mine = nearestIslandOwnedBy(ship, state.islands, "me");
 * if (mine && distanceTo(ship, mine) > 200) return { type: 'move', target: mine };
 */
export function nearestIslandOwnedBy(
  ship: { x: number; y: number },
  islands: BotIsland[],
  owner: BotOwner,
): BotIsland | null {
  return nearestIsland(ship, islandsOwnedBy(islands, owner));
}

// ─────────────────────────────────────────────
// Ship helpers
// ─────────────────────────────────────────────

/**
 * Returns the nearest alive enemy ship to `ship`.
 *
 * @param ship     Reference position (typically your ship)
 * @param enemies  Enemy ships array (typically `state.enemyShips`)
 * @returns        The closest alive enemy, or `null` if no enemies are alive
 *
 * @example
 * const threat = nearestEnemy(ship, state.enemyShips);
 * if (threat && distanceTo(ship, threat) < 200) { ... }
 */
export function nearestEnemy(ship: { x: number; y: number }, enemies: BotShip[]): BotShip | null {
  const alive = enemies.filter((e) => e.alive);
  if (alive.length === 0) return null;
  return alive.reduce((best, enemy) =>
    distanceTo(ship, enemy) < distanceTo(ship, best) ? enemy : best,
  );
}

/**
 * Returns all alive ships whose centres are within `radius` of `point`.
 *
 * @param point   Reference position (island center, ship position, etc.)
 * @param ships   Ships to test (dead ships are excluded)
 * @param radius  Maximum inclusive distance
 * @returns       Alive ships within the given radius
 *
 * @example
 * const nearby = shipsNear(island, state.enemyShips, island.radius);
 * // How many enemies are threatening this island?
 */
export function shipsNear(
  point: { x: number; y: number },
  ships: BotShip[],
  radius: number,
): BotShip[] {
  return ships.filter((s) => s.alive && distanceTo(point, s) <= radius);
}

/**
 * Returns alive ships sorted by distance from `point` (nearest first).
 *
 * @param point  Reference position
 * @param ships  Ships to sort (dead ships are excluded)
 * @returns      A new array of alive ships sorted nearest → furthest
 *
 * @example
 * // Find the three closest enemies to intercept
 * const closest = shipsSortedByDistance(ship, state.enemyShips).slice(0, 3);
 */
export function shipsSortedByDistance(
  point: { x: number; y: number },
  ships: BotShip[],
): BotShip[] {
  return ships
    .filter((s) => s.alive)
    .slice()
    .sort((a, b) => distanceTo(point, a) - distanceTo(point, b));
}

/**
 * Returns alive ships that are NOT currently within an island's capture radius.
 * Useful for knowing which ships can be freely redirected elsewhere.
 *
 * Note: ships on islands (`isCapturing === true`) CAN fight — they are full
 * combat participants. `freeShips()` is for strategic routing, not combat.
 *
 * @param ships  Ships to filter (typically `state.myShips`)
 * @returns      Alive ships not currently on any island
 *
 * @example
 * // Only redirect ships that aren't busy capturing
 * const available = freeShips(state.myShips);
 * const target = nearestIslandOwnedBy(ship, state.islands, "neutral");
 * for (const s of available) {
 *   if (target) commands[s.id] = { type: 'move', target };
 * }
 */
export function freeShips(ships: BotShip[]): BotShip[] {
  return ships.filter((s) => s.alive && !s.isCapturing);
}

// ─────────────────────────────────────────────
// Combat helpers
// ─────────────────────────────────────────────

/**
 * Predicts whether a ship would be destroyed if it moved to `position`.
 *
 * Uses the per-ship radius evaluation rule:
 *   `enemiesInRadius > friendliesInRadius` → destroyed
 *
 * All alive ships count — including those on islands (`isCapturing` ships
 * participate in combat normally).
 *
 * @param position     Where the ship would be
 * @param myShips      All of my alive ships (exclude the ship being tested to avoid self-count)
 * @param enemyShips   All enemy alive ships
 * @param attackRadius The global attack radius from `state.config.attackRadius`
 * @returns            `true` if the ship would be outnumbered and destroyed at that position
 *
 * @example
 * // Avoid moving into danger
 * const r = state.config.attackRadius;
 * const others = state.myShips.filter(s => s.id !== ship.id);
 * if (!wouldDieAt(island, others, state.enemyShips, r)) {
 *   return { type: 'move', target: island };
 * }
 */
export function wouldDieAt(
  position: { x: number; y: number },
  myShips: BotShip[],
  enemyShips: BotShip[],
  attackRadius: number,
): boolean {
  const friendlies = myShips.filter(
    (s) => s.alive && distanceTo(position, s) <= attackRadius,
  ).length;
  const enemies = enemyShips.filter(
    (s) => s.alive && distanceTo(position, s) <= attackRadius,
  ).length;
  return enemies > friendlies;
}

/**
 * How many of `ships` are alive?
 * Pass `excludeCapturing = true` to count only ships NOT within an island
 * radius (useful for knowing how many ships can be redirected).
 *
 * Note: `excludeCapturing` does NOT imply non-combat — all alive ships
 * participate in combat regardless of their capture status.
 *
 * @param ships            Ships to count
 * @param excludeCapturing If `true`, exclude ships currently on an island
 * @returns                Number of alive (and optionally free) ships
 *
 * @example
 * const totalAlive = aliveCount(state.myShips);       // → e.g. 6
 * const freeCount  = aliveCount(state.myShips, true); // → ships not on islands
 *
 * @example
 * // If we're outnumbered in free ships, retreat
 * if (aliveCount(state.myShips, true) < aliveCount(state.enemyShips, true)) {
 *   return { type: 'move', target: { x: ship.initialX, y: ship.initialY } };
 * }
 */
export function aliveCount(ships: BotShip[], excludeCapturing = false): number {
  return ships.filter((s) => s.alive && (!excludeCapturing || !s.isCapturing)).length;
}

// ─────────────────────────────────────────────
// Scoring helpers
// ─────────────────────────────────────────────

/**
 * Points per tick for a given total island value held.
 * Mirrors the engine's exponential formula: `2^(totalValue - 1)`.
 *
 * @param totalValue  Sum of `island.value` for all owned islands
 * @returns           Points earned per tick (`0` when no islands are held)
 *
 * @example
 * const myIslands = islandsOwnedBy(state.islands, "me");
 * const totalValue = myIslands.reduce((s, i) => s + i.value, 0);
 * const pts = scoreRate(totalValue);  // e.g. 4 for 3 normal islands
 */
export function scoreRate(totalValue: number): number {
  if (totalValue <= 0) return 0;
  return Math.pow(2, totalValue - 1);
}

// ─────────────────────────────────────────────
// Re-export the full helpers object
// (used by botSandbox to inject into Worker scope)
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// Command shorthand helpers
// ─────────────────────────────────────────────

/**
 * Shorthand for `{ type: 'idle' }`.
 *
 * @returns An idle command
 *
 * @example
 * if (!ship.alive) return idle();
 */
export function idle(): { type: 'idle' } {
  return { type: 'idle' };
}

/**
 * Shorthand for `{ type: 'move', target: { x, y } }`.
 *
 * @param x  Target X coordinate
 * @param y  Target Y coordinate
 * @returns  A move command toward (x, y)
 *
 * @example
 * return move(island.x, island.y);
 */
export function move(x: number, y: number): { type: 'move'; target: { x: number; y: number } } {
  return { type: 'move', target: { x, y } };
}

// ─────────────────────────────────────────────
// Re-export the full helpers object
// (used by botSandbox to inject into Worker scope)
// ─────────────────────────────────────────────

export const BOT_HELPERS = {
  distanceTo,
  distanceToSq,
  angleTo,
  nearestIsland,
  nearestIslandOwnedBy,
  islandsOwnedBy,
  islandsNotMine,
  nearestEnemy,
  shipsNear,
  shipsSortedByDistance,
  freeShips,
  wouldDieAt,
  aliveCount,
  scoreRate,
  idle,
  move,
} as const;

export type BotHelpers = typeof BOT_HELPERS;
