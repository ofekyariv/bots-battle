// ============================================================
// 🏴☠️ ELO Rating Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { calculateElo } from './elo';

describe('calculateElo', () => {
  it('equal ratings: winner gains, loser loses by same amount', () => {
    const [newWinner, newLoser] = calculateElo(1000, 1000);
    expect(newWinner).toBeGreaterThan(1000);
    expect(newLoser).toBeLessThan(1000);
    expect(newWinner - 1000).toEqual(1000 - newLoser);
  });

  it('equal ratings: gain is half K-factor (16 points for K=32)', () => {
    const [newWinner, newLoser] = calculateElo(1000, 1000, 32);
    expect(newWinner).toBe(1016);
    expect(newLoser).toBe(984);
  });

  it('ratings sum remains roughly constant (within 1 due to rounding)', () => {
    const k = 32;
    const cases: [number, number][] = [
      [1000, 1000],
      [1200, 800],
      [800, 1500],
      [2000, 1000],
      [1000, 2000],
    ];
    for (const [w, l] of cases) {
      const [nw, nl] = calculateElo(w, l, k);
      expect(Math.abs((nw + nl) - (w + l))).toBeLessThanOrEqual(1);
    }
  });

  it('heavily favored winner gains very few points', () => {
    const [newWinner, newLoser] = calculateElo(2000, 1000);
    // Expected win probability is ~99.7%, so winner gains almost nothing
    expect(newWinner - 2000).toBeLessThanOrEqual(2);
    expect(1000 - newLoser).toBeLessThanOrEqual(2);
  });

  it('heavy underdog winning gains many points', () => {
    const [newWinner, newLoser] = calculateElo(1000, 2000);
    expect(newWinner - 1000).toBeGreaterThanOrEqual(30);
    expect(2000 - newLoser).toBeGreaterThanOrEqual(30);
  });

  it('custom K-factor scales the change proportionally', () => {
    const [w16, l16] = calculateElo(1000, 1000, 16);
    const [w32, l32] = calculateElo(1000, 1000, 32);
    expect(w32 - 1000).toBe(2 * (w16 - 1000));
    expect(1000 - l32).toBe(2 * (1000 - l16));
  });

  it('K=0 produces no rating change', () => {
    const [newWinner, newLoser] = calculateElo(1200, 1000, 0);
    expect(newWinner).toBe(1200);
    expect(newLoser).toBe(1000);
  });

  it('returns integers (rounded)', () => {
    const [nw, nl] = calculateElo(1200, 1000);
    expect(Number.isInteger(nw)).toBe(true);
    expect(Number.isInteger(nl)).toBe(true);
  });

  it('handles very high ratings without error', () => {
    expect(() => calculateElo(3000, 3000)).not.toThrow();
    expect(() => calculateElo(0, 3000)).not.toThrow();
  });
});
