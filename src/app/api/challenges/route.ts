// ============================================================
// 🏴☠️ POST /api/challenges — create a 1v1 challenge
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { challenges, bots } from '@/db/schema';
import { eq } from 'drizzle-orm';

const CreateChallengeSchema = z.object({
  botId: z.string().uuid(),
  config: z.record(z.string(), z.unknown()).optional(),
});

function generateCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

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

  const parsed = CreateChallengeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const { botId, config } = parsed.data;

  // Verify bot belongs to this user
  const [bot] = await db.select({ id: bots.id, userId: bots.userId }).from(bots).where(eq(bots.id, botId));
  if (!bot) return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  if (bot.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Generate unique invite code (retry on collision)
  let code: string = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateCode();
    const [existing] = await db.select({ id: challenges.id }).from(challenges).where(eq(challenges.code, code));
    if (!existing) break;
    code = '';
  }
  if (!code) return NextResponse.json({ error: 'Failed to generate unique code' }, { status: 500 });

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

  const [challenge] = await db.insert(challenges).values({
    challengerId: session.user.id,
    challengerBotId: botId,
    code,
    config: config ?? {},
    status: 'pending',
    expiresAt,
  }).returning();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${req.headers.get('host')}`;
  const inviteUrl = `${baseUrl}/challenge/${code}`;

  return NextResponse.json({ challenge, inviteUrl }, { status: 201 });
}
