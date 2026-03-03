// ============================================================
// 🏴☠️ Bots Battle — Server-Side Match Runner
// ============================================================
//
// runMatch() runs a full game server-side using the same
// GameEngine from src/engine/GameEngine.ts.
//
// Both bots are sandboxed via createSandboxedBot() (vm module).
// Records a full replay as an array of ReplayTick snapshots.
// Returns { winner, scores, replay, ticksPlayed, durationMs }.
// ============================================================

import { GameEngine } from '@/engine/GameEngine';
import type { GameConfig } from '@/engine/types';
import { createSandboxedBot } from './sandbox';
import { buildReplayTick, MatchReplay } from './replay';

// ─────────────────────────────────────────────
// Result type
// ─────────────────────────────────────────────

export interface MatchResult {
  /** Winner: "player1" | "player2" | "draw" */
  winner: 'player1' | 'player2' | 'draw';
  scores: {
    player1: number;
    player2: number;
  };
  /** Full replay data for storage / playback */
  replay: MatchReplay;
  /** Number of ticks actually played */
  ticksPlayed: number;
  /** Wall-clock duration in milliseconds */
  durationMs: number;
}

// ─────────────────────────────────────────────
// Main runner
// ─────────────────────────────────────────────

/**
 * Run a full match server-side between two bots.
 *
 * Both bots run in vm sandboxes with 50ms per-tick timeout.
 * The game engine is the same GameEngine used client-side.
 * The match runs synchronously (no setInterval) using stepTick().
 *
 * @param bot1Code  JavaScript source for bot 1 (pre-compiled if needed)
 * @param bot2Code  JavaScript source for bot 2 (pre-compiled if needed)
 * @param config    Optional partial GameConfig overrides
 * @returns         MatchResult with winner, scores, replay, and timing
 */
export function runMatch(
  bot1Code: string,
  bot2Code: string,
  config: Partial<GameConfig> = {},
): MatchResult {
  const startTime = Date.now();

  // Create sandboxed bots
  const bot1 = createSandboxedBot(bot1Code);
  const bot2 = createSandboxedBot(bot2Code);

  // Create the engine with sandboxed bots as factories
  // (factories return the already-created instances each time)
  const engine = new GameEngine(
    () => bot1,
    () => bot2,
    config,
  );

  const replay: MatchReplay['ticks'] = [];
  const initialState = engine.getState();

  // Run synchronously using stepTick()
  // Stop at game duration or when status becomes 'finished'
  const maxTicks = initialState.config.gameDuration;

  for (let i = 0; i < maxTicks; i++) {
    engine.stepTick();
    const state = engine.getState();

    // Capture snapshot after each tick
    replay.push(buildReplayTick(state));

    // Check if game is finished
    if (state.status === 'finished') {
      break;
    }
  }

  const finalState = engine.getState();
  const durationMs = Date.now() - startTime;

  // Determine winner
  const result = finalState.result;
  const winner: 'player1' | 'player2' | 'draw' = result
    ? result.winner === 'draw'
      ? 'draw'
      : (result.winner as 'player1' | 'player2')
    : finalState.player1Score > finalState.player2Score
      ? 'player1'
      : finalState.player2Score > finalState.player1Score
        ? 'player2'
        : 'draw';

  const matchReplay: MatchReplay = {
    ticks: replay,
    result: result ?? {
      winner,
      condition: 'timeout',
      player1Score: finalState.player1Score,
      player2Score: finalState.player2Score,
      totalTicks: finalState.tick,
    },
    mapWidth: finalState.config.mapWidth,
    mapHeight: finalState.config.mapHeight,
    tickRateMs: finalState.config.tickRateMs,
    numShipsPerPlayer: finalState.config.shipsPerPlayer,
  };

  return {
    winner,
    scores: {
      player1: finalState.player1Score,
      player2: finalState.player2Score,
    },
    replay: matchReplay,
    ticksPlayed: finalState.tick,
    durationMs,
  };
}
