// ============================================================
// 🏴☠️ GET /api/tournaments/[id] — tournament details
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tournaments, tournamentEntries, matches, bots, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Entries with user + bot info
  const entries = await db
    .select({
      userId: tournamentEntries.userId,
      botId: tournamentEntries.botId,
      finalRank: tournamentEntries.finalRank,
      wins: tournamentEntries.wins,
      losses: tournamentEntries.losses,
      joinedAt: tournamentEntries.joinedAt,
      userName: users.name,
      userImage: users.image,
      botName: bots.name,
      eloRating: users.eloRating,
    })
    .from(tournamentEntries)
    .leftJoin(users, eq(tournamentEntries.userId, users.id))
    .leftJoin(bots, eq(tournamentEntries.botId, bots.id))
    .where(eq(tournamentEntries.tournamentId, id));

  // All matches for this tournament
  const tournamentMatches = await db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, id));

  return NextResponse.json({ tournament, entries, matches: tournamentMatches });
}
