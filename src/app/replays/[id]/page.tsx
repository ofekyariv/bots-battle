// ============================================================
// 🏴‍☠️ /replays/[id] — Replay Viewer
//
// Loads a saved replay from localStorage and plays it back
// using GameCanvas (same renderer as live games).
//
// Controls:
//  • Play / Pause
//  • Speed: 1× 2× 4× 8×
//  • Timeline scrubber (slider)
//  • Frame-by-frame stepping (← →)
//  • Keyboard: Space = play/pause, ← → = step, 1–4 = speed
// ============================================================

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import GameCanvas from '@/components/GameCanvas';
import { ROUTES } from '@/lib/routes';
import { loadReplay, type ReplayData } from '@/lib/replay';
import type { FullGameState } from '@/engine/types';

// ─────────────────────────────────────────────
// Speed options
// ─────────────────────────────────────────────

const SPEEDS = [0.5, 1, 2, 4, 8] as const;
type Speed = (typeof SPEEDS)[number];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatTick(tick: number, tickRateMs: number): string {
  const sec = (tick * tickRateMs) / 1000;
  if (sec >= 60) {
    return `${Math.floor(sec / 60)}m${(sec % 60).toFixed(0).padStart(2, '0')}s`;
  }
  return `${sec.toFixed(1)}s`;
}

// badge.color is dynamic (depends on who won) — keep as style={{}}
function resultBadge(data: ReplayData): { text: string; color: string } {
  const w = data.metadata.result.winner;
  if (w === 'draw') return { text: 'Draw', color: '#fbbf24' };
  if (w === 'player1') return { text: `${data.metadata.player1Name} Won`, color: '#60a5fa' };
  return { text: `${data.metadata.player2Name} Won`, color: '#f87171' };
}

// ─────────────────────────────────────────────
// ReplayHUD
// ─────────────────────────────────────────────

interface HUDProps {
  state: FullGameState;
  p1Name: string;
  p2Name: string;
}

function ReplayHUD({ state, p1Name, p2Name }: HUDProps) {
  const { player1Score, player2Score, config } = state;
  const target = config.targetScore;
  const p1Pct = Math.min(100, (player1Score / target) * 100);
  const p2Pct = Math.min(100, (player2Score / target) * 100);
  const elapsed = Math.round((state.tick * (config.tickRateMs ?? 100)) / 1000);
  const total = Math.round((config.gameDuration * (config.tickRateMs ?? 100)) / 1000);
  const timeLeft = total - elapsed;

  return (
    <div className="flex items-center gap-4 px-4 py-2 rounded-xl text-xs font-bold bg-[rgba(5,12,30,0.88)] backdrop-blur-[10px] border border-[rgba(212,168,67,0.25)]">
      {/* P1 */}
      <div className="flex flex-col items-end gap-0.5 min-w-[90px]">
        <span className="text-[#60a5fa]">{p1Name}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-base tabular-nums text-[#e2e8f0]">
            {player1Score.toLocaleString()}
          </span>
          {/* p1Pct is computed from JS state — width must stay as style */}
          <div className="w-12 h-1.5 rounded-full overflow-hidden bg-[rgba(30,41,59,0.8)]">
            <div
              className="h-full rounded-full transition-all duration-200 bg-[#60a5fa]"
              style={{ width: `${p1Pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Timer */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[#475569]">Time Left</span>
        <span className="text-sm tabular-nums text-[#fbbf24]">
          {timeLeft >= 0
            ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`
            : '—'}
        </span>
      </div>

      {/* P2 */}
      <div className="flex flex-col items-start gap-0.5 min-w-[90px]">
        <span className="text-[#f87171]">{p2Name}</span>
        <div className="flex items-center gap-1.5">
          {/* p2Pct is computed from JS state — width must stay as style */}
          <div className="w-12 h-1.5 rounded-full overflow-hidden bg-[rgba(30,41,59,0.8)]">
            <div
              className="h-full rounded-full transition-all duration-200 bg-[#f87171]"
              style={{ width: `${p2Pct}%` }}
            />
          </div>
          <span className="text-base tabular-nums text-[#e2e8f0]">
            {player2Score.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ReplayControls
// ─────────────────────────────────────────────

interface ControlsProps {
  frameIndex: number;
  frameCount: number;
  isPlaying: boolean;
  speed: Speed;
  currentTick: number;
  totalTicks: number;
  tickRateMs: number;
  onPlay: () => void;
  onPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSeek: (frame: number) => void;
  onSpeedChange: (s: Speed) => void;
}

function ReplayControls({
  frameIndex,
  frameCount,
  isPlaying,
  speed,
  currentTick,
  totalTicks,
  tickRateMs,
  onPlay,
  onPause,
  onStepBack,
  onStepForward,
  onSeek,
  onSpeedChange,
}: ControlsProps) {
  const pct = frameCount > 1 ? (frameIndex / (frameCount - 1)) * 100 : 0;

  return (
    <div className="flex flex-col gap-2 px-4 py-3 rounded-2xl bg-[rgba(5,12,30,0.92)] backdrop-blur-[12px] border border-[rgba(212,168,67,0.25)] min-w-[340px]">
      {/* ── Timeline scrubber ─────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums font-mono flex-shrink-0 text-[#475569] min-w-[40px]">
          {formatTick(currentTick, tickRateMs)}
        </span>

        <div className="relative flex-1 h-5 flex items-center">
          {/* Track */}
          <div className="absolute inset-x-0 h-1.5 rounded-full bg-[rgba(30,41,59,0.9)]" />
          {/* Fill — pct is dynamic (JS computed) */}
          <div
            className="absolute left-0 h-1.5 rounded-full pointer-events-none bg-[#a78bfa]"
            style={{ width: `${pct}%` }}
          />
          {/* Input */}
          <input
            type="range"
            min={0}
            max={frameCount - 1}
            value={frameIndex}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="absolute inset-x-0 w-full opacity-0 cursor-pointer h-5 z-[2]"
          />
          {/* Thumb — left position is dynamic (JS computed) */}
          <div
            className="absolute w-3.5 h-3.5 rounded-full pointer-events-none bg-white shadow-[0_0_6px_#a78bfa] z-[1]"
            style={{ left: `calc(${pct}% - 7px)` }}
          />
        </div>

        <span className="text-xs tabular-nums font-mono flex-shrink-0 text-[#334155] min-w-[40px] text-right">
          {formatTick(totalTicks, tickRateMs)}
        </span>
      </div>

      {/* ── Playback buttons ──────────────────────────────── */}
      <div className="flex items-center justify-center gap-2">
        {/* Step back */}
        <button
          onClick={onStepBack}
          disabled={frameIndex === 0}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:brightness-110 disabled:opacity-30 bg-[rgba(30,41,59,0.8)] border border-[rgba(71,85,105,0.5)] text-[#94a3b8]"
          title="Step back (←)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="19,5 9,12 19,19" />
            <rect x="5" y="5" width="3" height="14" />
          </svg>
        </button>

        {/* Play / Pause — conditional bg/border/color based on isPlaying state */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={frameIndex >= frameCount - 1 && !isPlaying}
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30 border',
            isPlaying
              ? 'bg-red-500/20 border-red-500/50 text-[#f87171]'
              : 'bg-[rgba(167,139,250,0.2)] border-[rgba(167,139,250,0.53)] text-[#a78bfa]',
          )}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
        </button>

        {/* Step forward */}
        <button
          onClick={onStepForward}
          disabled={frameIndex >= frameCount - 1}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:brightness-110 disabled:opacity-30 bg-[rgba(30,41,59,0.8)] border border-[rgba(71,85,105,0.5)] text-[#94a3b8]"
          title="Step forward (→)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,5 15,12 5,19" />
            <rect x="16" y="5" width="3" height="14" />
          </svg>
        </button>

        {/* Divider */}
        <div className="w-px h-6 mx-1 bg-[rgba(71,85,105,0.5)]" />

        {/* Speed controls — active state conditional */}
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={cn(
                'px-2 py-1 rounded text-xs font-bold transition-all hover:brightness-110 border',
                speed === s
                  ? 'bg-[rgba(167,139,250,0.2)] text-[#a78bfa] border-[rgba(167,139,250,0.4)]'
                  : 'bg-[rgba(30,41,59,0.6)] text-[#475569] border-[rgba(71,85,105,0.3)]',
              )}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* ── Frame info ────────────────────────────────────── */}
      <div className="text-center">
        <span className="text-xs tabular-nums text-[#334155]">
          Frame {frameIndex + 1} / {frameCount}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Viewer Page
// ─────────────────────────────────────────────

export default function ReplayViewerPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [replayData, setReplayData] = useState<ReplayData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameIndexRef = useRef(0);
  frameIndexRef.current = frameIndex;

  // ── Load replay ───────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    const data = loadReplay(id);
    if (!data || data.frames.length === 0) {
      setNotFound(true);
      return;
    }
    setReplayData(data);
    setFrameIndex(0);
  }, [id]);

  // ── Playback loop ─────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPlayback = useCallback(() => {
    if (!replayData) return;
    stopPlayback();
    const totalFrames = replayData.frames.length;
    // Advance one frame per interval tick; speed controls how many frames per tick
    const intervalMs = 100; // base = 100ms per frame at 1x
    intervalRef.current = setInterval(
      () => {
        setFrameIndex((prev) => {
          const next = prev + 1;
          if (next >= totalFrames) {
            stopPlayback();
            setIsPlaying(false);
            return totalFrames - 1;
          }
          return next;
        });
      },
      Math.round(intervalMs / speed),
    );
  }, [replayData, speed, stopPlayback]);

  // Restart playback when speed changes while playing
  useEffect(() => {
    if (isPlaying) {
      startPlayback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPlayback();
  }, [stopPlayback]);

  // ── Playback controls ─────────────────────────────────────
  const handlePlay = useCallback(() => {
    if (!replayData) return;
    // If at the end, rewind first
    if (frameIndexRef.current >= replayData.frames.length - 1) {
      setFrameIndex(0);
    }
    setIsPlaying(true);
    startPlayback();
  }, [replayData, startPlayback]);

  const handlePause = useCallback(() => {
    stopPlayback();
    setIsPlaying(false);
  }, [stopPlayback]);

  const handleStepBack = useCallback(() => {
    handlePause();
    setFrameIndex((prev) => Math.max(0, prev - 1));
  }, [handlePause]);

  const handleStepForward = useCallback(() => {
    handlePause();
    setFrameIndex((prev) => (replayData ? Math.min(replayData.frames.length - 1, prev + 1) : prev));
  }, [handlePause, replayData]);

  const handleSeek = useCallback(
    (frame: number) => {
      handlePause();
      setFrameIndex(frame);
    },
    [handlePause],
  );

  const handleSpeedChange = useCallback((s: Speed) => {
    setSpeed(s);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't steal focus from inputs
      if (e.target instanceof HTMLInputElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) handlePause();
        else handlePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleStepBack();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleStepForward();
      } else if (e.key === '1') {
        setSpeed(0.5);
      } else if (e.key === '2') {
        setSpeed(1);
      } else if (e.key === '3') {
        setSpeed(2);
      } else if (e.key === '4') {
        setSpeed(4);
      } else if (e.key === '5') {
        setSpeed(8);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPlaying, handlePause, handlePlay, handleStepBack, handleStepForward]);

  // ─────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#010810]">
        <span className="text-5xl">🏴‍☠️</span>
        <h2 className="text-xl font-bold text-[#f87171]">Replay not found</h2>
        <p className="text-sm text-[#475569]">
          This replay may have been deleted or the ID is invalid.
        </p>
        <button
          onClick={() => router.push(ROUTES.replays)}
          className="mt-2 px-5 py-2 rounded-xl font-bold text-sm bg-gold/[0.15] text-[#fbbf24] border border-gold/30"
        >
          ← Back to Replays
        </button>
      </div>
    );
  }

  if (!replayData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#010810]">
        <span className="text-3xl animate-spin">⚓</span>
      </div>
    );
  }

  const { metadata, frames } = replayData;
  const currentFrame: FullGameState = frames[frameIndex];
  const badge = resultBadge(replayData);
  const totalTicks = frames[frames.length - 1]?.tick ?? 0;

  return (
    <div className="fixed inset-0 flex flex-col bg-[#010810]">
      {/* ── Header bar ─────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 z-20 bg-[rgba(5,12,30,0.95)] border-b border-[rgba(212,168,67,0.15)]">
        <button
          onClick={() => router.push(ROUTES.replays)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:brightness-110 bg-[rgba(30,41,59,0.7)] text-[#94a3b8] border border-[rgba(71,85,105,0.4)]"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          Replays
        </button>

        {/* Match info */}
        <div className="flex items-center gap-3 text-xs">
          <span className="font-bold text-[#60a5fa]">{metadata.player1Name}</span>
          <span className="text-[#334155]">vs</span>
          <span className="font-bold text-[#f87171]">{metadata.player2Name}</span>
          {/* badge.color is dynamic (who won) — must stay as style */}
          <span
            className="px-2 py-0.5 rounded-full font-bold text-xs"
            style={{
              background: badge.color + '22',
              color: badge.color,
              border: `1px solid ${badge.color}55`,
            }}
          >
            {badge.text}
          </span>
        </div>

        {/* Keyboard hint */}
        <div className="text-xs text-[#334155]">Space · ← → · 1–5 speed</div>
      </div>

      {/* ── Replay HUD — fixed top bar ──────────────────── */}
      <div className="shrink-0 z-10 flex items-center justify-center gap-3 px-3 pt-2 pb-1">
        {/* REPLAY badge */}
        <div className="px-2.5 py-1 rounded-lg text-xs font-bold tracking-widest uppercase bg-purple-400/[0.13] text-[#a78bfa] border border-purple-400/[0.33]">
          ⏯ Replay
        </div>
        <ReplayHUD
          state={currentFrame}
          p1Name={metadata.player1Name}
          p2Name={metadata.player2Name}
        />
      </div>

      {/* ── Canvas fills remaining space ───────────────────── */}
      <div className="flex-1 relative min-h-0">
        <GameCanvas
          gameState={currentFrame}
          mapWidth={currentFrame.config.mapWidth}
          mapHeight={currentFrame.config.mapHeight}
          showIslandIds
        />
      </div>

      {/* ── Controls — fixed bottom bar ────────────────────── */}
      <div className="shrink-0 z-10 flex items-center justify-center px-3 pt-2 pb-3">
        <ReplayControls
          frameIndex={frameIndex}
          frameCount={frames.length}
          isPlaying={isPlaying}
          speed={speed}
          currentTick={currentFrame.tick}
          totalTicks={totalTicks}
          tickRateMs={metadata.tickRateMs}
          onPlay={handlePlay}
          onPause={handlePause}
          onStepBack={handleStepBack}
          onStepForward={handleStepForward}
          onSeek={handleSeek}
          onSpeedChange={handleSpeedChange}
        />
      </div>
    </div>
  );
}
