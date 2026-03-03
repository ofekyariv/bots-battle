// ============================================================
// 🏴‍☠️ GameContext — persists game setup across navigation
// ============================================================
// Stores:
//   • player1 + player2 bot selections (preset id or custom code)
//   • game config (all configurable settings)
//   • isReady flag (set to true when "Start Battle!" is pressed)
//
// Provided at the app root via <GameProvider> in ClientProviders.tsx.
// Consumed with the useGameContext() hook.
// ============================================================

'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { type GameConfig, DEFAULT_CONFIG } from '@/engine/types';
import { DEFAULT_BOT_ID, DEFAULT_OPPONENT_ID } from '@/bots/index';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/**
 * How a player's bot is sourced.
 *  • preset  — one of the built-in bots (by registry id)
 *  • custom  — code written or pasted by the user (incl. loaded saved bots)
 *             savedBotId: set when the custom bot was loaded from storage
 *             (used to track win/loss records)
 */
export type BotSource =
  | { type: 'preset'; id: string }
  | { type: 'custom'; code: string; savedBotId?: string };

export interface PlayerSetup {
  botSource: BotSource;
}

export interface GameSetupState {
  player1: PlayerSetup;
  player2: PlayerSetup;
  config: GameConfig;
}

// ─────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────

export const DEFAULT_GAME_SETUP: GameSetupState = {
  player1: { botSource: { type: 'preset', id: DEFAULT_BOT_ID } },
  player2: { botSource: { type: 'preset', id: DEFAULT_OPPONENT_ID } },
  config: DEFAULT_CONFIG,
};

// ─────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────

interface GameContextValue {
  setup: GameSetupState;
  setSetup: (setup: GameSetupState) => void;
  updateConfig: (config: Partial<GameConfig>) => void;
  updatePlayer1: (source: BotSource) => void;
  updatePlayer2: (source: BotSource) => void;
  /** True once the user clicks "Start Battle!" — game page checks this */
  isReady: boolean;
  setReady: (ready: boolean) => void;
}

// ─────────────────────────────────────────────
// Context instance
// ─────────────────────────────────────────────

const GameContext = createContext<GameContextValue | null>(null);

// ─────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────

export function GameProvider({ children }: { children: ReactNode }) {
  const [setup, setSetup] = useState<GameSetupState>(DEFAULT_GAME_SETUP);
  const [isReady, setReady] = useState(false);

  const updateConfig = (config: Partial<GameConfig>) =>
    setSetup((prev) => ({ ...prev, config: { ...prev.config, ...config } }));

  const updatePlayer1 = (source: BotSource) =>
    setSetup((prev) => ({ ...prev, player1: { botSource: source } }));

  const updatePlayer2 = (source: BotSource) =>
    setSetup((prev) => ({ ...prev, player2: { botSource: source } }));

  return (
    <GameContext.Provider
      value={{
        setup,
        setSetup,
        updateConfig,
        updatePlayer1,
        updatePlayer2,
        isReady,
        setReady,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGameContext must be used inside <GameProvider>.');
  }
  return ctx;
}
