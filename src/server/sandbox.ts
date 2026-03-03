// ============================================================
// 🏴☠️ Bots Battle — Server-Side Bot Sandbox
// ============================================================
//
// Uses Node.js built-in `vm` module for sandboxing.
// Does NOT use isolated-vm (native dep, fails on ARM Mac).
//
// createSandboxedBot(code) wraps user JS in a vm.Context and
// injects all 14 helpers from engine/helpers.ts.
// Each tick call is guarded by a 50ms synchronous timeout via
// Script.runInContext with timeout option.
// ============================================================

import vm from 'vm';
import type { BotInstance, Command, GameState, BotShip } from '@/engine/types';
import { BOT_HELPERS } from '@/engine/helpers';

/** Tick timeout in milliseconds */
const TICK_TIMEOUT_MS = 50;

/** Result of a tick call — command or idle if bot timed out / errored */
export interface SandboxTickResult {
  command: Command;
  timedOut: boolean;
  error?: string;
}

/** A sandboxed bot that runs user-provided JS code server-side */
export interface SandboxedBot extends BotInstance {
  /** True if the last tick call timed out */
  lastTimedOut: boolean;
  /** Last error message, if any */
  lastError?: string;
}

/**
 * Creates a sandboxed bot from user-provided JavaScript code.
 *
 * The code must define a function `createBot()` that returns an object
 * with a `tick(state, ship)` method. All 14 helper functions from
 * engine/helpers.ts are injected into the sandbox scope.
 *
 * For JS/TS: run directly (TypeScript must be pre-stripped of types).
 * For transpiler languages (Python, Kotlin, etc.): expect pre-compiled JS.
 *
 * @param code  JavaScript source code defining `createBot()`
 * @returns     A BotInstance-compatible sandboxed bot
 */
export function createSandboxedBot(code: string): SandboxedBot {
  // Build sandbox context with all helpers injected
  const sandbox: Record<string, unknown> = {
    // Math and standard globals
    Math,
    JSON,
    console: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
    // All 14 helpers from BOT_HELPERS
    ...BOT_HELPERS,
    // Storage for the bot factory result
    __botInstance: null as unknown,
    __createBot: null as unknown,
  };

  // Create the vm context
  const context = vm.createContext(sandbox);

  // Wrap user code so createBot is available and auto-called
  const wrappedCode = `
${code}
__createBot = (typeof createBot !== 'undefined') ? createBot : null;
if (__createBot) {
  __botInstance = __createBot();
}
`;

  // Run the setup code (no tick timeout here — it's initialization)
  try {
    const initScript = new vm.Script(wrappedCode);
    initScript.runInContext(context, { timeout: 2000 });
  } catch (err) {
    // If init fails, return a bot that always returns idle
    const errMsg = err instanceof Error ? err.message : String(err);
    return createIdleBot(`Init error: ${errMsg}`);
  }

  if (!sandbox.__botInstance || typeof (sandbox.__botInstance as Record<string, unknown>).tick !== 'function') {
    return createIdleBot('createBot() did not return an object with a tick() method');
  }

  // Pre-compile the tick caller for performance
  const tickScript = new vm.Script(`
    (function() {
      try {
        __lastResult = __botInstance.tick(__state, __ship);
        __lastError = null;
      } catch(e) {
        __lastError = e && e.message ? e.message : String(e);
        __lastResult = null;
      }
    })()
  `);

  let lastTimedOut = false;
  let lastError: string | undefined;

  const sandboxedBot: SandboxedBot = {
    get lastTimedOut() { return lastTimedOut; },
    get lastError() { return lastError; },

    tick(state: GameState, ship: BotShip): Command {
      // Inject tick args into the sandbox
      (sandbox as Record<string, unknown>).__state = state;
      (sandbox as Record<string, unknown>).__ship = ship;
      (sandbox as Record<string, unknown>).__lastResult = null;
      (sandbox as Record<string, unknown>).__lastError = null;

      try {
        tickScript.runInContext(context, { timeout: TICK_TIMEOUT_MS });
        lastTimedOut = false;

        const err = (sandbox as Record<string, unknown>).__lastError as string | null;
        if (err) {
          lastError = err;
          return { type: 'idle' };
        }

        const result = (sandbox as Record<string, unknown>).__lastResult as Command | null;
        if (!result || typeof result !== 'object') {
          lastError = 'tick() returned invalid command';
          return { type: 'idle' };
        }

        lastError = undefined;
        return result;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes('timed out') || errMsg.includes('Script execution timed out')) {
          lastTimedOut = true;
          lastError = 'Tick timed out (50ms limit exceeded)';
        } else {
          lastTimedOut = false;
          lastError = errMsg;
        }
        return { type: 'idle' };
      }
    },
  };

  return sandboxedBot;
}

/** Creates a no-op bot that always returns idle (used for error fallback) */
function createIdleBot(errorMsg: string): SandboxedBot {
  return {
    lastTimedOut: false,
    lastError: errorMsg,
    tick(): Command {
      return { type: 'idle' };
    },
  };
}
