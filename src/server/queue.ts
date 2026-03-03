// ============================================================
// 🏴☠️ Bots Battle — Match Queue (BullMQ + Redis)
// ============================================================
//
// Falls back to an in-memory queue when REDIS_URL is not set
// (local dev without Redis).
// ============================================================

import { db } from '@/db';
import { matches, bots } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { runMatch } from './match-runner';
import { updateRatingsAfterMatch } from '@/lib/elo';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface MatchJobData {
  matchId: string;
}

// ─────────────────────────────────────────────
// Queue implementation
// ─────────────────────────────────────────────

type QueueAdapter = {
  add: (matchId: string) => Promise<void>;
};

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
// BullMQ queue (Redis-backed)
// ─────────────────────────────────────────────

function createBullMQQueue(): QueueAdapter {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bullmq = require('bullmq') as typeof import('bullmq');
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const IORedisLib = require('ioredis') as { default: new (...args: any[]) => any };

  const connection = new IORedisLib.default(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
  });

  const queue = new bullmq.Queue<MatchJobData>('matches', { connection });

  // Worker — runs in the same process for simplicity
  // In production you'd run this in a separate worker process
  new bullmq.Worker<MatchJobData>(
    'matches',
    async (job) => {
      await processMatch(job.data.matchId);
    },
    {
      connection,
      concurrency: 3,
    },
  );

  return {
    add: async (matchId: string) => {
      await queue.add('run-match', { matchId }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      });
    },
  };
}

// ─────────────────────────────────────────────
// In-memory fallback queue (local dev)
// ─────────────────────────────────────────────

function createInMemoryQueue(): QueueAdapter {
  const pending: string[] = [];
  let running = false;

  async function drain() {
    if (running) return;
    running = true;
    while (pending.length > 0) {
      const matchId = pending.shift()!;
      try {
        await processMatch(matchId);
      } catch (err) {
        console.error(`[in-memory queue] Match ${matchId} failed:`, err);
        // Mark errored
        await db.update(matches).set({ status: 'errored' }).where(eq(matches.id, matchId)).catch(() => {});
      }
    }
    running = false;
  }

  return {
    add: async (matchId: string) => {
      pending.push(matchId);
      // Run async — don't block the HTTP response
      setImmediate(() => drain().catch(console.error));
    },
  };
}

// ─────────────────────────────────────────────
// Singleton queue instance
// ─────────────────────────────────────────────

let _queue: QueueAdapter | null = null;

export function getQueue(): QueueAdapter {
  if (_queue) return _queue;
  if (process.env.REDIS_URL) {
    console.log('[queue] Using BullMQ + Redis');
    _queue = createBullMQQueue();
  } else {
    console.warn('[queue] REDIS_URL not set — using in-memory queue (local dev only)');
    _queue = createInMemoryQueue();
  }
  return _queue;
}

/**
 * Enqueue a match for execution.
 */
export async function addMatchJob(matchId: string): Promise<void> {
  await getQueue().add(matchId);
}
