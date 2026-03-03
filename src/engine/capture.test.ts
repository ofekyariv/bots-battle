import { describe, it, expect } from 'vitest';
import {
  resolveCaptureProgress,
  isNeutralizing,
  isCapturingFinalPhase,
  captureProgressFraction,
  getCaptureStats,
} from './capture';
import { DEFAULT_CONFIG, type Ship, type Island, type GameConfig } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeShip(id: number, owner: 'player1' | 'player2', x: number, y: number): Ship {
  return {
    id,
    owner,
    x,
    y,
    alive: true,
    isCapturing: false,
    turnsToRevive: 0,
    initialX: x,
    initialY: y,
    combatPressure: 0,
  };
}

function makeIsland(overrides: Partial<Island> = {}): Island {
  return {
    id: 0,
    x: 500,
    y: 500,
    radius: 50,
    owner: 'neutral',
    teamCapturing: 'none',
    captureProgress: 0,
    captureTurns: 5,
    value: 1,
    ...overrides,
  };
}

const cfg: GameConfig = {
  ...DEFAULT_CONFIG,
  captureRadius: 50,
  captureTurns: 5,
};

// Ship positioned inside the island (which is at 500,500 with captureRadius 50)
const islandCenter = { x: 500, y: 500 };

// ─── Neutral capture ──────────────────────────────────────────────────────────

describe('neutral island capture', () => {
  it('advances captureProgress each tick when a single ship is in radius', () => {
    const island = makeIsland();
    const ships: Ship[] = [makeShip(0, 'player1', islandCenter.x, islandCenter.y)];

    resolveCaptureProgress(ships, [island], cfg);

    expect(island.captureProgress).toBe(1);
    expect(island.teamCapturing).toBe('player1');
    expect(island.owner).toBe('neutral'); // not yet captured
  });

  it('transfers ownership after captureTurns ticks (neutral → player1)', () => {
    const island = makeIsland();
    const ships: Ship[] = [makeShip(0, 'player1', islandCenter.x, islandCenter.y)];

    // Simulate captureTurns ticks
    for (let i = 0; i < cfg.captureTurns; i++) {
      resolveCaptureProgress(ships, [island], cfg);
    }

    expect(island.owner).toBe('player1');
    expect(island.captureProgress).toBe(0); // reset after capture
    expect(island.teamCapturing).toBe('none');
  });

  it('multiple ships of the same team capture the neutral island at the same rate', () => {
    // Capture rate is 1 tick per tick regardless of ship count
    const island = makeIsland();
    const ships: Ship[] = [
      makeShip(0, 'player1', islandCenter.x, islandCenter.y),
      makeShip(1, 'player1', islandCenter.x + 10, islandCenter.y),
    ];

    for (let i = 0; i < cfg.captureTurns; i++) {
      resolveCaptureProgress(ships, [island], cfg);
    }

    expect(island.owner).toBe('player1');
  });
});

// ─── Enemy neutralize + capture ───────────────────────────────────────────────

describe('enemy island: neutralize then capture', () => {
  it('requires captureTurns*2 total ticks to capture an enemy island', () => {
    // Island is owned by player2; player1 is attacking
    const island = makeIsland({ owner: 'player2' });
    const ships: Ship[] = [makeShip(0, 'player1', islandCenter.x, islandCenter.y)];

    // After captureTurns-1 ticks: still enemy, still neutralizing
    for (let i = 0; i < cfg.captureTurns - 1; i++) {
      resolveCaptureProgress(ships, [island], cfg);
    }
    expect(island.owner).toBe('player2');
    expect(island.captureProgress).toBe(cfg.captureTurns - 1);

    // At captureTurns: still enemy (need 2× total, just halfway)
    resolveCaptureProgress(ships, [island], cfg);
    expect(island.owner).toBe('player2');

    // After another captureTurns ticks: fully captured
    for (let i = 0; i < cfg.captureTurns; i++) {
      resolveCaptureProgress(ships, [island], cfg);
    }
    expect(island.owner).toBe('player1');
    expect(island.captureProgress).toBe(0);
    expect(island.teamCapturing).toBe('none');
  });

  it('does not transfer ownership at the halfway point (neutralize phase complete)', () => {
    const island = makeIsland({ owner: 'player2' });
    const ships: Ship[] = [makeShip(0, 'player1', islandCenter.x, islandCenter.y)];

    // Run exactly captureTurns ticks — neutralization is complete but island still enemy
    for (let i = 0; i < cfg.captureTurns; i++) {
      resolveCaptureProgress(ships, [island], cfg);
    }

    expect(island.owner).toBe('player2'); // ownership not transferred yet
    expect(island.captureProgress).toBe(cfg.captureTurns); // at the halfway mark
  });

  it("the owning team returning resets attacker's progress", () => {
    // island owned by player2, player1 starts capturing
    const island = makeIsland({ owner: 'player2' });
    const attacker: Ship[] = [makeShip(0, 'player1', islandCenter.x, islandCenter.y)];

    // Player1 captures for 3 ticks
    for (let i = 0; i < 3; i++) {
      resolveCaptureProgress(attacker, [island], cfg);
    }
    expect(island.captureProgress).toBe(3);

    // Player2 (owner) returns — sole presence — should reset attacker progress
    const defender: Ship[] = [makeShip(1, 'player2', islandCenter.x, islandCenter.y)];
    resolveCaptureProgress(defender, [island], cfg);

    expect(island.captureProgress).toBe(0);
    expect(island.teamCapturing).toBe('none');
    expect(island.owner).toBe('player2'); // still player2's
  });
});

// ─── Contested pause ──────────────────────────────────────────────────────────

describe('contested: both teams present → progress is paused', () => {
  it('does not advance progress when both teams have ships in radius', () => {
    const island = makeIsland({ captureProgress: 2, teamCapturing: 'player1' });
    const ships: Ship[] = [
      makeShip(0, 'player1', islandCenter.x, islandCenter.y),
      makeShip(1, 'player2', islandCenter.x, islandCenter.y),
    ];

    resolveCaptureProgress(ships, [island], cfg);

    // Progress frozen
    expect(island.captureProgress).toBe(2);
    expect(island.teamCapturing).toBe('player1'); // unchanged
  });

  it('pauses even if one team has more ships', () => {
    const island = makeIsland({ captureProgress: 1, teamCapturing: 'player2' });
    const ships: Ship[] = [
      makeShip(0, 'player1', islandCenter.x, islandCenter.y),
      makeShip(1, 'player2', islandCenter.x, islandCenter.y),
      makeShip(2, 'player2', islandCenter.x + 5, islandCenter.y),
    ];

    resolveCaptureProgress(ships, [island], cfg);

    expect(island.captureProgress).toBe(1); // still paused
  });
});

// ─── Abandoned reset ──────────────────────────────────────────────────────────

describe('abandoned: all ships leave → progress resets to 0', () => {
  it('resets captureProgress to 0 when no ships are in radius', () => {
    const island = makeIsland({ captureProgress: 3, teamCapturing: 'player1' });
    const ships: Ship[] = []; // no ships near island

    resolveCaptureProgress(ships, [island], cfg);

    expect(island.captureProgress).toBe(0);
    expect(island.teamCapturing).toBe('none');
  });

  it('resets even if ships exist but are far away', () => {
    const island = makeIsland({ captureProgress: 4, teamCapturing: 'player2' });
    // Ship is way outside captureRadius
    const ships: Ship[] = [makeShip(0, 'player1', 0, 0)];

    resolveCaptureProgress(ships, [island], cfg);

    expect(island.captureProgress).toBe(0);
    expect(island.teamCapturing).toBe('none');
  });

  it('does NOT reset when the island is already owned and no ships are present', () => {
    // Owned islands with no ships nearby — nothing should change
    const island = makeIsland({ owner: 'player1', teamCapturing: 'none', captureProgress: 0 });
    const ships: Ship[] = [];

    resolveCaptureProgress(ships, [island], cfg);

    expect(island.owner).toBe('player1'); // still owned
    expect(island.captureProgress).toBe(0);
  });
});

// ─── Switching team resets progress ──────────────────────────────────────────

describe('switching capturing team resets progress', () => {
  it('resets progress when a different team starts capturing a neutral island', () => {
    const island = makeIsland({ captureProgress: 2, teamCapturing: 'player1' });
    // Only player2 ships in radius
    const ships: Ship[] = [makeShip(0, 'player2', islandCenter.x, islandCenter.y)];

    resolveCaptureProgress(ships, [island], cfg);

    // progress reset from 2, then advanced by 1 for player2
    expect(island.teamCapturing).toBe('player2');
    expect(island.captureProgress).toBe(1);
  });
});

// ─── State helper functions ───────────────────────────────────────────────────

describe('isNeutralizing', () => {
  it('returns false for neutral islands', () => {
    const island = makeIsland({ owner: 'neutral', teamCapturing: 'player1', captureProgress: 2 });
    expect(isNeutralizing(island)).toBe(false);
  });

  it('returns true for enemy-owned island in phase 1 of capture', () => {
    const island = makeIsland({
      owner: 'player2',
      teamCapturing: 'player1',
      captureProgress: 2, // < captureTurns(5)
    });
    expect(isNeutralizing(island)).toBe(true);
  });

  it('returns false once captureProgress reaches captureTurns (phase 2)', () => {
    const island = makeIsland({
      owner: 'player2',
      teamCapturing: 'player1',
      captureProgress: 5, // = captureTurns → phase 2
    });
    expect(isNeutralizing(island)).toBe(false);
  });
});

describe('isCapturingFinalPhase', () => {
  it('returns true when capturing an enemy island in phase 2', () => {
    const island = makeIsland({
      owner: 'player2',
      teamCapturing: 'player1',
      captureProgress: 5, // >= captureTurns → final phase
    });
    expect(isCapturingFinalPhase(island)).toBe(true);
  });

  it('returns false for neutral islands (they have no phase 2)', () => {
    const island = makeIsland({
      owner: 'neutral',
      teamCapturing: 'player1',
      captureProgress: 5,
    });
    expect(isCapturingFinalPhase(island)).toBe(false);
  });
});

describe('captureProgressFraction', () => {
  it('returns 0 when no capture is in progress', () => {
    const island = makeIsland({ teamCapturing: 'none', captureProgress: 0 });
    expect(captureProgressFraction(island)).toBe(0);
  });

  it('returns 0.5 at halfway on a neutral island', () => {
    // captureTurns=5, progress=2.5 → not integer, use progress=2 → 2/5 = 0.4 for neutral
    // Use progress=3 for neutral → 3/5 = 0.6... let's test exactly 0.5 with captureTurns=4, progress=2
    const island = makeIsland({
      owner: 'neutral',
      teamCapturing: 'player1',
      captureProgress: 2,
      captureTurns: 4,
    });
    // neutral: required=4, progress=2 → fraction=0.5
    expect(captureProgressFraction(island)).toBe(0.5);
  });

  it('returns 0.5 at captureTurns for an enemy island (halfway of 2× total)', () => {
    const island = makeIsland({
      owner: 'player2',
      teamCapturing: 'player1',
      captureProgress: 5, // captureTurns=5 → halfway of 2*5=10
      captureTurns: 5,
    });
    expect(captureProgressFraction(island)).toBe(0.5);
  });

  it('caps fraction at 1.0', () => {
    const island = makeIsland({
      owner: 'neutral',
      teamCapturing: 'player1',
      captureProgress: 999,
      captureTurns: 5,
    });
    expect(captureProgressFraction(island)).toBe(1);
  });
});

describe('getCaptureStats', () => {
  it('returns per-island ship counts and progress info', () => {
    const island = makeIsland({ captureProgress: 3, teamCapturing: 'player1' });
    const ships: Ship[] = [
      makeShip(0, 'player1', islandCenter.x, islandCenter.y),
      makeShip(1, 'player2', 0, 0), // far away
    ];

    const stats = getCaptureStats(ships, [island], cfg);
    expect(stats).toHaveLength(1);
    expect(stats[0].p1ShipsNear).toBe(1);
    expect(stats[0].p2ShipsNear).toBe(0);
    expect(stats[0].captureProgress).toBe(3);
    expect(stats[0].owner).toBe('neutral');
  });
});
