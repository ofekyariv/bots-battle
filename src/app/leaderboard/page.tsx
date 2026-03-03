// ============================================================
// 🏴☠️ /leaderboard — Global ELO Rankings
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { RankBadge } from '@/components/leaderboard/RankBadge';

type Timeframe = 'all' | 'month' | 'week';

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  image: string | null;
  elo: number;
  wins: number;
  losses: number;
  winRate: number;
  topBot: { name: string; language: string } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const TIMEFRAME_TABS: { key: Timeframe; label: string }[] = [
  { key: 'all', label: '⚓ All Time' },
  { key: 'month', label: '📅 This Month' },
  { key: 'week', label: '⚡ This Week' },
];

const LANG_EMOJI: Record<string, string> = {
  javascript: '🟨',
  typescript: '🟦',
  python: '🐍',
  kotlin: '🟣',
  java: '☕',
  csharp: '🔵',
  swift: '🟠',
};

const TOP3_ROW_STYLES: Record<number, string> = {
  1: 'bg-gradient-to-r from-yellow-900/30 to-transparent border-l-2 border-yellow-400',
  2: 'bg-gradient-to-r from-slate-700/30 to-transparent border-l-2 border-slate-400',
  3: 'bg-gradient-to-r from-amber-900/30 to-transparent border-l-2 border-amber-600',
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [timeframe, setTimeframe] = useState<Timeframe>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (tf: Timeframe, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/leaderboard?timeframe=${tf}&page=${p}&limit=25`);
      if (!res.ok) throw new Error('Failed to load leaderboard');
      const json = await res.json();
      setEntries(json.data);
      setPagination(json.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(timeframe, page);
  }, [timeframe, page, load]);

  function handleTimeframeChange(tf: Timeframe) {
    setTimeframe(tf);
    setPage(1);
  }

  const filtered = search.trim()
    ? entries.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : entries;

  return (
    <main className="min-h-screen bg-navy text-white px-4 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold font-serif text-gold tracking-wide mb-2">
          🏴‍☠️ Hall of Legends
        </h1>
        <p className="text-gold/60 text-sm">
          The greatest pirates of the seven seas, ranked by ELO glory.
        </p>
      </div>

      {/* Timeframe tabs */}
      <div className="flex gap-2 mb-4 justify-center flex-wrap">
        {TIMEFRAME_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTimeframeChange(key)}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all border ${
              timeframe === key
                ? 'bg-gold text-navy border-gold shadow-[0_0_8px_rgba(212,168,67,0.4)]'
                : 'bg-transparent text-gold/60 border-gold/20 hover:border-gold/50 hover:text-gold'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="🔍 Search pirates by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-navy-light border border-gold/20 rounded-md px-4 py-2 text-sm text-white placeholder-gold/40 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30"
        />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gold/20 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[3rem_1fr_6rem_7rem_6rem_8rem] gap-2 px-4 py-2 bg-navy-dark/80 text-gold/50 text-xs font-semibold uppercase tracking-wider border-b border-gold/10">
          <span>#</span>
          <span>Pirate</span>
          <span className="text-center">ELO</span>
          <span className="text-center">W / L</span>
          <span className="text-center">Win %</span>
          <span>Top Bot</span>
        </div>

        {loading && (
          <div className="py-16 text-center text-gold/50 animate-pulse">
            ⚓ Loading the seas...
          </div>
        )}

        {error && (
          <div className="py-16 text-center text-red-400">
            ☠️ {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="py-16 text-center text-gold/40">
            No pirates found in these waters.
          </div>
        )}

        {!loading && !error && filtered.map((entry) => {
          const rowStyle = TOP3_ROW_STYLES[entry.rank] ?? 'border-l-2 border-transparent';
          return (
            <button
              key={entry.id}
              onClick={() => router.push(`/profile/${entry.id}`)}
              className={`w-full grid grid-cols-[3rem_1fr_6rem_7rem_6rem_8rem] gap-2 items-center px-4 py-3 text-left transition-all hover:bg-gold/5 border-b border-gold/5 last:border-0 ${rowStyle}`}
            >
              {/* Rank */}
              <div className="flex items-center justify-start">
                <RankBadge rank={entry.rank} size="sm" />
              </div>

              {/* User */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-gold/20 shrink-0 bg-navy-dark">
                  {entry.image ? (
                    <Image
                      src={entry.image}
                      alt={entry.name}
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gold/50 text-sm">
                      🏴‍☠️
                    </div>
                  )}
                </div>
                <span className="font-semibold text-sm truncate text-white">
                  {entry.name}
                </span>
              </div>

              {/* ELO */}
              <div className={`text-center font-bold text-sm ${entry.rank <= 3 ? 'text-gold' : 'text-gold/80'}`}>
                {entry.elo.toLocaleString()}
              </div>

              {/* W/L */}
              <div className="text-center text-sm text-white/70">
                <span className="text-green-400">{entry.wins}W</span>
                {' / '}
                <span className="text-red-400">{entry.losses}L</span>
              </div>

              {/* Win rate */}
              <div className="text-center text-sm text-white/70">
                {entry.wins + entry.losses > 0 ? `${entry.winRate}%` : '—'}
              </div>

              {/* Top bot */}
              <div className="text-xs text-white/60 truncate">
                {entry.topBot ? (
                  <span>
                    {LANG_EMOJI[entry.topBot.language] ?? '🤖'}{' '}
                    {entry.topBot.name}
                  </span>
                ) : (
                  <span className="text-white/30">—</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && !search && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-md border border-gold/20 text-gold/60 text-sm hover:border-gold/50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <span className="text-gold/50 text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page >= pagination.totalPages}
            className="px-3 py-1.5 rounded-md border border-gold/20 text-gold/60 text-sm hover:border-gold/50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </main>
  );
}
