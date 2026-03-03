// ============================================================
// 🏴☠️ GET /api/matches/:id — match details + replay data
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { matches, bots } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [match] = await db
    .select({
      id: matches.id,
      status: matches.status,
      player1BotId: matches.player1BotId,
      player2BotId: matches.player2BotId,
      winnerBotId: matches.winnerBotId,
      player1Score: matches.player1Score,
      player2Score: matches.player2Score,
      ticksPlayed: matches.ticksPlayed,
      durationMs: matches.durationMs,
      replayKey: matches.replayKey,
      config: matches.config,
      tournamentId: matches.tournamentId,
      round: matches.round,
      createdAt: matches.createdAt,
      completedAt: matches.completedAt,
    })
    .from(matches)
    .where(eq(matches.id, id));

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  // Attach bot names for convenience
  const botIds = [match.player1BotId, match.player2BotId].filter(Boolean);
  const botRows = await db
    .select({ id: bots.id, name: bots.name, language: bots.language, userId: bots.userId })
    .from(bots)
    .where(eq(bots.id, botIds[0]!)); // fetch individually to avoid IN() complexities
  const bot2Rows = await db
    .select({ id: bots.id, name: bots.name, language: bots.language, userId: bots.userId })
    .from(bots)
    .where(eq(bots.id, botIds[1]!));
  const allBots = [...botRows, ...bot2Rows];
  const botMap = Object.fromEntries(allBots.map((b) => [b.id, b]));

  // Decode inline replay (stored as JSON string in replayKey when small)
  let replay: unknown = null;
  if (match.replayKey && match.replayKey.startsWith('{')) {
    try {
      replay = JSON.parse(match.replayKey);
    } catch {
      replay = null;
    }
  }

  return NextResponse.json({
    ...match,
    player1Bot: botMap[match.player1BotId] ?? null,
    player2Bot: botMap[match.player2BotId] ?? null,
    replay,
  });
}
