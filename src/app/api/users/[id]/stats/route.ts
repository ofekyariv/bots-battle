import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, bots, users } from '@/db/schema';
import { eq, or, and, sql } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Verify user exists
  const user = await db
    .select({ eloRating: users.eloRating })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user.length) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Get all bots for this user
  const userBots = await db
    .select({ id: bots.id, language: bots.language })
    .from(bots)
    .where(eq(bots.userId, id));

  if (!userBots.length) {
    return NextResponse.json({
      totalMatches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      currentElo: user[0].eloRating,
      favoriteLanguage: null,
    });
  }

  const botIds = userBots.map((b) => b.id);

  // Fetch completed matches involving this user's bots
  const allMatches = await db
    .select({
      player1BotId: matches.player1BotId,
      player2BotId: matches.player2BotId,
      winnerBotId: matches.winnerBotId,
    })
    .from(matches)
    .where(
      and(
        eq(matches.status, 'completed'),
        or(
          ...botIds.map((bid) =>
            or(eq(matches.player1BotId, bid), eq(matches.player2BotId, bid)),
          ),
        ),
      ),
    );

  let wins = 0;
  let losses = 0;
  let draws = 0;

  for (const m of allMatches) {
    const isPlayer1 = botIds.includes(m.player1BotId);
    const myBotId = isPlayer1 ? m.player1BotId : m.player2BotId;
    if (m.winnerBotId == null) {
      draws++;
    } else if (m.winnerBotId === myBotId) {
      wins++;
    } else {
      losses++;
    }
  }

  const totalMatches = wins + losses + draws;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  // Favorite language: language of the most-used bot (by match count)
  const langCount: Record<string, number> = {};
  for (const m of allMatches) {
    const isPlayer1 = botIds.includes(m.player1BotId);
    const myBotId = isPlayer1 ? m.player1BotId : m.player2BotId;
    const bot = userBots.find((b) => b.id === myBotId);
    if (bot) {
      langCount[bot.language] = (langCount[bot.language] ?? 0) + 1;
    }
  }
  const favoriteLanguage =
    Object.entries(langCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return NextResponse.json({
    totalMatches,
    wins,
    losses,
    draws,
    winRate,
    currentElo: user[0].eloRating,
    favoriteLanguage,
  });
}
