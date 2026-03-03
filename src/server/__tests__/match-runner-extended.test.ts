// ============================================================
// 🏴☠️ Match Runner — Extended Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { runMatch } from '../match-runner';
import { botCode as rusherCode } from '@/bots/rusher';
import { botCode as balancedCode } from '@/bots/balanced';

// ─────────────────────────────────────────────
// Determinism
// ─────────────────────────────────────────────

describe('runMatch — determinism', () => {
  it('same bots + same config → same number of ticks played', () => {
    // Note: map layout may vary between runs (random island placement),
    // so we verify structural determinism (tick count) rather than exact scores.
    const cfg = { gameDuration: 50 };
    const r1 = runMatch(rusherCode, balancedCode, cfg);
    const r2 = runMatch(rusherCode, balancedCode, cfg);
    // Both must produce a valid result
    expect(['player1', 'player2', 'draw']).toContain(r1.winner);
    expect(['player1', 'player2', 'draw']).toContain(r2.winner);
    // Both run for the same number of ticks (game structure is deterministic)
    expect(r1.ticksPlayed).toBe(r2.ticksPlayed);
  });

  it('same bots → identical replay tick count', () => {
    const cfg = { gameDuration: 30 };
    const r1 = runMatch(rusherCode, balancedCode, cfg);
    const r2 = runMatch(rusherCode, balancedCode, cfg);
    expect(r1.replay.ticks).toHaveLength(r2.replay.ticks.length);
  });
});

// ─────────────────────────────────────────────
// Replay data integrity
// ─────────────────────────────────────────────

describe('runMatch — replay data', () => {
  it('replay tick count matches ticksPlayed', () => {
    const result = runMatch(rusherCode, balancedCode, { gameDuration: 40 });
    expect(result.replay.ticks).toHaveLength(result.ticksPlayed);
  });

  it('every tick has required fields', () => {
    const result = runMatch(rusherCode, balancedCode, { gameDuration: 20 });
    for (const tick of result.replay.ticks) {
      expect(typeof tick.tick).toBe('number');
      expect(typeof tick.player1Score).toBe('number');
      expect(typeof tick.player2Score).toBe('number');
      expect(Array.isArray(tick.ships)).toBe(true);
      expect(Array.isArray(tick.islands)).toBe(true);
    }
  });

  it('tick numbers are sequential starting at 1', () => {
    const result = runMatch(rusherCode, balancedCode, { gameDuration: 15 });
    result.replay.ticks.forEach((tick, i) => {
      expect(tick.tick).toBe(i + 1);
    });
  });

  it('replay has map dimensions', () => {
    const result = runMatch(rusherCode, balancedCode, { gameDuration: 10 });
    expect(result.replay.mapWidth).toBeGreaterThan(0);
    expect(result.replay.mapHeight).toBeGreaterThan(0);
  });

  it('replay has result with winner and scores', () => {
    const result = runMatch(rusherCode, balancedCode, { gameDuration: 20 });
    expect(result.replay.result).toBeDefined();
    expect(['player1', 'player2', 'draw']).toContain(result.replay.result.winner);
    expect(typeof result.replay.result.player1Score).toBe('number');
    expect(typeof result.replay.result.player2Score).toBe('number');
  });
});

// ─────────────────────────────────────────────
// Timeout / invalid handling
// ─────────────────────────────────────────────

describe('runMatch — timeout & invalid commands', () => {
  it('infinite loop bot does not hang the match', () => {
    const loopCode = `
      function createBot() {
        return { tick() { while(true){} } };
      }
    `;
    const start = Date.now();
    const result = runMatch(loopCode, rusherCode, { gameDuration: 5 });
    const elapsed = Date.now() - start;
    expect(result).toBeDefined();
    expect(elapsed).toBeLessThan(5000);
  });

  it('garbage-returning bot treated as idle and match completes', () => {
    const garbageCode = `
      function createBot() {
        return { tick() { return 'not a command'; } };
      }
    `;
    const result = runMatch(garbageCode, rusherCode, { gameDuration: 20 });
    expect(['player1', 'player2', 'draw']).toContain(result.winner);
    expect(result.ticksPlayed).toBeGreaterThan(0);
  });

  it('syntax-error bot is handled gracefully', () => {
    const broken = '((((invalid js syntax';
    const result = runMatch(broken, rusherCode, { gameDuration: 10 });
    expect(['player1', 'player2', 'draw']).toContain(result.winner);
  });
});
