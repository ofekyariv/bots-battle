// @language: swift
// ============================================================
// 🏴☠️ Bots Battle — Swift Sample Bots
// ============================================================
// Copy any of these into the editor and press "Use in Battle".
// All helper functions are available as free functions.
// ============================================================

// ─────────────────────────────────────────────
// 🟢 Rusher — greedy island spreader
// ─────────────────────────────────────────────
func tick(_ state: GameState, _ ship: BotShip) -> Command {
    guard ship.alive else { return .idle }

    let uncaptured = islandsOwnedBy(state.islands, "enemy") + islandsOwnedBy(state.islands, "neutral")

    if uncaptured.isEmpty {
        let contested = state.islands.filter { $0.owner == "me" && $0.teamCapturing == "enemy" }
        if let t = nearestIsland(ship, contested) { return .move(x: t.x, y: t.y) }
        let mine = islandsOwnedBy(state.islands, "me")
        if let t = nearestIsland(ship, mine) { return .move(x: t.x, y: t.y) }
        return .idle
    }

    func score(_ island: Island, from fromShip: BotShip) -> Double {
        distanceTo(fromShip, island) - (island.owner == "enemy" ? 5000 : 0)
    }

    let alive  = state.myShips.filter { $0.alive }.sorted { $0.id < $1.id }
    guard let myRank = alive.firstIndex(where: { $0.id == ship.id }) else { return .idle }

    var claimed = Set<Int>()
    for r in 0..<myRank {
        let other = alive[r]
        let pool  = uncaptured.filter { !claimed.contains($0.id) }
        guard !pool.isEmpty else { break }
        let best  = pool.min(by: { score($0, from: other) < score($1, from: other) })!
        claimed.insert(best.id)
    }

    let remaining = uncaptured.filter { !claimed.contains($0.id) }
    let pool      = remaining.isEmpty ? uncaptured : remaining
    guard let target = pool.min(by: { score($0, from: ship) < score($1, from: ship) }) else { return .idle }
    return .move(x: target.x, y: target.y)
}


// ─────────────────────────────────────────────
// 🟡 Balanced — adaptive retreat/assault/capture/defend
// ─────────────────────────────────────────────
func tick(_ state: GameState, _ ship: BotShip) -> Command {
    guard ship.alive else { return .idle }

    let r          = state.config.attackRadius
    let scoreDelta = state.myScore - state.enemyScore
    let isBehind   = scoreDelta < -100.0
    let fightThr   = isBehind ? 0 : 1

    let nearFriends = state.myShips.filter { $0.id != ship.id && $0.alive && distanceTo(ship, $0) <= r }.count
    let nearEnemies = state.enemyShips.filter { $0.alive && distanceTo(ship, $0) <= r }.count

    // Retreat — badly outnumbered
    if nearEnemies > nearFriends + 1 {
        if let t = state.myShips.filter({ $0.id != ship.id && $0.alive })
                                .min(by: { distanceTo(ship, $0) < distanceTo(ship, $1) }) {
            return .move(x: t.x, y: t.y)
        }
        return .idle
    }

    // Assault — safe to fight
    if nearEnemies > 0 && nearFriends >= fightThr {
        if let target = state.enemyShips.filter({ $0.alive }).min(by: { a, b in
            let aFriends = state.enemyShips.filter { $0.id != a.id && $0.alive && distanceTo(a, $0) <= r }.count
            let bFriends = state.enemyShips.filter { $0.id != b.id && $0.alive && distanceTo(b, $0) <= r }.count
            if aFriends != bFriends { return aFriends < bFriends }
            return distanceTo(ship, a) < distanceTo(ship, b)
        }) {
            return .move(x: target.x, y: target.y)
        }
    }

    // Defend threatened island
    let threatened = state.islands.filter { $0.owner == "me" && $0.teamCapturing == "enemy" }
    if let nearest = threatened.min(by: { distanceTo(ship, $0) < distanceTo(ship, $1) }) {
        let closerFriend = state.myShips.contains { s in
            s.id != ship.id && s.alive && distanceTo(s, nearest) < distanceTo(ship, nearest)
        }
        if !closerFriend { return .move(x: nearest.x, y: nearest.y) }
    }

    // Capture
    let uncaptured = islandsNotMine(state.islands)
    if uncaptured.isEmpty {
        if let best = islandsOwnedBy(state.islands, "me").max(by: { $0.value < $1.value }) {
            return .move(x: best.x, y: best.y)
        }
        return .idle
    }

    guard let best = uncaptured.max(by: { a, b in
        func captureScore(_ i: Island) -> Double {
            let dist    = distanceTo(ship, i)
            let urgency = i.owner == "enemy" ? 3000.0 : 0.0
            let valB    = Double(i.value - 1) * 500.0
            return urgency + valB - dist
        }
        return captureScore(a) < captureScore(b)
    }) else { return .idle }
    return .move(x: best.x, y: best.y)
}


// ─────────────────────────────────────────────
// 🔴 Admiral — 3-phase state machine with per-ship roles
// ─────────────────────────────────────────────
// Note: Persistent state requires class-level storage in Swift sandbox.
// This version computes roles each tick for clarity.
func tick(_ state: GameState, _ ship: BotShip) -> Command {
    guard ship.alive else { return .idle }

    let maxTicks = Double(state.maxTicks)
    let pct      = Double(state.tick) / maxTicks
    let phase    = pct < 0.28 ? "expand" : pct < 0.67 ? "consolidate" : "endgame"
    let r        = state.config.attackRadius
    let myIslands   = islandsOwnedBy(state.islands, "me")
    let uncaptured  = islandsNotMine(state.islands)
    let isAhead     = (state.myScore - state.enemyScore) > 150.0
    let alive       = state.myShips.filter { $0.alive }.sorted { $0.id < $1.id }

    switch phase {
    case "expand":
        // Each ship greedily claims an uncaptured island
        let priorShips = alive.filter { $0.id < ship.id }
        var claimed = Set<Int>()
        for s in priorShips {
            if let best = uncaptured.filter({ !claimed.contains($0.id) })
                .min(by: { distanceTo(s, $0) - ($0.owner == "enemy" ? 2000 : 0) <
                           distanceTo(s, $1) - ($1.owner == "enemy" ? 2000 : 0) }) {
                claimed.insert(best.id)
            }
        }
        let pool = uncaptured.filter { !claimed.contains($0.id) }
        guard let target = (pool.isEmpty ? uncaptured : pool)
            .min(by: { distanceTo(ship, $0) < distanceTo(ship, $1) })
        else { return .idle }
        return .move(x: target.x, y: target.y)

    case "consolidate":
        // Half ships defend, half attack
        guard let rank = alive.firstIndex(where: { $0.id == ship.id }) else { return .idle }
        let defSlots = Int(Double(myIslands.count) * 1.5)
        if rank < defSlots, let island = myIslands.min(by: { distanceTo(ship, $0) < distanceTo(ship, $1) }) {
            if island.teamCapturing == "enemy" { return .move(x: island.x, y: island.y) }
            let angle = Double(state.tick) * 0.03 + Double(ship.id)
            return .move(x: island.x + cos(angle) * island.radius * 0.8,
                         y: island.y + sin(angle) * island.radius * 0.8)
        }
        guard let target = uncaptured.min(by: {
            distanceTo(ship, $0) - ($0.owner == "enemy" ? 3000 : 0) <
            distanceTo(ship, $1) - ($1.owner == "enemy" ? 3000 : 0)
        }) else { return .idle }
        return .move(x: target.x, y: target.y)

    default: // endgame
        if isAhead {
            guard let island = myIslands.min(by: { distanceTo(ship, $0) < distanceTo(ship, $1) }) else { return .idle }
            if island.teamCapturing == "enemy" { return .move(x: island.x, y: island.y) }
            let angle = Double(state.tick) * 0.03 + Double(ship.id)
            return .move(x: island.x + cos(angle) * island.radius * 0.8,
                         y: island.y + sin(angle) * island.radius * 0.8)
        } else {
            let enemyIsl = islandsOwnedBy(state.islands, "enemy")
            guard let target = (enemyIsl.max(by: { $0.value < $1.value })
                            ?? uncaptured.min(by: { distanceTo(ship, $0) < distanceTo(ship, $1) }))
            else { return .idle }
            let nf = state.myShips.filter { $0.id != ship.id && $0.alive && distanceTo(ship, $0) <= r }.count
            let ne = state.enemyShips.filter { $0.alive && distanceTo(ship, $0) <= r }.count
            if ne > nf + 2,
               let fallback = state.myShips.filter({ $0.id != ship.id && $0.alive })
                                           .min(by: { distanceTo(ship, $0) < distanceTo(ship, $1) }) {
                return .move(x: fallback.x, y: fallback.y)
            }
            return .move(x: target.x, y: target.y)
        }
    }
}
