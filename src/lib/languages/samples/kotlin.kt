// @language: kotlin
// ============================================================
// 🏴☠️ Bots Battle — Kotlin Sample Bots
// ============================================================
// Copy any of these into the editor and press "Use in Battle".
// All helper functions (camelCase) are available globally.
// Kotlin uses a top-level tick() function (no createBot wrapper).
// ============================================================

// ─────────────────────────────────────────────
// 🟢 Rusher — greedy island spreader
// ─────────────────────────────────────────────

fun tick(state: dynamic, ship: dynamic): dynamic {
    if (!(ship.alive as Boolean)) return idle()

    val enemyIsl  = islandsOwnedBy(state.islands, "enemy")
    val neutralIsl = islandsOwnedBy(state.islands, "neutral")
    val uncaptured = (enemyIsl as List<dynamic>) + (neutralIsl as List<dynamic>)

    if (uncaptured.isEmpty()) {
        val contested = (state.islands as List<dynamic>).filter {
            it.owner == "me" && it.teamCapturing == "enemy"
        }
        if (contested.isNotEmpty()) {
            val t = contested.minByOrNull { distanceTo(ship, it) }!!
            return moveTo(t.x as Double, t.y as Double)
        }
        val mine = islandsOwnedBy(state.islands, "me") as List<dynamic>
        if (mine.isNotEmpty()) {
            val t = mine.minByOrNull { distanceTo(ship, it) }!!
            return moveTo(t.x as Double, t.y as Double)
        }
        return idle()
    }

    fun score(island: dynamic, fromShip: dynamic): Double =
        distanceTo(fromShip, island) - (if (island.owner == "enemy") 5000.0 else 0.0)

    val alive = (state.myShips as List<dynamic>).filter { it.alive as Boolean }
        .sortedBy { it.id as Int }
    val myRank = alive.indexOfFirst { it.id == ship.id }
    if (myRank == -1) return idle()

    val claimed = mutableSetOf<Int>()
    for (r in 0 until myRank) {
        val other = alive[r]
        val pool = uncaptured.filter { it.id as Int !in claimed }
        if (pool.isEmpty()) break
        val best = pool.minByOrNull { score(it, other) }!!
        claimed.add(best.id as Int)
    }

    val remaining = uncaptured.filter { it.id as Int !in claimed }
    val pool = if (remaining.isNotEmpty()) remaining else uncaptured
    val target = pool.minByOrNull { score(it, ship) }!!
    return moveTo(target.x as Double, target.y as Double)
}


// ─────────────────────────────────────────────
// 🟡 Balanced — adaptive retreat/assault/capture/defend
// ─────────────────────────────────────────────

fun tick(state: dynamic, ship: dynamic): dynamic {
    // Per-bot persistent state stored in closure at createBot level.
    // In Kotlin sandbox, use top-level mutable maps declared before tick().
    if (!(ship.alive as Boolean)) return idle()

    val r = state.config.attackRadius as Double
    val scoreDelta = (state.myScore as Double) - (state.enemyScore as Double)
    val isBehind = scoreDelta < -100.0
    val fightThreshold = if (isBehind) 0 else 1

    val nearFriends = (state.myShips as List<dynamic>).count {
        it.id != ship.id && (it.alive as Boolean) && distanceTo(ship, it) <= r
    }
    val nearEnemies = (state.enemyShips as List<dynamic>).count {
        (it.alive as Boolean) && distanceTo(ship, it) <= r
    }

    // Retreat — badly outnumbered
    if (nearEnemies > nearFriends + 1) {
        val friends = (state.myShips as List<dynamic>).filter { it.id != ship.id && (it.alive as Boolean) }
        if (friends.isNotEmpty()) {
            val t = friends.minByOrNull { distanceTo(ship, it) }!!
            return moveTo(t.x as Double, t.y as Double)
        }
        return idle()
    }

    // Assault — safe to fight
    if (nearEnemies > 0 && nearFriends >= fightThreshold) {
        val fightable = (state.enemyShips as List<dynamic>).filter { it.alive as Boolean }
        if (fightable.isNotEmpty()) {
            val target = fightable.minByOrNull { e ->
                val eNearFriends = (state.enemyShips as List<dynamic>).count {
                    it.id != e.id && (it.alive as Boolean) && distanceTo(e, it) <= r
                }
                eNearFriends * 10000.0 + distanceTo(ship, e)
            }!!
            return moveTo(target.x as Double, target.y as Double)
        }
    }

    // Defend threatened island
    val threatened = (state.islands as List<dynamic>).filter {
        it.owner == "me" && it.teamCapturing == "enemy"
    }
    if (threatened.isNotEmpty()) {
        val nearest = threatened.minByOrNull { distanceTo(ship, it) }!!
        val freeTeam = (state.myShips as List<dynamic>).filter { it.id != ship.id && (it.alive as Boolean) }
        val closerFriend = freeTeam.any { distanceTo(it, nearest) < distanceTo(ship, nearest) }
        if (!closerFriend) {
            return moveTo(nearest.x as Double, nearest.y as Double)
        }
    }

    // Capture
    val uncaptured = islandsNotMine(state.islands) as List<dynamic>
    if (uncaptured.isEmpty()) {
        val mine = islandsOwnedBy(state.islands, "me") as List<dynamic>
        if (mine.isNotEmpty()) {
            val best = mine.maxByOrNull { it.value as Double }!!
            return moveTo(best.x as Double, best.y as Double)
        }
        return idle()
    }

    val best = uncaptured.maxByOrNull { i ->
        val dist    = distanceTo(ship, i)
        val urgency = if (i.owner == "enemy") 3000.0 else 0.0
        val valB    = ((i.value as Double) - 1.0) * 500.0
        urgency + valB - dist
    }!!
    return moveTo(best.x as Double, best.y as Double)
}


// ─────────────────────────────────────────────
// 🔴 Admiral — 3-phase state machine with per-ship roles
// ─────────────────────────────────────────────

fun tick(state: dynamic, ship: dynamic): dynamic {
    // Persistent state: declare these as top-level vars before tick() in editor
    // val roles = mutableMapOf<Int, Pair<String, Int?>>()
    // var lastRoleUpdate = -50; val INTERVAL = 20
    //
    // Shown here as a self-contained stateless approximation for reference.
    if (!(ship.alive as Boolean)) return idle()

    val maxTicks  = state.maxTicks as Double
    val pct       = (state.tick as Double) / maxTicks
    val phase     = if (pct < 0.28) "expand" else if (pct < 0.67) "consolidate" else "endgame"
    val r         = state.config.attackRadius as Double
    val myIslands = islandsOwnedBy(state.islands, "me") as List<dynamic>
    val uncaptured = islandsNotMine(state.islands) as List<dynamic>
    val scoreDelta = (state.myScore as Double) - (state.enemyScore as Double)
    val isAhead   = scoreDelta > 150.0
    val alive     = (state.myShips as List<dynamic>).filter { it.alive as Boolean }.sortedBy { it.id as Int }

    when (phase) {
        "expand" -> {
            // Greedy spread: this ship picks the unclaimed island nearest to it
            val taken = alive.filter { (it.id as Int) < (ship.id as Int) }
            val claimed = taken.mapNotNull { s ->
                uncaptured.minByOrNull { distanceTo(s, it) - (if (it.owner == "enemy") 2000.0 else 0.0) }?.id as? Int
            }.toSet()
            val pool = uncaptured.filter { it.id as Int !in claimed }
            val target = (if (pool.isNotEmpty()) pool else uncaptured)
                .minByOrNull { distanceTo(ship, it) - (if (it.owner == "enemy") 2000.0 else 0.0) }
                ?: return idle()
            return moveTo(target.x as Double, target.y as Double)
        }
        "consolidate" -> {
            // Half ships defend, half attack
            val rank = alive.indexOfFirst { it.id == ship.id }
            val defSlots = (myIslands.size * 1.5).toInt()
            if (rank < defSlots && myIslands.isNotEmpty()) {
                val t = myIslands.minByOrNull { distanceTo(ship, it) }!!
                if ((t.teamCapturing as String) == "enemy") {
                    return moveTo(t.x as Double, t.y as Double)
                }
                val angle = (state.tick as Double) * 0.03 + (ship.id as Double)
                val ox = (t.x as Double) + kotlin.math.cos(angle) * (t.radius as Double) * 0.8
                val oy = (t.y as Double) + kotlin.math.sin(angle) * (t.radius as Double) * 0.8
                return moveTo(ox, oy)
            }
            val target = uncaptured.minByOrNull {
                distanceTo(ship, it) - (if (it.owner == "enemy") 3000.0 else 0.0)
            } ?: return idle()
            return moveTo(target.x as Double, target.y as Double)
        }
        else -> { // endgame
            return if (isAhead) {
                val t = myIslands.minByOrNull { distanceTo(ship, it) }
                    ?: return idle()
                if ((t.teamCapturing as String) == "enemy") {
                    moveTo(t.x as Double, t.y as Double)
                } else {
                    val angle = (state.tick as Double) * 0.03 + (ship.id as Double)
                    moveTo(
                        (t.x as Double) + kotlin.math.cos(angle) * (t.radius as Double) * 0.8,
                        (t.y as Double) + kotlin.math.sin(angle) * (t.radius as Double) * 0.8
                    )
                }
            } else {
                val enemyIsl = islandsOwnedBy(state.islands, "enemy") as List<dynamic>
                val target = enemyIsl.maxByOrNull { it.value as Double }
                    ?: uncaptured.minByOrNull { distanceTo(ship, it) }
                    ?: return idle()
                val nearFriends = (state.myShips as List<dynamic>).count {
                    it.id != ship.id && (it.alive as Boolean) && distanceTo(ship, it) <= r
                }
                val nearEnemies = (state.enemyShips as List<dynamic>).count {
                    (it.alive as Boolean) && distanceTo(ship, it) <= r
                }
                if (nearEnemies > nearFriends + 2) {
                    val friends = (state.myShips as List<dynamic>).filter { it.id != ship.id && (it.alive as Boolean) }
                    val fallback = friends.minByOrNull { distanceTo(ship, it) } ?: return idle()
                    moveTo(fallback.x as Double, fallback.y as Double)
                } else {
                    moveTo(target.x as Double, target.y as Double)
                }
            }
        }
    }
}
