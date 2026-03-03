# 🏴‍☠️ Bots Battle — Engine Architecture

The engine is a **pure TypeScript, zero-React** game simulation. It owns all mutable game state, enforces all rules, and emits deep-cloned snapshots to React subscribers after every tick.

## Module Map

```
src/engine/
├── GameEngine.ts   — Main orchestrator: tick loop, lifecycle, bot runner
├── types.ts        — All types & interfaces (internal + bot-facing + config)
├── combat.ts       — Head-on collision detection & per-ship radius combat
├── capture.ts      — Island capture timer logic
├── map.ts          — Map and spawn point generation
├── scoring.ts      — Exponential scoring formula & helpers
└── helpers.ts      — Pure bot-facing utility functions (injected into bot scope)
```

---

## Type System (Two-Layer Design)

The engine uses two parallel sets of types to keep internal logic clean and bot APIs ergonomic:

| Layer      | Owner type                                    | Perspective | Used in                             |
| ---------- | --------------------------------------------- | ----------- | ----------------------------------- |
| Internal   | `Owner = "player1" \| "player2" \| "neutral"` | Absolute    | `Ship`, `Island`, `FullGameState`   |
| Bot-facing | `BotOwner = "me" \| "enemy" \| "neutral"`     | Relative    | `BotShip`, `BotIsland`, `GameState` |

Before calling `bot.tick()`, `GameEngine` translates every `"player1"`/`"player2"` to `"me"`/`"enemy"` from that bot's perspective. Bots never see raw player IDs.

---

## Tick Lifecycle

Each tick executes these phases **in strict order**. The phases are numbered for reference; they match the comments in `GameEngine.ts`.

```
tick N
  │
  ├─ 1. runBots()
  │      For each player: build bot-facing GameState → call bot.tick(state, ship)
  │      per alive ship → store Commands in pendingCommands map.
  │      Dead ships → idle command (safe default).
  │      Bot exceptions are caught; offending ship gets idle.
  │
  ├─ 2. moveShips()
  │      For each alive ship with a 'move' command:
  │        • Normalize direction vector → advance by shipSpeed (or snap to target)
  │        • Enforce safe zone: P1 cannot cross into P2's zone, vice versa
  │        • Clamp to map bounds
  │
  ├─ 3. resolveCollisions()  [combat.ts]
  │      O(n²) check: any two enemy ships within 1 unit → both die instantly.
  │      Applied before radius combat so collisions take priority.
  │
  ├─ 4. resolveCombat()  [combat.ts]
  │      For each alive ship: count friendlies vs. enemies within attackRadius.
  │      If enemies > friendlies → mark for death.
  │      All deaths applied simultaneously (order-independent).
  │      Ships near islands (isCapturing) participate normally — no exemptions.
  │
  ├─ 5. markCapturingShips()
  │      Set ship.isCapturing = true if within ANY island's captureRadius.
  │      This is a TRACKING flag only — does not gate combat or scoring.
  │      Cleared for dead ships.
  │
  ├─ 6. resolveCaptureProgress()  [capture.ts]
  │      For each island:
  │        • Count alive P1 / P2 ships within captureRadius
  │        • Both present → contested, progress paused
  │        • None present  → abandoned, progress reset to 0
  │        • One team only → advance that team's progress by 1 tick
  │          - Neutral: needs captureTurns ticks → transfer ownership
  │          - Enemy:   needs captureTurns (neutralize) + captureTurns (claim) = 2×
  │
  ├─ 7. processRespawns()  [combat.ts]
  │      Decrement turnsToRevive on all dead ships.
  │      Ships reaching 0 → alive=true, position reset to initialX/initialY.
  │
  ├─ 8. applyScoreTick()  [scoring.ts]
  │      For each player: totalIslandValue → pointsPerTick → add to cumulative score.
  │      Formula: 2^(totalValue - 1) pts/tick  (0 if no islands held)
  │      Updates PlayerState.score, .lastTickPoints, .islandsHeld.
  │
  └─ 9. checkWin()
         Score win: player reaches targetScore → game over immediately.
         If both hit it the same tick, higher score wins (tie → player1).
         Timeout win: tick >= gameDuration → highest score wins; equal = draw.
         Sets state.status = "finished", state.result = { winner, condition, … }.
         Clears the tick interval.

         emit() → deep-clone → notify all onTick() listeners
```

---

## Combat System

Located in `combat.ts`. Two independent mechanisms run every tick:

### 1. Head-On Collision (`resolveCollisions`)

- Runs **after movement, before radius combat**
- Any two enemy ships within 1 unit of each other → both destroyed
- Same-team ships pass through each other freely

### 2. Per-Ship Radius Combat (`resolveCombat`)

- Runs after collision detection
- For each alive ship: count friendly ships vs. enemy ships within `attackRadius`
- `enemies > friendlies` → ship is marked for destruction
- **All kills are simultaneous** — determined first, applied all at once
- `isCapturing` does NOT exclude ships from combat; ships on islands fight normally

**Key insight:** Grouping ships provides mutual protection. A lone ship dies 1v1; two ships together survive against a lone enemy.

---

## Capture System

Located in `capture.ts`. Island capture uses a tick-counter system:

| Scenario                         | Result                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| No ships near island             | Reset progress to 0 (abandonment penalty)                                            |
| Both teams present               | Contested — progress frozen for everyone                                             |
| One team, attacking neutral      | Progress advances; at `captureTurns` → ownership transfers                           |
| One team, attacking enemy island | Progress advances; at `captureTurns` → neutralized; at `captureTurns * 2` → captured |
| Owning team returns alone        | Attacker progress reset to 0                                                         |

The `isCapturing` flag on each ship is set **before** `resolveCaptureProgress` runs (Phase 5), so the capture logic can use it for tracking. The flag does not influence combat (Phase 4 already ran).

---

## Scoring System

Located in `scoring.ts`. Exponential scoring rewards holding multiple islands:

```
pointsPerTick(totalValue) = 2^(totalValue - 1)
```

Where `totalValue = Σ island.value` for all owned islands. Normal islands have `value = 1`; treasure islands have `value ≥ 2` (they count as multiple in the exponent).

| Islands held | Points/tick |
| ------------ | ----------- |
| 0            | 0           |
| 1            | 1           |
| 2            | 2           |
| 3            | 4           |
| 4            | 8           |
| 5            | 16          |

This creates dramatic momentum swings — controlling the majority of islands accelerates victory exponentially.

---

## Map Generation

Located in `map.ts`. Islands are placed **symmetrically** so both players face an identical layout:

1. Compute playable area (excluding safe zones + edge margins)
2. For even `numIslands`: place N/2 islands in the left half, mirror each to the right
3. For odd `numIslands`: N-1 mirrored pairs + one center island
4. Minimum spacing enforced between all islands (`captureRadius × 3`)
5. If placement fails after 2000 attempts, fallback to unconstrained placement

Spawn points are distributed evenly across the map height within each player's safe zone (P1 left, P2 right).

---

## Bot Execution

`GameEngine.runBots()` (Phase 1) builds a bot-facing `GameState` per player, then calls `bot.tick(state, ship)` once per alive ship. The tick() call is wrapped in `try/catch` — any exception results in an `idle` command for that ship, keeping the game running.

Bots run **synchronously** in the main engine tick (no Workers in the engine itself). The `botSandbox.ts` worker layer in `src/lib/` handles sandboxing for player-submitted code.

---

## Lifecycle API

```typescript
const engine = new GameEngine(bot1Factory, bot2Factory, configOverride?);

engine.start();       // → status: "running", starts setInterval
engine.pause();       // → status: "paused",  clears interval
engine.resume();      // → status: "running", restarts interval
engine.stop();        // → status: "idle",    clears interval, keeps state
engine.reset(config?) // → status: "idle",    fresh map + bots

engine.stepTick();    // Execute exactly one tick (for tests/replays)
engine.getState();    // Deep-cloned FullGameState snapshot

const unsub = engine.onTick(state => render(state));
unsub(); // Remove listener
```

---

## Key Design Decisions

| Decision                                  | Rationale                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| Deep clone on emit                        | Subscribers can freely mutate their snapshot without corrupting engine state                |
| Simultaneous kills                        | Prevents iteration-order bias in combat; mirrors the original Pirates game                  |
| `isCapturing` as tracking flag only       | Simplifies combat (no special cases); forces strategic decisions purely through positioning |
| Abandonment resets progress               | Prevents "dip in, dip out" capture exploits; forces commitment                              |
| Symmetric map generation                  | Both players face the same strategic landscape regardless of which side they start on       |
| Pure functions for combat/capture/scoring | Each phase is independently testable; engine is the only stateful entity                    |
