// ============================================================
// 🏴☠️ Bots Battle — Language Code Generation
// ============================================================
//
// Generates runtime preambles/stubs for each language from the
// canonical helper registry. Adding a helper to BOT_HELPERS +
// registering it here makes it available in ALL sandboxes
// without editing any sandbox file.
//
// Structure:
//   PYTHON_HELPER_IMPLS   — Python snippet for each helper
//   KOTLIN_HELPER_IMPLS   — Kotlin snippet for each helper
//   SWIFT_HELPER_IMPLS    — Swift snippet for each helper
//
//   buildPythonPreamble() — Full Python preamble string
//   buildKotlinHelpers()  — Kotlin helper block for wrapKotlinCode
//   buildSwiftHelpers()   — Swift helper block for wrapSwiftCode
//   buildCSharpHelperMap()— C# HELPER_MAP derived from CANONICAL_HELPERS
// ============================================================

import { CANONICAL_HELPERS } from './helpers';
import type { HelperName } from './types';

// ─────────────────────────────────────────────
// Python helper implementations
// Each value is a Python function definition string.
// Add a new helper here to propagate it into pythonSandbox.
// ─────────────────────────────────────────────

const PYTHON_HELPER_IMPLS: Record<HelperName, string> = {
  distanceTo: `\
def distance_to(a, b):
    """Euclidean distance between two objects with .x and .y attributes."""
    dx = a.x - b.x
    dy = a.y - b.y
    return _math.sqrt(dx * dx + dy * dy)
`,

  distanceToSq: `\
def distance_to_sq(a, b):
    """Squared distance — faster when you only need relative comparisons."""
    dx = a.x - b.x
    dy = a.y - b.y
    return dx * dx + dy * dy
`,

  angleTo: `\
def angle_to(from_pt, to_pt):
    """Angle in radians from from_pt to to_pt. 0=right, pi/2=down."""
    return _math.atan2(to_pt.y - from_pt.y, to_pt.x - from_pt.x)
`,

  nearestIsland: `\
def nearest_island(ship, islands):
    """Nearest island to ship (any owner). Returns None if list is empty."""
    if not islands:
        return None
    return min(islands, key=lambda i: distance_to(ship, i))
`,

  nearestIslandOwnedBy: `\
def nearest_island_owned_by(ship, islands, owner):
    """Nearest island of the given owner. Returns None if none exist."""
    return nearest_island(ship, islands_owned_by(islands, owner))
`,

  islandsOwnedBy: `\
def islands_owned_by(islands, owner):
    """Filter islands by owner: 'me' | 'enemy' | 'neutral'."""
    return [i for i in islands if i.owner == owner]
`,

  islandsNotMine: `\
def islands_not_mine(islands):
    """Islands owned by 'enemy' or 'neutral'."""
    return [i for i in islands if i.owner != 'me']
`,

  nearestEnemy: `\
def nearest_enemy(ship, enemies):
    """Nearest alive enemy ship. Returns None if all enemies are dead."""
    alive = [e for e in enemies if e.alive]
    if not alive:
        return None
    return min(alive, key=lambda e: distance_to(ship, e))
`,

  shipsNear: `\
def ships_near(point, ships, radius):
    """Alive ships within radius of point."""
    return [s for s in ships if s.alive and distance_to(point, s) <= radius]
`,

  shipsSortedByDistance: `\
def ships_sorted_by_distance(point, ships):
    """Alive ships sorted nearest-first from point."""
    return sorted([s for s in ships if s.alive], key=lambda s: distance_to(point, s))
`,

  freeShips: `\
def free_ships(ships):
    """Alive ships NOT currently capturing an island."""
    return [s for s in ships if s.alive and not s.is_capturing]
`,

  wouldDieAt: `\
def would_die_at(position, my_ships, enemy_ships, attack_radius):
    """Predict whether moving to position would get a ship killed."""
    friendlies = sum(1 for s in my_ships   if s.alive and distance_to(position, s) <= attack_radius)
    enemies    = sum(1 for s in enemy_ships if s.alive and distance_to(position, s) <= attack_radius)
    return enemies > friendlies
`,

  aliveCount: `\
def alive_count(ships, exclude_capturing=False):
    """Number of alive ships. Pass exclude_capturing=True to skip captors."""
    return sum(1 for s in ships if s.alive and (not exclude_capturing or not s.is_capturing))
`,

  scoreRate: `\
def score_rate(total_value):
    """Points per tick for total island value held. Formula: 2^(v-1)."""
    if total_value <= 0:
        return 0
    return 2 ** (total_value - 1)
`,

  idle: `\
def idle():
    """Shorthand for {'type': 'idle'}."""
    return {'type': 'idle'}
`,

  move: `\
def move(x, y):
    """Shorthand for {'type': 'move', 'target': {'x': x, 'y': y}}."""
    return {'type': 'move', 'target': {'x': x, 'y': y}}
`,
};

// ─────────────────────────────────────────────
// Kotlin helper implementations
// Each value is a Kotlin function definition string.
// ─────────────────────────────────────────────

const KOTLIN_HELPER_IMPLS: Record<HelperName, string> = {
  distanceTo: `\
fun distanceTo(a: dynamic, b: dynamic): Double {
    val dx = (a.x as Double) - (b.x as Double)
    val dy = (a.y as Double) - (b.y as Double)
    return kotlin.math.sqrt(dx * dx + dy * dy)
}
`,

  distanceToSq: `\
fun distanceToSq(a: dynamic, b: dynamic): Double {
    val dx = (a.x as Double) - (b.x as Double)
    val dy = (a.y as Double) - (b.y as Double)
    return dx * dx + dy * dy
}
`,

  angleTo: `\
fun angleTo(from: dynamic, to: dynamic): Double {
    return kotlin.math.atan2(
        (to.y as Double) - (from.y as Double),
        (to.x as Double) - (from.x as Double)
    )
}
`,

  nearestIsland: `\
fun nearestIsland(ship: dynamic, islands: dynamic): dynamic? {
    val list = asList(islands)
    if (list.isEmpty()) return null
    return list.minByOrNull { distanceTo(ship, it) }
}
`,

  nearestIslandOwnedBy: `\
fun nearestIslandOwnedBy(ship: dynamic, islands: dynamic, owner: String): dynamic? {
    return nearestIsland(ship, islandsOwnedBy(islands, owner).let { list ->
        val arr = js("[]")
        list.forEachIndexed { i, v -> arr[i] = v }
        arr.length = list.size
        arr
    })
}
`,

  islandsOwnedBy: `\
fun islandsOwnedBy(islands: dynamic, owner: String): List<dynamic> {
    return asList(islands).filter { (it.owner as String) == owner }
}
`,

  islandsNotMine: `\
fun islandsNotMine(islands: dynamic): List<dynamic> {
    return asList(islands).filter { (it.owner as String) != "me" }
}
`,

  nearestEnemy: `\
fun nearestEnemy(ship: dynamic, enemies: dynamic): dynamic? {
    val alive = asList(enemies).filter { it.alive as Boolean }
    if (alive.isEmpty()) return null
    return alive.minByOrNull { distanceTo(ship, it) }
}
`,

  shipsNear: `\
fun shipsNear(point: dynamic, ships: dynamic, radius: Double): List<dynamic> {
    return asList(ships).filter { (it.alive as Boolean) && distanceTo(point, it) <= radius }
}
`,

  shipsSortedByDistance: `\
fun shipsSortedByDistance(point: dynamic, ships: dynamic): List<dynamic> {
    return asList(ships).filter { it.alive as Boolean }.sortedBy { distanceTo(point, it) }
}
`,

  freeShips: `\
fun freeShips(ships: dynamic): List<dynamic> {
    return asList(ships).filter { (it.alive as Boolean) && !(it.isCapturing as Boolean) }
}
`,

  wouldDieAt: `\
fun wouldDieAt(position: dynamic, myShips: dynamic, enemyShips: dynamic, attackRadius: Double): Boolean {
    val friendlies = asList(myShips).count { (it.alive as Boolean) && distanceTo(position, it) <= attackRadius }
    val foes = asList(enemyShips).count { (it.alive as Boolean) && distanceTo(position, it) <= attackRadius }
    return foes > friendlies
}
`,

  aliveCount: `\
fun aliveCount(ships: dynamic, excludeCapturing: Boolean = false): Int {
    return asList(ships).count { (it.alive as Boolean) && (!excludeCapturing || !(it.isCapturing as Boolean)) }
}
`,

  scoreRate: `\
fun scoreRate(totalValue: Double): Double {
    if (totalValue <= 0) return 0.0
    val n = totalValue.toInt() - 1
    return (1 shl n).toDouble()
}
`,

  idle: `\
fun idle(): dynamic {
    val obj = js("{}")
    obj["type"] = "idle"
    return obj
}
`,

  move: `\
fun moveTo(x: Double, y: Double): dynamic {
    val obj = js("{}")
    obj["type"] = "move"
    val target = js("{}")
    target["x"] = x
    target["y"] = y
    obj["target"] = target
    return obj
}
fun moveTo(x: Int, y: Int): dynamic = moveTo(x.toDouble(), y.toDouble())
fun moveTo(x: Number, y: Number): dynamic = moveTo(x.toDouble(), y.toDouble())
`,
};

// ─────────────────────────────────────────────
// Swift helper implementations
// Each value is a Swift function definition string.
// ─────────────────────────────────────────────

const SWIFT_HELPER_IMPLS: Record<HelperName, string> = {
  distanceTo: `\
func distanceTo(_ ax: Double, _ ay: Double, _ bx: Double, _ by: Double) -> Double {
    let dx = ax - bx, dy = ay - by
    return (dx * dx + dy * dy).squareRoot()
}
func distanceTo(_ a: BotShip, _ b: BotShip) -> Double { distanceTo(a.x, a.y, b.x, b.y) }
func distanceTo(_ a: BotShip, _ b: BotIsland) -> Double { distanceTo(a.x, a.y, b.x, b.y) }
func distanceTo(_ a: BotIsland, _ b: BotShip) -> Double { distanceTo(a.x, a.y, b.x, b.y) }
func distanceTo(_ a: BotIsland, _ b: BotIsland) -> Double { distanceTo(a.x, a.y, b.x, b.y) }
`,

  distanceToSq: `\
func distanceToSq(_ ax: Double, _ ay: Double, _ bx: Double, _ by: Double) -> Double {
    let dx = ax - bx, dy = ay - by
    return dx * dx + dy * dy
}
func distanceToSq(_ a: BotShip, _ b: BotShip) -> Double { distanceToSq(a.x, a.y, b.x, b.y) }
func distanceToSq(_ a: BotShip, _ b: BotIsland) -> Double { distanceToSq(a.x, a.y, b.x, b.y) }
`,

  angleTo: `\
func angleTo(_ fromX: Double, _ fromY: Double, _ toX: Double, _ toY: Double) -> Double {
    atan2(toY - fromY, toX - fromX)
}
func angleTo(_ from: BotShip, _ to: BotShip) -> Double { angleTo(from.x, from.y, to.x, to.y) }
func angleTo(_ from: BotShip, _ to: BotIsland) -> Double { angleTo(from.x, from.y, to.x, to.y) }
`,

  nearestIsland: `\
func nearestIsland(_ ship: BotShip, _ islands: [BotIsland]) -> BotIsland? {
    islands.min(by: { distanceTo(ship, $0) < distanceTo(ship, $1) })
}
`,

  nearestIslandOwnedBy: `\
func nearestIslandOwnedBy(_ ship: BotShip, _ islands: [BotIsland], _ owner: String) -> BotIsland? {
    nearestIsland(ship, islandsOwnedBy(islands, owner))
}
`,

  islandsOwnedBy: `\
func islandsOwnedBy(_ islands: [BotIsland], _ owner: String) -> [BotIsland] {
    islands.filter { $0.owner == owner }
}
`,

  islandsNotMine: `\
func islandsNotMine(_ islands: [BotIsland]) -> [BotIsland] {
    islands.filter { $0.owner != "me" }
}
`,

  nearestEnemy: `\
func nearestEnemy(_ ship: BotShip, _ enemies: [BotShip]) -> BotShip? {
    enemies.filter { $0.alive }.min(by: { distanceTo(ship, $0) < distanceTo(ship, $1) })
}
`,

  shipsNear: `\
func shipsNear(_ x: Double, _ y: Double, _ ships: [BotShip], _ radius: Double) -> [BotShip] {
    ships.filter { $0.alive && distanceTo($0.x, $0.y, x, y) <= radius }
}
`,

  shipsSortedByDistance: `\
func shipsSortedByDistance(_ ships: [BotShip], from ship: BotShip) -> [BotShip] {
    ships.filter { $0.alive }.sorted { distanceTo(ship, $0) < distanceTo(ship, $1) }
}
`,

  freeShips: `\
func freeShips(_ ships: [BotShip]) -> [BotShip] {
    ships.filter { $0.alive && !$0.isCapturing }
}
`,

  wouldDieAt: `\
func wouldDieAt(_ x: Double, _ y: Double,
                _ myShips: [BotShip], _ enemyShips: [BotShip],
                _ attackRadius: Double) -> Bool {
    let friends = myShips.filter { $0.alive && distanceTo($0.x, $0.y, x, y) <= attackRadius }.count
    let foes    = enemyShips.filter { $0.alive && distanceTo($0.x, $0.y, x, y) <= attackRadius }.count
    return foes > friends
}
`,

  aliveCount: `\
func aliveCount(_ ships: [BotShip], excludeCapturing: Bool = false) -> Int {
    ships.filter { $0.alive && (!excludeCapturing || !$0.isCapturing) }.count
}
`,

  scoreRate: `\
func scoreRate(_ totalValue: Int) -> Double {
    if totalValue <= 0 { return 0 }
    return pow(2.0, Double(totalValue - 1))
}
`,

  idle: `\
// idle and move are enum cases, not functions — .idle and .move(x:y:) 
`,

  move: `\
// (see Command enum definition in preamble)
`,
};

// ─────────────────────────────────────────────
// Python preamble builder
// ─────────────────────────────────────────────

const PYTHON_PREAMBLE_HEADER = `\
import json as _json
import math as _math

# ── Namespace: convert a JSON dict to attribute-accessible Python object ──
class _NS:
    """Wraps a dict so fields can be accessed with dot notation."""
    def __init__(self, d):
        if isinstance(d, _NS):
            self.__dict__.update(d.__dict__)
            return
        if not isinstance(d, dict):
            return
        for k, v in d.items():
            if isinstance(v, dict):
                setattr(self, k, _NS(v))
            elif isinstance(v, list):
                setattr(self, k, [_NS(i) if isinstance(i, dict) else i for i in v])
            else:
                setattr(self, k, v)
    def __repr__(self):
        return 'NS(' + repr({k: v for k, v in self.__dict__.items()}) + ')'

# ── JSON tick bridge ──────────────────────────────────────────────────────
# Called by JS to invoke the user's tick function with JSON-encoded arguments.
# Returns a JSON-encoded Command dict.
def _tick_json(tick_fn, state_json, ship_json):
    try:
        state = _NS(_json.loads(state_json))
        ship  = _NS(_json.loads(ship_json))
        result = tick_fn(state, ship)
        if isinstance(result, _NS):
            result = result.__dict__
        if not isinstance(result, dict):
            return '{"type":"idle"}'
        return _json.dumps(result)
    except Exception as _e:
        return '{"type":"idle"}'

`;

const PYTHON_PREAMBLE_FOOTER = `\
# ─────────────────────────────────────────────────────────────────────────
# END PREAMBLE — user code follows
# ─────────────────────────────────────────────────────────────────────────
`;

/**
 * Build the full Python preamble string injected before user code.
 * Iterates CANONICAL_HELPERS to guarantee all registered helpers are included.
 */
export function buildPythonPreamble(): string {
  const impls = CANONICAL_HELPERS.map((name) => {
    const impl = PYTHON_HELPER_IMPLS[name];
    if (!impl) {
      console.warn(`[codegen] Missing Python implementation for helper: ${name}`);
      return `# WARNING: no Python implementation for '${name}'\n`;
    }
    return impl;
  }).join('\n');

  return '\n' + PYTHON_PREAMBLE_HEADER + impls + '\n' + PYTHON_PREAMBLE_FOOTER;
}

// ─────────────────────────────────────────────
// Kotlin helpers block builder
// ─────────────────────────────────────────────

const KOTLIN_HELPERS_HEADER = `\
// ── Array utility (internal) ─────────────────────────────────
fun asList(arr: dynamic): List<dynamic> {
    val len = (arr.length as? Number)?.toInt()
    if (len != null) return (0 until len).map { arr[it] }
    // Kotlin List from filter/map — use unsafeCast
    return arr.unsafeCast<List<dynamic>>()
}

// ── Bot helpers (generated from language registry) ───────────
`;

/**
 * Build the Kotlin helper block injected into wrapKotlinCode.
 * Iterates CANONICAL_HELPERS to guarantee all registered helpers are included.
 */
export function buildKotlinHelpers(): string {
  const impls = CANONICAL_HELPERS.map((name) => {
    const impl = KOTLIN_HELPER_IMPLS[name];
    if (!impl) {
      console.warn(`[codegen] Missing Kotlin implementation for helper: ${name}`);
      return `// WARNING: no Kotlin implementation for '${name}'\n`;
    }
    return impl;
  }).join('\n');

  return KOTLIN_HELPERS_HEADER + impls;
}

// ─────────────────────────────────────────────
// Swift helpers block builder
// ─────────────────────────────────────────────

const SWIFT_HELPERS_HEADER = `\
// ── Bot helpers (generated from language registry) ─────────────────────────
`;

/**
 * Build the Swift helper block injected into wrapSwiftCode.
 * Iterates CANONICAL_HELPERS to guarantee all registered helpers are included.
 */
export function buildSwiftHelpers(): string {
  const impls = CANONICAL_HELPERS.map((name) => {
    const impl = SWIFT_HELPER_IMPLS[name];
    if (!impl) {
      console.warn(`[codegen] Missing Swift implementation for helper: ${name}`);
      return `// WARNING: no Swift implementation for '${name}'\n`;
    }
    return impl;
  }).join('\n');

  return SWIFT_HELPERS_HEADER + impls;
}

// ─────────────────────────────────────────────
// C# helper map builder
// ─────────────────────────────────────────────

/**
 * Build the C# HELPER_MAP (PascalCase → camelCase) from CANONICAL_HELPERS.
 * Adding a helper to the registry automatically adds its C# mapping.
 */
export function buildCSharpHelperMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const name of CANONICAL_HELPERS) {
    // Convert camelCase canonical name → PascalCase C# name
    const pascal = name.charAt(0).toUpperCase() + name.slice(1);
    map[pascal] = name;
  }
  return map;
}

// Re-export for convenience
export { CANONICAL_HELPERS };
