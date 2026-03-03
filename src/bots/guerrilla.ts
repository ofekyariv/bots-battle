// ============================================================
// 🏴‍☠️ Guerrilla Bot — hit-and-run, never stand and fight
// ============================================================
//
// Strategy:
//   Each ship moves independently. Every tick it checks whether
//   enemies are approaching within threat range. If so, it
//   immediately flees in the opposite direction — even if mid-capture.
//   Once safe, it hunts for the nearest undefended island.
//
//   The Guerrilla never intentionally fights. It wins by wearing
//   the enemy down with constant re-captures. The enemy spends
//   all its time chasing ships that are already gone.
//
//   Phases:
//   FLEE  — enemy within threat range, run opposite direction
//   HUNT  — move to nearest uncaptured / under-defended island
//   HOLD  — island mine and no nearby threat, stay and cap
//
//   The flee vector is: away from all nearby enemies (weighted
//   inverse square to avoid closest). The ship targets a map
//   edge escape point 300 units in that direction.
// ============================================================

import type { BotFactory, BotShip, GameState, Command } from '@/engine/types';
import { distanceTo, nearestIsland, islandsNotMine, islandsOwnedBy } from '@/engine/helpers';

export const botCode = `
function createBot() {
  return {
    tick(state, ship) {
      if (!ship.alive) return { type: 'idle' };

      const r = state.config.attackRadius;
      const threatRange = r * 3.5; // flee when enemy is this close

      const nearbyEnemies = state.enemyShips.filter(
        e => e.alive && distanceTo(ship, e) < threatRange
      );

      // ── FLEE mode ──
      if (nearbyEnemies.length > 0) {
        // Weighted flee vector: stronger repulsion from closer enemies
        let fx = 0;
        let fy = 0;
        for (const e of nearbyEnemies) {
          const d = Math.max(1, distanceTo(ship, e));
          const w = 1 / (d * d);
          fx -= (e.x - ship.x) * w;
          fy -= (e.y - ship.y) * w;
        }
        const mag = Math.sqrt(fx * fx + fy * fy) || 1;
        const escapeX = ship.x + (fx / mag) * 300;
        const escapeY = ship.y + (fy / mag) * 300;
        // Clamp to map bounds
        const safeX = Math.max(50, Math.min(state.mapWidth - 50, escapeX));
        const safeY = Math.max(50, Math.min(state.mapHeight - 50, escapeY));
        return { type: 'move', target: { x: safeX, y: safeY } };
      }

      // ── HUNT mode — find best undefended island ──
      const uncaptured = islandsNotMine(state.islands);

      if (uncaptured.length > 0) {
        // Score: prefer islands with no nearby enemies (guerrilla loves safe captures)
        const best = uncaptured.reduce((b, i) => {
          const enemiesNear = state.enemyShips.filter(
            e => e.alive && distanceTo(e, i) < threatRange * 1.5
          ).length;
          const dist = distanceTo(ship, i);
          // Lower score = better target
          const score = dist + enemiesNear * 400;

          const bEnemiesNear = state.enemyShips.filter(
            e => e.alive && distanceTo(e, b) < threatRange * 1.5
          ).length;
          const bScore = distanceTo(ship, b) + bEnemiesNear * 400;

          return score < bScore ? i : b;
        });
        return { type: 'move', target: { x: best.x, y: best.y } };
      }

      // All islands mine — guard nearest contested one
      const contested = state.islands.filter(
        i => i.owner === 'me' && i.teamCapturing === 'enemy'
      );
      if (contested.length > 0) {
        // Only go if no enemies near destination
        const t = nearestIsland(ship, contested);
        const danger = state.enemyShips.filter(
          e => e.alive && distanceTo(e, t) < threatRange
        ).length;
        if (danger === 0) {
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        // Too dangerous — hover at a safe distance
        const safeX = (t.x + ship.x) / 2;
        const safeY = (t.y + ship.y) / 2;
        return { type: 'move', target: { x: safeX, y: safeY } };
      }

      return { type: 'idle' };
    },
  };
}
`;

export const createBot: BotFactory = () => {
  return {
    tick(state: GameState, ship: BotShip): Command {
      if (!ship.alive) return { type: 'idle' };

      const r = state.config.attackRadius;
      const threatRange = r * 3.5;

      const nearbyEnemies = state.enemyShips.filter(
        (e) => e.alive && distanceTo(ship, e) < threatRange,
      );

      // ── FLEE ──
      if (nearbyEnemies.length > 0) {
        let fx = 0;
        let fy = 0;
        for (const e of nearbyEnemies) {
          const d = Math.max(1, distanceTo(ship, e));
          const w = 1 / (d * d);
          fx -= (e.x - ship.x) * w;
          fy -= (e.y - ship.y) * w;
        }
        const mag = Math.sqrt(fx * fx + fy * fy) || 1;
        const escapeX = ship.x + (fx / mag) * 300;
        const escapeY = ship.y + (fy / mag) * 300;
        const safeX = Math.max(50, Math.min(state.mapWidth - 50, escapeX));
        const safeY = Math.max(50, Math.min(state.mapHeight - 50, escapeY));
        return { type: 'move', target: { x: safeX, y: safeY } };
      }

      // ── HUNT ──
      const uncaptured = islandsNotMine(state.islands);
      if (uncaptured.length > 0) {
        const best = uncaptured.reduce((b, i) => {
          const enemiesNear = state.enemyShips.filter(
            (e) => e.alive && distanceTo(e, i) < threatRange * 1.5,
          ).length;
          const score = distanceTo(ship, i) + enemiesNear * 400;
          const bEnemiesNear = state.enemyShips.filter(
            (e) => e.alive && distanceTo(e, b) < threatRange * 1.5,
          ).length;
          const bScore = distanceTo(ship, b) + bEnemiesNear * 400;
          return score < bScore ? i : b;
        });
        return { type: 'move', target: { x: best.x, y: best.y } };
      }

      // ── GUARD contested islands ──
      const contested = state.islands.filter(
        (i) => i.owner === 'me' && i.teamCapturing === 'enemy',
      );
      if (contested.length > 0) {
        const t = nearestIsland(ship, contested);
        if (t) {
          const danger = state.enemyShips.filter(
            (e) => e.alive && distanceTo(e, t) < threatRange,
          ).length;
          if (danger === 0) {
            return { type: 'move', target: { x: t.x, y: t.y } };
          }
          return { type: 'move', target: { x: (t.x + ship.x) / 2, y: (t.y + ship.y) / 2 } };
        }
      }

      return { type: 'idle' };
    },
  };
};

export default createBot;
