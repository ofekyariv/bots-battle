// ============================================================
// 🏴☠️ Bots Battle — Language Registry
// SINGLE SOURCE OF TRUTH for all language support
// ============================================================
//
// This registry is the authority that EditorSidebar, docs page,
// LLM helper, starter codes, and sandboxes all reference.
// ============================================================

import type { LanguageConfig, LanguageId } from './types';
import { HELPER_SIGNATURES, getHelperSignature, getAllHelperSignatures } from './helpers';
import { COMMAND_APIS } from './commands';

// ─────────────────────────────────────────────
// JavaScript
// ─────────────────────────────────────────────

const JAVASCRIPT_STARTER = `function tick(state, ship) {
  const target = nearestIsland(ship, islandsNotMine(state.islands));
  if (!target) return idle();

  return move(target.x, target.y);
}
`;

// ─────────────────────────────────────────────
// TypeScript
// ─────────────────────────────────────────────

const TYPESCRIPT_STARTER = `// @language: typescript
function tick(state: GameState, ship: BotShip): Command {
  const target = nearestIsland(ship, islandsNotMine(state.islands));
  if (!target) return idle();

  return move(target.x, target.y);
}
`;

// ─────────────────────────────────────────────
// Python
// ─────────────────────────────────────────────

const PYTHON_STARTER = `# @language: python
def tick(state, ship):
    target = nearest_island(ship, islands_not_mine(state.islands))
    if target is None:
        return idle()

    return move(target.x, target.y)
`;

// ─────────────────────────────────────────────
// Kotlin
// ─────────────────────────────────────────────

const KOTLIN_STARTER = `// @language: kotlin
fun tick(state: dynamic, ship: dynamic): dynamic {
    val target = nearestIsland(ship, islandsNotMine(state.islands))
        ?: return idle()

    return moveTo(target.x as Double, target.y as Double)
}
`;

// ─────────────────────────────────────────────
// Java
// ─────────────────────────────────────────────

const JAVA_STARTER = `// @language: java
dynamic tick(GameState state, BotShip ship) {
    BotIsland target = nearestIsland(ship, islandsNotMine(state.islands));
    if (target == null) return idle();

    return move(target.x, target.y);
}
`;

// ─────────────────────────────────────────────
// C#
// ─────────────────────────────────────────────

const CSHARP_STARTER = `// @language: csharp
dynamic Tick(GameState state, Ship ship) {
    var target = NearestIsland(ship, IslandsNotMine(state.Islands));
    if (target == null) return Idle();

    return Move(target.X, target.Y);
}
`;

// ─────────────────────────────────────────────
// Swift
// ─────────────────────────────────────────────

const SWIFT_STARTER = `// @language: swift
func tick(_ state: GameState, _ ship: BotShip) -> Command {
    guard let target = nearestIsland(ship, islandsNotMine(state.islands)) else { return .idle }

    return .move(x: target.x, y: target.y)
}
`;

// ─────────────────────────────────────────────
// Type definitions per language
// ─────────────────────────────────────────────

const JS_TYPE_DEFINITIONS = `
// JavaScript shares the same runtime types as TypeScript — see below for field reference.

// GameState (state):
//   tick: number          — current tick (0-based)
//   maxTicks: number      — total ticks in this game
//   mapWidth: number      — map width in units
//   mapHeight: number     — map height in units
//   myShips: BotShip[]    — your ships (includes dead — check alive)
//   enemyShips: BotShip[] — enemy ships (includes dead)
//   islands: BotIsland[]  — all islands, owner from your perspective
//   myScore: number
//   enemyScore: number
//   targetScore: number   — first to this wins
//   config: GameConfig    — full game config (attackRadius, shipSpeed, etc.)

// BotShip (ship):
//   id: number            — stable ship ID (0–N), never changes during a game
//   x: number             — current X position
//   y: number             — current Y position
//   alive: boolean        — false while waiting to respawn
//   isCapturing: boolean  — true if inside an island's capture radius
//   turnsToRevive: number — 0 if alive; countdown ticks until respawn
//   initialX: number      — fixed respawn X (inside your safe zone)
//   initialY: number      — fixed respawn Y (inside your safe zone)
//   combatPressure: number — consecutive ticks outnumbered (use to detect danger)

// BotIsland (island):
//   id: number
//   x: number
//   y: number
//   radius: number               — capture proximity radius
//   owner: 'me' | 'enemy' | 'neutral'
//   teamCapturing: 'me' | 'enemy' | 'none'
//   captureProgress: number      — ticks accumulated toward capture
//   captureTurns: number         — ticks to fully capture a neutral island
//   value: number                — 1 = normal, 2+ = treasure island

// Commands:
//   { type: 'idle' }                           — stay put
//   { type: 'move', target: { x, y } }         — move toward target
`;

const TS_TYPE_DEFINITIONS = `
interface GameConfig {
  mapWidth: number;       // World width in units
  mapHeight: number;      // World height in units
  shipSpeed: number;      // Units per tick
  attackRadius: number;   // Per-ship combat radius
  captureRadius: number;  // Island capture proximity radius
  captureTurns: number;   // Ticks to capture a neutral island
  respawnDelay: number;   // Ticks a dead ship waits to respawn
  gameDuration: number;   // Total game ticks
  targetScore: number;    // Instant-win score threshold
  shipsPerPlayer: number; // Ships per team
  safeZoneWidth: number;  // Width of each team's spawn safe zone
  numIslands: number;     // Islands on the map
  tickRateMs: number;     // Milliseconds between ticks
  combatKillDelay: number;// Consecutive ticks outnumbered before dying
}

interface BotShip {
  id: number;            // Stable ship ID, never changes during a game
  x: number;            // Current X position (world units)
  y: number;            // Current Y position (world units)
  alive: boolean;       // false while waiting to respawn
  isCapturing: boolean; // true if inside an island's capture radius
  turnsToRevive: number;// 0 if alive; countdown ticks until respawn
  initialX: number;     // Fixed respawn X (inside your safe zone)
  initialY: number;     // Fixed respawn Y (inside your safe zone)
  combatPressure: number; // Consecutive ticks outnumbered (use to detect danger)
}

interface BotIsland {
  id: number;
  x: number;
  y: number;
  radius: number;               // Capture radius — ships must be within this
  owner: 'me' | 'enemy' | 'neutral';
  teamCapturing: 'me' | 'enemy' | 'none';
  captureProgress: number;      // Ticks accumulated toward capture
  captureTurns: number;         // Ticks to fully capture a neutral island
  value: number;                // 1 = normal, 2+ = treasure island
}

interface GameState {
  tick: number;           // Current tick (0-based)
  maxTicks: number;       // Total ticks in this game
  mapWidth: number;
  mapHeight: number;
  islands: BotIsland[];   // All islands — ownership is from your perspective
  myShips: BotShip[];     // Your ships (includes dead — check alive)
  enemyShips: BotShip[];  // Enemy ships (includes dead)
  myScore: number;
  enemyScore: number;
  targetScore: number;    // First to this wins
  config: GameConfig;
}

type Command =
  | { type: 'idle' }
  | { type: 'move'; target: { x: number; y: number } };
`;

const PYTHON_TYPE_DEFINITIONS = `
# All state fields use snake_case in Python:

# state.my_ships         — list of BotShip for your fleet
# state.enemy_ships      — list of BotShip for enemy fleet
# state.islands          — list of BotIsland
# state.tick             — current tick (int)
# state.max_ticks        — total ticks in this game
# state.map_width        — map width in units
# state.map_height       — map height in units
# state.my_score         — your current score
# state.enemy_score      — enemy current score
# state.target_score     — first to reach this wins

# BotShip fields (snake_case):
#   ship.id                — stable int ID (0–N)
#   ship.x, ship.y         — current position (float)
#   ship.alive             — True/False
#   ship.is_capturing      — True if inside island capture radius
#   ship.turns_to_revive   — 0 if alive; countdown until respawn
#   ship.initial_x         — fixed respawn X
#   ship.initial_y         — fixed respawn Y
#   ship.combat_pressure   — consecutive ticks outnumbered (use to detect danger)

# BotIsland fields (snake_case):
#   island.id, island.x, island.y
#   island.radius          — capture proximity radius
#   island.owner           — 'me' | 'enemy' | 'neutral'
#   island.team_capturing  — 'me' | 'enemy' | 'none'
#   island.capture_progress
#   island.capture_turns
#   island.value           — 1 = normal, 2+ = treasure

# Commands (return as dict):
#   {'type': 'idle'}
#   {'type': 'move', 'target': {'x': x, 'y': y}}
`;

const KOTLIN_TYPE_DEFINITIONS = `
// State is a dynamic JavaScript object — use camelCase and cast when needed:

// state.myShips          // dynamic (use asList(state.myShips) for List<dynamic>)
// state.enemyShips       // dynamic
// state.islands          // dynamic
// state.tick             // Int (cast: state.tick as Int)
// state.maxTicks         // Int
// state.mapWidth         // Double (cast: state.mapWidth as Double)
// state.mapHeight        // Double
// state.myScore          // Double
// state.enemyScore       // Double
// state.targetScore      // Double
// state.config           // dynamic (attackRadius, shipSpeed, etc.)

// BotShip fields (camelCase, cast to native Kotlin types):
//   ship.id                // Int
//   ship.x, ship.y         // Double (cast: ship.x as Double)
//   ship.alive             // Boolean (cast: ship.alive as Boolean)
//   ship.isCapturing       // Boolean
//   ship.turnsToRevive     // Int
//   ship.initialX          // Double
//   ship.initialY          // Double
//   ship.combatPressure    // Int

// BotIsland fields (camelCase):
//   island.id, island.x, island.y
//   island.radius          // Double
//   island.owner           // String ("me" | "enemy" | "neutral")
//   island.teamCapturing   // String ("me" | "enemy" | "none")
//   island.captureProgress // Int
//   island.captureTurns    // Int
//   island.value           // Int

// IMPORTANT: Use asList(dynamicArray) to convert dynamic JS arrays to Kotlin List
// before calling .isEmpty(), .minByOrNull(), .filter(), etc.
`;

const JAVA_TYPE_DEFINITIONS = `
// Java transpiler maps the game API to these types:

// GameState state:
//   state.myShips[]        // BotShip[] — your fleet
//   state.enemyShips[]     // BotShip[] — enemy fleet
//   state.islands[]        // BotIsland[] — all islands
//   state.tick             // int
//   state.maxTicks         // int
//   state.mapWidth         // double
//   state.mapHeight        // double
//   state.myScore          // double
//   state.enemyScore       // double
//   state.targetScore      // double
//   state.config           // GameConfig

// BotShip ship:
//   ship.id                // int — stable ship ID (0–N)
//   ship.x, ship.y         // double — current position
//   ship.alive             // boolean
//   ship.isCapturing       // boolean
//   ship.turnsToRevive     // int — 0 if alive
//   ship.initialX          // double — fixed respawn X
//   ship.initialY          // double — fixed respawn Y
//   ship.combatPressure    // int — consecutive ticks outnumbered

// BotIsland island:
//   island.id, island.x, island.y
//   island.radius          // double
//   island.owner           // String ("me" | "enemy" | "neutral")
//   island.teamCapturing   // String ("me" | "enemy" | "none")
//   island.captureProgress // int
//   island.captureTurns    // int
//   island.value           // int — 1=normal, 2+=treasure

// Commands:
//   idle()
//   move(double x, double y)
// All helpers available as direct function calls (no BotHelpers prefix needed)
`;

const CSHARP_TYPE_DEFINITIONS = `
// C# transpiler maps the game API to PascalCase types:

// GameState state:
//   state.MyShips[]        // Ship[] — your fleet (includes dead — check Alive)
//   state.EnemyShips[]     // Ship[] — enemy fleet (includes dead)
//   state.Islands[]        // Island[] — all islands
//   state.Tick             // int
//   state.MaxTicks         // int
//   state.MapWidth         // double
//   state.MapHeight        // double
//   state.MyScore          // double
//   state.EnemyScore       // double
//   state.TargetScore      // double
//   state.Config           // Config

// Ship ship:
//   ship.Id                // int — stable ship ID (0–N)
//   ship.X, ship.Y         // double — current position
//   ship.Alive             // bool
//   ship.IsCapturing       // bool
//   ship.TurnsToRevive     // int — 0 if alive
//   ship.InitialX          // double — fixed respawn X
//   ship.InitialY          // double — fixed respawn Y
//   ship.CombatPressure    // int — consecutive ticks outnumbered

// Island island:
//   island.Id, island.X, island.Y
//   island.Radius          // double
//   island.Owner           // string ("me" | "enemy" | "neutral")
//   island.TeamCapturing   // string ("me" | "enemy" | "none")
//   island.CaptureProgress // int
//   island.CaptureTurns    // int
//   island.Value           // int — 1=normal, 2+=treasure

// Commands:
//   Idle()
//   Move(double x, double y)
// LINQ available: .Where(), .OrderBy(), .Select(), .First(), .FirstOrDefault(),
//                 .Any(), .All(), .Count(), .MinBy(), .MaxBy(), .Sum(), .Take()
// All helpers available as static methods (PascalCase, no class prefix needed)
`;

const SWIFT_TYPE_DEFINITIONS = `
// Swift types (compiled via Godbolt — expect ~2s lag on first run):

// GameState state:
//   state.myShips          // [BotShip] — your fleet (includes dead — check alive)
//   state.enemyShips       // [BotShip] — enemy fleet (includes dead)
//   state.islands          // [Island] — all islands
//   state.tick             // Int
//   state.maxTicks         // Int
//   state.mapWidth         // Double
//   state.mapHeight        // Double
//   state.myScore          // Double
//   state.enemyScore       // Double
//   state.targetScore      // Double
//   state.config           // Config

// BotShip ship:
//   ship.id                // Int — stable ship ID (0–N)
//   ship.x, ship.y         // Double — current position
//   ship.alive             // Bool
//   ship.isCapturing       // Bool
//   ship.turnsToRevive     // Int — 0 if alive
//   ship.initialX          // Double — fixed respawn X
//   ship.initialY          // Double — fixed respawn Y
//   ship.combatPressure    // Int — consecutive ticks outnumbered

// Island island:
//   island.id, island.x, island.y
//   island.radius          // Double
//   island.owner           // String ("me" | "enemy" | "neutral")
//   island.teamCapturing   // String ("me" | "enemy" | "none")
//   island.captureProgress // Int
//   island.captureTurns    // Int
//   island.value           // Int — 1=normal, 2+=treasure

// Commands:
//   .idle
//   .move(x: Double, y: Double)
// All helpers available as free functions (camelCase, no import needed)
`;

// ─────────────────────────────────────────────
// Sample Bots — Rusher, Balanced, Admiral per language
// (3 representative bots for "View Examples" in the editor)
// ─────────────────────────────────────────────

// ── JavaScript ──────────────────────────────
const JS_SAMPLE_RUSHER = `function tick(state, ship) {
  const uncaptured = [...islandsOwnedBy(state.islands, 'enemy'), ...islandsOwnedBy(state.islands, 'neutral')];
  if (uncaptured.length === 0) {
    const contested = state.islands.filter(i => i.owner === 'me' && i.teamCapturing === 'enemy');
    if (contested.length > 0) return move(nearestIsland(ship, contested).x, nearestIsland(ship, contested).y);
    const mine = islandsOwnedBy(state.islands, 'me');
    if (mine.length > 0) return move(nearestIsland(ship, mine).x, nearestIsland(ship, mine).y);
    return idle();
  }
  const score = (isl, from) => distanceTo(from, isl) - (isl.owner === 'enemy' ? 5000 : 0);
  const alive = state.myShips.filter(s => s.alive).sort((a, b) => a.id - b.id);
  const myRank = alive.findIndex(s => s.id === ship.id);
  if (myRank === -1) return idle();
  const claimed = new Set();
  for (let r = 0; r < myRank; r++) {
    const other = alive[r];
    const pool = uncaptured.filter(i => !claimed.has(i.id));
    if (!pool.length) break;
    claimed.add(pool.reduce((b, i) => score(i, other) < score(b, other) ? i : b).id);
  }
  const remaining = uncaptured.filter(i => !claimed.has(i.id));
  const pool = remaining.length > 0 ? remaining : uncaptured;
  const target = pool.reduce((b, i) => score(i, ship) < score(b, ship) ? i : b);
  return move(target.x, target.y);
}`;

// ── Python ──────────────────────────────
const PYTHON_SAMPLE_RUSHER = `# @language: python
# 🟢 Rusher — greedy island spreader
def tick(state, ship):
    uncaptured = islands_owned_by(state.islands, 'enemy') + islands_owned_by(state.islands, 'neutral')
    if not uncaptured:
        contested = [i for i in state.islands if i.owner == 'me' and i.team_capturing == 'enemy']
        if contested:
            t = nearest_island(ship, contested)
            return move(t.x, t.y)
        mine = islands_owned_by(state.islands, 'me')
        if mine:
            t = nearest_island(ship, mine)
            return move(t.x, t.y)
        return idle()
    def score(island, from_ship):
        return distance_to(from_ship, island) - (5000 if island.owner == 'enemy' else 0)
    alive = sorted([s for s in state.my_ships if s.alive], key=lambda s: s.id)
    my_rank = next((i for i, s in enumerate(alive) if s.id == ship.id), -1)
    if my_rank == -1:
        return idle()
    claimed = set()
    for r in range(my_rank):
        pool = [i for i in uncaptured if i.id not in claimed]
        if not pool: break
        best = min(pool, key=lambda i: score(i, alive[r]))
        claimed.add(best.id)
    remaining = [i for i in uncaptured if i.id not in claimed]
    pool = remaining if remaining else uncaptured
    target = min(pool, key=lambda i: score(i, ship))
    return move(target.x, target.y)`;

// ── Kotlin ──────────────────────────────
const KOTLIN_SAMPLE_RUSHER = `// @language: kotlin
// 🟢 Rusher — greedy island spreader
fun tick(state: dynamic, ship: dynamic): dynamic {
    val enemies  = islandsOwnedBy(state.islands, "enemy") as List<dynamic>
    val neutrals = islandsOwnedBy(state.islands, "neutral") as List<dynamic>
    val uncaptured = enemies + neutrals
    if (uncaptured.isEmpty()) {
        val contested = (state.islands as List<dynamic>).filter { it.owner == "me" && it.teamCapturing == "enemy" }
        if (contested.isNotEmpty()) { val t = contested.minByOrNull { distanceTo(ship, it) }!!; return moveTo(t.x as Double, t.y as Double) }
        val mine = islandsOwnedBy(state.islands, "me") as List<dynamic>
        if (mine.isNotEmpty()) { val t = mine.minByOrNull { distanceTo(ship, it) }!!; return moveTo(t.x as Double, t.y as Double) }
        return idle()
    }
    fun score(isl: dynamic, from: dynamic) = distanceTo(from, isl) - (if (isl.owner == "enemy") 5000.0 else 0.0)
    val alive = (state.myShips as List<dynamic>).filter { it.alive as Boolean }.sortedBy { it.id as Int }
    val myRank = alive.indexOfFirst { it.id == ship.id }
    if (myRank == -1) return idle()
    val claimed = mutableSetOf<Int>()
    for (r in 0 until myRank) {
        val pool = uncaptured.filter { it.id as Int !in claimed }
        if (pool.isEmpty()) break
        claimed.add(pool.minByOrNull { score(it, alive[r]) }!!.id as Int)
    }
    val remaining = uncaptured.filter { it.id as Int !in claimed }
    val pool = if (remaining.isNotEmpty()) remaining else uncaptured
    val target = pool.minByOrNull { score(it, ship) }!!
    return moveTo(target.x as Double, target.y as Double)
}`;

// ── Java ──────────────────────────────
const JAVA_SAMPLE_RUSHER = `// @language: java
// 🟢 Rusher — greedy island spreader
dynamic tick(GameState state, BotShip ship) {
    BotIsland[] enemies = islandsOwnedBy(state.islands, "enemy");
    BotIsland[] neutrals = islandsOwnedBy(state.islands, "neutral");
    BotIsland[] uncaptured = new BotIsland[enemies.length + neutrals.length];
    System.arraycopy(enemies, 0, uncaptured, 0, enemies.length);
    System.arraycopy(neutrals, 0, uncaptured, enemies.length, neutrals.length);
    if (uncaptured.length == 0) {
        BotIsland[] mine = islandsOwnedBy(state.islands, "me");
        if (mine.length > 0) {
            BotIsland t = nearestIsland(ship, mine);
            return t != null ? move(t.x, t.y) : idle();
        }
        return idle();
    }
    BotIsland target = nearestIsland(ship, uncaptured);
    return target != null ? move(target.x, target.y) : idle();
}`;

// ── C# ──────────────────────────────
const CSHARP_SAMPLE_RUSHER = `// @language: csharp
// 🟢 Rusher — greedy island spreader
dynamic Tick(GameState state, Ship ship) {
    var uncaptured = IslandsOwnedBy(state.Islands, "enemy").Concat(IslandsOwnedBy(state.Islands, "neutral")).ToArray();
    if (uncaptured.Length == 0) {
        var mine = IslandsOwnedBy(state.Islands, "me");
        if (mine.Length > 0) { var t = NearestIsland(ship, mine); return t != null ? Move(t.X, t.Y) : Idle(); }
        return Idle();
    }
    var target = NearestIsland(ship, uncaptured);
    return target != null ? Move(target.X, target.Y) : Idle();
}`;

// ── Swift ──────────────────────────────
const SWIFT_SAMPLE_RUSHER = `// @language: swift
// 🟢 Rusher — greedy island spreader
func tick(_ state: GameState, _ ship: BotShip) -> Command {
    let uncaptured = islandsOwnedBy(state.islands, "enemy") + islandsOwnedBy(state.islands, "neutral")
    if uncaptured.isEmpty {
        let cont = state.islands.filter { $0.owner == "me" && $0.teamCapturing == "enemy" }
        if let t = nearestIsland(ship, cont) { return .move(x: t.x, y: t.y) }
        let mine = islandsOwnedBy(state.islands, "me")
        if let t = nearestIsland(ship, mine) { return .move(x: t.x, y: t.y) }
        return .idle
    }
    func score(_ i: BotIsland, from f: BotShip) -> Double { distanceTo(f, i) - (i.owner == "enemy" ? 5000 : 0) }
    let alive = state.myShips.filter { $0.alive }.sorted { $0.id < $1.id }
    guard let myRank = alive.firstIndex(where: { $0.id == ship.id }) else { return .idle }
    var claimed = Set<Int>()
    for r in 0..<myRank {
        let pool = uncaptured.filter { !claimed.contains($0.id) }
        guard !pool.isEmpty else { break }
        if let best = pool.min(by: { score($0, from: alive[r]) < score($1, from: alive[r]) }) { claimed.insert(best.id) }
    }
    let pool = uncaptured.filter { !claimed.contains($0.id) }
    let finalPool = pool.isEmpty ? uncaptured : pool
    guard let target = finalPool.min(by: { score($0, from: ship) < score($1, from: ship) }) else { return .idle }
    return .move(x: target.x, y: target.y)
}`;

// ─────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────

export const LANGUAGES: Record<LanguageId, LanguageConfig> = {
  javascript: {
    id: 'javascript',
    displayName: 'JavaScript',
    monacoLanguage: 'javascript',
    fileExtension: 'js',
    color: '#F7DF1E',
    icon: '🟨',
    commandApi: COMMAND_APIS.javascript,
    helperSignatures: HELPER_SIGNATURES.javascript,
    typeDefinitions: JS_TYPE_DEFINITIONS,
    starterCode: JAVASCRIPT_STARTER,
    sampleBots: [
      { name: 'Rusher', description: 'Greedy island spreader — each ship claims a unique uncaptured island', code: JS_SAMPLE_RUSHER },
    ],
    docSnippets: {
      tickSignature: `function tick(state, ship) {\n  // return command\n}`,
      commandUsage: `return move(island.x, island.y);\nreturn idle();`,
    },
    sandbox: {
      type: 'js-direct',
      description: 'Runs directly in a Function() constructor with helpers injected.',
      isAsync: false,
      latency: 'instant',
    },
  },

  typescript: {
    id: 'typescript',
    displayName: 'TypeScript',
    monacoLanguage: 'typescript',
    fileExtension: 'ts',
    color: '#3178C6',
    icon: '🔷',
    commandApi: COMMAND_APIS.typescript,
    helperSignatures: HELPER_SIGNATURES.typescript,
    typeDefinitions: TS_TYPE_DEFINITIONS,
    starterCode: TYPESCRIPT_STARTER,
    sampleBots: [
      { name: 'Rusher', description: 'Greedy island spreader — each ship claims a unique uncaptured island', code: JS_SAMPLE_RUSHER },
    ],
    docSnippets: {
      tickSignature: `function tick(state: GameState, ship: BotShip): Command {\n  // return command\n}`,
      commandUsage: `return move(island.x, island.y);\nreturn idle();`,
    },
    sandbox: {
      type: 'js-direct',
      description: 'Types are stripped, then runs as JavaScript.',
      isAsync: false,
      latency: 'instant',
    },
  },

  python: {
    id: 'python',
    displayName: 'Python',
    monacoLanguage: 'python',
    fileExtension: 'py',
    color: '#3776AB',
    icon: '🐍',
    commandApi: COMMAND_APIS.python,
    helperSignatures: HELPER_SIGNATURES.python,
    typeDefinitions: PYTHON_TYPE_DEFINITIONS,
    starterCode: PYTHON_STARTER,
    sampleBots: [
      { name: 'Rusher', description: 'Greedy island spreader — each ship claims a unique uncaptured island', code: PYTHON_SAMPLE_RUSHER },
    ],
    docSnippets: {
      tickSignature: `def tick(state, ship):\n    # return command`,
      commandUsage: `return move(island.x, island.y)\nreturn idle()`,
    },
    sandbox: {
      type: 'remote-compile',
      description: 'Runs via Brython (in-browser Python interpreter).',
      isAsync: false,
      latency: 'low',
    },
  },

  kotlin: {
    id: 'kotlin',
    displayName: 'Kotlin',
    monacoLanguage: 'kotlin',
    fileExtension: 'kt',
    color: '#7F52FF',
    icon: '🟣',
    commandApi: COMMAND_APIS.kotlin,
    helperSignatures: HELPER_SIGNATURES.kotlin,
    typeDefinitions: KOTLIN_TYPE_DEFINITIONS,
    starterCode: KOTLIN_STARTER,
    sampleBots: [
      { name: 'Rusher', description: 'Greedy island spreader — each ship claims a unique uncaptured island', code: KOTLIN_SAMPLE_RUSHER },
    ],
    docSnippets: {
      tickSignature: `fun tick(state: dynamic, ship: dynamic): dynamic {\n    // return command\n}`,
      commandUsage: `return moveTo(island.x as Double, island.y as Double)\nreturn idle()`,
    },
    sandbox: {
      type: 'remote-compile',
      description: 'Compiled remotely via JetBrains Kotlin Playground API.',
      isAsync: true,
      latency: 'high',
    },
  },

  java: {
    id: 'java',
    displayName: 'Java',
    monacoLanguage: 'java',
    fileExtension: 'java',
    color: '#ED8B00',
    icon: '☕',
    commandApi: COMMAND_APIS.java,
    helperSignatures: HELPER_SIGNATURES.java,
    typeDefinitions: JAVA_TYPE_DEFINITIONS,
    starterCode: JAVA_STARTER,
    sampleBots: [
      { name: 'Rusher', description: 'Greedy island spreader — each ship claims a unique uncaptured island', code: JAVA_SAMPLE_RUSHER },
    ],
    docSnippets: {
      tickSignature: `dynamic tick(GameState state, BotShip ship) {\n    // return command\n}`,
      commandUsage: `return move(island.x, island.y);\nreturn idle();`,
    },
    sandbox: {
      type: 'transpile-to-js',
      description: 'Transpiled locally to JavaScript — runs instantly.',
      isAsync: false,
      latency: 'instant',
    },
  },

  csharp: {
    id: 'csharp',
    displayName: 'C#',
    monacoLanguage: 'csharp',
    fileExtension: 'cs',
    color: '#9B4993',
    icon: '🟪',
    commandApi: COMMAND_APIS.csharp,
    helperSignatures: HELPER_SIGNATURES.csharp,
    typeDefinitions: CSHARP_TYPE_DEFINITIONS,
    starterCode: CSHARP_STARTER,
    sampleBots: [
      { name: 'Rusher', description: 'Greedy island spreader — each ship claims a unique uncaptured island', code: CSHARP_SAMPLE_RUSHER },
    ],
    docSnippets: {
      tickSignature: `dynamic Tick(GameState state, Ship ship) {\n    // return command\n}`,
      commandUsage: `return Move(island.X, island.Y);\nreturn Idle();`,
    },
    sandbox: {
      type: 'transpile-to-js',
      description: 'Transpiled locally to JavaScript — runs instantly.',
      isAsync: false,
      latency: 'instant',
    },
  },

  swift: {
    id: 'swift',
    displayName: 'Swift',
    monacoLanguage: 'swift',
    fileExtension: 'swift',
    color: '#FA7343',
    icon: '🦅',
    commandApi: COMMAND_APIS.swift,
    helperSignatures: HELPER_SIGNATURES.swift,
    typeDefinitions: SWIFT_TYPE_DEFINITIONS,
    starterCode: SWIFT_STARTER,
    sampleBots: [
      { name: 'Rusher', description: 'Greedy island spreader — each ship claims a unique uncaptured island', code: SWIFT_SAMPLE_RUSHER },
    ],
    docSnippets: {
      tickSignature: `func tick(_ state: GameState, _ ship: BotShip) -> Command {\n    // return command\n}`,
      commandUsage: `return .move(x: island.x, y: island.y)\nreturn .idle`,
    },
    sandbox: {
      type: 'remote-compile',
      description: 'Compiled remotely via Godbolt — stdin/stdout JSON bridge.',
      isAsync: true,
      latency: 'high',
    },
  },
};

// ─────────────────────────────────────────────
// Registry accessors
// ─────────────────────────────────────────────

/** All supported language IDs in display order */
export const ALL_LANGUAGE_IDS: LanguageId[] = [
  'javascript',
  'typescript',
  'python',
  'kotlin',
  'java',
  'csharp',
  'swift',
];

/** Get config for a specific language */
export function getLanguage(id: LanguageId): LanguageConfig {
  return LANGUAGES[id];
}

/** Get all language configs as an ordered array */
export function getAllLanguages(): LanguageConfig[] {
  return ALL_LANGUAGE_IDS.map((id) => LANGUAGES[id]);
}

/** Get a specific helper signature for a language */
export { getHelperSignature, getAllHelperSignatures };
