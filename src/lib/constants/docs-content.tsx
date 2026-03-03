import type { ReactNode } from 'react';
import { CodeBlock } from '../../components/docs/CodeBlock';
import { MultiLangCodeBlock } from '../../components/docs/MultiLangCodeBlock';
import type { LanguageCodes } from '../../components/docs/MultiLangCodeBlock';
import { HELPER_SIGNATURES } from '../languages/helpers';
import { ALL_LANGUAGE_IDS } from '../languages/registry';
import type { HelperName } from '../languages/types';

// ─────────────────────────────────────────────
// Registry-driven helper code block generator
// ─────────────────────────────────────────────
function helperCodeBlock(name: HelperName): LanguageCodes {
  const result: LanguageCodes = {};
  for (const langId of ALL_LANGUAGE_IDS) {
    const sig = HELPER_SIGNATURES[langId]?.[name];
    if (sig) {
      (result as Record<string, string>)[langId] = sig.example;
    }
  }
  return result;
}

export interface DocSectionData {
  id: string;
  content: ReactNode;
}

// ─────────────────────────────────────────────
// Quick Start code blocks
// ─────────────────────────────────────────────

const MOVE_TO_CENTER_CODE = {
  javascript: `function tick(state, ship) {
  return move(state.mapWidth / 2, state.mapHeight / 2);
}`,
  typescript: `// @language: typescript
function tick(state: GameState, ship: BotShip): Command {
  return move(state.mapWidth / 2, state.mapHeight / 2);
}`,
  python: `# @language: python
def tick(state, ship):
    return move(state.map_width / 2, state.map_height / 2)`,
  kotlin: `// @language: kotlin
fun tick(state: dynamic, ship: dynamic): dynamic {
    return moveTo((state.mapWidth as Double) / 2, (state.mapHeight as Double) / 2)
}`,
  java: `// @language: java
dynamic tick(GameState state, BotShip ship) {
    return move(state.mapWidth / 2.0, state.mapHeight / 2.0);
}`,
  csharp: `// @language: csharp
dynamic Tick(GameState state, Ship ship) {
    return Move(state.MapWidth / 2.0, state.MapHeight / 2.0);
}`,
  swift: `// @language: swift
func tick(_ state: GameState, _ ship: BotShip) -> Command {
    return .move(x: state.mapWidth / 2, y: state.mapHeight / 2)
}`,
};

const CAPTURE_NEAREST_CODE = {
  javascript: `function tick(state, ship) {
  const target = nearestIsland(ship, islandsNotMine(state.islands));
  if (!target) return idle();
  return move(target.x, target.y);
}`,
  typescript: `// @language: typescript
function tick(state: GameState, ship: BotShip): Command {
  const target = nearestIsland(ship, islandsNotMine(state.islands));
  if (!target) return idle();
  return move(target.x, target.y);
}`,
  python: `# @language: python
def tick(state, ship):
    target = nearest_island(ship, islands_not_mine(state.islands))
    if target is None:
        return idle()
    return move(target.x, target.y)`,
  kotlin: `// @language: kotlin
fun tick(state: dynamic, ship: dynamic): dynamic {
    val target = nearestIsland(ship, islandsNotMine(state.islands))
        ?: return idle()
    return moveTo(target.x as Double, target.y as Double)
}`,
  java: `// @language: java
Command tick(GameState state, BotShip ship) {
    BotIsland target = nearestIsland(ship, islandsNotMine(state.islands));
    if (target == null) return idle();
    return move(target.x, target.y);
}`,
  csharp: `// @language: csharp
dynamic Tick(GameState state, Ship ship) {
    var target = NearestIsland(ship, IslandsNotMine(state.Islands));
    if (target == null) return Idle();
    return Move(target.X, target.Y);
}`,
  swift: `// @language: swift
func tick(_ state: GameState, _ ship: BotShip) -> Command {
    guard let target = nearestIsland(ship, islandsNotMine(state.islands)) else { return .idle }
    return .move(x: target.x, y: target.y)
}`,
};

const BOT_STRUCTURE_CODE = {
  javascript: `// Simple: just define tick()
function tick(state, ship) {
  return idle();
}

// Advanced: use createBot() for persistent state across ticks
function createBot() {
  const shipMode = {};
  let lastTick = 0;
  return {
    tick(state, ship) {
      lastTick = state.tick;
      return idle();
    }
  };
}`,
  typescript: `// @language: typescript
function tick(state: GameState, ship: BotShip): Command {
  return idle();
}

// Advanced: createBot() for persistent state
function createBot() {
  const shipMode: Record<number, string> = {};
  return {
    tick(state: GameState, ship: BotShip): Command {
      return idle();
    }
  };
}`,
  python: `# @language: python
# Simple: just define tick()
def tick(state, ship):
    return idle()

# Advanced: use create_bot() for persistent state
def create_bot():
    ship_mode = {}
    def tick(state, ship):
        return idle()
    return {'tick': tick}`,
  kotlin: `// @language: kotlin
// Top-level variables persist for the whole game.
val shipMode = mutableMapOf<Int, String>()

fun tick(state: dynamic, ship: dynamic): dynamic {
    return idle()
}`,
  java: `// @language: java
class Bot {
    private java.util.Map<Integer, String> shipMode = new java.util.HashMap<>();

    Command tick(GameState state, BotShip ship) {
        return idle();
    }
}`,
  csharp: `// @language: csharp
var shipMode = new Dictionary<int, string>();

dynamic Tick(GameState state, Ship ship) {
    return Idle();
}`,
  swift: `// @language: swift
var shipMode: [Int: String] = [:]

func tick(_ state: GameState, _ ship: BotShip) -> Command {
    return .idle
}`,
};

// ─────────────────────────────────────────────
// Type definitions
// ─────────────────────────────────────────────

const GAMESTATE_FIELDS_CODE = {
  typescript: `interface GameState {
  tick: number;           // Current tick (0-based)
  maxTicks: number;       // Total ticks (default: 15000)
  mapWidth: number;       // Map width in units (default: 700)
  mapHeight: number;      // Map height in units (default: 1000)
  islands: BotIsland[];   // ALL islands — owner from your perspective
  myShips: BotShip[];     // Your ships (alive + dead)
  enemyShips: BotShip[];  // Enemy ships (alive + dead)
  myScore: number;        // Your current score
  enemyScore: number;     // Enemy's current score
  targetScore: number;    // First to this wins (default: 10000)
  config: GameConfig;     // Full game configuration
}`,
  javascript: `state.tick          // number — current tick (0-based)
state.maxTicks      // number — total game ticks
state.mapWidth      // number — map width
state.mapHeight     // number — map height
state.islands       // BotIsland[] — all islands
state.myShips       // BotShip[] — your ships (alive + dead)
state.enemyShips    // BotShip[] — enemy ships (alive + dead)
state.myScore       // number — your score
state.enemyScore    // number — enemy score
state.targetScore   // number — win threshold
state.config        // GameConfig — all game settings`,
  python: `state.tick              # int   — current tick (0-based)
state.max_ticks         # int   — total game ticks
state.map_width         # float — map width
state.map_height        # float — map height
state.islands           # list  — BotIsland objects
state.my_ships          # list  — your BotShip objects
state.enemy_ships       # list  — enemy BotShip objects
state.my_score          # float — your score
state.enemy_score       # float — enemy score
state.target_score      # float — win threshold
state.config            # GameConfig — snake_case fields`,
  kotlin: `state.tick as Int           // current tick
state.maxTicks as Int       // total game ticks
state.mapWidth as Double    // map width
state.mapHeight as Double   // map height
asList(state.islands)       // List<dynamic>
asList(state.myShips)       // List<dynamic> — your ships
asList(state.enemyShips)    // List<dynamic> — enemy ships
state.myScore as Double     // your score
state.enemyScore as Double  // enemy score
state.targetScore as Double // win threshold`,
  java: `state.tick              // int    — current tick
state.maxTicks          // int    — total game ticks
state.mapWidth          // double — map width
state.mapHeight         // double — map height
state.islands           // BotIsland[]
state.myShips           // BotShip[]
state.enemyShips        // BotShip[]
state.myScore           // double — your score
state.enemyScore        // double — enemy score
state.targetScore       // double — win threshold
state.config            // GameConfig`,
  csharp: `state.Tick              // int           — current tick
state.MaxTicks          // int           — total game ticks
state.MapWidth          // double        — map width
state.MapHeight         // double        — map height
state.Islands           // IList<Island>
state.MyShips           // IList<Ship>
state.EnemyShips        // IList<Ship>
state.MyScore           // double
state.EnemyScore        // double
state.TargetScore       // double
state.Config            // GameConfig`,
  swift: `state.tick              // Int
state.maxTicks          // Int
state.mapWidth          // Double
state.mapHeight         // Double
state.islands           // [BotIsland]
state.myShips           // [BotShip]
state.enemyShips        // [BotShip]
state.myScore           // Double
state.enemyScore        // Double
state.targetScore       // Double
state.config            // GameConfig`,
};

const BOTSHIP_FIELDS_CODE = {
  typescript: `interface BotShip {
  id: number;            // Stable ID — never changes during a game
  x: number;            // Current X position
  y: number;            // Current Y position
  alive: boolean;       // false while respawning
  isCapturing: boolean; // true if inside an island's capture radius
  turnsToRevive: number;// 0 if alive; countdown ticks until respawn
  initialX: number;     // Respawn X (inside your safe zone)
  initialY: number;     // Respawn Y (inside your safe zone)
  combatPressure: number; // Consecutive ticks outnumbered (0 = safe)
}`,
  javascript: `ship.id              // number  — stable ship ID
ship.x               // number  — current X
ship.y               // number  — current Y
ship.alive           // boolean — false while respawning
ship.isCapturing     // boolean — inside island radius
ship.turnsToRevive   // number  — 0 if alive; countdown to respawn
ship.initialX        // number  — respawn X
ship.initialY        // number  — respawn Y
ship.combatPressure  // number  — ticks outnumbered (0 = safe)`,
  python: `ship.id               # int   — stable ship ID
ship.x                # float — current X
ship.y                # float — current Y
ship.alive            # bool  — False while respawning
ship.is_capturing     # bool  — inside island radius
ship.turns_to_revive  # int   — 0 if alive; countdown to respawn
ship.initial_x        # float — respawn X
ship.initial_y        # float — respawn Y
ship.combat_pressure  # int   — ticks outnumbered (0 = safe)`,
  kotlin: `ship.id as Int               // stable ship ID
ship.x as Double             // current X
ship.y as Double             // current Y
ship.alive as Boolean        // false while respawning
ship.isCapturing as Boolean  // inside island radius
ship.turnsToRevive as Int    // 0 if alive; countdown to respawn
ship.initialX as Double      // respawn X
ship.initialY as Double      // respawn Y
ship.combatPressure as Int   // ticks outnumbered (0 = safe)`,
  java: `ship.id              // int     — stable ship ID
ship.x               // double  — current X
ship.y               // double  — current Y
ship.alive           // boolean — false while respawning
ship.isCapturing     // boolean — inside island radius
ship.turnsToRevive   // int     — 0 if alive; countdown to respawn
ship.initialX        // double  — respawn X
ship.initialY        // double  — respawn Y
ship.combatPressure  // int     — ticks outnumbered`,
  csharp: `ship.Id              // int    — stable ship ID
ship.X               // double — current X
ship.Y               // double — current Y
ship.Alive           // bool   — false while respawning
ship.IsCapturing     // bool   — inside island radius
ship.TurnsToRevive   // int    — 0 if alive; countdown to respawn
ship.InitialX        // double — respawn X
ship.InitialY        // double — respawn Y
ship.CombatPressure  // int    — ticks outnumbered`,
  swift: `ship.id              // Int    — stable ship ID
ship.x               // Double — current X
ship.y               // Double — current Y
ship.alive           // Bool   — false while respawning
ship.isCapturing     // Bool   — inside island radius
ship.turnsToRevive   // Int    — 0 if alive; countdown to respawn
ship.initialX        // Double — respawn X
ship.initialY        // Double — respawn Y
ship.combatPressure  // Int    — ticks outnumbered`,
};

const BOTISLAND_FIELDS_CODE = {
  typescript: `interface BotIsland {
  id: number;               // Stable island ID
  x: number;                // X position
  y: number;                // Y position
  radius: number;           // Capture radius
  owner: 'me' | 'enemy' | 'neutral';
  teamCapturing: 'me' | 'enemy' | 'none';
  captureProgress: number;  // Ticks accumulated toward capture
  captureTurns: number;     // Ticks to fully capture from neutral
  value: number;            // 1 = normal, 2+ = treasure island
}`,
  javascript: `island.id              // number — stable island ID
island.x               // number — X position
island.y               // number — Y position
island.radius          // number — capture radius
island.owner           // string — 'me' | 'enemy' | 'neutral'
island.teamCapturing   // string — 'me' | 'enemy' | 'none'
island.captureProgress // number — progress ticks
island.captureTurns    // number — ticks to capture
island.value           // number — 1 = normal, 2+ = treasure`,
  python: `island.id               # int   — stable island ID
island.x                # float — X position
island.y                # float — Y position
island.radius           # float — capture radius
island.owner            # str   — 'me' | 'enemy' | 'neutral'
island.team_capturing   # str   — 'me' | 'enemy' | 'none'
island.capture_progress # int   — progress ticks
island.capture_turns    # int   — ticks to capture
island.value            # int   — 1 = normal, 2+ = treasure`,
  kotlin: `island.id as Int               // stable island ID
island.x as Double             // X position
island.y as Double             // Y position
island.radius as Double        // capture radius
island.owner as String         // "me" | "enemy" | "neutral"
island.teamCapturing as String // "me" | "enemy" | "none"
island.captureProgress as Int  // progress ticks
island.captureTurns as Int     // ticks to capture
island.value as Int            // 1 = normal, 2+ = treasure`,
  java: `island.id              // int     — stable island ID
island.x               // double  — X position
island.y               // double  — Y position
island.radius          // double  — capture radius
island.owner           // String  — "me" | "enemy" | "neutral"
island.teamCapturing   // String  — "me" | "enemy" | "none"
island.captureProgress // int     — progress ticks
island.captureTurns    // int     — ticks to capture
island.value           // int     — 1 = normal, 2+ = treasure`,
  csharp: `island.Id              // int    — stable island ID
island.X               // double — X position
island.Y               // double — Y position
island.Radius          // double — capture radius
island.Owner           // string — "me" | "enemy" | "neutral"
island.TeamCapturing   // string — "me" | "enemy" | "none"
island.CaptureProgress // int    — progress ticks
island.CaptureTurns    // int    — ticks to capture
island.Value           // int    — 1 = normal, 2+ = treasure`,
  swift: `island.id              // Int    — stable island ID
island.x               // Double — X position
island.y               // Double — Y position
island.radius          // Double — capture radius
island.owner           // String — "me" | "enemy" | "neutral"
island.teamCapturing   // String — "me" | "enemy" | "none"
island.captureProgress // Int    — progress ticks
island.captureTurns    // Int    — ticks to capture
island.value           // Int    — 1 = normal, 2+ = treasure`,
};

const COMMAND_CODE = {
  typescript: `interface Command {
  type: 'move' | 'idle';
  target?: { x: number; y: number };
}

return { type: 'idle' };
return { type: 'move', target: { x: 500, y: 200 } };
return { type: 'move', target: island };   // island has x and y
return { type: 'move', target: enemy };    // enemy ship has x and y`,
  javascript: `return { type: 'idle' };
return { type: 'move', target: { x: 500, y: 200 } };
return { type: 'move', target: island };
return { type: 'move', target: enemy };`,
  python: `return {'type': 'idle'}
return {'type': 'move', 'target': {'x': 500, 'y': 200}}
return {'type': 'move', 'target': {'x': island.x, 'y': island.y}}`,
  kotlin: `return idle()
return moveTo(500.0, 200.0)
return moveTo(island.x as Double, island.y as Double)`,
  java: `return Command.idle();
return Command.move(500, 200);
return Command.move(island.x, island.y);`,
  csharp: `return Command.Idle();
return Command.MoveTo(500, 200);
return Command.MoveTo(island.X, island.Y);`,
  swift: `return .idle
return .move(x: 500, y: 200)
return .move(x: island.x, y: island.y)`,
};

const GAMECONFIG_FIELDS_CODE = {
  typescript: `interface GameConfig {
  mapWidth: number;       // World width (default: 700)
  mapHeight: number;      // World height (default: 1000)
  shipSpeed: number;      // Units per tick (default: 5)
  attackRadius: number;   // Per-ship combat radius (default: 51)
  captureRadius: number;  // Island capture proximity (default: 50)
  captureTurns: number;   // Ticks to capture neutral island (default: 15)
  respawnDelay: number;   // Ticks to respawn after death (default: 20)
  gameDuration: number;   // Total game ticks (default: 15000)
  targetScore: number;    // Instant-win threshold (default: 10000)
  shipsPerPlayer: number; // Ships per team (default: 8)
  safeZoneWidth: number;  // Spawn zone width (default: 80)
  numIslands: number;     // Islands on map (default: 7)
  tickRateMs: number;     // Ms between ticks (default: 120)
  combatKillDelay: number;// Ticks outnumbered before dying (default: 8)
}`,
  javascript: `state.config.mapWidth        state.config.mapHeight
state.config.shipSpeed       state.config.attackRadius
state.config.captureRadius   state.config.captureTurns
state.config.respawnDelay    state.config.gameDuration
state.config.targetScore     state.config.shipsPerPlayer
state.config.safeZoneWidth   state.config.numIslands
state.config.tickRateMs      state.config.combatKillDelay`,
  python: `state.config.map_width        state.config.map_height
state.config.ship_speed       state.config.attack_radius
state.config.capture_radius   state.config.capture_turns
state.config.respawn_delay    state.config.game_duration
state.config.target_score     state.config.ships_per_player
state.config.safe_zone_width  state.config.num_islands
state.config.tick_rate_ms`,
  kotlin: `state.config.mapWidth as Double
state.config.mapHeight as Double
state.config.shipSpeed as Double
state.config.attackRadius as Double
state.config.captureTurns as Int
state.config.respawnDelay as Int`,
  java: `state.config.mapWidth        // double
state.config.mapHeight       // double
state.config.shipSpeed       // double
state.config.attackRadius    // double
state.config.captureTurns    // int
state.config.respawnDelay    // int
state.config.shipsPerPlayer  // int`,
  csharp: `state.Config.MapWidth        state.Config.MapHeight
state.Config.ShipSpeed       state.Config.AttackRadius
state.Config.CaptureRadius   state.Config.CaptureTurns
state.Config.RespawnDelay    state.Config.TargetScore`,
  swift: `state.config.mapWidth        state.config.mapHeight
state.config.shipSpeed       state.config.attackRadius
state.config.captureRadius   state.config.captureTurns
state.config.respawnDelay    state.config.shipsPerPlayer`,
};

// ─────────────────────────────────────────────
// Helper function examples
// ─────────────────────────────────────────────

const DISTANCE_TO_CODE = {
  javascript: `const d = distanceTo(ship, island);
if (distanceTo(ship, enemy) <= state.config.attackRadius) {
  // Enemy is in combat range
}`,
  typescript: `const d: number = distanceTo(ship, island);
if (distanceTo(ship, enemy) <= state.config.attackRadius) {
  // Enemy is in combat range
}`,
  python: `d = distance_to(ship, island)
if distance_to(ship, enemy) <= state.config.attack_radius:
    pass  # enemy in combat range`,
  kotlin: `val d = distanceTo(ship, island)
if (distanceTo(ship, enemy) <= (state.config.attackRadius as Double)) {
    // enemy in combat range
}`,
  java: `double d = BotHelpers.distanceTo(ship, island);
if (BotHelpers.distanceTo(ship, enemy) <= state.config.attackRadius) {
    // enemy in combat range
}`,
  csharp: `double d = DistanceTo(ship, island);
if (DistanceTo(ship, enemy) <= state.Config.AttackRadius) {
    // enemy in combat range
}`,
  swift: `let d = distanceTo(ship, island)
if distanceTo(ship, enemy) <= state.config.attackRadius {
    // enemy in combat range
}`,
};

const NEAREST_ISLAND_CODE = {
  javascript: `const nearest = nearestIsland(ship, state.islands);
const mine    = nearestIsland(ship, islandsOwnedBy(state.islands, 'me'));
const uncap   = nearestIsland(ship, islandsNotMine(state.islands));
if (nearest) return move(nearest.x, nearest.y);`,
  typescript: `const nearest = nearestIsland(ship, state.islands);
const mine    = nearestIsland(ship, islandsOwnedBy(state.islands, 'me'));
if (nearest) return { type: 'move', target: { x: nearest.x, y: nearest.y } };`,
  python: `nearest = nearest_island(ship, state.islands)
mine    = nearest_island(ship, islands_owned_by(state.islands, 'me'))
uncap   = nearest_island(ship, islands_not_mine(state.islands))
if nearest: return {'type': 'move', 'target': {'x': nearest.x, 'y': nearest.y}}`,
  kotlin: `val islands = asList(state.islands)
val nearest = islands.minByOrNull { distanceTo(ship, it) }
if (nearest != null) return moveTo(nearest.x as Double, nearest.y as Double)`,
  java: `BotIsland nearest = BotHelpers.nearestIsland(ship, state.islands);
if (nearest != null) return Command.move(nearest.x, nearest.y);`,
  csharp: `var nearest = NearestIsland(ship, state.Islands);
if (nearest != null) return Command.MoveTo(nearest.X, nearest.Y);`,
  swift: `let nearest = nearestIsland(ship, state.islands)
if let t = nearest { return .move(x: t.x, y: t.y) }`,
};

const ISLANDS_OWNED_CODE = {
  javascript: `const mine    = islandsOwnedBy(state.islands, 'me');
const enemy   = islandsOwnedBy(state.islands, 'enemy');
const neutral = islandsOwnedBy(state.islands, 'neutral');`,
  typescript: `const mine:    BotIsland[] = islandsOwnedBy(state.islands, 'me');
const enemy:   BotIsland[] = islandsOwnedBy(state.islands, 'enemy');
const neutral: BotIsland[] = islandsOwnedBy(state.islands, 'neutral');`,
  python: `mine    = islands_owned_by(state.islands, 'me')
enemy   = islands_owned_by(state.islands, 'enemy')
neutral = islands_owned_by(state.islands, 'neutral')`,
  kotlin: `val islands = asList(state.islands)
val mine    = islands.filter { it.owner == "me" }
val enemy   = islands.filter { it.owner == "enemy" }`,
  java: `BotIsland[] mine  = BotHelpers.islandsOwnedBy(state.islands, "me");
BotIsland[] enemy = BotHelpers.islandsOwnedBy(state.islands, "enemy");`,
  csharp: `var mine  = IslandsOwnedBy(state.Islands, "me");
var enemy = IslandsOwnedBy(state.Islands, "enemy");`,
  swift: `let mine  = islandsOwnedBy(state.islands, "me")
let enemy = islandsOwnedBy(state.islands, "enemy")`,
};

const ISLANDS_NOT_MINE_CODE = {
  javascript: `const targets = islandsNotMine(state.islands);
if (targets.length === 0) return idle();
return move(nearestIsland(ship, targets));`,
  typescript: `const targets: BotIsland[] = islandsNotMine(state.islands);
if (targets.length === 0) return { type: 'idle' };
const nearest = nearestIsland(ship, targets);
return { type: 'move', target: nearest! };`,
  python: `targets = islands_not_mine(state.islands)
if not targets:
    return idle()
nearest = nearest_island(ship, targets)
return {'type': 'move', 'target': {'x': nearest.x, 'y': nearest.y}}`,
  kotlin: `val targets = islandsNotMine(state.islands)
if (targets.isEmpty()) return idle()
val nearest = targets.minByOrNull { distanceTo(ship, it) } ?: return idle()
return moveTo(nearest.x as Double, nearest.y as Double)`,
  java: `BotIsland[] targets = BotHelpers.islandsNotMine(state.islands);
if (targets.length == 0) return Command.idle();
BotIsland nearest = BotHelpers.nearestIsland(ship, targets);
return nearest != null ? Command.move(nearest.x, nearest.y) : Command.idle();`,
  csharp: `var targets = IslandsNotMine(state.Islands);
if (!targets.Any()) return Command.Idle();
var nearest = targets.MinBy(i => DistanceTo(ship, i));
return Command.MoveTo(nearest.X, nearest.Y);`,
  swift: `let targets = islandsNotMine(state.islands)
if targets.isEmpty { return .idle }
guard let nearest = nearestIsland(ship, targets) else { return .idle }
return .move(x: nearest.x, y: nearest.y)`,
};

const NEAREST_ENEMY_CODE = {
  javascript: `const threat = nearestEnemy(ship, state.enemyShips);
if (threat && distanceTo(ship, threat) < 200) {
  return move(threat.x, threat.y);
}`,
  typescript: `const threat = nearestEnemy(ship, state.enemyShips);
if (threat && distanceTo(ship, threat) < 200) {
  return { type: 'move', target: { x: threat.x, y: threat.y } };
}`,
  python: `threat = nearest_enemy(ship, state.enemy_ships)
if threat and distance_to(ship, threat) < 200:
    return {'type': 'move', 'target': {'x': threat.x, 'y': threat.y}}`,
  kotlin: `val threat = asList(state.enemyShips).filter { it.alive as Boolean }
    .minByOrNull { distanceTo(ship, it) }
if (threat != null && distanceTo(ship, threat) < 200) {
    return moveTo(threat.x as Double, threat.y as Double)
}`,
  java: `BotShip threat = BotHelpers.nearestEnemy(ship, state.enemyShips);
if (threat != null && BotHelpers.distanceTo(ship, threat) < 200)
    return Command.move(threat.x, threat.y);`,
  csharp: `var threat = NearestEnemy(ship, state.EnemyShips);
if (threat != null && DistanceTo(ship, threat) < 200)
    return Command.MoveTo(threat.X, threat.Y);`,
  swift: `if let threat = nearestEnemy(ship, state.enemyShips), distanceTo(ship, threat) < 200 {
    return .move(x: threat.x, y: threat.y)
}`,
};

const SHIPS_NEAR_CODE = {
  javascript: `const enemies = shipsNear(island, state.enemyShips, island.radius);
const friends = shipsNear(island, state.myShips, island.radius);
if (enemies.length > 0 && friends.length >= enemies.length) {
  // Local superiority — contest this island
}`,
  typescript: `const enemies: BotShip[] = shipsNear(island, state.enemyShips, island.radius);
const friends: BotShip[] = shipsNear(island, state.myShips, island.radius);`,
  python: `enemies = ships_near(island, state.enemy_ships, island.radius)
friends = ships_near(island, state.my_ships, island.radius)
if len(enemies) > 0 and len(friends) >= len(enemies):
    pass  # local superiority`,
  kotlin: `val r = island.radius as Double
val enemies = asList(state.enemyShips).filter { it.alive as Boolean && distanceTo(island, it) <= r }
val friends = asList(state.myShips).filter   { it.alive as Boolean && distanceTo(island, it) <= r }`,
  java: `BotShip[] enemies = BotHelpers.shipsNear(island.x, island.y, state.enemyShips, island.radius);
BotShip[] friends = BotHelpers.shipsNear(island.x, island.y, state.myShips, island.radius);`,
  csharp: `var enemies = ShipsNear(island, state.EnemyShips, island.Radius);
var friends = ShipsNear(island, state.MyShips, island.Radius);`,
  swift: `let enemies = shipsNear(island, state.enemyShips, island.radius)
let friends = shipsNear(island, state.myShips, island.radius)`,
};

const WOULD_DIE_AT_CODE = {
  javascript: `const r = state.config.attackRadius;
const others = state.myShips.filter(s => s.id !== ship.id);
if (!wouldDieAt(island, others, state.enemyShips, r)) {
  return move(island.x, island.y);
}`,
  typescript: `const r = state.config.attackRadius;
const others = state.myShips.filter(s => s.id !== ship.id);
if (!wouldDieAt(island, others, state.enemyShips, r)) {
  return { type: 'move', target: island };
}`,
  python: `r = state.config.attack_radius
others = [s for s in state.my_ships if s.id != ship.id]
if not would_die_at(island, others, state.enemy_ships, r):
    return {'type': 'move', 'target': {'x': island.x, 'y': island.y}}`,
  kotlin: `val r = state.config.attackRadius as Double
val others = asList(state.myShips).filter { (it.id as Int) != (ship.id as Int) }
val enemiesNear = asList(state.enemyShips).count { it.alive as Boolean && distanceTo(island, it) <= r }
val friendsNear = others.count { it.alive as Boolean && distanceTo(island, it) <= r }
if (enemiesNear <= friendsNear) return moveTo(island.x as Double, island.y as Double)`,
  java: `double r = state.config.attackRadius;
BotShip[] others = java.util.Arrays.stream(state.myShips)
    .filter(s -> s.id != ship.id).toArray(BotShip[]::new);
if (!BotHelpers.wouldDieAt(island.x, island.y, others, state.enemyShips, r))
    return Command.move(island.x, island.y);`,
  csharp: `double r = state.Config.AttackRadius;
var others = state.MyShips.Where(s => s.Id != ship.Id).ToList();
if (!WouldDieAt(island, others, state.EnemyShips, r))
    return Command.MoveTo(island.X, island.Y);`,
  swift: `let r = state.config.attackRadius
let others = state.myShips.filter { $0.id != ship.id }
if !wouldDieAt(island, others, state.enemyShips, r) {
    return .move(x: island.x, y: island.y)
}`,
};

const SCORE_RATE_CODE = {
  javascript: `const myValue  = islandsOwnedBy(state.islands, 'me').reduce((s, i) => s + i.value, 0);
const eneValue = islandsOwnedBy(state.islands, 'enemy').reduce((s, i) => s + i.value, 0);
const myRate  = scoreRate(myValue);
const eneRate = scoreRate(eneValue);
if (eneRate > myRate) {
  // Losing — be more aggressive
}`,
  typescript: `const myRate:  number = scoreRate(islandsOwnedBy(state.islands, 'me').reduce((s, i) => s + i.value, 0));
const eneRate: number = scoreRate(islandsOwnedBy(state.islands, 'enemy').reduce((s, i) => s + i.value, 0));
const isLosing = eneRate > myRate;`,
  python: `my_rate  = score_rate(sum(i.value for i in islands_owned_by(state.islands, 'me')))
ene_rate = score_rate(sum(i.value for i in islands_owned_by(state.islands, 'enemy')))
is_losing = ene_rate > my_rate`,
  kotlin: `val myVal  = asList(state.islands).filter { it.owner == "me"    }.sumOf { it.value as Int }
val eneVal = asList(state.islands).filter { it.owner == "enemy" }.sumOf { it.value as Int }
// scoreRate: 2^(v-1)
fun scoreRate(v: Int) = if (v <= 0) 0.0 else Math.pow(2.0, (v-1).toDouble())`,
  java: `double myRate  = BotHelpers.scoreRate((int) java.util.Arrays.stream(BotHelpers.islandsOwnedBy(state.islands, "me")).mapToDouble(i -> i.value).sum());
double eneRate = BotHelpers.scoreRate((int) java.util.Arrays.stream(BotHelpers.islandsOwnedBy(state.islands, "enemy")).mapToDouble(i -> i.value).sum());`,
  csharp: `double myRate  = ScoreRate((int) state.Islands.Where(i => i.Owner == "me").Sum(i => i.Value));
double eneRate = ScoreRate((int) state.Islands.Where(i => i.Owner == "enemy").Sum(i => i.Value));`,
  swift: `let myRate  = scoreRate(state.islands.filter { $0.owner == "me"    }.reduce(0) { $0 + $1.value })
let eneRate = scoreRate(state.islands.filter { $0.owner == "enemy" }.reduce(0) { $0 + $1.value })`,
};

// ─────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────

export const docSections: DocSectionData[] = [
  // ════════════════════════════════════════
  // QUICK START
  // ════════════════════════════════════════
  {
    id: 'quick-start',
    content: (
      <>
        <h2 className="h2">⚡ Quick Start</h2>
        <p>
          Every bot is a <code>tick(state, ship)</code> function. The engine calls it{' '}
          <em>once per alive ship per tick</em> (~8.3 times/second). Return a <code>Command</code>{' '}
          to move or idle. Dead ships are skipped — no need to check <code>ship.alive</code>.
        </p>
        <div className="callout callout-info">
          <strong>🌐 7 languages supported:</strong> JavaScript, TypeScript, Python, Kotlin, Java,
          C#, and Swift. Open the <strong>Editor</strong>, pick your language, and start coding.
        </div>
        <div className="callout callout-tip">
          <strong>💡 Ready-to-run example?</strong> Open the <strong>Editor</strong> → click{' '}
          <strong>💡 Examples</strong> → load the <strong>Rusher</strong> bot instantly.
        </div>

        <h3 className="h3">Minimal Bot — &quot;Move to Center&quot;</h3>
        <MultiLangCodeBlock code={MOVE_TO_CENTER_CODE} />

        <h3 className="h3">Minimal Bot — &quot;Capture Nearest Island&quot;</h3>
        <MultiLangCodeBlock code={CAPTURE_NEAREST_CODE} />

        <h3 className="h3">Bot Structure &amp; Persistent State</h3>
        <p>
          Use <code>createBot()</code> to store state that persists across ticks (e.g. per-ship
          mode tracking). Without it, every tick starts fresh.
        </p>
        <MultiLangCodeBlock code={BOT_STRUCTURE_CODE} />
      </>
    ),
  },

  // ════════════════════════════════════════
  // TYPE REFERENCE
  // ════════════════════════════════════════
  {
    id: 'types',
    content: (
      <>
        <h2 className="h2">📦 Type Reference</h2>
        <p>
          These are the types your bot works with. All values are from your perspective —{' '}
          <code>&quot;me&quot;</code> means your team, <code>&quot;enemy&quot;</code> means the
          opponent. TypeScript shows the canonical definition; use the tabs for your language.
        </p>
      </>
    ),
  },

  // GameState
  {
    id: 'type-gamestate',
    content: (
      <>
        <h3 className="h3">GameState</h3>
        <p>
          The full game snapshot passed into <code>tick(state, ship)</code>. Read-only.
        </p>
        <MultiLangCodeBlock code={GAMESTATE_FIELDS_CODE} defaultLang="typescript" />
        <table className="prop-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['tick', 'number', 'Current tick (0-indexed). At 120ms/tick, tick 250 ≈ 30 seconds.'],
              ['maxTicks', 'number', 'Total game duration in ticks.'],
              ['mapWidth / mapHeight', 'number', 'Map dimensions in world units (not pixels).'],
              ['islands', 'BotIsland[]', 'All islands. Check owner/teamCapturing from your perspective.'],
              ['myShips', 'BotShip[]', 'All YOUR ships — includes dead ones (check alive flag).'],
              ['enemyShips', 'BotShip[]', 'All ENEMY ships — includes dead ones.'],
              ['myScore / enemyScore', 'number', 'Accumulated scores.'],
              ['targetScore', 'number', 'First to this score wins instantly.'],
              ['config', 'GameConfig', 'All game settings (speeds, radii, durations, etc).'],
            ].map(([f, t, d]) => (
              <tr key={f as string}>
                <td><span className="prop-name">{f}</span></td>
                <td><span className="prop-type">{t}</span></td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    ),
  },

  // BotShip
  {
    id: 'type-botship',
    content: (
      <>
        <h3 className="h3">BotShip</h3>
        <p>
          Represents a ship. The <code>ship</code> in <code>tick(state, ship)</code> is this type.
          Also appears in <code>state.myShips</code> and <code>state.enemyShips</code>.
        </p>
        <MultiLangCodeBlock code={BOTSHIP_FIELDS_CODE} defaultLang="typescript" />
        <div className="callout callout-info">
          <strong>📌 <code>isCapturing</code> is a position flag only.</strong>
          {' '}Ships inside an island&apos;s capture radius still fight normally.
        </div>
      </>
    ),
  },

  // BotIsland
  {
    id: 'type-botisland',
    content: (
      <>
        <h3 className="h3">BotIsland</h3>
        <p>
          Represents an island. All ownership fields use your perspective.
        </p>
        <MultiLangCodeBlock code={BOTISLAND_FIELDS_CODE} defaultLang="typescript" />
        <table className="prop-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["owner === 'me'", 'You control this island — it scores for you every tick.'],
              ["owner === 'enemy'", "Enemy controls this — it's scoring against you!"],
              ["owner === 'neutral'", 'Unclaimed. First to capture it starts scoring.'],
              ["teamCapturing === 'me'", 'Your ships are advancing the capture timer.'],
              ['captureProgress', 'Progress ticks: 0→captureTurns (neutral) or 0→captureTurns×2 (enemy).'],
              ['value', 'Scoring weight. value=2 counts as 2 islands in the exponential formula.'],
            ].map(([f, d]) => (
              <tr key={f as string}>
                <td><span className="prop-name">{f}</span></td>
                <td>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    ),
  },

  // Command
  {
    id: 'type-command',
    content: (
      <>
        <h3 className="h3">Command</h3>
        <p>
          What you return from <code>tick()</code>. The engine moves your ship at{' '}
          <code>state.config.shipSpeed</code> units/tick toward the target — no vector math needed.
        </p>
        <MultiLangCodeBlock code={COMMAND_CODE} defaultLang="typescript" />
      </>
    ),
  },

  // GameConfig
  {
    id: 'type-gameconfig',
    content: (
      <>
        <h3 className="h3">GameConfig</h3>
        <p>
          All game settings via <code>state.config</code>. Values may differ from defaults in custom
          games.
        </p>
        <MultiLangCodeBlock code={GAMECONFIG_FIELDS_CODE} defaultLang="typescript" />
        <div className="callout callout-tip">
          <strong>Always use config values, never hardcode numbers.</strong> Use{' '}
          <code>state.config.attackRadius</code> not <code>30</code>, etc.
        </div>
      </>
    ),
  },

  // ════════════════════════════════════════
  // HELPER FUNCTIONS
  // ════════════════════════════════════════
  {
    id: 'helpers',
    content: (
      <>
        <h2 className="h2">🛠 Helper Functions</h2>
        <p>
          Injected globally into your bot — no imports needed. Python uses{' '}
          <strong>snake_case</strong>, C# uses <strong>PascalCase</strong>, Java uses{' '}
          <strong>BotHelpers.method()</strong>.
        </p>
      </>
    ),
  },

  // Geometry
  {
    id: 'helper-geometry',
    content: (
      <>
        <h3 className="h3">Geometry Utilities</h3>

        <p>
          <strong><code>distanceTo(a, b)</code></strong> — Euclidean distance between two points.
        </p>
        <MultiLangCodeBlock code={DISTANCE_TO_CODE} />

        <p style={{ marginTop: '1.25rem' }}>
          <strong><code>distanceToSq(a, b)</code></strong> — Squared distance. Faster than{' '}
          <code>distanceTo</code> for comparisons (avoids sqrt).
        </p>
        <CodeBlock
          code={`// Use for range checks — avoids sqrt
const r = state.config.attackRadius;
if (distanceToSq(ship, enemy) < r * r) { /* in range */ }

// Python:  distance_to_sq(ship, enemy) < r * r
// Kotlin:  use distanceTo (distanceToSq may not be exposed)
// Java/C#: dx*dx + dy*dy < r*r  (manual)`}
        />

        <p style={{ marginTop: '1.25rem' }}>
          <strong><code>angleTo(from, to)</code></strong> — Angle in radians from one point to
          another (0 = right, π/2 = down). Usually you just pass a target to{' '}
          <code>move()</code> — use this for custom vector math.
        </p>
        <CodeBlock
          code={`// JavaScript/TypeScript:
const angle = angleTo(ship, target);  // radians in [-π, π]
const vx = Math.cos(angle) * state.config.shipSpeed;
const vy = Math.sin(angle) * state.config.shipSpeed;

// Python:  angle_to(ship, target)
// Kotlin:  angleTo(ship, target)
// Java:    BotHelpers.angleTo(ship, target)
// C#:      AngleTo(ship, target)
// Swift:   angleTo(ship, target)`}
        />
      </>
    ),
  },

  // Island helpers
  {
    id: 'helper-islands',
    content: (
      <>
        <h3 className="h3">Island Helpers</h3>

        <p>
          <strong><code>nearestIsland(ship, islands)</code></strong> — Closest island to a ship.
        </p>
        <MultiLangCodeBlock code={NEAREST_ISLAND_CODE} />

        <p style={{ marginTop: '1.25rem' }}>
          <strong><code>islandsOwnedBy(islands, owner)</code></strong> — Filter islands by owner
          (<code>&apos;me&apos;</code>, <code>&apos;enemy&apos;</code>, or{' '}
          <code>&apos;neutral&apos;</code>).
        </p>
        <MultiLangCodeBlock code={ISLANDS_OWNED_CODE} />

        <p style={{ marginTop: '1.25rem' }}>
          <strong><code>islandsNotMine(islands)</code></strong> — All islands you don&apos;t own
          (enemy + neutral).
        </p>
        <MultiLangCodeBlock code={ISLANDS_NOT_MINE_CODE} />

        <p style={{ marginTop: '1.25rem' }}>
          <strong><code>nearestIslandOwnedBy(ship, islands, owner)</code></strong> — Shorthand for{' '}
          <code>nearestIsland(ship, islandsOwnedBy(islands, owner))</code>.
        </p>
        <CodeBlock
          code={`// JavaScript/TypeScript:
nearestIslandOwnedBy(ship, state.islands, 'neutral')

// Python:
nearest_island_owned_by(ship, state.islands, 'neutral')`}
        />
      </>
    ),
  },

  // Ship helpers
  {
    id: 'helper-ships',
    content: (
      <>
        <h3 className="h3">Ship Helpers</h3>

        <p>
          <strong><code>nearestEnemy(ship, enemies)</code></strong> — Nearest alive enemy ship.
        </p>
        <MultiLangCodeBlock code={NEAREST_ENEMY_CODE} />

        <p style={{ marginTop: '1.25rem' }}>
          <strong><code>shipsNear(point, ships, radius)</code></strong> — Alive ships within a
          radius of a point.
        </p>
        <MultiLangCodeBlock code={SHIPS_NEAR_CODE} />

        <p style={{ marginTop: '1.25rem' }}>
          <strong><code>shipsSortedByDistance(point, ships)</code></strong> — Ships sorted
          nearest-first (alive only).
        </p>
        <CodeBlock
          code={`// JavaScript/TypeScript:
const closest3 = shipsSortedByDistance(ship, state.enemyShips).slice(0, 3);

// Python:
closest3 = ships_sorted_by_distance(ship, state.enemy_ships)[:3]

// Kotlin:
val closest3 = asList(state.enemyShips)
    .filter { it.alive as Boolean }
    .sortedBy { distanceTo(ship, it) }.take(3)`}
        />

        <p style={{ marginTop: '1.25rem' }}>
          <strong><code>freeShips(ships)</code></strong> — Alive ships NOT inside any island radius.
        </p>
        <CodeBlock
          code={`// JavaScript/TypeScript:
const available = freeShips(state.myShips);

// Python:  free_ships(state.my_ships)
// Kotlin:  asList(state.myShips).filter { it.alive as Boolean && !(it.isCapturing as Boolean) }
// Java:    BotHelpers.freeShips(state.myShips)
// C#:      FreeShips(state.MyShips)
// Swift:   freeShips(state.myShips)`}
        />

        <p style={{ marginTop: '1.25rem' }}>
          <strong><code>aliveCount(ships, excludeCapturing?)</code></strong> — Count alive ships.
        </p>
        <CodeBlock
          code={`// JavaScript/TypeScript:
aliveCount(state.myShips)          // all alive
aliveCount(state.myShips, true)    // alive + not near any island

// Python:  alive_count(state.my_ships, exclude_capturing=True)`}
        />
      </>
    ),
  },

  // Combat helpers
  {
    id: 'helper-combat',
    content: (
      <>
        <h3 className="h3">Combat Helpers</h3>

        <p>
          <strong><code>wouldDieAt(position, myShips, enemyShips, attackRadius)</code></strong> —
          Predict whether moving to a position would get this ship killed (outnumbered by enemies).
        </p>
        <MultiLangCodeBlock code={WOULD_DIE_AT_CODE} />
        <div className="callout callout-info">
          Returns <code>true</code> if enemy ships in <code>attackRadius</code> of{' '}
          <code>position</code> outnumber friendly ships. The calling ship is NOT counted as a
          friendly — conservative by design (a 1v1 is flagged as dangerous even though both survive).
        </div>
      </>
    ),
  },

  // Scoring helper
  {
    id: 'helper-scoring',
    content: (
      <>
        <h3 className="h3">Scoring Helpers</h3>

        <p>
          <strong><code>scoreRate(totalValue)</code></strong> — Points per tick for a given total
          island value. Formula: <code>2^(totalValue - 1)</code>.
        </p>
        <MultiLangCodeBlock code={SCORE_RATE_CODE} />
      </>
    ),
  },

  // ════════════════════════════════════════
  // GAME MECHANICS
  // ════════════════════════════════════════
  {
    id: 'mechanics',
    content: (
      <>
        <h2 className="h2">⚙️ Game Mechanics</h2>
        <p>
          Understanding these rules is the difference between a bot that stumbles around and one
          that wins.
        </p>
      </>
    ),
  },

  // Combat mechanics
  {
    id: 'mechanics-combat',
    content: (
      <>
        <h3 className="h3">⚔️ Combat System — Per-Ship Radius Evaluation</h3>
        <p>
          Combat is <strong>passive and positional</strong> — no attack commands. After all ships
          move, the engine checks each ship:
        </p>
        <ul>
          <li>Count enemy ships within <code>attackRadius</code> of this ship.</li>
          <li>Count friendly ships within <code>attackRadius</code>, <strong>including the ship itself</strong>.</li>
          <li>If <code>enemies &gt; friendlies</code> → ship gains <code>combatPressure</code>. After <strong>8 consecutive ticks</strong> outnumbered → ship dies.</li>
          <li>If <code>enemies ≤ friendlies</code> → ship survives; pressure resets.</li>
        </ul>
        <table className="combat-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Result</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['1 vs 1', 'Both survive', '1f (self) vs 1e → equal → both survive'],
              ['2 vs 1', 'Lone ship dies', 'Lone: 1f vs 2e → dies. Pair: 2f vs 1e → survive'],
              ['3 vs 2', 'The 2 die', 'Each of the 2: 2f vs 3e → die. Each of 3: 3f vs 2e → survive'],
              ['2 vs 2 (grouped)', 'All 4 survive', '2f vs 2e → equal → survive'],
            ].map(([s, r, w]) => (
              <tr key={s as string}>
                <td style={{ color: '#fbbf24' }}>{s}</td>
                <td>{r}</td>
                <td style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{w}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="callout callout-tip">
          <strong>💡 Always move in groups of 2+.</strong> A lone ship loses to any 2-ship group.
          Two grouped ships beat one lone enemy while both survive.
        </div>
      </>
    ),
  },

  // Capture mechanics
  {
    id: 'mechanics-capture',
    content: (
      <>
        <h3 className="h3">🏝️ Island Capture System</h3>
        <p>
          A ship must stay within the island&apos;s <code>radius</code> to capture it.
        </p>
        <ul>
          <li><strong>Neutral island:</strong> Stay for <code>captureTurns</code> ticks (default: 15) → yours.</li>
          <li><strong>Enemy island:</strong> 15 ticks to neutralize + 15 more to capture = 30 total.</li>
          <li><strong>Contested:</strong> Both teams present → capture progress <strong>paused</strong> for everyone.</li>
          <li><strong>Abandoned:</strong> All your ships leave the radius → progress <strong>resets to 0</strong>.</li>
        </ul>
        <div className="callout callout-warn">
          <strong>⚠️ Leaving resets to zero.</strong> Contesting just pauses progress. Leaving — even briefly — resets it.
        </div>
        <CodeBlock
          code={`// Detect a contested island being captured (JavaScript):
for (const island of islandsOwnedBy(state.islands, 'me')) {
  if (island.teamCapturing === 'enemy') {
    const defenders = shipsNear(island, state.myShips, island.radius);
    if (defenders.length === 0) return move(island.x, island.y);
  }
}`}
        />
      </>
    ),
  },

  // Scoring mechanics
  {
    id: 'mechanics-scoring',
    content: (
      <>
        <h3 className="h3">📈 Exponential Scoring</h3>
        <p>
          Each additional island <em>doubles</em> your scoring rate.{' '}
          Formula: <code>pointsPerTick = 2^(totalIslandValue - 1)</code>.
        </p>
        <table className="score-table">
          <thead>
            <tr>
              <th>Islands Held</th>
              <th>Points / Tick</th>
              <th>Points / Second</th>
              <th>Points / Minute</th>
            </tr>
          </thead>
          <tbody>
            {[
              [0, 0, 0, 0],
              [1, 1, 8.3, 500],
              [2, 2, 16.7, 1000],
              [3, 4, 33.3, 2000],
              [4, 8, 66.7, 4000],
              [5, 16, 133.3, 8000],
              [6, 32, 266.7, 16000],
              [7, 64, 533.3, 32000],
            ].map(([n, ppt, pps, ppm]) => (
              <tr key={n}>
                <td>{n} island{n !== 1 ? 's' : ''}</td>
                <td><span className={n >= 4 ? 'score-big' : ''}>{ppt}</span></td>
                <td>{pps}</td>
                <td>{(ppm as number).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="callout callout-warn">
          <strong>🎯 Going from 3 to 4 islands doubles your rate.</strong> Attack enemy islands to
          halve their rate while doubling yours.
        </div>
        <CodeBlock
          code={`// Race projection (JavaScript):
const myRate  = scoreRate(islandsOwnedBy(state.islands, 'me').reduce((s, i) => s + i.value, 0));
const eneRate = scoreRate(islandsOwnedBy(state.islands, 'enemy').reduce((s, i) => s + i.value, 0));
if (eneRate > myRate * 2) { /* Take islands — enemy is pulling away */ }`}
        />
      </>
    ),
  },

  // Safe zones
  {
    id: 'mechanics-safezone',
    content: (
      <>
        <h3 className="h3">🛡️ Safe Zones &amp; Respawn</h3>
        <p>
          Each player has a safe zone where enemy ships cannot enter. Ships respawn here after death.
        </p>
        <ul>
          <li>Safe zone width = <code>state.config.safeZoneWidth</code> (default: 80 units).</li>
          <li>Dead ships respawn after <code>state.config.respawnDelay</code> ticks (default: 20 = 2.4s) at <code>ship.initialX, ship.initialY</code>.</li>
          <li>Check <code>ship.turnsToRevive</code> to time coordinated attacks.</li>
        </ul>
        <CodeBlock
          code={`// Plan around respawns (JavaScript):
for (const ship of state.myShips) {
  if (!ship.alive) {
    // ship.turnsToRevive ticks until it's back at (ship.initialX, ship.initialY)
  }
}`}
        />
      </>
    ),
  },

  // Tick rate
  {
    id: 'mechanics-tick',
    content: (
      <>
        <h3 className="h3">⏱ Tick Rate &amp; Timing</h3>
        <ul>
          <li><strong>Default:</strong> 120ms/tick ≈ 8.3 ticks/second.</li>
          <li><strong>Order:</strong> bot code → move → combat → capture → score → win check.</li>
          <li><strong>All ships move simultaneously</strong> — no turn advantage.</li>
          <li><strong>Keep <code>tick()</code> fast</strong> — slow bots idle that tick.</li>
        </ul>
        <CodeBlock
          code={`// Useful timing constants (at defaults):
// 8.33 ticks/s × 60s = 500 ticks/minute
// 15000 ticks = 30 minutes
// respawn: 20 ticks = 2.4s
// capture: 15 ticks = 1.8s
// cross map: 700 / 5 = 140 ticks`}
        />
      </>
    ),
  },

  // ════════════════════════════════════════
  // STRATEGY TIPS
  // ════════════════════════════════════════
  {
    id: 'strategy',
    content: (
      <>
        <h2 className="h2">🧭 Strategy Tips</h2>
        <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
          {[
            {
              title: '⚡ Early Game: Race to Islands',
              body: `Every uncaptured island is permanent exponential advantage. Send all ships to different islands using a greedy spread. Don't fight early — every second fighting is a second not capturing.`,
            },
            {
              title: '🔢 Fight with Numerical Advantage',
              body: `A 1v1 results in both ships surviving (equal = tie). Only when you outnumber the enemy does someone die. Always approach with 2+ ships to guarantee a kill.`,
            },
            {
              title: '🏝️ Capture and Fight — No Penalty',
              body: `Ships inside an island capture radius still fight normally. The key risk: if ALL your ships leave the radius, progress resets to 0. Keep at least one ship in place.`,
            },
            {
              title: '📈 The Math of Catching Up',
              body: `If the enemy holds 3 islands (4 pts/tick) and you hold 1 (1 pt/tick), they score 4× faster. Use scoreRate() to quantify the gap and decide when a risky assault is worth it.`,
            },
            {
              title: '🛡️ Defend What You Have',
              body: `An island being neutralized (teamCapturing === 'enemy') is captured in 30 ticks. Check for contested islands every tick and dispatch the nearest free ship immediately.`,
            },
            {
              title: '🎯 Enemy Islands Over Neutral',
              body: `Taking a neutral island: +1 for you. Taking an enemy island: +1 for you AND -1 for them (effectively +2). Always prioritize enemy-held islands, especially late game.`,
            },
            {
              title: '💀 Use Respawn Timing',
              body: `Dead ships respawn in 20 ticks. Check turnsToRevive to time coordinated attacks — don't commit your full fleet if half are about to respawn and can join the push.`,
            },
            {
              title: '🗃️ Use Per-Ship State',
              body: `The createBot() closure persists all game. Key ships by ship.id to track modes and targets. This prevents rapid jitter and enables multi-tick plans like "stay on this island for 20 ticks".`,
            },
          ].map((tip) => (
            <div
              key={tip.title}
              style={{
                background: '#0f172a',
                border: '1px solid #1e3a5f',
                borderRadius: 8,
                padding: '1rem 1.25rem',
              }}
            >
              <p style={{ color: '#fbbf24', fontWeight: 600, marginBottom: '0.4rem' }}>
                {tip.title}
              </p>
              <p style={{ fontSize: '0.87rem', marginBottom: 0 }}>{tip.body}</p>
            </div>
          ))}
        </div>
      </>
    ),
  },

  // ════════════════════════════════════════
  // EXAMPLE BOTS
  // ════════════════════════════════════════
  {
    id: 'example-bots',
    content: (
      <>
        <h2 className="h2">🤖 Example Bots</h2>
        <p>
          Study the Rusher bot — it demonstrates practical techniques you can borrow, adapt, and
          improve. Load it from the <strong>Editor → Examples</strong> tab.
        </p>
      </>
    ),
  },

  // Rusher bot
  {
    id: 'bot-rusher',
    content: (
      <>
        <h3 className="h3">Rusher Bot ⚡</h3>
        <p>
          <strong>Philosophy:</strong> Move fast, spread wide, don&apos;t fight unless incidental.
          Uses a <em>greedy spread algorithm</em> to assign each ship to a different uncaptured
          island, prioritizing enemy islands to stop their exponential scoring.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <span className="mode-badge mode-capture">capture-first</span>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', alignSelf: 'center' }}>
            Difficulty: <strong style={{ color: '#86efac' }}>Easy</strong> to understand
          </span>
        </div>
        <ul>
          <li><strong>Greedy spread:</strong> Ships sorted by ID get stable rank-based island assignments — no pile-ups.</li>
          <li><strong>Enemy-first priority:</strong> Enemy islands get a <code>-5000</code> distance bonus so they&apos;re always picked first.</li>
          <li><strong>Fallback:</strong> When all islands are captured, defend contested ones.</li>
        </ul>
        <CodeBlock
          label="rusher.js"
          code={`function createBot() {
  return {
    tick(state, ship) {
      if (!ship.alive) return { type: 'idle' };

      const enemies   = islandsOwnedBy(state.islands, 'enemy');
      const neutral   = islandsOwnedBy(state.islands, 'neutral');
      const uncaptured = [...enemies, ...neutral];

      // ── All islands mine: defend contested ones ──
      if (uncaptured.length === 0) {
        const contested = state.islands.filter(
          i => i.owner === 'me' && i.teamCapturing === 'enemy'
        );
        if (contested.length > 0) {
          const t = nearestIsland(ship, contested);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        const mine = islandsOwnedBy(state.islands, 'me');
        if (mine.length > 0) {
          const t = nearestIsland(ship, mine);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // ── Greedy spread: claim best uncaptured island ──
      const alive = state.myShips
        .filter(s => s.alive)
        .sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex(s => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      const score = (island, fromShip) =>
        distanceTo(fromShip, island) - (island.owner === 'enemy' ? 5000 : 0);

      const claimed = new Set();
      for (let r = 0; r < myRank; r++) {
        const other = alive[r];
        const available = uncaptured.filter(i => !claimed.has(i.id));
        if (available.length === 0) break;
        const best = available.reduce((b, i) =>
          score(i, other) < score(b, other) ? i : b
        );
        claimed.add(best.id);
      }

      const remaining = uncaptured.filter(i => !claimed.has(i.id));
      const pool = remaining.length > 0 ? remaining : uncaptured;

      const target = pool.reduce((b, i) =>
        score(i, ship) < score(b, ship) ? i : b
      );

      return { type: 'move', target: { x: target.x, y: target.y } };
    },
  };
}`}
        />
        <div className="callout callout-tip">
          <strong>Key pattern to steal:</strong> The greedy spread (sort by ID, each ship claims
          the best remaining) is reusable. The score function with an enemy bonus is a clean way
          to encode priorities without complex branching.
        </div>
        <p><strong>Weaknesses:</strong></p>
        <ul>
          <li>No combat grouping — attack lone Rusher ships 2v1.</li>
          <li>After capturing everything, Rushers go passive.</li>
          <li>Ships are often isolated and easy to pick off.</li>
        </ul>
      </>
    ),
  },
];
