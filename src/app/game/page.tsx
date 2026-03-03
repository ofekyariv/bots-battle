// ============================================================
// 🏴‍☠️ /game — Live Battle Page (thin wrapper)
//
// Flow:
//  1. Read bot codes + config from GameContext
//  2. Guard: redirect to /play if no valid setup
//  3. Convert BotSources, derive names, wire campaign + rematch
//  4. Delegate rendering to <GameRunner>
// ============================================================
'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { useGameContext } from '@/lib/GameContext';
import { BOT_REGISTRY } from '@/bots/index';
import { ROUTES } from '@/lib/routes';
import { toUseBotSource, getBotName } from '@/lib/bot-utils';
import { useCampaignGame } from '@/components/game/useCampaignGame';
import GameRunner from '@/components/game/GameRunner';

export default function GamePage() {
  const router = useRouter();
  const { setup, isReady, setReady, updatePlayer1, updatePlayer2, updateConfig } = useGameContext();

  // ── Rematch / Switch Opponent state ──────────────────────
  const [gameKey, setGameKey] = useState(0);
  const bumpGameKey = useCallback(() => setGameKey((k) => k + 1), []);

  // ── Campaign hook ─────────────────────────────────────────
  const {
    campaignPending,
    campaignContinueLabel,
    campaignContinueFn,
    handleCampaignResult,
    resetCampaignForRematch,
  } = useCampaignGame(setReady, { updatePlayer1, updatePlayer2, updateConfig }, bumpGameKey);
  const [currentOpponentId, setCurrentOpponentId] = useState<string>(() =>
    setup.player2.botSource.type === 'preset' ? setup.player2.botSource.id : '',
  );

  // Track whether we entered from campaign (stable across the session)
  const enteredFromCampaign = useRef(!!campaignPending);

  // ── Guard: redirect if no valid setup ────────────────────
  useEffect(() => {
    if (!isReady) router.replace(enteredFromCampaign.current ? ROUTES.campaign : ROUTES.play);
  }, [isReady, router]);
  const handleBackToSetup = useCallback(() => {
    setReady(false);
    router.push(enteredFromCampaign.current ? ROUTES.campaign : ROUTES.play);
  }, [router, setReady]);

  // ── Rematch ───────────────────────────────────────────────
  const handleRematch = useCallback(() => {
    resetCampaignForRematch();
    setGameKey((k) => k + 1);
  }, [resetCampaignForRematch]);

  // ── Switch Opponent (by bot ID) ──────────────────────────
  const handleSwitchOpponent = useCallback((botId: string) => {
    setCurrentOpponentId(botId);
    updatePlayer2({ type: 'preset', id: botId });
    setGameKey((k) => k + 1);
  }, [updatePlayer2]);

  // ── Derived values ────────────────────────────────────────
  const showSwitchOpponent = setup.player2.botSource.type === 'preset';
  const nextOpponentName = (() => {
    if (!currentOpponentId) return undefined;
    const idx = BOT_REGISTRY.findIndex((b) => b.id === currentOpponentId);
    if (idx === -1) return undefined;
    return BOT_REGISTRY[(idx + 1) % BOT_REGISTRY.length].name;
  })();

  // ── Loading / redirect guard ──────────────────────────────
  if (!isReady) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: '#010810' }}
      >
        <p className="text-sm font-mono" style={{ color: '#475569' }}>
          Redirecting to setup…
        </p>
      </div>
    );
  }

  // ── Convert sources + names ───────────────────────────────
  const bot1Source = toUseBotSource(
    setup.player1.botSource as { type: string; id?: string; code?: string },
  );
  const bot2Source = toUseBotSource(
    setup.player2.botSource as { type: string; id?: string; code?: string },
  );
  const player1Name = getBotName(setup.player1.botSource as { type: string; id?: string; savedBotId?: string });
  const player2Name = getBotName(setup.player2.botSource as { type: string; id?: string; savedBotId?: string });

  const savedBotId =
    setup.player1.botSource.type === 'custom'
      ? (setup.player1.botSource as { type: 'custom'; code: string; savedBotId?: string })
          .savedBotId
      : undefined;
  const opponentId =
    setup.player2.botSource.type === 'preset' ? setup.player2.botSource.id : undefined;

  return (
    <GameRunner
      key={gameKey}
      player1Name={player1Name}
      player2Name={player2Name}
      bot1Source={bot1Source}
      bot2Source={bot2Source}
      config={setup.config}
      onBackToSetup={handleBackToSetup}
      onRematch={handleRematch}
      onSwitchOpponent={showSwitchOpponent ? handleSwitchOpponent : undefined}
      nextOpponentName={showSwitchOpponent ? nextOpponentName : undefined}
      currentOpponentId={currentOpponentId}
      savedBotId={savedBotId}
      opponentId={opponentId}
      campaignPending={campaignPending}
      onCampaignResult={campaignPending ? handleCampaignResult : undefined}
      campaignContinueLabel={campaignContinueLabel}
      onCampaignContinue={campaignContinueFn}
    />
  );
}
