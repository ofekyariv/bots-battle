// ============================================================
// 🏴☠️ SpectatorHUD — Live match overlay
// ============================================================

'use client';

import { useState, useCallback } from 'react';
import type { BotInfo } from '@/hooks/useMatchStream';

interface Props {
  player1Bot: BotInfo | null;
  player2Bot: BotInfo | null;
  player1Score: number;
  player2Score: number;
  tick: number;
  maxTicks: number;
  isLive: boolean;
  isComplete: boolean;
  winnerBotId?: string | null;
}

const LANG_EMOJI: Record<string, string> = {
  javascript: '🟨',
  typescript: '🔷',
  python: '🐍',
  kotlin: '🟣',
  java: '☕',
  csharp: '🔵',
  swift: '🧡',
};

export function SpectatorHUD({
  player1Bot,
  player2Bot,
  player1Score,
  player2Score,
  tick,
  maxTicks,
  isLive,
  isComplete,
  winnerBotId,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const progressPct = maxTicks > 0 ? Math.min(100, (tick / maxTicks) * 100) : 0;
  const p1Wins = isComplete && winnerBotId === player1Bot?.id;
  const p2Wins = isComplete && winnerBotId === player2Bot?.id;

  return (
    <div className="rounded-xl bg-[rgba(15,23,42,0.85)] border border-[#fbbf24]/20 p-4 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-[#94a3b8] uppercase tracking-widest">
          {isLive ? '⚔️ Live Match' : isComplete ? '🏁 Match Complete' : '⏳ Waiting…'}
        </h3>
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              LIVE
            </span>
          )}
          <button
            onClick={handleShare}
            className="text-xs px-3 py-1 rounded-lg bg-[rgba(15,23,42,0.7)] border border-[#334155] text-[#94a3b8] hover:brightness-110 transition"
          >
            {copied ? '✅ Copied!' : '🔗 Share'}
          </button>
        </div>
      </div>

      {/* Combatants row */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
        {/* Player 1 */}
        <div className="flex flex-col items-start gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-lg">{LANG_EMOJI[player1Bot?.language ?? ''] ?? '🤖'}</span>
            <span className="text-sm font-bold text-[#60a5fa] truncate max-w-[120px]">
              {player1Bot?.name ?? 'Player 1'}
            </span>
            {p1Wins && <span className="text-yellow-400 text-sm">🏆</span>}
          </div>
          <span className="text-xs text-[#475569] pl-7">{player1Bot?.language}</span>
        </div>

        {/* Scores */}
        <div className="flex items-center gap-3 font-black text-2xl">
          <span className={`text-[#60a5fa] ${p1Wins ? 'scale-110' : ''} transition-transform`}>
            {player1Score}
          </span>
          <span className="text-[#334155] text-base">—</span>
          <span className={`text-[#f87171] ${p2Wins ? 'scale-110' : ''} transition-transform`}>
            {player2Score}
          </span>
        </div>

        {/* Player 2 */}
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5">
            {p2Wins && <span className="text-yellow-400 text-sm">🏆</span>}
            <span className="text-sm font-bold text-[#f87171] truncate max-w-[120px]">
              {player2Bot?.name ?? 'Player 2'}
            </span>
            <span className="text-lg">{LANG_EMOJI[player2Bot?.language ?? ''] ?? '🤖'}</span>
          </div>
          <span className="text-xs text-[#475569] pr-7">{player2Bot?.language}</span>
        </div>
      </div>

      {/* Progress bar */}
      {maxTicks > 0 && (
        <div>
          <div className="flex justify-between text-xs text-[#475569] mb-1">
            <span>Tick {tick.toLocaleString()}</span>
            <span>{maxTicks.toLocaleString()} max</span>
          </div>
          <div className="h-2 rounded-full bg-[#1e293b] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
