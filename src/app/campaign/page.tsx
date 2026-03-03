// ============================================================
// 🏴‍☠️ Campaign Page — Progressive Difficulty Levels
// ============================================================
// RPG-style quest line with 10 levels.
// Progress tracked in localStorage.
// Custom bots only — no pre-built bots allowed.
// Launching a challenge stores campaign pending context + navigates to /game.
// ============================================================
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/routes';
import {
  CAMPAIGN_LEVELS,
  getCampaignProgress,
  isLevelComplete,
  getLevelConfig,
  setCampaignPending,
  resetCampaignProgress,
} from '@/lib/campaign';
import type { CampaignProgress as CampaignProgressData } from '@/lib/campaign';
import { getBotById as getStoredBotById, listBots } from '@/lib/storage';
// PlayerBotBadge no longer needed (CampaignFleet handles display)
import { useGameContext } from '@/lib/GameContext';
import { cn } from '@/lib/utils';

import { LevelCard } from '@/components/campaign/LevelCard';
import { CampaignProgress } from '@/components/campaign/CampaignProgress';
import { CampaignFleet, getCampaignSelectedBot, setCampaignSelectedBot } from '@/components/campaign/BotSelectionModal';
import { VictoryFlash } from '@/components/campaign/VictoryFlash';

// ─── Main Page ───────────────────────────────────────────────

export default function CampaignPage() {
  const router = useRouter();
  const { updatePlayer1, updatePlayer2, updateConfig, setReady } = useGameContext();

  const [progress, setProgress] = useState<CampaignProgressData>(() => getCampaignProgress());
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);
  const [playerBotId, setPlayerBotId] = useState<string>('');
  const [victoryMessage, setVictoryMessage] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [customBots, setCustomBots] = useState<ReturnType<typeof listBots>>([]);

  // Initialize: load bots, restore last selection, expand current level
  useEffect(() => {
    const p = getCampaignProgress();
    setProgress(p);
    setExpandedLevel(p.currentLevel);

    setCustomBots(listBots());

    // Check for victory message from returning game
    const victoryRaw =
      typeof window !== 'undefined' ? sessionStorage.getItem('bots-battle:campaign-victory') : null;
    if (victoryRaw) {
      sessionStorage.removeItem('bots-battle:campaign-victory');
      setVictoryMessage(victoryRaw);
    }
  }, []);

  const handleToggleLevel = useCallback((levelNum: number) => {
    setExpandedLevel((prev) => (prev === levelNum ? null : levelNum));
  }, []);

  const hasCustomBots = customBots.length > 0;

  const handleChallenge = useCallback(
    (levelNum: number, botIndex: number) => {
      if (!playerBotId || !hasCustomBots) return;

      const levelDef = CAMPAIGN_LEVELS.find((l) => l.level === levelNum);
      if (!levelDef) return;
      const bot = levelDef.bots[botIndex];
      const cfg = getLevelConfig(levelDef);

      const savedBot = getStoredBotById(playerBotId);
      const p1Source: Parameters<typeof updatePlayer1>[0] = savedBot
        ? { type: 'custom', code: savedBot.code, savedBotId: savedBot.id }
        : { type: 'preset', id: 'balanced' }; // fallback should never happen

      updatePlayer1(p1Source);
      updatePlayer2({ type: 'preset', id: bot.id });
      updateConfig(cfg);
      setReady(true);
      setCampaignPending({ level: levelNum, botIndex, botId: bot.id });
      router.push(`${ROUTES.game}?campaign=true`);
    },
    [playerBotId, hasCustomBots, updatePlayer1, updatePlayer2, updateConfig, setReady, router],
  );

  const handleReset = useCallback(() => {
    resetCampaignProgress();
    setProgress(getCampaignProgress());
    setShowResetConfirm(false);
  }, []);

  const handleBotSelect = useCallback((botId: string) => {
    setPlayerBotId(botId);
    setCampaignSelectedBot(botId);
    setCustomBots(listBots());
  }, []);

  return (
    <div className="min-h-screen bg-navy">
      {victoryMessage && (
        <VictoryFlash message={victoryMessage} onDismiss={() => setVictoryMessage(null)} />
      )}

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* ── Header ── */}
        <div className="text-center mb-10">
          <div className="text-5xl mb-3 select-none drop-shadow-[0_0_20px_rgba(212,168,67,0.5)]">
            ⚓
          </div>
          <h1 className="text-4xl font-black tracking-widest mb-2 text-gold font-serif tracking-[0.1em]">
            CAMPAIGN
          </h1>
          <p className="text-sm text-foam">Rise through the ranks — from Deckhand to Pirate King</p>
          <CampaignProgress progress={progress} />
        </div>

        {/* ── Your Fleet / Bot Picker (always open) ── */}
        <CampaignFleet selectedBotId={playerBotId} onSelect={handleBotSelect} />

        {/* ── Level List ── */}
        <div className="flex flex-col gap-3">
          {CAMPAIGN_LEVELS.map((levelDef, idx) => (
            <div key={levelDef.level} className="relative">
              {/* Connector line between levels */}
              {idx < CAMPAIGN_LEVELS.length - 1 && (
                <div
                  className={cn(
                    'absolute left-9 bottom-0 w-0.5 h-3 -mb-3 z-0',
                    isLevelComplete(levelDef.level, progress)
                      ? 'bg-gold/40'
                      : 'bg-[rgba(30,41,59,0.5)]',
                  )}
                />
              )}
              <LevelCard
                levelDef={levelDef}
                progress={progress}
                isExpanded={expandedLevel === levelDef.level}
                onToggle={() => handleToggleLevel(levelDef.level)}
                onChallenge={handleChallenge}
                playerBotName=""
                disabled={!hasCustomBots}
              />
            </div>
          ))}
        </div>

        {/* ── Footer actions ── */}
        <div className="mt-8 flex items-center justify-between">
          <a
            href={ROUTES.play}
            className="text-sm font-semibold transition-colors hover:text-amber-300 text-foam"
          >
            ← Free Play
          </a>
          {!showResetConfirm ? (
            <button onClick={() => setShowResetConfirm(true)} className="text-xs text-[#334155]">
              Reset progress
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#f87171]">Reset all progress?</span>
              <button
                onClick={handleReset}
                className="text-xs px-2 py-1 rounded bg-red-900 text-red-300"
              >
                Yes, reset
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="text-xs px-2 py-1 rounded bg-[rgba(30,41,59,0.5)] text-[#64748b]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
