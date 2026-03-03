// ============================================================
// 🏴☠️ Sandbox Integration Tests — All Languages
// ============================================================
//
// Tests that each language can be sandboxed and tick() returns
// a valid Command.
//
// - JS / TS: run directly in SandboxedBot
// - Java / C#: test the transpiler locally, then run via SandboxedBot
// - Python: mocked (Brython is browser-only)
// - Kotlin: mocked (JetBrains API is remote)
// - Swift: mocked (Godbolt API is remote)
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LANGUAGES } from '@/lib/languages/registry';
import { transpileJavaToJs } from '@/lib/javaSandbox';
import { transpileCSharpToJs } from '@/lib/csharpSandbox';
import { SandboxedBot } from '@/lib/botSandbox';
import type { GameState, BotShip, Command } from '@/engine/types';
import { DEFAULT_CONFIG } from '@/engine/types';

// ─────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────

function makeShip(id = 0, x = 350, y = 100): BotShip {
  return {
    id,
    x,
    y,
    alive: true,
    isCapturing: false,
    turnsToRevive: 0,
    initialX: x,
    initialY: y,
    combatPressure: 0,
  };
}

function makeIsland(id = 0, x = 350, y = 500, owner: BotShip['alive'] extends boolean ? 'me' | 'enemy' | 'neutral' : never = 'neutral') {
  return {
    id,
    x,
    y,
    radius: 50,
    owner: owner as 'me' | 'enemy' | 'neutral',
    teamCapturing: 'none' as const,
    captureProgress: 0,
    captureTurns: 15,
    value: 1,
  };
}

const MOCK_STATE: GameState = {
  tick: 0,
  maxTicks: 15000,
  mapWidth: 700,
  mapHeight: 1000,
  myShips: [makeShip(0, 350, 100)],
  enemyShips: [makeShip(1, 350, 900)],
  islands: [makeIsland(0, 350, 500, 'neutral')],
  myScore: 0,
  enemyScore: 0,
  targetScore: 10000,
  config: DEFAULT_CONFIG,
};

function isValidCommand(cmd: unknown): boolean {
  if (typeof cmd !== 'object' || cmd === null) return false;
  const c = cmd as Record<string, unknown>;
  if (c.type === 'idle') return true;
  if (c.type === 'move') {
    const t = c.target as Record<string, unknown>;
    return typeof t?.x === 'number' && typeof t?.y === 'number';
  }
  return false;
}

// ─────────────────────────────────────────────
// JavaScript
// ─────────────────────────────────────────────

describe('JavaScript sandbox', () => {
  it('createSandbox(starterCode) succeeds and tick() returns a valid Command', () => {
    const code = LANGUAGES.javascript.starterCode;
    const bot = new SandboxedBot('test-js');
    bot.initFromCode(code);
    expect(bot.isReady).toBe(true);

    const ship = makeShip(0);
    const cmd = bot.tick(MOCK_STATE, ship);
    expect(isValidCommand(cmd)).toBe(true);
    bot.destroy();
  });
});

// ─────────────────────────────────────────────
// TypeScript
// ─────────────────────────────────────────────

describe('TypeScript sandbox', () => {
  it('createSandbox(starterCode, "typescript") strips types and runs', () => {
    const code = LANGUAGES.typescript.starterCode;
    const bot = new SandboxedBot('test-ts');
    bot.initFromCode(code); // SandboxedBot handles TS stripping internally
    expect(bot.isReady).toBe(true);

    const ship = makeShip(0);
    const cmd = bot.tick(MOCK_STATE, ship);
    expect(isValidCommand(cmd)).toBe(true);
    bot.destroy();
  });
});

// ─────────────────────────────────────────────
// Java (transpiler)
// ─────────────────────────────────────────────

describe('Java transpiler', () => {
  it('transpileJavaToJs(starterCode) returns valid JS string', () => {
    const code = LANGUAGES.java.starterCode;
    const js = transpileJavaToJs(code);
    expect(typeof js).toBe('string');
    expect(js.length).toBeGreaterThan(10);
    // The resulting JS should contain createBot
    expect(js).toContain('createBot');
  });

  it('transpiled Java starter code runs and returns valid Command', () => {
    const code = LANGUAGES.java.starterCode;
    const js = transpileJavaToJs(code);
    const bot = new SandboxedBot('test-java');
    bot.initFromCode(js);
    expect(bot.isReady).toBe(true);

    const ship = makeShip(0);
    const cmd = bot.tick(MOCK_STATE, ship);
    expect(isValidCommand(cmd)).toBe(true);
    bot.destroy();
  });
});

// ─────────────────────────────────────────────
// C# (transpiler)
// ─────────────────────────────────────────────

describe('C# transpiler', () => {
  it('transpileCSharpToJs(starterCode) returns valid JS string', () => {
    const code = LANGUAGES.csharp.starterCode;
    const js = transpileCSharpToJs(code);
    expect(typeof js).toBe('string');
    expect(js.length).toBeGreaterThan(10);
    expect(js).toContain('createBot');
  });

  it('transpiled C# starter code runs and returns valid Command', () => {
    const code = LANGUAGES.csharp.starterCode;
    const js = transpileCSharpToJs(code);
    const bot = new SandboxedBot('test-csharp');
    bot.initFromCode(js);
    expect(bot.isReady).toBe(true);

    const ship = makeShip(0);
    const cmd = bot.tick(MOCK_STATE, ship);
    expect(isValidCommand(cmd)).toBe(true);
    bot.destroy();
  });
});

// ─────────────────────────────────────────────
// Python (Brython is browser-only — test wrapper contract only)
// ─────────────────────────────────────────────

describe('Python sandbox (mocked Brython)', () => {
  it('PythonSandboxedBot can be imported and has expected interface', async () => {
    const { PythonSandboxedBot } = await import('@/lib/pythonSandbox');
    const bot = new PythonSandboxedBot('test-python');
    expect(typeof bot.tick).toBe('function');
    expect(typeof bot.destroy).toBe('function');
    expect(typeof bot.initFromCode).toBe('function');
    // Not ready until initFromCode (and Brython) finishes — just verify shape
    expect(bot.isReady).toBe(false);
    bot.destroy();
  });

  it('isPythonCode() correctly identifies Python starter code', async () => {
    const { isPythonCode } = await import('@/lib/pythonSandbox');
    expect(isPythonCode(LANGUAGES.python.starterCode)).toBe(true);
    expect(isPythonCode(LANGUAGES.javascript.starterCode)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Kotlin (remote API — mock fetch)
// ─────────────────────────────────────────────

describe('Kotlin sandbox (mocked JetBrains API)', () => {
  beforeEach(() => {
    // Mock a successful Kotlin compile response (returns UMD JS with a tick export)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jsCode: `
          (function(root, factory) {
            if (typeof module !== 'undefined') { module.exports = factory(); }
            else { root['kotlin_test'] = factory(); }
          })(typeof globalThis !== 'undefined' ? globalThis : this, function() {
            function tick(state, ship) { return { type: 'idle' }; }
            return { tick };
          });
        `,
        errors: [],
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('KotlinSandboxedBot has expected interface', async () => {
    const { KotlinSandboxedBot } = await import('@/lib/kotlinSandbox');
    const bot = new KotlinSandboxedBot('test-kotlin');
    expect(typeof bot.tick).toBe('function');
    expect(typeof bot.destroy).toBe('function');
    expect(typeof bot.initFromCode).toBe('function');
    bot.destroy();
  });

  it('isKotlinCode() identifies Kotlin starter code', async () => {
    const { isKotlinCode } = await import('@/lib/kotlinSandbox');
    expect(isKotlinCode(LANGUAGES.kotlin.starterCode)).toBe(true);
    expect(isKotlinCode(LANGUAGES.javascript.starterCode)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Swift (remote Godbolt API — mock fetch)
// ─────────────────────────────────────────────

describe('Swift sandbox (mocked Godbolt API)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stdout: JSON.stringify({ type: 'idle' }),
        stderr: '',
        code: 0,
      }),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('SwiftSandboxedBot has expected interface', async () => {
    const { SwiftSandboxedBot } = await import('@/lib/swiftSandbox');
    const bot = new SwiftSandboxedBot('test-swift');
    expect(typeof bot.tick).toBe('function');
    expect(typeof bot.destroy).toBe('function');
    expect(typeof bot.initFromCode).toBe('function');
    bot.destroy();
  });

  it('isSwiftCode() identifies Swift starter code', async () => {
    const { isSwiftCode } = await import('@/lib/swiftSandbox');
    expect(isSwiftCode(LANGUAGES.swift.starterCode)).toBe(true);
    expect(isSwiftCode(LANGUAGES.javascript.starterCode)).toBe(false);
  });
});
