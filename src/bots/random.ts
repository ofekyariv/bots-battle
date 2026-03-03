// ============================================================
// 🏴‍☠️ Random Bot — chaotic wanderer (baseline / tutorial opponent)
// ============================================================
//
// Strategy (or lack thereof):
//   • Each ship picks a new target every ~40-60 ticks, or when it
//     arrives close to its current target.
//   • 65% chance: wander to a random island (at least it does
//     something useful sometimes).
//   • 35% chance: pure random position anywhere on the map.
//   • Ships respawn and immediately pick a new random target.
//
// Purpose:
//   This bot exists as the "easy" opponent and tutorial example.
//   Its code is intentionally readable — players learning to code
//   bots can study it and improve on it.
//
//   It also serves as a useful baseline: if your bot can't beat
//   Random, something is fundamentally wrong with your strategy.
// ============================================================

import type { BotFactory, BotShip, GameState, Command } from '@/engine/types';

// ─────────────────────────────────────────────
// Code string — eval'd in the sandbox
// ─────────────────────────────────────────────

export const botCode = `
function createBot() {
  // Per-ship memory
  const targets = {};     // ship.id → { x, y }
  const nextChange = {};  // ship.id → tick to change target

  return {
    tick(state, ship) {
      if (!ship.alive) {
        // Clear on death so respawn gets a fresh target immediately
        delete targets[ship.id];
        delete nextChange[ship.id];
        return { type: 'idle' };
      }

      const tick = state.tick;

      // Check if we should pick a new target
      const needsTarget =
        !targets[ship.id] ||
        tick >= (nextChange[ship.id] ?? 0) ||
        (
          // Also pick new target if we're close to current one
          Math.abs(ship.x - targets[ship.id].x) < 20 &&
          Math.abs(ship.y - targets[ship.id].y) < 20
        );

      if (needsTarget) {
        // 65% chance: go to a random island, 35% chance: pure random
        if (Math.random() < 0.65 && state.islands.length > 0) {
          const island = state.islands[Math.floor(Math.random() * state.islands.length)];
          // Add a slight random offset so ships don't pile up exactly on islands
          targets[ship.id] = {
            x: island.x + (Math.random() - 0.5) * 60,
            y: island.y + (Math.random() - 0.5) * 60,
          };
        } else {
          // Random position, with a margin so ships don't get stuck in corners
          const margin = 50;
          targets[ship.id] = {
            x: margin + Math.random() * (state.mapWidth  - margin * 2),
            y: margin + Math.random() * (state.mapHeight - margin * 2),
          };
        }

        // Wait 40–65 ticks before changing target again
        nextChange[ship.id] = tick + 40 + Math.floor(Math.random() * 25);
      }

      return { type: 'move', target: targets[ship.id] };
    },
  };
}
`;

// ─────────────────────────────────────────────
// Factory function — direct TypeScript import
// ─────────────────────────────────────────────

export const createBot: BotFactory = () => {
  const targets: Record<number, { x: number; y: number }> = {};
  const nextChange: Record<number, number> = {};

  return {
    tick(state: GameState, ship: BotShip): Command {
      if (!ship.alive) {
        delete targets[ship.id];
        delete nextChange[ship.id];
        return { type: 'idle' };
      }

      const tick = state.tick;

      const needsTarget =
        !targets[ship.id] ||
        tick >= (nextChange[ship.id] ?? 0) ||
        (Math.abs(ship.x - targets[ship.id].x) < 20 && Math.abs(ship.y - targets[ship.id].y) < 20);

      if (needsTarget) {
        if (Math.random() < 0.65 && state.islands.length > 0) {
          const island = state.islands[Math.floor(Math.random() * state.islands.length)];
          targets[ship.id] = {
            x: island.x + (Math.random() - 0.5) * 60,
            y: island.y + (Math.random() - 0.5) * 60,
          };
        } else {
          const margin = 50;
          targets[ship.id] = {
            x: margin + Math.random() * (state.mapWidth - margin * 2),
            y: margin + Math.random() * (state.mapHeight - margin * 2),
          };
        }
        nextChange[ship.id] = tick + 40 + Math.floor(Math.random() * 25);
      }

      return { type: 'move', target: targets[ship.id] };
    },
  };
};

export default createBot;
