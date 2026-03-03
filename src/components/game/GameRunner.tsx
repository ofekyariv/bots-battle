// ─────────────────────────────────────────────────────────────
// GameRunner — renders an active game session
//
// Requires valid bot sources (ensured by the parent page).
// Handles: auto-start, result recording, replay saving, controls.
// ─────────────────────────────────────────────────────────────
'use client';

import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { useGame, type BotSource as UseGameBotSource } from '@/lib/useGame';
import { ROUTES } from '@/lib/routes';
import { recordMatchResult, recordPlayerResult } from '@/lib/storage';
import { saveReplay } from '@/lib/replay';
import type { CampaignPending } from '@/lib/campaign';
import { getUnlockedBotIds } from '@/lib/campaign';
import { BOT_REGISTRY } from '@/bots/index';
import type { GameSpeed, OpponentOption } from '@/components/GameControls';
import type { GameConfig } from '@/engine/types';

import GameCanvas, { type CameraMode } from '@/components/GameCanvas';
import ScoreHUD from '@/components/ScoreHUD';
import GameControls from '@/components/GameControls';
import GameOverModal from '@/components/GameOverModal';

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────

export interface GameRunnerProps {
  player1Name: string;
  player2Name: string;
  bot1Source: UseGameBotSource;
  bot2Source: UseGameBotSource;
  config: GameConfig;
  onBackToSetup: () => void;
  onRematch: () => void;
  onSwitchOpponent?: (botId: string) => void;
  nextOpponentName?: string;
  currentOpponentId?: string;
  /** If player1 is using a saved custom bot, pass its id to track win/loss */
  savedBotId?: string;
  /** Pre-built opponent registry id — used to track global player records */
  opponentId?: string;
  /** Campaign context if in campaign mode */
  campaignPending?: CampaignPending | null;
  /** Called with 'win'/'loss'/'draw' after game ends */
  onCampaignResult?: (outcome: 'win' | 'loss' | 'draw') => void;
  /** Label for the campaign "continue" button in GameOverModal */
  campaignContinueLabel?: string;
  /** Handler for "Next Challenge" or "Level Complete" button */
  onCampaignContinue?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export default function GameRunner({
  player1Name,
  player2Name,
  bot1Source,
  bot2Source,
  config,
  onBackToSetup,
  onRematch,
  onSwitchOpponent,
  nextOpponentName,
  currentOpponentId,
  savedBotId,
  opponentId,
  campaignPending,
  onCampaignResult,
  campaignContinueLabel,
  onCampaignContinue,
}: GameRunnerProps) {
  const game = useGame(bot1Source, bot2Source, { gameConfig: config });

  // Destructure stable callbacks so useCallback deps don't capture the whole
  // game object (which is a new reference on every render). The functions
  // themselves are stable (wrapped in useCallback inside useGame).
  const { start, pause, resume, restart, setSpeed, isPaused } = game;

  // ── Auto-start on mount (retries for async bots like Kotlin/Python) ──
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 100; // 20s max wait
    let cleanupId: ReturnType<typeof setTimeout>;
    const tryStart = () => {
      if (cancelled || attempts >= maxAttempts) return;
      attempts++;
      start();
      // Retry until game starts (engine may still be compiling)
      cleanupId = setTimeout(tryStart, 200);
    };
    // Initial delay lets the first engine tick emit
    cleanupId = setTimeout(tryStart, 80);
    return () => {
      cancelled = true;
      clearTimeout(cleanupId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only once on mount

  // ── Record match result when game ends ───────────────────
  const gs = game.gameState;
  const resultRef = useRef<boolean>(false);
  const [savedReplayId, setSavedReplayId] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('dynamic');

  useEffect(() => {
    if (!gs?.result) return;
    if (resultRef.current) return; // only record once
    resultRef.current = true;

    const winner = gs.result.winner;
    const outcome = winner === 'player1' ? 'win' : winner === 'draw' ? 'draw' : 'loss';

    // Track per-bot win/loss (for saved custom bots)
    if (savedBotId) {
      recordMatchResult(savedBotId, player2Name, outcome);
    }
    // Track global player record vs pre-built opponents
    if (opponentId) {
      recordPlayerResult(opponentId, outcome);
    }
    // Campaign result tracking
    if (campaignPending && onCampaignResult) {
      onCampaignResult(outcome);
    }
    // Auto-save replay
    const frames = game.getReplayFrames();
    if (frames.length > 0) {
      const replayId = saveReplay(frames, {
        player1Name,
        player2Name,
        result: gs.result,
        totalTicks: gs.result.totalTicks,
        tickRateMs: config.tickRateMs ?? 100,
      });
      if (replayId) setSavedReplayId(replayId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs?.result]);

  // ── Replay handler ───────────────────────────────────────
  const router = useRouter();
  const handleWatchReplay = useCallback(() => {
    if (savedReplayId) {
      router.push(`${ROUTES.replays}/${savedReplayId}`);
    }
  }, [savedReplayId, router]);

  // ── Play/Pause + Restart + Speed ────────────────────────
  // Note: pause, resume, restart, start, setSpeed are stable refs from
  // useCallback inside useGame. Destructured above to avoid capturing
  // the whole `game` object as a dep (which changes every render).
  const handlePlayPause = useCallback(() => {
    if (isPaused) {
      resume();
    } else {
      pause();
    }
  }, [isPaused, pause, resume]);

  const handleRestart = useCallback(() => {
    restart();
    // restart() does NOT auto-start; kick it off again
    setTimeout(() => start(), 80);
  }, [restart, start]);

  const handleSpeedChange = useCallback(
    (s: GameSpeed) => {
      setSpeed(s);
    },
    [setSpeed],
  );

  const handleQuit = useCallback(() => {
    pause();
    router.push(campaignPending ? ROUTES.campaign : ROUTES.play);
  }, [pause, router, campaignPending]);

  // ── Keyboard: Space = play/pause ──────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlePlayPause]);

  // ── Derived values ───────────────────────────────────────
  const gameStatus = gs?.status ?? 'idle';
  const isFinished = gameStatus === 'finished';
  const isCampaignMode = !!campaignPending;
  const backLabel = isCampaignMode ? 'Back to Campaign' : undefined;

  // ── Opponent dropdown options (free play only) ──────────
  const opponentOptions: OpponentOption[] = useMemo(() => {
    if (isCampaignMode) return [];
    const unlocked = getUnlockedBotIds();
    return BOT_REGISTRY.map(bot => ({
      id: bot.id,
      name: bot.name,
      locked: !unlocked.has(bot.id),
    }));
  }, [isCampaignMode]);

  // ── Error state ──────────────────────────────────────────
  if (game.error) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-4 text-center p-8"
        style={{ background: 'var(--navy)' }}
      >
        <span className="text-5xl">⚠️</span>
        <h2 className="text-2xl font-bold" style={{ color: '#f87171' }}>
          Bot Error
        </h2>
        <p className="text-sm max-w-md font-mono" style={{ color: '#94a3b8' }}>
          {game.error}
        </p>
        <button
          onClick={onBackToSetup}
          className="mt-4 px-6 py-2 rounded-lg text-sm font-semibold"
          style={{
            background: 'rgba(30,41,59,0.8)',
            border: '1px solid rgba(100,116,139,0.4)',
            color: '#94a3b8',
          }}
        >
          ← Back to Setup
        </button>
      </div>
    );
  }

  // ── Loading state (waiting for first tick) ───────────────
  if (!gs) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: '#010810' }}
      >
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl animate-spin">⚓</span>
          <p className="text-sm font-mono" style={{ color: '#475569' }}>
            Launching battle…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#010810', zIndex: 50 }}>
      {/* ── ScoreHUD — fixed top bar ─────────────────────── */}
      <div className="shrink-0 relative z-10 px-3 pt-3 pb-2">
        {/* Campaign badge */}
        {isCampaignMode && campaignPending && (
          <div
            className="absolute top-1 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold"
            style={{
              background: 'rgba(5, 12, 30, 0.9)',
              backdropFilter: 'blur(8px)',
              color: '#fbbf24',
              border: '1px solid rgba(212,175,55,0.4)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              pointerEvents: 'none',
            }}
          >
            ⚓ Campaign — Level {campaignPending.level}
          </div>
        )}
        <ScoreHUD gameState={gs} player1Name={player1Name} player2Name={player2Name} />
      </div>

      {/* ── Canvas — fills remaining space ────────────────── */}
      <div className="flex-1 relative min-h-0">
        <GameCanvas gameState={gs} mapWidth={config.mapWidth} mapHeight={config.mapHeight} cameraMode={cameraMode} />

      </div>

      {/* ── GameControls — fixed bottom bar ─────────────── */}
      <div className="shrink-0 z-10 flex items-center justify-center px-3 pt-2 pb-3">
        <GameControls
          speed={game.speed as GameSpeed}
          isPaused={game.isPaused}
          status={gameStatus}
          onSpeedChange={handleSpeedChange}
          onPlayPause={handlePlayPause}
          onRestart={handleRestart}
          opponents={!isCampaignMode ? opponentOptions : undefined}
          currentOpponentId={currentOpponentId}
          onSwitchOpponent={!isCampaignMode ? onSwitchOpponent : undefined}
          cameraMode={cameraMode}
          onCameraModeChange={setCameraMode}
          onQuit={handleQuit}
        />
      </div>

      {/* ── GameOverModal ──────────────────────────────────── */}
      {isFinished && gs.result && (
        <GameOverModal
          result={gs.result}
          scoreHistory={game.scoreHistory}
          gameEvents={game.gameEvents}
          gameStats={game.gameStats}
          player1Name={player1Name}
          player2Name={player2Name}
          targetScore={config.targetScore}
          tickRateMs={config.tickRateMs}
          onPlayAgain={onRematch}
          onBackToSetup={onBackToSetup}
          onWatchReplay={savedReplayId ? handleWatchReplay : undefined}
          onSwitchOpponent={undefined}
          nextOpponentName={undefined}
          backToSetupLabel={backLabel}
          // Campaign extras
          isCampaignMode={isCampaignMode}
          campaignContinueLabel={campaignContinueLabel}
          onCampaignContinue={onCampaignContinue}
        />
      )}
    </div>
  );
}
