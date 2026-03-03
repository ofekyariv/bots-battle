// ============================================================
// 🏴‍☠️ Defender Bot — hold 3 home islands with paired patrols
// ============================================================
//
// Strategy:
//   1. On first tick, pick the 3 islands closest to our spawn as
//      "home islands" (3 islands = 4 pts/tick exponential bonus).
//   2. Assign ships in pairs: ranks [0,1] → island A,
//      ranks [2,3] → island B, rank [4] → island C.
//   3. Each pair patrols between their island and the midpoint to
//      the next island — maintaining a defensive tripwire.
//   4. When an enemy gets close to ANY home island, that island's
//      pair converges immediately. The lone ship (rank 4) acts as
//      a rapid-response unit and helps wherever it's needed most.
//   5. If a home island falls to the enemy, the assigned pair
//      aggressively retakes it as a group.
//
// Key insight: 2 ships defending = any lone attacker is 2v1 dead.
// The patrol keeps ships in support range of each other (combat
// radius), so an attacker can never isolate one defender.
// ============================================================

import type { BotFactory, BotShip, GameState, Command } from '@/engine/types';
import { distanceTo, nearestIsland, islandsOwnedBy, shipsNear } from '@/engine/helpers';

// ─────────────────────────────────────────────
// Code string — eval'd in the sandbox
// ─────────────────────────────────────────────

export const botCode = `
function createBot() {
  let homeIds = null; // [islandIdA, islandIdB, islandIdC]

  return {
    tick(state, ship) {
      if (!ship.alive) return { type: 'idle' };

      // ── One-time init: pick 3 nearest islands as home bases ──
      if (!homeIds) {
        const sorted = [...state.islands].sort((a, b) =>
          distanceTo({ x: ship.initialX, y: ship.initialY }, a) -
          distanceTo({ x: ship.initialX, y: ship.initialY }, b)
        );
        homeIds = sorted.slice(0, 3).map(i => i.id);
      }

      const homes = homeIds
        .map(id => state.islands.find(i => i.id === id))
        .filter(Boolean);

      if (homes.length === 0) return { type: 'idle' };

      // ── Ship role assignment ──
      const alive = state.myShips
        .filter(s => s.alive)
        .sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex(s => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      // Ranks 0,1 → home 0 | Ranks 2,3 → home 1 | Rank 4 → home 2
      const islandIdx = Math.min(Math.floor(myRank / 2), homes.length - 1);
      const assigned = homes[islandIdx];

      // ── Rapid-response floater (rank 4) ──
      // Find the most threatened home island and rush there
      if (myRank === 4) {
        const threatened = homes.find(h =>
          shipsNear(h, state.enemyShips, h.radius * 2).length > 0 ||
          h.owner === 'enemy' ||
          h.teamCapturing === 'enemy'
        );
        if (threatened) {
          return { type: 'move', target: { x: threatened.x, y: threatened.y } };
        }
        // No threats: patrol toward any uncaptured home island
        const uncapturedHome = homes.find(h => h.owner !== 'me');
        if (uncapturedHome) {
          return { type: 'move', target: { x: uncapturedHome.x, y: uncapturedHome.y } };
        }
        // Guard nearest home island
        return { type: 'move', target: { x: assigned.x, y: assigned.y } };
      }

      // ── Pair logic (ranks 0–3) ──

      // Enemy approaching or contesting our island → converge NOW
      const enemyNear = shipsNear(assigned, state.enemyShips, assigned.radius * 2.5);
      if (enemyNear.length > 0 || assigned.owner === 'enemy' || assigned.teamCapturing === 'enemy') {
        return { type: 'move', target: { x: assigned.x, y: assigned.y } };
      }

      // Island not yet ours → capture it
      if (assigned.owner !== 'me') {
        return { type: 'move', target: { x: assigned.x, y: assigned.y } };
      }

      // Island is ours and secure → patrol to adjacent home island midpoint
      // This keeps the pair in each other's attack-radius support range
      const attackRadius = state.config.attackRadius;
      const nextIdx = (islandIdx + 1) % homes.length;
      const next = homes[nextIdx];
      const patrolDist = distanceTo(assigned, next);
      const maxDrift = Math.min(attackRadius * 0.9, patrolDist * 0.45);

      // Patrol offset: rank-0 of the pair drifts slightly forward,
      // rank-1 stays back — they remain within support radius
      const pairMember = myRank % 2; // 0 = lead, 1 = trail
      if (pairMember === 0) {
        // Lead: drift toward next island, but don't go more than maxDrift
        const angle = Math.atan2(next.y - assigned.y, next.x - assigned.x);
        return {
          type: 'move',
          target: {
            x: assigned.x + Math.cos(angle) * maxDrift,
            y: assigned.y + Math.sin(angle) * maxDrift,
          },
        };
      } else {
        // Trail: stay at the assigned island center
        return { type: 'move', target: { x: assigned.x, y: assigned.y } };
      }
    },
  };
}
`;

// ─────────────────────────────────────────────
// Factory function — direct TypeScript import
// ─────────────────────────────────────────────

export const createBot: BotFactory = () => {
  let homeIds: number[] | null = null;

  return {
    tick(state: GameState, ship: BotShip): Command {
      if (!ship.alive) return { type: 'idle' };

      if (!homeIds) {
        const sorted = [...state.islands].sort(
          (a, b) =>
            distanceTo({ x: ship.initialX, y: ship.initialY }, a) -
            distanceTo({ x: ship.initialX, y: ship.initialY }, b),
        );
        homeIds = sorted.slice(0, 3).map((i) => i.id);
      }

      const homes = homeIds
        .map((id) => state.islands.find((i) => i.id === id))
        .filter((i): i is NonNullable<typeof i> => i != null);

      if (homes.length === 0) return { type: 'idle' };

      const alive = state.myShips.filter((s) => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex((s) => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      const islandIdx = Math.min(Math.floor(myRank / 2), homes.length - 1);
      const assigned = homes[islandIdx];

      // Rapid-response floater
      if (myRank === 4) {
        const threatened = homes.find(
          (h) =>
            shipsNear(h, state.enemyShips, h.radius * 2).length > 0 ||
            h.owner === 'enemy' ||
            h.teamCapturing === 'enemy',
        );
        if (threatened) {
          return { type: 'move', target: { x: threatened.x, y: threatened.y } };
        }
        const uncapturedHome = homes.find((h) => h.owner !== 'me');
        if (uncapturedHome) {
          return { type: 'move', target: { x: uncapturedHome.x, y: uncapturedHome.y } };
        }
        return { type: 'move', target: { x: assigned.x, y: assigned.y } };
      }

      // Pair logic
      const enemyNear = shipsNear(assigned, state.enemyShips, assigned.radius * 2.5);
      if (
        enemyNear.length > 0 ||
        assigned.owner === 'enemy' ||
        assigned.teamCapturing === 'enemy'
      ) {
        return { type: 'move', target: { x: assigned.x, y: assigned.y } };
      }

      if (assigned.owner !== 'me') {
        return { type: 'move', target: { x: assigned.x, y: assigned.y } };
      }

      const attackRadius = state.config.attackRadius;
      const nextIdx = (islandIdx + 1) % homes.length;
      const next = homes[nextIdx];
      const patrolDist = distanceTo(assigned, next);
      const maxDrift = Math.min(attackRadius * 0.9, patrolDist * 0.45);

      const pairMember = myRank % 2;
      if (pairMember === 0) {
        const angle = Math.atan2(next.y - assigned.y, next.x - assigned.x);
        return {
          type: 'move',
          target: {
            x: assigned.x + Math.cos(angle) * maxDrift,
            y: assigned.y + Math.sin(angle) * maxDrift,
          },
        };
      } else {
        return { type: 'move', target: { x: assigned.x, y: assigned.y } };
      }
    },
  };
};

export default createBot;
