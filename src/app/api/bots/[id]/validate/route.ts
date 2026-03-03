import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { bots } from '@/db/schema';
import { eq } from 'drizzle-orm';

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const [bot] = await db
    .select({ id: bots.id, userId: bots.userId, code: bots.code, language: bots.language })
    .from(bots)
    .where(eq(bots.id, id))
    .limit(1);

  if (!bot) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (bot.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const errors: string[] = [];

  // JavaScript/TypeScript: use Function constructor for syntax check
  if (bot.language === 'javascript' || bot.language === 'typescript') {
    try {
      // Strip TypeScript types for syntax check (basic approach)
      const code = bot.code
        .replace(/:\s*\w+(\[\])?(\s*\|[^,;=)]+)*/g, '') // strip type annotations
        .replace(/<[^>]+>/g, '');                         // strip generics
      new Function(code);
    } catch (e) {
      if (e instanceof SyntaxError) {
        errors.push(`Syntax error: ${e.message}`);
      } else {
        errors.push(`Parse error: ${String(e)}`);
      }
    }
  } else {
    // For other languages (Python, Kotlin, Java, C#, Swift), 
    // we can't run a syntax check server-side without a runtime.
    // Return valid with a note.
    return NextResponse.json({
      valid: true,
      note: `Server-side syntax check not available for ${bot.language}. Code will be validated at runtime.`,
    });
  }

  return NextResponse.json({
    valid: errors.length === 0,
    ...(errors.length > 0 && { errors }),
  });
}
