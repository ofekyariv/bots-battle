// ============================================================
// 🏴‍☠️ Flanker Bot — pincer attack from two directions
// ============================================================
//
// Strategy:
//   Ships are split into two wings (by alive rank):
//
//   LEFT WING (ranks 0, 1)  — attacks from above/left
//   RIGHT WING (ranks 2, 3) — attacks from below/right
//   ANCHOR (rank 4)         — captures nearest island opportunistically
//
//   Each wing navigates around the enemy by offsetting their
//   approach angle by ±90°. This forces the enemy to split
//   attention to two simultaneous threats.
//
//   If enemies clump together, the wings converge to join forces
//   (2v5 is bad — better to reunite). When spread out the wings
//   diverge again to pressure two flanks.
//
//   Combat: wings only engage when they have ≥ 2 ships together —
//   they avoid suiciding alone. If a wing loses a ship it retreats
//   to regroup before attacking again.
// ============================================================

import type { BotFactory, BotShip, GameState, Command } from '@/engine/types';
import {
  distanceTo,
  nearestIsland,
  islandsNotMine,
  islandsOwnedBy,
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

      const alive = state.myShips.filter(s => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex(s => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

      const r = state.config.attackRadius;
      const enemies = state.enemyShips.filter(e => e.alive);
      if (enemies.length === 0) {
        // Mop up — capture anything
        const unc = islandsNotMine(state.islands);
        if (unc.length > 0) {
          const t = nearestIsland(ship, unc);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // Centroid of all enemies
      const ex = enemies.reduce((s, e) => s + e.x, 0) / enemies.length;
      const ey = enemies.reduce((s, e) => s + e.y, 0) / enemies.length;
      const enemyCentroid = { x: ex, y: ey };

      // Map centre
      const cx = state.mapWidth / 2;
      const cy = state.mapHeight / 2;

      // Offset angle for each wing (±90° from the direct attack angle)
      const baseAngle = Math.atan2(ey - cy, ex - cx);
      const flankOffset = Math.PI / 2;

      // Anchor: capture nearest uncaptured island
      if (myRank === 4) {
        const unc = islandsNotMine(state.islands);
        if (unc.length > 0) {
          const t = nearestIsland(ship, unc);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      // Determine wing
      const isLeftWing = myRank <= 1;
      const wingAngle = baseAngle + (isLeftWing ? flankOffset : -flankOffset);
      const wingPartner = isLeftWing ? alive[1 - myRank] : alive[5 - myRank];

      // Are enemies clumped or spread?
      const spreadRadius = r * 3;
      const clumped = enemies.filter(e => distanceTo(e, enemyCentroid) < spreadRadius).length >= enemies.length * 0.7;

      if (clumped) {
        // Converge — wings join together to fight as a group
        const teammates = alive.filter(s => s.id !== ship.id);
        const tx = teammates.reduce((s, t) => s + t.x, 0) / teammates.length;
        const ty = teammates.reduce((s, t) => s + t.y, 0) / teammates.length;
        const midX = (tx + ex) / 2;
        const midY = (ty + ey) / 2;
        return { type: 'move', target: { x: midX, y: midY } };
      }

      // Wing is outnumbered locally — retreat to partner
      const nearFriends = state.myShips.filter(s => s.id !== ship.id && s.alive && distanceTo(ship, s) <= r).length;
      const nearEnemies = state.enemyShips.filter(e => e.alive && distanceTo(ship, e) <= r).length;
      if (nearEnemies > nearFriends + 1 && wingPartner) {
        return { type: 'move', target: { x: wingPartner.x, y: wingPartner.y } };
      }

      // Flanking approach — aim at enemy centroid from wing angle
      const flankDist = 200;
      const approachX = ex + Math.cos(wingAngle + Math.PI) * flankDist;
      const approachY = ey + Math.sin(wingAngle + Math.PI) * flankDist;

      // If we're already close enough, charge
      if (distanceTo(ship, enemyCentroid) < flankDist * 1.5) {
        return { type: 'move', target: { x: ex, y: ey } };
      }

      return { type: 'move', target: { x: approachX, y: approachY } };
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

      const r = state.config.attackRadius;
      const enemies = state.enemyShips.filter((e) => e.alive);
      if (enemies.length === 0) {
        const unc = islandsNotMine(state.islands);
        if (unc.length > 0) {
          const t = nearestIsland(ship, unc);
          if (t) return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      const ex = enemies.reduce((s, e) => s + e.x, 0) / enemies.length;
      const ey = enemies.reduce((s, e) => s + e.y, 0) / enemies.length;
      const enemyCentroid = { x: ex, y: ey };

      const baseAngle = Math.atan2(ey - state.mapHeight / 2, ex - state.mapWidth / 2);
      const flankOffset = Math.PI / 2;

      // Anchor
      if (myRank === 4) {
        const unc = islandsNotMine(state.islands);
        if (unc.length > 0) {
          const t = nearestIsland(ship, unc);
          if (t) return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      const isLeftWing = myRank <= 1;
      const wingAngle = baseAngle + (isLeftWing ? flankOffset : -flankOffset);
      const wingPartnerIdx = isLeftWing ? 1 - myRank : 5 - myRank;
      const wingPartner = alive[wingPartnerIdx];

      const spreadRadius = r * 3;
      const clumped =
        enemies.filter((e) => distanceTo(e, enemyCentroid) < spreadRadius).length >=
        enemies.length * 0.7;

      if (clumped) {
        const teammates = alive.filter((s) => s.id !== ship.id);
        const tx = teammates.reduce((s, t) => s + t.x, 0) / teammates.length;
        const ty = teammates.reduce((s, t) => s + t.y, 0) / teammates.length;
        return { type: 'move', target: { x: (tx + ex) / 2, y: (ty + ey) / 2 } };
      }

      const nearFriends = state.myShips.filter(
        (s) => s.id !== ship.id && s.alive && distanceTo(ship, s) <= r,
      ).length;
      const nearEnemies = state.enemyShips.filter(
        (e) => e.alive && distanceTo(ship, e) <= r,
      ).length;
      if (nearEnemies > nearFriends + 1 && wingPartner) {
        return { type: 'move', target: { x: wingPartner.x, y: wingPartner.y } };
      }

      const flankDist = 200;
      const approachX = ex + Math.cos(wingAngle + Math.PI) * flankDist;
      const approachY = ey + Math.sin(wingAngle + Math.PI) * flankDist;

      if (distanceTo(ship, enemyCentroid) < flankDist * 1.5) {
        return { type: 'move', target: { x: ex, y: ey } };
      }

      return { type: 'move', target: { x: approachX, y: approachY } };
    },
  };
};

export default createBot;
