// @language: csharp
// ============================================================
// 🏴☠️ Bots Battle — C# Sample Bots
// ============================================================
// Copy any of these into the editor and press "Use in Battle".
// Helpers are available as static methods (PascalCase).
// ============================================================

// ─────────────────────────────────────────────
// 🟢 Rusher — greedy island spreader
// ─────────────────────────────────────────────
Command Tick(GameState state, Ship ship) {
    if (!ship.Alive) return Command.Idle();

    var uncaptured = IslandsOwnedBy(state.Islands, "enemy")
        .Concat(IslandsOwnedBy(state.Islands, "neutral")).ToArray();

    if (uncaptured.Length == 0) {
        var contested = state.Islands.Where(i => i.Owner == "me" && i.TeamCapturing == "enemy").ToArray();
        if (contested.Length > 0) {
            var t = NearestIsland(ship, contested);
            return t != null ? Command.MoveTo(t.X, t.Y) : Command.Idle();
        }
        var mine2 = IslandsOwnedBy(state.Islands, "me");
        if (mine2.Length > 0) {
            var t = NearestIsland(ship, mine2);
            return t != null ? Command.MoveTo(t.X, t.Y) : Command.Idle();
        }
        return Command.Idle();
    }

    double Score(Island i, Ship from) =>
        DistanceTo(from, i) - (i.Owner == "enemy" ? 5000.0 : 0.0);

    var alive = state.MyShips.Where(s => s.Alive).OrderBy(s => s.Id).ToList();
    int myRank = alive.FindIndex(s => s.Id == ship.Id);
    if (myRank < 0) return Command.Idle();

    var claimed = new HashSet<int>();
    for (int r = 0; r < myRank; r++) {
        var other = alive[r];
        var pool2 = uncaptured.Where(i => !claimed.Contains(i.Id)).ToArray();
        if (pool2.Length == 0) break;
        var best2 = pool2.MinBy(i => Score(i, other));
        if (best2 != null) claimed.Add(best2.Id);
    }

    var remaining = uncaptured.Where(i => !claimed.Contains(i.Id)).ToArray();
    var pool = remaining.Length > 0 ? remaining : uncaptured;
    var target = pool.MinBy(i => Score(i, ship));
    return target != null ? Command.MoveTo(target.X, target.Y) : Command.Idle();
}


// ─────────────────────────────────────────────
// 🟡 Balanced — adaptive retreat/assault/capture/defend
// ─────────────────────────────────────────────
// (Persistent state lives in class fields; simplified top-level version shown.)
Command Tick(GameState state, Ship ship) {
    if (!ship.Alive) return Command.Idle();

    double r          = state.Config.AttackRadius;
    double scoreDelta = state.MyScore - state.EnemyScore;
    bool isBehind     = scoreDelta < -100;
    int fightThreshold = isBehind ? 0 : 1;

    int nearFriends = state.MyShips.Count(s => s.Id != ship.Id && s.Alive && DistanceTo(ship, s) <= r);
    int nearEnemies = state.EnemyShips.Count(e => e.Alive && DistanceTo(ship, e) <= r);

    // Retreat
    if (nearEnemies > nearFriends + 1) {
        var friend = state.MyShips.Where(s => s.Id != ship.Id && s.Alive)
            .MinBy(s => DistanceTo(ship, s));
        return friend != null ? Command.MoveTo(friend.X, friend.Y) : Command.Idle();
    }

    // Assault
    if (nearEnemies > 0 && nearFriends >= fightThreshold) {
        var target = state.EnemyShips.Where(e => e.Alive).MinBy(e => {
            int ef = state.EnemyShips.Count(x => x.Id != e.Id && x.Alive && DistanceTo(e, x) <= r);
            return ef * 10000.0 + DistanceTo(ship, e);
        });
        if (target != null) return Command.MoveTo(target.X, target.Y);
    }

    // Defend
    var threatened = state.Islands.Where(i => i.Owner == "me" && i.TeamCapturing == "enemy").ToArray();
    if (threatened.Length > 0) {
        var nearest = threatened.MinBy(i => DistanceTo(ship, i))!;
        bool closerFriend = state.MyShips.Any(s =>
            s.Id != ship.Id && s.Alive && DistanceTo(s, nearest) < DistanceTo(ship, nearest));
        if (!closerFriend) return Command.MoveTo(nearest.X, nearest.Y);
    }

    // Capture
    var uncaptured = IslandsNotMine(state.Islands);
    if (uncaptured.Length == 0) {
        var mine = IslandsOwnedBy(state.Islands, "me");
        if (mine.Length > 0) {
            var best = mine.MaxBy(i => i.Value)!;
            return Command.MoveTo(best.X, best.Y);
        }
        return Command.Idle();
    }

    var capTarget = uncaptured.MaxBy(i => {
        double dist    = DistanceTo(ship, i);
        double urgency = i.Owner == "enemy" ? 3000.0 : 0.0;
        double valB    = (i.Value - 1) * 500.0;
        return urgency + valB - dist;
    });
    return capTarget != null ? Command.MoveTo(capTarget.X, capTarget.Y) : Command.Idle();
}


// ─────────────────────────────────────────────
// 🔴 Admiral — 3-phase state machine with per-ship roles
// ─────────────────────────────────────────────
// Persistent state in class fields; paste entire class into editor.
class BotImpl {
    Dictionary<int, string> _roles     = new();
    Dictionary<int, int?>   _targetIds = new();
    int _lastRoleUpdate = -50;
    const int INTERVAL  = 20;

    string GetPhase(int tick, int maxTicks) {
        double pct = (double)tick / maxTicks;
        if (pct < 0.28) return "expand";
        if (pct < 0.67) return "consolidate";
        return "endgame";
    }

    void AssignRoles(GameState state) {
        string phase      = GetPhase(state.Tick, state.MaxTicks);
        var alive         = state.MyShips.Where(s => s.Alive).OrderBy(s => s.Id).ToList();
        var myIslands     = IslandsOwnedBy(state.Islands, "me");
        var uncaptured    = IslandsNotMine(state.Islands);
        bool isAhead      = (state.MyScore - state.EnemyScore) > 150;

        var newRoles  = new Dictionary<int, string>();
        var newIds    = new Dictionary<int, int?>();

        if (phase == "expand") {
            var claimed = new HashSet<int>();
            foreach (var sh in alive) {
                var pool = uncaptured.Where(i => !claimed.Contains(i.Id)).ToArray();
                if (pool.Length == 0) { newRoles[sh.Id] = "idle"; newIds[sh.Id] = null; continue; }
                var best = pool.MinBy(i => DistanceTo(sh, i) - (i.Owner == "enemy" ? 2000.0 : 0.0));
                if (best != null) { claimed.Add(best.Id); newRoles[sh.Id] = "capturer"; newIds[sh.Id] = best.Id; }
            }
        } else if (phase == "consolidate") {
            int defCount = 0;
            foreach (var sh in alive) {
                if (defCount < myIslands.Length * 1.5 && myIslands.Length > 0) {
                    var notDoubled = myIslands.Where(i =>
                        newIds.Values.Count(v => v == i.Id) < 2).ToArray();
                    if (notDoubled.Length > 0) {
                        var t = notDoubled.MinBy(i => DistanceTo(sh, i));
                        if (t != null) { newRoles[sh.Id] = "defender"; newIds[sh.Id] = t.Id; defCount++; continue; }
                    }
                }
                if (uncaptured.Length > 0) {
                    var best = uncaptured.MinBy(i => DistanceTo(sh, i) - (i.Owner == "enemy" ? 3000.0 : 0.0));
                    if (best != null) { newRoles[sh.Id] = "attacker"; newIds[sh.Id] = best.Id; }
                } else { newRoles[sh.Id] = "idle"; newIds[sh.Id] = null; }
            }
        } else { // endgame
            if (isAhead) {
                foreach (var sh in alive) {
                    var t = myIslands.MinBy(i => DistanceTo(sh, i));
                    newRoles[sh.Id] = "defender"; newIds[sh.Id] = t?.Id;
                }
            } else {
                var enemyIsl = IslandsOwnedBy(state.Islands, "enemy");
                var target   = enemyIsl.MaxBy(i => i.Value);
                foreach (var sh in alive) { newRoles[sh.Id] = "attacker"; newIds[sh.Id] = target?.Id; }
            }
        }
        foreach (var kv in newRoles)  _roles[kv.Key]     = kv.Value;
        foreach (var kv in newIds)    _targetIds[kv.Key] = kv.Value;
    }

    public Command Tick(GameState state, Ship ship) {
        if (!ship.Alive) { _roles.Remove(ship.Id); _targetIds.Remove(ship.Id); return Command.Idle(); }

        if (state.Tick - _lastRoleUpdate >= INTERVAL) { AssignRoles(state); _lastRoleUpdate = state.Tick; }

        string role = _roles.GetValueOrDefault(ship.Id, "idle");
        int? tId    = _targetIds.GetValueOrDefault(ship.Id, null);
        double r    = state.Config.AttackRadius;

        if (role == "defender" && tId.HasValue) {
            var island = state.Islands.FirstOrDefault(i => i.Id == tId.Value);
            if (island != null) {
                if (island.TeamCapturing == "enemy") return Command.MoveTo(island.X, island.Y);
                double angle = state.Tick * 0.03 + ship.Id;
                return Command.MoveTo(
                    island.X + Math.Cos(angle) * island.Radius * 0.8,
                    island.Y + Math.Sin(angle) * island.Radius * 0.8);
            }
        }

        if (role == "attacker" && tId.HasValue) {
            var island = state.Islands.FirstOrDefault(i => i.Id == tId.Value);
            if (island != null) {
                int nf = state.MyShips.Count(s => s.Id != ship.Id && s.Alive && DistanceTo(ship, s) <= r);
                int ne = state.EnemyShips.Count(e => e.Alive && DistanceTo(ship, e) <= r);
                if (ne > nf + 2) {
                    var fallback = state.MyShips.Where(s => s.Id != ship.Id && s.Alive)
                        .MinBy(s => DistanceTo(ship, s));
                    return fallback != null ? Command.MoveTo(fallback.X, fallback.Y) : Command.Idle();
                }
                return Command.MoveTo(island.X, island.Y);
            }
        }

        if (role == "capturer" && tId.HasValue) {
            var island = state.Islands.FirstOrDefault(i => i.Id == tId.Value && i.Owner != "me");
            if (island != null) return Command.MoveTo(island.X, island.Y);
            var fallback = NearestIsland(ship, IslandsNotMine(state.Islands));
            if (fallback != null) return Command.MoveTo(fallback.X, fallback.Y);
        }

        var unc  = NearestIsland(ship, IslandsNotMine(state.Islands));
        if (unc  != null) return Command.MoveTo(unc.X, unc.Y);
        var mine = NearestIsland(ship, IslandsOwnedBy(state.Islands, "me"));
        if (mine != null) return Command.MoveTo(mine.X, mine.Y);
        return Command.Idle();
    }
}
