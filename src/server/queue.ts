// ============================================================
// 🏴☠️ Bots Battle — Match Executor (Synchronous)
// ============================================================
//
// Synchronous match execution for Vercel serverless.
// Matches run immediately in the same request — no queue needed.
// ============================================================

import { db } from '@/db';
import { matches, bots } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { runMatch } from './match-runner';
import { updateRatingsAfterMatch } from '@/lib/elo';

// ─────────────────────────────────────────────
// Core match processor
// ─────────────────────────────────────────────

async function processMatch(matchId: string): Promise<void> {
  // Mark as running
  await db.update(matches).set({ status: 'running' }).where(eq(matches.id, matchId));

  // Load match record
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
  if (!match) throw new Error(`Match ${matchId} not found`);

  // Load bots
  const [bot1] = await db.select().from(bots).where(eq(bots.id, match.player1BotId));
  const [bot2] = await db.select().from(bots).where(eq(bots.id, match.player2BotId));
  if (!bot1 || !bot2) throw new Error('One or both bots not found');

  // Use compiledJs if available (for non-JS languages), else raw code
  const bot1Code = bot1.compiledJs ?? bot1.code;
  const bot2Code = bot2.compiledJs ?? bot2.code;

  // Run the match
  const config = (match.config as Record<string, unknown>) ?? {};
  const result = runMatch(bot1Code, bot2Code, config);

  // Determine winner bot ID
  let winnerBotId: string | null = null;
  if (result.winner === 'player1') winnerBotId = bot1.id;
  else if (result.winner === 'player2') winnerBotId = bot2.id;

  // Serialize replay
  const replayData = JSON.stringify(result.replay);
  const replayKey = `match:${matchId}:replay`;

  // Write results to DB
  await db.update(matches).set({
    status: 'completed',
    winnerBotId,
    player1Score: result.scores.player1,
    player2Score: result.scores.player2,
    ticksPlayed: result.ticksPlayed,
    durationMs: result.durationMs,
    replayKey: replayData.length < 1_000_000 ? replayData : replayKey, // inline small replays
    completedAt: new Date(),
  }).where(eq(matches.id, matchId));

  // Update ELO ratings (only if there's a winner)
  if (winnerBotId) {
    const loserBotId = winnerBotId === bot1.id ? bot2.id : bot1.id;
    await updateRatingsAfterMatch(winnerBotId, loserBotId);
  }
}

// ─────────────────────────────────────────────
// Public API — synchronous match execution
// ─────────────────────────────────────────────

/**
 * Execute a match immediately (synchronous — no queue).
 * On failure, marks the match as 'errored' in the DB and logs the error.
 * Does NOT throw — safe to call from API routes without crashing the request.
 */
export async function addMatchJob(matchId: string): Promise<void> {
  try {
    await processMatch(matchId);
  } catch (err) {
    console.error(`[match-executor] Match ${matchId} failed:`, err);
    await db
      .update(matches)
      .set({ status: 'errored' })
      .where(eq(matches.id, matchId))
      .catch((dbErr) => console.error(`[match-executor] Failed to mark match ${matchId} as errored:`, dbErr));
  }
}
