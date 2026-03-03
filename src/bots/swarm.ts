// ============================================================
// 🏴‍☠️ Swarm Bot — tight cluster overwhelms one target at a time
// ============================================================
//
// Strategy:
//   All 5 ships move together as a single unstoppable fist.
//   The swarm picks one target island and all ships converge
//   on it. Once captured, the entire fist moves to the next
//   island. No ship ever moves alone.
//
//   The swarm wins combat automatically — 5v1, 5v2, 5v3.
//   The only weakness is scoring: while moving between islands
//   there's a gap where the enemy can steal territory.
//
//   Target priority:
//   1. Enemy islands (stop their scoring NOW)
//   2. Contested islands (finish the capture)
//   3. Nearest neutral island
//
//   The entire swarm moves to the same point — the shared
//   target island's centre. This creates the 5-ship cluster.
// ============================================================

import type { BotFactory, BotShip, GameState, Command } from '@/engine/types';
import { distanceTo, nearestIsland, islandsOwnedBy, islandsNotMine } from '@/engine/helpers';

export const botCode = `
function createBot() {
  return {
    tick(state, ship) {
      if (!ship.alive) return { type: 'idle' };

      // All ships converge on the same priority target
      const enemies   = islandsOwnedBy(state.islands, 'enemy');
      const contested = state.islands.filter(
        i => i.owner === 'me' && i.teamCapturing === 'enemy'
      );
      const neutral   = islandsOwnedBy(state.islands, 'neutral');

      // Target selection: enemy > contested > neutral > mine (for patrol)
      let target = null;
      if (enemies.length > 0) {
        // Pick nearest enemy island to swarm centroid
        const cx = state.myShips.filter(s => s.alive).reduce((s, sh) => s + sh.x, 0) /
                   Math.max(1, state.myShips.filter(s => s.alive).length);
        const cy = state.myShips.filter(s => s.alive).reduce((s, sh) => s + sh.y, 0) /
                   Math.max(1, state.myShips.filter(s => s.alive).length);
        target = enemies.reduce((b, i) =>
          distanceTo({ x: cx, y: cy }, i) < distanceTo({ x: cx, y: cy }, b) ? i : b
        );
      } else if (contested.length > 0) {
        const cx = state.myShips.filter(s => s.alive).reduce((s, sh) => s + sh.x, 0) /
                   Math.max(1, state.myShips.filter(s => s.alive).length);
        const cy = state.myShips.filter(s => s.alive).reduce((s, sh) => s + sh.y, 0) /
                   Math.max(1, state.myShips.filter(s => s.alive).length);
        target = contested.reduce((b, i) =>
          distanceTo({ x: cx, y: cy }, i) < distanceTo({ x: cx, y: cy }, b) ? i : b
        );
      } else if (neutral.length > 0) {
        target = nearestIsland(ship, neutral);
      } else {
        // All islands are ours — hold them by staying near the most contested one
        const mine = islandsOwnedBy(state.islands, 'me');
        if (mine.length > 0) {
          target = nearestIsland(ship, mine);
        }
      }

      if (!target) return { type: 'idle' };
      return { type: 'move', target: { x: target.x, y: target.y } };
    },
  };
}
`;

export const createBot: BotFactory = () => {
  return {
    tick(state: GameState, ship: BotShip): Command {
      if (!ship.alive) return { type: 'idle' };

      const aliveShips = state.myShips.filter((s) => s.alive);
      const cx = aliveShips.reduce((s, sh) => s + sh.x, 0) / Math.max(1, aliveShips.length);
      const cy = aliveShips.reduce((s, sh) => s + sh.y, 0) / Math.max(1, aliveShips.length);
      const centroid = { x: cx, y: cy };

      const enemies = islandsOwnedBy(state.islands, 'enemy');
      const contested = state.islands.filter(
        (i) => i.owner === 'me' && i.teamCapturing === 'enemy',
      );
      const neutral = islandsOwnedBy(state.islands, 'neutral');

      let target: { x: number; y: number } | null = null;

      if (enemies.length > 0) {
        const t = enemies.reduce((b, i) =>
          distanceTo(centroid, i) < distanceTo(centroid, b) ? i : b,
        );
        target = { x: t.x, y: t.y };
      } else if (contested.length > 0) {
        const t = contested.reduce((b, i) =>
          distanceTo(centroid, i) < distanceTo(centroid, b) ? i : b,
        );
        target = { x: t.x, y: t.y };
      } else if (neutral.length > 0) {
        const t = nearestIsland(ship, neutral);
        if (t) target = { x: t.x, y: t.y };
      } else {
        const mine = islandsOwnedBy(state.islands, 'me');
        if (mine.length > 0) {
          const t = nearestIsland(ship, mine);
          if (t) target = { x: t.x, y: t.y };
        }
      }

      if (!target) return { type: 'idle' };
      return { type: 'move', target };
    },
  };
};

export default createBot;
