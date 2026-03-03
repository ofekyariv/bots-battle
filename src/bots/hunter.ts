// ============================================================
// 🏴‍☠️ Hunter Bot — kill squad of 3 + 2 island capturers
// ============================================================
//
// Strategy:
//   Ships are divided into two roles based on alive-ship rank:
//
//   KILL SQUAD (ranks 0, 1, 2)
//   • Stay within attackRadius of each other at all times.
//   • Move as a pack toward the nearest enemy cluster.
//   • A 3v1 or 3v2 always wins — this is their whole identity.
//   • Formation logic: if any hunter drifts too far, it regroupsTo
//     the squad centroid before advancing.
//   • When no enemies alive: help capturers take islands.
//
//   CAPTURERS (ranks 3, 4)
//   • Each targets a different uncaptured island (greedy spread).
//   • Avoid lone fights — retreat toward the kill squad if cornered.
//   • While kill squad is hunting, capturers take easy islands
//     since the enemy is busy running from 3 hunters.
//
// Key insight: the kill squad creates a "death zone" that forces
// enemies to either fight 3v1 (and die) or flee (letting capturers
// take islands uncontested). The scoring pressure from capturing
// then forces enemies to come fight — on the hunters' terms.
//
// Note: ships near islands (isCapturing=true) fight normally —
// all alive enemies count as threats regardless of capture status.
// ============================================================

import type { BotFactory, BotShip, GameState, Command } from '@/engine/types';
import {
  distanceTo,
  nearestIsland,
  islandsNotMine,
  nearestEnemy,
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

      const alive = state.myShips
        .filter(s => s.alive)
        .sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex(s => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      const isHunter = myRank <= 2;
      const attackRadius = state.config.attackRadius;

      // ── CAPTURER LOGIC ──
      if (!isHunter) {
        const capturerRank = myRank - 3; // 0 or 1
        const uncaptured = islandsNotMine(state.islands);

        if (uncaptured.length === 0) return { type: 'idle' };

        // All alive enemies are threats — isCapturing doesn't reduce danger
        const nearbyEnemies = shipsNear(ship, state.enemyShips, attackRadius * 1.5);
        const nearbyFriends = alive
          .filter(s => s.id !== ship.id && distanceTo(ship, s) <= attackRadius)
          .length;

        if (nearbyEnemies.length > nearbyFriends) {
          // Danger: retreat toward kill squad centroid
          const hunters = alive.slice(0, Math.min(3, alive.length));
          const hx = hunters.reduce((s, h) => s + h.x, 0) / hunters.length;
          const hy = hunters.reduce((s, h) => s + h.y, 0) / hunters.length;
          return { type: 'move', target: { x: hx, y: hy } };
        }

        // Each capturer takes a different island (spread by rank)
        const sorted = [...uncaptured].sort((a, b) => {
          const aPrio = (a.owner === 'enemy' ? -5000 : 0) + distanceTo(ship, a);
          const bPrio = (b.owner === 'enemy' ? -5000 : 0) + distanceTo(ship, b);
          return aPrio - bPrio;
        });
        const targetIdx = capturerRank % sorted.length;
        const t = sorted[targetIdx];
        return { type: 'move', target: { x: t.x, y: t.y } };
      }

      // ── KILL SQUAD LOGIC ──
      const hunters = alive.slice(0, Math.min(3, alive.length));
      const numHunters = hunters.length;

      // Formation centroid
      const hx = hunters.reduce((s, h) => s + h.x, 0) / numHunters;
      const hy = hunters.reduce((s, h) => s + h.y, 0) / numHunters;

      // All alive enemies are valid targets — no isCapturing exclusion
      const targets = state.enemyShips.filter(e => e.alive);

      if (targets.length === 0) {
        // All enemies dead — help capturers
        const uncaptured = islandsNotMine(state.islands);
        if (uncaptured.length > 0) {
          const t = nearestIsland(ship, uncaptured);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // Target: nearest enemy cluster to squad centroid
      const target = targets.reduce((best, e) => {
        const distFromCenter = distanceTo({ x: hx, y: hy }, e);
        const distFromBest   = distanceTo({ x: hx, y: hy }, best);
        return distFromCenter < distFromBest ? e : best;
      });

      // Formation check: if this hunter is too far from centroid, regroup
      const myDistFromCenter = distanceTo(ship, { x: hx, y: hy });

      // Allow spread proportional to squad size — solo hunter regroups tighter
      const maxSpread = attackRadius * (numHunters === 3 ? 0.85 : 0.5);

      if (numHunters < 3 && myDistFromCenter > maxSpread) {
        // Not at full squad — wait for companions to regroup
        return { type: 'move', target: { x: hx, y: hy } };
      }

      if (myDistFromCenter > attackRadius * 1.1) {
        // Too spread out — regroup before advancing
        return { type: 'move', target: { x: hx, y: hy } };
      }

      // In formation — charge the target
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

      const alive = state.myShips.filter((s) => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex((s) => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      const isHunter = myRank <= 2;
      const attackRadius = state.config.attackRadius;

      // ── CAPTURER ──
      if (!isHunter) {
        const capturerRank = myRank - 3;
        const uncaptured = islandsNotMine(state.islands);
        if (uncaptured.length === 0) return { type: 'idle' };

        // All alive enemies are threats — no isCapturing exclusion
        const nearbyEnemies = shipsNear(ship, state.enemyShips, attackRadius * 1.5);
        const nearbyFriends = alive.filter(
          (s) => s.id !== ship.id && distanceTo(ship, s) <= attackRadius,
        ).length;

        if (nearbyEnemies.length > nearbyFriends) {
          const hunters = alive.slice(0, Math.min(3, alive.length));
          const hx = hunters.reduce((s, h) => s + h.x, 0) / hunters.length;
          const hy = hunters.reduce((s, h) => s + h.y, 0) / hunters.length;
          return { type: 'move', target: { x: hx, y: hy } };
        }

        const sorted = [...uncaptured].sort((a, b) => {
          const aPrio = (a.owner === 'enemy' ? -5000 : 0) + distanceTo(ship, a);
          const bPrio = (b.owner === 'enemy' ? -5000 : 0) + distanceTo(ship, b);
          return aPrio - bPrio;
        });
        const targetIdx = capturerRank % sorted.length;
        const t = sorted[targetIdx];
        return { type: 'move', target: { x: t.x, y: t.y } };
      }

      // ── KILL SQUAD ──
      const hunters = alive.slice(0, Math.min(3, alive.length));
      const numHunters = hunters.length;

      const hx = hunters.reduce((s, h) => s + h.x, 0) / numHunters;
      const hy = hunters.reduce((s, h) => s + h.y, 0) / numHunters;

      // All alive enemies are valid targets
      const targets = state.enemyShips.filter((e) => e.alive);

      if (targets.length === 0) {
        const uncaptured = islandsNotMine(state.islands);
        if (uncaptured.length > 0) {
          const t = nearestIsland(ship, uncaptured);
          if (t) return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      const target = targets.reduce((best, e) => {
        const distFromCenter = distanceTo({ x: hx, y: hy }, e);
        const distFromBest = distanceTo({ x: hx, y: hy }, best);
        return distFromCenter < distFromBest ? e : best;
      });

      const myDistFromCenter = distanceTo(ship, { x: hx, y: hy });
      const maxSpread = attackRadius * (numHunters === 3 ? 0.85 : 0.5);

      if (numHunters < 3 && myDistFromCenter > maxSpread) {
        return { type: 'move', target: { x: hx, y: hy } };
      }
      if (myDistFromCenter > attackRadius * 1.1) {
        return { type: 'move', target: { x: hx, y: hy } };
      }

      return { type: 'move', target: { x: target.x, y: target.y } };
    },
  };
};

export default createBot;
