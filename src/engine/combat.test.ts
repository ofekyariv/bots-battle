import { describe, it, expect, beforeEach } from 'vitest';
import { resolveCombat, resolveCollisions, processRespawns, getCombatStats } from './combat';
import { DEFAULT_CONFIG, type Ship, type GameConfig } from './types';

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

const cfg: GameConfig = {
  ...DEFAULT_CONFIG,
  attackRadius: 100,
  respawnDelay: 20,
  combatKillDelay: 1, // instant kill for legacy combat tests
};

// ─── resolveCombat ────────────────────────────────────────────────────────────

describe('resolveCombat', () => {
  describe('1v1 — both ships survive (equal numbers)', () => {
    it('both survive when a lone ship faces a lone enemy in radius', () => {
      // Each ship: 1 friendly (self), 1 enemy → equal → survives
      const ships: Ship[] = [
        makeShip(0, 'player1', 0, 0),
        makeShip(1, 'player2', 50, 0), // within attackRadius=100
      ];

      resolveCombat(ships, cfg);

      expect(ships[0].alive).toBe(true);
      expect(ships[1].alive).toBe(true);
    });
  });

  describe('2v1 — lone ship dies, pair survives', () => {
    it('kills the outnumbered player2 ship; both player1 ships survive', () => {
      // p1[0] at (0,0), p1[1] at (10,0), p2 at (50,0) — all within radius
      // p1[0]: 2 friendlies (self + p1[1]), 1 enemy → survives
      // p1[1]: 2 friendlies (self + p1[0]), 1 enemy → survives
      // p2:    1 friendly (self), 2 enemies → dies
      const ships: Ship[] = [
        makeShip(0, 'player1', 0, 0),
        makeShip(1, 'player1', 10, 0),
        makeShip(2, 'player2', 50, 0),
      ];

      resolveCombat(ships, cfg);

      expect(ships[0].alive).toBe(true);
      expect(ships[1].alive).toBe(true);
      expect(ships[2].alive).toBe(false);
    });

    it('mirrors: lone player1 dies when outnumbered by two player2 ships', () => {
      const ships: Ship[] = [
        makeShip(0, 'player1', 50, 0),
        makeShip(1, 'player2', 0, 0),
        makeShip(2, 'player2', 10, 0),
      ];

      resolveCombat(ships, cfg);

      expect(ships[0].alive).toBe(false);
      expect(ships[1].alive).toBe(true);
      expect(ships[2].alive).toBe(true);
    });
  });

  describe('3v2 — the 2 die, the 3 survive', () => {
    it('kills both player2 ships; all three player1 ships survive', () => {
      // p1: (0,0), (10,0), (20,0) — all within 100 of each other
      // p2: (50,0), (60,0) — all within 100 of everyone
      //
      // Each p1 ship: 2 friendlies, 2 enemies → equal → survives
      // Each p2 ship: 1 friendly, 3 enemies → outnumbered → dies
      const ships: Ship[] = [
        makeShip(0, 'player1', 0, 0),
        makeShip(1, 'player1', 10, 0),
        makeShip(2, 'player1', 20, 0),
        makeShip(3, 'player2', 50, 0),
        makeShip(4, 'player2', 60, 0),
      ];

      resolveCombat(ships, cfg);

      expect(ships[0].alive).toBe(true);
      expect(ships[1].alive).toBe(true);
      expect(ships[2].alive).toBe(true);
      expect(ships[3].alive).toBe(false);
      expect(ships[4].alive).toBe(false);
    });
  });

  describe('2v2 — outcome depends on positioning', () => {
    it("all four survive when both pairs are within each other's radii (2v2 = equal)", () => {
      // p1: (0,0), (10,0); p2: (50,0), (60,0) — all within attackRadius=100
      // Each ship: 2 friendlies (self+teammate), 2 enemies → equal → all survive
      const ships: Ship[] = [
        makeShip(0, 'player1', 0, 0),
        makeShip(1, 'player1', 10, 0),
        makeShip(2, 'player2', 50, 0),
        makeShip(3, 'player2', 60, 0),
      ];

      resolveCombat(ships, cfg);

      expect(ships[0].alive).toBe(true);
      expect(ships[1].alive).toBe(true);
      expect(ships[2].alive).toBe(true);
      expect(ships[3].alive).toBe(true);
    });

    it('pair survives when it clusters but sees only 1 enemy in radius (lone enemy pair dies)', () => {
      // p1 clustered at (0,0) and (10,0) — 1 friendly each
      // p2 spread: (80,0) in radius, (300,0) far out of radius (dist > 100 from p1 cluster)
      // attackRadius = 100
      //
      // p1[0] at (0,0):  2 friendlies (self + p1[1]@10), enemies: p2[0]@80 ✓, p2[1]@300 ✗ → 1 enemy < 2 → survives
      // p1[1] at (10,0): 2 friendlies (self + p1[0]@10), enemies: p2[0]@70 ✓, p2[1]@290 ✗ → 1 enemy < 2 → survives
      // p2[0] at (80,0): 1 friendly (self; p2[1]@220 ✗), enemies: p1[0]@80 ✓, p1[1]@70 ✓ → 2 enemies > 1 → dies
      // p2[1] at (300,0): 1 friendly (self; p2[0]@220 ✗), enemies: p1[0]@300 ✗, p1[1]@290 ✗ → 0 enemies → survives
      const ships: Ship[] = [
        makeShip(0, 'player1', 0, 0),
        makeShip(1, 'player1', 10, 0),
        makeShip(2, 'player2', 80, 0),
        makeShip(3, 'player2', 300, 0),
      ];

      resolveCombat(ships, cfg);

      expect(ships[0].alive).toBe(true); // p1[0] survives (equal)
      expect(ships[1].alive).toBe(true); // p1[1] survives (equal)
      expect(ships[2].alive).toBe(false); // p2[0] dies (outnumbered)
      expect(ships[3].alive).toBe(true); // p2[1] survives (no nearby enemies)
    });
  });

  describe('edge cases', () => {
    it('does nothing when no ships are alive', () => {
      const dead: Ship = { ...makeShip(0, 'player1', 0, 0), alive: false };
      resolveCombat([dead], cfg);
      expect(dead.alive).toBe(false);
    });

    it('does nothing when only one team has ships', () => {
      const ships: Ship[] = [makeShip(0, 'player1', 0, 0), makeShip(1, 'player1', 10, 0)];
      resolveCombat(ships, cfg);
      expect(ships.every((s) => s.alive)).toBe(true);
    });

    it('excludes dead ships from combat evaluation', () => {
      // Dead player2 ship should not count as an enemy
      const ships: Ship[] = [
        makeShip(0, 'player1', 0, 0),
        { ...makeShip(1, 'player2', 50, 0), alive: false, turnsToRevive: 10 },
      ];
      resolveCombat(ships, cfg);
      expect(ships[0].alive).toBe(true); // no alive enemies → no threat
    });

    it('ships outside attackRadius do not affect combat', () => {
      // p2 is 200 units away — outside attackRadius=100
      const ships: Ship[] = [makeShip(0, 'player1', 0, 0), makeShip(1, 'player2', 200, 0)];
      resolveCombat(ships, cfg);
      // No ships within each other's radius → no combat
      expect(ships[0].alive).toBe(true);
      expect(ships[1].alive).toBe(true);
    });

    it('isCapturing flag does not exempt ship from combat (capturing ships fight normally)', () => {
      // 1v1 = equal, both survive. But with 2v1 the lone ship still dies.
      const ships: Ship[] = [
        { ...makeShip(0, 'player1', 0, 0), isCapturing: true },
        { ...makeShip(1, 'player1', 10, 0), isCapturing: true },
        makeShip(2, 'player2', 50, 0),
      ];
      resolveCombat(ships, cfg);
      // isCapturing doesn't change combat — p2 is outnumbered 2v1, dies
      expect(ships[0].alive).toBe(true);
      expect(ships[1].alive).toBe(true);
      expect(ships[2].alive).toBe(false);
    });
  });
});

// ─── resolveCollisions ────────────────────────────────────────────────────────

describe('resolveCollisions', () => {
  it('does NOT kill enemy ships at the same position (collisions disabled)', () => {
    const ships: Ship[] = [makeShip(0, 'player1', 100, 100), makeShip(1, 'player2', 100, 100)];
    resolveCollisions(ships, cfg);
    expect(ships[0].alive).toBe(true);
    expect(ships[1].alive).toBe(true);
  });

  it('does NOT kill ships within collision threshold (collisions disabled)', () => {
    const ships: Ship[] = [
      makeShip(0, 'player1', 100, 100),
      makeShip(1, 'player2', 100.5, 100), // 0.5 units — within threshold
    ];
    resolveCollisions(ships, cfg);
    expect(ships[0].alive).toBe(true);
    expect(ships[1].alive).toBe(true);
  });

  it('does NOT kill friendly ships at the same position', () => {
    const ships: Ship[] = [makeShip(0, 'player1', 100, 100), makeShip(1, 'player1', 100, 100)];
    resolveCollisions(ships, cfg);
    expect(ships[0].alive).toBe(true);
    expect(ships[1].alive).toBe(true);
  });

  it('does NOT kill ships that are 2 units apart', () => {
    const ships: Ship[] = [
      makeShip(0, 'player1', 100, 100),
      makeShip(1, 'player2', 102, 100), // 2 units — outside threshold
    ];
    resolveCollisions(ships, cfg);
    expect(ships[0].alive).toBe(true);
    expect(ships[1].alive).toBe(true);
  });

  it('does NOT set turnsToRevive on nearby ships (collisions disabled)', () => {
    const ships: Ship[] = [makeShip(0, 'player1', 0, 0), makeShip(1, 'player2', 0, 0)];
    resolveCollisions(ships, cfg);
    expect(ships[0].turnsToRevive).toBe(0);
    expect(ships[1].turnsToRevive).toBe(0);
  });
});

// ─── processRespawns ─────────────────────────────────────────────────────────

describe('processRespawns', () => {
  it('decrements turnsToRevive each tick', () => {
    const ship: Ship = {
      ...makeShip(0, 'player1', 50, 50),
      alive: false,
      turnsToRevive: 5,
    };
    processRespawns([ship]);
    expect(ship.turnsToRevive).toBe(4);
    expect(ship.alive).toBe(false);
  });

  it('revives ship when turnsToRevive reaches 0', () => {
    const ship: Ship = {
      ...makeShip(0, 'player1', 100, 200),
      alive: false,
      turnsToRevive: 1,
      x: 999, // current position is irrelevant — should reset to initialX/Y
      y: 999,
    };
    processRespawns([ship]);
    expect(ship.alive).toBe(true);
    expect(ship.turnsToRevive).toBe(0);
    expect(ship.x).toBe(100); // restored to initialX
    expect(ship.y).toBe(200); // restored to initialY
    expect(ship.isCapturing).toBe(false);
  });

  it('does not touch already alive ships', () => {
    const ship: Ship = { ...makeShip(0, 'player1', 0, 0), turnsToRevive: 0 };
    processRespawns([ship]);
    expect(ship.alive).toBe(true);
    expect(ship.turnsToRevive).toBe(0);
  });

  it('does not decrement when turnsToRevive is already 0 and dead', () => {
    // edge case: dead ship with turnsToRevive=0 should not go negative
    const ship: Ship = { ...makeShip(0, 'player1', 0, 0), alive: false, turnsToRevive: 0 };
    processRespawns([ship]);
    expect(ship.turnsToRevive).toBe(0);
    expect(ship.alive).toBe(false);
  });
});

// ─── getCombatStats ───────────────────────────────────────────────────────────

describe('getCombatStats', () => {
  it('returns correct stats for a 1v1 scenario (equal = survive)', () => {
    const ships: Ship[] = [makeShip(0, 'player1', 0, 0), makeShip(1, 'player2', 50, 0)];
    const stats = getCombatStats(ships, cfg);
    expect(stats).toHaveLength(2);

    const p1Stat = stats.find((s) => s.shipId === 0)!;
    expect(p1Stat.friendliesInRadius).toBe(1); // self
    expect(p1Stat.enemiesInRadius).toBe(1);
    expect(p1Stat.wouldDie).toBe(false); // equal = survive

    const p2Stat = stats.find((s) => s.shipId === 1)!;
    expect(p2Stat.friendliesInRadius).toBe(1); // self
    expect(p2Stat.enemiesInRadius).toBe(1);
    expect(p2Stat.wouldDie).toBe(false);
  });

  it('excludes dead ships from stats', () => {
    const ships: Ship[] = [
      makeShip(0, 'player1', 0, 0),
      { ...makeShip(1, 'player2', 50, 0), alive: false },
    ];
    const stats = getCombatStats(ships, cfg);
    expect(stats).toHaveLength(1);
    expect(stats[0].shipId).toBe(0);
    expect(stats[0].enemiesInRadius).toBe(0);
    expect(stats[0].wouldDie).toBe(false);
  });
});

// ─── Combat Pressure System ──────────────────────────────────────────────────

describe('combat pressure system', () => {
  const pressureCfg: GameConfig = {
    ...DEFAULT_CONFIG,
    attackRadius: 100,
    respawnDelay: 20,
    combatKillDelay: 8,
  };

  it('ship survives first tick outnumbered', () => {
    const ships: Ship[] = [
      makeShip(0, 'player1', 0, 0),
      makeShip(1, 'player1', 10, 0),
      makeShip(2, 'player2', 50, 0),
    ];

    resolveCombat(ships, pressureCfg);

    expect(ships[2].alive).toBe(true);
    expect(ships[2].combatPressure).toBe(1);
  });

  it('ship dies after exactly combatKillDelay ticks outnumbered', () => {
    const ships: Ship[] = [
      makeShip(0, 'player1', 0, 0),
      makeShip(1, 'player1', 10, 0),
      makeShip(2, 'player2', 50, 0),
    ];

    for (let i = 0; i < pressureCfg.combatKillDelay - 1; i++) {
      resolveCombat(ships, pressureCfg);
      expect(ships[2].alive).toBe(true);
    }

    // The killing tick
    resolveCombat(ships, pressureCfg);
    expect(ships[2].alive).toBe(false);
    expect(ships[2].turnsToRevive).toBe(pressureCfg.respawnDelay);
  });

  it('pressure resets when reinforced (enemies <= friendlies)', () => {
    const ships: Ship[] = [
      makeShip(0, 'player1', 0, 0),
      makeShip(1, 'player1', 10, 0),
      makeShip(2, 'player2', 50, 0),
      makeShip(3, 'player2', 200, 0), // far away, will move in as reinforcement
    ];

    // Build up pressure on ship 2 (outnumbered 2v1)
    for (let i = 0; i < 5; i++) {
      resolveCombat(ships, pressureCfg);
    }
    expect(ships[2].combatPressure).toBe(5);

    // Reinforce: move ship 3 into range (now 2v2 = equal)
    ships[3].x = 55;
    resolveCombat(ships, pressureCfg);
    expect(ships[2].combatPressure).toBe(0);
    expect(ships[2].alive).toBe(true);
  });

  it('pressure resets on respawn', () => {
    const ship: Ship = {
      ...makeShip(0, 'player1', 100, 200),
      alive: false,
      turnsToRevive: 1,
      combatPressure: 5,
      x: 999,
      y: 999,
    };
    processRespawns([ship]);
    expect(ship.alive).toBe(true);
    expect(ship.combatPressure).toBe(0);
  });
});
