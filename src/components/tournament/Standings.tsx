'use client';

// ─────────────────────────────────────────────
// Round Robin standings table
// ─────────────────────────────────────────────

export interface StandingRow {
  userId: string;
  botId: string;
  userName: string | null;
  botName: string | null;
  wins: number;
  losses: number;
  finalRank: number | null;
}

interface StandingsProps {
  entries: StandingRow[];
}

export default function Standings({ entries }: StandingsProps) {
  const sorted = [...entries].sort((a, b) => {
    if (a.finalRank !== null && b.finalRank !== null) return a.finalRank - b.finalRank;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.losses - b.losses;
  });

  const total = sorted.reduce((s, e) => s + e.wins + e.losses, 0) / 2;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[#64748b] uppercase tracking-widest border-b border-gold/10">
            <th className="pb-2 pr-4">#</th>
            <th className="pb-2 pr-4">Player</th>
            <th className="pb-2 pr-4">Bot</th>
            <th className="pb-2 pr-4 text-right">W</th>
            <th className="pb-2 pr-4 text-right">L</th>
            <th className="pb-2 text-right">Win%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, i) => {
            const played = entry.wins + entry.losses;
            const pct = played > 0 ? Math.round((entry.wins / played) * 100) : 0;
            return (
              <tr
                key={entry.userId}
                className="border-b border-gold/5 hover:bg-gold/5 transition-colors"
              >
                <td className="py-3 pr-4 font-mono text-[#64748b]">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td className="py-3 pr-4 text-[#e2e8f0]">{entry.userName ?? '—'}</td>
                <td className="py-3 pr-4 text-gold font-semibold">{entry.botName ?? '—'}</td>
                <td className="py-3 pr-4 text-right text-green-400 font-bold">{entry.wins}</td>
                <td className="py-3 pr-4 text-right text-red-400">{entry.losses}</td>
                <td className="py-3 text-right text-[#94a3b8]">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {total === 0 && (
        <p className="text-center text-[#475569] py-6">No results yet.</p>
      )}
    </div>
  );
}
