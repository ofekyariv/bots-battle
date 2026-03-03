// ============================================================
// 🏴‍☠️ Balanced Bot — adaptive strategy based on threat & score
// ============================================================
//
// The Balanced bot continuously evaluates each ship's situation
// and picks from four modes:
//
//   RETREAT  — outnumbered locally (enemies > friends in radius)
//              → move toward nearest friendly ship to regroup
//
//   ASSAULT  — we outnumber locally AND an enemy is close
//              → press the attack, kill the outnumbered ship
//
//   CAPTURE  — no immediate combat threat
//              → rush best uncaptured island (value + proximity)
//
//   DEFEND   — one of our islands is being neutralized
//              → highest-priority ship breaks off to defend it
//
// Score awareness (from exponential scoring):
//   • If behind: raise aggression — start fighting even at 2v2
//     to create openings for capturers
//   • If ahead by a lot: play cautious, don't take 1v1 duels,
//     just capture and defend
//
// This bot has per-ship state tracking so it remembers its current
// mode for a few ticks to avoid rapid mode-switching jitter.
//
// Note: ships near islands (isCapturing=true) fight normally —
// isCapturing is a position flag only, not a combat exclusion.
// ============================================================

import type { BotFactory, BotShip, GameState, Command } from '@/engine/types';
import {
  distanceTo,
  nearestIsland,
  islandsOwnedBy,
  islandsNotMine,
  shipsNear,
  scoreRate,
} from '@/engine/helpers';

// ─────────────────────────────────────────────
// Code string — eval'd in the sandbox
// ─────────────────────────────────────────────

export const botCode = `
function createBot() {
  const shipMode = {};      // ship.id → 'capture' | 'retreat' | 'assault' | 'defend'
  const modeTimer = {};     // ship.id → tick when mode was set (hysteresis)
  const MODE_HOLD = 8;      // ticks to hold a mode before re-evaluating

  function evalMode(state, ship) {
    const r = state.config.attackRadius;
    const tick = state.tick;

    // Count ships in radius — all alive ships fight regardless of isCapturing
    const nearFriends = state.myShips.filter(
      s => s.id !== ship.id && s.alive && distanceTo(ship, s) <= r
    ).length;
    const nearEnemies = state.enemyShips.filter(
      s => s.alive && distanceTo(ship, s) <= r
    ).length;

    // Score delta: positive means we're ahead
    const scoreDelta = state.myScore - state.enemyScore;
    const isAhead = scoreDelta > 100;
    const isBehind = scoreDelta < -100;

    // Adjust thresholds based on score pressure
    // If behind, we tolerate 1v1 fights (risky but necessary)
    const fightThreshold = isBehind ? 0 : 1; // need friendlies >= this to fight

    if (nearEnemies > nearFriends + 1) {
      return 'retreat'; // strictly outnumbered, always retreat
    }

    if (nearEnemies > 0 && nearFriends >= fightThreshold) {
      // We have enough support to fight — go aggressive
      return 'assault';
    }

    // Check if any of our islands needs defending (enemy neutralizing)
    const threatened = state.islands.filter(
      i => i.owner === 'me' && i.teamCapturing === 'enemy'
    );
    if (threatened.length > 0) {
      const nearest = threatened.reduce((b, i) =>
        distanceTo(ship, i) < distanceTo(ship, b) ? i : b
      );
      // Only send if we're the closest free ship to the threat
      const freeTeam = state.myShips.filter(s =>
        s.id !== ship.id && s.alive
      );
      const closerFriend = freeTeam.find(s =>
        distanceTo(s, nearest) < distanceTo(ship, nearest)
      );
      if (!closerFriend) {
        return 'defend';
      }
    }

    return 'capture';
  }

  return {
    tick(state, ship) {
      if (!ship.alive) {
        delete shipMode[ship.id];
        delete modeTimer[ship.id];
        return { type: 'idle' };
      }

      const tick = state.tick;
      const r = state.config.attackRadius;

      // Re-evaluate mode (with hysteresis to prevent jitter)
      const heldFor = tick - (modeTimer[ship.id] ?? -999);
      const forceReeval = heldFor >= MODE_HOLD;
      const newMode = evalMode(state, ship);

      // Always update on mode change or after hold period
      if (!shipMode[ship.id] || forceReeval || newMode === 'retreat') {
        shipMode[ship.id] = newMode;
        modeTimer[ship.id] = tick;
      }

      const mode = shipMode[ship.id];

      // ── RETREAT: regroup with nearest friendly ──
      if (mode === 'retreat') {
        const friends = state.myShips.filter(s => s.id !== ship.id && s.alive);
        if (friends.length > 0) {
          const nearest = friends.reduce((b, f) =>
            distanceTo(ship, f) < distanceTo(ship, b) ? f : b
          );
          return { type: 'move', target: { x: nearest.x, y: nearest.y } };
        }
        return { type: 'idle' };
      }

      // ── ASSAULT: press attack on nearest outnumberable enemy ──
      if (mode === 'assault') {
        const fightable = state.enemyShips.filter(e => e.alive);
        if (fightable.length > 0) {
          // Target the enemy most likely to be isolated
          const target = fightable.reduce((best, e) => {
            const eNearFriends = state.enemyShips.filter(
              x => x.id !== e.id && x.alive && distanceTo(e, x) <= r
            ).length;
            const bNearFriends = state.enemyShips.filter(
              x => x.id !== best.id && x.alive && distanceTo(best, x) <= r
            ).length;
            // Prefer enemy with fewer friends (easier kill)
            if (eNearFriends < bNearFriends) return e;
            if (eNearFriends > bNearFriends) return best;
            // Tie-break: nearest
            return distanceTo(ship, e) < distanceTo(ship, best) ? e : best;
          });
          return { type: 'move', target: { x: target.x, y: target.y } };
        }
        // No enemies to fight — fall through to capture
      }

      // ── DEFEND: rush back to contested island ──
      if (mode === 'defend') {
        const threatened = state.islands.filter(
          i => i.owner === 'me' && i.teamCapturing === 'enemy'
        );
        if (threatened.length > 0) {
          const t = threatened.reduce((b, i) =>
            distanceTo(ship, i) < distanceTo(ship, b) ? i : b
          );
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
      }

      // ── CAPTURE: find best uncaptured island ──
      const uncaptured = islandsNotMine(state.islands);
      if (uncaptured.length === 0) {
        // Consolidate — move to our highest-value island
        const mine = islandsOwnedBy(state.islands, 'me');
        if (mine.length > 0) {
          const best = mine.reduce((b, i) => i.value > b.value ? i : b);
          return { type: 'move', target: { x: best.x, y: best.y } };
        }
        return { type: 'idle' };
      }

      // Score each uncaptured island: value + urgency - distance
      const best = uncaptured.reduce((b, i) => {
        const dist = distanceTo(ship, i);
        const urgency = i.owner === 'enemy' ? 3000 : 0;  // stop enemy scoring
        const valueBonus = (i.value - 1) * 500;          // treasure islands
        const score = urgency + valueBonus - dist;

        const bDist = distanceTo(ship, b);
        const bUrgency = b.owner === 'enemy' ? 3000 : 0;
        const bValueBonus = (b.value - 1) * 500;
        const bScore = bUrgency + bValueBonus - bDist;

        return score > bScore ? i : b;
      });

      return { type: 'move', target: { x: best.x, y: best.y } };
    },
  };
}
`;

// ─────────────────────────────────────────────
// Factory function — direct TypeScript import
// ─────────────────────────────────────────────

type ShipMode = 'capture' | 'retreat' | 'assault' | 'defend';

export const createBot: BotFactory = () => {
  const shipMode: Record<number, ShipMode> = {};
  const modeTimer: Record<number, number> = {};
  const MODE_HOLD = 8;

  function evalMode(state: GameState, ship: BotShip): ShipMode {
    const r = state.config.attackRadius;
    const scoreDelta = state.myScore - state.enemyScore;
    const isBehind = scoreDelta < -100;
    const fightThreshold = isBehind ? 0 : 1;

    // All alive ships participate in combat — no isCapturing exclusion
    const nearFriends = state.myShips.filter(
      (s) => s.id !== ship.id && s.alive && distanceTo(ship, s) <= r,
    ).length;

    const nearEnemies = state.enemyShips.filter((s) => s.alive && distanceTo(ship, s) <= r).length;

    if (nearEnemies > nearFriends + 1) return 'retreat';
    if (nearEnemies > 0 && nearFriends >= fightThreshold) return 'assault';

    const threatened = state.islands.filter((i) => i.owner === 'me' && i.teamCapturing === 'enemy');
    if (threatened.length > 0) {
      const nearest = threatened.reduce((b, i) =>
        distanceTo(ship, i) < distanceTo(ship, b) ? i : b,
      );
      const freeTeam = state.myShips.filter((s) => s.id !== ship.id && s.alive);
      const closerFriend = freeTeam.find((s) => distanceTo(s, nearest) < distanceTo(ship, nearest));
      if (!closerFriend) return 'defend';
    }

    return 'capture';
  }

  return {
    tick(state: GameState, ship: BotShip): Command {
      if (!ship.alive) {
        delete shipMode[ship.id];
        delete modeTimer[ship.id];
        return { type: 'idle' };
      }

      const tick = state.tick;
      const r = state.config.attackRadius;
      const heldFor = tick - (modeTimer[ship.id] ?? -999);
      const forceReeval = heldFor >= MODE_HOLD;
      const newMode = evalMode(state, ship);

      if (!shipMode[ship.id] || forceReeval || newMode === 'retreat') {
        shipMode[ship.id] = newMode;
        modeTimer[ship.id] = tick;
      }

      const mode = shipMode[ship.id];

      if (mode === 'retreat') {
        const friends = state.myShips.filter((s) => s.id !== ship.id && s.alive);
        if (friends.length > 0) {
          const nearest = friends.reduce((b, f) =>
            distanceTo(ship, f) < distanceTo(ship, b) ? f : b,
          );
          return { type: 'move', target: { x: nearest.x, y: nearest.y } };
        }
        return { type: 'idle' };
      }

      if (mode === 'assault') {
        const fightable = state.enemyShips.filter((e) => e.alive);
        if (fightable.length > 0) {
          const target = fightable.reduce((best, e) => {
            const eNearFriends = state.enemyShips.filter(
              (x) => x.id !== e.id && x.alive && distanceTo(e, x) <= r,
            ).length;
            const bNearFriends = state.enemyShips.filter(
              (x) => x.id !== best.id && x.alive && distanceTo(best, x) <= r,
            ).length;
            if (eNearFriends < bNearFriends) return e;
            if (eNearFriends > bNearFriends) return best;
            return distanceTo(ship, e) < distanceTo(ship, best) ? e : best;
          });
          return { type: 'move', target: { x: target.x, y: target.y } };
        }
      }

      if (mode === 'defend') {
        const threatened = state.islands.filter(
          (i) => i.owner === 'me' && i.teamCapturing === 'enemy',
        );
        if (threatened.length > 0) {
          const t = threatened.reduce((b, i) =>
            distanceTo(ship, i) < distanceTo(ship, b) ? i : b,
          );
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
      }

      const uncaptured = islandsNotMine(state.islands);
      if (uncaptured.length === 0) {
        const mine = islandsOwnedBy(state.islands, 'me');
        if (mine.length > 0) {
          const best = mine.reduce((b, i) => (i.value > b.value ? i : b));
          return { type: 'move', target: { x: best.x, y: best.y } };
        }
        return { type: 'idle' };
      }

      const best = uncaptured.reduce((b, i) => {
        const dist = distanceTo(ship, i);
        const urgency = i.owner === 'enemy' ? 3000 : 0;
        const valueBonus = (i.value - 1) * 500;
        const score = urgency + valueBonus - dist;

        const bDist = distanceTo(ship, b);
        const bUrgency = b.owner === 'enemy' ? 3000 : 0;
        const bValueBonus = (b.value - 1) * 500;
        const bScore = bUrgency + bValueBonus - bDist;

        return score > bScore ? i : b;
      });

      return { type: 'move', target: { x: best.x, y: best.y } };
    },
  };
};

export default createBot;
