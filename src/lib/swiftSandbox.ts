// ============================================================
// 🦅 Bots Battle — Swift Bot Sandbox
// ============================================================
//
// Compiles and runs Swift bot code via the Godbolt (Compiler Explorer) API.
// Godbolt is free, no auth required, and provides CORS: * so it works
// directly from the browser.
//
// Flow:
//   1. Wrap user's Swift code with Bot API type definitions + a main
//      section that reads game state from stdin and prints commands.
//   2. On initFromCode(): POST to Godbolt to validate compilation.
//      A test tick with a dummy state is run to catch runtime errors too.
//   3. On tick(): a batch call processes ALL ships in one API call.
//      The result is cached; tick() returns the last cached command
//      immediately while the async API call updates the cache.
//
// Swift bot pattern:
//   Users write a top-level function:
//     func tick(_ state: GameState, _ ship: BotShip) -> Command { ... }
//
//   Available helpers (no imports needed):
//     distanceTo(_:_:)       — Euclidean distance between points/ships/islands
//     angleTo(_:_:)          — Angle in radians
//     nearestIsland(_:_:)    — Nearest island (or nil)
//     nearestEnemy(_:_:)     — Nearest alive enemy (or nil)
//     islandsOwnedBy(_:_:)   — Filter islands by "me" | "enemy" | "neutral"
//     islandsNotMine(_:)     — Islands not owned by "me"
//     aliveShips(_:)         — Filter to alive ships
//     freeShips(_:)          — Alive ships NOT capturing
//     shipsNear(_:_:_:_:)    — Ships within radius of a point
//     aliveCount(_:)         — Count alive ships
//     wouldDieAt(_:_:_:_:_:) — Predict if position is fatal
//     scoreRate(_:)          — Points per tick for total island value held
//     Command.moveTo(_:_:)   — Create a move command
//     Command.idle()         — Create an idle command
//
// Async / latency notes:
//   - One Wandbox API call is made per batch interval (~600 ms default).
//   - While the call is in flight, tick() returns the last cached result.
//   - After the initial warmup call completes, commands reflect state
//     that is typically 5–15 ticks stale at 120 ms/tick.
//   - Swift bots therefore react more slowly than JS/Python/Kotlin bots —
//     this is a known limitation of the remote-execution model.
//
// Privacy note:
//   Bot source code is sent to https://godbolt.org for compilation.
//   This is the same class of trade-off as the Kotlin (JetBrains) and
//   Java (Wandbox) sandboxes.
// ============================================================

import type { BotShip, Command, GameState } from '@/engine/types';
import { buildSwiftHelpers } from '@/lib/languages/codegen';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

// Godbolt (Compiler Explorer) — CORS: *, no auth required
// Swift 6.0.3 x86-64 is reliably available and executes in ~1.5s.
const GODBOLT_API = 'https://godbolt.org/api/compiler/swift603/compile';
const COMPILE_TIMEOUT_MS = 45_000; // Swift compile + link can take ~5s cold-start

/**
 * Minimum milliseconds between Godbolt API calls.
 * A new batch is fired at most once per this interval.
 */
const BATCH_INTERVAL_MS = 800; // one Godbolt round-trip every 800 ms

// ─────────────────────────────────────────────
// Swift code wrapper
// ─────────────────────────────────────────────
// Provides:
//   • BotShip, BotIsland, GameState structs
//   • Command enum with idle/move cases
//   • Built-in geometry + game helpers (generated from language registry)
//   • Main section that parses key=value stdin and calls tick() per ship
//
// To add a new helper: add it to engine/helpers.ts + languages/helpers.ts + codegen.ts.
// This sandbox file does NOT need to be edited.
// ─────────────────────────────────────────────

// Generated once at module load from the language registry.
const SWIFT_HELPERS_BLOCK = buildSwiftHelpers();

function wrapSwiftCode(userCode: string): string {
  return `// ── Foundation for readLine() ─────────────────────────────────────────────
import Foundation

// ── Bot API Types ──────────────────────────────────────────────────────────

struct BotShip {
    let id: Int
    let x: Double
    let y: Double
    let alive: Bool
    let isCapturing: Bool
    let turnsToRevive: Int
    let initialX: Double
    let initialY: Double
    let combatPressure: Int
}

struct BotIsland {
    let id: Int
    let x: Double
    let y: Double
    let radius: Double
    let owner: String         // "me" | "enemy" | "neutral"
    let teamCapturing: String // "me" | "enemy" | "none"
    let captureProgress: Int
    let captureTurns: Int
    let value: Int
}

struct GameState {
    let tick: Int
    let maxTicks: Int
    let mapWidth: Double
    let mapHeight: Double
    let myScore: Double
    let enemyScore: Double
    let targetScore: Double
    let myShips: [BotShip]
    let enemyShips: [BotShip]
    let islands: [BotIsland]
}

enum Command {
    case idle
    case move(x: Double, y: Double)

    static func moveTo(_ x: Double, _ y: Double) -> Command { .move(x: x, y: y) }
    static func moveTo(_ x: Int, _ y: Int) -> Command { .move(x: Double(x), y: Double(y)) }
    static func idle() -> Command { .idle }
}

${SWIFT_HELPERS_BLOCK}

// ── User Code ─────────────────────────────────────────────────────────────
// Must define:
//   func tick(_ state: GameState, _ ship: BotShip) -> Command

${userCode}

// ── Main: parse key=value stdin, call tick() per ship, print results ───────

var fields: [String: String] = [:]
while let line = readLine() {
    let trimmed = line.trimmingCharacters(in: .whitespaces)
    if let eqRange = trimmed.range(of: "=") {
        let key = String(trimmed[trimmed.startIndex..<eqRange.lowerBound])
        let val = String(trimmed[eqRange.upperBound...])
        fields[key] = val
    }
}

func pInt(_ key: String) -> Int { Int(fields[key] ?? "0") ?? 0 }
func pDouble(_ key: String) -> Double { Double(fields[key] ?? "0") ?? 0 }
func pBool(_ key: String) -> Bool { fields[key] == "true" }

func parseShipFromFields(_ prefix: String) -> BotShip {
    BotShip(
        id: pInt(prefix + "id"),
        x: pDouble(prefix + "x"),
        y: pDouble(prefix + "y"),
        alive: pBool(prefix + "alive"),
        isCapturing: pBool(prefix + "isCapturing"),
        turnsToRevive: pInt(prefix + "turnsToRevive"),
        initialX: pDouble(prefix + "initialX"),
        initialY: pDouble(prefix + "initialY"),
        combatPressure: pInt(prefix + "combatPressure")
    )
}

let myShipsCount = pInt("myShipsCount")
let enemyShipsCount = pInt("enemyShipsCount")
let islandsCount = pInt("islandsCount")

let myShips = (0..<myShipsCount).map { parseShipFromFields("ms.\\($0).") }
let enemyShips = (0..<enemyShipsCount).map { parseShipFromFields("es.\\($0).") }
let islands = (0..<islandsCount).map { j -> BotIsland in
    let p = "is.\\(j)."
    return BotIsland(
        id: pInt(p + "id"),
        x: pDouble(p + "x"),
        y: pDouble(p + "y"),
        radius: pDouble(p + "radius"),
        owner: fields[p + "owner"] ?? "neutral",
        teamCapturing: fields[p + "teamCapturing"] ?? "none",
        captureProgress: pInt(p + "captureProgress"),
        captureTurns: pInt(p + "captureTurns"),
        value: pInt(p + "value")
    )
}

let state = GameState(
    tick: pInt("tick"),
    maxTicks: pInt("maxTicks"),
    mapWidth: pDouble("mapWidth"),
    mapHeight: pDouble("mapHeight"),
    myScore: pDouble("myScore"),
    enemyScore: pDouble("enemyScore"),
    targetScore: pDouble("targetScore"),
    myShips: myShips,
    enemyShips: enemyShips,
    islands: islands
)

for ship in state.myShips {
    let cmd = tick(state, ship)
    switch cmd {
    case .idle:
        print("\\(ship.id):idle")
    case .move(let x, let y):
        print("\\(ship.id):move:\\(x):\\(y)")
    }
}
`;
}

// ─────────────────────────────────────────────
// State serialiser — key=value lines for stdin
// ─────────────────────────────────────────────

function serializeState(state: GameState): string {
  const L: string[] = [];

  L.push(`tick=${state.tick}`);
  L.push(`maxTicks=${state.maxTicks}`);
  L.push(`mapWidth=${state.mapWidth}`);
  L.push(`mapHeight=${state.mapHeight}`);
  L.push(`myScore=${state.myScore}`);
  L.push(`enemyScore=${state.enemyScore}`);
  L.push(`targetScore=${state.targetScore}`);

  const serShip = (prefix: string, s: BotShip) => {
    L.push(`${prefix}id=${s.id}`);
    L.push(`${prefix}x=${s.x}`);
    L.push(`${prefix}y=${s.y}`);
    L.push(`${prefix}alive=${s.alive}`);
    L.push(`${prefix}isCapturing=${s.isCapturing}`);
    L.push(`${prefix}turnsToRevive=${s.turnsToRevive}`);
    L.push(`${prefix}initialX=${s.initialX}`);
    L.push(`${prefix}initialY=${s.initialY}`);
    L.push(`${prefix}combatPressure=${s.combatPressure}`);
  };

  L.push(`myShipsCount=${state.myShips.length}`);
  state.myShips.forEach((s, j) => serShip(`ms.${j}.`, s));

  L.push(`enemyShipsCount=${state.enemyShips.length}`);
  state.enemyShips.forEach((s, j) => serShip(`es.${j}.`, s));

  L.push(`islandsCount=${state.islands.length}`);
  state.islands.forEach((is, j) => {
    const p = `is.${j}.`;
    L.push(`${p}id=${is.id}`);
    L.push(`${p}x=${is.x}`);
    L.push(`${p}y=${is.y}`);
    L.push(`${p}radius=${is.radius}`);
    L.push(`${p}owner=${is.owner}`);
    L.push(`${p}teamCapturing=${is.teamCapturing}`);
    L.push(`${p}captureProgress=${is.captureProgress}`);
    L.push(`${p}captureTurns=${is.captureTurns}`);
    L.push(`${p}value=${is.value}`);
  });

  return L.join('\n');
}

// ─────────────────────────────────────────────
// Minimal dummy state for compilation validation
// ─────────────────────────────────────────────

function dummyState(): GameState {
  const ship: BotShip = {
    id: 1, x: 100, y: 100, alive: true, isCapturing: false,
    turnsToRevive: 0, initialX: 100, initialY: 100, combatPressure: 0,
  };
  return {
    tick: 0, maxTicks: 15000, mapWidth: 700, mapHeight: 1000,
    myScore: 0, enemyScore: 0, targetScore: 10000,
    myShips: [ship],
    enemyShips: [{
      id: 9, x: 600, y: 900, alive: true, isCapturing: false,
      turnsToRevive: 0, initialX: 600, initialY: 900, combatPressure: 0,
    }],
    islands: [{
      id: 1, x: 350, y: 500, radius: 50,
      owner: 'neutral', teamCapturing: 'none',
      captureProgress: 0, captureTurns: 15, value: 1,
    }],
    config: {
      mapWidth: 700, mapHeight: 1000, shipSpeed: 5, attackRadius: 51,
      captureRadius: 50, captureTurns: 15, respawnDelay: 20,
      gameDuration: 15000, targetScore: 10000, shipsPerPlayer: 8,
      safeZoneWidth: 80, numIslands: 7, tickRateMs: 120,
      islandEdgeMargin: 150, combatKillDelay: 8,
    },
  };
}

// ─────────────────────────────────────────────
// Godbolt (Compiler Explorer) API
// ─────────────────────────────────────────────

interface GodboltOutputLine {
  text: string;
  tag?: { severity?: string; line?: number; column?: number; text?: string };
}

interface GodboltBuildResult {
  code: number;
  timedOut?: boolean;
  stdout: GodboltOutputLine[];
  stderr: GodboltOutputLine[];
}

interface GodboltResponse {
  /** Exit code of the program (0 = success) */
  code: number;
  timedOut?: boolean;
  didExecute?: boolean;
  /** Program stdout lines */
  stdout: GodboltOutputLine[];
  /** Program stderr lines */
  stderr: GodboltOutputLine[];
  /** Compilation result */
  buildResult?: GodboltBuildResult;
}

async function callGodbolt(code: string, stdin: string): Promise<GodboltResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COMPILE_TIMEOUT_MS);

  try {
    const res = await fetch(GODBOLT_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        source: code,
        options: {
          userArguments: '',
          executeParameters: { stdin },
          compilerOptions: { executorRequest: true },
          filters: { execute: true },
          tools: [],
          libraries: [],
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Godbolt returned HTTP ${res.status}: ${res.statusText}`);
    }

    return (await res.json()) as GodboltResponse;
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────
// Output parser — "shipId:idle" | "shipId:move:x:y"
// ─────────────────────────────────────────────

function parseOutputLines(lines: GodboltOutputLine[]): Map<number, Command> {
  const results = new Map<number, Command>();
  for (const { text } of lines) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(':');
    const shipId = parseInt(parts[0], 10);
    if (isNaN(shipId)) continue;

    if (parts[1] === 'move' && parts.length >= 4) {
      const x = parseFloat(parts[2]);
      const y = parseFloat(parts[3]);
      if (isFinite(x) && isFinite(y)) {
        results.set(shipId, { type: 'move', target: { x, y } });
        continue;
      }
    }
    results.set(shipId, { type: 'idle' });
  }
  return results;
}

// ─────────────────────────────────────────────
// SwiftSandboxedBot
// ─────────────────────────────────────────────

export class SwiftSandboxedBot {
  private wrappedCode = '';
  private initialized = false;
  private readonly label: string;

  // Per-ship command cache — updated each time a Wandbox call completes.
  private commandCache = new Map<number, Command>();

  // Throttle: only fire one API call per batch interval.
  private callInFlight = false;
  private lastCallTime = 0;

  constructor(label: string) {
    this.label = label;
  }

  // ─────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────

  /**
   * Wrap and validate the user's Swift code.
   *
   * Makes one Wandbox call with a dummy game state. Throws on:
   *   - compilation errors
   *   - missing tick function
   *   - network / timeout failures
   */
  async initFromCode(code: string): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('Swift sandbox is browser-only (no SSR support).');
    }

    this.wrappedCode = wrapSwiftCode(code);

    let response: GodboltResponse;
    try {
      response = await callGodbolt(this.wrappedCode, serializeState(dummyState()));
    } catch (err) {
      throw new Error(
        `Swift sandbox: failed to reach Godbolt API — ` +
          `${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // Surface compiler/linker errors from the build step
    const buildErrors = (response.buildResult?.stderr ?? []).map((l) => l.text.trim()).filter(Boolean);
    if (response.buildResult && response.buildResult.code !== 0 && buildErrors.length > 0) {
      throw new Error(`Swift compilation errors:\n${buildErrors.join('\n')}`);
    }

    // Runtime crash during validation
    if (response.code !== 0 && response.didExecute) {
      const stderrText = (response.stderr ?? []).map((l) => l.text).join('\n').trim();
      throw new Error(`Swift bot crashed during validation: ${stderrText || 'non-zero exit code'}`);
    }

    this.initialized = true;
  }

  // ─────────────────────────────────────────────
  // Per-tick execution
  // ─────────────────────────────────────────────

  /**
   * Return a Command for `ship` this tick.
   *
   * Immediately returns the last cached result for this ship (or idle).
   * Concurrently fires a new Wandbox batch call (all ships) if:
   *   1. No call is currently in flight, AND
   *   2. At least BATCH_INTERVAL_MS has elapsed since the last call.
   *
   * The cache is updated when the call completes; future tick() calls
   * on the same ship will return fresher results.
   */
  tick(state: GameState, ship: BotShip): Command {
    if (!this.initialized) return { type: 'idle' };

    const now = Date.now();
    if (!this.callInFlight && now - this.lastCallTime > BATCH_INTERVAL_MS) {
      this.callInFlight = true;
      this.lastCallTime = now;
      this.fireBatch(state);
    }

    return this.commandCache.get(ship.id) ?? { type: 'idle' };
  }

  private fireBatch(state: GameState): void {
    callGodbolt(this.wrappedCode, serializeState(state))
      .then((response) => {
        // If build failed mid-game, log but don't crash (code was already validated)
        if (response.buildResult && response.buildResult.code !== 0) {
          const errs = (response.buildResult.stderr ?? []).map((l) => l.text).join('\n').trim();
          console.warn(`[swift-sandbox:${this.label}] build error during game:`, errs);
          return;
        }
        const results = parseOutputLines(response.stdout ?? []);
        for (const [shipId, cmd] of results) {
          this.commandCache.set(shipId, cmd);
        }
      })
      .catch((err) => {
        console.warn(`[swift-sandbox:${this.label}] Godbolt call failed:`, err);
      })
      .finally(() => {
        this.callInFlight = false;
      });
  }

  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────

  get isReady(): boolean {
    return this.initialized;
  }

  destroy(): void {
    this.initialized = false;
    this.commandCache.clear();
    this.wrappedCode = '';
  }
}

// ─────────────────────────────────────────────
// Language detection
// ─────────────────────────────────────────────

/**
 * Returns true if the code looks like Swift.
 * Checks for a `// @language: swift` comment at the top, OR
 * the presence of Swift-specific syntax patterns.
 */
export function isSwiftCode(code: string): boolean {
  const firstLines = code.slice(0, 400).trimStart();
  if (/^\/\/\s*@language\s*:\s*swift\b/im.test(firstLines)) return true;
  // Heuristic: Swift-style function definition for tick
  if (/^\s*func\s+tick\s*\(\s*_\s+state\s*:/m.test(code)) return true;
  return false;
}
