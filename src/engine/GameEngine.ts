// ============================================================
// 🏴‍☠️ Bots Battle — Main Game Engine
// ============================================================
//
// Orchestrates the full game loop each tick:
//
//   1. runBots()            — call each bot's tick(), collect commands
//   2. moveShips()          — move ships toward commanded targets
//   3. resolveCollisions()  — head-on enemy collision → both die
//   4. resolveCombat()      — per-ship radius: enemies > friendlies → die
//   5. markCapturingShips() — flag ships within any island radius (tracking)
//   6. resolveCaptureProgress() — advance island capture timers
//   7. processRespawns()    — tick down counters, revive ships
//   8. applyScoreTick()     — exponential scoring per island held
//   9. checkWin()           — score or timeout win condition
//
// Pure TypeScript — zero React dependency.
// React components subscribe via onTick() and receive deep-cloned state.
// ============================================================

import type {
  BotFactory,
  BotShip,
  Command,
  FullGameState,
  GameConfig,
  GameResult,
  GameState,
  Owner,
  PlayerState,
  Ship,
} from './types';
import { DEFAULT_CONFIG } from './types';
import { generateMap, generateSpawnPoints, isPassableFor, clampToMap } from './map';
import { resolveCollisions, resolveCombat, processRespawns } from './combat';
import { resolveCaptureProgress } from './capture';
import { applyScoreTick } from './scoring';
import { distanceTo } from './helpers';

// ─────────────────────────────────────────────
// GameEngine
// ─────────────────────────────────────────────

export class GameEngine {
  private state: FullGameState;
  private bot1: ReturnType<BotFactory>;
  private bot2: ReturnType<BotFactory>;
  private bot1Factory: BotFactory;
  private bot2Factory: BotFactory;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Array<(state: FullGameState) => void> = [];
  /** Commands collected from the current bot run, keyed by ship ID */
  private pendingCommands: Map<number, Command> = new Map();

  constructor(bot1Factory: BotFactory, bot2Factory: BotFactory, config: Partial<GameConfig> = {}) {
    const finalConfig: GameConfig = { ...DEFAULT_CONFIG, ...config };
    this.bot1Factory = bot1Factory;
    this.bot2Factory = bot2Factory;
    this.bot1 = bot1Factory();
    this.bot2 = bot2Factory();
    this.state = this.initState(finalConfig);
  }

  // ─────────────────────────────────────────────
  // Initialization
  // ─────────────────────────────────────────────

  private initState(config: GameConfig): FullGameState {
    const { islands, spawnPoints } = generateMap(config);

    const ships: Ship[] = spawnPoints.map((sp, idx) => ({
      id: idx,
      owner: sp.owner,
      x: sp.x,
      y: sp.y,
      alive: true,
      isCapturing: false,
      turnsToRevive: 0,
      initialX: sp.x,
      initialY: sp.y,
      combatPressure: 0,
    }));

    const p1Ships = ships.filter((s) => s.owner === 'player1');
    const p2Ships = ships.filter((s) => s.owner === 'player2');

    const player1: PlayerState = {
      id: 'player1',
      score: 0,
      shipIds: p1Ships.map((s) => s.id),
      islandsHeld: 0,
      lastTickPoints: 0,
    };

    const player2: PlayerState = {
      id: 'player2',
      score: 0,
      shipIds: p2Ships.map((s) => s.id),
      islandsHeld: 0,
      lastTickPoints: 0,
    };

    return {
      config,
      tick: 0,
      status: 'idle',
      ships,
      islands,
      player1Score: 0,
      player2Score: 0,
      player1,
      player2,
    };
  }

  // ─────────────────────────────────────────────
  // Subscriptions
  // ─────────────────────────────────────────────

  /**
   * Subscribe to state snapshots emitted after every tick.
   * The callback receives a deep clone (safe to read/mutate freely).
   *
   * Returns an unsubscribe function.
   *
   * @example
   * const unsub = engine.onTick(state => renderFrame(state));
   * // later:
   * unsub();
   */
  onTick(listener: (state: FullGameState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(): void {
    if (this.listeners.length === 0) return;
    const snapshot = this.serialize();
    for (const l of this.listeners) l(snapshot);
  }

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────

  /** Start the game loop (sets status → "running"). */
  start(): void {
    if (this.state.status === 'running') return;
    this.state.status = 'running';
    this.tickInterval = setInterval(() => this.tick(), this.state.config.tickRateMs);
    this.emit();
  }

  /** Pause the game loop (can be resumed). */
  pause(): void {
    if (this.state.status !== 'running') return;
    this.state.status = 'paused';
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.emit();
  }

  /** Resume a paused game. */
  resume(): void {
    if (this.state.status !== 'paused') return;
    this.state.status = 'running';
    this.tickInterval = setInterval(() => this.tick(), this.state.config.tickRateMs);
    this.emit();
  }

  /** Stop the game and clear the interval (does NOT reset state). */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    if (this.state.status !== 'finished') {
      this.state.status = 'idle';
    }
    this.emit();
  }

  /**
   * Fully reset the engine to tick 0 with a fresh map.
   * Bots are re-instantiated via their factories.
   * Optionally provide a new/partial config override.
   */
  reset(configOverride: Partial<GameConfig> = {}): void {
    this.stop();
    const newConfig: GameConfig = {
      ...this.state.config,
      ...configOverride,
    };
    this.bot1 = this.bot1Factory();
    this.bot2 = this.bot2Factory();
    this.pendingCommands.clear();
    this.state = this.initState(newConfig);
    this.emit();
  }

  // ─────────────────────────────────────────────
  // Public State Access
  // ─────────────────────────────────────────────

  /**
   * Get a deep-cloned snapshot of the current full game state.
   * Safe to modify freely; won't affect the engine's internal state.
   */
  getState(): FullGameState {
    return this.serialize();
  }

  /**
   * Serialize the full game state for the renderer.
   *
   * Returns a deep clone of FullGameState — all ships, islands, scores,
   * tick, status, config, and result (if game is finished).
   *
   * The renderer should use this to paint each frame:
   *   - ships: position, alive, isCapturing, owner, turnsToRevive
   *   - islands: position, radius, owner, teamCapturing, captureProgress
   *   - player1Score, player2Score
   *   - tick, config.gameDuration (for timer)
   *   - status, result
   */
  serialize(): FullGameState {
    return structuredClone(this.state);
  }

  /**
   * Build a bot-facing GameState for one player (for external use / testing).
   * Translates internal owner types to "me"/"enemy" perspective.
   */
  getBotGameState(player: 'player1' | 'player2'): GameState {
    const myShips = this.state.ships.filter((s) => s.owner === player);
    const enemyShips = this.state.ships.filter((s) => s.owner !== player);
    return buildBotGameState(this.state, player, myShips, enemyShips);
  }

  // ─────────────────────────────────────────────
  // Manual Tick (for testing / step-through)
  // ─────────────────────────────────────────────

  /**
   * Execute exactly one tick regardless of game status.
   * Useful for unit tests, replays, or step-through debugging.
   * Sets status to "running" if it was "idle".
   */
  stepTick(): void {
    if (this.state.status === 'idle') this.state.status = 'running';
    if (this.state.status === 'finished') return;
    this.tick();
  }

  // ─────────────────────────────────────────────
  // Core Tick Loop
  // ─────────────────────────────────────────────

  private tick(): void {
    if (this.state.status !== 'running') return;

    this.state.tick++;

    // ── Phase 1: Run bots → collect commands ──────────────────────────
    this.runBots();

    // ── Phase 2: Move ships toward their targets ───────────────────────
    this.moveShips();

    // ── Phase 3: Head-on collision detection ──────────────────────────
    resolveCollisions(this.state.ships, this.state.config);

    // ── Phase 4: Per-ship radius combat evaluation ─────────────────────
    // Ships near islands fight exactly like any other ship — no exclusions.
    resolveCombat(this.state.ships, this.state.config);

    // ── Phase 5: Mark capturing ships (within any island radius) ──────
    // Tracking only — sets isCapturing flag for bots/renderer.
    // Does NOT affect combat: ships near islands are full combat participants.
    this.markCapturingShips();

    // ── Phase 6: Advance island capture timers ─────────────────────────
    resolveCaptureProgress(this.state.ships, this.state.islands, this.state.config);

    // ── Phase 7: Respawn processing ────────────────────────────────────
    processRespawns(this.state.ships);

    // ── Phase 8: Scoring ───────────────────────────────────────────────
    const { p1Score, p2Score } = applyScoreTick(
      this.state.islands,
      this.state.player1,
      this.state.player2,
      this.state.player1Score,
      this.state.player2Score,
    );
    this.state.player1Score = p1Score;
    this.state.player2Score = p2Score;

    // ── Phase 9: Win condition check ───────────────────────────────────
    const result = this.checkWin();
    if (result) {
      this.state.result = result;
      this.state.status = 'finished';
      if (this.tickInterval) {
        clearInterval(this.tickInterval);
        this.tickInterval = null;
      }
    }

    // Emit state snapshot to all subscribers
    this.emit();
  }

  // ─────────────────────────────────────────────
  // Phase Implementations
  // ─────────────────────────────────────────────

  /**
   * Phase 1 — Run both bots.
   *
   * For each player, build the bot-facing GameState (me/enemy perspective),
   * then call bot.tick(state, ship) for each of their ships.
   * Stores returned Commands in this.pendingCommands keyed by ship ID.
   *
   * If a bot throws, the ship gets an 'idle' command (safe default).
   */
  private runBots(): void {
    this.pendingCommands.clear();

    const { ships, islands, config } = this.state;

    for (const playerOwner of ['player1', 'player2'] as const) {
      const bot = playerOwner === 'player1' ? this.bot1 : this.bot2;
      const myShips = ships.filter((s) => s.owner === playerOwner);
      const enemyShips = ships.filter((s) => s.owner !== playerOwner);

      const botState = buildBotGameState(this.state, playerOwner, myShips, enemyShips);

      for (const ship of myShips) {
        // Dead ships don't act
        if (!ship.alive) {
          this.pendingCommands.set(ship.id, { type: 'idle' });
          continue;
        }

        const botShip = toBotShip(ship);
        let command: Command = { type: 'idle' };

        try {
          const result = bot.tick(botState, botShip);
          // Validate the returned command
          if (result && (result.type === 'move' || result.type === 'idle')) {
            command = result;
          }
        } catch (err) {
          console.error(`[engine] Bot ${playerOwner} threw on ship ${ship.id}:`, err);
        }

        this.pendingCommands.set(ship.id, command);
      }
    }
  }

  /**
   * Phase 2 — Move ships.
   *
   * For each alive ship with a 'move' command:
   *   1. Compute direction vector toward target
   *   2. Advance by at most shipSpeed units (stop AT target if closer)
   *   3. Enforce safe zone boundaries (no entering enemy spawn zone)
   *   4. Clamp to map bounds
   */
  private moveShips(): void {
    const { shipSpeed, mapWidth, mapHeight, safeZoneWidth } = this.state.config;

    for (const ship of this.state.ships) {
      if (!ship.alive) continue;

      const command = this.pendingCommands.get(ship.id);
      if (!command || command.type !== 'move' || !command.target) continue;

      const { x: tx, y: ty } = command.target;
      const dx = tx - ship.x;
      const dy = ty - ship.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let nx: number;
      let ny: number;

      if (dist <= shipSpeed || dist === 0) {
        // Already at (or within one step of) the target
        nx = tx;
        ny = ty;
      } else {
        // Advance one step in the direction of the target
        nx = ship.x + (dx / dist) * shipSpeed;
        ny = ship.y + (dy / dist) * shipSpeed;
      }

      // ── Safe zone enforcement ──
      // Player 1 lives on the BOTTOM (y > mapHeight - safeZoneWidth)
      // Player 2 lives on the TOP (y < safeZoneWidth)
      // Neither team can enter the other's safe zone.
      if (ship.owner === 'player1') {
        // P1 cannot go past the top safe zone boundary
        ny = Math.max(ny, safeZoneWidth);
      } else {
        // P2 cannot go past the bottom safe zone boundary
        ny = Math.min(ny, mapHeight - safeZoneWidth);
      }

      // ── Map boundary clamp ──
      const clamped = clampToMap(nx, ny, this.state.config);
      ship.x = clamped.x;
      ship.y = clamped.y;
    }
  }

  /**
   * Phase 5 — Mark all alive ships whose current position is within
   * any island's capture radius.
   *
   * Ships flagged as isCapturing:
   *   - Are tracked as contributing to island capture progress (Phase 6)
   *   - Still participate fully in combat — isCapturing does NOT exclude
   *     ships from combat evaluation
   *   - Flag is visible to bots via BotShip.isCapturing (tracking only)
   *
   * Clears old flags first so ships that moved away are correctly unmarked.
   */
  private markCapturingShips(): void {
    const { islands } = this.state;

    for (const ship of this.state.ships) {
      if (!ship.alive) {
        ship.isCapturing = false;
        continue;
      }

      // Ship is capturing if it's within ANY island's capture radius
      ship.isCapturing = islands.some((island) => distanceTo(ship, island) <= island.radius);
    }
  }

  // ─────────────────────────────────────────────
  // Win Condition
  // ─────────────────────────────────────────────

  private checkWin(): GameResult | null {
    const { targetScore, gameDuration } = this.state.config;
    const { player1Score, player2Score, tick } = this.state;

    // Score-based win (first to targetScore)
    if (player1Score >= targetScore && player2Score >= targetScore) {
      // Both hit target same tick → higher score wins; tied = player1 wins
      const winner = player1Score >= player2Score ? 'player1' : 'player2';
      return {
        winner,
        condition: 'score',
        player1Score,
        player2Score,
        totalTicks: tick,
      };
    }
    if (player1Score >= targetScore) {
      return {
        winner: 'player1',
        condition: 'score',
        player1Score,
        player2Score,
        totalTicks: tick,
      };
    }
    if (player2Score >= targetScore) {
      return {
        winner: 'player2',
        condition: 'score',
        player1Score,
        player2Score,
        totalTicks: tick,
      };
    }

    // Timeout win
    if (tick >= gameDuration) {
      const winner: Owner | 'draw' =
        player1Score > player2Score ? 'player1' : player2Score > player1Score ? 'player2' : 'draw';
      return {
        winner,
        condition: 'timeout',
        player1Score,
        player2Score,
        totalTicks: tick,
      };
    }

    return null;
  }
}

// ─────────────────────────────────────────────
// Pure translation helpers
// ─────────────────────────────────────────────

/**
 * Translate an internal Ship to the bot-facing BotShip.
 * Strips owner (bots only see their own ships via myShips).
 */
function toBotShip(ship: Ship): BotShip {
  return {
    id: ship.id,
    x: ship.x,
    y: ship.y,
    alive: ship.alive,
    isCapturing: ship.isCapturing,
    turnsToRevive: ship.turnsToRevive,
    initialX: ship.initialX,
    initialY: ship.initialY,
    combatPressure: ship.combatPressure,
  };
}

/**
 * Build a complete bot-facing GameState from the engine's perspective.
 *
 * Translates:
 *   - island.owner: "player1"/"player2"/"neutral" → "me"/"enemy"/"neutral"
 *   - island.teamCapturing: same mapping
 *   - myScore / enemyScore: assigned correctly per perspective
 */
function buildBotGameState(
  state: FullGameState,
  perspective: 'player1' | 'player2',
  myShips: Ship[],
  enemyShips: Ship[],
): GameState {
  const { tick, config, player1Score, player2Score } = state;

  const myScore = perspective === 'player1' ? player1Score : player2Score;
  const enemyScore = perspective === 'player1' ? player2Score : player1Score;

  return {
    tick,
    maxTicks: config.gameDuration,
    mapWidth: config.mapWidth,
    mapHeight: config.mapHeight,
    islands: state.islands.map((island) => ({
      id: island.id,
      x: island.x,
      y: island.y,
      radius: island.radius,
      owner: island.owner === 'neutral' ? 'neutral' : island.owner === perspective ? 'me' : 'enemy',
      teamCapturing:
        island.teamCapturing === 'none'
          ? 'none'
          : island.teamCapturing === perspective
            ? 'me'
            : 'enemy',
      captureProgress: island.captureProgress,
      captureTurns: island.captureTurns,
      value: island.value,
    })),
    myShips: myShips.map(toBotShip),
    enemyShips: enemyShips.map(toBotShip),
    myScore,
    enemyScore,
    targetScore: config.targetScore,
    config,
  };
}
