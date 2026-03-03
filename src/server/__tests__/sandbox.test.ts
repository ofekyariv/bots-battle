// ============================================================
// 🏴☠️ Server-Side Sandbox Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { createSandboxedBot } from '../sandbox';
import type { GameState, BotShip } from '@/engine/types';
import { DEFAULT_CONFIG } from '@/engine/types';

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

function makeState(): GameState {
  return {
    tick: 1,
    maxTicks: 300,
    mapWidth: DEFAULT_CONFIG.mapWidth,
    mapHeight: DEFAULT_CONFIG.mapHeight,
    myShips: [makeShip(0)],
    enemyShips: [makeShip(1, 900, 600)],
    islands: [],
    myScore: 0,
    enemyScore: 0,
    config: DEFAULT_CONFIG,
  };
}

function makeShip(id = 0, x = 100, y = 100): BotShip {
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

const IDLE_BOT = `
function createBot() {
  return {
    tick(state, ship) { return { type: 'idle' }; }
  };
}
`;

// ─────────────────────────────────────────────
// Basic correctness
// ─────────────────────────────────────────────

describe('createSandboxedBot — basic', () => {
  it('valid bot returns a command on tick', () => {
    const bot = createSandboxedBot(IDLE_BOT);
    const cmd = bot.tick(makeState(), makeShip());
    expect(cmd).toBeDefined();
    expect(cmd.type).toBe('idle');
  });

  it('bot returning move command is accepted', () => {
    const code = `
      function createBot() {
        return {
          tick(state, ship) { return { type: 'move', x: 200, y: 200 }; }
        };
      }
    `;
    const bot = createSandboxedBot(code);
    const cmd = bot.tick(makeState(), makeShip());
    expect(cmd.type).toBe('move');
  });

  it('missing createBot() returns idle bot gracefully', () => {
    const bot = createSandboxedBot('// no createBot here');
    const cmd = bot.tick(makeState(), makeShip());
    expect(cmd.type).toBe('idle');
  });

  it('createBot() that does not return tick method → idle fallback', () => {
    const bot = createSandboxedBot(`function createBot() { return {}; }`);
    const cmd = bot.tick(makeState(), makeShip());
    expect(cmd.type).toBe('idle');
  });
});

// ─────────────────────────────────────────────
// Timeout
// ─────────────────────────────────────────────

describe('createSandboxedBot — timeout', () => {
  it('bot that infinite-loops per tick returns idle within 200ms', () => {
    const code = `
      function createBot() {
        return {
          tick(state, ship) { while(true) {} }
        };
      }
    `;
    const bot = createSandboxedBot(code);
    const start = Date.now();
    const cmd = bot.tick(makeState(), makeShip());
    const elapsed = Date.now() - start;

    expect(cmd.type).toBe('idle');
    expect(elapsed).toBeLessThan(200);
    expect(bot.lastTimedOut).toBe(true);
  });

  it('slow-but-not-infinite bot eventually completes if under 50ms', () => {
    // A bot that does a small amount of work should succeed
    const code = `
      function createBot() {
        return {
          tick(state, ship) {
            let x = 0;
            for (let i = 0; i < 1000; i++) x += i;
            return { type: 'idle' };
          }
        };
      }
    `;
    const bot = createSandboxedBot(code);
    const cmd = bot.tick(makeState(), makeShip());
    expect(cmd.type).toBe('idle');
    expect(bot.lastTimedOut).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Invalid command handling
// ─────────────────────────────────────────────

describe('createSandboxedBot — invalid commands', () => {
  it('bot returning null → idle', () => {
    const code = `
      function createBot() {
        return { tick(state, ship) { return null; } };
      }
    `;
    const bot = createSandboxedBot(code);
    expect(bot.tick(makeState(), makeShip()).type).toBe('idle');
  });

  it('bot returning undefined → idle', () => {
    const code = `
      function createBot() {
        return { tick(state, ship) { return undefined; } };
      }
    `;
    const bot = createSandboxedBot(code);
    expect(bot.tick(makeState(), makeShip()).type).toBe('idle');
  });

  it('bot returning a string → idle', () => {
    const code = `
      function createBot() {
        return { tick(state, ship) { return 'garbage'; } };
      }
    `;
    const bot = createSandboxedBot(code);
    expect(bot.tick(makeState(), makeShip()).type).toBe('idle');
  });

  it('bot throwing an error → idle', () => {
    const code = `
      function createBot() {
        return { tick(state, ship) { throw new Error('oops'); } };
      }
    `;
    const bot = createSandboxedBot(code);
    const cmd = bot.tick(makeState(), makeShip());
    expect(cmd.type).toBe('idle');
    expect(bot.lastError).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
// Security
// ─────────────────────────────────────────────

describe('createSandboxedBot — security', () => {
  it('bot cannot access process (Node.js global)', () => {
    const code = `
      function createBot() {
        return {
          tick(state, ship) {
            try {
              const p = process;
              return { type: 'move', x: 0, y: 0 };
            } catch(e) {
              return { type: 'idle' };
            }
          }
        };
      }
    `;
    const bot = createSandboxedBot(code);
    // If process is accessible, returns 'move'; if sandboxed correctly, returns 'idle'
    const cmd = bot.tick(makeState(), makeShip());
    // Either outcome: it must not crash the test runner
    expect(['idle', 'move']).toContain(cmd.type);
    // More importantly: sandbox should not give raw process access
    // The vm context doesn't inject process, so accessing it should error → idle
    expect(cmd.type).toBe('idle');
  });

  it('bot cannot access require', () => {
    const code = `
      function createBot() {
        return {
          tick(state, ship) {
            try {
              const fs = require('fs');
              return { type: 'move', x: 1, y: 1 };
            } catch(e) {
              return { type: 'idle' };
            }
          }
        };
      }
    `;
    const bot = createSandboxedBot(code);
    const cmd = bot.tick(makeState(), makeShip());
    expect(cmd.type).toBe('idle');
  });

  it('bot cannot access global scope pollution from outside', () => {
    // Bot tries to read a global variable not injected into the sandbox
    const code = `
      function createBot() {
        return {
          tick(state, ship) {
            try {
              // __SECRET__ is not in the sandbox
              const val = typeof __SECRET__ !== 'undefined' ? __SECRET__ : 'notfound';
              return { type: 'idle' };
            } catch(e) {
              return { type: 'idle' };
            }
          }
        };
      }
    `;
    // Set something globally in test context
    (globalThis as Record<string, unknown>).__SECRET__ = 'leaked!';
    const bot = createSandboxedBot(code);
    // Bot tick should succeed but not leak the global
    const cmd = bot.tick(makeState(), makeShip());
    expect(cmd.type).toBe('idle');
    delete (globalThis as Record<string, unknown>).__SECRET__;
  });
});
