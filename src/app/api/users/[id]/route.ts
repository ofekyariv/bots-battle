import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, bots } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      eloRating: users.eloRating,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);

  if (!user.length) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const userBots = await db
    .select({
      id: bots.id,
      name: bots.name,
      language: bots.language,
      version: bots.version,
      isActive: bots.isActive,
      createdAt: bots.createdAt,
      updatedAt: bots.updatedAt,
    })
    .from(bots)
    .where(and(eq(bots.userId, id), eq(bots.isActive, true)));

  return NextResponse.json({ ...user[0], bots: userBots });
}
