import Link from 'next/link';
import NavLink from './NavLink';
import MobileNav from './MobileNav';
import { ROUTES } from '@/lib/routes';
import AuthButton from '@/components/auth/AuthButton';
import { auth } from '@/lib/auth';

const NAV_ITEMS = [
  { href: ROUTES.play, label: '⚔️ Play' },
  { href: ROUTES.editor, label: '✏️ Editor' },
  { href: ROUTES.tournaments, label: '🏆 Tournaments' },
  { href: ROUTES.leaderboard, label: '📊 Leaderboard' },
  { href: ROUTES.docs, label: '📜 Docs' },
  { href: ROUTES.replays, label: '🎬 Replays' },
] as const;

export default async function Navbar() {
  const session = await auth();

  return (
    <nav
      className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b
        bg-[rgba(10,22,40,0.92)] border-gold/20 backdrop-blur-md
        shadow-[0_2px_16px_rgba(0,0,0,0.4)]"
    >
      {/* Logo */}
      <Link
        href={ROUTES.home}
        className="flex items-center gap-2 font-bold text-xl select-none text-gold font-serif tracking-[0.05em]"
      >
        <span className="drop-shadow-[0_0_8px_rgba(212,168,67,0.6)]">🏴‍☠️</span>
        <span>BOTS BATTLE</span>
      </Link>

      {/* Desktop nav links */}
      <div className="hidden md:flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label }) => (
          <NavLink key={href} href={href}>
            {label}
          </NavLink>
        ))}
        {session?.user && (
          <NavLink href={ROUTES.profile}>🧭 Profile</NavLink>
        )}

        {/* Separator + CTA */}
        <div className="w-px h-5 mx-2 bg-gold/25" />
        <Link
          href={ROUTES.campaign}
          className="px-4 py-1.5 rounded-md text-sm font-bold transition-all hover:scale-105
            bg-gold text-navy shadow-[0_2px_8px_rgba(212,168,67,0.35)]"
        >
          ⚓ Campaign
        </Link>
      </div>

      {/* Auth + Mobile hamburger */}
      <div className="flex items-center gap-3">
        <AuthButton />
        <MobileNav />
      </div>
    </nav>
  );
}
