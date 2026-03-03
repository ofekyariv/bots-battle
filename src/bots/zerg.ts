// ============================================================
// 🏴‍☠️ Zerg Bot — sacrifice ships aggressively, rely on respawns
// ============================================================
//
// Strategy:
//   The Zerg doesn't value ship lives. It throws ships directly
//   at enemies, islands, and objectives without retreating.
//   Death is a feature — respawned ships arrive in the safe zone
//   and immediately charge out again.
//
//   Roles shift by game phase:
//   - RUSH phase (early, tick 0-300): All ships charge the
//     nearest enemy or neutral island — whatever comes first.
//     Accept any combat, even 1v5.
//
//   - SWARM phase (mid, tick 300-1200): 3 ships continue enemy
//     pressure, 2 ships capture islands opportunistically.
//     Still no retreating — just constant pressure.
//
//   - OVERWHELM phase (late): All 5 ships target the enemy's
//     most defended island and crash into it. The mass of bodies
//     is hard to counter even with superior positioning.
//
//   The Zerg wins by exhausting the enemy's patience and making
//   them spend all their time fighting instead of scoring.
//   It loses badly to opponents that can both fight AND score.
// ============================================================

import type { BotFactory, BotShip, GameState, Command } from '@/engine/types';
import {
  distanceTo,
  nearestIsland,
  islandsOwnedBy,
  islandsNotMine,
  nearestEnemy,
} from '@/engine/helpers';

export const botCode = `
function createBot() {
  return {
    tick(state, ship) {
      if (!ship.alive) return { type: 'idle' };

      const tick = state.tick;
      const alive = state.myShips.filter(s => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex(s => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      const enemies = state.enemyShips.filter(e => e.alive);
      const uncaptured = islandsNotMine(state.islands);

      // ── RUSH PHASE (early game) ──
      if (tick < 300) {
        // Rush the nearest target — enemy ship or island, whichever is closer
        const nearest = nearestEnemy(ship, state.enemyShips);
        const nearestIsl = nearestIsland(ship, uncaptured.length > 0 ? uncaptured : state.islands);

        const enemyDist = nearest ? distanceTo(ship, nearest) : Infinity;
        const islDist = nearestIsl ? distanceTo(ship, nearestIsl) : Infinity;

        if (enemyDist < islDist && nearest) {
          return { type: 'move', target: { x: nearest.x, y: nearest.y } };
        }
        if (nearestIsl) {
          return { type: 'move', target: { x: nearestIsl.x, y: nearestIsl.y } };
        }
        return { type: 'idle' };
      }

      // ── SWARM PHASE (mid game) ──
      if (tick < 1200) {
        // Ranks 0,1,2 → pressure enemies
        if (myRank <= 2) {
          if (enemies.length > 0) {
            const target = nearestEnemy(ship, state.enemyShips);
            return { type: 'move', target: { x: target.x, y: target.y } };
          }
        }
        // Ranks 3,4 → capture islands
        if (uncaptured.length > 0) {
          const ranked = [...uncaptured].sort((a, b) => {
            const aPrio = (a.owner === 'enemy' ? -500 : 0) + distanceTo(ship, a);
            const bPrio = (b.owner === 'enemy' ? -500 : 0) + distanceTo(ship, b);
            return aPrio - bPrio;
          });
          const targetIdx = myRank % ranked.length;
          return { type: 'move', target: { x: ranked[targetIdx].x, y: ranked[targetIdx].y } };
        }
        // If no uncaptured, all rush enemies
        if (enemies.length > 0) {
          const target = nearestEnemy(ship, state.enemyShips);
          return { type: 'move', target: { x: target.x, y: target.y } };
        }
        return { type: 'idle' };
      }

      // ── OVERWHELM PHASE (late game) ──
      // All ships pile onto the enemy's most valuable island
      const enemyIslands = islandsOwnedBy(state.islands, 'enemy');
      if (enemyIslands.length > 0) {
        // Target highest-value enemy island
        const t = enemyIslands.reduce((b, i) => i.value > b.value ? i : b);
        return { type: 'move', target: { x: t.x, y: t.y } };
      }

      // No enemy islands — mob the enemy directly
      if (enemies.length > 0) {
        const target = nearestEnemy(ship, state.enemyShips);
        return { type: 'move', target: { x: target.x, y: target.y } };
      }

      // Capture remaining islands
      if (uncaptured.length > 0) {
        const t = nearestIsland(ship, uncaptured);
        return { type: 'move', target: { x: t.x, y: t.y } };
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

      const tick = state.tick;
      const alive = state.myShips.filter((s) => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex((s) => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      const enemies = state.enemyShips.filter((e) => e.alive);
      const uncaptured = islandsNotMine(state.islands);

      // Rush phase
      if (tick < 300) {
        const nearest = nearestEnemy(ship, state.enemyShips);
        const nearestIsl = nearestIsland(ship, uncaptured.length > 0 ? uncaptured : state.islands);
        const enemyDist = nearest ? distanceTo(ship, nearest) : Infinity;
        const islDist = nearestIsl ? distanceTo(ship, nearestIsl) : Infinity;

        if (enemyDist < islDist && nearest) {
          return { type: 'move', target: { x: nearest.x, y: nearest.y } };
        }
        if (nearestIsl) {
          return { type: 'move', target: { x: nearestIsl.x, y: nearestIsl.y } };
        }
        return { type: 'idle' };
      }

      // Swarm phase
      if (tick < 1200) {
        if (myRank <= 2 && enemies.length > 0) {
          const target = nearestEnemy(ship, state.enemyShips);
          if (target) return { type: 'move', target: { x: target.x, y: target.y } };
        }
        if (uncaptured.length > 0) {
          const ranked = [...uncaptured].sort((a, b) => {
            const aPrio = (a.owner === 'enemy' ? -500 : 0) + distanceTo(ship, a);
            const bPrio = (b.owner === 'enemy' ? -500 : 0) + distanceTo(ship, b);
            return aPrio - bPrio;
          });
          const t = ranked[myRank % ranked.length];
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        if (enemies.length > 0) {
          const target = nearestEnemy(ship, state.enemyShips);
          if (target) return { type: 'move', target: { x: target.x, y: target.y } };
        }
        return { type: 'idle' };
      }

      // Overwhelm phase
      const enemyIslands = islandsOwnedBy(state.islands, 'enemy');
      if (enemyIslands.length > 0) {
        const t = enemyIslands.reduce((b, i) => (i.value > b.value ? i : b));
        return { type: 'move', target: { x: t.x, y: t.y } };
      }
      if (enemies.length > 0) {
        const target = nearestEnemy(ship, state.enemyShips);
        if (target) return { type: 'move', target: { x: target.x, y: target.y } };
      }
      if (uncaptured.length > 0) {
        const t = nearestIsland(ship, uncaptured);
        if (t) return { type: 'move', target: { x: t.x, y: t.y } };
      }
      return { type: 'idle' };
    },
  };
};

export default createBot;
