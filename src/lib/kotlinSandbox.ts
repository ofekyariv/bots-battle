// ============================================================
// 🏴‍☠️ Bots Battle — Kotlin Bot Sandbox
// ============================================================
//
// Compiles Kotlin bot code to JavaScript via JetBrains' Kotlin
// Playground compiler API, then runs the resulting JS through
// the existing JS sandbox infrastructure.
//
// Flow:
//   1. Wrap user's Kotlin code with a bridge that exposes createBot()
//   2. POST to api.kotlinlang.org/api/<version>/compiler/translate
//   3. Eval the compiled JS to extract the createBot() factory
//   4. Return a BotFactory compatible with the game engine
//
// The compilation happens ONCE when a game starts (not per tick).
// Per-tick execution runs native JS — same speed as JS bots.
// ============================================================

import type { BotShip, Command, GameState } from '@/engine/types';
import { buildKotlinHelpers } from '@/lib/languages/codegen';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const KOTLIN_API_VERSION = '2.0.21';
const COMPILE_ENDPOINT = `https://api.kotlinlang.org/api/${KOTLIN_API_VERSION}/compiler/translate`;
const COMPILE_TIMEOUT_MS = 30_000;

// ─────────────────────────────────────────────
// Kotlin wrapper template
// ─────────────────────────────────────────────
// We wrap the user's code so that `createBot()` is exposed as a
// top-level function that the compiled JS module will export.

// Kotlin helpers are generated once at module load from the language registry.
// To add a new helper: add it to engine/helpers.ts + languages/helpers.ts + codegen.ts.
// This sandbox file does NOT need to be edited.
const KOTLIN_HELPERS_BLOCK = buildKotlinHelpers();

function wrapKotlinCode(userCode: string): string {
  return `
import kotlin.math.*

// ── Bot API helpers (generated from language registry) ───────
${KOTLIN_HELPERS_BLOCK}

// ── User code ────────────────────────────────────────────────
${userCode}

// ── Bridge: auto-generated wrapper ──────────────────────────
fun createBot(): dynamic {
    val obj = js("{}")
    obj.tick = { state: dynamic, ship: dynamic ->
        tick(state, ship)
    }
    return obj
}

@JsName("main")
fun main(args: Array<String>) {
    val bot = createBot()
    val global = js("globalThis")
    global["__kotlinBot__"] = bot
}

@JsName("mainNoArgs")
fun main() {
    main(emptyArray())
}
`;
}

// ─────────────────────────────────────────────
// Compiler API
// ─────────────────────────────────────────────

interface CompileResponse {
  jsCode?: string;
  errors?:
    | Record<
        string,
        { severity: string; message: string; interval?: { start: { line: number; ch: number } } }[]
      >
    | { severity: string; message: string; interval?: { start: { line: number; ch: number } } }[];
  text?: string;
}

async function compileKotlinToJs(kotlinCode: string): Promise<string> {
  const wrapped = wrapKotlinCode(kotlinCode);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COMPILE_TIMEOUT_MS);

  try {
    const res = await fetch(COMPILE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: '',
        files: [{ name: 'Bot.kt', text: wrapped }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Kotlin compiler returned HTTP ${res.status}`);
    }

    const data: CompileResponse = await res.json();

    // Check for compilation errors — API returns { "filename": [...] } dict
    const rawErrors = data.errors ?? {};
    const errorList: {
      severity: string;
      message: string;
      interval?: { start: { line: number; ch: number } };
    }[] = Array.isArray(rawErrors) ? rawErrors : Object.values(rawErrors).flat();
    const errors = errorList.filter((e) => e.severity === 'ERROR');
    if (errors.length > 0) {
      const messages = errors.map((e) => {
        const loc = e.interval?.start ? ` (line ${e.interval.start.line})` : '';
        return `${e.message}${loc}`;
      });
      throw new Error(`Kotlin compilation errors:\n${messages.join('\n')}`);
    }

    if (!data.jsCode) {
      throw new Error('Kotlin compiler returned no JavaScript output');
    }

    return data.jsCode;
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────
// KotlinSandboxedBot
// ─────────────────────────────────────────────

export class KotlinSandboxedBot {
  private tickFn: ((state: GameState, ship: BotShip) => Command) | null = null;
  private readonly label: string;
  private initialized = false;

  constructor(label: string) {
    this.label = label;
  }

  /**
   * Compile Kotlin code to JS and initialise the bot.
   * @throws on compilation errors or missing createBot()
   */
  async initFromCode(code: string): Promise<void> {
    const jsCode = await compileKotlinToJs(code);

    // Execute the compiled JS in an isolated scope.
    // The compiled code sets globalThis.__kotlinBot__ via main().
    const prevBot = (globalThis as Record<string, unknown>).__kotlinBot__;
    try {
      // The compiled JS is a UMD module that references `moduleId` on globalThis.
      // We must ensure it exists before eval, then extract main() from it.
      // Temporarily hide AMD `define` to prevent "Can only have one anonymous
      // define call per script file" errors when RequireJS/AMD loaders are present.
      const g = globalThis as Record<string, unknown>;
      const prevModuleId = g.moduleId;
      g.moduleId = {};
      const prevDefine = g.define;
      g.define = undefined;

      try {
        const evalFn = new Function(jsCode);
        evalFn();
      } finally {
        // Restore define immediately
        if (prevDefine === undefined) delete g.define;
        else g.define = prevDefine;
      }

      // The UMD factory populates globalThis.moduleId with exports.
      // main() should now be available either on moduleId or globalThis.
      const mod = g.moduleId as Record<string, unknown>;
      
      // DEBUG: Log the compiled module
      console.log('Kotlin Module Exports:', mod);

      const mainFn = (mod?.main ?? g.main ?? mod?.mainNoArgs ?? g.mainNoArgs) as (() => void) | undefined;
      if (typeof mainFn === 'function') {
        console.log('Executing Kotlin main()...');
        mainFn();
      } else {
        console.warn('Kotlin main() function not found in exports or global scope');
      }

      // Restore
      if (prevModuleId === undefined) delete g.moduleId;
      else g.moduleId = prevModuleId;

      const bot = (globalThis as Record<string, unknown>).__kotlinBot__ as
        | { tick?: (state: unknown, ship: unknown) => unknown }
        | undefined;

      // Log for debugging
      console.log('Extracted Kotlin bot:', bot);

      if (!bot || typeof bot.tick !== 'function') {
        throw new Error('createBot() must return an object with a tick(state, ship) method');
      }

      const rawTick = bot.tick.bind(bot);

      this.tickFn = (state: GameState, ship: BotShip): Command => {
        try {
          const result = rawTick(state, ship) as Command | undefined;
          if (!result || (result.type !== 'move' && result.type !== 'idle')) {
            return { type: 'idle' };
          }
          if (result.type === 'move') {
            if (
              !result.target ||
              typeof result.target.x !== 'number' ||
              typeof result.target.y !== 'number' ||
              !isFinite(result.target.x) ||
              !isFinite(result.target.y)
            ) {
              return { type: 'idle' };
            }
          }
          return result;
        } catch (err) {
          console.error(`[kotlin-sandbox:${this.label}] tick error:`, err);
          return { type: 'idle' };
        }
      };

      this.initialized = true;
    } finally {
      // Clean up global
      if (prevBot === undefined) {
        delete (globalThis as Record<string, unknown>).__kotlinBot__;
      } else {
        (globalThis as Record<string, unknown>).__kotlinBot__ = prevBot;
      }
    }
  }

  tick(state: GameState, ship: BotShip): Command {
    if (!this.initialized || !this.tickFn) return { type: 'idle' };
    return this.tickFn(state, ship);
  }

  get isReady(): boolean {
    return this.initialized;
  }

  destroy(): void {
    this.tickFn = null;
    this.initialized = false;
  }
}

// ─────────────────────────────────────────────
// Language detection
// ─────────────────────────────────────────────

export function isKotlinCode(code: string): boolean {
  const firstLines = code.slice(0, 400).trimStart();
  if (/^\/\/\s*@language\s*:\s*kotlin/im.test(firstLines)) return true;
  if (/^\s*fun\s+tick\s*\(\s*state\s*:\s*dynamic/m.test(code)) return true;
  return false;
}
