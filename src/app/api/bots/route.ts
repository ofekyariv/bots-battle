import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { bots } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';

const BOT_LANGUAGES = ['javascript', 'typescript', 'python', 'kotlin', 'java', 'csharp', 'swift'] as const;
const MAX_CODE_BYTES = 50 * 1024; // 50KB

const CreateBotSchema = z.object({
  name: z.string().min(1).max(64),
  language: z.enum(BOT_LANGUAGES),
  code: z.string().max(MAX_CODE_BYTES, 'Code must be less than 50KB'),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userBots = await db
    .select({
      id: bots.id,
      name: bots.name,
      language: bots.language,
      is_active: bots.isActive,
      version: bots.version,
      created_at: bots.createdAt,
      updated_at: bots.updatedAt,
    })
    .from(bots)
    .where(and(eq(bots.userId, session.user.id), eq(bots.isActive, true)));

  return NextResponse.json(userBots);
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

  const parsed = CreateBotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const { name, language, code } = parsed.data;

  // Enforce 10-bot limit
  const [{ total }] = await db
    .select({ total: count() })
    .from(bots)
    .where(and(eq(bots.userId, session.user.id), eq(bots.isActive, true)));

  if (total >= 10) {
    return NextResponse.json(
      { error: 'Bot limit reached. You can have at most 10 active bots.' },
      { status: 422 },
    );
  }

  const [created] = await db
    .insert(bots)
    .values({
      userId: session.user.id,
      name,
      language,
      code,
      version: 1,
      isActive: true,
    })
    .returning({
      id: bots.id,
      name: bots.name,
      language: bots.language,
      is_active: bots.isActive,
      version: bots.version,
      created_at: bots.createdAt,
      updated_at: bots.updatedAt,
    });

  revalidatePath('/profile');
  return NextResponse.json(created, { status: 201 });
}
