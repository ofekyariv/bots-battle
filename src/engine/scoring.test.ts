import { describe, it, expect } from 'vitest';
import {
  pointsPerTick,
  totalIslandValue,
  countIslands,
  scoreTick,
  applyScoreTick,
  ticksToReachScore,
  projectedScore,
  getScoreSummary,
} from './scoring';
import { type Island, type PlayerState } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeIsland(id: number, owner: 'player1' | 'player2' | 'neutral', value = 1): Island {
  return {
    id,
    x: 0,
    y: 0,
    radius: 50,
    owner,
    teamCapturing: 'none',
    captureProgress: 0,
    captureTurns: 15,
    value,
  };
}

function makePlayerState(id: 'player1' | 'player2'): PlayerState {
  return {
    id,
    score: 0,
    shipIds: [],
    islandsHeld: 0,
    lastTickPoints: 0,
  };
}

// ─── pointsPerTick (core exponential formula) ─────────────────────────────────

describe('pointsPerTick — exponential scoring formula', () => {
  it('returns 0 for 0 islands (no islands held)', () => {
    expect(pointsPerTick(0)).toBe(0);
  });

  it('returns 0 for negative values', () => {
    expect(pointsPerTick(-1)).toBe(0);
  });

  it('returns 1 for totalValue = 1 (1 normal island)', () => {
    expect(pointsPerTick(1)).toBe(1); // 2^(1-1) = 2^0 = 1
  });

  it('returns 2 for totalValue = 2 (2 normal islands)', () => {
    expect(pointsPerTick(2)).toBe(2); // 2^(2-1) = 2^1 = 2
  });

  it('returns 4 for totalValue = 3 (3 normal islands)', () => {
    expect(pointsPerTick(3)).toBe(4); // 2^(3-1) = 2^2 = 4
  });

  it('returns 8 for totalValue = 4 (4 normal islands)', () => {
    expect(pointsPerTick(4)).toBe(8); // 2^(4-1) = 2^3 = 8
  });

  it('returns 16 for totalValue = 5 (5 normal islands)', () => {
    expect(pointsPerTick(5)).toBe(16); // 2^(5-1) = 2^4 = 16
  });

  it('doubles with each additional island (geometric series)', () => {
    const rates = [1, 2, 3, 4, 5, 6].map(pointsPerTick);
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBe(rates[i - 1] * 2);
    }
  });

  it('handles treasure island value=2 (counts as 2 normal islands)', () => {
    // 1 treasure island (value=2) → same as 2 normal islands → 2 pts/tick
    expect(pointsPerTick(2)).toBe(2);
    // 2 normal + 1 treasure (value=2) → totalValue=4 → 8 pts/tick
    expect(pointsPerTick(4)).toBe(8);
  });
});

// ─── totalIslandValue ──────────────────────────────────────────────────────────

describe('totalIslandValue', () => {
  it('returns 0 when player holds no islands', () => {
    const islands = [makeIsland(0, 'player2'), makeIsland(1, 'neutral')];
    expect(totalIslandValue(islands, 'player1')).toBe(0);
  });

  it('sums island values for the given owner', () => {
    const islands = [
      makeIsland(0, 'player1', 1),
      makeIsland(1, 'player1', 1),
      makeIsland(2, 'player2', 1),
    ];
    expect(totalIslandValue(islands, 'player1')).toBe(2);
    expect(totalIslandValue(islands, 'player2')).toBe(1);
  });

  it('correctly sums treasure islands with value > 1', () => {
    const islands = [
      makeIsland(0, 'player1', 1), // normal
      makeIsland(1, 'player1', 2), // treasure
    ];
    expect(totalIslandValue(islands, 'player1')).toBe(3);
  });

  it('returns 0 for empty island list', () => {
    expect(totalIslandValue([], 'player1')).toBe(0);
  });
});

// ─── countIslands ─────────────────────────────────────────────────────────────

describe('countIslands', () => {
  it('counts islands owned by a specific player', () => {
    const islands = [
      makeIsland(0, 'player1'),
      makeIsland(1, 'player1'),
      makeIsland(2, 'player2'),
      makeIsland(3, 'neutral'),
    ];
    expect(countIslands(islands, 'player1')).toBe(2);
    expect(countIslands(islands, 'player2')).toBe(1);
  });

  it('returns 0 when no islands match', () => {
    const islands = [makeIsland(0, 'neutral')];
    expect(countIslands(islands, 'player1')).toBe(0);
  });
});

// ─── scoreTick ────────────────────────────────────────────────────────────────

describe('scoreTick', () => {
  it('returns [0, 0] when no islands are held', () => {
    const islands = [makeIsland(0, 'neutral'), makeIsland(1, 'neutral')];
    const [p1, p2] = scoreTick(islands);
    expect(p1).toBe(0);
    expect(p2).toBe(0);
  });

  it('returns correct deltas based on holdings', () => {
    // p1 holds 3 islands (value=3 total) → 4 pts/tick
    // p2 holds 1 island (value=1) → 1 pt/tick
    const islands = [
      makeIsland(0, 'player1'),
      makeIsland(1, 'player1'),
      makeIsland(2, 'player1'),
      makeIsland(3, 'player2'),
    ];
    const [p1, p2] = scoreTick(islands);
    expect(p1).toBe(4);
    expect(p2).toBe(1);
  });

  it('works when all islands are held by one player', () => {
    const islands = [makeIsland(0, 'player1'), makeIsland(1, 'player1')];
    const [p1, p2] = scoreTick(islands);
    expect(p1).toBe(2); // 2 islands → 2^(2-1) = 2
    expect(p2).toBe(0);
  });
});

// ─── applyScoreTick ───────────────────────────────────────────────────────────

describe('applyScoreTick', () => {
  it('mutates player states and returns updated scores', () => {
    const islands = [makeIsland(0, 'player1'), makeIsland(1, 'player2')];
    const p1 = makePlayerState('player1');
    const p2 = makePlayerState('player2');

    const { p1Score, p2Score } = applyScoreTick(islands, p1, p2, 100, 200);

    expect(p1Score).toBe(101); // 100 + 1
    expect(p2Score).toBe(201); // 200 + 1
    expect(p1.score).toBe(101);
    expect(p2.score).toBe(201);
    expect(p1.lastTickPoints).toBe(1);
    expect(p2.lastTickPoints).toBe(1);
    expect(p1.islandsHeld).toBe(1);
    expect(p2.islandsHeld).toBe(1);
  });

  it('accumulates scores from previous score correctly', () => {
    const islands = [makeIsland(0, 'player1'), makeIsland(1, 'player1')]; // 2 islands → 2 pts/tick
    const p1 = makePlayerState('player1');
    const p2 = makePlayerState('player2');

    const { p1Score } = applyScoreTick(islands, p1, p2, 500, 0);
    expect(p1Score).toBe(502); // 500 + 2
  });
});

// ─── ticksToReachScore ────────────────────────────────────────────────────────

describe('ticksToReachScore', () => {
  it('returns Infinity when no islands are held', () => {
    expect(ticksToReachScore(0, 1000, 0)).toBe(Infinity);
  });

  it('returns 0 when already at or above targetScore', () => {
    expect(ticksToReachScore(1000, 1000, 3)).toBe(0);
    expect(ticksToReachScore(1001, 1000, 3)).toBe(0);
  });

  it('calculates correct ticks for 1 island (1 pt/tick)', () => {
    // Need 100 points at 1 pt/tick = 100 ticks
    expect(ticksToReachScore(0, 100, 1)).toBe(100);
  });

  it('calculates correct ticks for 3 islands (4 pts/tick)', () => {
    // Need 1000 points at 4 pts/tick = ceil(1000/4) = 250 ticks
    expect(ticksToReachScore(0, 1000, 3)).toBe(250);
  });

  it('rounds up (ceil) when not evenly divisible', () => {
    // Need 7 points at 4 pts/tick = ceil(7/4) = 2 ticks
    expect(ticksToReachScore(0, 7, 3)).toBe(2);
  });
});

// ─── projectedScore ───────────────────────────────────────────────────────────

describe('projectedScore', () => {
  it('returns 0 when holding 0 islands', () => {
    expect(projectedScore(0, 1000)).toBe(0);
  });

  it('returns correct projected score for 3 islands over 100 ticks', () => {
    // 3 islands → 4 pts/tick × 100 ticks = 400
    expect(projectedScore(3, 100)).toBe(400);
  });

  it('returns 0 for 0 ticks regardless of island count', () => {
    expect(projectedScore(5, 0)).toBe(0);
  });
});

// ─── getScoreSummary ──────────────────────────────────────────────────────────

describe('getScoreSummary', () => {
  it('correctly identifies the leading player', () => {
    const islands = [makeIsland(0, 'player1'), makeIsland(1, 'player2')];
    const summary = getScoreSummary(islands, 500, 300);
    expect(summary.leader).toBe('player1');
    expect(summary.scoreDiff).toBe(200);
  });

  it("returns 'tied' when scores are equal", () => {
    const islands: Island[] = [];
    const summary = getScoreSummary(islands, 0, 0);
    expect(summary.leader).toBe('tied');
    expect(summary.scoreDiff).toBe(0);
  });

  it('reports correct points-per-tick rates', () => {
    const islands = [
      makeIsland(0, 'player1'),
      makeIsland(1, 'player1'),
      makeIsland(2, 'player1'), // 3 islands → 4 pts/tick
      makeIsland(3, 'player2'), // 1 island → 1 pt/tick
    ];
    const summary = getScoreSummary(islands, 0, 0);
    expect(summary.player1PointsPerTick).toBe(4);
    expect(summary.player2PointsPerTick).toBe(1);
    expect(summary.player1IslandsHeld).toBe(3);
    expect(summary.player2IslandsHeld).toBe(1);
    expect(summary.player1TotalValue).toBe(3);
    expect(summary.player2TotalValue).toBe(1);
  });

  it('counts treasure island value correctly in rates', () => {
    const islands = [
      makeIsland(0, 'player1', 2), // treasure (value=2)
      makeIsland(1, 'player1', 1), // normal (value=1)
      // total value = 3 → 4 pts/tick
    ];
    const summary = getScoreSummary(islands, 0, 0);
    expect(summary.player1TotalValue).toBe(3);
    expect(summary.player1PointsPerTick).toBe(4);
    expect(summary.player1IslandsHeld).toBe(2); // 2 islands (even though value=3)
  });
});
