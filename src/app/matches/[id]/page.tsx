// ============================================================
// 🏴☠️ /matches/:id — Live spectator + replay viewer
// ============================================================

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useMatchStream } from '@/hooks/useMatchStream';
import { SpectatorHUD } from '@/components/match/SpectatorHUD';
import type { FullGameState, GameConfig } from '@/engine/types';
import type { MatchReplay, ReplayTick } from '@/server/replay';
import { DEFAULT_CONFIG } from '@/engine/types';

// GameCanvas uses canvas APIs — dynamic import to avoid SSR issues
const GameCanvas = dynamic(() => import('@/components/GameCanvas'), { ssr: false });

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function formatDuration(ms: number): string {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

/**
 * Build a minimal FullGameState from a ReplayTick so GameCanvas can render it.
 * Fields not present in ReplayTick get reasonable defaults.
 */
function replayTickToGameState(t: ReplayTick, config: GameConfig): FullGameState {
  return {
    config,
    tick: t.tick,
    status: 'running',
    player1Score: t.player1Score,
    player2Score: t.player2Score,
    ships: t.ships.map((s) => ({
      id: s.id,
      owner: s.owner,
      x: s.x,
      y: s.y,
      alive: s.alive,
      isCapturing: s.isCapturing,
      turnsToRevive: s.turnsToRevive,
      initialX: s.x,
      initialY: s.y,
      combatPressure: s.combatPressure,
    })),
    islands: t.islands.map((i) => ({
      id: i.id,
      x: i.x,
      y: i.y,
      radius: i.radius,
      owner: i.owner,
      teamCapturing: i.teamCapturing,
      captureProgress: i.captureProgress,
      captureTurns: config.captureTurns,
      value: i.value,
    })),
    player1: {
      id: 'player1',
      score: t.player1Score,
      islandsHeld: t.islands.filter((i) => i.owner === 'player1').length,
      shipIds: t.ships.filter((s) => s.owner === 'player1').map((s) => s.id),
    },
    player2: {
      id: 'player2',
      score: t.player2Score,
      islandsHeld: t.islands.filter((i) => i.owner === 'player2').length,
      shipIds: t.ships.filter((s) => s.owner === 'player2').map((s) => s.id),
    },
  } as FullGameState;
}

// ─────────────────────────────────────────────
// Replay controls (reused for completed matches)
// ─────────────────────────────────────────────

interface ReplayControlsProps {
  tick: number;
  total: number;
  playing: boolean;
  onSeek: (t: number) => void;
  onTogglePlay: () => void;
  onJumpStart: () => void;
  onJumpEnd: () => void;
}

function ReplayControls({ tick, total, playing, onSeek, onTogglePlay, onJumpStart, onJumpEnd }: ReplayControlsProps) {
  return (
    <div className="rounded-xl bg-[rgba(15,23,42,0.7)] border border-[#fbbf24]/15 p-4 space-y-3">
      <input
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        value={tick}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="w-full accent-[#fbbf24]"
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={onJumpStart}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(15,23,42,0.7)] border border-[#334155] text-[#94a3b8] hover:brightness-110"
          >⏮ Start</button>
          <button
            onClick={onTogglePlay}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-[#fbbf24]/20 border border-[#fbbf24]/40 text-[#fbbf24] hover:brightness-110"
          >{playing ? '⏸ Pause' : '▶ Play'}</button>
          <button
            onClick={onJumpEnd}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(15,23,42,0.7)] border border-[#334155] text-[#94a3b8] hover:brightness-110"
          >End ⏭</button>
        </div>
        <span className="text-xs text-[#475569] font-mono">Tick {tick} / {total}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();

  // SSE stream for live spectating
  const stream = useMatchStream(id ?? null);

  // Replay playback state (once complete)
  const [replayTick, setReplayTick] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const replayInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-start replay playback when complete
  useEffect(() => {
    if (stream.isComplete && stream.replay) {
      setReplayTick(0);
      setReplayPlaying(true);
    }
  }, [stream.isComplete, stream.replay]);

  // Replay playback loop
  useEffect(() => {
    if (!replayPlaying || !stream.replay) {
      if (replayInterval.current) clearInterval(replayInterval.current);
      return;
    }
    const total = stream.replay.ticks.length;
    replayInterval.current = setInterval(() => {
      setReplayTick((t) => {
        if (t >= total - 1) { setReplayPlaying(false); return t; }
        return t + 1;
      });
    }, 100);
    return () => { if (replayInterval.current) clearInterval(replayInterval.current); };
  }, [replayPlaying, stream.replay]);

  // ── Derive game state for canvas ────────────────────────
  const config: GameConfig = {
    ...DEFAULT_CONFIG,
    ...(stream.replay ? {
      mapWidth: stream.replay.mapWidth,
      mapHeight: stream.replay.mapHeight,
      tickRateMs: stream.replay.tickRateMs,
      numShipsPerPlayer: stream.replay.numShipsPerPlayer,
    } : {}),
  };

  let canvasState: FullGameState | null = null;
  let currentTickNum = 0;

  if (stream.isComplete && stream.replay) {
    const t = stream.replay.ticks[replayTick];
    if (t) {
      canvasState = replayTickToGameState(t, config);
      currentTickNum = t.tick;
    }
  } else if (stream.isLive && stream.replay) {
    // During live: show latest tick from streaming replay data
    const ticks = stream.replay.ticks;
    const latest = ticks[ticks.length - 1];
    if (latest) {
      canvasState = replayTickToGameState(latest, config);
      currentTickNum = latest.tick;
    }
  } else if (stream.isLive && stream.tick) {
    // Fallback: no full replay yet but we have tick data — no canvas rendering
    currentTickNum = stream.tick.tick;
  }

  const maxTicks = config.gameDuration;
  const p1Score = stream.isComplete && stream.replay
    ? (stream.replay.ticks[replayTick]?.player1Score ?? 0)
    : (stream.tick?.player1Score ?? 0);
  const p2Score = stream.isComplete && stream.replay
    ? (stream.replay.ticks[replayTick]?.player2Score ?? 0)
    : (stream.tick?.player2Score ?? 0);

  // ── Derive winner from replay result ────────────────────
  let winnerBotId: string | null = null;
  if (stream.isComplete && stream.replay?.result) {
    if (stream.replay.result.winner === 'player1') winnerBotId = stream.player1Bot?.id ?? null;
    else if (stream.replay.result.winner === 'player2') winnerBotId = stream.player2Bot?.id ?? null;
  }

  // ── Render ───────────────────────────────────────────────

  if (stream.status === 'connecting') {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#475569]">
        Connecting to match stream…
      </div>
    );
  }

  if (stream.status === 'error' && !stream.isComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-400">
        {stream.error ?? 'Stream error'}
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 bg-navy">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold text-[#fbbf24] font-serif">⚔️ Match</h1>
          <span className="text-xs text-[#475569] font-mono truncate">{id}</span>
          {stream.isLive && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 ml-auto">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              LIVE
            </span>
          )}
          {stream.isComplete && (
            <span className="text-xs font-bold text-green-400 ml-auto">✅ Complete</span>
          )}
          {stream.isWaiting && (
            <span className="text-xs font-bold text-yellow-400 ml-auto">⏳ Queued</span>
          )}
        </div>

        {/* Spectator HUD */}
        <SpectatorHUD
          player1Bot={stream.player1Bot}
          player2Bot={stream.player2Bot}
          player1Score={p1Score}
          player2Score={p2Score}
          tick={currentTickNum}
          maxTicks={maxTicks}
          isLive={stream.isLive}
          isComplete={stream.isComplete}
          winnerBotId={winnerBotId}
        />

        {/* Game Canvas */}
        {canvasState && (
          <div className="rounded-xl overflow-hidden border border-[#fbbf24]/10" style={{ height: 480 }}>
            <GameCanvas
              gameState={canvasState}
              mapWidth={config.mapWidth}
              mapHeight={config.mapHeight}
              cameraMode="static"
            />
          </div>
        )}

        {/* Waiting state */}
        {stream.isWaiting && !canvasState && (
          <div className="rounded-xl p-10 bg-[rgba(15,23,42,0.5)] border border-yellow-500/20 text-center">
            <div className="text-5xl mb-4">⏳</div>
            <p className="text-[#94a3b8] font-semibold text-lg">Match is queued — waiting to start…</p>
            <p className="text-xs text-[#475569] mt-2">You&apos;ll be connected automatically when it begins</p>
          </div>
        )}

        {/* Replay controls (complete mode) */}
        {stream.isComplete && stream.replay && (
          <ReplayControls
            tick={replayTick}
            total={stream.replay.ticks.length}
            playing={replayPlaying}
            onSeek={(t) => { setReplayPlaying(false); setReplayTick(t); }}
            onTogglePlay={() => setReplayPlaying((p) => !p)}
            onJumpStart={() => { setReplayPlaying(false); setReplayTick(0); }}
            onJumpEnd={() => { setReplayPlaying(false); setReplayTick(stream.replay!.ticks.length - 1); }}
          />
        )}

        {/* Error notice (non-fatal) */}
        {stream.error && (
          <div className="text-xs text-red-400 text-center">{stream.error}</div>
        )}
      </div>
    </div>
  );
}
