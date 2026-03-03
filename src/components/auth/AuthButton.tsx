import { auth, signIn, signOut } from '@/lib/auth';
import Image from 'next/image';

export default async function AuthButton() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        {session.user.image && (
          <Image
            src={session.user.image}
            alt={session.user.name ?? 'User avatar'}
            width={28}
            height={28}
            className="rounded-full border border-gold/40"
          />
        )}
        <span className="text-sm text-gold/80 hidden lg:block font-medium">
          {session.user.name}
        </span>
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/' });
          }}
        >
          <button
            type="submit"
            className="ml-1 px-3 py-1 rounded text-xs text-slate-400 hover:text-white
              hover:bg-white/10 transition-colors border border-white/10"
          >
            Sign Out
          </button>
        </form>
      </div>
    );
  }

  return (
    <form
      action={async () => {
        'use server';
        await signIn(undefined, { redirectTo: '/login' });
      }}
    >
      <button
        type="submit"
        className="px-4 py-1.5 rounded-md text-sm font-bold transition-all hover:scale-105
          bg-transparent border border-gold/50 text-gold hover:bg-gold/10
          shadow-[0_0_8px_rgba(212,168,67,0.15)]"
      >
        ⚓ Sign In
      </button>
    </form>
  );
}
