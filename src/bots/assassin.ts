// ============================================================
// 🏴‍☠️ Assassin Bot — picks off isolated enemies, avoids groups
// ============================================================
//
// Strategy:
//   The Assassin's entire focus is hunting isolated enemy ships.
//   It evaluates each enemy by their "isolation score" — how far
//   they are from other enemy ships. The most isolated target
//   becomes the current mark.
//
//   Ships operate in pairs:
//   - Pair A (ranks 0,1) — primary hunters
//   - Pair B (ranks 2,3) — secondary hunters / clean-up
//   - Ship (rank 4)     — opportunistic island capper
//
//   Hunting logic:
//   1. Find the most isolated alive enemy
//   2. 2+ ships converge on it (creating 2v1 kill)
//   3. If the target gets support, abort and re-target
//   4. Never chase a ship that's within a group of 2+ enemies
//
//   Retreat: if any hunter finds itself outnumbered (more enemies
//   than friendlies in attack radius), it immediately retreats to
//   its partner to regroup.
//
//   This bot teaches: isolation is the key vulnerability.
//   Group up or get picked off one by one.
// ============================================================

import type { BotFactory, BotShip, GameState, Command } from '@/engine/types';
import { distanceTo, nearestIsland, islandsNotMine, islandsOwnedBy } from '@/engine/helpers';

export const botCode = `
function createBot() {
  return {
    tick(state, ship) {
      if (!ship.alive) return { type: 'idle' };

      const r = state.config.attackRadius;
      const aliveEnemies = state.enemyShips.filter(e => e.alive);
      const alive = state.myShips.filter(s => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex(s => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      // ── CAPPER (rank 4) — grab islands while hunters work ──
      if (myRank === 4) {
        const unc = islandsNotMine(state.islands);
        if (unc.length > 0) {
          const t = unc.reduce((b, i) =>
            distanceTo(ship, i) < distanceTo(ship, b) ? i : b
          );
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // ── HUNTER LOGIC ──

      // Check if outnumbered locally — retreat to partner
      const nearFriends = state.myShips.filter(
        s => s.id !== ship.id && s.alive && distanceTo(ship, s) <= r
      ).length;
      const nearEnemies = aliveEnemies.filter(
        e => distanceTo(ship, e) <= r
      ).length;

      if (nearEnemies > nearFriends + 1) {
        // Retreat to partner
        const pairIdx = myRank <= 1 ? (myRank === 0 ? 1 : 0) : (myRank === 2 ? 3 : 2);
        const partner = alive[pairIdx];
        if (partner) {
          return { type: 'move', target: { x: partner.x, y: partner.y } };
        }
      }

      if (aliveEnemies.length === 0) {
        // Hunt complete — help capture
        const unc = islandsNotMine(state.islands);
        if (unc.length > 0) {
          const t = nearestIsland(ship, unc);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // Find most isolated enemy — lowest "nearby ally count"
      const target = aliveEnemies.reduce((best, e) => {
        // Count how many other enemies are within 2x attack radius of e
        const eFriends = aliveEnemies.filter(
          x => x.id !== e.id && distanceTo(x, e) <= r * 2
        ).length;
        const bFriends = aliveEnemies.filter(
          x => x.id !== best.id && distanceTo(x, best) <= r * 2
        ).length;

        // Prefer fewer friends (more isolated)
        if (eFriends < bFriends) return e;
        if (eFriends > bFriends) return best;
        // Tie: nearest
        return distanceTo(ship, e) < distanceTo(ship, best) ? e : best;
      });

      // Don't engage if target has 2+ allies nearby (skip to next)
      const targetAllies = aliveEnemies.filter(
        x => x.id !== target.id && distanceTo(x, target) <= r * 2
      ).length;

      if (targetAllies >= 2) {
        // Target is protected — camp nearest island instead
        const unc = islandsNotMine(state.islands);
        if (unc.length > 0) {
          const t = nearestIsland(ship, unc);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      return { type: 'move', target: { x: target.x, y: target.y } };
    },
  };
}
`;

export const createBot: BotFactory = () => {
  return {
    tick(state: GameState, ship: BotShip): Command {
      if (!ship.alive) return { type: 'idle' };

      const r = state.config.attackRadius;
      const aliveEnemies = state.enemyShips.filter((e) => e.alive);
      const alive = state.myShips.filter((s) => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex((s) => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      // Capper
      if (myRank === 4) {
        const unc = islandsNotMine(state.islands);
        if (unc.length > 0) {
          const t = unc.reduce((b, i) => (distanceTo(ship, i) < distanceTo(ship, b) ? i : b));
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // Retreat check
      const nearFriends = state.myShips.filter(
        (s) => s.id !== ship.id && s.alive && distanceTo(ship, s) <= r,
      ).length;
      const nearEnemies = aliveEnemies.filter((e) => distanceTo(ship, e) <= r).length;

      if (nearEnemies > nearFriends + 1) {
        const pairIdx = myRank <= 1 ? (myRank === 0 ? 1 : 0) : myRank === 2 ? 3 : 2;
        const partner = alive[pairIdx];
        if (partner) {
          return { type: 'move', target: { x: partner.x, y: partner.y } };
        }
      }

      if (aliveEnemies.length === 0) {
        const unc = islandsNotMine(state.islands);
        if (unc.length > 0) {
          const t = nearestIsland(ship, unc);
          if (t) return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // Find most isolated enemy
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

      const targetAllies = aliveEnemies.filter(
        (x) => x.id !== target.id && distanceTo(x, target) <= r * 2,
      ).length;

      if (targetAllies >= 2) {
        const unc = islandsNotMine(state.islands);
        if (unc.length > 0) {
          const t = nearestIsland(ship, unc);
          if (t) return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      return { type: 'move', target: { x: target.x, y: target.y } };
    },
  };
};

export default createBot;
