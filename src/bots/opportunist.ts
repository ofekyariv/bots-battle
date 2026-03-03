// ============================================================
// 🏴‍☠️ Opportunist Bot — captures islands the enemy leaves empty
// ============================================================
//
// Strategy:
//   The Opportunist watches enemy ship positions and scores
//   each uncaptured island by how "undefended" it is:
//
//     opportunity = islandValue / (enemyPresence + 0.5)
//                 + recencyBonus if enemy just left
//
//   Ships are dispatched to the highest-opportunity islands.
//   They immediately back off (move to safety point) if an
//   enemy ship comes within the capture radius.
//
//   Back-channel defense: if an enemy ship is approaching
//   one of our islands and we have no defenders there, the
//   nearest free ship breaks off to intercept — but only if
//   the intercept doesn't expose a bigger opportunity.
//
//   The core lesson: you can never fully cover a large map.
//   The Opportunist punishes you for over-committing anywhere.
// ============================================================

import type { BotFactory, BotShip, GameState, Command } from '@/engine/types';
import { distanceTo, nearestIsland, islandsOwnedBy, islandsNotMine } from '@/engine/helpers';

export const botCode = `
function createBot() {
  return {
    tick(state, ship) {
      if (!ship.alive) return { type: 'idle' };

      const r = state.config.captureRadius;
      const alive = state.myShips.filter(s => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex(s => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      // ── DEFEND threatened owned islands ──
      // If an enemy is on one of my islands and no ally is there, rush it
      const threatened = state.islands.filter(
        i => i.owner === 'me' && i.teamCapturing === 'enemy'
      );

      // Only the closest free ship defends
      if (threatened.length > 0 && myRank === 0) {
        const t = nearestIsland(ship, threatened);
        return { type: 'move', target: { x: t.x, y: t.y } };
      }

      // ── Score each uncaptured island by opportunity ──
      const uncaptured = islandsNotMine(state.islands);
      if (uncaptured.length === 0) {
        // Guard contested owned islands
        const contested = state.islands.filter(i => i.teamCapturing === 'enemy');
        if (contested.length > 0) {
          const t = nearestIsland(ship, contested);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // For each island: count enemies heading towards it (projected positions)
      const scoredIslands = uncaptured.map(island => {
        // Enemies within 2x capture radius of this island
        const guardingEnemies = state.enemyShips.filter(e => {
          if (!e.alive) return false;
          return distanceTo(e, island) < r * 2.5;
        }).length;

        // Enemies moving toward this island (simple: are they closer than capture radius * 3?)
        const approachingEnemies = state.enemyShips.filter(e => {
          if (!e.alive) return false;
          return distanceTo(e, island) < r * 4;
        }).length;

        const enemyPresence = guardingEnemies * 2 + approachingEnemies;
        const dist = distanceTo(ship, island);
        const valueBonus = island.owner === 'enemy' ? 500 : 0; // stopping enemy scoring

        // Higher opportunity = fewer enemies + closer + enemy penalty
        const opportunity = (1000 + valueBonus) / (enemyPresence + 0.5) - dist * 0.5;
        return { island, opportunity };
      });

      scoredIslands.sort((a, b) => b.opportunity - a.opportunity);

      // Each ship grabs a different island (spread by rank to avoid bunching)
      const targetIdx = myRank % scoredIslands.length;
      const best = scoredIslands[targetIdx];

      if (!best) return { type: 'idle' };

      // If enemies are arriving at our target, abort and pick next best
      const enemiesOnTarget = state.enemyShips.filter(
        e => e.alive && distanceTo(e, best.island) < r
      ).length;

      if (enemiesOnTarget > 0) {
        // Back off — pick the next opportunity
        for (let i = 0; i < scoredIslands.length; i++) {
          const alt = scoredIslands[i];
          const altEnemies = state.enemyShips.filter(
            e => e.alive && distanceTo(e, alt.island) < r
          ).length;
          if (altEnemies === 0) {
            return { type: 'move', target: { x: alt.island.x, y: alt.island.y } };
          }
        }
        // Everything dangerous — move to map centre and wait
        return { type: 'move', target: { x: state.mapWidth / 2, y: state.mapHeight / 2 } };
      }

      return { type: 'move', target: { x: best.island.x, y: best.island.y } };
    },
  };
}
`;

export const createBot: BotFactory = () => {
  return {
    tick(state: GameState, ship: BotShip): Command {
      if (!ship.alive) return { type: 'idle' };

      const r = state.config.captureRadius;
      const alive = state.myShips.filter((s) => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex((s) => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      // Defend threatened islands (ship 0 priority)
      const threatened = state.islands.filter(
        (i) => i.owner === 'me' && i.teamCapturing === 'enemy',
      );
      if (threatened.length > 0 && myRank === 0) {
        const t = nearestIsland(ship, threatened);
        if (t) return { type: 'move', target: { x: t.x, y: t.y } };
      }

      const uncaptured = islandsNotMine(state.islands);
      if (uncaptured.length === 0) {
        const contested = state.islands.filter((i) => i.teamCapturing === 'enemy');
        if (contested.length > 0) {
          const t = nearestIsland(ship, contested);
          if (t) return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      const scoredIslands = uncaptured.map((island) => {
        const guardingEnemies = state.enemyShips.filter(
          (e) => e.alive && distanceTo(e, island) < r * 2.5,
        ).length;
        const approachingEnemies = state.enemyShips.filter(
          (e) => e.alive && distanceTo(e, island) < r * 4,
        ).length;
        const enemyPresence = guardingEnemies * 2 + approachingEnemies;
        const dist = distanceTo(ship, island);
        const valueBonus = island.owner === 'enemy' ? 500 : 0;
        const opportunity = (1000 + valueBonus) / (enemyPresence + 0.5) - dist * 0.5;
        return { island, opportunity };
      });

      scoredIslands.sort((a, b) => b.opportunity - a.opportunity);

      const targetIdx = myRank % scoredIslands.length;
      const best = scoredIslands[targetIdx];
      if (!best) return { type: 'idle' };

      const enemiesOnTarget = state.enemyShips.filter(
        (e) => e.alive && distanceTo(e, best.island) < r,
      ).length;

      if (enemiesOnTarget > 0) {
        for (const alt of scoredIslands) {
          const altEnemies = state.enemyShips.filter(
            (e) => e.alive && distanceTo(e, alt.island) < r,
          ).length;
          if (altEnemies === 0) {
            return { type: 'move', target: { x: alt.island.x, y: alt.island.y } };
          }
        }
        return { type: 'move', target: { x: state.mapWidth / 2, y: state.mapHeight / 2 } };
      }

      return { type: 'move', target: { x: best.island.x, y: best.island.y } };
    },
  };
};

export default createBot;
