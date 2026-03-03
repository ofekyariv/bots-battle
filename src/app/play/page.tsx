// 🏴‍☠️ Play Page — pick your bots, configure the match, start the battle
'use client';

import GameSetup from '@/components/GameSetup';
import { Separator } from '@/components/ui';
import { ROUTES } from '@/lib/routes';
import ChallengeButton from '@/components/challenge/ChallengeButton';

export default function PlayPage() {
  return (
    <div className="min-h-screen px-4 py-8 md:px-8 bg-navy">
      {/* ── Page header ─────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-4 mb-2">
          <span className="text-4xl">🏴‍☠️</span>
          <div className="flex-1">
            <h1 className="text-4xl font-black tracking-tight text-gold">Set Sail</h1>
            <p className="text-sm text-foam">
              Choose your algorithm, challenge an opponent, and let the best code win the seas.
            </p>
          </div>
          <ChallengeButton />
        </div>

        {/* Campaign shortcut */}
        <div className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-gold/[0.06] border border-gold/20">
          <span className="text-xl">⚓</span>
          <div className="flex-1">
            <span className="text-sm font-bold text-gold-light">
              Looking for a structured challenge?
            </span>
            <span className="text-sm ml-2 text-foam">
              Try Campaign Mode — 10 levels from Deckhand to Pirate King.
            </span>
          </div>
          <a
            href={ROUTES.campaign}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105 flex-shrink-0 bg-gold text-navy"
          >
            ⚔️ Campaign →
          </a>
        </div>

        {/* Decorative divider */}
        <Separator className="mt-4 bg-[linear-gradient(to_right,transparent,var(--gold-dark)_20%,var(--gold-dark)_80%,transparent)]" />
      </div>

      {/* ── GameSetup form ──────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto">
        <GameSetup />
      </div>
    </div>
  );
}
