// ============================================================
// 🏴☠️ POST /api/tournaments/[id]/start — start tournament
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { tournaments, tournamentEntries, matches, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  generateRoundRobin,
  generateSingleElim,
  generateDoubleElim,
  type TournamentEntry,
} from '@/server/tournament';
import { addMatchJob } from '@/server/queue';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Load tournament
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  if (tournament.creatorId !== session.user.id) {
    return NextResponse.json({ error: 'Only the creator can start the tournament' }, { status: 403 });
  }
  if (tournament.status !== 'open') {
    return NextResponse.json({ error: 'Tournament already started or completed' }, { status: 409 });
  }

  // Load entries with ELO
  const entries = await db
    .select({
      userId: tournamentEntries.userId,
      botId: tournamentEntries.botId,
      eloRating: users.eloRating,
    })
    .from(tournamentEntries)
    .leftJoin(users, eq(tournamentEntries.userId, users.id))
    .where(eq(tournamentEntries.tournamentId, id));

  if (entries.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 participants to start' }, { status: 409 });
  }

  const typedEntries: TournamentEntry[] = entries.map((e) => ({
    userId: e.userId,
    botId: e.botId,
    eloRating: e.eloRating ?? 1000,
  }));

  // Generate pairings
  let pairings;
  switch (tournament.format) {
    case 'round_robin':
      pairings = generateRoundRobin(typedEntries);
      break;
    case 'single_elim':
      pairings = generateSingleElim(typedEntries);
      break;
    case 'double_elim':
      pairings = generateDoubleElim(typedEntries);
      break;
    default:
      return NextResponse.json({ error: 'Unknown format' }, { status: 500 });
  }

  // Mark tournament as in_progress
  await db
    .update(tournaments)
    .set({ status: 'in_progress', startedAt: new Date() })
    .where(eq(tournaments.id, id));

  // Insert all match records and enqueue first round
  const matchValues = pairings.map((p) => ({
    tournamentId: id,
    player1BotId: p.player1BotId,
    player2BotId: p.player2BotId,
    round: p.round,
    status: 'queued' as const,
    config: {},
  }));

  const inserted = await db.insert(matches).values(matchValues).returning({ id: matches.id });

  for (const m of inserted) {
    await addMatchJob(m.id);
  }

  return NextResponse.json({ started: true, matchesCreated: inserted.length });
}
