// ============================================================
// 🏴☠️ useMatchStream — SSE hook for live match spectating
// ============================================================

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { MatchReplay, ReplayTick } from '@/server/replay';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface BotInfo {
  id: string;
  name: string;
  language: string;
  userId: string;
}

export interface LiveTickState {
  tick: number;
  player1Score: number;
  player2Score: number;
}

export interface MatchStreamState {
  /** Latest tick data (live) */
  tick: LiveTickState | null;
  /** Full replay (once match is complete) */
  replay: MatchReplay | null;
  /** Bot info for both players */
  player1Bot: BotInfo | null;
  player2Bot: BotInfo | null;
  /** Whether we're actively receiving live ticks */
  isLive: boolean;
  /** Whether the match has finished */
  isComplete: boolean;
  /** Whether we're waiting for the match to start */
  isWaiting: boolean;
  /** Error message, if any */
  error: string | null;
  /** Match status string */
  status: 'connecting' | 'waiting' | 'live' | 'complete' | 'error';
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useMatchStream(matchId: string | null): MatchStreamState {
  const [state, setState] = useState<MatchStreamState>({
    tick: null,
    replay: null,
    player1Bot: null,
    player2Bot: null,
    isLive: false,
    isComplete: false,
    isWaiting: false,
    error: null,
    status: 'connecting',
  });

  const esRef = useRef<EventSource | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isComplete = useRef(false);

  const connect = useCallback(() => {
    if (!matchId || isComplete.current) return;

    esRef.current?.close();

    const es = new EventSource(`/api/matches/${matchId}/stream`);
    esRef.current = es;

    es.addEventListener('start', (e) => {
      const data = JSON.parse(e.data);
      reconnectCount.current = 0;
      setState((prev) => ({
        ...prev,
        player1Bot: data.player1Bot,
        player2Bot: data.player2Bot,
        isLive: true,
        isWaiting: false,
        error: null,
        status: 'live',
      }));
    });

    es.addEventListener('waiting', () => {
      reconnectCount.current = 0;
      setState((prev) => ({ ...prev, isWaiting: true, isLive: false, status: 'waiting' }));
    });

    es.addEventListener('tick', (e) => {
      const data = JSON.parse(e.data) as LiveTickState;
      setState((prev) => ({ ...prev, tick: data, isLive: true, status: 'live' }));
    });

    es.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      isComplete.current = true;
      es.close();
      setState((prev) => ({
        ...prev,
        replay: data.replay ?? null,
        player1Bot: data.match?.player1Bot ?? prev.player1Bot,
        player2Bot: data.match?.player2Bot ?? prev.player2Bot,
        isLive: false,
        isComplete: true,
        isWaiting: false,
        error: null,
        status: 'complete',
      }));
    });

    es.addEventListener('error', (e) => {
      // SSE spec fires 'error' on connection drop too (no data)
      const data = (e as MessageEvent).data;
      if (data) {
        try {
          const parsed = JSON.parse(data);
          setState((prev) => ({ ...prev, error: parsed.message ?? 'Stream error', status: 'error', isLive: false }));
        } catch { /* ignore */ }
      }

      es.close();

      // Reconnect unless complete or max attempts reached
      if (!isComplete.current && reconnectCount.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectCount.current++;
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      } else if (!isComplete.current) {
        setState((prev) => ({ ...prev, error: 'Connection lost', status: 'error', isLive: false }));
      }
    });
  }, [matchId]);

  useEffect(() => {
    if (!matchId) return;
    isComplete.current = false;
    reconnectCount.current = 0;
    connect();

    return () => {
      esRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [matchId, connect]);

  return state;
}
