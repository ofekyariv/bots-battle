// ============================================================
// 🏴☠️ POST /api/tournaments — create tournament
// 🏴☠️ GET  /api/tournaments — list tournaments
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { tournaments, tournamentEntries, bots } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

// ─────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────

const CreateTournamentSchema = z.object({
  name: z.string().min(1).max(128),
  format: z.enum(['round_robin', 'single_elim', 'double_elim']),
  maxPlayers: z.number().int().min(2).max(64).default(10),
  config: z.record(z.string(), z.unknown()).optional(),
  botId: z.string().uuid(), // creator must supply a bot to auto-join
});

// ─────────────────────────────────────────────
// POST — create tournament
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

  const parsed = CreateTournamentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const { name, format, maxPlayers, config, botId } = parsed.data;

  // Verify bot belongs to this user
  const [bot] = await db.select({ id: bots.id, userId: bots.userId }).from(bots).where(eq(bots.id, botId));
  if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  if (bot.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Create tournament
  const [tournament] = await db
    .insert(tournaments)
    .values({
      name,
      format,
      maxPlayers,
      config: config ?? {},
      creatorId: session.user.id,
      status: 'open',
    })
    .returning();

  // Auto-join creator
  await db.insert(tournamentEntries).values({
    tournamentId: tournament.id,
    userId: session.user.id,
    botId,
  });

  return NextResponse.json({ tournament }, { status: 201 });
}

// ─────────────────────────────────────────────
// GET — list tournaments
// ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') as 'open' | 'in_progress' | 'completed' | null;

  let query = db.select().from(tournaments).$dynamic();
  if (status) {
    query = query.where(eq(tournaments.status, status));
  }

  const rows = await query.orderBy(desc(tournaments.createdAt)).limit(50);
  return NextResponse.json({ tournaments: rows });
}
