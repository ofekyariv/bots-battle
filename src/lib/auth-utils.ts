import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';

/**
 * Get the current server session (returns null if not signed in).
 */
export async function getServerSession(): Promise<Session | null> {
  return auth();
}

/**
 * Require authentication. Redirects to /login if not signed in.
 * Use in Server Components or Server Actions.
 */
export async function requireAuth(): Promise<Session> {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }
  return session;
}
