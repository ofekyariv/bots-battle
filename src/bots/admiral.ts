// ============================================================
// 🏴‍☠️ Admiral Bot — sophisticated 3-phase state machine
// ============================================================
//
// Strategy:
//   The Admiral is the most tactically complete bot. It runs
//   a global state machine with 3 phases and per-ship roles:
//
//   ── EARLY GAME (tick 0-500) ──
//   "Expansion" — secure as many islands as possible quickly.
//   Ships spread using greedy assignment like Rusher, but with
//   2-ship escort pairs for contested zones.
//
//   ── MID GAME (tick 500-1200) ──
//   "Consolidation" — hold our islands with 2-ship defense pairs,
//   route surplus ships to contest enemy territory. Track score
//   differential and adjust aggression.
//
//   ── LATE GAME (tick 1200+) ──
//   "Endgame" — if ahead: full turtle, all ships on defense.
//   If behind or tied: all-in assault on enemy's best island.
//   If close to winning score: protect the lead, don't trade.
//
//   Per-ship roles (assigned globally each phase):
//   ATTACKER  — push into enemy territory
//   DEFENDER  — orbit assigned island
//   CAPTURER  — take uncaptured islands
//   ESCORT    — follow and protect a capturer
//
//   The Admiral reads the battlefield holistically each tick and
//   re-assigns roles as needed. It's the hardest bot to beat.
// ============================================================

import type { BotFactory, BotShip, GameState, Command } from '@/engine/types';
import {
  distanceTo,
  nearestIsland,
  islandsOwnedBy,
  islandsNotMine,
  nearestEnemy,
  scoreRate,
} from '@/engine/helpers';

export const botCode = `
function createBot() {
  // Per-ship role assignments: ship.id → { role, targetId }
  const roles = {};
  let lastRoleUpdate = -50;
  const ROLE_UPDATE_INTERVAL = 20; // re-assign roles every 20 ticks

  function getPhase(tick, maxTicks) {
    const pct = tick / maxTicks;
    if (pct < 0.28) return 'expand';
    if (pct < 0.67) return 'consolidate';
    return 'endgame';
  }

  function assignRoles(state) {
    const phase = getPhase(state.tick, state.maxTicks);
    const alive = state.myShips.filter(s => s.alive).sort((a, b) => a.id - b.id);
    const myIslands = islandsOwnedBy(state.islands, 'me');
    const uncaptured = islandsNotMine(state.islands);
    const scoreDelta = state.myScore - state.enemyScore;
    const isAhead = scoreDelta > 150;
    const isBehind = scoreDelta < -150;

    const newRoles = {};

    if (phase === 'expand') {
      // Greedy spread: each ship gets a unique uncaptured island
      const claimed = new Set();
      for (let r = 0; r < alive.length; r++) {
        const sh = alive[r];
        const pool = uncaptured.filter(i => !claimed.has(i.id));
        if (pool.length === 0) {
          newRoles[sh.id] = { role: 'idle', targetId: null };
          continue;
        }
        const best = pool.reduce((b, i) => {
          const s = distanceTo(sh, i) - (i.owner === 'enemy' ? 2000 : 0);
          const bs = distanceTo(sh, b) - (b.owner === 'enemy' ? 2000 : 0);
          return s < bs ? i : b;
        });
        claimed.add(best.id);
        newRoles[sh.id] = { role: 'capturer', targetId: best.id };
      }
    } else if (phase === 'consolidate') {
      // 2 ships per owned island for defense, rest attack
      const defended = new Set();
      let defCount = 0;
      for (let r = 0; r < alive.length; r++) {
        const sh = alive[r];
        if (defCount < myIslands.length * 1.5 && myIslands.length > 0) {
          // Assign to nearest un-doubled-up island
          const notDoubled = myIslands.filter(i => {
            const assigned = Object.values(newRoles).filter(x => x.targetId === i.id).length;
            return assigned < 2;
          });
          if (notDoubled.length > 0) {
            const t = notDoubled.reduce((b, i) => distanceTo(sh, i) < distanceTo(sh, b) ? i : b);
            newRoles[sh.id] = { role: 'defender', targetId: t.id };
            defCount++;
            continue;
          }
        }
        // Surplus ships attack
        if (uncaptured.length > 0) {
          const best = uncaptured.reduce((b, i) => {
            const s = distanceTo(sh, i) - (i.owner === 'enemy' ? 3000 : 0);
            const bs = distanceTo(sh, b) - (b.owner === 'enemy' ? 3000 : 0);
            return s < bs ? i : b;
          });
          newRoles[sh.id] = { role: 'attacker', targetId: best.id };
        } else {
          newRoles[sh.id] = { role: 'idle', targetId: null };
        }
      }
    } else {
      // Endgame
      if (isAhead) {
        // All defend
        for (let r = 0; r < alive.length; r++) {
          const sh = alive[r];
          const targetIsland = myIslands.length > 0
            ? myIslands.reduce((b, i) => distanceTo(sh, i) < distanceTo(sh, b) ? i : b)
            : null;
          newRoles[sh.id] = { role: 'defender', targetId: targetIsland ? targetIsland.id : null };
        }
      } else {
        // All attack enemy's highest-value island
        const enemyIslands = islandsOwnedBy(state.islands, 'enemy');
        const target = enemyIslands.length > 0
          ? enemyIslands.reduce((b, i) => i.value > b.value ? i : b)
          : null;
        for (const sh of alive) {
          newRoles[sh.id] = { role: 'attacker', targetId: target ? target.id : null };
        }
      }
    }

    return newRoles;
  }

  return {
    tick(state, ship) {
      if (!ship.alive) {
        delete roles[ship.id];
        return { type: 'idle' };
      }

      // Re-assign roles periodically
      if (state.tick - lastRoleUpdate >= ROLE_UPDATE_INTERVAL) {
        const newRoles = assignRoles(state);
        for (const [id, role] of Object.entries(newRoles)) {
          roles[id] = role;
        }
        lastRoleUpdate = state.tick;
      }

      const myRole = roles[ship.id] || { role: 'idle', targetId: null };
      const r = state.config.attackRadius;

      // DEFENDER: orbit the assigned island
      if (myRole.role === 'defender' && myRole.targetId !== null) {
        const island = state.islands.find(i => i.id === myRole.targetId);
        if (island) {
          // If contested, converge on it; else orbit
          if (island.teamCapturing === 'enemy') {
            return { type: 'move', target: { x: island.x, y: island.y } };
          }
          const angle = state.tick * 0.03 + ship.id;
          const ox = island.x + Math.cos(angle) * island.radius * 0.8;
          const oy = island.y + Math.sin(angle) * island.radius * 0.8;
          return { type: 'move', target: { x: ox, y: oy } };
        }
      }

      // ATTACKER: go after target; retreat if badly outnumbered
      if (myRole.role === 'attacker' && myRole.targetId !== null) {
        const island = state.islands.find(i => i.id === myRole.targetId);
        if (island) {
          const nearFriends = state.myShips.filter(s => s.id !== ship.id && s.alive && distanceTo(ship, s) <= r).length;
          const nearEnemies = state.enemyShips.filter(e => e.alive && distanceTo(ship, e) <= r).length;
          if (nearEnemies > nearFriends + 2) {
            // Badly outnumbered — fall back
            const friends = state.myShips.filter(s => s.id !== ship.id && s.alive);
            if (friends.length > 0) {
              const t = friends.reduce((b, f) => distanceTo(ship, f) < distanceTo(ship, b) ? f : b);
              return { type: 'move', target: { x: t.x, y: t.y } };
            }
          }
          return { type: 'move', target: { x: island.x, y: island.y } };
        }
      }

      // CAPTURER: go to target island
      if (myRole.role === 'capturer' && myRole.targetId !== null) {
        const island = state.islands.find(i => i.id === myRole.targetId);
        if (island && island.owner !== 'me') {
          return { type: 'move', target: { x: island.x, y: island.y } };
        }
        // Island captured — fallback to nearest uncaptured
        const unc = islandsNotMine(state.islands);
        if (unc.length > 0) {
          const t = nearestIsland(ship, unc);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
      }

      // IDLE fallback
      const unc = islandsNotMine(state.islands);
      if (unc.length > 0) {
        const t = nearestIsland(ship, unc);
        return { type: 'move', target: { x: t.x, y: t.y } };
      }
      const mine = islandsOwnedBy(state.islands, 'me');
      if (mine.length > 0) {
        const t = nearestIsland(ship, mine);
        return { type: 'move', target: { x: t.x, y: t.y } };
      }
      return { type: 'idle' };
    },
  };
}
`;

export const createBot: BotFactory = () => {
  const roles: Record<number, { role: string; targetId: number | null }> = {};
  let lastRoleUpdate = -50;
  const ROLE_UPDATE_INTERVAL = 20;

  function getPhase(tick: number, maxTicks: number): 'expand' | 'consolidate' | 'endgame' {
    const pct = tick / maxTicks;
    if (pct < 0.28) return 'expand';
    if (pct < 0.67) return 'consolidate';
    return 'endgame';
  }

  function assignRoles(state: GameState) {
    const phase = getPhase(state.tick, state.maxTicks);
    const alive = state.myShips.filter((s) => s.alive).sort((a, b) => a.id - b.id);
    const myIslands = islandsOwnedBy(state.islands, 'me');
    const uncaptured = islandsNotMine(state.islands);
    const scoreDelta = state.myScore - state.enemyScore;
    const isAhead = scoreDelta > 150;

    const newRoles: Record<number, { role: string; targetId: number | null }> = {};

    if (phase === 'expand') {
      const claimed = new Set<number>();
      for (const sh of alive) {
        const pool = uncaptured.filter((i) => !claimed.has(i.id));
        if (pool.length === 0) {
          newRoles[sh.id] = { role: 'idle', targetId: null };
          continue;
        }
        const best = pool.reduce((b, i) => {
          const s = distanceTo(sh, i) - (i.owner === 'enemy' ? 2000 : 0);
          const bs = distanceTo(sh, b) - (b.owner === 'enemy' ? 2000 : 0);
          return s < bs ? i : b;
        });
        claimed.add(best.id);
        newRoles[sh.id] = { role: 'capturer', targetId: best.id };
      }
    } else if (phase === 'consolidate') {
      let defCount = 0;
      for (const sh of alive) {
        if (defCount < myIslands.length * 1.5 && myIslands.length > 0) {
          const notDoubled = myIslands.filter((i) => {
            const assigned = Object.values(newRoles).filter((x) => x.targetId === i.id).length;
            return assigned < 2;
          });
          if (notDoubled.length > 0) {
            const t = notDoubled.reduce((b, i) => (distanceTo(sh, i) < distanceTo(sh, b) ? i : b));
            newRoles[sh.id] = { role: 'defender', targetId: t.id };
            defCount++;
            continue;
          }
        }
        if (uncaptured.length > 0) {
          const best = uncaptured.reduce((b, i) => {
            const s = distanceTo(sh, i) - (i.owner === 'enemy' ? 3000 : 0);
            const bs = distanceTo(sh, b) - (b.owner === 'enemy' ? 3000 : 0);
            return s < bs ? i : b;
          });
          newRoles[sh.id] = { role: 'attacker', targetId: best.id };
        } else {
          newRoles[sh.id] = { role: 'idle', targetId: null };
        }
      }
    } else {
      if (isAhead) {
        for (const sh of alive) {
          const t =
            myIslands.length > 0
              ? myIslands.reduce((b, i) => (distanceTo(sh, i) < distanceTo(sh, b) ? i : b))
              : null;
          newRoles[sh.id] = { role: 'defender', targetId: t?.id ?? null };
        }
      } else {
        const enemyIslands = islandsOwnedBy(state.islands, 'enemy');
        const target =
          enemyIslands.length > 0
            ? enemyIslands.reduce((b, i) => (i.value > b.value ? i : b))
            : null;
        for (const sh of alive) {
          newRoles[sh.id] = { role: 'attacker', targetId: target?.id ?? null };
        }
      }
    }
    return newRoles;
  }

  return {
    tick(state: GameState, ship: BotShip): Command {
      if (!ship.alive) {
        delete roles[ship.id];
        return { type: 'idle' };
      }

      if (state.tick - lastRoleUpdate >= ROLE_UPDATE_INTERVAL) {
        const newRoles = assignRoles(state);
        for (const [id, role] of Object.entries(newRoles)) {
          roles[Number(id)] = role;
        }
        lastRoleUpdate = state.tick;
      }

      const myRole = roles[ship.id] ?? { role: 'idle', targetId: null };
      const r = state.config.attackRadius;

      if (myRole.role === 'defender' && myRole.targetId !== null) {
        const island = state.islands.find((i) => i.id === myRole.targetId);
        if (island) {
          if (island.teamCapturing === 'enemy') {
            return { type: 'move', target: { x: island.x, y: island.y } };
          }
          const angle = state.tick * 0.03 + ship.id;
          const ox = island.x + Math.cos(angle) * island.radius * 0.8;
          const oy = island.y + Math.sin(angle) * island.radius * 0.8;
          return { type: 'move', target: { x: ox, y: oy } };
        }
      }

      if (myRole.role === 'attacker' && myRole.targetId !== null) {
        const island = state.islands.find((i) => i.id === myRole.targetId);
        if (island) {
          const nearFriends = state.myShips.filter(
            (s) => s.id !== ship.id && s.alive && distanceTo(ship, s) <= r,
          ).length;
          const nearEnemies = state.enemyShips.filter(
            (e) => e.alive && distanceTo(ship, e) <= r,
          ).length;
          if (nearEnemies > nearFriends + 2) {
            const friends = state.myShips.filter((s) => s.id !== ship.id && s.alive);
            if (friends.length > 0) {
              const t = friends.reduce((b, f) =>
                distanceTo(ship, f) < distanceTo(ship, b) ? f : b,
              );
              return { type: 'move', target: { x: t.x, y: t.y } };
            }
          }
          return { type: 'move', target: { x: island.x, y: island.y } };
        }
      }

      if (myRole.role === 'capturer' && myRole.targetId !== null) {
        const island = state.islands.find((i) => i.id === myRole.targetId);
        if (island && island.owner !== 'me') {
          return { type: 'move', target: { x: island.x, y: island.y } };
        }
        const unc = islandsNotMine(state.islands);
        if (unc.length > 0) {
          const t = nearestIsland(ship, unc);
          if (t) return { type: 'move', target: { x: t.x, y: t.y } };
        }
      }

      // Fallback
      const unc = islandsNotMine(state.islands);
      if (unc.length > 0) {
        const t = nearestIsland(ship, unc);
        if (t) return { type: 'move', target: { x: t.x, y: t.y } };
      }
      const mine = islandsOwnedBy(state.islands, 'me');
      if (mine.length > 0) {
        const t = nearestIsland(ship, mine);
        if (t) return { type: 'move', target: { x: t.x, y: t.y } };
      }
      return { type: 'idle' };
    },
  };
};

export default createBot;
