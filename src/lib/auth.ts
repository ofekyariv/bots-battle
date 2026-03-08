import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      // On initial sign-in: user object is present. Upsert into DB and persist UUID.
      if (user?.email) {
        try {
          const [dbUser] = await db
            .insert(users)
            .values({
              name: user.name ?? user.email,
              email: user.email,
              image: user.image ?? null,
            })
            .onConflictDoUpdate({
              target: users.email,
              set: {
                name: user.name ?? user.email,
                image: user.image ?? null,
                updatedAt: new Date(),
              },
            })
            .returning({ id: users.id });

          token.dbId = dbUser.id;
        } catch (err) {
          console.error('[auth] Failed to upsert user in DB:', err);
        }
      }

      // Self-heal stale tokens: if dbId is missing (pre-fix session cookie) but
      // email is present, look up the DB user so session.user.id becomes the
      // correct UUID instead of the OAuth provider's numeric subject.
      if (!token.dbId && token.email) {
        try {
          const [dbUser] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, token.email as string))
            .limit(1);
          if (dbUser) {
            token.dbId = dbUser.id;
          }
        } catch (err) {
          console.error('[auth] Failed to resolve dbId from email:', err);
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        // Use DB UUID (not OAuth provider ID) so it works with uuid FK columns
        session.user.id = (token.dbId as string | undefined) ?? token.sub ?? '';
      }
      return session;
    },
  },
});
