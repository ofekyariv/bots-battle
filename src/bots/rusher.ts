// ============================================================
// 🏴‍☠️ Rusher Bot — rush every uncaptured island, spread fast
// ============================================================
//
// Strategy:
//   1. Sort alive ships by ID for stable rank assignment.
//   2. Each ship "claims" the best uncaptured island not yet taken
//      by a higher-ranked ship (greedy spreading).
//   3. Enemy-owned islands get a massive priority boost — stop
//      their exponential scoring as fast as possible.
//   4. When all islands are captured, defend any being contested.
//
// Combat: Rusher doesn't fight intentionally — it just moves fast.
// Incidental kills happen when ships collide en-route to islands.
// ============================================================

import type { BotFactory, BotShip, GameState, Command } from '@/engine/types';
import {
  distanceTo,
  nearestIsland,
  islandsOwnedBy,
  islandsNotMine,
  shipsNear,
} from '@/engine/helpers';

// ─────────────────────────────────────────────
// Code string — eval'd in the sandbox
// ─────────────────────────────────────────────

export const botCode = `
function createBot() {
  return {
    tick(state, ship) {
      if (!ship.alive) return { type: 'idle' };

      const enemies   = islandsOwnedBy(state.islands, 'enemy');
      const neutral   = islandsOwnedBy(state.islands, 'neutral');
      const uncaptured = [...enemies, ...neutral];

      // ── All islands mine: defend contested ones ──
      if (uncaptured.length === 0) {
        const contested = state.islands.filter(
          i => i.owner === 'me' && i.teamCapturing === 'enemy'
        );
        if (contested.length > 0) {
          const t = nearestIsland(ship, contested);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        // Stay near nearest island as insurance
        const mine = islandsOwnedBy(state.islands, 'me');
        if (mine.length > 0) {
          const t = nearestIsland(ship, mine);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // ── Greedy spread: claim best uncaptured island ──
      // Higher-ranked ships (by ID order) claim first; this ship picks
      // from whatever's left. Prevents all ships bunching on one island.
      const alive = state.myShips
        .filter(s => s.alive)
        .sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex(s => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      // Score function: enemy islands cost ~5000 less (higher priority)
      // so rushers attack scoring islands before neutrals
      const score = (island, fromShip) =>
        distanceTo(fromShip, island) - (island.owner === 'enemy' ? 5000 : 0);

      const claimed = new Set();
      for (let r = 0; r < myRank; r++) {
        const other = alive[r];
        const available = uncaptured.filter(i => !claimed.has(i.id));
        if (available.length === 0) break;
        const best = available.reduce((b, i) =>
          score(i, other) < score(b, other) ? i : b
        );
        claimed.add(best.id);
      }

      const remaining = uncaptured.filter(i => !claimed.has(i.id));
      const pool = remaining.length > 0 ? remaining : uncaptured;

      const target = pool.reduce((b, i) =>
        score(i, ship) < score(b, ship) ? i : b
      );

      return { type: 'move', target: { x: target.x, y: target.y } };
    },
  };
}
`;

// ─────────────────────────────────────────────
// Factory function — direct TypeScript import
// ─────────────────────────────────────────────

export const createBot: BotFactory = () => {
  return {
    tick(state: GameState, ship: BotShip): Command {
      if (!ship.alive) return { type: 'idle' };

      const enemies = islandsOwnedBy(state.islands, 'enemy');
      const neutral = islandsOwnedBy(state.islands, 'neutral');
      const uncaptured = [...enemies, ...neutral];

      // ── All islands mine: defend contested ones ──
      if (uncaptured.length === 0) {
        const contested = state.islands.filter(
          (i) => i.owner === 'me' && i.teamCapturing === 'enemy',
        );
        if (contested.length > 0) {
          const t = nearestIsland(ship, contested)!;
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        const mine = islandsOwnedBy(state.islands, 'me');
        if (mine.length > 0) {
          const t = nearestIsland(ship, mine)!;
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // ── Greedy spread ──
      const alive = state.myShips.filter((s) => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex((s) => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      const score = (island: { x: number; y: number; owner: string }, fromShip: BotShip) =>
        distanceTo(fromShip, island) - (island.owner === 'enemy' ? 5000 : 0);

      const claimed = new Set<number>();
      for (let r = 0; r < myRank; r++) {
        const other = alive[r];
        const available = uncaptured.filter((i) => !claimed.has(i.id));
        if (available.length === 0) break;
        const best = available.reduce((b, i) => (score(i, other) < score(b, other) ? i : b));
        claimed.add(best.id);
      }

      const remaining = uncaptured.filter((i) => !claimed.has(i.id));
      const pool = remaining.length > 0 ? remaining : uncaptured;
      const target = pool.reduce((b, i) => (score(i, ship) < score(b, ship) ? i : b));

      return { type: 'move', target: { x: target.x, y: target.y } };
    },
  };
};

export default createBot;
