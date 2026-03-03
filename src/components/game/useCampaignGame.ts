// ─────────────────────────────────────────────────────────────
// useCampaignGame — encapsulates campaign session logic
//
// Reads pending campaign context once from localStorage, tracks
// win/loss outcomes, and produces the "continue" CTA for the
// GameOverModal.
// ─────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/routes';
import {
  getCampaignPending,
  clearCampaignPending,
  recordCampaignResult,
  setCampaignPending,
  getLevelConfig,
  CAMPAIGN_LEVELS,
  type CampaignPending,
} from '@/lib/campaign';
import { getBotById } from '@/lib/storage';
import { getCampaignSelectedBot } from '@/components/campaign/BotSelectionModal';

export interface CampaignGameState {
  campaignPending: CampaignPending | null;
  campaignContinueLabel: string | undefined;
  campaignContinueFn: (() => void) | undefined;
  handleCampaignResult: (outcome: 'win' | 'loss' | 'draw') => void;
  /** Re-set the pending context in localStorage for a campaign rematch */
  resetCampaignForRematch: () => void;
}

import type { BotSource } from '@/lib/GameContext';
import type { GameConfig } from '@/engine/types';

interface GameContextActions {
  updatePlayer1: (src: BotSource) => void;
  updatePlayer2: (src: BotSource) => void;
  updateConfig: (cfg: Partial<GameConfig>) => void;
}

export function useCampaignGame(
  setReady: (v: boolean) => void,
  gameCtx?: GameContextActions,
  bumpGameKey?: () => void,
): CampaignGameState {
  const router = useRouter();

  const [campaignPending, setCampaignPendingState] = useState<CampaignPending | null>(() => getCampaignPending());
  const [campaignContinueLabel, setCampaignContinueLabel] = useState<string | undefined>(undefined);
  const [campaignContinueFn, setCampaignContinueFn] = useState<(() => void) | undefined>(undefined);

  const handleCampaignResult = useCallback(
    (outcome: 'win' | 'loss' | 'draw') => {
      if (!campaignPending) return;

      const { levelCompleted } = recordCampaignResult(
        campaignPending.level,
        campaignPending.botIndex,
        campaignPending.botId,
        outcome === 'draw' ? 'loss' : outcome, // treat draw as loss for campaign
      );

      if (outcome === 'win' || outcome === 'draw') {
        clearCampaignPending();

        const levelDef = CAMPAIGN_LEVELS.find((l) => l.level === campaignPending.level);
        const totalBots = levelDef?.bots.length ?? 0;
        const nextBotIndex = campaignPending.botIndex + 1;

        if (levelCompleted) {
          // Level fully complete — show victory and return to campaign map
          const victoryMsg =
            campaignPending.level === 10
              ? '👑 You are the Pirate King!'
              : `🎉 Level ${campaignPending.level} Complete! ${levelDef?.rank} achieved!`;

          setCampaignContinueLabel('🏆 Level Complete! View Campaign');
          setCampaignContinueFn(() => () => {
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('bots-battle:campaign-victory', victoryMsg);
            }
            setReady(false);
            router.push(ROUTES.campaign);
          });
        } else if (nextBotIndex < totalBots && levelDef) {
          // More bots left in this level — launch next challenge directly
          const nextBot = levelDef.bots[nextBotIndex];
          setCampaignContinueLabel(`⚔️ Next: vs ${nextBot?.name ?? 'Next Bot'}`);
          setCampaignContinueFn(() => () => {
            // Set up the next challenge inline if we have game context
            if (gameCtx && bumpGameKey) {
              const savedBotId = getCampaignSelectedBot();
              const savedBot = savedBotId ? getBotById(savedBotId) : null;
              if (savedBot) {
                const cfg = getLevelConfig(levelDef);
                gameCtx.updatePlayer1({ type: 'custom', code: savedBot.code, savedBotId: savedBot.id });
                gameCtx.updatePlayer2({ type: 'preset', id: nextBot.id });
                gameCtx.updateConfig(cfg);
                const nextPending = { level: campaignPending.level, botIndex: nextBotIndex, botId: nextBot.id };
                setCampaignPending(nextPending);
                setCampaignPendingState(nextPending);
                // Reset continue label/fn for the new game
                setCampaignContinueLabel(undefined);
                setCampaignContinueFn(undefined);
                bumpGameKey();
                return;
              }
            }
            // Fallback: go to campaign page
            setReady(false);
            router.push(ROUTES.campaign);
          });
        }
      }
    },
     
    [campaignPending, router, setReady, gameCtx, bumpGameKey],
  );

  const resetCampaignForRematch = useCallback(() => {
    if (campaignPending) {
      setCampaignPending(campaignPending);
    }
  }, [campaignPending]);

  return {
    campaignPending,
    campaignContinueLabel,
    campaignContinueFn,
    handleCampaignResult,
    resetCampaignForRematch,
  };
}
