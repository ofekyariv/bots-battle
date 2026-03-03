// ============================================================
// 🏴☠️ Match Runner Test — Rusher vs Balanced (100 ticks)
// ============================================================

import { describe, it, expect } from 'vitest';
import { runMatch } from '../match-runner';
import { botCode as rusherCode } from '@/bots/rusher';
import { botCode as balancedCode } from '@/bots/balanced';

describe('runMatch', () => {
  it('runs Rusher vs Balanced for 100 ticks and returns valid result', () => {
    const result = runMatch(rusherCode, balancedCode, {
      gameDuration: 100,
    });

    // Should complete without error
    expect(result).toBeDefined();

    // Winner must be one of the valid values
    expect(['player1', 'player2', 'draw']).toContain(result.winner);

    // Scores must be non-negative
    expect(result.scores.player1).toBeGreaterThanOrEqual(0);
    expect(result.scores.player2).toBeGreaterThanOrEqual(0);

    // Should have played up to 100 ticks
    expect(result.ticksPlayed).toBeGreaterThan(0);
    expect(result.ticksPlayed).toBeLessThanOrEqual(100);

    // Duration should be positive
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // Replay should have the right number of ticks
    expect(result.replay.ticks).toHaveLength(result.ticksPlayed);

    // Each tick snapshot should have ships and islands
    const firstTick = result.replay.ticks[0];
    expect(firstTick).toBeDefined();
    expect(firstTick.ships.length).toBeGreaterThan(0);
    expect(firstTick.islands.length).toBeGreaterThan(0);

    // Ships should have valid owner fields
    for (const ship of firstTick.ships) {
      expect(['player1', 'player2']).toContain(ship.owner);
    }

    // Map dimensions should be set
    expect(result.replay.mapWidth).toBeGreaterThan(0);
    expect(result.replay.mapHeight).toBeGreaterThan(0);

    console.log(
      `Rusher vs Balanced — winner: ${result.winner}, ` +
        `scores: ${result.scores.player1} vs ${result.scores.player2}, ` +
        `ticks: ${result.ticksPlayed}, ` +
        `duration: ${result.durationMs}ms`,
    );
  });

  it('handles a bot that always returns idle', () => {
    const idleCode = `
      function createBot() {
        return {
          tick(state, ship) {
            return { type: 'idle' };
          }
        };
      }
    `;

    const result = runMatch(rusherCode, idleCode, { gameDuration: 50 });
    expect(result).toBeDefined();
    expect(result.ticksPlayed).toBeLessThanOrEqual(50);
    // Rusher should win against idle bot (or at least not crash)
    expect(['player1', 'player2', 'draw']).toContain(result.winner);
  });

  it('returns idle for bots with infinite loops (timeout protection)', () => {
    const infiniteCode = `
      function createBot() {
        return {
          tick(state, ship) {
            while(true) {}
          }
        };
      }
    `;

    // Should not hang — the 50ms timeout per tick kicks in
    const start = Date.now();
    const result = runMatch(infiniteCode, rusherCode, { gameDuration: 10 });
    const elapsed = Date.now() - start;

    expect(result).toBeDefined();
    // Should have completed within a reasonable time (10 ticks * 50ms + overhead)
    expect(elapsed).toBeLessThan(10000);
  });
});
