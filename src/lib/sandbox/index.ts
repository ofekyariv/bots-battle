// ============================================================
// 🏴‍☠️ Unified Sandbox Factory
// ============================================================
//
// Single entry-point for creating a sandboxed bot from any
// supported language. Consumers no longer need to know about
// SandboxedBot vs PythonSandboxedBot vs KotlinSandboxedBot.
//
// Usage:
//   const bot = await createSandbox(code, 'python');
//   const cmd = bot.tick(state, ship);
//   bot.destroy();
//
// Language auto-detection:
//   If `language` is omitted, the factory sniffs the code for
//   language markers (# @language: python / // @language: kotlin)
//   and Python/Kotlin syntax patterns. Falls back to JavaScript.
//
// Per-tick timeout:
//   All sandbox types enforce a 50 ms tick budget. Ticks that
//   exceed the budget return { type: 'idle' } and log a warning.
//   Python and Kotlin bots use the wrapper layer (since their
//   internal sandbox classes don't own timeout tracking).
//
// Memory tracking (best-effort):
//   On Chromium-based browsers, performance.memory is polled
//   before and after each tick to estimate heap growth. The
//   most-recent snapshot is accessible via bot.memoryStats().
// ============================================================

import type { BotFactory, BotShip, Command, GameState } from '@/engine/types';
import { SandboxedBot, type SandboxOptions } from '@/lib/botSandbox';
import { PythonSandboxedBot, isPythonCode } from '@/lib/pythonSandbox';
import { KotlinSandboxedBot, isKotlinCode } from '@/lib/kotlinSandbox';
import { CSharpSandboxedBot, isCSharpCode } from '@/lib/csharpSandbox';
import { JavaSandboxedBot, isJavaCode } from '@/lib/javaSandbox';
import { SwiftSandboxedBot, isSwiftCode } from '@/lib/swiftSandbox';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type SandboxLanguage = 'javascript' | 'typescript' | 'python' | 'kotlin' | 'csharp' | 'java' | 'swift' | 'auto';

export interface MemoryStats {
  /** JS heap used at start of tick (bytes), Chrome-only */
  heapUsedBefore: number;
  /** JS heap used after tick completes (bytes), Chrome-only */
  heapUsedAfter: number;
  /** Delta heap growth for the last tick */
  heapDelta: number;
  /** Timestamp of last measurement */
  measuredAt: number;
}

export interface UnifiedSandboxBot {
  /** Execute one tick for a ship. Always returns a valid Command. */
  tick(state: GameState, ship: BotShip): Command;
  /** True when the bot is loaded and ready. */
  readonly isReady: boolean;
  /** True when the bot was permanently silenced by timeout (JS bots only). */
  readonly isTimedOut: boolean;
  /** Last recorded memory stats, or null on non-Chrome / never measured. */
  memoryStats(): MemoryStats | null;
  /** Release resources (call on component unmount / game end). */
  destroy(): void;
  /** The resolved language. */
  readonly language: SandboxLanguage;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const TICK_TIMEOUT_MS = 50;
const MEMORY_WARN_THRESHOLD_BYTES = 5 * 1024 * 1024; // 5 MB per-tick growth

// ─────────────────────────────────────────────
// performance.memory helper (Chrome-only)
// ─────────────────────────────────────────────

interface ChromePerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

function sampleHeap(): number | null {
  if (typeof performance === 'undefined') return null;
  const mem = (performance as unknown as { memory?: ChromePerformanceMemory }).memory;
  return mem?.usedJSHeapSize ?? null;
}

// ─────────────────────────────────────────────
// Language detection
// ─────────────────────────────────────────────

function detectLanguage(code: string): SandboxLanguage {
  if (isPythonCode(code)) return 'python';
  if (isKotlinCode(code)) return 'kotlin';
  if (isCSharpCode(code)) return 'csharp';
  if (isJavaCode(code)) return 'java';
  if (isSwiftCode(code)) return 'swift';
  // Default: JavaScript/TypeScript (SandboxedBot handles TS stripping)
  return 'javascript';
}

// ─────────────────────────────────────────────
// Per-tick timeout + memory wrapper for Python / Kotlin bots
// These classes don't own a tick timeout themselves, so we add
// an elapsed-time guard here.
// ─────────────────────────────────────────────

function withTickGuard(
  label: string,
  innerTick: (state: GameState, ship: BotShip) => Command,
): (state: GameState, ship: BotShip) => Command {
  return (state: GameState, ship: BotShip): Command => {
    const idle: Command = { type: 'idle' };
    const start = performance.now();

    let result: Command;
    try {
      result = innerTick(state, ship);
    } catch (err) {
      console.error(`[sandbox:${label}] tick() threw:`, err);
      return idle;
    }

    const elapsed = performance.now() - start;
    if (elapsed > TICK_TIMEOUT_MS) {
      console.warn(
        `[sandbox:${label}] tick() exceeded ${TICK_TIMEOUT_MS}ms ` +
          `(took ${elapsed.toFixed(1)}ms on ship ${ship.id}). Returning idle.`,
      );
      return idle;
    }

    return result;
  };
}

// ─────────────────────────────────────────────
// Unified wrapper — JS / TypeScript
// ─────────────────────────────────────────────

class JsSandboxBot implements UnifiedSandboxBot {
  private inner: SandboxedBot;
  private _lastMemory: MemoryStats | null = null;
  readonly language: SandboxLanguage;

  constructor(label: string, options: SandboxOptions, lang: SandboxLanguage) {
    this.inner = new SandboxedBot(label, options);
    this.language = lang;
  }

  get isReady(): boolean {
    return this.inner.isReady;
  }

  get isTimedOut(): boolean {
    return this.inner.isTimedOut;
  }

  tick(state: GameState, ship: BotShip): Command {
    const heapBefore = sampleHeap();
    const result = this.inner.tick(state, ship);
    const heapAfter = sampleHeap();

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
          `[sandbox:js] tick() allocated ~${(delta / 1024 / 1024).toFixed(2)} MB ` +
            `for ship ${ship.id}. Possible memory leak.`,
        );
      }
    }

    return result;
  }

  memoryStats(): MemoryStats | null {
    return this._lastMemory;
  }

  destroy(): void {
    this.inner.destroy();
  }

  // Expose initFromCode / initFromFactory for the factory function
  initFromCode(code: string): void {
    this.inner.initFromCode(code);
  }

  initFromFactory(factory: BotFactory): void {
    this.inner.initFromFactory(factory);
  }
}

// ─────────────────────────────────────────────
// Unified wrapper — Python
// ─────────────────────────────────────────────

class PySandboxBot implements UnifiedSandboxBot {
  private inner: PythonSandboxedBot;
  private guardedTick: (state: GameState, ship: BotShip) => Command;
  private _lastMemory: MemoryStats | null = null;
  readonly language: SandboxLanguage = 'python';
  readonly isTimedOut = false; // Python uses per-tick guard (no permanent disable)

  constructor(label: string) {
    this.inner = new PythonSandboxedBot(label);
    this.guardedTick = withTickGuard(label, (s, sh) => this.inner.tick(s, sh));
  }

  get isReady(): boolean {
    return this.inner.isReady;
  }

  tick(state: GameState, ship: BotShip): Command {
    const heapBefore = sampleHeap();
    const result = this.guardedTick(state, ship);
    const heapAfter = sampleHeap();

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
          `[sandbox:python] tick() allocated ~${(delta / 1024 / 1024).toFixed(2)} MB ` +
            `for ship ${ship.id}. Possible memory leak.`,
        );
      }
    }

    return result;
  }

  memoryStats(): MemoryStats | null {
    return this._lastMemory;
  }

  destroy(): void {
    this.inner.destroy();
  }

  async initFromCode(code: string): Promise<void> {
    await this.inner.initFromCode(code);
  }
}

// ─────────────────────────────────────────────
// Unified wrapper — Kotlin
// ─────────────────────────────────────────────

class KotlinSandboxBot implements UnifiedSandboxBot {
  private inner: KotlinSandboxedBot;
  private guardedTick: (state: GameState, ship: BotShip) => Command;
  private _lastMemory: MemoryStats | null = null;
  readonly language: SandboxLanguage = 'kotlin';
  readonly isTimedOut = false;

  constructor(label: string) {
    this.inner = new KotlinSandboxedBot(label);
    this.guardedTick = withTickGuard(label, (s, sh) => this.inner.tick(s, sh));
  }

  get isReady(): boolean {
    return this.inner.isReady;
  }

  tick(state: GameState, ship: BotShip): Command {
    const heapBefore = sampleHeap();
    const result = this.guardedTick(state, ship);
    const heapAfter = sampleHeap();

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
          `[sandbox:kotlin] tick() allocated ~${(delta / 1024 / 1024).toFixed(2)} MB ` +
            `for ship ${ship.id}. Possible memory leak.`,
        );
      }
    }

    return result;
  }

  memoryStats(): MemoryStats | null {
    return this._lastMemory;
  }

  destroy(): void {
    this.inner.destroy();
  }

  async initFromCode(code: string): Promise<void> {
    await this.inner.initFromCode(code);
  }
}

// ─────────────────────────────────────────────
// Unified wrapper — C#
// ─────────────────────────────────────────────
// C# code is transpiled to JavaScript via CSharpSandboxedBot's built-in
// transpiler, then executed natively — no external API, no WASM runtime.
// ─────────────────────────────────────────────

class CSharpSandboxBot implements UnifiedSandboxBot {
  private inner: CSharpSandboxedBot;
  private _lastMemory: MemoryStats | null = null;
  readonly language: SandboxLanguage = 'csharp';
  readonly isTimedOut = false; // C# uses JS sandbox timeout internally

  constructor(label: string) {
    this.inner = new CSharpSandboxedBot(label);
  }

  get isReady(): boolean {
    return this.inner.isReady;
  }

  tick(state: GameState, ship: BotShip): Command {
    const heapBefore = sampleHeap();
    const result = this.inner.tick(state, ship);
    const heapAfter = sampleHeap();

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
          `[sandbox:csharp] tick() allocated ~${(delta / 1024 / 1024).toFixed(2)} MB ` +
            `for ship ${ship.id}. Possible memory leak.`,
        );
      }
    }

    return result;
  }

  memoryStats(): MemoryStats | null {
    return this._lastMemory;
  }

  destroy(): void {
    this.inner.destroy();
  }

  async initFromCode(code: string): Promise<void> {
    await this.inner.initFromCode(code);
  }
}

// ─────────────────────────────────────────────
// Unified wrapper — Java
// ─────────────────────────────────────────────
// Java code is transpiled to JavaScript via JavaSandboxedBot's built-in
// transpiler, then executed natively — no external API, no JVM.
// ─────────────────────────────────────────────

class JavaSandboxBot implements UnifiedSandboxBot {
  private inner: JavaSandboxedBot;
  private _lastMemory: MemoryStats | null = null;
  readonly language: SandboxLanguage = 'java';
  readonly isTimedOut = false; // Java uses JS sandbox timeout internally

  constructor(label: string) {
    this.inner = new JavaSandboxedBot(label);
  }

  get isReady(): boolean {
    return this.inner.isReady;
  }

  tick(state: GameState, ship: BotShip): Command {
    const heapBefore = sampleHeap();
    const result = this.inner.tick(state, ship);
    const heapAfter = sampleHeap();

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
          `[sandbox:java] tick() allocated ~${(delta / 1024 / 1024).toFixed(2)} MB ` +
            `for ship ${ship.id}. Possible memory leak.`,
        );
      }
    }

    return result;
  }

  memoryStats(): MemoryStats | null {
    return this._lastMemory;
  }

  destroy(): void {
    this.inner.destroy();
  }

  async initFromCode(code: string): Promise<void> {
    await this.inner.initFromCode(code);
  }
}

// ─────────────────────────────────────────────
// Unified wrapper — Swift
// ─────────────────────────────────────────────
// Swift uses the same remote Wandbox batch model as Java.
// tick() is always synchronous (returns last cached Command) while an
// async API call updates the cache in the background.
// ─────────────────────────────────────────────

class SwiftSandboxBot implements UnifiedSandboxBot {
  private inner: SwiftSandboxedBot;
  private _lastMemory: MemoryStats | null = null;
  readonly language: SandboxLanguage = 'swift';
  readonly isTimedOut = false; // Swift uses async + cache (no permanent disable)

  constructor(label: string) {
    this.inner = new SwiftSandboxedBot(label);
  }

  get isReady(): boolean {
    return this.inner.isReady;
  }

  tick(state: GameState, ship: BotShip): Command {
    const heapBefore = sampleHeap();
    const result = this.inner.tick(state, ship);
    const heapAfter = sampleHeap();

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
          `[sandbox:swift] tick() allocated ~${(delta / 1024 / 1024).toFixed(2)} MB ` +
            `for ship ${ship.id}. Possible memory leak.`,
        );
      }
    }

    return result;
  }

  memoryStats(): MemoryStats | null {
    return this._lastMemory;
  }

  destroy(): void {
    this.inner.destroy();
  }

  async initFromCode(code: string): Promise<void> {
    await this.inner.initFromCode(code);
  }
}

// ─────────────────────────────────────────────
// Public factory
// ─────────────────────────────────────────────

/**
 * Create and initialise a sandboxed bot from source code.
 *
 * Language is auto-detected unless explicitly specified.
 * Returns a fully initialised `UnifiedSandboxBot` ready for `tick()` calls.
 *
 * @throws On compilation errors, missing createBot / create_bot, bad return.
 *
 * @example
 * ```ts
 * // Auto-detect language
 * const bot = await createSandbox(userCode);
 *
 * // Explicit language
 * const pyBot = await createSandbox(pythonCode, 'python');
 *
 * // During game loop
 * const cmd = bot.tick(gameState, ship);
 *
 * // Cleanup
 * bot.destroy();
 * ```
 */
export async function createSandbox(
  code: string,
  language: SandboxLanguage = 'auto',
): Promise<UnifiedSandboxBot> {
  const lang = language === 'auto' ? detectLanguage(code) : language;

  switch (lang) {
    case 'python': {
      const bot = new PySandboxBot('player');
      await bot.initFromCode(code);
      return bot;
    }

    case 'kotlin': {
      const bot = new KotlinSandboxBot('player');
      await bot.initFromCode(code);
      return bot;
    }

    case 'csharp': {
      const bot = new CSharpSandboxBot('player');
      await bot.initFromCode(code);
      return bot;
    }

    case 'java': {
      const bot = new JavaSandboxBot('player');
      await bot.initFromCode(code);
      return bot;
    }

    case 'swift': {
      const bot = new SwiftSandboxBot('player');
      await bot.initFromCode(code);
      return bot;
    }

    case 'javascript':
    case 'typescript':
    default: {
      const bot = new JsSandboxBot('player', { timeoutMs: TICK_TIMEOUT_MS }, lang);
      bot.initFromCode(code);
      return bot;
    }
  }
}

/**
 * Create a sandbox from a pre-compiled BotFactory (built-in bots).
 * Synchronous — no async compilation needed.
 */
export function createSandboxFromFactory(factory: BotFactory, label = 'player'): UnifiedSandboxBot {
  const bot = new JsSandboxBot(label, { timeoutMs: TICK_TIMEOUT_MS }, 'javascript');
  bot.initFromFactory(factory);
  return bot;
}

// Re-export underlying classes for consumers that need direct access.
export { SandboxedBot, PythonSandboxedBot, KotlinSandboxedBot, CSharpSandboxedBot, JavaSandboxedBot, SwiftSandboxedBot };
export type { SandboxOptions };
