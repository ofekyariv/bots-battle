// ============================================================
// 🏴☠️ Tournament Logic Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  generateRoundRobin,
  generateSingleElim,
  generateDoubleElim,
  type TournamentEntry,
} from '../tournament';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function makeEntries(n: number, startElo = 1000): TournamentEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    userId: `user-${i}`,
    botId: `bot-${i}`,
    eloRating: startElo + i * 100, // ascending ELO
  }));
}

// ─────────────────────────────────────────────
// Round Robin
// ─────────────────────────────────────────────

describe('generateRoundRobin', () => {
  it('2 players → 1 pairing', () => {
    expect(generateRoundRobin(makeEntries(2))).toHaveLength(1);
  });

  it('3 players → 3 pairings', () => {
    expect(generateRoundRobin(makeEntries(3))).toHaveLength(3);
  });

  it('4 players → 6 pairings (n*(n-1)/2)', () => {
    expect(generateRoundRobin(makeEntries(4))).toHaveLength(6);
  });

  it('8 players → 28 pairings', () => {
    expect(generateRoundRobin(makeEntries(8))).toHaveLength(28);
  });

  it('all pairings in round 1', () => {
    const pairings = generateRoundRobin(makeEntries(4));
    for (const p of pairings) {
      expect(p.round).toBe(1);
    }
  });

  it('no duplicate pairings', () => {
    const entries = makeEntries(5);
    const pairings = generateRoundRobin(entries);
    const seen = new Set<string>();
    for (const p of pairings) {
      const key = [p.player1BotId, p.player2BotId].sort().join('|');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('each player appears n-1 times', () => {
    const n = 5;
    const entries = makeEntries(n);
    const pairings = generateRoundRobin(entries);
    const counts: Record<string, number> = {};
    for (const p of pairings) {
      counts[p.player1BotId] = (counts[p.player1BotId] ?? 0) + 1;
      counts[p.player2BotId] = (counts[p.player2BotId] ?? 0) + 1;
    }
    for (const entry of entries) {
      expect(counts[entry.botId]).toBe(n - 1);
    }
  });

  it('empty entries returns empty array', () => {
    expect(generateRoundRobin([])).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// Single Elimination
// ─────────────────────────────────────────────

describe('generateSingleElim', () => {
  it('8 players → 4 pairings in round 1', () => {
    expect(generateSingleElim(makeEntries(8))).toHaveLength(4);
  });

  it('4 players → 2 pairings', () => {
    expect(generateSingleElim(makeEntries(4))).toHaveLength(2);
  });

  it('seeding: top seed vs bottom seed (1 vs 8, 2 vs 7, etc.)', () => {
    // Entries with descending ELO so index 0 = best
    const entries: TournamentEntry[] = Array.from({ length: 8 }, (_, i) => ({
      userId: `user-${i}`,
      botId: `bot-${i}`,
      eloRating: 2000 - i * 100, // bot-0 = 2000 (seed 1), bot-7 = 1300 (seed 8)
    }));
    const pairings = generateSingleElim(entries);
    // Seed 1 (bot-0) should face seed 8 (bot-7)
    const seed1Match = pairings.find(
      (p) => p.player1BotId === 'bot-0' || p.player2BotId === 'bot-0',
    );
    expect(seed1Match).toBeDefined();
    const opponent = seed1Match!.player1BotId === 'bot-0' ? seed1Match!.player2BotId : seed1Match!.player1BotId;
    expect(opponent).toBe('bot-7');
  });

  it('bye handling: 5 players (non-power-of-2) → only real matches (no null bots)', () => {
    const pairings = generateSingleElim(makeEntries(5));
    // Padded to 8, but only real players can form matches — should have 2 real matches
    for (const p of pairings) {
      expect(p.player1BotId).toBeTruthy();
      expect(p.player2BotId).toBeTruthy();
    }
    // 5 players padded to 8: bottom 3 are BYEs → 2 real matches (top 3 get byes, 1 match formed from remaining)
    // Actually: seeds 1-5, padded with 3 nulls. Pairs: (1,null),(2,null),(3,null),(4,5) → 1 real match
    expect(pairings.length).toBeGreaterThan(0);
    expect(pairings.length).toBeLessThan(4);
  });

  it('all pairings have bracket = "winners"', () => {
    const pairings = generateSingleElim(makeEntries(4));
    for (const p of pairings) {
      expect(p.bracket).toBe('winners');
    }
  });
});

// ─────────────────────────────────────────────
// Double Elimination
// ─────────────────────────────────────────────

describe('generateDoubleElim', () => {
  it('returns winners bracket round 1 (same structure as single elim)', () => {
    const single = generateSingleElim(makeEntries(8));
    const dbl = generateDoubleElim(makeEntries(8));
    expect(dbl).toHaveLength(single.length);
  });

  it('all pairings have bracket = "winners"', () => {
    const pairings = generateDoubleElim(makeEntries(8));
    for (const p of pairings) {
      expect(p.bracket).toBe('winners');
    }
  });
});
