'use client';

// ─────────────────────────────────────────────
// Visual bracket for elimination formats
// ─────────────────────────────────────────────

interface MatchNode {
  id: string;
  round: number;
  player1BotId: string;
  player2BotId: string;
  winnerBotId: string | null;
  status: string;
  player1Score: number;
  player2Score: number;
}

interface BotInfo {
  botId: string;
  botName: string;
  userName: string;
}

interface BracketProps {
  matches: MatchNode[];
  bots: BotInfo[];
  onMatchClick?: (matchId: string) => void;
}

function botLabel(botId: string, bots: BotInfo[]): string {
  const info = bots.find((b) => b.botId === botId);
  if (!info) return botId.slice(0, 8) + '…';
  return `${info.botName} (${info.userName})`;
}

function MatchCard({
  match,
  bots,
  onClick,
}: {
  match: MatchNode;
  bots: BotInfo[];
  onClick?: () => void;
}) {
  const p1Winner = match.winnerBotId === match.player1BotId;
  const p2Winner = match.winnerBotId === match.player2BotId;

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border p-3 min-w-[200px] ${
        onClick ? 'cursor-pointer hover:border-gold/60' : ''
      } bg-[rgba(15,23,42,0.8)] border-gold/20 shadow`}
    >
      <div className="text-xs text-[#64748b] mb-2 font-mono">Round {match.round}</div>
      <div
        className={`flex items-center justify-between py-1 px-2 rounded text-sm mb-1 ${
          p1Winner ? 'bg-green-900/30 text-green-300' : 'text-[#94a3b8]'
        }`}
      >
        <span className="truncate max-w-[140px]">{botLabel(match.player1BotId, bots)}</span>
        {match.status === 'completed' && (
          <span className="ml-2 font-bold">{match.player1Score}</span>
        )}
      </div>
      <div
        className={`flex items-center justify-between py-1 px-2 rounded text-sm ${
          p2Winner ? 'bg-green-900/30 text-green-300' : 'text-[#94a3b8]'
        }`}
      >
        <span className="truncate max-w-[140px]">{botLabel(match.player2BotId, bots)}</span>
        {match.status === 'completed' && (
          <span className="ml-2 font-bold">{match.player2Score}</span>
        )}
      </div>
      {match.status !== 'completed' && (
        <div className="mt-2 text-center text-xs text-[#475569]">
          {match.status === 'running' ? '⚔️ Running…' : '⏳ Queued'}
        </div>
      )}
    </div>
  );
}

export default function Bracket({ matches, bots, onMatchClick }: BracketProps) {
  // Group by round
  const rounds = Array.from(new Set(matches.map((m) => m.round))).sort((a, b) => a - b);
  const byRound = rounds.map((r) => matches.filter((m) => m.round === r));

  if (matches.length === 0) {
    return (
      <div className="text-center text-[#475569] py-8">
        No matches yet. Start the tournament to generate the bracket.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-8 items-start min-w-max">
        {byRound.map((roundMatches, ri) => (
          <div key={rounds[ri]} className="flex flex-col gap-4">
            <div className="text-xs font-bold text-gold uppercase tracking-widest mb-2 text-center">
              {ri === byRound.length - 1 && byRound.length > 1 ? '🏆 Final' : `Round ${rounds[ri]}`}
            </div>
            {roundMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                bots={bots}
                onClick={onMatchClick ? () => onMatchClick(m.id) : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
