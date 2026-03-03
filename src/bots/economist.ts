// ============================================================
// 🏴‍☠️ Economist Bot — pure scoring optimizer, ignores combat
// ============================================================
//
// Strategy:
//   The Economist thinks purely in points. It calculates:
//     • Current score rate (exponential — 2^(islands-1))
//     • Marginal gain from capturing each additional island
//     • Opportunity cost of each ship assignment
//
//   Ships are assigned to maximize points-per-tick increase:
//     - Grabbing a neutral island doubles the scoring rate
//     - Grabbing an enemy island both adds and removes scoring
//     - Defending one costs a ship that could be earning more
//
//   Key insight: island #3 → #4 doubles score again (4→8 pts/tick).
//   The Economist prioritizes based on the scoring DELTA, not just
//   proximity. A far island that crosses a doubling threshold beats
//   a nearby island at the same doubling level.
//
//   Combat avoidance: ships flee if they'd die (wouldDieAt check)
//   but don't hunt enemies — killing costs ticks that could be spent
//   capturing. If cornered, it accepts death (respawn is faster than
//   a detour to fight).
// ============================================================

import type { BotFactory, BotShip, GameState, Command } from '@/engine/types';
import {
  distanceTo,
  nearestIsland,
  islandsOwnedBy,
  islandsNotMine,
  wouldDieAt,
  scoreRate,
} from '@/engine/helpers';

export const botCode = `
function createBot() {
  return {
    tick(state, ship) {
      if (!ship.alive) return { type: 'idle' };

      const myIslands = islandsOwnedBy(state.islands, 'me');
      const myValue = myIslands.reduce((s, i) => s + i.value, 0);
      const currentRate = scoreRate(myValue);

      // Check if moving toward target would be suicidal
      function isSafe(target) {
        const others = state.myShips.filter(s => s.id !== ship.id && s.alive);
        return !wouldDieAt(target, others, state.enemyShips, state.config.attackRadius);
      }

      // Score the marginal value of capturing each uncaptured island
      const uncaptured = islandsNotMine(state.islands);
      if (uncaptured.length === 0) {
        // All islands mine — hold nearest
        if (myIslands.length > 0) {
          const t = nearestIsland(ship, myIslands);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // Marginal scoring value of each island
      const scored = uncaptured.map(island => {
        const newValue = myValue + island.value;
        const newRate = scoreRate(newValue);
        const marginalGain = newRate - currentRate;

        // If enemy owns it, we also reduce their rate
        let enemyReduction = 0;
        if (island.owner === 'enemy') {
          const enemyIslands = islandsOwnedBy(state.islands, 'enemy');
          const enemyValue = enemyIslands.reduce((s, i) => s + i.value, 0);
          const enemyCurrentRate = scoreRate(enemyValue);
          const enemyNewRate = scoreRate(enemyValue - island.value);
          enemyReduction = enemyCurrentRate - enemyNewRate;
        }

        const totalValue = marginalGain + enemyReduction * 0.7;  // discount enemy reduction
        const travelTicks = distanceTo(ship, island) / state.config.shipSpeed;
        const captureTicks = island.owner === 'enemy'
          ? island.captureTurns * 2 - island.captureProgress
          : island.captureTurns - island.captureProgress;
        const totalTicks = Math.max(1, travelTicks + captureTicks);

        // Net value per tick to capture this island
        const roi = totalValue / totalTicks;

        return { island, roi };
      });

      // Pick highest ROI island — but only if safe approach
      scored.sort((a, b) => b.roi - a.roi);

      for (const { island } of scored) {
        if (isSafe({ x: island.x, y: island.y })) {
          return { type: 'move', target: { x: island.x, y: island.y } };
        }
      }

      // All targets dangerous — flee toward our own islands or map centre
      if (myIslands.length > 0) {
        const t = nearestIsland(ship, myIslands);
        return { type: 'move', target: { x: t.x, y: t.y } };
      }
      return { type: 'move', target: { x: state.mapWidth / 2, y: state.mapHeight / 2 } };
    },
  };
}
`;

export const createBot: BotFactory = () => {
  return {
    tick(state: GameState, ship: BotShip): Command {
      if (!ship.alive) return { type: 'idle' };

      const myIslands = islandsOwnedBy(state.islands, 'me');
      const myValue = myIslands.reduce((s, i) => s + i.value, 0);
      const currentRate = scoreRate(myValue);

      const isSafe = (target: { x: number; y: number }) => {
        const others = state.myShips.filter((s) => s.id !== ship.id && s.alive);
        return !wouldDieAt(target, others, state.enemyShips, state.config.attackRadius);
      };

      const uncaptured = islandsNotMine(state.islands);
      if (uncaptured.length === 0) {
        if (myIslands.length > 0) {
          const t = nearestIsland(ship, myIslands);
          if (t) return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      const scored = uncaptured.map((island) => {
        const newValue = myValue + island.value;
        const newRate = scoreRate(newValue);
        const marginalGain = newRate - currentRate;

        let enemyReduction = 0;
        if (island.owner === 'enemy') {
          const enemyIslands = islandsOwnedBy(state.islands, 'enemy');
          const enemyValue = enemyIslands.reduce((s, i) => s + i.value, 0);
          enemyReduction = scoreRate(enemyValue) - scoreRate(enemyValue - island.value);
        }

        const totalValue = marginalGain + enemyReduction * 0.7;
        const travelTicks = distanceTo(ship, island) / state.config.shipSpeed;
        const captureTicks =
          island.owner === 'enemy'
            ? island.captureTurns * 2 - island.captureProgress
            : island.captureTurns - island.captureProgress;
        const totalTicks = Math.max(1, travelTicks + captureTicks);
        const roi = totalValue / totalTicks;

        return { island, roi };
      });

      scored.sort((a, b) => b.roi - a.roi);

      for (const { island } of scored) {
        if (isSafe({ x: island.x, y: island.y })) {
          return { type: 'move', target: { x: island.x, y: island.y } };
        }
      }

      if (myIslands.length > 0) {
        const t = nearestIsland(ship, myIslands);
        if (t) return { type: 'move', target: { x: t.x, y: t.y } };
      }
      return { type: 'move', target: { x: state.mapWidth / 2, y: state.mapHeight / 2 } };
    },
  };
};

export default createBot;
