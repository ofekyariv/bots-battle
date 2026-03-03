// ============================================================
// 🏴‍☠️ Bot Sandbox — Synchronous MVP implementation
// ============================================================
//
// Loads player bot code using the Function() constructor so each
// bot runs in its own isolated function scope with helpers injected
// as named parameters.
//
// Lifecycle:
//   1. Call initFromCode(code) OR initFromFactory(factory) once per game.
//      This executes createBot() and stores the returned BotInstance.
//   2. Call tick(state, ship) once per alive ship per game tick.
//      Returns a Command, defaulting to { type: 'idle' } on any error.
//
// Timeout strategy:
//   Each tick call is bracketed with a setTimeout-armed deadline flag.
//   If tick() returns after the deadline, the bot is disabled for the
//   remainder of the game (all its ships get { type: 'idle' }).
//   NOTE: Synchronous JS cannot be preemptively killed — a truly infinite
//   loop will freeze the tab. Web Workers (future enhancement) solve this.
//
// Error handling:
//   Any thrown exception inside tick() is caught; the ship gets idle.
//   Bot init errors (syntax, missing createBot, bad return) throw so the
//   caller can surface them in the UI before the game starts.
//
// ============================================================

import type { BotFactory, BotInstance, BotShip, Command, GameState } from '@/engine/types';
import { BOT_HELPERS } from '@/engine/helpers';
import { PythonSandboxedBot, isPythonCode } from './pythonSandbox';
import { isTypeScriptCode, stripTypeScript } from './typeStripper';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

/** Max wall-clock ms a bot's tick() may take before it is disabled. */
const DEFAULT_TICK_TIMEOUT_MS = 50;

// ─────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────

export interface SandboxOptions {
  /** Max milliseconds allowed per tick call. Default: 50 */
  timeoutMs?: number;
  /** Max consecutive timeouts before the bot is permanently disabled. Default: 3 */
  maxConsecutiveTimeouts?: number;
}

// ─────────────────────────────────────────────
// Memory stats (Chrome-only via performance.memory)
// ─────────────────────────────────────────────

interface ChromeMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface WorkerMemoryStats {
  /** JS heap used at tick start (bytes). Only available on Chromium. */
  heapUsedBefore: number;
  /** JS heap used after tick completes (bytes). Only available on Chromium. */
  heapUsedAfter: number;
  /** Heap growth during the last tick (bytes). Negative = GC ran. */
  heapDelta: number;
  /** Timestamp of last measurement (ms since epoch). */
  measuredAt: number;
}

function sampleHeapUsed(): number | null {
  if (typeof performance === 'undefined') return null;
  const mem = (performance as unknown as { memory?: ChromeMemory }).memory;
  return mem?.usedJSHeapSize ?? null;
}

/** Warn if a single tick grows the heap by more than this. */
const MEMORY_WARN_THRESHOLD_BYTES = 5 * 1024 * 1024; // 5 MB

// ─────────────────────────────────────────────
// SandboxedBot
// Wraps a single player's bot instance with timeout + error handling.
// ─────────────────────────────────────────────

export class SandboxedBot {
  private instance: BotInstance | null = null;
  /** Set to true once the bot exceeds maxConsecutiveTimeouts. Silenced afterward. */
  private timedOut = false;
  /** Whether the deadline flag has fired for the current tick. */
  private deadlineFired = false;
  /** Number of consecutive ticks that exceeded the timeout budget. */
  private consecutiveTimeouts = 0;
  /** Last recorded memory snapshot for this bot. */
  private _lastMemory: WorkerMemoryStats | null = null;
  private readonly timeoutMs: number;
  private readonly maxConsecutiveTimeouts: number;
  private readonly label: string;

  constructor(label: string, options: SandboxOptions = {}) {
    this.label = label;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TICK_TIMEOUT_MS;
    this.maxConsecutiveTimeouts = options.maxConsecutiveTimeouts ?? 3;
  }

  // ─────────────────────────────────────────────
  // Init from user code string
  // ─────────────────────────────────────────────

  /**
   * Load a bot from user-supplied JavaScript or TypeScript code.
   *
   * TypeScript code is automatically compiled to JavaScript by stripping
   * type annotations before evaluation.
   *
   * The code must define a top-level `createBot()` function that returns
   * an object with a `tick(state, ship)` method.
   *
   * All BOT_HELPERS are injected as named parameters so the bot can call
   * them directly without imports.
   *
   * @throws If the code has syntax errors, doesn't define createBot(),
   *         or createBot() doesn't return a valid tick()-able object.
   */
  initFromCode(code: string): void {
    // Strip TypeScript type annotations if needed
    const jsCode = isTypeScriptCode(code) ? stripTypeScript(code) : code;

    const helperNames = Object.keys(BOT_HELPERS) as (keyof typeof BOT_HELPERS)[];
    const helperValues = helperNames.map((k) => BOT_HELPERS[k]);

    // Build a wrapper function that:
    //   1. Accepts all helper functions as named params (injected by us)
    //   2. Evaluates the user's code in that scope
    //   3. Calls createBot() and returns the instance
    //
    // "use strict" prevents accidental globals, but the bot can still
    // access window/document. Web Workers would add true origin isolation.
    const wrapperFn = new Function(
      ...helperNames,
      `
"use strict";

${jsCode}

if (typeof createBot === 'function') {
  return createBot();
}
if (typeof tick === 'function') {
  return { tick: tick };
}
throw new Error("Bot code must define either a createBot() function or a tick(state, ship) function");
`,
    ) as (...args: unknown[]) => unknown;

    const instance = wrapperFn(...helperValues);

    if (!instance || typeof (instance as BotInstance).tick !== 'function') {
      throw new Error('createBot() must return an object with a tick(state, ship) method');
    }

    this.instance = instance as BotInstance;
    this.timedOut = false;
    this.deadlineFired = false;
  }

  // ─────────────────────────────────────────────
  // Init from pre-built BotFactory
  // ─────────────────────────────────────────────

  /**
   * Load a bot from a compiled TypeScript BotFactory (pre-built bots).
   * Factory errors are caught and logged; the bot will silently idle.
   */
  initFromFactory(factory: BotFactory): void {
    try {
      this.instance = factory();
      this.timedOut = false;
      this.deadlineFired = false;
    } catch (err) {
      console.error(`[sandbox:${this.label}] Factory init failed:`, err);
      this.instance = null;
    }
  }

  // ─────────────────────────────────────────────
  // Per-tick execution
  // ─────────────────────────────────────────────

  /**
   * Call the bot's tick() for one ship this game tick.
   *
   * Returns { type: 'idle' } if:
   *   - The bot isn't loaded
   *   - The bot was already timed out in a previous tick
   *   - tick() throws an exception
   *   - tick() returns an invalid Command
   *   - tick() exceeds the configured timeout (bot also permanently silenced)
   *
   * The timeout is implemented by:
   *   1. Recording wall-clock start time
   *   2. Arming a setTimeout flag (fires if we don't clear it in time)
   *   3. After tick() returns, checking elapsed time
   *   This is best-effort — a synchronous infinite loop will still hang.
   */
  tick(state: GameState, ship: BotShip): Command {
    const idle: Command = { type: 'idle' };

    if (!this.instance || this.timedOut) return idle;

    // Arm a deadline flag via setTimeout.
    // Because JS is single-threaded this won't interrupt a running tick(),
    // but it will fire immediately after the call stack clears — useful for
    // detecting async misuse or post-call latency measurement.
    this.deadlineFired = false;
    const deadlineTimer = setTimeout(() => {
      this.deadlineFired = true;
    }, this.timeoutMs);

    const heapBefore = sampleHeapUsed();
    const start = performance.now();
    let result: Command;

    try {
      result = this.instance.tick(state, ship);
    } catch (err) {
      clearTimeout(deadlineTimer);
      console.error(`[sandbox:${this.label}] tick() threw on ship ${ship.id}:`, err);
      return idle;
    }

    const elapsed = performance.now() - start;
    clearTimeout(deadlineTimer);

    // ── Memory tracking (Chromium-only) ─────────────────────
    const heapAfter = sampleHeapUsed();
    if (heapBefore !== null && heapAfter !== null) {
      const delta = heapAfter - heapBefore;
      this._lastMemory = {
        heapUsedBefore: heapBefore,
        heapUsedAfter: heapAfter,
        heapDelta: delta,
        measuredAt: Date.now(),
      };
      if (delta > MEMORY_WARN_THRESHOLD_BYTES) {
        console.warn(
          `[sandbox:${this.label}] tick() allocated ~${(delta / 1024 / 1024).toFixed(2)} MB ` +
            `for ship ${ship.id}. Possible memory leak.`,
        );
      }
    }

    // ── Per-tick timeout guard ───────────────────────────────
    // If wall-clock time exceeded the per-tick budget, warn and return idle.
    // After maxConsecutiveTimeouts, permanently disable the bot for the game.
    if (elapsed > this.timeoutMs) {
      this.consecutiveTimeouts++;
      const remaining = this.maxConsecutiveTimeouts - this.consecutiveTimeouts;
      if (this.consecutiveTimeouts >= this.maxConsecutiveTimeouts) {
        console.warn(
          `[sandbox:${this.label}] tick() exceeded ${this.timeoutMs}ms ` +
            `(took ${elapsed.toFixed(1)}ms on ship ${ship.id}). ` +
            `Timeout limit reached — bot disabled for the remainder of this game.`,
        );
        this.timedOut = true;
      } else {
        console.warn(
          `[sandbox:${this.label}] tick() exceeded ${this.timeoutMs}ms ` +
            `(took ${elapsed.toFixed(1)}ms on ship ${ship.id}). ` +
            `Returning idle. Bot will be disabled after ${remaining} more timeout(s).`,
        );
      }
      return idle;
    }

    // Successful tick — reset consecutive timeout counter.
    this.consecutiveTimeouts = 0;

    // Validate the returned command shape.
    if (!result || (result.type !== 'move' && result.type !== 'idle')) {
      console.warn(
        `[sandbox:${this.label}] tick() returned invalid command on ship ${ship.id}:`,
        result,
      );
      return idle;
    }

    // Validate move target when type === 'move'
    if (result.type === 'move') {
      if (
        !result.target ||
        typeof result.target.x !== 'number' ||
        typeof result.target.y !== 'number' ||
        !isFinite(result.target.x) ||
        !isFinite(result.target.y)
      ) {
        console.warn(
          `[sandbox:${this.label}] move command missing valid target on ship ${ship.id}`,
        );
        return idle;
      }
    }

    return result;
  }

  // ─────────────────────────────────────────────
  // State accessors
  // ─────────────────────────────────────────────

  /** True if the bot was silenced due to a timeout violation. */
  get isTimedOut(): boolean {
    return this.timedOut;
  }

  /** True if the bot is loaded and healthy. */
  get isReady(): boolean {
    return this.instance !== null && !this.timedOut;
  }

  /**
   * Last recorded memory stats for this bot's ticks.
   * Only populated on Chromium-based browsers; null elsewhere.
   */
  memoryStats(): WorkerMemoryStats | null {
    return this._lastMemory;
  }

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────

  /** Clear timeout + memory state — call after a game reset to re-enable the bot. */
  reset(): void {
    this.timedOut = false;
    this.deadlineFired = false;
    this.consecutiveTimeouts = 0;
    this._lastMemory = null;
  }

  /** Drop the bot instance (call when the game ends or page unmounts). */
  destroy(): void {
    this.instance = null;
    this.timedOut = false;
    this.consecutiveTimeouts = 0;
    this._lastMemory = null;
  }
}

// ─────────────────────────────────────────────
// BotSandbox
// Top-level facade managing both players' bots.
// ─────────────────────────────────────────────

/**
 * BotSandbox manages the two sandboxed bot instances for a match.
 *
 * Typical usage:
 *
 * ```ts
 * const sandbox = new BotSandbox();
 *
 * // Before the game starts — init each player once:
 * sandbox.loadFromCode("player1", userBotCode);
 * sandbox.loadFromFactory("player2", rusherBot);
 *
 * // During the game loop — one call per alive ship per tick:
 * const cmd = sandbox.tick("player1", botGameState, botShip);
 * ```
 */
export class BotSandbox {
  private bots: Record<'player1' | 'player2', SandboxedBot>;

  constructor(options: SandboxOptions = {}) {
    this.bots = {
      player1: new SandboxedBot('player1', options),
      player2: new SandboxedBot('player2', options),
    };
  }

  // ─────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────

  /**
   * Load a player's bot from user-supplied code string.
   * @throws On syntax errors, missing createBot(), or bad return value.
   */
  loadFromCode(player: 'player1' | 'player2', code: string): void {
    this.bots[player].initFromCode(code);
  }

  /**
   * Load a player's bot from a compiled TypeScript BotFactory.
   * Errors during init are logged; the bot silently idles.
   */
  loadFromFactory(player: 'player1' | 'player2', factory: BotFactory): void {
    this.bots[player].initFromFactory(factory);
  }

  // ─────────────────────────────────────────────
  // Per-tick execution
  // ─────────────────────────────────────────────

  /**
   * Execute one bot's tick() for a single ship.
   * Always returns a valid Command — never throws.
   */
  tick(player: 'player1' | 'player2', state: GameState, ship: BotShip): Command {
    return this.bots[player].tick(state, ship);
  }

  // ─────────────────────────────────────────────
  // Status
  // ─────────────────────────────────────────────

  isReady(player: 'player1' | 'player2'): boolean {
    return this.bots[player].isReady;
  }

  isTimedOut(player: 'player1' | 'player2'): boolean {
    return this.bots[player].isTimedOut;
  }

  /** Last memory snapshot for a player's bot (Chromium-only). */
  memoryStats(player: 'player1' | 'player2'): WorkerMemoryStats | null {
    return this.bots[player].memoryStats();
  }

  // ─────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────

  /** Clear timeout flags on both bots after a game reset. */
  reset(): void {
    this.bots.player1.reset();
    this.bots.player2.reset();
  }

  /** Destroy both bot instances (call on game end / component unmount). */
  destroy(): void {
    this.bots.player1.destroy();
    this.bots.player2.destroy();
  }
}
