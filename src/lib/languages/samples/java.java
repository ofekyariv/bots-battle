// @language: java
// ============================================================
// 🏴☠️ Bots Battle — Java Sample Bots
// ============================================================
// Copy any of these into the editor and press "Use in Battle".
// Helpers are accessed via BotHelpers.methodName().
// ============================================================

// ─────────────────────────────────────────────
// 🟢 Rusher — greedy island spreader
// ─────────────────────────────────────────────
class Bot {
    Command tick(GameState state, BotShip ship) {
        if (!ship.alive) return Command.idle();

        List<BotIsland> enemies  = Arrays.asList(BotHelpers.islandsOwnedBy(state.islands, "enemy"));
        List<BotIsland> neutrals = Arrays.asList(BotHelpers.islandsOwnedBy(state.islands, "neutral"));
        List<BotIsland> uncaptured = new ArrayList<>();
        uncaptured.addAll(enemies);
        uncaptured.addAll(neutrals);

        if (uncaptured.isEmpty()) {
            List<BotIsland> contested = Arrays.stream(state.islands)
                .filter(i -> "me".equals(i.owner) && "enemy".equals(i.teamCapturing))
                .collect(Collectors.toList());
            if (!contested.isEmpty()) {
                BotIsland t = BotHelpers.nearestIsland(ship, contested.toArray(new BotIsland[0]));
                return t != null ? Command.move(t.x, t.y) : Command.idle();
            }
            BotIsland[] mine = BotHelpers.islandsOwnedBy(state.islands, "me");
            if (mine.length > 0) {
                BotIsland t = BotHelpers.nearestIsland(ship, mine);
                return t != null ? Command.move(t.x, t.y) : Command.idle();
            }
            return Command.idle();
        }

        List<BotShip> alive = Arrays.stream(state.myShips)
            .filter(s -> s.alive)
            .sorted(Comparator.comparingInt(s -> s.id))
            .collect(Collectors.toList());
        int myRank = -1;
        for (int i = 0; i < alive.size(); i++) {
            if (alive.get(i).id == ship.id) { myRank = i; break; }
        }
        if (myRank == -1) return Command.idle();

        Set<Integer> claimed = new HashSet<>();
        for (int r = 0; r < myRank; r++) {
            BotShip other = alive.get(r);
            List<BotIsland> pool = uncaptured.stream()
                .filter(i -> !claimed.contains(i.id)).collect(Collectors.toList());
            if (pool.isEmpty()) break;
            BotIsland best = pool.stream().min(Comparator.comparingDouble(i ->
                BotHelpers.distanceTo(other, i) - ("enemy".equals(i.owner) ? 5000.0 : 0.0)
            )).orElse(null);
            if (best != null) claimed.add(best.id);
        }

        List<BotIsland> remaining = uncaptured.stream()
            .filter(i -> !claimed.contains(i.id)).collect(Collectors.toList());
        List<BotIsland> pool = remaining.isEmpty() ? uncaptured : remaining;
        BotIsland target = pool.stream().min(Comparator.comparingDouble(i ->
            BotHelpers.distanceTo(ship, i) - ("enemy".equals(i.owner) ? 5000.0 : 0.0)
        )).orElse(null);
        return target != null ? Command.move(target.x, target.y) : Command.idle();
    }
}


// ─────────────────────────────────────────────
// 🟡 Balanced — adaptive retreat/assault/capture/defend
// ─────────────────────────────────────────────
class Bot {
    private final Map<Integer, String> shipMode  = new HashMap<>();
    private final Map<Integer, Integer> modeTimer = new HashMap<>();
    private static final int MODE_HOLD = 8;

    private String evalMode(GameState state, BotShip ship) {
        double r = state.config.attackRadius;
        double scoreDelta = state.myScore - state.enemyScore;
        boolean isBehind = scoreDelta < -100;
        int fightThreshold = isBehind ? 0 : 1;

        long nearFriends = Arrays.stream(state.myShips)
            .filter(s -> s.id != ship.id && s.alive && BotHelpers.distanceTo(ship, s) <= r).count();
        long nearEnemies = Arrays.stream(state.enemyShips)
            .filter(e -> e.alive && BotHelpers.distanceTo(ship, e) <= r).count();

        if (nearEnemies > nearFriends + 1) return "retreat";
        if (nearEnemies > 0 && nearFriends >= fightThreshold) return "assault";

        Optional<BotIsland> threatened = Arrays.stream(state.islands)
            .filter(i -> "me".equals(i.owner) && "enemy".equals(i.teamCapturing)).findFirst();
        if (threatened.isPresent()) {
            BotIsland nearest = threatened.get();
            boolean closerFriend = Arrays.stream(state.myShips)
                .anyMatch(s -> s.id != ship.id && s.alive &&
                    BotHelpers.distanceTo(s, nearest) < BotHelpers.distanceTo(ship, nearest));
            if (!closerFriend) return "defend";
        }
        return "capture";
    }

    Command tick(GameState state, BotShip ship) {
        if (!ship.alive) {
            shipMode.remove(ship.id);
            modeTimer.remove(ship.id);
            return Command.idle();
        }

        int tick = state.tick;
        double r = state.config.attackRadius;
        int heldFor = tick - modeTimer.getOrDefault(ship.id, -999);
        String newMode = evalMode(state, ship);
        if (!shipMode.containsKey(ship.id) || heldFor >= MODE_HOLD || "retreat".equals(newMode)) {
            shipMode.put(ship.id, newMode);
            modeTimer.put(ship.id, tick);
        }

        String mode = shipMode.get(ship.id);

        if ("retreat".equals(mode)) {
            Optional<BotShip> friend = Arrays.stream(state.myShips)
                .filter(s -> s.id != ship.id && s.alive)
                .min(Comparator.comparingDouble(s -> BotHelpers.distanceTo(ship, s)));
            return friend.map(f -> Command.move(f.x, f.y)).orElse(Command.idle());
        }

        if ("assault".equals(mode)) {
            Optional<BotShip> target = Arrays.stream(state.enemyShips)
                .filter(e -> e.alive)
                .min(Comparator.comparingDouble(e -> {
                    long ef = Arrays.stream(state.enemyShips).filter(x ->
                        x.id != e.id && x.alive && BotHelpers.distanceTo(e, x) <= r).count();
                    return ef * 10000.0 + BotHelpers.distanceTo(ship, e);
                }));
            if (target.isPresent()) return Command.move(target.get().x, target.get().y);
        }

        if ("defend".equals(mode)) {
            Optional<BotIsland> t = Arrays.stream(state.islands)
                .filter(i -> "me".equals(i.owner) && "enemy".equals(i.teamCapturing))
                .min(Comparator.comparingDouble(i -> BotHelpers.distanceTo(ship, i)));
            if (t.isPresent()) return Command.move(t.get().x, t.get().y);
        }

        BotIsland[] uncaptured = BotHelpers.islandsNotMine(state.islands);
        if (uncaptured.length == 0) {
            BotIsland[] mine = BotHelpers.islandsOwnedBy(state.islands, "me");
            if (mine.length > 0) {
                BotIsland best = Arrays.stream(mine).max(Comparator.comparingDouble(i -> i.value)).orElse(null);
                return best != null ? Command.move(best.x, best.y) : Command.idle();
            }
            return Command.idle();
        }

        BotIsland best = Arrays.stream(uncaptured).max(Comparator.comparingDouble(i -> {
            double dist    = BotHelpers.distanceTo(ship, i);
            double urgency = "enemy".equals(i.owner) ? 3000.0 : 0.0;
            double valB    = (i.value - 1) * 500.0;
            return urgency + valB - dist;
        })).orElse(null);
        return best != null ? Command.move(best.x, best.y) : Command.idle();
    }
}


// ─────────────────────────────────────────────
// 🔴 Admiral — 3-phase state machine with per-ship roles
// ─────────────────────────────────────────────
class Bot {
    private final Map<Integer, String> roles      = new HashMap<>();
    private final Map<Integer, Integer> targetIds = new HashMap<>();
    private int lastRoleUpdate = -50;
    private static final int ROLE_UPDATE_INTERVAL = 20;

    private String getPhase(int tick, int maxTicks) {
        double pct = (double) tick / maxTicks;
        if (pct < 0.28) return "expand";
        if (pct < 0.67) return "consolidate";
        return "endgame";
    }

    private void assignRoles(GameState state) {
        String phase = getPhase(state.tick, state.maxTicks);
        List<BotShip> alive = Arrays.stream(state.myShips).filter(s -> s.alive)
            .sorted(Comparator.comparingInt(s -> s.id)).collect(Collectors.toList());
        BotIsland[] myIslandsArr   = BotHelpers.islandsOwnedBy(state.islands, "me");
        List<BotIsland> myIslands  = Arrays.asList(myIslandsArr);
        List<BotIsland> uncaptured = Arrays.asList(BotHelpers.islandsNotMine(state.islands));
        double scoreDelta = state.myScore - state.enemyScore;
        boolean isAhead   = scoreDelta > 150;

        Map<Integer, String>  newRoles = new HashMap<>();
        Map<Integer, Integer> newIds   = new HashMap<>();

        if ("expand".equals(phase)) {
            Set<Integer> claimed = new HashSet<>();
            for (BotShip sh : alive) {
                List<BotIsland> pool = uncaptured.stream()
                    .filter(i -> !claimed.contains(i.id)).collect(Collectors.toList());
                if (pool.isEmpty()) { newRoles.put(sh.id, "idle"); newIds.put(sh.id, null); continue; }
                BotIsland best = pool.stream().min(Comparator.comparingDouble(i ->
                    BotHelpers.distanceTo(sh, i) - ("enemy".equals(i.owner) ? 2000.0 : 0.0)
                )).orElse(null);
                if (best != null) { claimed.add(best.id); newRoles.put(sh.id, "capturer"); newIds.put(sh.id, best.id); }
            }
        } else if ("consolidate".equals(phase)) {
            int defCount = 0;
            for (BotShip sh : alive) {
                if (defCount < myIslands.size() * 1.5 && !myIslands.isEmpty()) {
                    Map<Integer, Integer> finalNewIds = newIds;
                    List<BotIsland> notDoubled = myIslands.stream()
                        .filter(i -> finalNewIds.values().stream().filter(v -> v != null && v.equals(i.id)).count() < 2)
                        .collect(Collectors.toList());
                    if (!notDoubled.isEmpty()) {
                        BotIsland t = notDoubled.stream().min(Comparator.comparingDouble(i ->
                            BotHelpers.distanceTo(sh, i))).orElse(null);
                        if (t != null) { newRoles.put(sh.id, "defender"); newIds.put(sh.id, t.id); defCount++; continue; }
                    }
                }
                if (!uncaptured.isEmpty()) {
                    BotIsland best = uncaptured.stream().min(Comparator.comparingDouble(i ->
                        BotHelpers.distanceTo(sh, i) - ("enemy".equals(i.owner) ? 3000.0 : 0.0)
                    )).orElse(null);
                    if (best != null) { newRoles.put(sh.id, "attacker"); newIds.put(sh.id, best.id); }
                } else { newRoles.put(sh.id, "idle"); newIds.put(sh.id, null); }
            }
        } else { // endgame
            if (isAhead) {
                for (BotShip sh : alive) {
                    BotIsland t = myIslands.stream()
                        .min(Comparator.comparingDouble(i -> BotHelpers.distanceTo(sh, i))).orElse(null);
                    newRoles.put(sh.id, "defender");
                    newIds.put(sh.id, t != null ? t.id : null);
                }
            } else {
                List<BotIsland> enemyIsl = Arrays.asList(BotHelpers.islandsOwnedBy(state.islands, "enemy"));
                BotIsland target = enemyIsl.stream().max(Comparator.comparingDouble(i -> i.value)).orElse(null);
                for (BotShip sh : alive) {
                    newRoles.put(sh.id, "attacker");
                    newIds.put(sh.id, target != null ? target.id : null);
                }
            }
        }

        roles.putAll(newRoles);
        targetIds.putAll(newIds);
    }

    Command tick(GameState state, BotShip ship) {
        if (!ship.alive) { roles.remove(ship.id); targetIds.remove(ship.id); return Command.idle(); }

        if (state.tick - lastRoleUpdate >= ROLE_UPDATE_INTERVAL) {
            assignRoles(state);
            lastRoleUpdate = state.tick;
        }

        String role     = roles.getOrDefault(ship.id, "idle");
        Integer tId     = targetIds.getOrDefault(ship.id, null);
        double r        = state.config.attackRadius;

        if ("defender".equals(role) && tId != null) {
            Optional<BotIsland> island = Arrays.stream(state.islands).filter(i -> i.id == tId).findFirst();
            if (island.isPresent()) {
                BotIsland isl = island.get();
                if ("enemy".equals(isl.teamCapturing)) return Command.move(isl.x, isl.y);
                double angle = state.tick * 0.03 + ship.id;
                double ox = isl.x + Math.cos(angle) * isl.radius * 0.8;
                double oy = isl.y + Math.sin(angle) * isl.radius * 0.8;
                return Command.move(ox, oy);
            }
        }

        if ("attacker".equals(role) && tId != null) {
            Optional<BotIsland> island = Arrays.stream(state.islands).filter(i -> i.id == tId).findFirst();
            if (island.isPresent()) {
                BotIsland isl = island.get();
                long nearFriends = Arrays.stream(state.myShips)
                    .filter(s -> s.id != ship.id && s.alive && BotHelpers.distanceTo(ship, s) <= r).count();
                long nearEnemies = Arrays.stream(state.enemyShips)
                    .filter(e -> e.alive && BotHelpers.distanceTo(ship, e) <= r).count();
                if (nearEnemies > nearFriends + 2) {
                    Optional<BotShip> fallback = Arrays.stream(state.myShips)
                        .filter(s -> s.id != ship.id && s.alive)
                        .min(Comparator.comparingDouble(s -> BotHelpers.distanceTo(ship, s)));
                    return fallback.map(f -> Command.move(f.x, f.y)).orElse(Command.idle());
                }
                return Command.move(isl.x, isl.y);
            }
        }

        if ("capturer".equals(role) && tId != null) {
            Optional<BotIsland> island = Arrays.stream(state.islands)
                .filter(i -> i.id == tId && !"me".equals(i.owner)).findFirst();
            if (island.isPresent()) return Command.move(island.get().x, island.get().y);
            BotIsland fallback = BotHelpers.nearestIsland(ship, BotHelpers.islandsNotMine(state.islands));
            if (fallback != null) return Command.move(fallback.x, fallback.y);
        }

        BotIsland unc = BotHelpers.nearestIsland(ship, BotHelpers.islandsNotMine(state.islands));
        if (unc != null) return Command.move(unc.x, unc.y);
        BotIsland mine = BotHelpers.nearestIsland(ship, BotHelpers.islandsOwnedBy(state.islands, "me"));
        if (mine != null) return Command.move(mine.x, mine.y);
        return Command.idle();
    }
}
