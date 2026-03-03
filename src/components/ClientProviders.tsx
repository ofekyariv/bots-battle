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
import { BotMigrationModal } from '@/components/auth/BotMigrationModal';
import { detectLocalBots, isMigrationComplete } from '@/lib/migration';

// ─────────────────────────────────────────────
// Inner component — needs SessionProvider above it
// ─────────────────────────────────────────────

function MigrationGate({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [showModal, setShowModal] = React.useState(false);

  React.useEffect(() => {
    // Only show after session is confirmed and user is logged in
    if (status !== 'authenticated') return;
    if (isMigrationComplete()) return;

    const localBots = detectLocalBots();
    if (localBots.length > 0) {
      setShowModal(true);
    } else {
      // No local bots — nothing to migrate, mark done silently
      // (don't mark complete so future bots could still be caught)
    }
  }, [status, session]);

  return (
    <>
      {showModal && (
        <BotMigrationModal onDone={() => setShowModal(false)} />
      )}
      {children}
    </>
  );
}

// ─────────────────────────────────────────────
// Exported provider wrapper
// ─────────────────────────────────────────────

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <GameProvider>
        <MigrationGate>{children}</MigrationGate>
      </GameProvider>
    </SessionProvider>
  );
}
