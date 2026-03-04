// ============================================================
// 🏴☠️ ClientProviders — client-side context wrappers
// ============================================================
// Separating this from layout.tsx keeps the root layout as a
// Server Component (required for Next.js Metadata export).
// ============================================================

'use client';

import * as React from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { GameProvider } from '@/lib/GameContext';
import { listBots, saveBot } from '@/lib/api/bots';
import { STARTER_BOT_CODE } from '@/lib/constants/starter-codes';

// ─────────────────────────────────────────────
// Auto-seed Starter Bot for new authenticated users
// ─────────────────────────────────────────────

function StarterBotSeeder({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const seededRef = React.useRef(false);

  React.useEffect(() => {
    if (status !== 'authenticated' || seededRef.current) return;
    seededRef.current = true;

    // Check if the user has any bots; if not, create a Starter Bot
    listBots()
      .then((bots) => {
        if (bots.length === 0) {
          return saveBot({
            name: 'Starter Bot',
            language: 'javascript',
            code: STARTER_BOT_CODE,
          });
        }
      })
      .catch(() => {
        // Silently ignore — not critical
      });
  }, [status, session]);

  return <>{children}</>;
}

// ─────────────────────────────────────────────
// Exported provider wrapper
// ─────────────────────────────────────────────

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <GameProvider>
        <StarterBotSeeder>{children}</StarterBotSeeder>
      </GameProvider>
    </SessionProvider>
  );
}
