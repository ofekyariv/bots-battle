import { describe, it, expect } from 'vitest';
import {
  generateMap,
  generateIslands,
  generateSpawnPoints,
  isInP1SafeZone,
  isInP2SafeZone,
  clampToMap,
  isPassableFor,
} from './map';
import { DEFAULT_CONFIG, type GameConfig } from './types';

// ─── Config helpers ───────────────────────────────────────────────────────────

const cfg: GameConfig = {
  ...DEFAULT_CONFIG,
  mapWidth: 700,
  mapHeight: 1000,
  captureRadius: 50,
  safeZoneWidth: 80,
  islandEdgeMargin: 150,
  numIslands: 7,
  shipsPerPlayer: 8,
};

// Derived constraints (mirror map.ts internals):
// EDGE_MARGIN_FACTOR = 3.5 → captureBasedMargin = 50 * 3.5 = 175
// islandEdgeMargin = 150 → effectiveEdgeMargin = max(175, 150) = 175
// MIN_SPACING_FACTOR = 3 → minSpacing = 50 * 3 = 150
const EFFECTIVE_EDGE_MARGIN = Math.max(cfg.captureRadius * 3.5, cfg.islandEdgeMargin); // 175
const MIN_SPACING = cfg.captureRadius * 3; // 150

// ─── generateIslands ─────────────────────────────────────────────────────────

describe('generateIslands', () => {
  it('generates the correct number of islands', () => {
    for (let trial = 0; trial < 5; trial++) {
      const islands = generateIslands(cfg);
      expect(islands.length).toBe(cfg.numIslands);
    }
  });

  it("all islands have owner='neutral' and captureProgress=0", () => {
    const islands = generateIslands(cfg);
    for (const island of islands) {
      expect(island.owner).toBe('neutral');
      expect(island.captureProgress).toBe(0);
      expect(island.teamCapturing).toBe('none');
    }
  });

  it('all islands respect the edge margin (x and y axes)', () => {
    // Run multiple times to account for randomness
    for (let trial = 0; trial < 10; trial++) {
      const islands = generateIslands(cfg);
      for (const island of islands) {
        expect(island.x).toBeGreaterThanOrEqual(EFFECTIVE_EDGE_MARGIN);
        expect(island.x).toBeLessThanOrEqual(cfg.mapWidth - EFFECTIVE_EDGE_MARGIN);
        expect(island.y).toBeGreaterThanOrEqual(EFFECTIVE_EDGE_MARGIN);
        expect(island.y).toBeLessThanOrEqual(cfg.mapHeight - EFFECTIVE_EDGE_MARGIN);
      }
    }
  });

  it('all islands respect the safe zone x-boundary', () => {
    for (let trial = 0; trial < 10; trial++) {
      const islands = generateIslands(cfg);
      for (const island of islands) {
        // Islands must not be placed inside either safe zone
        expect(island.x).toBeGreaterThanOrEqual(cfg.safeZoneWidth);
        expect(island.x).toBeLessThanOrEqual(cfg.mapWidth - cfg.safeZoneWidth);
      }
    }
  });

  it('all island pairs respect minimum spacing', () => {
    for (let trial = 0; trial < 10; trial++) {
      const islands = generateIslands(cfg);
      for (let i = 0; i < islands.length; i++) {
        for (let j = i + 1; j < islands.length; j++) {
          const dx = islands[i].x - islands[j].x;
          const dy = islands[i].y - islands[j].y;
          const distSq = dx * dx + dy * dy;
          expect(distSq).toBeGreaterThanOrEqual(MIN_SPACING * MIN_SPACING - 0.01);
        }
      }
    }
  });

  it('produces symmetric layout: for even numIslands, each pair is mirrored around y-center', () => {
    const evenCfg: GameConfig = { ...cfg, numIslands: 6 };
    for (let trial = 0; trial < 5; trial++) {
      const islands = generateIslands(evenCfg);
      expect(islands.length).toBe(6);

      // Islands are placed in pairs (top, mirror) in order.
      // For each pair: island[2k] is top half, island[2k+1] is its mirror.
      for (let i = 0; i < islands.length; i += 2) {
        const top = islands[i];
        const bottom = islands[i + 1];
        // x should be identical for mirrored pairs
        expect(top.x).toBeCloseTo(bottom.x, 2);
        // y values should sum to mapHeight
        expect(top.y + bottom.y).toBeCloseTo(cfg.mapHeight, 2);
      }
    }
  });

  it('places center island on y-center for odd numIslands', () => {
    const oddCfg: GameConfig = { ...cfg, numIslands: 5 };
    for (let trial = 0; trial < 5; trial++) {
      const islands = generateIslands(oddCfg);
      expect(islands.length).toBe(5);

      // Last island placed is the center one (the odd one out)
      const centerIsland = islands[islands.length - 1];
      expect(centerIsland.y).toBeCloseTo(cfg.mapHeight / 2, 2);
    }
  });

  it('assigns unique IDs to all islands', () => {
    const islands = generateIslands(cfg);
    const ids = islands.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses captureRadius as island radius', () => {
    const islands = generateIslands(cfg);
    for (const island of islands) {
      expect(island.radius).toBe(cfg.captureRadius);
    }
  });

  it('uses captureTurns from config', () => {
    const islands = generateIslands(cfg);
    for (const island of islands) {
      expect(island.captureTurns).toBe(cfg.captureTurns);
    }
  });

  it('generates different layouts on each call (random placement)', () => {
    const a = generateIslands(cfg);
    const b = generateIslands(cfg);
    // Extremely unlikely to match exactly due to randomness
    const identical = a.every((ia, i) => ia.x === b[i].x && ia.y === b[i].y);
    expect(identical).toBe(false);
  });
});

// ─── generateSpawnPoints ──────────────────────────────────────────────────────

describe('generateSpawnPoints', () => {
  it('generates 2 × shipsPerPlayer spawn points', () => {
    const points = generateSpawnPoints(cfg);
    expect(points).toHaveLength(cfg.shipsPerPlayer * 2);
  });

  it('player1 spawns on the bottom side (inside safe zone)', () => {
    const points = generateSpawnPoints(cfg);
    const p1Points = points.filter((p) => p.owner === 'player1');
    for (const p of p1Points) {
      expect(p.y).toBeGreaterThan(cfg.mapHeight - cfg.safeZoneWidth); // bottom safe zone
    }
  });

  it('player2 spawns on the top side (inside safe zone)', () => {
    const points = generateSpawnPoints(cfg);
    const p2Points = points.filter((p) => p.owner === 'player2');
    for (const p of p2Points) {
      expect(p.y).toBeLessThan(cfg.safeZoneWidth); // top safe zone
    }
  });

  it('ships are distributed evenly across map width', () => {
    const points = generateSpawnPoints(cfg);
    const p1Points = points.filter((p) => p.owner === 'player1');
    expect(p1Points).toHaveLength(cfg.shipsPerPlayer);

    // Verify ships are spread horizontally
    const xs = p1Points.map((p) => p.x).sort((a, b) => a - b);
    const expectedStep = cfg.mapWidth / cfg.shipsPerPlayer;
    for (let i = 0; i < xs.length; i++) {
      expect(xs[i]).toBeCloseTo(expectedStep * (i + 0.5), 1);
    }
  });

  it('all spawn points are within map boundaries', () => {
    const points = generateSpawnPoints(cfg);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(cfg.mapWidth);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(cfg.mapHeight);
    }
  });
});

// ─── generateMap ──────────────────────────────────────────────────────────────

describe('generateMap', () => {
  it('returns islands and spawnPoints', () => {
    const { islands, spawnPoints } = generateMap(cfg);
    expect(islands.length).toBe(cfg.numIslands);
    expect(spawnPoints.length).toBe(cfg.shipsPerPlayer * 2);
  });
});

// ─── Safe zone helpers ────────────────────────────────────────────────────────

describe('isInP1SafeZone', () => {
  it('returns true for y inside player1 safe zone (bottom)', () => {
    expect(isInP1SafeZone(cfg.mapHeight, cfg)).toBe(true);
    expect(isInP1SafeZone(cfg.mapHeight - cfg.safeZoneWidth + 1, cfg)).toBe(true);
  });

  it('returns false for y at or above safe zone boundary', () => {
    expect(isInP1SafeZone(cfg.mapHeight - cfg.safeZoneWidth, cfg)).toBe(false);
    expect(isInP1SafeZone(400, cfg)).toBe(false);
  });
});

describe('isInP2SafeZone', () => {
  it('returns true for y inside player2 safe zone (top)', () => {
    expect(isInP2SafeZone(0, cfg)).toBe(true);
    expect(isInP2SafeZone(cfg.safeZoneWidth - 1, cfg)).toBe(true);
  });

  it('returns false for y at or beyond the boundary', () => {
    expect(isInP2SafeZone(cfg.safeZoneWidth, cfg)).toBe(false);
    expect(isInP2SafeZone(400, cfg)).toBe(false);
  });
});

// ─── clampToMap ───────────────────────────────────────────────────────────────

describe('clampToMap', () => {
  it('clamps x below 0 to 0', () => {
    expect(clampToMap(-50, 500, cfg).x).toBe(0);
  });

  it('clamps x above mapWidth to mapWidth', () => {
    expect(clampToMap(9999, 500, cfg).x).toBe(cfg.mapWidth);
  });

  it('clamps y below 0 to 0', () => {
    expect(clampToMap(350, -100, cfg).y).toBe(0);
  });

  it('clamps y above mapHeight to mapHeight', () => {
    expect(clampToMap(350, 9999, cfg).y).toBe(cfg.mapHeight);
  });

  it('does not clamp valid positions', () => {
    const result = clampToMap(350, 500, cfg);
    expect(result.x).toBe(350);
    expect(result.y).toBe(500);
  });
});

// ─── isPassableFor ────────────────────────────────────────────────────────────

describe('isPassableFor', () => {
  it('returns true for a position in the open map center', () => {
    expect(isPassableFor(350, 500, 'player1', cfg)).toBe(true);
    expect(isPassableFor(350, 500, 'player2', cfg)).toBe(true);
  });

  it('returns false for positions outside map bounds', () => {
    expect(isPassableFor(-1, 500, 'player1', cfg)).toBe(false);
    expect(isPassableFor(701, 500, 'player1', cfg)).toBe(false);
    expect(isPassableFor(350, -1, 'player1', cfg)).toBe(false);
    expect(isPassableFor(350, 1001, 'player1', cfg)).toBe(false);
  });

  it("player2 cannot enter player1's safe zone (bottom)", () => {
    expect(isPassableFor(350, cfg.mapHeight - cfg.safeZoneWidth + 1, 'player2', cfg)).toBe(false);
  });

  it("player1 cannot enter player2's safe zone (top)", () => {
    expect(isPassableFor(350, cfg.safeZoneWidth - 1, 'player1', cfg)).toBe(false);
  });

  it('player1 CAN be in their own safe zone (bottom)', () => {
    expect(isPassableFor(350, cfg.mapHeight - cfg.safeZoneWidth + 1, 'player1', cfg)).toBe(true);
  });

  it('player2 CAN be in their own safe zone (top)', () => {
    expect(isPassableFor(350, cfg.safeZoneWidth - 1, 'player2', cfg)).toBe(true);
  });
});
