// ============================================================
// 🏴☠️ Bots Battle — Language Helper Signatures
// Derived from engine/helpers.ts BOT_HELPERS — canonical list
// ============================================================
//
// This file defines per-language native signatures for all 14
// helper functions. Add a new helper to BOT_HELPERS? Add it here too.
// ============================================================

import { BOT_HELPERS } from '@/engine/helpers';
import type { HelperName, HelperSignature, LanguageId } from './types';

// ─────────────────────────────────────────────
// Canonical helper names — derived from BOT_HELPERS keys
// ─────────────────────────────────────────────

export const CANONICAL_HELPERS = Object.keys(BOT_HELPERS) as HelperName[];

// ─────────────────────────────────────────────
// Helper signature definitions per language
// ─────────────────────────────────────────────

type HelperDefs = Record<HelperName, Omit<HelperSignature, 'canonicalName'>>;

const JS_TS_HELPERS: HelperDefs = {
  distanceTo: {
    signature: 'distanceTo(a, b)',
    description: 'Euclidean distance between two {x,y} points.',
    returnType: 'number',
    example: 'const d = distanceTo(ship, island);',
  },
  distanceToSq: {
    signature: 'distanceToSq(a, b)',
    description: 'Squared distance — cheaper than distanceTo for comparisons.',
    returnType: 'number',
    example: 'if (distanceToSq(ship, enemy) < r * r) { ... }',
  },
  angleTo: {
    signature: 'angleTo(from, to)',
    description: 'Angle in radians from point to point (0=right, π/2=down).',
    returnType: 'number',
    example: 'const angle = angleTo(ship, target);',
  },
  nearestIsland: {
    signature: 'nearestIsland(ship, islands)',
    description: 'Nearest island to a position.',
    returnType: 'BotIsland | null',
    example: 'const t = nearestIsland(ship, state.islands);',
  },
  nearestIslandOwnedBy: {
    signature: 'nearestIslandOwnedBy(ship, islands, owner)',
    description: 'Nearest island matching owner ("me"|"enemy"|"neutral").',
    returnType: 'BotIsland | null',
    example: 'const n = nearestIslandOwnedBy(ship, state.islands, "neutral");',
  },
  islandsOwnedBy: {
    signature: 'islandsOwnedBy(islands, owner)',
    description: 'Filter islands by owner.',
    returnType: 'BotIsland[]',
    example: 'const mine = islandsOwnedBy(state.islands, "me");',
  },
  islandsNotMine: {
    signature: 'islandsNotMine(islands)',
    description: 'All islands NOT owned by me (enemy + neutral).',
    returnType: 'BotIsland[]',
    example: 'const targets = islandsNotMine(state.islands);',
  },
  nearestEnemy: {
    signature: 'nearestEnemy(ship, enemies)',
    description: 'Nearest alive enemy ship.',
    returnType: 'BotShip | null',
    example: 'const threat = nearestEnemy(ship, state.enemyShips);',
  },
  shipsNear: {
    signature: 'shipsNear(point, ships, radius)',
    description: 'All alive ships within radius of point.',
    returnType: 'BotShip[]',
    example: 'const nearby = shipsNear(island, state.enemyShips, island.radius);',
  },
  shipsSortedByDistance: {
    signature: 'shipsSortedByDistance(point, ships)',
    description: 'Alive ships sorted nearest→furthest.',
    returnType: 'BotShip[]',
    example: 'const closest = shipsSortedByDistance(ship, state.enemyShips)[0];',
  },
  freeShips: {
    signature: 'freeShips(ships)',
    description: 'Alive ships not currently capturing an island.',
    returnType: 'BotShip[]',
    example: 'const available = freeShips(state.myShips);',
  },
  wouldDieAt: {
    signature: 'wouldDieAt(position, myShips, enemyShips, attackRadius)',
    description: 'Predicts if moving to position would get the ship destroyed.',
    returnType: 'boolean',
    example: 'if (!wouldDieAt(island, others, state.enemyShips, r)) { ... }',
  },
  aliveCount: {
    signature: 'aliveCount(ships, excludeCapturing?)',
    description: 'Count alive ships. Pass true to exclude ships on islands.',
    returnType: 'number',
    example: 'const alive = aliveCount(state.myShips);',
  },
  scoreRate: {
    signature: 'scoreRate(totalValue)',
    description: 'Points per tick for a given total island value (2^(v-1)).',
    returnType: 'number',
    example: 'const rate = scoreRate(myIslands.reduce((s,i) => s+i.value, 0));',
  },
  idle: {
    signature: 'idle()',
    description: 'Shorthand for { type: "idle" }.',
    returnType: 'Command',
    example: 'return idle();',
  },
  move: {
    signature: 'move(x, y)',
    description: 'Shorthand for { type: "move", target: { x, y } }.',
    returnType: 'Command',
    example: 'return move(island.x, island.y);',
  },
};

const PYTHON_HELPERS: HelperDefs = {
  distanceTo: {
    signature: 'distance_to(a, b)',
    description: 'Euclidean distance between two {x,y} objects.',
    returnType: 'float',
    example: 'd = distance_to(ship, island)',
  },
  distanceToSq: {
    signature: 'distance_to_sq(a, b)',
    description: 'Squared distance — cheaper for comparisons.',
    returnType: 'float',
    example: 'if distance_to_sq(ship, enemy) < r * r: ...',
  },
  angleTo: {
    signature: 'angle_to(from_, to)',
    description: 'Angle in radians from point to point.',
    returnType: 'float',
    example: 'angle = angle_to(ship, target)',
  },
  nearestIsland: {
    signature: 'nearest_island(ship, islands)',
    description: 'Nearest island to a position.',
    returnType: 'Island | None',
    example: 't = nearest_island(ship, state.islands)',
  },
  nearestIslandOwnedBy: {
    signature: 'nearest_island_owned_by(ship, islands, owner)',
    description: 'Nearest island matching owner ("me"|"enemy"|"neutral").',
    returnType: 'Island | None',
    example: 'n = nearest_island_owned_by(ship, state.islands, "neutral")',
  },
  islandsOwnedBy: {
    signature: 'islands_owned_by(islands, owner)',
    description: 'Filter islands by owner.',
    returnType: 'list[Island]',
    example: 'mine = islands_owned_by(state.islands, "me")',
  },
  islandsNotMine: {
    signature: 'islands_not_mine(islands)',
    description: 'All islands NOT owned by me.',
    returnType: 'list[Island]',
    example: 'targets = islands_not_mine(state.islands)',
  },
  nearestEnemy: {
    signature: 'nearest_enemy(ship, enemies)',
    description: 'Nearest alive enemy ship.',
    returnType: 'Ship | None',
    example: 'threat = nearest_enemy(ship, state.enemyShips)',
  },
  shipsNear: {
    signature: 'ships_near(point, ships, radius)',
    description: 'All alive ships within radius of point.',
    returnType: 'list[Ship]',
    example: 'nearby = ships_near(island, state.enemyShips, island.radius)',
  },
  shipsSortedByDistance: {
    signature: 'ships_sorted_by_distance(point, ships)',
    description: 'Alive ships sorted nearest→furthest.',
    returnType: 'list[Ship]',
    example: 'closest = ships_sorted_by_distance(ship, state.enemyShips)[0]',
  },
  freeShips: {
    signature: 'free_ships(ships)',
    description: 'Alive ships not currently capturing an island.',
    returnType: 'list[Ship]',
    example: 'available = free_ships(state.myShips)',
  },
  wouldDieAt: {
    signature: 'would_die_at(position, my_ships, enemy_ships, attack_radius)',
    description: 'Predicts if moving to position would destroy the ship.',
    returnType: 'bool',
    example: 'if not would_die_at(island, others, state.enemyShips, r): ...',
  },
  aliveCount: {
    signature: 'alive_count(ships, exclude_capturing=False)',
    description: 'Count alive ships.',
    returnType: 'int',
    example: 'alive = alive_count(state.myShips)',
  },
  scoreRate: {
    signature: 'score_rate(total_value)',
    description: 'Points per tick for a given total island value.',
    returnType: 'float',
    example: 'rate = score_rate(sum(i.value for i in mine))',
  },
  idle: {
    signature: 'idle()',
    description: "Shorthand for {'type': 'idle'}.",
    returnType: 'dict',
    example: 'return idle()',
  },
  move: {
    signature: 'move(x, y)',
    description: "Shorthand for {'type': 'move', 'target': {'x': x, 'y': y}}.",
    returnType: 'dict',
    example: 'return move(island.x, island.y)',
  },
};

const KOTLIN_HELPERS: HelperDefs = {
  distanceTo: {
    signature: 'distanceTo(a: dynamic, b: dynamic): Double',
    description: 'Euclidean distance between two points.',
    returnType: 'Double',
    example: 'val d = distanceTo(ship, island)',
  },
  distanceToSq: {
    signature: 'distanceToSq(a: dynamic, b: dynamic): Double',
    description: 'Squared distance — cheaper for comparisons.',
    returnType: 'Double',
    example: 'if (distanceToSq(ship, enemy) < r * r) { ... }',
  },
  angleTo: {
    signature: 'angleTo(from: dynamic, to: dynamic): Double',
    description: 'Angle in radians from point to point.',
    returnType: 'Double',
    example: 'val angle = angleTo(ship, target)',
  },
  nearestIsland: {
    signature: 'nearestIsland(ship: dynamic, islands: dynamic): dynamic?',
    description: 'Nearest island to a position.',
    returnType: 'dynamic?',
    example: 'val t = nearestIsland(ship, state.islands)',
  },
  nearestIslandOwnedBy: {
    signature: 'nearestIslandOwnedBy(ship: dynamic, islands: dynamic, owner: String): dynamic?',
    description: 'Nearest island matching owner ("me"|"enemy"|"neutral").',
    returnType: 'dynamic?',
    example: 'val n = nearestIslandOwnedBy(ship, state.islands, "neutral")',
  },
  islandsOwnedBy: {
    signature: 'islandsOwnedBy(islands: dynamic, owner: String): List<dynamic>',
    description: 'Filter islands by owner.',
    returnType: 'List<dynamic>',
    example: 'val mine = islandsOwnedBy(state.islands, "me")',
  },
  islandsNotMine: {
    signature: 'islandsNotMine(islands: dynamic): List<dynamic>',
    description: 'All islands NOT owned by me.',
    returnType: 'List<dynamic>',
    example: 'val targets = islandsNotMine(state.islands)',
  },
  nearestEnemy: {
    signature: 'nearestEnemy(ship: dynamic, enemies: dynamic): dynamic?',
    description: 'Nearest alive enemy ship.',
    returnType: 'dynamic?',
    example: 'val threat = nearestEnemy(ship, state.enemyShips)',
  },
  shipsNear: {
    signature: 'shipsNear(point: dynamic, ships: dynamic, radius: Double): List<dynamic>',
    description: 'All alive ships within radius of point.',
    returnType: 'List<dynamic>',
    example: 'val nearby = shipsNear(island, state.enemyShips, island.radius as Double)',
  },
  shipsSortedByDistance: {
    signature: 'shipsSortedByDistance(point: dynamic, ships: dynamic): List<dynamic>',
    description: 'Alive ships sorted nearest→furthest.',
    returnType: 'List<dynamic>',
    example: 'val closest = shipsSortedByDistance(ship, state.enemyShips).firstOrNull()',
  },
  freeShips: {
    signature: 'freeShips(ships: dynamic): List<dynamic>',
    description: 'Alive ships not currently capturing an island.',
    returnType: 'List<dynamic>',
    example: 'val available = freeShips(state.myShips)',
  },
  wouldDieAt: {
    signature: 'wouldDieAt(position: dynamic, myShips: dynamic, enemyShips: dynamic, attackRadius: Double): Boolean',
    description: 'Predicts if moving to position would destroy the ship.',
    returnType: 'Boolean',
    example: 'if (!wouldDieAt(island, others, state.enemyShips, r)) { ... }',
  },
  aliveCount: {
    signature: 'aliveCount(ships: dynamic, excludeCapturing: Boolean = false): Int',
    description: 'Count alive ships.',
    returnType: 'Int',
    example: 'val alive = aliveCount(state.myShips)',
  },
  scoreRate: {
    signature: 'scoreRate(totalValue: Double): Double',
    description: 'Points per tick for a given total island value.',
    returnType: 'Double',
    example: 'val rate = scoreRate(mine.sumOf { it.value as Double })',
  },
  idle: {
    signature: 'idle(): dynamic',
    description: 'Shorthand for idle command.',
    returnType: 'dynamic',
    example: 'return idle()',
  },
  move: {
    signature: 'moveTo(x: Double, y: Double): dynamic',
    description: 'Shorthand for move command.',
    returnType: 'dynamic',
    example: 'return moveTo(island.x as Double, island.y as Double)',
  },
};

const JAVA_HELPERS: HelperDefs = {
  distanceTo: {
    signature: 'BotHelpers.distanceTo(Object a, Object b)',
    description: 'Euclidean distance between two points.',
    returnType: 'double',
    example: 'double d = BotHelpers.distanceTo(ship, island);',
  },
  distanceToSq: {
    signature: 'BotHelpers.distanceToSq(Object a, Object b)',
    description: 'Squared distance — cheaper for comparisons.',
    returnType: 'double',
    example: 'if (BotHelpers.distanceToSq(ship, enemy) < r * r) { ... }',
  },
  angleTo: {
    signature: 'BotHelpers.angleTo(Object from, Object to)',
    description: 'Angle in radians from point to point.',
    returnType: 'double',
    example: 'double angle = BotHelpers.angleTo(ship, target);',
  },
  nearestIsland: {
    signature: 'BotHelpers.nearestIsland(Object ship, List<Object> islands)',
    description: 'Nearest island to a position.',
    returnType: 'Object',
    example: 'Object t = BotHelpers.nearestIsland(ship, state.islands);',
  },
  nearestIslandOwnedBy: {
    signature: 'BotHelpers.nearestIslandOwnedBy(Object ship, List<Object> islands, String owner)',
    description: 'Nearest island matching owner ("me"|"enemy"|"neutral").',
    returnType: 'Object',
    example: 'Object n = BotHelpers.nearestIslandOwnedBy(ship, state.islands, "neutral");',
  },
  islandsOwnedBy: {
    signature: 'BotHelpers.islandsOwnedBy(List<Object> islands, String owner)',
    description: 'Filter islands by owner.',
    returnType: 'List<Object>',
    example: 'List<Object> mine = BotHelpers.islandsOwnedBy(state.islands, "me");',
  },
  islandsNotMine: {
    signature: 'BotHelpers.islandsNotMine(List<Object> islands)',
    description: 'All islands NOT owned by me.',
    returnType: 'List<Object>',
    example: 'List<Object> targets = BotHelpers.islandsNotMine(state.islands);',
  },
  nearestEnemy: {
    signature: 'BotHelpers.nearestEnemy(Object ship, List<Object> enemies)',
    description: 'Nearest alive enemy ship.',
    returnType: 'Object',
    example: 'Object threat = BotHelpers.nearestEnemy(ship, state.enemyShips);',
  },
  shipsNear: {
    signature: 'BotHelpers.shipsNear(Object point, List<Object> ships, double radius)',
    description: 'All alive ships within radius of point.',
    returnType: 'List<Object>',
    example: 'List<Object> nearby = BotHelpers.shipsNear(island, state.enemyShips, island.radius);',
  },
  shipsSortedByDistance: {
    signature: 'BotHelpers.shipsSortedByDistance(Object point, List<Object> ships)',
    description: 'Alive ships sorted nearest→furthest.',
    returnType: 'List<Object>',
    example: 'List<Object> sorted = BotHelpers.shipsSortedByDistance(ship, state.enemyShips);',
  },
  freeShips: {
    signature: 'BotHelpers.freeShips(List<Object> ships)',
    description: 'Alive ships not currently capturing an island.',
    returnType: 'List<Object>',
    example: 'List<Object> available = BotHelpers.freeShips(state.myShips);',
  },
  wouldDieAt: {
    signature: 'BotHelpers.wouldDieAt(Object position, List<Object> myShips, List<Object> enemyShips, double attackRadius)',
    description: 'Predicts if moving to position would destroy the ship.',
    returnType: 'boolean',
    example: 'if (!BotHelpers.wouldDieAt(island, others, state.enemyShips, r)) { ... }',
  },
  aliveCount: {
    signature: 'BotHelpers.aliveCount(List<Object> ships)',
    description: 'Count alive ships.',
    returnType: 'int',
    example: 'int alive = BotHelpers.aliveCount(state.myShips);',
  },
  scoreRate: {
    signature: 'BotHelpers.scoreRate(double totalValue)',
    description: 'Points per tick for a given total island value.',
    returnType: 'double',
    example: 'double rate = BotHelpers.scoreRate(totalValue);',
  },
  idle: {
    signature: 'idle()',
    description: 'Shorthand for idle command.',
    returnType: 'dynamic',
    example: 'return idle();',
  },
  move: {
    signature: 'move(double x, double y)',
    description: 'Shorthand for move command.',
    returnType: 'dynamic',
    example: 'return move(island.x, island.y);',
  },
};

const CSHARP_HELPERS: HelperDefs = {
  distanceTo: {
    signature: 'DistanceTo(dynamic a, dynamic b)',
    description: 'Euclidean distance between two points.',
    returnType: 'double',
    example: 'double d = DistanceTo(ship, island);',
  },
  distanceToSq: {
    signature: 'DistanceToSq(dynamic a, dynamic b)',
    description: 'Squared distance — cheaper for comparisons.',
    returnType: 'double',
    example: 'if (DistanceToSq(ship, enemy) < r * r) { ... }',
  },
  angleTo: {
    signature: 'AngleTo(dynamic from, dynamic to)',
    description: 'Angle in radians from point to point.',
    returnType: 'double',
    example: 'double angle = AngleTo(ship, target);',
  },
  nearestIsland: {
    signature: 'NearestIsland(dynamic ship, dynamic[] islands)',
    description: 'Nearest island to a position.',
    returnType: 'dynamic',
    example: 'dynamic t = NearestIsland(ship, state.Islands);',
  },
  nearestIslandOwnedBy: {
    signature: 'NearestIslandOwnedBy(dynamic ship, dynamic[] islands, string owner)',
    description: 'Nearest island matching owner ("me"|"enemy"|"neutral").',
    returnType: 'dynamic',
    example: 'dynamic n = NearestIslandOwnedBy(ship, state.Islands, "neutral");',
  },
  islandsOwnedBy: {
    signature: 'IslandsOwnedBy(dynamic[] islands, string owner)',
    description: 'Filter islands by owner.',
    returnType: 'dynamic[]',
    example: 'dynamic[] mine = IslandsOwnedBy(state.Islands, "me");',
  },
  islandsNotMine: {
    signature: 'IslandsNotMine(dynamic[] islands)',
    description: 'All islands NOT owned by me.',
    returnType: 'dynamic[]',
    example: 'dynamic[] targets = IslandsNotMine(state.Islands);',
  },
  nearestEnemy: {
    signature: 'NearestEnemy(dynamic ship, dynamic[] enemies)',
    description: 'Nearest alive enemy ship.',
    returnType: 'dynamic',
    example: 'dynamic threat = NearestEnemy(ship, state.EnemyShips);',
  },
  shipsNear: {
    signature: 'ShipsNear(dynamic point, dynamic[] ships, double radius)',
    description: 'All alive ships within radius of point.',
    returnType: 'dynamic[]',
    example: 'dynamic[] nearby = ShipsNear(island, state.EnemyShips, island.Radius);',
  },
  shipsSortedByDistance: {
    signature: 'ShipsSortedByDistance(dynamic point, dynamic[] ships)',
    description: 'Alive ships sorted nearest→furthest.',
    returnType: 'dynamic[]',
    example: 'dynamic[] sorted = ShipsSortedByDistance(ship, state.EnemyShips);',
  },
  freeShips: {
    signature: 'FreeShips(dynamic[] ships)',
    description: 'Alive ships not currently capturing an island.',
    returnType: 'dynamic[]',
    example: 'dynamic[] available = FreeShips(state.MyShips);',
  },
  wouldDieAt: {
    signature: 'WouldDieAt(dynamic position, dynamic[] myShips, dynamic[] enemyShips, double attackRadius)',
    description: 'Predicts if moving to position would destroy the ship.',
    returnType: 'bool',
    example: 'if (!WouldDieAt(island, others, state.EnemyShips, r)) { ... }',
  },
  aliveCount: {
    signature: 'AliveCount(dynamic[] ships, bool excludeCapturing = false)',
    description: 'Count alive ships.',
    returnType: 'int',
    example: 'int alive = AliveCount(state.MyShips);',
  },
  scoreRate: {
    signature: 'ScoreRate(double totalValue)',
    description: 'Points per tick for a given total island value.',
    returnType: 'double',
    example: 'double rate = ScoreRate(totalValue);',
  },
  idle: {
    signature: 'Idle()',
    description: 'Shorthand for idle command.',
    returnType: 'dynamic',
    example: 'return Idle();',
  },
  move: {
    signature: 'Move(double x, double y)',
    description: 'Shorthand for move command.',
    returnType: 'dynamic',
    example: 'return Move(island.X, island.Y);',
  },
};

const SWIFT_HELPERS: HelperDefs = {
  distanceTo: {
    signature: 'distanceTo(_ a: [String: Any], _ b: [String: Any]) -> Double',
    description: 'Euclidean distance between two points.',
    returnType: 'Double',
    example: 'let d = distanceTo(ship, island)',
  },
  distanceToSq: {
    signature: 'distanceToSq(_ a: [String: Any], _ b: [String: Any]) -> Double',
    description: 'Squared distance — cheaper for comparisons.',
    returnType: 'Double',
    example: 'if distanceToSq(ship, enemy) < r * r { ... }',
  },
  angleTo: {
    signature: 'angleTo(from: [String: Any], to: [String: Any]) -> Double',
    description: 'Angle in radians from point to point.',
    returnType: 'Double',
    example: 'let angle = angleTo(from: ship, to: target)',
  },
  nearestIsland: {
    signature: 'nearestIsland(_ ship: [String: Any], _ islands: [[String: Any]]) -> [String: Any]?',
    description: 'Nearest island to a position.',
    returnType: '[String: Any]?',
    example: 'let t = nearestIsland(ship, state.islands)',
  },
  nearestIslandOwnedBy: {
    signature: 'nearestIslandOwnedBy(_ ship: [String: Any], _ islands: [[String: Any]], owner: String) -> [String: Any]?',
    description: 'Nearest island matching owner ("me"|"enemy"|"neutral").',
    returnType: '[String: Any]?',
    example: 'let n = nearestIslandOwnedBy(ship, state.islands, owner: "neutral")',
  },
  islandsOwnedBy: {
    signature: 'islandsOwnedBy(_ islands: [[String: Any]], owner: String) -> [[String: Any]]',
    description: 'Filter islands by owner.',
    returnType: '[[String: Any]]',
    example: 'let mine = islandsOwnedBy(state.islands, owner: "me")',
  },
  islandsNotMine: {
    signature: 'islandsNotMine(_ islands: [[String: Any]]) -> [[String: Any]]',
    description: 'All islands NOT owned by me.',
    returnType: '[[String: Any]]',
    example: 'let targets = islandsNotMine(state.islands)',
  },
  nearestEnemy: {
    signature: 'nearestEnemy(_ ship: [String: Any], _ enemies: [[String: Any]]) -> [String: Any]?',
    description: 'Nearest alive enemy ship.',
    returnType: '[String: Any]?',
    example: 'let threat = nearestEnemy(ship, state.enemyShips)',
  },
  shipsNear: {
    signature: 'shipsNear(_ point: [String: Any], _ ships: [[String: Any]], radius: Double) -> [[String: Any]]',
    description: 'All alive ships within radius of point.',
    returnType: '[[String: Any]]',
    example: 'let nearby = shipsNear(island, state.enemyShips, radius: island.radius)',
  },
  shipsSortedByDistance: {
    signature: 'shipsSortedByDistance(from point: [String: Any], _ ships: [[String: Any]]) -> [[String: Any]]',
    description: 'Alive ships sorted nearest→furthest.',
    returnType: '[[String: Any]]',
    example: 'let sorted = shipsSortedByDistance(from: ship, state.enemyShips)',
  },
  freeShips: {
    signature: 'freeShips(_ ships: [[String: Any]]) -> [[String: Any]]',
    description: 'Alive ships not currently capturing an island.',
    returnType: '[[String: Any]]',
    example: 'let available = freeShips(state.myShips)',
  },
  wouldDieAt: {
    signature: 'wouldDieAt(_ position: [String: Any], myShips: [[String: Any]], enemyShips: [[String: Any]], attackRadius: Double) -> Bool',
    description: 'Predicts if moving to position would destroy the ship.',
    returnType: 'Bool',
    example: 'if !wouldDieAt(island, myShips: others, enemyShips: state.enemyShips, attackRadius: r) { ... }',
  },
  aliveCount: {
    signature: 'aliveCount(_ ships: [[String: Any]], excludeCapturing: Bool = false) -> Int',
    description: 'Count alive ships.',
    returnType: 'Int',
    example: 'let alive = aliveCount(state.myShips)',
  },
  scoreRate: {
    signature: 'scoreRate(_ totalValue: Double) -> Double',
    description: 'Points per tick for a given total island value.',
    returnType: 'Double',
    example: 'let rate = scoreRate(mine.reduce(0.0) { $0 + ($1["value"] as! Double) })',
  },
  idle: {
    signature: '.idle',
    description: 'Shorthand for idle command.',
    returnType: 'Command',
    example: 'return .idle',
  },
  move: {
    signature: '.move(x: Double, y: Double)',
    description: 'Shorthand for move command.',
    returnType: 'Command',
    example: 'return .move(x: island.x, y: island.y)',
  },
};

// ─────────────────────────────────────────────
// Build full HelperSignature records
// ─────────────────────────────────────────────

function buildSignatures(defs: HelperDefs): Record<HelperName, HelperSignature> {
  return Object.fromEntries(
    (Object.keys(defs) as HelperName[]).map((name) => [
      name,
      { canonicalName: name, ...defs[name] },
    ]),
  ) as Record<HelperName, HelperSignature>;
}

export const HELPER_SIGNATURES: Record<LanguageId, Record<HelperName, HelperSignature>> = {
  javascript: buildSignatures(JS_TS_HELPERS),
  typescript: buildSignatures(JS_TS_HELPERS),
  python: buildSignatures(PYTHON_HELPERS),
  kotlin: buildSignatures(KOTLIN_HELPERS),
  java: buildSignatures(JAVA_HELPERS),
  csharp: buildSignatures(CSHARP_HELPERS),
  swift: buildSignatures(SWIFT_HELPERS),
};

/** Get helper signature for a specific language and helper */
export function getHelperSignature(
  langId: LanguageId,
  helperName: HelperName,
): HelperSignature | undefined {
  return HELPER_SIGNATURES[langId]?.[helperName];
}

/** Get all helper signatures for a language as an ordered array */
export function getAllHelperSignatures(langId: LanguageId): HelperSignature[] {
  return CANONICAL_HELPERS.map((name) => HELPER_SIGNATURES[langId][name]);
}
