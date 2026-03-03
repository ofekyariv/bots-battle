// ============================================================
// 🏆 /tournaments/[id] — Tournament detail page
// ============================================================

'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Bracket from '@/components/tournament/Bracket';
import Standings, { type StandingRow } from '@/components/tournament/Standings';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface TournamentDetail {
  id: string;
  name: string;
  format: 'round_robin' | 'single_elim' | 'double_elim';
  status: 'open' | 'in_progress' | 'completed';
  maxPlayers: number;
  creatorId: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface EntryRow {
  userId: string;
  botId: string;
  finalRank: number | null;
  wins: number;
  losses: number;
  joinedAt: string;
  userName: string | null;
  userImage: string | null;
  botName: string | null;
  eloRating: number | null;
}

interface MatchRow {
  id: string;
  round: number;
  player1BotId: string;
  player2BotId: string;
  winnerBotId: string | null;
  status: string;
  player1Score: number;
  player2Score: number;
}

const FORMAT_LABELS: Record<string, string> = {
  round_robin: '🔄 Round Robin',
  single_elim: '🗡️ Single Elimination',
  double_elim: '⚔️ Double Elimination',
};

const STATUS_META: Record<string, { label: string; classes: string }> = {
  open: { label: '🟢 Open', classes: 'text-green-400 bg-green-900/30 border-green-500/30' },
  in_progress: { label: '⚔️ In Progress', classes: 'text-blue-400 bg-blue-900/30 border-blue-500/30' },
  completed: { label: '✅ Completed', classes: 'text-gray-400 bg-gray-800 border-gray-600' },
};

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'bracket' | 'standings'>('bracket');
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      const res = await fetch(`/api/tournaments/${id}`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setTournament(data.tournament);
      setEntries(data.entries ?? []);
      setMatches(data.matches ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  // Auto-refresh when matches are running
  useEffect(() => {
    const hasLive = matches.some((m) => m.status === 'queued' || m.status === 'running');
    if (!hasLive || tournament?.status === 'completed') return;
    const t = setTimeout(() => load(), 3000);
    return () => clearTimeout(t);
  }, [matches, tournament]);

  async function handleStart() {
    setStarting(true);
    setError('');
    try {
      const res = await fetch(`/api/tournaments/${id}/start`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to start'); return; }
      await load();
    } catch { setError('Network error'); }
    finally { setStarting(false); }
  }

  async function handleJoin(botId: string) {
    setJoining(true);
    setError('');
    try {
      const res = await fetch(`/api/tournaments/${id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to join'); return; }
      await load();
    } catch { setError('Network error'); }
    finally { setJoining(false); }
  }

  if (loading) return <div className="min-h-screen py-12 px-4 bg-navy text-center text-[#475569]">Loading…</div>;
  if (!tournament) return <div className="min-h-screen py-12 px-4 bg-navy text-center text-red-400">Tournament not found.</div>;

  const statusMeta = STATUS_META[tournament.status];
  const standingRows: StandingRow[] = entries.map((e) => ({
    userId: e.userId,
    botId: e.botId,
    userName: e.userName,
    botName: e.botName,
    wins: e.wins,
    losses: e.losses,
    finalRank: e.finalRank,
  }));

  const botInfos = entries.map((e) => ({
    botId: e.botId,
    botName: e.botName ?? '—',
    userName: e.userName ?? '—',
  }));

  return (
    <div className="min-h-screen py-12 px-4 bg-navy">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-[#fbbf24] font-serif mb-1">
                🏆 {tournament.name}
              </h1>
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusMeta.classes}`}>
                  {statusMeta.label}
                </span>
                <span className="text-[#64748b]">{FORMAT_LABELS[tournament.format]}</span>
                <span className="text-[#475569]">{entries.length} / {tournament.maxPlayers} players</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {tournament.status === 'open' && (
                <>
                  <button
                    onClick={() => {
                      const botId = prompt('Enter your Bot ID to join:');
                      if (botId) handleJoin(botId.trim());
                    }}
                    disabled={joining}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-[rgba(251,191,36,0.1)] text-[#fbbf24] border border-[#fbbf24]/30 hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {joining ? 'Joining…' : '+ Join'}
                  </button>
                  <button
                    onClick={handleStart}
                    disabled={starting || entries.length < 2}
                    className="px-4 py-2 rounded-lg text-sm font-bold bg-gold text-navy shadow-[0_2px_8px_rgba(212,168,67,0.35)] hover:scale-105 transition-all disabled:opacity-50"
                  >
                    {starting ? 'Starting…' : '⚓ Start'}
                  </button>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-3 px-4 py-2 rounded-lg bg-red-900/30 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gold/10 pb-3">
          {(['bracket', 'standings'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all capitalize ${
                tab === t ? 'bg-gold text-navy' : 'text-[#94a3b8] hover:text-gold hover:bg-gold/10'
              }`}
            >
              {t === 'bracket' ? '🗓️ Bracket' : '📊 Standings'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-[rgba(15,23,42,0.7)] border border-gold/20 rounded-2xl p-6 shadow-xl">
          {tab === 'bracket' ? (
            <Bracket
              matches={matches}
              bots={botInfos}
              onMatchClick={(matchId) => router.push(`/matches/${matchId}`)}
            />
          ) : (
            <Standings entries={standingRows} />
          )}
        </div>

        {/* Participants list */}
        {entries.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-bold text-[#94a3b8] uppercase tracking-widest mb-3">Participants</h2>
            <div className="flex flex-wrap gap-2">
              {entries.map((e) => (
                <div
                  key={e.userId}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(15,23,42,0.7)] border border-gold/10 text-sm text-[#94a3b8]"
                >
                  {e.userImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.userImage} alt="" className="w-5 h-5 rounded-full" />
                  )}
                  <span className="text-gold font-semibold">{e.botName ?? '—'}</span>
                  <span className="text-[#475569]">by {e.userName ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
