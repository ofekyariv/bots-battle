// ============================================================
// 🏴‍☠️ Fortress Bot — capture 2 central islands, hold forever
// ============================================================
//
// Strategy:
//   The Fortress picks the 2 most central islands (closest to
//   the map centre) as its "keeps" and commits everything to
//   holding them. 2 ships defend each keep in a pair — any
//   enemy that tries to take one fights a 2v1.
//
//   The 5th ship is the raider: it grabs a nearby easy island
//   for bonus points, but retreats to the nearest keep if
//   threatened.
//
//   Keep defense logic:
//   - Normal: ships orbit the island in a tight radius (patrol)
//   - Contested: both ships of the pair converge on the island
//   - Recapture: if keep is lost, the pair re-takes it
//
//   The Fortress doesn't chase enemies — it makes its keeps
//   fortresses that are too costly to take. The enemy must
//   bring overwhelming force to crack them, leaving other
//   islands exposed for the raider.
//
//   Weakness: can only hold 2-3 islands max. A fast expansion
//   opponent that grabs 5+ islands will outscore it.
// ============================================================

import type { BotFactory, BotShip, GameState, Command } from '@/engine/types';
import { distanceTo, nearestIsland, islandsOwnedBy, islandsNotMine } from '@/engine/helpers';

export const botCode = `
function createBot() {
  let keeps = null; // [islandId, islandId] — the 2 keeps

  function pickKeeps(islands, mapWidth, mapHeight) {
    const cx = mapWidth / 2;
    const cy = mapHeight / 2;
    const sorted = [...islands].sort((a, b) =>
      distanceTo(a, { x: cx, y: cy }) - distanceTo(b, { x: cx, y: cy })
    );
    return [sorted[0].id, sorted[1] ? sorted[1].id : sorted[0].id];
  }

  return {
    tick(state, ship) {
      if (!ship.alive) return { type: 'idle' };

      // Pick keeps once on first tick
      if (!keeps) {
        keeps = pickKeeps(state.islands, state.mapWidth, state.mapHeight);
      }

      const keepIslands = state.islands.filter(i => keeps.includes(i.id));
      const alive = state.myShips.filter(s => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex(s => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      // Role: raider (rank 4) grabs opportunistic islands
      if (myRank === 4) {
        const r = state.config.attackRadius;
        const nearbyEnemies = state.enemyShips.filter(
          e => e.alive && distanceTo(ship, e) < r * 3
        ).length;

        if (nearbyEnemies > 1) {
          // Retreat to nearest keep
          if (keepIslands.length > 0) {
            const t = nearestIsland(ship, keepIslands);
            return { type: 'move', target: { x: t.x, y: t.y } };
          }
          return { type: 'idle' };
        }

        // Grab nearest non-keep uncaptured island
        const other = islandsNotMine(state.islands).filter(i => !keeps.includes(i.id));
        if (other.length > 0) {
          const t = nearestIsland(ship, other);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        // Fallback: help defend nearest contested keep
        const contested = keepIslands.filter(i => i.teamCapturing === 'enemy');
        if (contested.length > 0) {
          const t = nearestIsland(ship, contested);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // Keep assignment: ranks 0,1 → keep[0]; ranks 2,3 → keep[1]
      const keepIdx = myRank <= 1 ? 0 : 1;
      const keepId = keeps[keepIdx];
      const keep = state.islands.find(i => i.id === keepId) || keepIslands[0];

      if (!keep) return { type: 'idle' };

      // If keep is not ours, go recapture it
      if (keep.owner !== 'me') {
        return { type: 'move', target: { x: keep.x, y: keep.y } };
      }

      // If keep is being contested, converge on it
      if (keep.teamCapturing === 'enemy') {
        return { type: 'move', target: { x: keep.x, y: keep.y } };
      }

      // Patrol: orbit the keep in a tight circle
      const orbitRadius = keep.radius * 0.7;
      const partnerRank = myRank <= 1 ? (myRank === 0 ? 1 : 0) : (myRank === 2 ? 3 : 2);
      const partner = alive[partnerRank];

      // Position offset to separate the pair (don't stack on same pixel)
      const orbitAngle = (myRank % 2 === 0 ? 0 : Math.PI) + (state.tick * 0.02);
      const patrolX = keep.x + Math.cos(orbitAngle) * orbitRadius;
      const patrolY = keep.y + Math.sin(orbitAngle) * orbitRadius;

      return { type: 'move', target: { x: patrolX, y: patrolY } };
    },
  };
}
`;

export const createBot: BotFactory = () => {
  let keeps: [number, number] | null = null;

  function pickKeeps(
    islands: { id: number; x: number; y: number }[],
    mapWidth: number,
    mapHeight: number,
  ): [number, number] {
    const cx = mapWidth / 2;
    const cy = mapHeight / 2;
    const sorted = [...islands].sort(
      (a, b) => distanceTo(a, { x: cx, y: cy }) - distanceTo(b, { x: cx, y: cy }),
    );
    return [sorted[0].id, sorted[1]?.id ?? sorted[0].id];
  }

  return {
    tick(state: GameState, ship: BotShip): Command {
      if (!ship.alive) return { type: 'idle' };

      if (!keeps) {
        keeps = pickKeeps(state.islands, state.mapWidth, state.mapHeight);
      }

      const keepIslands = state.islands.filter((i) => keeps!.includes(i.id));
      const alive = state.myShips.filter((s) => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex((s) => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      // Raider
      if (myRank === 4) {
        const r = state.config.attackRadius;
        const nearbyEnemies = state.enemyShips.filter(
          (e) => e.alive && distanceTo(ship, e) < r * 3,
        ).length;

        if (nearbyEnemies > 1) {
          if (keepIslands.length > 0) {
            const t = nearestIsland(ship, keepIslands);
            if (t) return { type: 'move', target: { x: t.x, y: t.y } };
          }
          return { type: 'idle' };
        }

        const other = islandsNotMine(state.islands).filter((i) => !keeps!.includes(i.id));
        if (other.length > 0) {
          const t = nearestIsland(ship, other);
          if (t) return { type: 'move', target: { x: t.x, y: t.y } };
        }
        const contested = keepIslands.filter((i) => i.teamCapturing === 'enemy');
        if (contested.length > 0) {
          const t = nearestIsland(ship, contested);
          if (t) return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      const keepIdx = myRank <= 1 ? 0 : 1;
      const keepId = keeps[keepIdx];
      const keep = state.islands.find((i) => i.id === keepId) ?? keepIslands[0];
      if (!keep) return { type: 'idle' };

      if (keep.owner !== 'me') {
        return { type: 'move', target: { x: keep.x, y: keep.y } };
      }
      if (keep.teamCapturing === 'enemy') {
        return { type: 'move', target: { x: keep.x, y: keep.y } };
      }

      // Patrol orbit
      const orbitRadius = keep.radius * 0.7;
      const orbitAngle = (myRank % 2 === 0 ? 0 : Math.PI) + state.tick * 0.02;
      const patrolX = keep.x + Math.cos(orbitAngle) * orbitRadius;
      const patrolY = keep.y + Math.sin(orbitAngle) * orbitRadius;
      return { type: 'move', target: { x: patrolX, y: patrolY } };
    },
  };
};

export default createBot;
