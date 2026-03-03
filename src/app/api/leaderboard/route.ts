// ============================================================
// 🏴☠️ GET /api/leaderboard — paginated ELO rankings
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, bots, matches } from '@/db/schema';
import { eq, or, and, sql, desc, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '25', 10)));
  const timeframe = searchParams.get('timeframe') ?? 'all'; // all | month | week
  const offset = (page - 1) * limit;

  // Determine cutoff date for timeframe filtering
  let cutoffDate: Date | null = null;
  const now = new Date();
  if (timeframe === 'week') {
    cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (timeframe === 'month') {
    cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // Fetch all users sorted by ELO
  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      eloRating: users.eloRating,
    })
    .from(users)
    .orderBy(desc(users.eloRating))
    .limit(limit)
    .offset(offset);

  const totalUsers = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);

  const total = Number(totalUsers[0]?.count ?? 0);

  // For each user, compute wins/losses from matches (respecting timeframe)
  const enriched = await Promise.all(
    allUsers.map(async (user, idx) => {
      const rank = offset + idx + 1;

      // Get user's bot ids
      const userBots = await db
        .select({ id: bots.id, name: bots.name, language: bots.language })
        .from(bots)
        .where(eq(bots.userId, user.id));

      if (!userBots.length) {
        return {
          rank,
          id: user.id,
          name: user.name,
          image: user.image,
          elo: user.eloRating,
          wins: 0,
          losses: 0,
          winRate: 0,
          topBot: null,
        };
      }

      const botIds = userBots.map((b) => b.id);

      const matchFilter = and(
        eq(matches.status, 'completed'),
        or(
          ...botIds.map((bid) =>
            or(eq(matches.player1BotId, bid), eq(matches.player2BotId, bid)),
          ),
        ),
        cutoffDate
          ? sql`${matches.createdAt} >= ${cutoffDate.toISOString()}`
          : undefined,
      );

      const allMatchRows = await db
        .select({
          player1BotId: matches.player1BotId,
          player2BotId: matches.player2BotId,
          winnerBotId: matches.winnerBotId,
        })
        .from(matches)
        .where(matchFilter);

      let wins = 0;
      let losses = 0;

      for (const m of allMatchRows) {
        const isP1 = botIds.includes(m.player1BotId);
        const myBotId = isP1 ? m.player1BotId : m.player2BotId;
        if (m.winnerBotId == null) continue; // draw — skip
        if (m.winnerBotId === myBotId) wins++;
        else losses++;
      }

      const total = wins + losses;
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

      // Top bot: the bot with the most wins
      const botWins: Record<string, number> = {};
      for (const m of allMatchRows) {
        if (m.winnerBotId && botIds.includes(m.winnerBotId)) {
          botWins[m.winnerBotId] = (botWins[m.winnerBotId] ?? 0) + 1;
        }
      }
      const topBotId = Object.entries(botWins).sort((a, b) => b[1] - a[1])[0]?.[0];
      const topBot = topBotId
        ? userBots.find((b) => b.id === topBotId) ?? userBots[0]
        : userBots[0];

      return {
        rank,
        id: user.id,
        name: user.name,
        image: user.image,
        elo: user.eloRating,
        wins,
        losses,
        winRate,
        topBot: topBot
          ? { name: topBot.name, language: topBot.language }
          : null,
      };
    }),
  );

  return NextResponse.json({
    data: enriched,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
