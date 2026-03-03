// ============================================================
// 🏴☠️ /matches — Browse recent & live matches
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface MatchRow {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'errored';
  player1BotId: string;
  player2BotId: string;
  winnerBotId: string | null;
  player1Score: number;
  player2Score: number;
  durationMs: number;
  createdAt: string;
  completedAt: string | null;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDuration(ms: number): string {
  if (ms === 0) return '—';
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

// ─────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  queued:    { label: '⏳ Queued',   classes: 'bg-yellow-900/40 text-yellow-400 border-yellow-500/30' },
  running:   { label: '⚔️ Running',  classes: 'bg-blue-900/40 text-blue-400 border-blue-500/30 animate-pulse' },
  completed: { label: '✅ Done',     classes: 'bg-green-900/40 text-green-400 border-green-500/30' },
  errored:   { label: '❌ Error',    classes: 'bg-red-900/40 text-red-400 border-red-500/30' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? { label: status, classes: 'bg-gray-800 text-gray-400 border-gray-600' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${s.classes}`}>
      {s.label}
    </span>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function MatchesPage() {
  const router = useRouter();
  const [matchList, setMatchList] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  async function fetchMatches(p: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/matches?page=${p}&limit=20`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setMatchList(data.matches ?? []);
      setHasMore((data.matches?.length ?? 0) === 20);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMatches(page);
  }, [page]);

  // Auto-refresh if any matches are live
  useEffect(() => {
    const hasLive = matchList.some((m) => m.status === 'queued' || m.status === 'running');
    if (!hasLive) return;
    const timer = setTimeout(() => fetchMatches(page), 3000);
    return () => clearTimeout(timer);
  }, [matchList, page]);

  return (
    <div className="min-h-screen py-12 px-4 bg-navy">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#fbbf24] font-serif">⚔️ Matches</h1>
            <p className="text-sm text-[#64748b] mt-1">Live and recent bot battles</p>
          </div>
          <button
            onClick={() => fetchMatches(page)}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[rgba(251,191,36,0.1)] text-[#fbbf24] border border-[#fbbf24]/30 hover:brightness-110 transition-all"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Table */}
        {loading && matchList.length === 0 ? (
          <div className="text-center py-20 text-[#475569]">Loading…</div>
        ) : matchList.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 rounded-2xl bg-[rgba(15,23,42,0.6)] border border-[#fbbf24]/15">
            <span className="text-5xl">🏴☠️</span>
            <p className="text-lg font-semibold text-[#94a3b8]">No matches yet</p>
            <p className="text-sm text-[#475569]">Create a match via the API or the editor.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {matchList.map((m) => (
                <div
                  key={m.id}
                  onClick={() => router.push(`/matches/${m.id}`)}
                  className="group flex items-center gap-4 px-5 py-4 rounded-xl cursor-pointer transition-all hover:scale-[1.01] bg-[rgba(15,23,42,0.7)] border border-[#fbbf24]/20 shadow-[0_2px_10px_rgba(0,0,0,0.3)]"
                >
                  {/* Status */}
                  <div className="flex-shrink-0 w-28">
                    <StatusBadge status={m.status} />
                  </div>

                  {/* Bot IDs (truncated) */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-mono mb-0.5">
                      <span className="text-[#60a5fa] truncate max-w-[120px]">{m.player1BotId.slice(0, 8)}…</span>
                      <span className="text-[#334155]">vs</span>
                      <span className="text-[#f87171] truncate max-w-[120px]">{m.player2BotId.slice(0, 8)}…</span>
                    </div>
                    {m.status === 'completed' && (
                      <div className="text-xs text-[#64748b]">
                        Score: {m.player1Score} – {m.player2Score} · {formatDuration(m.durationMs)}
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <div className="flex-shrink-0 text-xs text-[#475569]">
                    {formatDate(m.createdAt)}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 bg-[rgba(15,23,42,0.7)] border border-[#fbbf24]/20 text-[#94a3b8] hover:brightness-110 transition-all"
              >
                ← Prev
              </button>
              <span className="text-sm text-[#475569]">Page {page}</span>
              <button
                disabled={!hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 bg-[rgba(15,23,42,0.7)] border border-[#fbbf24]/20 text-[#94a3b8] hover:brightness-110 transition-all"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
