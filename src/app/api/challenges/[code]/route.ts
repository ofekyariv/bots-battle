// ============================================================
// 🏴☠️ GET  /api/challenges/[code] — get challenge details (public)
// 🏴☠️ POST /api/challenges/[code] — accept a challenge
// ============================================================

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { challenges, bots, users, matches } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { addMatchJob } from '@/server/queue';

// ─────────────────────────────────────────────
// GET — public challenge details
// ─────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const [challenge] = await db.select().from(challenges).where(eq(challenges.code, code));
  if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });

  // Check expiry
  if (challenge.status === 'pending' && new Date() > challenge.expiresAt) {
    await db.update(challenges).set({ status: 'expired' }).where(eq(challenges.id, challenge.id));
    return NextResponse.json({ error: 'Challenge has expired' }, { status: 410 });
  }

  // Load challenger info + bot language
  const [challenger] = await db.select({ id: users.id, name: users.name, image: users.image }).from(users).where(eq(users.id, challenge.challengerId));
  const [challengerBot] = await db.select({ id: bots.id, name: bots.name, language: bots.language }).from(bots).where(eq(bots.id, challenge.challengerBotId));

  return NextResponse.json({
    code: challenge.code,
    status: challenge.status,
    config: challenge.config,
    expiresAt: challenge.expiresAt,
    challenger: challenger ?? null,
    challengerBot: challengerBot ?? null,
    matchId: challenge.matchId,
  });
}

// ─────────────────────────────────────────────
// POST — accept challenge
// ─────────────────────────────────────────────

const AcceptSchema = z.object({
  botId: z.string().uuid(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

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

  const parsed = AcceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const { botId } = parsed.data;

  const [challenge] = await db.select().from(challenges).where(eq(challenges.code, code));
  if (!challenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });

  if (challenge.status !== 'pending') {
    return NextResponse.json({ error: `Challenge is already ${challenge.status}` }, { status: 409 });
  }

  if (new Date() > challenge.expiresAt) {
    await db.update(challenges).set({ status: 'expired' }).where(eq(challenges.id, challenge.id));
    return NextResponse.json({ error: 'Challenge has expired' }, { status: 410 });
  }

  // Can't accept your own challenge
  if (challenge.challengerId === session.user.id) {
    return NextResponse.json({ error: 'Cannot accept your own challenge' }, { status: 400 });
  }

  // Verify the opponent bot belongs to them
  const [opponentBot] = await db.select({ id: bots.id, userId: bots.userId }).from(bots).where(eq(bots.id, botId));
  if (!opponentBot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  if (opponentBot.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Create the match
  const [match] = await db.insert(matches).values({
    status: 'queued',
    player1BotId: challenge.challengerBotId,
    player2BotId: botId,
    config: (challenge.config as Record<string, unknown>) ?? {},
  }).returning({ id: matches.id });

  // Mark challenge as accepted
  await db.update(challenges).set({
    status: 'accepted',
    opponentId: session.user.id,
    opponentBotId: botId,
    matchId: match.id,
  }).where(eq(challenges.id, challenge.id));

  // Enqueue match
  await addMatchJob(match.id);

  return NextResponse.json({ matchId: match.id }, { status: 201 });
}
