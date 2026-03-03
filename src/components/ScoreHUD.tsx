// ============================================================
// 🏴‍☠️ ScoreHUD — semi-transparent overlay on the game canvas
//
// Shows per-player:
//   • Score (big number, animated gold)
//   • Ships alive / total
//   • Islands owned
//
// Plus center: timer countdown and current tick.
// ============================================================

'use client';

import { memo } from 'react';
import type { FullGameState } from '@/engine/types';

interface Props {
  gameState: FullGameState;
  player1Name?: string;
  player2Name?: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function ShipDots({ alive, total }: { alive: number; total: number }) {
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`inline-block w-2 h-2 rounded-full border border-white/30 ${
            i < alive ? 'bg-current opacity-90' : 'bg-transparent opacity-25'
          }`}
        />
      ))}
    </div>
  );
}

function IslandIcons({ count, total }: { count: number; total: number }) {
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`text-xs leading-none ${i < count ? 'opacity-100' : 'opacity-20'}`}
        >
          ⬡
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

function ScoreHUD({ gameState, player1Name = 'Player 1', player2Name = 'Player 2' }: Props) {
  const { player1, player2, tick, config, ships, islands } = gameState;

  const ticksLeft = Math.max(0, config.gameDuration - tick);
  const secondsLeft = (ticksLeft * config.tickRateMs) / 1000;

  const p1Alive = ships.filter((s) => s.owner === 'player1' && s.alive).length;
  const p2Alive = ships.filter((s) => s.owner === 'player2' && s.alive).length;
  const totalShips = config.shipsPerPlayer;

  const p1Islands = islands.filter((i) => i.owner === 'player1').length;
  const p2Islands = islands.filter((i) => i.owner === 'player2').length;
  const totalIslands = islands.length;

  // Score progress toward target
  const p1Pct = Math.min(100, (player1.score / config.targetScore) * 100);
  const p2Pct = Math.min(100, (player2.score / config.targetScore) * 100);

  // Points per tick rate (exponential)
  const p1Rate = p1Islands > 0 ? Math.pow(2, p1Islands - 1) : 0;
  const p2Rate = p2Islands > 0 ? Math.pow(2, p2Islands - 1) : 0;

  // Timer urgency
  const isUrgent = secondsLeft <= 30 && secondsLeft > 0;

  return (
    <div className="flex items-stretch gap-2 rounded-xl overflow-hidden font-mono select-none bg-[rgba(5,12,30,0.88)] backdrop-blur-md border border-[rgba(212,175,55,0.35)] shadow-[0_4px_24px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(212,175,55,0.15)]">
      {/* ─── Player 1 (Blue) ─── */}
      <div className="flex-1 flex flex-col px-4 py-3 gap-1.5 min-w-0">
        {/* Name row */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold tracking-widest uppercase truncate text-blue-400">
            ⚓ {player1Name}
          </span>
        </div>

        {/* Score */}
        <div className="text-3xl font-extrabold leading-none tabular-nums text-amber-400 [text-shadow:0_0_20px_rgba(251,191,36,0.5)]">
          {player1.score.toLocaleString()}
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full overflow-hidden bg-blue-400/15">
          <div
            className="h-full rounded-full transition-all duration-300 bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]"
            style={{ width: `${p1Pct}%` }}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-slate-400">
          {/* Ships */}
          <div className="flex items-center gap-1.5 text-blue-400">
            <ShipDots alive={p1Alive} total={totalShips} />
            <span>
              {p1Alive}/{totalShips}
            </span>
          </div>

          {/* Islands */}
          <div className="flex items-center gap-1 leading-none text-blue-400">
            <IslandIcons count={p1Islands} total={totalIslands} />
          </div>

          {/* Rate */}
          {p1Rate > 0 && (
            <span className="text-xs px-1 rounded bg-blue-400/15 text-blue-300">
              +{p1Rate}/tick
            </span>
          )}
        </div>
      </div>

      {/* ─── Center — Timer ─── */}
      <div className="flex flex-col items-center justify-center px-5 gap-1 border-x border-[rgba(212,175,55,0.20)] shrink-0">
        {/* Countdown */}
        <div
          className={`text-2xl font-extrabold tabular-nums leading-none ${
            isUrgent
              ? 'text-red-400 [text-shadow:0_0_16px_rgba(248,113,113,0.7)] animate-pulse'
              : 'text-slate-200'
          }`}
        >
          {formatTime(secondsLeft)}
        </div>

        {/* Tick */}
        <div className="text-xs text-slate-600">tick {tick}</div>

        {/* Target score hint */}
        <div className="text-xs text-slate-500">🏆 {config.targetScore.toLocaleString()}</div>
      </div>

      {/* ─── Player 2 (Red) ─── */}
      <div className="flex-1 flex flex-col items-end px-4 py-3 gap-1.5 min-w-0">
        {/* Name */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold tracking-widest uppercase truncate text-red-400">
            {player2Name} 🏴‍☠️
          </span>
        </div>

        {/* Score */}
        <div className="text-3xl font-extrabold leading-none tabular-nums text-amber-400 [text-shadow:0_0_20px_rgba(251,191,36,0.5)]">
          {player2.score.toLocaleString()}
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full overflow-hidden w-full bg-red-400/15">
          <div
            className="h-full rounded-full ml-auto transition-all duration-300 bg-gradient-to-l from-red-500 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
            style={{ width: `${p2Pct}%` }}
          />
        </div>

        {/* Stats row (right-aligned) */}
        <div className="flex items-center justify-end gap-3 text-xs w-full text-slate-400">
          {/* Rate */}
          {p2Rate > 0 && (
            <span className="text-xs px-1 rounded bg-red-400/15 text-red-300">+{p2Rate}/tick</span>
          )}

          {/* Islands */}
          <div className="flex items-center gap-1 leading-none text-red-400">
            <IslandIcons count={p2Islands} total={totalIslands} />
          </div>

          {/* Ships */}
          <div className="flex items-center gap-1.5 text-red-400">
            <span>
              {p2Alive}/{totalShips}
            </span>
            <ShipDots alive={p2Alive} total={totalShips} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Custom equality — only re-render when scores / tick change.
// This fires once per game tick (tick increments each tick), preventing
// spurious re-renders triggered by unrelated GameRunner state changes
// (e.g. savedReplayId being set, isFinished toggling).
// ─────────────────────────────────────────────
function arePropsEqual(prev: Props, next: Props): boolean {
  if (prev.player1Name !== next.player1Name) return false;
  if (prev.player2Name !== next.player2Name) return false;
  const pg = prev.gameState;
  const ng = next.gameState;
  return (
    pg.tick === ng.tick &&
    pg.player1.score === ng.player1.score &&
    pg.player2.score === ng.player2.score &&
    pg.status === ng.status
  );
}

export default memo(ScoreHUD, arePropsEqual);
