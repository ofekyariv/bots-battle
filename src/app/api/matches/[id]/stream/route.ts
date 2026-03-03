// ============================================================
// 🏴☠️ GET /api/matches/:id/stream — SSE spectator stream
// ============================================================
//
// Streams live match state via Server-Sent Events.
// • running  → tick snapshots every 5 ticks (~600ms)
// • completed → full replay as single 'complete' event
// • queued   → 'waiting' event, then polls until it starts
// ============================================================

import { NextRequest } from 'next/server';
import { db } from '@/db';
import { matches, bots } from '@/db/schema';
import { eq } from 'drizzle-orm';

// How often we poll the DB for the latest match state (ms)
const POLL_INTERVAL_MS = 120;
// How many ticks between streamed snapshots
const TICK_STRIDE = 5;

function sseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseMessage(event, data)));
        } catch {
          // client disconnected
        }
      };

      const close = () => {
        try { controller.close(); } catch { /* already closed */ }
      };

      // Handle client disconnect
      req.signal.addEventListener('abort', close);

      try {
        // ── Helper: fetch match + bots ──────────────────────
        async function fetchMatch() {
          const [match] = await db
            .select({
              id: matches.id,
              status: matches.status,
              player1BotId: matches.player1BotId,
              player2BotId: matches.player2BotId,
              winnerBotId: matches.winnerBotId,
              player1Score: matches.player1Score,
              player2Score: matches.player2Score,
              ticksPlayed: matches.ticksPlayed,
              durationMs: matches.durationMs,
              replayKey: matches.replayKey,
              config: matches.config,
              createdAt: matches.createdAt,
              completedAt: matches.completedAt,
            })
            .from(matches)
            .where(eq(matches.id, id));
          return match ?? null;
        }

        async function fetchBots(p1Id: string, p2Id: string) {
          const [b1] = await db.select({ id: bots.id, name: bots.name, language: bots.language, userId: bots.userId }).from(bots).where(eq(bots.id, p1Id));
          const [b2] = await db.select({ id: bots.id, name: bots.name, language: bots.language, userId: bots.userId }).from(bots).where(eq(bots.id, p2Id));
          return { bot1: b1 ?? null, bot2: b2 ?? null };
        }

        // ── Initial fetch ────────────────────────────────────
        let match = await fetchMatch();
        if (!match) {
          send('error', { message: 'Match not found' });
          close();
          return;
        }

        // ── Completed: send full replay and done ─────────────
        if (match.status === 'completed' || match.status === 'errored') {
          const { bot1, bot2 } = await fetchBots(match.player1BotId, match.player2BotId);
          let replay: unknown = null;
          if (match.replayKey && match.replayKey.startsWith('{')) {
            try { replay = JSON.parse(match.replayKey); } catch { /* ignore */ }
          }
          send('complete', { match: { ...match, player1Bot: bot1, player2Bot: bot2 }, replay });
          close();
          return;
        }

        // ── Queued: wait for it to start ─────────────────────
        if (match.status === 'queued') {
          send('waiting', { message: 'Match is queued — waiting to start…' });

          // Poll until running or completed (max 5 minutes)
          const deadline = Date.now() + 5 * 60 * 1000;
          while (match.status === 'queued' && Date.now() < deadline) {
            if (req.signal.aborted) return;
            await new Promise((r) => setTimeout(r, 500));
            match = await fetchMatch();
            if (!match) { send('error', { message: 'Match disappeared' }); close(); return; }
          }

          if (match.status === 'queued') {
            send('error', { message: 'Match timed out waiting in queue' });
            close();
            return;
          }
        }

        // ── Running: stream tick snapshots ───────────────────
        const { bot1, bot2 } = await fetchBots(match.player1BotId, match.player2BotId);

        // Send initial 'start' so the client knows who's playing
        send('start', {
          matchId: match.id,
          player1Bot: bot1,
          player2Bot: bot2,
          config: match.config,
        });

        let lastTickSent = -1;

        // Poll DB until match is done (or client disconnects)
        const deadline = Date.now() + 10 * 60 * 1000; // 10-min hard cap
        while (Date.now() < deadline) {
          if (req.signal.aborted) return;

          match = await fetchMatch();
          if (!match) { send('error', { message: 'Match disappeared' }); close(); return; }

          if (match.status === 'completed' || match.status === 'errored') {
            // Send final complete event with full replay
            let replay: unknown = null;
            if (match.replayKey && match.replayKey.startsWith('{')) {
              try { replay = JSON.parse(match.replayKey); } catch { /* ignore */ }
            }
            send('complete', { match: { ...match, player1Bot: bot1, player2Bot: bot2 }, replay });
            close();
            return;
          }

          // Still running — send tick snapshot if we have new replay data
          if (match.replayKey && match.replayKey.startsWith('{')) {
            try {
              const replayObj = JSON.parse(match.replayKey) as { ticks?: Array<{ tick: number; player1Score: number; player2Score: number }> };
              const ticks = replayObj.ticks ?? [];
              // Stream every TICK_STRIDE-th tick we haven't sent yet
              for (const t of ticks) {
                if (t.tick > lastTickSent && t.tick % TICK_STRIDE === 0) {
                  send('tick', { tick: t.tick, player1Score: t.player1Score, player2Score: t.player2Score });
                  lastTickSent = t.tick;
                }
              }
            } catch { /* ignore parse errors mid-write */ }
          } else if (match.ticksPlayed && match.ticksPlayed > lastTickSent) {
            // Fallback: just send score update
            send('tick', {
              tick: match.ticksPlayed,
              player1Score: match.player1Score,
              player2Score: match.player2Score,
            });
            lastTickSent = match.ticksPlayed;
          }

          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }

        send('error', { message: 'Stream timed out' });
        close();
      } catch (err) {
        try {
          controller.enqueue(
            encoder.encode(sseMessage('error', { message: err instanceof Error ? err.message : 'Internal error' })),
          );
        } catch { /* ignore */ }
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
