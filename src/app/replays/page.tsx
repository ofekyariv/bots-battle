// ============================================================
// 🏴‍☠️ /replays — Saved Replay Listing Page
//
// Lists all saved replays from localStorage.
// Each row shows: bots, result, date.
// Click a row to watch the replay.
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listReplays, deleteReplay, type ReplayMetadata } from '@/lib/replay';
import { ROUTES } from '@/lib/routes';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDuration(totalTicks: number, tickRateMs: number): string {
  const sec = Math.round((totalTicks * tickRateMs) / 1000);
  if (sec >= 60) {
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  }
  return `${sec}s`;
}

// resultColor is dynamic (depends on winner per replay) — must stay as style={{}}
function resultLabel(meta: ReplayMetadata): { text: string; color: string } {
  const winner = meta.result.winner;
  if (winner === 'draw') return { text: 'Draw', color: '#fbbf24' };
  if (winner === 'player1') return { text: `${meta.player1Name} Won`, color: '#60a5fa' };
  return { text: `${meta.player2Name} Won`, color: '#f87171' };
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function ReplaysPage() {
  const router = useRouter();
  const [replays, setReplays] = useState<ReplayMetadata[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setReplays(listReplays());
    setLoaded(true);
  }, []);

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteReplay(id);
    setReplays((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="min-h-screen py-12 px-4 bg-navy">
      <div className="max-w-3xl mx-auto">
        {/* ── Header ────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight mb-1 text-[#fbbf24] font-serif">
            🎬 Saved Replays
          </h1>
          <p className="text-sm text-[#64748b]">
            Rewatch your battles and study the strategies that won (or lost) the day.
          </p>
        </div>

        {/* ── Content ───────────────────────────────────────────── */}
        {!loaded ? (
          <div className="text-center py-20 text-[#475569]">Loading…</div>
        ) : replays.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 rounded-2xl bg-[rgba(15,23,42,0.6)] border border-gold/[0.15]">
            <span className="text-5xl">🏴‍☠️</span>
            <p className="text-lg font-semibold text-[#94a3b8]">No replays saved yet</p>
            <p className="text-sm text-center max-w-xs text-[#475569]">
              Play a game — replays are saved automatically when the match ends.
            </p>
            <button
              onClick={() => router.push(ROUTES.play)}
              className="mt-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105 bg-[#fbbf24] text-[#0c1524] shadow-[0_2px_12px_rgba(251,191,36,0.4)]"
            >
              ⚔️ Play Now
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {replays.map((meta) => {
              const { text: resultText, color: resultColor } = resultLabel(meta);
              const duration = formatDuration(meta.totalTicks, meta.tickRateMs);

              return (
                <div
                  key={meta.id}
                  onClick={() => router.push(`/replays/${meta.id}`)}
                  className="group flex items-center gap-4 px-5 py-4 rounded-xl cursor-pointer transition-all hover:scale-[1.01] bg-[rgba(15,23,42,0.7)] border border-gold/20 shadow-[0_2px_10px_rgba(0,0,0,0.3)]"
                >
                  {/* ── Play icon ─── */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors bg-purple-500/20 border border-purple-500/40">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#a78bfa">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  </div>

                  {/* ── Main info ─── */}
                  <div className="flex-1 min-w-0">
                    {/* Bot names */}
                    <div className="flex items-center gap-2 text-sm font-bold mb-0.5">
                      <span className="text-[#60a5fa]">{meta.player1Name}</span>
                      <span className="text-[#334155]">vs</span>
                      <span className="text-[#f87171]">{meta.player2Name}</span>
                    </div>
                    {/* Result + duration */}
                    <div className="flex items-center gap-3">
                      {/* resultColor is dynamic per replay — must stay as style */}
                      <span className="text-xs font-semibold" style={{ color: resultColor }}>
                        {resultText}
                      </span>
                      <span className="text-xs text-[#475569]">{duration}</span>
                      <span className="text-xs text-[#334155]">{meta.frameCount} frames</span>
                    </div>
                  </div>

                  {/* ── Date ─── */}
                  <div className="flex-shrink-0 text-xs text-right text-[#475569]">
                    {formatDate(meta.savedAt)}
                  </div>

                  {/* ── Delete ─── */}
                  <button
                    onClick={(e) => handleDelete(e, meta.id)}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-red-900/40 text-red-500"
                    title="Delete replay"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Back link ──────────────────────────────────────────── */}
        {replays.length > 0 && (
          <div className="mt-8 text-center">
            <button
              onClick={() => router.push(ROUTES.play)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:brightness-110 bg-gold/[0.15] text-[#fbbf24] border border-gold/30"
            >
              ⚔️ Play Another Game
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
