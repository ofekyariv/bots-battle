// ============================================================
// 🏴‍☠️ Chaos Bot — randomly picks one of 3 sub-strategies
// ============================================================
//
// Strategy:
//   At the start of every game, Chaos randomly selects one of
//   three completely different strategies:
//
//   BERSERKER (33%):
//   All 5 ships rush the nearest alive enemy every tick.
//   Pure aggression — no islands, just combat. If enemies die,
//   grab nearest island. Never retreats.
//
//   PHANTOM (33%):
//   Ships spread to all corners of the map, capturing islands
//   in a wide dispersal pattern. Never groups up. Extremely hard
//   to catch — when enemy comes near, the ship moves away.
//
//   BLITZ (33%):
//   3 ships race to capture islands as fast as possible (Rusher
//   style). 2 ships form a hunting pair that kills any lone
//   enemy ship it finds. Stops fighting once ahead by 300 points.
//
//   The randomness makes Chaos extremely hard to counter:
//   you never know what's coming. It might be a combat bot or
//   an expansion bot. Prepare for both and you're split.
//   The randomness also means Chaos can get lucky and surprise
//   even strong, well-prepared strategies.
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
  // Pick sub-strategy once at creation time
  const strategies = ['berserker', 'phantom', 'blitz'];
  const chosen = strategies[Math.floor(Math.random() * strategies.length)];

  return {
    tick(state, ship) {
      if (!ship.alive) return { type: 'idle' };

      const alive = state.myShips.filter(s => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex(s => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      const aliveEnemies = state.enemyShips.filter(e => e.alive);
      const uncaptured = islandsNotMine(state.islands);
      const r = state.config.attackRadius;

      // ══ BERSERKER ══
      if (chosen === 'berserker') {
        if (aliveEnemies.length > 0) {
          const target = nearestEnemy(ship, state.enemyShips);
          return { type: 'move', target: { x: target.x, y: target.y } };
        }
        // No enemies — grab nearest island
        if (uncaptured.length > 0) {
          const t = nearestIsland(ship, uncaptured);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // ══ PHANTOM ══
      if (chosen === 'phantom') {
        // Each ship assigned to a different corner/edge
        const corners = [
          { x: state.mapWidth * 0.15, y: state.mapHeight * 0.15 },
          { x: state.mapWidth * 0.85, y: state.mapHeight * 0.15 },
          { x: state.mapWidth * 0.15, y: state.mapHeight * 0.85 },
          { x: state.mapWidth * 0.85, y: state.mapHeight * 0.85 },
          { x: state.mapWidth * 0.50, y: state.mapHeight * 0.50 },
        ];
        const myCorner = corners[myRank % corners.length];

        // Are enemies chasing me? Flee if one is within 4x attack radius
        const chaser = state.enemyShips.filter(
          e => e.alive && distanceTo(ship, e) < r * 4
        );
        if (chaser.length > 0) {
          // Flee directly away from chaser centroid
          const cx = chaser.reduce((s, e) => s + e.x, 0) / chaser.length;
          const cy = chaser.reduce((s, e) => s + e.y, 0) / chaser.length;
          const fleeX = ship.x + (ship.x - cx);
          const fleeY = ship.y + (ship.y - cy);
          const safeX = Math.max(50, Math.min(state.mapWidth - 50, fleeX));
          const safeY = Math.max(50, Math.min(state.mapHeight - 50, fleeY));
          return { type: 'move', target: { x: safeX, y: safeY } };
        }

        // Move to our corner; if already there, capture nearest island
        const distToCorner = distanceTo(ship, myCorner);
        if (distToCorner > 80) {
          return { type: 'move', target: myCorner };
        }

        // Near our corner — grab nearest uncaptured island
        if (uncaptured.length > 0) {
          const t = nearestIsland(ship, uncaptured);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // ══ BLITZ ══
      // ranks 0,1 → hunting pair; ranks 2,3,4 → capturers
      const isHunter = myRank <= 1;
      const scoreDelta = state.myScore - state.enemyScore;

      if (isHunter && scoreDelta < 300) {
        // Hunt lone enemies
        if (aliveEnemies.length > 0) {
          // Find most isolated enemy
          const target = aliveEnemies.reduce((best, e) => {
            const eFriends = aliveEnemies.filter(x => x.id !== e.id && distanceTo(x, e) <= r * 2).length;
            const bFriends = aliveEnemies.filter(x => x.id !== best.id && distanceTo(x, best) <= r * 2).length;
            if (eFriends < bFriends) return e;
            if (eFriends > bFriends) return best;
            return distanceTo(ship, e) < distanceTo(ship, best) ? e : best;
          });

          // Regroup with partner if far away
          const partner = alive[myRank === 0 ? 1 : 0];
          if (partner && distanceTo(ship, partner) > r * 2) {
            return { type: 'move', target: { x: partner.x, y: partner.y } };
          }
          return { type: 'move', target: { x: target.x, y: target.y } };
        }
      }

      // Capturers (or hunter that's far ahead)
      if (uncaptured.length > 0) {
        const sorted = [...uncaptured].sort((a, b) => {
          const aPrio = (a.owner === 'enemy' ? -3000 : 0) + distanceTo(ship, a);
          const bPrio = (b.owner === 'enemy' ? -3000 : 0) + distanceTo(ship, b);
          return aPrio - bPrio;
        });
        const t = sorted[myRank % sorted.length];
        return { type: 'move', target: { x: t.x, y: t.y } };
      }
      return { type: 'idle' };
    },
  };
}
`;

export const createBot: BotFactory = () => {
  const strategies = ['berserker', 'phantom', 'blitz'] as const;
  const chosen = strategies[Math.floor(Math.random() * strategies.length)];

  return {
    tick(state: GameState, ship: BotShip): Command {
      if (!ship.alive) return { type: 'idle' };

      const alive = state.myShips.filter((s) => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex((s) => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      const aliveEnemies = state.enemyShips.filter((e) => e.alive);
      const uncaptured = islandsNotMine(state.islands);
      const r = state.config.attackRadius;

      // ══ BERSERKER ══
      if (chosen === 'berserker') {
        if (aliveEnemies.length > 0) {
          const target = nearestEnemy(ship, state.enemyShips);
          if (target) return { type: 'move', target: { x: target.x, y: target.y } };
        }
        if (uncaptured.length > 0) {
          const t = nearestIsland(ship, uncaptured);
          if (t) return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // ══ PHANTOM ══
      if (chosen === 'phantom') {
        const corners = [
          { x: state.mapWidth * 0.15, y: state.mapHeight * 0.15 },
          { x: state.mapWidth * 0.85, y: state.mapHeight * 0.15 },
          { x: state.mapWidth * 0.15, y: state.mapHeight * 0.85 },
          { x: state.mapWidth * 0.85, y: state.mapHeight * 0.85 },
          { x: state.mapWidth * 0.5, y: state.mapHeight * 0.5 },
        ];
        const myCorner = corners[myRank % corners.length];

        const chasers = state.enemyShips.filter((e) => e.alive && distanceTo(ship, e) < r * 4);
        if (chasers.length > 0) {
          const cx = chasers.reduce((s, e) => s + e.x, 0) / chasers.length;
          const cy = chasers.reduce((s, e) => s + e.y, 0) / chasers.length;
          const fleeX = ship.x + (ship.x - cx);
          const fleeY = ship.y + (ship.y - cy);
          return {
            type: 'move',
            target: {
              x: Math.max(50, Math.min(state.mapWidth - 50, fleeX)),
              y: Math.max(50, Math.min(state.mapHeight - 50, fleeY)),
            },
          };
        }

        if (distanceTo(ship, myCorner) > 80) {
          return { type: 'move', target: myCorner };
        }
        if (uncaptured.length > 0) {
          const t = nearestIsland(ship, uncaptured);
          if (t) return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // ══ BLITZ ══
      const isHunter = myRank <= 1;
      const scoreDelta = state.myScore - state.enemyScore;

      if (isHunter && scoreDelta < 300) {
        if (aliveEnemies.length > 0) {
          const target = aliveEnemies.reduce((best, e) => {
            const eFriends = aliveEnemies.filter(
              (x) => x.id !== e.id && distanceTo(x, e) <= r * 2,
            ).length;
            const bFriends = aliveEnemies.filter(
              (x) => x.id !== best.id && distanceTo(x, best) <= r * 2,
            ).length;
            if (eFriends < bFriends) return e;
            if (eFriends > bFriends) return best;
            return distanceTo(ship, e) < distanceTo(ship, best) ? e : best;
          });

          const partner = alive[myRank === 0 ? 1 : 0];
          if (partner && distanceTo(ship, partner) > r * 2) {
            return { type: 'move', target: { x: partner.x, y: partner.y } };
          }
          return { type: 'move', target: { x: target.x, y: target.y } };
        }
      }

      if (uncaptured.length > 0) {
        const sorted = [...uncaptured].sort((a, b) => {
          const aPrio = (a.owner === 'enemy' ? -3000 : 0) + distanceTo(ship, a);
          const bPrio = (b.owner === 'enemy' ? -3000 : 0) + distanceTo(ship, b);
          return aPrio - bPrio;
        });
        const t = sorted[myRank % sorted.length];
        return { type: 'move', target: { x: t.x, y: t.y } };
      }
      return { type: 'idle' };
    },
  };
};

export default createBot;
