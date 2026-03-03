// ============================================================
// 🏆 /tournaments — Browse tournaments
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type TournamentStatus = 'open' | 'in_progress' | 'completed';

interface TournamentRow {
  id: string;
  name: string;
  format: string;
  status: TournamentStatus;
  maxPlayers: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

const STATUS_META: Record<TournamentStatus, { label: string; classes: string }> = {
  open: { label: '🟢 Open', classes: 'bg-green-900/30 text-green-400 border-green-500/30' },
  in_progress: { label: '⚔️ In Progress', classes: 'bg-blue-900/30 text-blue-400 border-blue-500/30 animate-pulse' },
  completed: { label: '✅ Completed', classes: 'bg-gray-800 text-gray-400 border-gray-600' },
};

const FORMAT_LABELS: Record<string, string> = {
  round_robin: '🔄 Round Robin',
  single_elim: '🗡️ Single Elim',
  double_elim: '⚔️ Double Elim',
};

const TABS: { key: TournamentStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function TournamentsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TournamentStatus | 'all'>('all');
  const [list, setList] = useState<TournamentRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(status: TournamentStatus | 'all') {
    setLoading(true);
    try {
      const url = status === 'all' ? '/api/tournaments' : `/api/tournaments?status=${status}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setList(data.tournaments ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(tab); }, [tab]);

  return (
    <div className="min-h-screen py-12 px-4 bg-navy">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-[#fbbf24] font-serif">🏆 Tournaments</h1>
            <p className="text-sm text-[#64748b] mt-1">Compete with your bots</p>
          </div>
          <Link
            href="/tournaments/create"
            className="px-4 py-2 rounded-lg text-sm font-bold bg-gold text-navy shadow-[0_2px_8px_rgba(212,168,67,0.35)] hover:scale-105 transition-all"
          >
            + Create
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gold/10 pb-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                tab === t.key
                  ? 'bg-gold text-navy'
                  : 'text-[#94a3b8] hover:text-gold hover:bg-gold/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-20 text-[#475569]">Loading…</div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 rounded-2xl bg-[rgba(15,23,42,0.6)] border border-[#fbbf24]/15">
            <span className="text-5xl">🏆</span>
            <p className="text-lg font-semibold text-[#94a3b8]">No tournaments found</p>
            <Link
              href="/tournaments/create"
              className="px-5 py-2 rounded-lg text-sm font-bold bg-gold text-navy"
            >
              Create the first one
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((t) => {
              const meta = STATUS_META[t.status];
              return (
                <div
                  key={t.id}
                  onClick={() => router.push(`/tournaments/${t.id}`)}
                  className="group flex items-center gap-4 px-5 py-4 rounded-xl cursor-pointer transition-all hover:scale-[1.01] bg-[rgba(15,23,42,0.7)] border border-[#fbbf24]/20 shadow-[0_2px_10px_rgba(0,0,0,0.3)]"
                >
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${meta.classes}`}>
                    {meta.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[#e2e8f0] truncate">{t.name}</div>
                    <div className="text-xs text-[#64748b]">
                      {FORMAT_LABELS[t.format] ?? t.format} · up to {t.maxPlayers} players
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-xs text-[#475569]">{formatDate(t.createdAt)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
