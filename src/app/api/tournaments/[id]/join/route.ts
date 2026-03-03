// ============================================================
// 🏴☠️ POST /api/tournaments/[id]/join — join a tournament
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { tournaments, tournamentEntries, bots } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';

const JoinSchema = z.object({
  botId: z.string().uuid(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 422 });
  }

  const parsed = JoinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const { botId } = parsed.data;

  // Load tournament
  const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  if (tournament.status !== 'open') {
    return NextResponse.json({ error: 'Tournament is not open for registration' }, { status: 409 });
  }

  // Verify bot belongs to user
  const [bot] = await db.select({ id: bots.id, userId: bots.userId }).from(bots).where(eq(bots.id, botId));
  if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  if (bot.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Check user hasn't already joined
  const [existing] = await db
    .select()
    .from(tournamentEntries)
    .where(and(eq(tournamentEntries.tournamentId, id), eq(tournamentEntries.userId, session.user.id)));
  if (existing) return NextResponse.json({ error: 'Already joined' }, { status: 409 });

  // Check not full
  const [{ total }] = await db
    .select({ total: count() })
    .from(tournamentEntries)
    .where(eq(tournamentEntries.tournamentId, id));
  if (total >= tournament.maxPlayers) {
    return NextResponse.json({ error: 'Tournament is full' }, { status: 409 });
  }

  // Join
  const [entry] = await db
    .insert(tournamentEntries)
    .values({ tournamentId: id, userId: session.user.id, botId })
    .returning();

  return NextResponse.json({ entry }, { status: 201 });
}
