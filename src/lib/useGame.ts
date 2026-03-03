// ============================================================
// 🏴‍☠️ useGame — React hook that orchestrates a full match
// ============================================================
//
// This is the glue between GameEngine, BotSandbox, and React.
//
// Usage:
//   const game = useGame(bot1Source, bot2Source, options);
//   // then: game.start(), game.pause(), game.setSpeed(5), etc.
//
// Design notes
// ────────────────────────────────────────────────────────────
//
// ① We drive the engine manually via engine.stepTick(), NOT via
//   engine.start() / engine.resume() — those create an internal
//   setInterval that would race with ours.
//   stepTick() handles the "idle" → "running" transition automatically.
//
// ② Speed multiplier: we call stepTick() `speed` times per interval
//   period instead of shrinking the period. This keeps timing stable
//   and means setSpeed() doesn't require a restart.
//
// ③ We track isPaused independently in the hook (not in engine state)
//   because we never call engine.pause() — engine status stays
//   "running" while we pause our own interval. We synthesize the
//   paused indicator via a separate reducer action.
//
// ④ Score history is accumulated inside the reducer on every TICK
//   action. It resets to [] on restart().
//
// ⑤ Bot code strings are compiled once per (re)start via SandboxedBot,
//   which wraps user JS in a Function() scope with helper injections.
//   Pre-built bots (BotFactory) bypass the sandbox entirely.
//
// ⑥ All cleanup — interval, engine subscription, bot instances — runs
//   in the useEffect destructor when the component unmounts.
// ============================================================

'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { GameEngine } from '@/engine/GameEngine';
import { SandboxedBot } from '@/lib/botSandbox';
import { PythonSandboxedBot, isPythonCode } from '@/lib/pythonSandbox';
import { KotlinSandboxedBot, isKotlinCode } from '@/lib/kotlinSandbox';
import { CSharpSandboxedBot, isCSharpCode } from '@/lib/csharpSandbox';
import { JavaSandboxedBot, isJavaCode } from '@/lib/javaSandbox';
import { SwiftSandboxedBot, isSwiftCode } from '@/lib/swiftSandbox';
import type { BotFactory, FullGameState, GameConfig, GameEvent, GameStats } from '@/engine/types';

// ─────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────

// Re-export so consumers can import from one place
export type { GameEvent, GameStats };

/** One data-point in the per-tick score history (for end-game charts). */
export interface ScoreHistoryEntry {
  tick: number;
  player1Score: number;
  player2Score: number;
}

/** How each player's bot is provided to useGame. */
export type BotSource = { kind: 'code'; code: string } | { kind: 'factory'; factory: BotFactory };

/** Options for useGame. */
export interface UseGameOptions {
  /** Partial GameConfig overrides merged with DEFAULT_CONFIG. */
  gameConfig?: Partial<GameConfig>;
  /** Max ms a bot's tick() may take before it is permanently silenced. */
  sandboxTimeoutMs?: number;
}

/** Default/empty stats object for initial state. */
const EMPTY_STATS: GameStats = {
  player1ShipsSunk: 0,
  player2ShipsSunk: 0,
  player1ShipsLost: 0,
  player2ShipsLost: 0,
  player1IslandsCaptured: 0,
  player2IslandsCaptured: 0,
  player1IslandsLost: 0,
  player2IslandsLost: 0,
  player1LongestHoldStreak: 0,
  player2LongestHoldStreak: 0,
  player1TotalShipTicks: 0,
  player2TotalShipTicks: 0,
  totalTicks: 0,
};

/** Everything the consumer needs from useGame. */
export interface UseGameReturn {
  /** Deep-cloned snapshot of full engine state. null before first emit. */
  gameState: FullGameState | null;
  /** true while the game loop is actively advancing ticks. */
  isRunning: boolean;
  /** true while the loop is paused (interval stopped, engine still alive). */
  isPaused: boolean;
  /** Current speed multiplier (ticks executed per interval call). */
  speed: number;
  /** Per-tick score history — grows during the game; useful for charts. */
  scoreHistory: ScoreHistoryEntry[];
  /** Ordered log of notable game events for the mini replay / analytics. */
  gameEvents: GameEvent[];
  /** Aggregated game stats for the post-game stats panel. */
  gameStats: GameStats;
  /** Error message if a bot failed to load or the engine threw. */
  error: string | null;
  /** Start the game from idle state. No-op if already running. */
  start: () => void;
  /** Pause the game loop. No-op if not running. */
  pause: () => void;
  /** Resume a paused game. No-op if not paused. */
  resume: () => void;
  /** Change the speed multiplier immediately. No restart needed. */
  setSpeed: (n: number) => void;
  /** Fully restart: rebuilds engine + sandbox from current bot sources. */
  restart: () => void;
  /** Returns the recorded replay frames collected so far (every 5th tick). */
  getReplayFrames: () => FullGameState[];
}

// ─────────────────────────────────────────────
// Reducer
// ─────────────────────────────────────────────

interface HookState {
  gameState: FullGameState | null;
  isRunning: boolean;
  isPaused: boolean;
  speed: number;
  scoreHistory: ScoreHistoryEntry[];
  gameEvents: GameEvent[];
  gameStats: GameStats;
  /** Running streak of ticks that player1 held >=1 island */
  p1CurrentStreak: number;
  /** Running streak of ticks that player2 held >=1 island */
  p2CurrentStreak: number;
  /**
   * Score milestone thresholds already emitted for each player.
   * Stored as a set of fractions (0.25, 0.5, 0.75, 1.0) so we don't
   * duplicate milestone events.
   */
  p1MilestonesHit: Set<number>;
  p2MilestonesHit: Set<number>;
  error: string | null;
}

type HookAction =
  | { type: 'TICK'; payload: FullGameState }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SPEED'; payload: number }
  | { type: 'ERROR'; payload: string }
  | { type: 'RESET' };

const INITIAL: HookState = {
  gameState: null,
  isRunning: false,
  isPaused: false,
  speed: 1,
  scoreHistory: [],
  gameEvents: [],
  gameStats: { ...EMPTY_STATS },
  p1CurrentStreak: 0,
  p2CurrentStreak: 0,
  p1MilestonesHit: new Set(),
  p2MilestonesHit: new Set(),
  error: null,
};

// ── Event / Stats diffing helpers ──────────────────────────────────────────

/**
 * Compare the previous and new FullGameState to detect notable events.
 * Returns new events to append and stat deltas to apply.
 */
function diffTick(
  prev: FullGameState,
  next: FullGameState,
  p1MilestonesHit: Set<number>,
  p2MilestonesHit: Set<number>,
  targetScore: number,
): {
  events: GameEvent[];
  statsDelta: Partial<GameStats>;
} {
  if (next.tick <= prev.tick) return { events: [], statsDelta: {} };

  const events: GameEvent[] = [];
  const statsDelta: Partial<GameStats> = {};

  // ── Combat kills: ships that flipped alive→dead ──────────────────────
  const prevShipMap = new Map(prev.ships.map((s) => [s.id, s]));
  let p1Deaths = 0;
  let p2Deaths = 0;

  for (const ship of next.ships) {
    const prevShip = prevShipMap.get(ship.id);
    if (prevShip && prevShip.alive && !ship.alive) {
      if (ship.owner === 'player1') {
        p1Deaths++;
      } else {
        p2Deaths++;
      }
    }
  }

  if (p1Deaths > 0) {
    statsDelta.player1ShipsLost = p1Deaths;
    statsDelta.player2ShipsSunk = p1Deaths;
    events.push({
      tick: next.tick,
      type: 'combat_kill',
      player: 'player2',
      count: p1Deaths,
      description: `Tick ${next.tick}: Player 2 sank ${p1Deaths} ship${p1Deaths > 1 ? 's' : ''} belonging to Player 1`,
    });
  }
  if (p2Deaths > 0) {
    statsDelta.player2ShipsLost = p2Deaths;
    statsDelta.player1ShipsSunk = p2Deaths;
    events.push({
      tick: next.tick,
      type: 'combat_kill',
      player: 'player1',
      count: p2Deaths,
      description: `Tick ${next.tick}: Player 1 sank ${p2Deaths} ship${p2Deaths > 1 ? 's' : ''} belonging to Player 2`,
    });
  }

  // ── Island ownership changes ─────────────────────────────────────────
  const prevIslandMap = new Map(prev.islands.map((i) => [i.id, i]));
  let p1IslandsCaptured = 0;
  let p2IslandsCaptured = 0;
  let p1IslandsLost = 0;
  let p2IslandsLost = 0;

  for (const island of next.islands) {
    const prevIsland = prevIslandMap.get(island.id);
    if (!prevIsland || prevIsland.owner === island.owner) continue;

    if (island.owner === 'player1') {
      p1IslandsCaptured++;
      if (prevIsland.owner === 'player2') p2IslandsLost++;
      events.push({
        tick: next.tick,
        type: 'island_capture',
        player: 'player1',
        islandId: island.id,
        description: `Tick ${next.tick}: Player 1 captured Island ${island.id + 1}`,
      });
    } else if (island.owner === 'player2') {
      p2IslandsCaptured++;
      if (prevIsland.owner === 'player1') p1IslandsLost++;
      events.push({
        tick: next.tick,
        type: 'island_capture',
        player: 'player2',
        islandId: island.id,
        description: `Tick ${next.tick}: Player 2 captured Island ${island.id + 1}`,
      });
    }

    // Lost events (separate entries attributed to the losing player)
    if (prevIsland.owner === 'player1' && island.owner !== 'player1') {
      events.push({
        tick: next.tick,
        type: 'island_lost',
        player: 'player1',
        islandId: island.id,
        description: `Tick ${next.tick}: Player 1 lost Island ${island.id + 1}`,
      });
    } else if (prevIsland.owner === 'player2' && island.owner !== 'player2') {
      events.push({
        tick: next.tick,
        type: 'island_lost',
        player: 'player2',
        islandId: island.id,
        description: `Tick ${next.tick}: Player 2 lost Island ${island.id + 1}`,
      });
    }
  }

  if (p1IslandsCaptured) statsDelta.player1IslandsCaptured = p1IslandsCaptured;
  if (p2IslandsCaptured) statsDelta.player2IslandsCaptured = p2IslandsCaptured;
  if (p1IslandsLost) statsDelta.player1IslandsLost = p1IslandsLost;
  if (p2IslandsLost) statsDelta.player2IslandsLost = p2IslandsLost;

  // ── Score milestones ─────────────────────────────────────────────────
  const milestones = [0.25, 0.5, 0.75, 1.0];
  for (const frac of milestones) {
    const threshold = Math.round(targetScore * frac);
    if (!p1MilestonesHit.has(frac) && next.player1Score >= threshold) {
      p1MilestonesHit.add(frac);
      events.push({
        tick: next.tick,
        type: 'score_milestone',
        player: 'player1',
        score: next.player1Score,
        description: `Tick ${next.tick}: Player 1 reached ${Math.round(frac * 100)}% of target score (${next.player1Score.toLocaleString()} pts)`,
      });
    }
    if (!p2MilestonesHit.has(frac) && next.player2Score >= threshold) {
      p2MilestonesHit.add(frac);
      events.push({
        tick: next.tick,
        type: 'score_milestone',
        player: 'player2',
        score: next.player2Score,
        description: `Tick ${next.tick}: Player 2 reached ${Math.round(frac * 100)}% of target score (${next.player2Score.toLocaleString()} pts)`,
      });
    }
  }

  return { events, statsDelta };
}

function reducer(state: HookState, action: HookAction): HookState {
  switch (action.type) {
    case 'TICK': {
      const gs = action.payload;
      const isFinished = gs.status === 'finished';
      const entry: ScoreHistoryEntry = {
        tick: gs.tick,
        player1Score: gs.player1Score,
        player2Score: gs.player2Score,
      };
      // Only append when tick advanced (guard against duplicate emits)
      const lastTick = state.scoreHistory[state.scoreHistory.length - 1];
      const shouldAppend = gs.tick > 0 && (!lastTick || lastTick.tick !== gs.tick);

      // ── Diff events / stats ──────────────────────────────────────────
      let newEvents: GameEvent[] = [];
      let updatedStats = state.gameStats;
      let p1Streak = state.p1CurrentStreak;
      let p2Streak = state.p2CurrentStreak;

      // We need the Sets to be mutable — they're already refs in state
      const p1Milestones = state.p1MilestonesHit;
      const p2Milestones = state.p2MilestonesHit;

      if (state.gameState && shouldAppend) {
        const targetScore = gs.config.targetScore;
        const { events, statsDelta } = diffTick(
          state.gameState,
          gs,
          p1Milestones,
          p2Milestones,
          targetScore,
        );
        newEvents = events;

        // Apply stat deltas (accumulate per-tick ship counts)
        const p1Alive = gs.ships.filter((s) => s.owner === 'player1' && s.alive).length;
        const p2Alive = gs.ships.filter((s) => s.owner === 'player2' && s.alive).length;

        updatedStats = {
          player1ShipsSunk: updatedStats.player1ShipsSunk + (statsDelta.player1ShipsSunk ?? 0),
          player2ShipsSunk: updatedStats.player2ShipsSunk + (statsDelta.player2ShipsSunk ?? 0),
          player1ShipsLost: updatedStats.player1ShipsLost + (statsDelta.player1ShipsLost ?? 0),
          player2ShipsLost: updatedStats.player2ShipsLost + (statsDelta.player2ShipsLost ?? 0),
          player1IslandsCaptured:
            updatedStats.player1IslandsCaptured + (statsDelta.player1IslandsCaptured ?? 0),
          player2IslandsCaptured:
            updatedStats.player2IslandsCaptured + (statsDelta.player2IslandsCaptured ?? 0),
          player1IslandsLost:
            updatedStats.player1IslandsLost + (statsDelta.player1IslandsLost ?? 0),
          player2IslandsLost:
            updatedStats.player2IslandsLost + (statsDelta.player2IslandsLost ?? 0),
          player1TotalShipTicks: updatedStats.player1TotalShipTicks + p1Alive,
          player2TotalShipTicks: updatedStats.player2TotalShipTicks + p2Alive,
          totalTicks: updatedStats.totalTicks + 1,
          // Streaks updated below
          player1LongestHoldStreak: updatedStats.player1LongestHoldStreak,
          player2LongestHoldStreak: updatedStats.player2LongestHoldStreak,
        };

        // Update hold streaks
        if (gs.player1.islandsHeld > 0) {
          p1Streak++;
          if (p1Streak > updatedStats.player1LongestHoldStreak) {
            updatedStats = { ...updatedStats, player1LongestHoldStreak: p1Streak };
          }
        } else {
          p1Streak = 0;
        }
        if (gs.player2.islandsHeld > 0) {
          p2Streak++;
          if (p2Streak > updatedStats.player2LongestHoldStreak) {
            updatedStats = { ...updatedStats, player2LongestHoldStreak: p2Streak };
          }
        } else {
          p2Streak = 0;
        }
      }

      return {
        ...state,
        gameState: gs,
        isRunning: isFinished ? false : state.isRunning,
        isPaused: isFinished ? false : state.isPaused,
        scoreHistory: shouldAppend ? [...state.scoreHistory, entry] : state.scoreHistory,
        gameEvents: newEvents.length > 0 ? [...state.gameEvents, ...newEvents] : state.gameEvents,
        gameStats: updatedStats,
        p1CurrentStreak: p1Streak,
        p2CurrentStreak: p2Streak,
        error: null,
      };
    }

    case 'PAUSE':
      return { ...state, isRunning: false, isPaused: true };

    case 'RESUME':
      return { ...state, isRunning: true, isPaused: false };

    case 'SPEED':
      return { ...state, speed: Math.max(1, Math.floor(action.payload)) };

    case 'ERROR':
      return {
        ...state,
        error: action.payload,
        isRunning: false,
        isPaused: false,
      };

    case 'RESET':
      return {
        ...INITIAL,
        speed: state.speed,
        // Re-initialize Sets so they're fresh mutable refs
        p1MilestonesHit: new Set(),
        p2MilestonesHit: new Set(),
      };

    default:
      return state;
  }
}

// ─────────────────────────────────────────────
// buildFactory
// Converts a BotSource into a BotFactory that the GameEngine accepts.
// Code-based bots are wrapped in SandboxedBot (Function() scope + helpers).
// Factory bots are passed through directly.
// ─────────────────────────────────────────────

async function buildFactoryAsync(
  source: BotSource,
  label: string,
  timeoutMs: number,
): Promise<BotFactory> {
  if (source.kind === 'factory') {
    return source.factory;
  }

  const { code } = source;

  // ── Python path ────────────────────────────────────────────────────────
  if (isPythonCode(code)) {
    // Pre-initialise Python bot (loads Brython once, then it stays cached).
    const pyBot = new PythonSandboxedBot(label);
    await pyBot.initFromCode(code); // throws on invalid Python / missing create_bot()
    // The factory captures the already-initialised bot.
    // Note: unlike the JS path, the same instance is reused across restarts.
    // Per-tick state lives in Python closures inside the bot, so reuse is fine.
    const factory: BotFactory = () => ({
      tick(state, ship) {
        return pyBot.tick(state, ship);
      },
    });
    return factory;
  }

  // ── Kotlin path ─────────────────────────────────────────────────────────
  if (isKotlinCode(code)) {
    const ktBot = new KotlinSandboxedBot(label);
    await ktBot.initFromCode(code); // compiles via JetBrains API, throws on errors
    const factory: BotFactory = () => ({
      tick(state, ship) {
        return ktBot.tick(state, ship);
      },
    });
    return factory;
  }

  // ── C# path ──────────────────────────────────────────────────────────
  if (isCSharpCode(code)) {
    const csBot = new CSharpSandboxedBot(label);
    await csBot.initFromCode(code);
    const factory: BotFactory = () => ({
      tick(state, ship) {
        return csBot.tick(state, ship);
      },
    });
    return factory;
  }

  // ── Java path ───────────────────────────────────────────────────────
  if (isJavaCode(code)) {
    const javaBot = new JavaSandboxedBot(label);
    await javaBot.initFromCode(code);
    const factory: BotFactory = () => ({
      tick(state, ship) {
        return javaBot.tick(state, ship);
      },
    });
    return factory;
  }

  // ── Swift path ──────────────────────────────────────────────────────
  if (isSwiftCode(code)) {
    const swiftBot = new SwiftSandboxedBot(label);
    await swiftBot.initFromCode(code);
    const factory: BotFactory = () => ({
      tick(state, ship) {
        return swiftBot.tick(state, ship);
      },
    });
    return factory;
  }

  // ── JavaScript path ────────────────────────────────────────────────────
  // Validate eagerly — throws on syntax error / missing createBot().
  // The actual factory creates a fresh SandboxedBot each time it's called
  // (i.e. each game / restart), so bots don't share state between games.
  const factory: BotFactory = () => {
    const bot = new SandboxedBot(label, { timeoutMs });
    bot.initFromCode(code); // throws on invalid code
    return {
      tick(state, ship) {
        return bot.tick(state, ship);
      },
    };
  };

  // Dry-run validation: try calling the factory once to surface errors
  // before the game starts. The returned instance is discarded.
  factory(); // throws on invalid code — propagated to caller

  return factory;
}

// ─────────────────────────────────────────────
// useGame
// ─────────────────────────────────────────────

export function useGame(
  bot1Source: BotSource,
  bot2Source: BotSource,
  options: UseGameOptions = {},
): UseGameReturn {
  const { gameConfig = {}, sandboxTimeoutMs = 50 } = options;

  const [state, dispatch] = useReducer(reducer, INITIAL);

  // ── Refs ────────────────────────────────────────────────────────────
  const engineRef = useRef<GameEngine | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  /** Replay frames — recorded every REPLAY_FRAME_INTERVAL ticks (not in state to avoid re-renders). */
  const replayFramesRef = useRef<FullGameState[]>([]);
  /** Live speed value — stored in ref so interval closure sees latest value
   *  without needing to re-create the interval on every setSpeed() call. */
  const speedRef = useRef<number>(1);
  /** Guards against re-entrant tick batches if a tick takes longer than the
   *  interval period (unlikely but possible at high speeds). */
  const tickingRef = useRef(false);

  // Keep stable refs to bot sources and config so we can rebuild on restart
  // without the hook needing to re-initialize on every render.
  const bot1Ref = useRef(bot1Source);
  const bot2Ref = useRef(bot2Source);
  const configRef = useRef(gameConfig);
  bot1Ref.current = bot1Source;
  bot2Ref.current = bot2Source;
  configRef.current = gameConfig;

  // ── Interval helpers ────────────────────────────────────────────────

  const stopInterval = useCallback((): void => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Start our tick-driving interval.
   * Runs `speedRef.current` stepTick() calls per period.
   * Stops itself when the engine reaches "finished" status.
   */
  const startInterval = useCallback((): void => {
    stopInterval(); // clear any existing interval first

    const engine = engineRef.current;
    if (!engine) return;

    const tickRateMs = configRef.current.tickRateMs ?? 100;

    intervalRef.current = setInterval(() => {
      if (tickingRef.current) return; // skip if previous batch is still running
      tickingRef.current = true;

      try {
        const speed = speedRef.current;
        for (let i = 0; i < speed; i++) {
          // Check status BEFORE each tick — the previous tick may have finished
          if (engine.getState().status === 'finished') {
            stopInterval();
            dispatch({ type: 'PAUSE' }); // isRunning → false
            break;
          }
          engine.stepTick();
        }

        // Final check after the batch
        if (engine.getState().status === 'finished') {
          stopInterval();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[useGame] Engine error during tick batch:', err);
        stopInterval();
        dispatch({ type: 'ERROR', payload: `Engine error: ${msg}` });
      } finally {
        tickingRef.current = false;
      }
    }, tickRateMs);
  }, [stopInterval]);

  // ── Engine builder ───────────────────────────────────────────────────

  const buildEngine = useCallback(async (): Promise<GameEngine | null> => {
    try {
      const factory1 = await buildFactoryAsync(bot1Ref.current, 'player1', sandboxTimeoutMs);
      const factory2 = await buildFactoryAsync(bot2Ref.current, 'player2', sandboxTimeoutMs);
      return new GameEngine(factory1, factory2, configRef.current);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dispatch({ type: 'ERROR', payload: `Bot load error: ${msg}` });
      return null;
    }
  }, [sandboxTimeoutMs]);

  // ── Subscribe helper ─────────────────────────────────────────────────

  /** How often to record a frame into the replay buffer (every N ticks). */
  const REPLAY_FRAME_INTERVAL = 5;

  const subscribeEngine = useCallback((engine: GameEngine): void => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    unsubRef.current = engine.onTick((snapshot) => {
      dispatch({ type: 'TICK', payload: snapshot });
      // Record a frame every REPLAY_FRAME_INTERVAL ticks (or the very last frame)
      if (snapshot.tick % REPLAY_FRAME_INTERVAL === 0 || snapshot.status === 'finished') {
        replayFramesRef.current.push(snapshot);
      }
    });
     
  }, []);

  // ── Mount: build engine once ─────────────────────────────────────────

  useEffect(() => {
    let active = true;
    buildEngine().then((engine) => {
      if (!active || !engine) return;
      engineRef.current = engine;
      subscribeEngine(engine);
      // Emit the initial idle state so gameState is populated immediately.
      dispatch({ type: 'TICK', payload: engine.getState() });

    });

    return () => {
      active = false;
      // Cleanup on unmount
      stopInterval();
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount only

  // ── Public API ────────────────────────────────────────────────────────

  /**
   * Start the game from idle state.
   * Uses stepTick() to drive the loop — never engine.start() — so we
   * avoid creating a competing internal interval inside GameEngine.
   * stepTick() handles the idle→running status transition internally.
   */
  const start = useCallback((): void => {
    const engine = engineRef.current;
    if (!engine) return;

    const status = engine.getState().status;
    if (status === 'running' || status === 'finished') return;
    // status is "idle" — stepTick will flip it to "running" on first call.

    dispatch({ type: 'RESUME' });
    startInterval();
  }, [startInterval]);

  /**
   * Pause the game loop.
   * Stops our interval; engine status stays "running" (we never call
   * engine.pause() — that would also trigger its own internal logic).
   * isPaused is tracked purely in hook state.
   */
  const pause = useCallback((): void => {
    stopInterval();
    dispatch({ type: 'PAUSE' });
  }, [stopInterval]);

  /**
   * Resume a paused game.
   * Restarts our interval; engine status is still "running" so
   * stepTick() / tick() will execute normally.
   */
  const resume = useCallback((): void => {
    const engine = engineRef.current;
    if (!engine) return;

    const status = engine.getState().status;
    // If engine finished while we were paused, don't resume.
    if (status === 'finished') {
      dispatch({ type: 'PAUSE' }); // keep consistent
      return;
    }

    dispatch({ type: 'RESUME' });
    startInterval();
  }, [startInterval]);

  /** Change speed multiplier. Takes effect on the next interval call. */
  const setSpeed = useCallback((n: number): void => {
    const clamped = Math.max(1, Math.floor(n));
    speedRef.current = clamped;
    dispatch({ type: 'SPEED', payload: clamped });
  }, []);

  /**
   * Fully restart the match.
   * Stops the interval, tears down the old engine, builds a fresh one
   * from the current bot sources, and emits the new idle state.
   * Does NOT auto-start — caller must call start() again.
   */
  const restart = useCallback((): void => {
    stopInterval();
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    replayFramesRef.current = [];
    dispatch({ type: 'RESET' });

    // buildEngine is async (Python bots may need Brython initialisation)
    buildEngine().then((engine) => {
      if (!engine) return;
      engineRef.current = engine;
      subscribeEngine(engine);
      dispatch({ type: 'TICK', payload: engine.getState() });
    });
  }, [buildEngine, subscribeEngine, stopInterval]);

  const getReplayFrames = useCallback((): FullGameState[] => {
    return replayFramesRef.current;
  }, []);

  return {
    gameState: state.gameState,
    isRunning: state.isRunning,
    isPaused: state.isPaused,
    speed: state.speed,
    scoreHistory: state.scoreHistory,
    gameEvents: state.gameEvents,
    gameStats: state.gameStats,
    error: state.error,
    start,
    pause,
    resume,
    setSpeed,
    restart,
    getReplayFrames,
  };
}
