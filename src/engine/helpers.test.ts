import { describe, it, expect } from 'vitest';
import {
  distanceTo,
  distanceToSq,
  angleTo,
  nearestIsland,
  nearestIslandOwnedBy,
  islandsOwnedBy,
  islandsNotMine,
  nearestEnemy,
  shipsNear,
  shipsSortedByDistance,
  freeShips,
  wouldDieAt,
  aliveCount,
  scoreRate,
} from './helpers';
import type { BotShip, BotIsland } from './types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeShip(id: number, x: number, y: number, alive = true): BotShip {
  return {
    id,
    x,
    y,
    alive,
    isCapturing: false,
    turnsToRevive: alive ? 0 : 5,
    initialX: x,
    initialY: y,
    combatPressure: 0,
  };
}

function makeIsland(
  id: number,
  x: number,
  y: number,
  owner: BotIsland['owner'] = 'neutral',
): BotIsland {
  return {
    id,
    x,
    y,
    radius: 50,
    owner,
    teamCapturing: 'none',
    captureProgress: 0,
    captureTurns: 15,
    value: 1,
  };
}

// ─── distanceTo ───────────────────────────────────────────────────────────────

describe('distanceTo', () => {
  it('returns 0 for the same point', () => {
    expect(distanceTo({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it('returns correct horizontal distance', () => {
    expect(distanceTo({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(3);
  });

  it('returns correct vertical distance', () => {
    expect(distanceTo({ x: 0, y: 0 }, { x: 0, y: 4 })).toBe(4);
  });

  it('returns correct Euclidean distance (3-4-5 right triangle)', () => {
    expect(distanceTo({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('is symmetric: d(a,b) = d(b,a)', () => {
    const a = { x: 10, y: 20 };
    const b = { x: 50, y: 80 };
    expect(distanceTo(a, b)).toBe(distanceTo(b, a));
  });

  it('handles negative coordinates', () => {
    expect(distanceTo({ x: -3, y: 0 }, { x: 0, y: -4 })).toBe(5);
  });

  it('returns correct diagonal distance', () => {
    const d = distanceTo({ x: 0, y: 0 }, { x: 100, y: 100 });
    expect(d).toBeCloseTo(Math.sqrt(20000), 5);
  });
});

// ─── distanceToSq ─────────────────────────────────────────────────────────────

describe('distanceToSq', () => {
  it('returns squared distance (avoids sqrt)', () => {
    expect(distanceToSq({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25); // 3²+4² = 25
  });

  it('returns 0 for the same point', () => {
    expect(distanceToSq({ x: 7, y: 7 }, { x: 7, y: 7 })).toBe(0);
  });
});

// ─── angleTo ──────────────────────────────────────────────────────────────────

describe('angleTo', () => {
  it('returns 0 for rightward direction', () => {
    expect(angleTo({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(0);
  });

  it('returns π/2 for downward direction', () => {
    expect(angleTo({ x: 0, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(Math.PI / 2);
  });

  it('returns π (or -π) for leftward direction', () => {
    const angle = angleTo({ x: 0, y: 0 }, { x: -1, y: 0 });
    expect(Math.abs(angle)).toBeCloseTo(Math.PI);
  });
});

// ─── nearestIsland ────────────────────────────────────────────────────────────

describe('nearestIsland', () => {
  it('returns null for an empty array', () => {
    expect(nearestIsland({ x: 0, y: 0 }, [])).toBeNull();
  });

  it('returns the only island when there is just one', () => {
    const island = makeIsland(0, 100, 200);
    expect(nearestIsland({ x: 0, y: 0 }, [island])).toBe(island);
  });

  it('returns the nearest island from a set', () => {
    const near = makeIsland(0, 10, 0);
    const far = makeIsland(1, 500, 0);
    const ship = { x: 0, y: 0 };
    expect(nearestIsland(ship, [far, near])).toBe(near);
  });

  it('works with ship position as origin', () => {
    const ship = makeShip(0, 300, 300);
    const close = makeIsland(0, 310, 300); // dist=10
    const distant = makeIsland(1, 100, 100); // dist ~283

    expect(nearestIsland(ship, [distant, close])).toBe(close);
  });
});

// ─── islandsOwnedBy ───────────────────────────────────────────────────────────

describe('islandsOwnedBy', () => {
  const islands = [
    makeIsland(0, 0, 0, 'me'),
    makeIsland(1, 0, 0, 'enemy'),
    makeIsland(2, 0, 0, 'neutral'),
    makeIsland(3, 0, 0, 'me'),
  ];

  it('filters to "me" islands', () => {
    expect(islandsOwnedBy(islands, 'me')).toHaveLength(2);
  });

  it('filters to "enemy" islands', () => {
    expect(islandsOwnedBy(islands, 'enemy')).toHaveLength(1);
  });

  it('filters to "neutral" islands', () => {
    expect(islandsOwnedBy(islands, 'neutral')).toHaveLength(1);
  });

  it('returns empty array when none match', () => {
    expect(islandsOwnedBy([], 'me')).toHaveLength(0);
  });
});

// ─── islandsNotMine ───────────────────────────────────────────────────────────

describe('islandsNotMine', () => {
  it('returns enemy + neutral islands (everything except "me")', () => {
    const islands = [
      makeIsland(0, 0, 0, 'me'),
      makeIsland(1, 0, 0, 'enemy'),
      makeIsland(2, 0, 0, 'neutral'),
    ];
    const notMine = islandsNotMine(islands);
    expect(notMine).toHaveLength(2);
    expect(notMine.every((i) => i.owner !== 'me')).toBe(true);
  });
});

// ─── nearestIslandOwnedBy ─────────────────────────────────────────────────────

describe('nearestIslandOwnedBy', () => {
  it('returns the nearest island matching the owner', () => {
    const ship = { x: 0, y: 0 };
    const islands = [
      makeIsland(0, 50, 0, 'me'),
      makeIsland(1, 10, 0, 'enemy'),
      makeIsland(2, 200, 0, 'me'),
    ];
    const result = nearestIslandOwnedBy(ship, islands, 'me');
    expect(result?.id).toBe(0); // island at (50,0), closer than (200,0)
  });

  it('returns null when no islands match owner', () => {
    const islands = [makeIsland(0, 0, 0, 'neutral')];
    expect(nearestIslandOwnedBy({ x: 0, y: 0 }, islands, 'me')).toBeNull();
  });
});

// ─── nearestEnemy ─────────────────────────────────────────────────────────────

describe('nearestEnemy', () => {
  it('returns null for an empty list', () => {
    expect(nearestEnemy({ x: 0, y: 0 }, [])).toBeNull();
  });

  it('returns null when all enemies are dead', () => {
    const dead = makeShip(0, 50, 0, false);
    expect(nearestEnemy({ x: 0, y: 0 }, [dead])).toBeNull();
  });

  it('returns the nearest alive enemy', () => {
    const close = makeShip(0, 20, 0);
    const far = makeShip(1, 200, 0);
    const dead = makeShip(2, 5, 0, false); // dead — should be excluded
    expect(nearestEnemy({ x: 0, y: 0 }, [far, dead, close])).toBe(close);
  });
});

// ─── shipsNear ────────────────────────────────────────────────────────────────

describe('shipsNear', () => {
  it('returns only alive ships within the given radius', () => {
    const center = { x: 0, y: 0 };
    const inside = makeShip(0, 40, 0); // dist=40, within radius=50
    const onEdge = makeShip(1, 50, 0); // dist=50, exactly on edge (inclusive)
    const outside = makeShip(2, 100, 0); // dist=100, outside
    const dead = makeShip(3, 10, 0, false); // dead — excluded

    const result = shipsNear(center, [inside, onEdge, outside, dead], 50);
    expect(result).toContain(inside);
    expect(result).toContain(onEdge);
    expect(result).not.toContain(outside);
    expect(result).not.toContain(dead);
  });

  it('returns empty array when no ships are within radius', () => {
    const ships = [makeShip(0, 200, 0)];
    expect(shipsNear({ x: 0, y: 0 }, ships, 50)).toHaveLength(0);
  });
});

// ─── shipsSortedByDistance ────────────────────────────────────────────────────

describe('shipsSortedByDistance', () => {
  it('sorts alive ships nearest to furthest', () => {
    const origin = { x: 0, y: 0 };
    const a = makeShip(0, 100, 0);
    const b = makeShip(1, 10, 0);
    const c = makeShip(2, 50, 0);
    const dead = makeShip(3, 5, 0, false);

    const sorted = shipsSortedByDistance(origin, [a, b, c, dead]);
    expect(sorted).toHaveLength(3);
    expect(sorted[0]).toBe(b); // dist=10
    expect(sorted[1]).toBe(c); // dist=50
    expect(sorted[2]).toBe(a); // dist=100
  });
});

// ─── freeShips ────────────────────────────────────────────────────────────────

describe('freeShips', () => {
  it('returns only alive non-capturing ships', () => {
    const ships: BotShip[] = [
      { ...makeShip(0, 0, 0), isCapturing: false },
      { ...makeShip(1, 0, 0), isCapturing: true },
      { ...makeShip(2, 0, 0, false), isCapturing: false }, // dead
    ];
    const result = freeShips(ships);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(0);
  });
});

// ─── wouldDieAt ───────────────────────────────────────────────────────────────

describe('wouldDieAt', () => {
  it('returns true when outnumbered (more enemies than friendlies in radius)', () => {
    const position = { x: 0, y: 0 };
    const myShips: BotShip[] = []; // no friendlies
    const enemyShips: BotShip[] = [makeShip(0, 30, 0)]; // 1 enemy in radius
    expect(wouldDieAt(position, myShips, enemyShips, 50)).toBe(true);
  });

  it('returns false when friendlies match or outnumber enemies', () => {
    const position = { x: 0, y: 0 };
    const myShips: BotShip[] = [makeShip(0, 20, 0)]; // 1 friendly
    const enemyShips: BotShip[] = [makeShip(1, 30, 0)]; // 1 enemy
    expect(wouldDieAt(position, myShips, enemyShips, 50)).toBe(false); // equal → survives
  });

  it('does not count enemies outside the radius', () => {
    const position = { x: 0, y: 0 };
    const myShips: BotShip[] = [];
    const enemyShips: BotShip[] = [makeShip(0, 200, 0)]; // outside radius=50
    expect(wouldDieAt(position, myShips, enemyShips, 50)).toBe(false);
  });

  it('excludes dead ships from count', () => {
    const position = { x: 0, y: 0 };
    const myShips: BotShip[] = [];
    const enemyShips: BotShip[] = [makeShip(0, 10, 0, false)]; // dead
    expect(wouldDieAt(position, myShips, enemyShips, 50)).toBe(false);
  });
});

// ─── aliveCount ───────────────────────────────────────────────────────────────

describe('aliveCount', () => {
  it('counts all alive ships', () => {
    const ships: BotShip[] = [
      makeShip(0, 0, 0, true),
      makeShip(1, 0, 0, false),
      makeShip(2, 0, 0, true),
    ];
    expect(aliveCount(ships)).toBe(2);
  });

  it('with excludeCapturing=true, counts only non-capturing alive ships', () => {
    const ships: BotShip[] = [
      { ...makeShip(0, 0, 0), isCapturing: false },
      { ...makeShip(1, 0, 0), isCapturing: true },
      { ...makeShip(2, 0, 0), isCapturing: false },
    ];
    expect(aliveCount(ships, true)).toBe(2);
  });

  it('returns 0 when all ships are dead', () => {
    const ships: BotShip[] = [makeShip(0, 0, 0, false)];
    expect(aliveCount(ships)).toBe(0);
  });
});

// ─── scoreRate ────────────────────────────────────────────────────────────────

describe('scoreRate (helper mirror of pointsPerTick)', () => {
  it('returns 0 for 0 or negative value', () => {
    expect(scoreRate(0)).toBe(0);
    expect(scoreRate(-5)).toBe(0);
  });

  it('matches the exponential formula', () => {
    expect(scoreRate(1)).toBe(1);
    expect(scoreRate(2)).toBe(2);
    expect(scoreRate(3)).toBe(4);
    expect(scoreRate(5)).toBe(16);
  });
});
