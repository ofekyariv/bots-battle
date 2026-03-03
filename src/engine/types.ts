// ============================================================
// 🏴‍☠️ Bots Battle — Core Game Types
// ============================================================
//
// Two-layer type system:
//   • Internal state  — uses Owner = "player1" | "player2" | "neutral"
//   • Bot-facing API  — uses BotOwner = "me" | "enemy" | "neutral"
//
// The GameEngine translates internal → bot-facing when calling tick().
// ============================================================

// ─────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────

/**
 * Complete configuration for a game session.
 * All numeric fields use the same unit system (pixels/units on the map grid).
 * Pass a `Partial<GameConfig>` to `GameEngine` to override individual values;
 * unspecified fields fall back to {@link DEFAULT_CONFIG}.
 *
 * @see DEFAULT_CONFIG for the runtime defaults used in production.
 */
export interface GameConfig {
  /** Width of the playable map in units. default: 1000 */
  mapWidth: number;
  /** Height of the playable map in units. default: 700 */
  mapHeight: number;
  /** Units a ship travels per tick. default: 5 */
  shipSpeed: number;
  /** Per-ship combat evaluation radius. default: 51 */
  attackRadius: number;
  /** Distance from island center within which ships capture it. default: 50 */
  captureRadius: number;
  /** Ticks required to capture a neutral island. Enemy islands take 2× this. default: 15 */
  captureTurns: number;
  /** Ticks a destroyed ship waits before respawning at its initial position. default: 20 */
  respawnDelay: number;
  /** Total game length in ticks; game ends by timeout if no score win. default: 15000 */
  gameDuration: number;
  /** First player to reach this score wins immediately. default: 10000 */
  targetScore: number;
  /** Number of ships controlled by each player. default: 8 */
  shipsPerPlayer: number;
  /** X-width of each player's protected spawn zone on their side of the map. default: 80 */
  safeZoneWidth: number;
  /** Number of islands generated on the map. default: 7 */
  numIslands: number;
  /** Milliseconds between engine ticks (lower = faster game). default: 120 */
  tickRateMs: number;
  /**
   * Minimum distance from any island center to any map edge.
   * Prevents islands from spawning right at the border.
   * default: 150
   */
  islandEdgeMargin: number;
  /**
   * Number of consecutive ticks a ship must be outnumbered before it is destroyed.
   * Higher values give ships time to escape or get reinforcements.
   * default: 8
   */
  combatKillDelay: number;
}

/**
 * Production defaults used when no override is specified.
 *
 * These values are **authoritative** — documentation should reflect these, not vice versa.
 * Tune individual settings by passing `Partial<GameConfig>` to `new GameEngine(...)`.
 *
 * @example
 * // Custom game with double speed and half the islands:
 * const engine = new GameEngine(bot1, bot2, { shipSpeed: 10, numIslands: 3 });
 */
export const DEFAULT_CONFIG: GameConfig = {
  mapWidth: 1000,
  mapHeight: 700,
  shipSpeed: 5,
  attackRadius: 51,
  captureRadius: 50,
  captureTurns: 15,
  respawnDelay: 20,
  gameDuration: 15000,
  targetScore: 10000,
  shipsPerPlayer: 8,
  safeZoneWidth: 80,
  numIslands: 7,
  tickRateMs: 120,
  islandEdgeMargin: 150,
  combatKillDelay: 8,
};

// ─────────────────────────────────────────────
// Internal owner / team types (engine-side)
// ─────────────────────────────────────────────

/**
 * Internal owner identifier used inside the engine.
 * Never exposed directly to bots — translated to {@link BotOwner} first.
 */
export type Owner = 'player1' | 'player2' | 'neutral';

/**
 * Which team is currently advancing an island's capture timer.
 * `"none"` means the island is uncontested and not being captured.
 * Used internally; bots see {@link BotTeamCapturing} instead.
 */
export type TeamCapturing = 'player1' | 'player2' | 'none';

// ─────────────────────────────────────────────
// Bot-facing owner / team types (API-side)
// The engine remaps player1/player2 → me/enemy before calling tick()
// ─────────────────────────────────────────────

/**
 * Island or ship ownership from a specific bot's perspective.
 * The engine remaps `"player1"`/`"player2"` to `"me"`/`"enemy"` before calling `tick()`.
 */
export type BotOwner = 'me' | 'enemy' | 'neutral';

/**
 * Which team is currently advancing an island's capture timer, from a bot's perspective.
 * `"none"` means no capture is in progress.
 */
export type BotTeamCapturing = 'me' | 'enemy' | 'none';

// ─────────────────────────────────────────────
// Internal Ship (engine)
// ─────────────────────────────────────────────

/**
 * Internal ship state managed by the engine.
 * Bots never receive a `Ship` directly — they receive {@link BotShip}, which
 * strips the `owner` field and presents data from the bot's own perspective.
 */
export interface Ship {
  /** Stable ID for this ship — never changes during a game */
  id: number;
  /** Which player owns this ship */
  owner: Owner;
  x: number;
  y: number;
  /** false while waiting to respawn */
  alive: boolean;
  /**
   * true if the ship is within an island's capture radius this tick.
   * This is a tracking flag only — capturing ships still participate
   * in combat normally (attack, be attacked, provide support).
   */
  isCapturing: boolean;
  /** 0 when alive; counts down each tick when dead */
  turnsToRevive: number;
  /** Fixed respawn X position (inside the player's safe zone) */
  initialX: number;
  /** Fixed respawn Y position (inside the player's safe zone) */
  initialY: number;
  /** Consecutive ticks this ship has been outnumbered in combat (0 = safe) */
  combatPressure: number;
}

// ─────────────────────────────────────────────
// Internal Island (engine)
// ─────────────────────────────────────────────

/**
 * Internal island state managed by the engine.
 * Bots receive {@link BotIsland}, which translates `owner`/`teamCapturing`
 * to the bot's own perspective (`"me"` / `"enemy"`).
 */
export interface Island {
  /** Stable ID — never changes during a game */
  id: number;
  x: number;
  y: number;
  /** Capture proximity radius (ships must be within this) */
  radius: number;
  /** Current controller */
  owner: Owner;
  /** Which team is currently advancing the capture timer */
  teamCapturing: TeamCapturing;
  /**
   * Current capture progress in ticks.
   * Range: 0 → captureTurns for neutral islands.
   * Range: 0 → captureTurns*2 for enemy islands (neutralize + capture).
   */
  captureProgress: number;
  /** Ticks required to capture a neutral island */
  captureTurns: number;
  /**
   * Scoring weight: 1 = normal, 2+ = treasure island.
   * Used in exponential scoring formula: total = 2^(sum(values) - 1)
   */
  value: number;
}

// ─────────────────────────────────────────────
// Bot-facing Ship (what bots receive in tick())
// ─────────────────────────────────────────────

/**
 * Ship as seen by a bot.
 * The engine translates owner from "player1"/"player2" → "me"/"enemy"
 * before passing state into tick().
 */
export interface BotShip {
  id: number;
  x: number;
  y: number;
  alive: boolean;
  /** True if this ship is inside an island capture radius.
   *  Tracking only — the ship still participates in combat normally. */
  isCapturing: boolean;
  /** 0 if alive; ticks remaining until respawn */
  turnsToRevive: number;
  /** This ship's fixed respawn position */
  initialX: number;
  initialY: number;
  /** Consecutive ticks this ship has been outnumbered (0 = safe). Use to detect danger and retreat. */
  combatPressure: number;
}

// ─────────────────────────────────────────────
// Bot-facing Island (what bots receive in tick())
// ─────────────────────────────────────────────

/**
 * Island as seen by a bot inside `tick()`.
 * `owner` and `teamCapturing` use the bot's own perspective (`"me"`/`"enemy"`).
 *
 * Key behaviours to know:
 * - Neutral island: park ships for `captureTurns` ticks to own it.
 * - Enemy island: neutralize (captureTurns) then capture (captureTurns again) = 2× total.
 * - If BOTH teams have ships in the radius → progress is **paused** for both.
 * - If ALL ships leave mid-capture → progress **resets** to 0.
 */
export interface BotIsland {
  /** Stable ID — never changes during a game */
  id: number;
  /** Center X of the island */
  x: number;
  /** Center Y of the island */
  y: number;
  /** Capture proximity radius — ships must be within this distance to contribute */
  radius: number;
  /** Who currently owns this island from this bot's perspective */
  owner: BotOwner;
  /** Which team is currently advancing the capture timer */
  teamCapturing: BotTeamCapturing;
  /**
   * Ticks of capture progress accumulated so far.
   * For neutral islands: ranges 0 → `captureTurns`.
   * For enemy islands: ranges 0 → `captureTurns * 2` (neutralize + capture).
   */
  captureProgress: number;
  /** Ticks required to capture this island from neutral */
  captureTurns: number;
  /**
   * Scoring weight used in the exponential formula.
   * `1` = normal island, `2+` = treasure island (counts as multiple in `2^(sum-1)`).
   */
  value: number;
}

// ─────────────────────────────────────────────
// Bot-facing Command (what bots return from tick())
// ─────────────────────────────────────────────

/**
 * A command returned by a bot's `tick()` for one ship.
 *
 * @example
 * // Move toward an island
 * return { type: 'move', target: { x: island.x, y: island.y } };
 *
 * @example
 * // Do nothing this tick
 * return { type: 'idle' };
 */
export interface Command {
  /** `'move'` to navigate toward `target`; `'idle'` to hold position */
  type: 'move' | 'idle';
  /** Destination coordinates. Required when `type === 'move'`; ignored otherwise. */
  target?: { x: number; y: number };
}

// ─────────────────────────────────────────────
// Bot-facing GameState (passed into tick())
// ─────────────────────────────────────────────

/**
 * Complete game snapshot from one bot's perspective.
 * `myShips` / `myScore` refer to the calling bot's player.
 */
export interface GameState {
  tick: number;
  maxTicks: number;
  mapWidth: number;
  mapHeight: number;
  /** All islands — owner/teamCapturing translated to "me"/"enemy" perspective */
  islands: BotIsland[];
  /** The calling bot's ships */
  myShips: BotShip[];
  /** The opponent's ships */
  enemyShips: BotShip[];
  myScore: number;
  enemyScore: number;
  targetScore: number;
  config: GameConfig;
}

// ─────────────────────────────────────────────
// Bot instance interface (what player code implements)
// ─────────────────────────────────────────────

export interface BotInstance {
  /**
   * Called once per ship per tick.
   * @param state  Full game snapshot from this bot's perspective
   * @param ship   The specific ship to command
   * @returns      A Command for this ship this tick
   */
  tick(state: GameState, ship: BotShip): Command;
}

/** A factory function that creates a BotInstance */
export type BotFactory = () => BotInstance;

// ─────────────────────────────────────────────
// Player state (internal engine tracking)
// ─────────────────────────────────────────────

/**
 * Per-player metadata tracked by the engine each tick.
 * This is the internal representation — bots see scores through
 * `myScore`/`enemyScore` on `GameState`.
 */
export interface PlayerState {
  /** Which player this state belongs to */
  id: 'player1' | 'player2';
  /** Cumulative score accumulated so far */
  score: number;
  /** Ordered list of ship IDs belonging to this player */
  shipIds: number[];
  /** Number of islands currently owned (updated each tick by scoring) */
  islandsHeld: number;
  /** Points earned on the most recent tick (useful for rate displays in the UI) */
  lastTickPoints: number;
}

// ─────────────────────────────────────────────
// Spawn point (one per ship, per player)
// ─────────────────────────────────────────────

/**
 * Fixed spawn position for one ship, as returned by {@link generateSpawnPoints}.
 * Player 1 ships spawn in the left safe zone; Player 2 in the right safe zone.
 */
export interface SpawnPoint {
  /** Which player owns this spawn point */
  owner: Owner;
  /** X coordinate of the spawn position */
  x: number;
  /** Y coordinate of the spawn position */
  y: number;
}

// ─────────────────────────────────────────────
// Full internal game state (engine-side)
// ─────────────────────────────────────────────

/**
 * Lifecycle state of the game engine.
 * - `"idle"` — initialized but not started
 * - `"running"` — tick interval is active
 * - `"paused"` — tick interval suspended; can be resumed
 * - `"finished"` — game over; `FullGameState.result` is populated
 */
export type GameStatus = 'idle' | 'running' | 'paused' | 'finished';

/**
 * How the game ended.
 * - `"score"` — a player reached `targetScore`
 * - `"timeout"` — `gameDuration` ticks elapsed; highest score wins
 */
export type WinCondition = 'score' | 'timeout';

/**
 * Final outcome of a completed game, populated in `FullGameState.result`
 * when `status === "finished"`.
 */
export interface GameResult {
  /** The winning player, or `"draw"` if scores were tied at timeout */
  winner: Owner | 'draw';
  /** Whether the game ended by score or timeout */
  condition: WinCondition;
  /** Player 1's final score */
  player1Score: number;
  /** Player 2's final score */
  player2Score: number;
  /** Total number of ticks that elapsed before the game ended */
  totalTicks: number;
}

/**
 * Complete internal game state owned and mutated by {@link GameEngine}.
 * Subscribers receive a **deep clone** of this via `onTick()` or `getState()`.
 *
 * @remarks
 * The renderer should read:
 * - `ships` for positions, alive status, owner, turnsToRevive
 * - `islands` for owner, captureProgress, teamCapturing
 * - `player1Score` / `player2Score` for the HUD
 * - `tick` and `config.gameDuration` for the timer
 * - `status` and `result` for game-over handling
 */
export interface FullGameState {
  /** Active game configuration */
  config: GameConfig;
  /** Current tick counter (increments by 1 each tick, starts at 0) */
  tick: number;
  /** Current lifecycle state of the engine */
  status: GameStatus;
  /** All ships (both players), alive and dead */
  ships: Ship[];
  /** All islands on the map */
  islands: Island[];
  /** Player 1's cumulative score (mirrored from player1.score) */
  player1Score: number;
  /** Player 2's cumulative score (mirrored from player2.score) */
  player2Score: number;
  /** Player 1's full state (score, islandsHeld, shipIds, etc.) */
  player1: PlayerState;
  /** Player 2's full state */
  player2: PlayerState;
  /** Populated when `status === "finished"` */
  result?: GameResult;
}

// ─────────────────────────────────────────────
// Map generation output
// ─────────────────────────────────────────────

/**
 * Output of {@link generateMap} — everything needed to initialise a game.
 */
export interface MapData {
  /** All islands placed on the map, with `owner: "neutral"` and progress=0 */
  islands: Island[];
  /** One spawn point per ship (all player1 first, then all player2) */
  spawnPoints: SpawnPoint[];
}

// ─────────────────────────────────────────────
// Pre-built bot metadata
// ─────────────────────────────────────────────

/**
 * Metadata for a pre-built bot listed in the game setup UI.
 */
export interface BotMeta {
  /** Stable identifier (e.g. `"rusher"`, `"defender"`) */
  id: string;
  /** Display name shown in the UI */
  name: string;
  /** Short description of the bot's strategy */
  description: string;
  /** Difficulty rating for UI sorting / display */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Factory function that creates a fresh bot instance */
  factory: BotFactory;
}

// ─────────────────────────────────────────────
// Collision record (for head-on detection)
// ─────────────────────────────────────────────

/**
 * Records a head-on collision between two enemy ships that ended up
 * at the same position after movement. Both ships are destroyed.
 */
export interface CollisionPair {
  /** ID of the first ship in the collision */
  shipAId: number;
  /** ID of the second ship in the collision */
  shipBId: number;
  /** X coordinate where the collision occurred */
  x: number;
  /** Y coordinate where the collision occurred */
  y: number;
}

// ─────────────────────────────────────────────
// Game Events (for post-game analytics & replay)
// ─────────────────────────────────────────────

/**
 * Discrete game event types logged for post-game analytics and replay.
 * - `"combat_kill"` — one or more enemy ships were destroyed
 * - `"island_capture"` — a player captured an island
 * - `"island_lost"` — a player lost an island to the enemy
 * - `"score_milestone"` — a player passed a score milestone (25%, 50%, 75%, 100%)
 */
export type GameEventType = 'combat_kill' | 'island_capture' | 'island_lost' | 'score_milestone';

/**
 * A discrete game event recorded during a match, used for post-game
 * analytics, replay logs, and the stats panel.
 *
 * @see GameEventType for the full list of event categories.
 */
export interface GameEvent {
  /** Game tick when this event occurred */
  tick: number;
  /** Category of this event */
  type: GameEventType;
  /** Which player this event is attributed to */
  player: 'player1' | 'player2';
  /** Number of ships killed (only for `"combat_kill"` events) */
  count?: number;
  /** Island ID involved (only for `"island_capture"` / `"island_lost"` events) */
  islandId?: number;
  /** Score at time of event (only for `"score_milestone"` events) */
  score?: number;
  /** Human-readable description for the replay log */
  description: string;
}

// ─────────────────────────────────────────────
// Aggregated Game Stats (for post-game stats panel)
// ─────────────────────────────────────────────

/**
 * Aggregated statistics collected over the entire game, displayed in the
 * post-game stats panel. Updated continuously as the game runs.
 */
export interface GameStats {
  /** Enemy ships destroyed by player 1 */
  player1ShipsSunk: number;
  /** Enemy ships destroyed by player 2 */
  player2ShipsSunk: number;
  /** Player 1's own ships that were destroyed */
  player1ShipsLost: number;
  /** Player 2's own ships that were destroyed */
  player2ShipsLost: number;
  /** Total number of islands captured by player 1 (across the whole game) */
  player1IslandsCaptured: number;
  /** Total number of islands captured by player 2 (across the whole game) */
  player2IslandsCaptured: number;
  /** Islands player 1 lost to the enemy after capturing them */
  player1IslandsLost: number;
  /** Islands player 2 lost to the enemy after capturing them */
  player2IslandsLost: number;
  /**
   * Longest consecutive-tick streak during which player 1 held at least 1 island.
   * Resets when the player drops to 0 islands.
   */
  player1LongestHoldStreak: number;
  /** Same metric for player 2. */
  player2LongestHoldStreak: number;
  /**
   * Sum of alive ship count across all ticks for player 1.
   * Divide by `totalTicks` to get the average alive count per tick.
   */
  player1TotalShipTicks: number;
  /** Same metric for player 2. */
  player2TotalShipTicks: number;
  /** Total ticks recorded — denominator for the per-tick averages above */
  totalTicks: number;
}
