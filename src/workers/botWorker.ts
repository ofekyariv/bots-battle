// ============================================================
// 🏴‍☠️ Bot Worker — sandboxed Web Worker for executing bot code
// Runs in a separate thread with timeout kill protection
// ============================================================

/// <reference lib="webworker" />

import type { Command, GameState, Ship } from '@/engine/types';
import { BOT_HELPERS } from '@/engine/helpers';

// Compile-time guard: ensure BOT_HELPERS has the expected shape.
// If a helper is added/removed from engine/helpers.ts, this will catch it at build time.
const _helperKeys: (keyof typeof BOT_HELPERS)[] = Object.keys(BOT_HELPERS) as (keyof typeof BOT_HELPERS)[];
void _helperKeys; // suppress unused-var lint

interface WorkerMessage {
  type: 'init' | 'tick';
  botCode?: string; // bot source code (for init)
  state?: GameState;
  ship?: Ship;
}

interface WorkerResponse {
  type: 'ready' | 'command' | 'error';
  command?: Command;
  error?: string;
}

let bot: { tick(state: GameState, ship: Ship): Command } | null = null;

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, botCode, state, ship } = event.data;

  if (type === 'init' && botCode) {
    try {
      // Inject ALL helpers from BOT_HELPERS registry (matches botSandbox.ts pattern).
      // Using named parameters so bot code can call helpers directly without imports.
      const helperNames = Object.keys(BOT_HELPERS) as (keyof typeof BOT_HELPERS)[];
      const helperValues = helperNames.map((k) => BOT_HELPERS[k]);

      const factory = new Function(
        ...helperNames,
        `
"use strict";

${botCode}

if (typeof createBot !== 'function') {
  throw new Error("Bot code must define a createBot() function");
}

return createBot();
`,
      ) as (...args: unknown[]) => unknown;

      const instance = factory(...helperValues);

      if (!instance || typeof (instance as { tick?: unknown }).tick !== 'function') {
        throw new Error('createBot() must return an object with a tick(state, ship) method');
      }

      bot = instance as { tick(state: GameState, ship: Ship): Command };
      const response: WorkerResponse = { type: 'ready' };
      self.postMessage(response);
    } catch (err) {
      const response: WorkerResponse = { type: 'error', error: String(err) };
      self.postMessage(response);
    }
  }

  if (type === 'tick' && bot && state && ship) {
    try {
      const command = bot.tick(state, ship);
      const response: WorkerResponse = { type: 'command', command };
      self.postMessage(response);
    } catch (err) {
      const response: WorkerResponse = { type: 'error', error: String(err) };
      self.postMessage(response);
    }
  }
};
