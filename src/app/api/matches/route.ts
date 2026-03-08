// ============================================================
// 🏴☠️ POST /api/matches — create & queue a match
// 🏴☠️ GET  /api/matches — list recent matches (paginated)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { matches, bots } from '@/db/schema';
import { eq, desc, and, or } from 'drizzle-orm';
import { addMatchJob } from '@/server/queue';

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────

const CreateMatchSchema = z.object({
  myBotId: z.string().uuid(),
  opponentBotId: z.string().uuid(),
  config: z.record(z.string(), z.unknown()).optional(),
});

// ─────────────────────────────────────────────
// POST — create match
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 422 });
  }

  const parsed = CreateMatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const { myBotId, opponentBotId, config } = parsed.data;

  // Verify myBot belongs to the current user
  const [myBot] = await db.select({ id: bots.id, userId: bots.userId }).from(bots).where(eq(bots.id, myBotId));
  if (!myBot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  if (myBot.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Verify opponent bot exists
  const [opponentBot] = await db.select({ id: bots.id }).from(bots).where(eq(bots.id, opponentBotId));
  if (!opponentBot) return NextResponse.json({ error: 'Opponent bot not found' }, { status: 404 });

  // Create match record
  const [match] = await db.insert(matches).values({
    status: 'queued',
    player1BotId: myBotId,
    player2BotId: opponentBotId,
    config: config ?? {},
  }).returning({ id: matches.id, status: matches.status, createdAt: matches.createdAt });

  // Enqueue for processing
  await addMatchJob(match.id);

  return NextResponse.json({ matchId: match.id, status: match.status, createdAt: match.createdAt }, { status: 201 });
}

// ─────────────────────────────────────────────
// GET — list matches (paginated)
// ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const userId = searchParams.get('userId'); // filter by user (bot owner)
  const offset = (page - 1) * limit;

  // Build query — join bots to filter by userId if requested
  let query = db
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
      createdAt: matches.createdAt,
      completedAt: matches.completedAt,
    })
    .from(matches)
    .$dynamic();

  // Filter by user's bots if userId provided
  if (userId) {
    const userBots = await db.select({ id: bots.id }).from(bots).where(eq(bots.userId, userId));
    const botIds = userBots.map((b) => b.id);
    if (botIds.length === 0) return NextResponse.json({ matches: [], page, limit, total: 0 });

    // matches where player1 or player2 is one of their bots
    const conditions = botIds.flatMap((id) => [
      eq(matches.player1BotId, id),
      eq(matches.player2BotId, id),
    ]);
    query = query.where(or(...conditions));
  }

  const rows = await query.orderBy(desc(matches.createdAt)).limit(limit).offset(offset);

  return NextResponse.json({ matches: rows, page, limit });
}
