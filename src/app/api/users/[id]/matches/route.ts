import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { matches, bots, users } from '@/db/schema';
import { eq, or, desc, and } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
  const offset = (page - 1) * limit;

  // Get bots for this user
  const userBots = await db
    .select({ id: bots.id })
    .from(bots)
    .where(eq(bots.userId, id));

  if (!userBots.length) {
    return NextResponse.json({ matches: [], total: 0, page, limit });
  }

  const botIds = userBots.map((b) => b.id);

  // We need to join with bots and users to get opponent info
  const bot1 = alias(bots, 'bot1');
  const bot2 = alias(bots, 'bot2');
  const user1 = alias(users, 'user1');
  const user2 = alias(users, 'user2');

  const rows = await db
    .select({
      id: matches.id,
      status: matches.status,
      player1BotId: matches.player1BotId,
      player2BotId: matches.player2BotId,
      winnerBotId: matches.winnerBotId,
      player1Score: matches.player1Score,
      player2Score: matches.player2Score,
      completedAt: matches.completedAt,
      createdAt: matches.createdAt,
      bot1Name: bot1.name,
      bot1Language: bot1.language,
      bot1UserId: bot1.userId,
      bot2Name: bot2.name,
      bot2Language: bot2.language,
      bot2UserId: bot2.userId,
      user1Name: user1.name,
      user1Image: user1.image,
      user2Name: user2.name,
      user2Image: user2.image,
    })
    .from(matches)
    .innerJoin(bot1, eq(matches.player1BotId, bot1.id))
    .innerJoin(bot2, eq(matches.player2BotId, bot2.id))
    .innerJoin(user1, eq(bot1.userId, user1.id))
    .innerJoin(user2, eq(bot2.userId, user2.id))
    .where(
      and(
        eq(matches.status, 'completed'),
        or(
          ...botIds.map((bid) =>
            or(eq(matches.player1BotId, bid), eq(matches.player2BotId, bid)),
          ),
        ),
      ),
    )
    .orderBy(desc(matches.completedAt))
    .limit(limit)
    .offset(offset);

  const formatted = rows.map((row) => {
    const isPlayer1 = botIds.includes(row.player1BotId);
    const myBotId = isPlayer1 ? row.player1BotId : row.player2BotId;
    const won = row.winnerBotId === myBotId;
    const result = row.winnerBotId == null ? 'draw' : won ? 'win' : 'loss';

    return {
      id: row.id,
      result,
      myScore: isPlayer1 ? row.player1Score : row.player2Score,
      opponentScore: isPlayer1 ? row.player2Score : row.player1Score,
      myBotName: isPlayer1 ? row.bot1Name : row.bot2Name,
      myBotLanguage: isPlayer1 ? row.bot1Language : row.bot2Language,
      opponentName: isPlayer1 ? row.user2Name : row.user1Name,
      opponentImage: isPlayer1 ? row.user2Image : row.user1Image,
      opponentBotName: isPlayer1 ? row.bot2Name : row.bot1Name,
      opponentUserId: isPlayer1 ? row.bot2UserId : row.bot1UserId,
      completedAt: row.completedAt,
    };
  });

  return NextResponse.json({ matches: formatted, page, limit });
}
