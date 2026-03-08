import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { bots } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const BOT_LANGUAGES = ['javascript', 'typescript', 'python', 'kotlin', 'java', 'csharp', 'swift'] as const;
const MAX_CODE_BYTES = 50 * 1024;

const UpdateBotSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  language: z.enum(BOT_LANGUAGES).optional(),
  code: z.string().max(MAX_CODE_BYTES, 'Code must be less than 50KB').optional(),
  is_active: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [bot] = await db
    .select()
    .from(bots)
    .where(eq(bots.id, id))
    .limit(1);

  if (!bot) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (bot.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    id: bot.id,
    name: bot.name,
    language: bot.language,
    code: bot.code,
    is_active: bot.isActive,
    version: bot.version,
    created_at: bot.createdAt,
    updated_at: bot.updatedAt,
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
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

  const parsed = UpdateBotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const [existing] = await db
    .select()
    .from(bots)
    .where(eq(bots.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, language, code, is_active } = parsed.data;
  const codeChanged = code !== undefined && code !== existing.code;

  const [updated] = await db
    .update(bots)
    .set({
      ...(name !== undefined && { name }),
      ...(language !== undefined && { language }),
      ...(code !== undefined && { code }),
      ...(is_active !== undefined && { isActive: is_active }),
      ...(codeChanged && { version: existing.version + 1 }),
      updatedAt: new Date(),
    })
    .where(and(eq(bots.id, id), eq(bots.userId, session.user.id)))
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
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [existing] = await db
    .select({ id: bots.id, userId: bots.userId })
    .from(bots)
    .where(eq(bots.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db
    .update(bots)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(bots.id, id), eq(bots.userId, session.user.id)));

  revalidatePath('/profile');
  return NextResponse.json({ success: true });
}
