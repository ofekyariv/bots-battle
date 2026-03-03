// 🏴☠️ Bots Battle — JavaScript Sample Bots
// ============================================================
// Copy any of these into the editor and press "Use in Battle".
// All helper functions are available globally in tick().
// ============================================================

// ─────────────────────────────────────────────
// 🟢 Rusher — greedy island spreader
// Each ship claims a unique uncaptured island.
// ─────────────────────────────────────────────
function createBot() {
  return {
    tick(state, ship) {
      if (!ship.alive) return { type: 'idle' };

      const enemies   = islandsOwnedBy(state.islands, 'enemy');
      const neutral   = islandsOwnedBy(state.islands, 'neutral');
      const uncaptured = [...enemies, ...neutral];

      if (uncaptured.length === 0) {
        const contested = state.islands.filter(
          i => i.owner === 'me' && i.teamCapturing === 'enemy'
        );
        if (contested.length > 0) {
          const t = nearestIsland(ship, contested);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        const mine = islandsOwnedBy(state.islands, 'me');
        if (mine.length > 0) {
          const t = nearestIsland(ship, mine);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      const score = (island, fromShip) =>
        distanceTo(fromShip, island) - (island.owner === 'enemy' ? 5000 : 0);

      const alive = state.myShips.filter(s => s.alive).sort((a, b) => a.id - b.id);
      const myRank = alive.findIndex(s => s.id === ship.id);
      if (myRank === -1) return { type: 'idle' };

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


// ─────────────────────────────────────────────
// 🟡 Balanced — adaptive retreat/assault/capture/defend
// ─────────────────────────────────────────────
function createBot() {
  const shipMode = {};
  const modeTimer = {};
  const MODE_HOLD = 8;

  function evalMode(state, ship) {
    const r = state.config.attackRadius;
    const nearFriends = state.myShips.filter(
      s => s.id !== ship.id && s.alive && distanceTo(ship, s) <= r
    ).length;
    const nearEnemies = state.enemyShips.filter(
      s => s.alive && distanceTo(ship, s) <= r
    ).length;

    const scoreDelta = state.myScore - state.enemyScore;
    const isBehind = scoreDelta < -100;
    const fightThreshold = isBehind ? 0 : 1;

    if (nearEnemies > nearFriends + 1) return 'retreat';
    if (nearEnemies > 0 && nearFriends >= fightThreshold) return 'assault';

    const threatened = state.islands.filter(
      i => i.owner === 'me' && i.teamCapturing === 'enemy'
    );
    if (threatened.length > 0) {
      const nearest = threatened.reduce((b, i) =>
        distanceTo(ship, i) < distanceTo(ship, b) ? i : b
      );
      const closerFriend = state.myShips
        .filter(s => s.id !== ship.id && s.alive)
        .find(s => distanceTo(s, nearest) < distanceTo(ship, nearest));
      if (!closerFriend) return 'defend';
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
      const heldFor = tick - (modeTimer[ship.id] ?? -999);
      const newMode = evalMode(state, ship);

      if (!shipMode[ship.id] || heldFor >= MODE_HOLD || newMode === 'retreat') {
        shipMode[ship.id] = newMode;
        modeTimer[ship.id] = tick;
      }

      const mode = shipMode[ship.id];

      if (mode === 'retreat') {
        const friends = state.myShips.filter(s => s.id !== ship.id && s.alive);
        if (friends.length > 0) {
          const t = friends.reduce((b, f) =>
            distanceTo(ship, f) < distanceTo(ship, b) ? f : b
          );
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
        return { type: 'idle' };
      }

      if (mode === 'assault') {
        const fightable = state.enemyShips.filter(e => e.alive);
        if (fightable.length > 0) {
          const target = fightable.reduce((best, e) => {
            const eNF = state.enemyShips.filter(x =>
              x.id !== e.id && x.alive && distanceTo(e, x) <= r
            ).length;
            const bNF = state.enemyShips.filter(x =>
              x.id !== best.id && x.alive && distanceTo(best, x) <= r
            ).length;
            if (eNF < bNF) return e;
            if (eNF > bNF) return best;
            return distanceTo(ship, e) < distanceTo(ship, best) ? e : best;
          });
          return { type: 'move', target: { x: target.x, y: target.y } };
        }
      }

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

      const uncaptured = islandsNotMine(state.islands);
      if (uncaptured.length === 0) {
        const mine = islandsOwnedBy(state.islands, 'me');
        if (mine.length > 0) {
          const best = mine.reduce((b, i) => i.value > b.value ? i : b);
          return { type: 'move', target: { x: best.x, y: best.y } };
        }
        return { type: 'idle' };
      }

      const best = uncaptured.reduce((b, i) => {
        const s = (i.owner === 'enemy' ? 3000 : 0) + (i.value - 1) * 500 - distanceTo(ship, i);
        const bs = (b.owner === 'enemy' ? 3000 : 0) + (b.value - 1) * 500 - distanceTo(ship, b);
        return s > bs ? i : b;
      });
      return { type: 'move', target: { x: best.x, y: best.y } };
    },
  };
}


// ─────────────────────────────────────────────
// 🔴 Admiral — 3-phase state machine with per-ship roles
// expand → consolidate → endgame
// ─────────────────────────────────────────────
function createBot() {
  const roles = {};
  let lastRoleUpdate = -50;
  const ROLE_UPDATE_INTERVAL = 20;

  function getPhase(tick, maxTicks) {
    const pct = tick / maxTicks;
    if (pct < 0.28) return 'expand';
    if (pct < 0.67) return 'consolidate';
    return 'endgame';
  }

  function assignRoles(state) {
    const phase = getPhase(state.tick, state.maxTicks);
    const alive = state.myShips.filter(s => s.alive).sort((a, b) => a.id - b.id);
    const myIslands  = islandsOwnedBy(state.islands, 'me');
    const uncaptured = islandsNotMine(state.islands);
    const isAhead    = (state.myScore - state.enemyScore) > 150;
    const newRoles   = {};

    if (phase === 'expand') {
      const claimed = new Set();
      for (const sh of alive) {
        const pool = uncaptured.filter(i => !claimed.has(i.id));
        if (pool.length === 0) { newRoles[sh.id] = { role: 'idle', targetId: null }; continue; }
        const best = pool.reduce((b, i) => {
          const s  = distanceTo(sh, i) - (i.owner === 'enemy' ? 2000 : 0);
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
          const notDoubled = myIslands.filter(i =>
            Object.values(newRoles).filter(x => x.targetId === i.id).length < 2
          );
          if (notDoubled.length > 0) {
            const t = notDoubled.reduce((b, i) =>
              distanceTo(sh, i) < distanceTo(sh, b) ? i : b
            );
            newRoles[sh.id] = { role: 'defender', targetId: t.id };
            defCount++;
            continue;
          }
        }
        if (uncaptured.length > 0) {
          const best = uncaptured.reduce((b, i) => {
            const s  = distanceTo(sh, i) - (i.owner === 'enemy' ? 3000 : 0);
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
          const t = myIslands.length > 0
            ? myIslands.reduce((b, i) => distanceTo(sh, i) < distanceTo(sh, b) ? i : b)
            : null;
          newRoles[sh.id] = { role: 'defender', targetId: t ? t.id : null };
        }
      } else {
        const enemyIsl = islandsOwnedBy(state.islands, 'enemy');
        const target = enemyIsl.length > 0
          ? enemyIsl.reduce((b, i) => i.value > b.value ? i : b)
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
      if (!ship.alive) { delete roles[ship.id]; return { type: 'idle' }; }

      if (state.tick - lastRoleUpdate >= ROLE_UPDATE_INTERVAL) {
        Object.assign(roles, assignRoles(state));
        lastRoleUpdate = state.tick;
      }

      const myRole = roles[ship.id] || { role: 'idle', targetId: null };
      const r = state.config.attackRadius;

      if (myRole.role === 'defender' && myRole.targetId !== null) {
        const island = state.islands.find(i => i.id === myRole.targetId);
        if (island) {
          if (island.teamCapturing === 'enemy') {
            return { type: 'move', target: { x: island.x, y: island.y } };
          }
          const angle = state.tick * 0.03 + ship.id;
          return { type: 'move', target: {
            x: island.x + Math.cos(angle) * island.radius * 0.8,
            y: island.y + Math.sin(angle) * island.radius * 0.8,
          }};
        }
      }

      if (myRole.role === 'attacker' && myRole.targetId !== null) {
        const island = state.islands.find(i => i.id === myRole.targetId);
        if (island) {
          const nf = state.myShips.filter(s => s.id !== ship.id && s.alive && distanceTo(ship, s) <= r).length;
          const ne = state.enemyShips.filter(e => e.alive && distanceTo(ship, e) <= r).length;
          if (ne > nf + 2) {
            const friends = state.myShips.filter(s => s.id !== ship.id && s.alive);
            if (friends.length > 0) {
              const t = friends.reduce((b, f) => distanceTo(ship, f) < distanceTo(ship, b) ? f : b);
              return { type: 'move', target: { x: t.x, y: t.y } };
            }
          }
          return { type: 'move', target: { x: island.x, y: island.y } };
        }
      }

      if (myRole.role === 'capturer' && myRole.targetId !== null) {
        const island = state.islands.find(i => i.id === myRole.targetId);
        if (island && island.owner !== 'me') {
          return { type: 'move', target: { x: island.x, y: island.y } };
        }
        const unc = islandsNotMine(state.islands);
        if (unc.length > 0) {
          const t = nearestIsland(ship, unc);
          return { type: 'move', target: { x: t.x, y: t.y } };
        }
      }

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
