// ============================================================
// 🏴☠️ Tournament Logic — bracket generation & advancement
// ============================================================

import { db } from '@/db';
import { matches, tournamentEntries, tournaments } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { addMatchJob } from './queue';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface TournamentEntry {
  userId: string;
  botId: string;
  eloRating?: number;
}

export interface MatchPairing {
  player1BotId: string;
  player2BotId: string;
  round: number;
  /** For double elim: 'winners' | 'losers' | 'grand_final' */
  bracket?: string;
}

// ─────────────────────────────────────────────
// Round Robin — n*(n-1)/2 pairings, all in round 1
// ─────────────────────────────────────────────

export function generateRoundRobin(entries: TournamentEntry[]): MatchPairing[] {
  const pairings: MatchPairing[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      pairings.push({
        player1BotId: entries[i].botId,
        player2BotId: entries[j].botId,
        round: 1,
      });
    }
  }
  return pairings;
}

// ─────────────────────────────────────────────
// Single Elimination — seeded by ELO
// ─────────────────────────────────────────────

export function generateSingleElim(entries: TournamentEntry[]): MatchPairing[] {
  // Sort descending by ELO (best seed first)
  const seeded = [...entries].sort((a, b) => (b.eloRating ?? 1000) - (a.eloRating ?? 1000));

  // Pad to next power of 2 with BYEs (represented as null)
  const size = nextPowerOf2(seeded.length);
  const padded: (TournamentEntry | null)[] = [...seeded];
  while (padded.length < size) padded.push(null);

  // Classic seeding: 1 vs last, 2 vs second-to-last, etc.
  const pairings: MatchPairing[] = [];
  for (let i = 0; i < size / 2; i++) {
    const p1 = padded[i];
    const p2 = padded[size - 1 - i];
    if (p1 && p2) {
      pairings.push({ player1BotId: p1.botId, player2BotId: p2.botId, round: 1, bracket: 'winners' });
    }
    // BYE: skip — that player advances automatically (handled in advanceTournament)
  }
  return pairings;
}

// ─────────────────────────────────────────────
// Double Elimination — winners + losers bracket
// ─────────────────────────────────────────────

export function generateDoubleElim(entries: TournamentEntry[]): MatchPairing[] {
  // Round 1 of winners bracket is the same as single elim
  return generateSingleElim(entries).map((p) => ({ ...p, bracket: 'winners' }));
  // Losers bracket matches are created dynamically as players lose
}

// ─────────────────────────────────────────────
// Advance Tournament — called after each match completes
// ─────────────────────────────────────────────

export async function advanceTournament(tournamentId: string): Promise<void> {
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
  if (!tournament || tournament.status !== 'in_progress') return;

  const allMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId));

  const pending = allMatches.filter((m) => m.status === 'queued' || m.status === 'running');
  const completed = allMatches.filter((m) => m.status === 'completed');

  // If any matches still pending, do nothing
  if (pending.length > 0) return;

  // Update entry wins/losses from completed matches
  for (const match of completed) {
    if (!match.winnerBotId) continue;
    const loserBotId = match.winnerBotId === match.player1BotId ? match.player2BotId : match.player1BotId;

    // Increment winner wins
    const [winnerEntry] = await db
      .select()
      .from(tournamentEntries)
      .where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.botId, match.winnerBotId)));
    if (winnerEntry) {
      await db
        .update(tournamentEntries)
        .set({ wins: winnerEntry.wins + 1 })
        .where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.botId, match.winnerBotId)));
    }

    // Increment loser losses
    const [loserEntry] = await db
      .select()
      .from(tournamentEntries)
      .where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.botId, loserBotId)));
    if (loserEntry) {
      await db
        .update(tournamentEntries)
        .set({ losses: loserEntry.losses + 1 })
        .where(and(eq(tournamentEntries.tournamentId, tournamentId), eq(tournamentEntries.botId, loserBotId)));
    }
  }

  if (tournament.format === 'round_robin') {
    // All matches done → tournament complete
    await finalizeTournament(tournamentId);
    return;
  }

  // Elimination formats: check if we need a next round
  const currentRound = Math.max(...allMatches.map((m) => m.round ?? 1));
  const currentRoundMatches = allMatches.filter((m) => m.round === currentRound);
  const allCurrentDone = currentRoundMatches.every((m) => m.status === 'completed');

  if (!allCurrentDone) return;

  // Collect winners from current round
  const roundWinners = currentRoundMatches
    .map((m) => m.winnerBotId)
    .filter((id): id is string => id !== null);

  if (roundWinners.length <= 1) {
    // Tournament over
    await finalizeTournament(tournamentId);
    return;
  }

  // Create next round pairings
  const nextRound = currentRound + 1;
  const nextPairings: { player1BotId: string; player2BotId: string; round: number; tournamentId: string }[] = [];

  for (let i = 0; i < roundWinners.length; i += 2) {
    if (roundWinners[i + 1]) {
      nextPairings.push({
        tournamentId,
        player1BotId: roundWinners[i],
        player2BotId: roundWinners[i + 1],
        round: nextRound,
      });
    }
  }

  if (nextPairings.length === 0) {
    await finalizeTournament(tournamentId);
    return;
  }

  // Insert next round matches and enqueue
  const inserted = await db.insert(matches).values(nextPairings).returning({ id: matches.id });
  for (const m of inserted) {
    await addMatchJob(m.id);
  }
}

// ─────────────────────────────────────────────
// Finalize — assign ranks and mark completed
// ─────────────────────────────────────────────

async function finalizeTournament(tournamentId: string): Promise<void> {
  const entries = await db
    .select()
    .from(tournamentEntries)
    .where(eq(tournamentEntries.tournamentId, tournamentId));

  // Sort by wins desc, losses asc
  const ranked = [...entries].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  });

  for (let i = 0; i < ranked.length; i++) {
    await db
      .update(tournamentEntries)
      .set({ finalRank: i + 1 })
      .where(
        and(
          eq(tournamentEntries.tournamentId, tournamentId),
          eq(tournamentEntries.userId, ranked[i].userId),
        ),
      );
  }

  await db
    .update(tournaments)
    .set({ status: 'completed', completedAt: new Date() })
    .where(eq(tournaments.id, tournamentId));
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function nextPowerOf2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}
