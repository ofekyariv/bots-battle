// ============================================================
// 🐍 Python Bot Sandbox — Brython-powered Python execution
// ============================================================
//
// Enables players to write bot code in Python 3 instead of
// JavaScript. Uses Brython (a Python 3 runtime in JS) to:
//
//   1. Parse and compile the Python source code
//   2. Execute it in an isolated Brython module scope
//   3. Bridge GameState/BotShip ↔ Python via JSON serialisation
//
// Data Bridge:
//   • Before each tick: GameState + BotShip are JSON-serialised
//     to strings and passed to a Python wrapper function.
//   • Inside Python: the JSON is parsed and converted to _NS
//     attribute-accessible objects (state.my_ships, ship.x, …).
//   • After tick: the Python return value (a dict) is JSON-
//     serialised by Python and parsed back by JS → Command.
//   • Field names: camelCase JS ↔ snake_case Python (auto-converted).
//
// Error handling:
//   • Syntax/compile errors in initFromCode() → thrown so the
//     caller can surface them in the UI before the game starts.
//   • Runtime errors inside tick() → logged, returns idle.
//   • Brython load failure → thrown from initFromCode().
//
// Thread safety note:
//   Brython runs synchronously in the JS main thread (same as the
//   JS sandbox). Infinite loops WILL freeze the tab. The timeout
//   guard from SandboxedBot applies here too.
//
// ============================================================

import type { BotShip, Command, GameState } from '@/engine/types';
import { buildPythonPreamble } from '@/lib/languages/codegen';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** Minimal Brython runtime interface we need. */
interface $B {
  runPythonSource(src: string, options?: { name?: string; id?: string }): Record<string, unknown>;
  $call(callable: unknown): (...args: unknown[]) => unknown;
  $getattr(obj: unknown, attr: string, fallback?: unknown): unknown;
  imported: Record<string, Record<string, unknown>>;
}

// ─────────────────────────────────────────────
// camelCase → snake_case converter
// ─────────────────────────────────────────────

function toSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

function camelToSnakeDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(camelToSnakeDeep);
  }
  if (obj !== null && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[toSnake(k)] = camelToSnakeDeep(v);
    }
    return out;
  }
  return obj;
}

// ─────────────────────────────────────────────
// Python preamble — injected before user code
// ─────────────────────────────────────────────
//
// Defines:
//   • _NS — dict-to-attribute wrapper (so state.my_ships works)
//   • All helper functions in snake_case
//   • _tick_json(tick_fn, state_json, ship_json) → result_json
//     Used by JS to call the user's tick in a type-safe way.
// ─────────────────────────────────────────────

// PYTHON_PREAMBLE is generated from the language registry (codegen.ts).
// To add a new helper: add it to engine/helpers.ts + languages/helpers.ts + codegen.ts.
// This sandbox file does NOT need to be edited.
const PYTHON_PREAMBLE = buildPythonPreamble();



// ─────────────────────────────────────────────
// Brython loader (lazy, singleton, script-tag injection)
// ─────────────────────────────────────────────
//
// Brython is NOT imported via the module bundler because its
// source uses dynamic `import(variable)` which webpack cannot
// statically analyse. Instead we inject a <script> tag at runtime
// that loads /brython.min.js (served from public/).
// ─────────────────────────────────────────────

let $B: $B | null = null;
let loadPromise: Promise<$B> | null = null;
let moduleCounter = 0;

function injectScript(src: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      // Script tag exists — check if already loaded
      if ((existing as HTMLScriptElement).dataset.loaded === '1') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error(`${src} failed to load`)));
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => { script.dataset.loaded = '1'; resolve(); };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function injectBrythonScript(): Promise<void> {
  // Already fully loaded
  if ((globalThis as Record<string, unknown>).__BRYTHON__) {
    return Promise.resolve();
  }
  // Load both brython core and stdlib (for json, math, etc.)
  return injectScript('/brython.min.js').then(() => injectScript('/brython_stdlib.js'));
}

async function getBrython(): Promise<$B> {
  if ($B) return $B;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    if (typeof window === 'undefined') {
      throw new Error('Python sandbox is browser-only (no SSR support).');
    }

    await injectBrythonScript();

    const runtime = (globalThis as Record<string, unknown>).__BRYTHON__ as $B | undefined;
    if (!runtime) {
      throw new Error('Brython failed to initialise. Ensure /brython.min.js is accessible.');
    }

    // Warm up: run a trivial Python snippet to initialise internal state.
    try {
      runtime.runPythonSource('_bb_warmup = 1', { name: '__bb_warmup__' });
    } catch {
      // Ignore — some versions don't need this
    }

    $B = runtime;
    return $B;
  })();

  return loadPromise;
}

// ─────────────────────────────────────────────
// PythonSandboxedBot
// ─────────────────────────────────────────────

export class PythonSandboxedBot {
  private tickBridge: ((...args: unknown[]) => unknown) | null = null;
  private tickFn: unknown = null;
  private readonly label: string;
  private initialized = false;

  constructor(label: string) {
    this.label = label;
  }

  // ─────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────

  /**
   * Load and compile Python bot code.
   *
   * @throws If Brython fails to load, the Python code has syntax errors,
   *         or create_bot() is missing / returns an invalid object.
   */
  async initFromCode(code: string): Promise<void> {
    const runtime = await getBrython();

    const modName = `__bb_bot_${++moduleCounter}__`;
    const fullSource = PYTHON_PREAMBLE + '\n' + code;

    // Compile + execute the Python source in its own module scope.
    let mod: Record<string, unknown>;
    try {
      mod = runtime.runPythonSource(fullSource, { name: modName });
    } catch (err) {
      throw new Error(`Python syntax error: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Retrieve create_bot or flat tick function.
    const createBotFn = mod['create_bot'];
    const flatTickFn = mod['tick'];
    let rawTickFn: unknown;

    if (typeof createBotFn !== 'undefined') {
      // Traditional: create_bot() → bot instance with tick method
      let botInstance: unknown;
      try {
        botInstance = runtime.$call(createBotFn)();
      } catch (err) {
        throw new Error(
          `create_bot() raised an error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      // Extract tick method from the bot instance.
      // Supports: class instance (bot.tick), or dict ({'tick': tick_fn}).
      try {
        rawTickFn = runtime.$getattr(botInstance, 'tick');
      } catch {
        // Maybe it's a Python dict — try __getitem__
        try {
          const getItem = runtime.$getattr(botInstance, '__getitem__');
          rawTickFn = runtime.$call(getItem)('tick');
        } catch {
          throw new Error('create_bot() must return an object (or dict) with a tick() method.');
        }
      }

      if (!rawTickFn) {
        throw new Error('create_bot() must return an object (or dict) with a tick() method.');
      }
    } else if (typeof flatTickFn !== 'undefined') {
      // Simplified: flat tick(state, ship) function
      rawTickFn = flatTickFn;
    } else {
      throw new Error('Python bot code must define either a create_bot() function or a tick(state, ship) function.');
    }

    // Get the _tick_json bridge function from the preamble.
    const tickJsonFn = mod['_tick_json'];
    if (!tickJsonFn) {
      throw new Error('Internal error: _tick_json bridge not found in preamble.');
    }

    this.tickFn = rawTickFn;
    this.tickBridge = runtime.$call(tickJsonFn) as (...args: unknown[]) => unknown;
    // Pre-bind tickFn for _tick_json(tick_fn, state_json, ship_json)
    this.initialized = true;
  }

  // ─────────────────────────────────────────────
  // Per-tick execution
  // ─────────────────────────────────────────────

  /**
   * Execute one tick for a single ship.
   * Always returns a valid Command — never throws.
   */
  tick(state: GameState, ship: BotShip): Command {
    const idle: Command = { type: 'idle' };

    if (!this.initialized || !this.tickBridge || !this.tickFn) return idle;

    try {
      // Serialise to snake_case JSON for Python.
      const stateJson = JSON.stringify(camelToSnakeDeep(state));
      const shipJson = JSON.stringify(camelToSnakeDeep(ship));

      // Call Python: _tick_json(tick_fn, state_json, ship_json) → JSON string
      const resultJson = this.tickBridge(this.tickFn, stateJson, shipJson);

      // resultJson is a Python str which Brython represents as a JS string.
      if (typeof resultJson !== 'string') {
        console.warn(`[py-sandbox:${this.label}] _tick_json returned non-string`);
        return idle;
      }

      const command = JSON.parse(resultJson) as Command;

      // Validate shape.
      if (!command || (command.type !== 'move' && command.type !== 'idle')) {
        return idle;
      }
      if (command.type === 'move') {
        if (
          !command.target ||
          typeof command.target.x !== 'number' ||
          typeof command.target.y !== 'number' ||
          !isFinite(command.target.x) ||
          !isFinite(command.target.y)
        ) {
          return idle;
        }
      }
      return command;
    } catch (err) {
      console.error(`[py-sandbox:${this.label}] tick error on ship ${ship.id}:`, err);
      return idle;
    }
  }

  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────

  get isReady(): boolean {
    return this.initialized;
  }

  reset(): void {
    // Python state lives in the module scope — no reset needed.
    // (Per-ship memory in the Python closure persists automatically.)
  }

  destroy(): void {
    this.tickBridge = null;
    this.tickFn = null;
    this.initialized = false;
  }
}

// ─────────────────────────────────────────────
// Language detection
// ─────────────────────────────────────────────

/**
 * Returns true if the code string looks like Python.
 * Checks for a `# @language: python` comment at the top, OR
 * the presence of Python-specific syntax (def, :, elif, etc.).
 */
export function isPythonCode(code: string): boolean {
  const firstLines = code.slice(0, 400).trimStart();
  if (/^#\s*@language\s*:\s*python/im.test(firstLines)) return true;
  // Heuristic: Python-style function definition
  if (/^\s*def\s+(create_bot|tick)\s*\(/m.test(code)) return true;
  return false;
}
