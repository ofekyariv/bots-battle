// ============================================================
// 🏴‍☠️ GameOverModal — end-of-match overlay
//
// Features:
//   • Winner announcement with pirate flair
//   • Final scores with visual comparison bar
//   • Canvas 2D score-over-time chart with island capture markers
//   • Stats panel: ships sunk, captures, streaks, avg ships, K/D
//   • Mini replay of key moments (captures, milestones, big combat kills)
//   • "Play Again" and "Back to Setup" action buttons
// ============================================================

'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { GameResult } from '@/engine/types';
import type { GameEvent, GameStats } from '@/lib/useGame';
import { VisuallyHidden } from 'radix-ui';
import { SectionHeader, Separator, Dialog, DialogContent, DialogTitle } from '@/components/ui';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ScoreSnapshot {
  /** Game tick when this snapshot was taken */
  tick: number;
  player1Score: number;
  player2Score: number;
}

interface Props {
  result: GameResult;
  scoreHistory: ScoreSnapshot[];
  gameEvents: GameEvent[];
  gameStats: GameStats;
  player1Name?: string;
  player2Name?: string;
  targetScore: number;
  /** Milliseconds per tick — used for accurate time display (default: 100) */
  tickRateMs?: number;
  /** Restart with the same bots but a freshly generated map */
  onPlayAgain: () => void;
  /** Navigate back to the full setup page */
  onBackToSetup: () => void;
  /** Watch the replay of this game (optional — shown when provided) */
  onWatchReplay?: () => void;
  /**
   * Switch to the next pre-built opponent and restart.
   * When omitted the button is hidden (e.g. custom-vs-custom matches).
   */
  onSwitchOpponent?: () => void;
  /** Display name of the next opponent (shown on the button) */
  nextOpponentName?: string;
  /** Override the "Back to Setup" button label (e.g. "Back to Campaign") */
  backToSetupLabel?: string;
  /** True when this game was launched from Campaign mode */
  isCampaignMode?: boolean;
  /** Label for the campaign continue button (e.g. "Next Challenge →") */
  campaignContinueLabel?: string;
  /** Called when the player clicks the campaign continue button */
  onCampaignContinue?: () => void;
}

// ─────────────────────────────────────────────
// Colors (module-level constants used in Canvas 2D rendering only)
// ─────────────────────────────────────────────

const P1_COLOR = '#60a5fa'; // blue-400
const P2_COLOR = '#f87171'; // red-400
const GOLD = '#fbbf24'; // amber-400
const GOLD_DIM = '#92741a';

// ─────────────────────────────────────────────
// Canvas 2D Score Chart
// ─────────────────────────────────────────────

interface ChartProps {
  history: ScoreSnapshot[];
  events: GameEvent[];
  targetScore: number;
  p1Name: string;
  p2Name: string;
  tickRateMs: number;
}

function ScoreChart({ history, events, targetScore, p1Name, p2Name, tickRateMs }: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.clientWidth || 520;
    const displayH = canvas.clientHeight || 200;
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Stable non-null reference for use in nested functions below
    const c = ctx;
    ctx.scale(dpr, dpr);

    const W = displayW;
    const H = displayH;
    const PAD = { top: 18, right: 18, bottom: 38, left: 58 };
    const chartW = W - PAD.left - PAD.right;
    const chartH = H - PAD.top - PAD.bottom;

    // Background
    ctx.fillStyle = 'rgba(10,18,40,0.9)';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 8);
    ctx.fill();

    const minTick = history[0].tick;
    const maxTick = history[history.length - 1].tick;
    const tickSpan = Math.max(1, maxTick - minTick);

    const maxScore = Math.max(
      targetScore,
      ...history.map((s) => Math.max(s.player1Score, s.player2Score)),
    );

    const tx = (tick: number) => PAD.left + ((tick - minTick) / tickSpan) * chartW;
    const ty = (score: number) => PAD.top + chartH - (score / maxScore) * chartH;

    // ── Grid lines ──────────────────────────────────────────────────────
    const gridFracs = [0, 0.25, 0.5, 0.75, 1];
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (const frac of gridFracs) {
      const y = ty(frac * maxScore);
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, y);
      ctx.lineTo(PAD.left + chartW, y);
      ctx.stroke();

      ctx.fillStyle = '#475569';
      ctx.fillText(Math.round(frac * maxScore).toLocaleString(), PAD.left - 5, y);
    }

    // ── Target score dashed line ─────────────────────────────────────────
    const targetY = ty(targetScore);
    if (targetY >= PAD.top && targetY <= PAD.top + chartH) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(251,191,36,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD.left, targetY);
      ctx.lineTo(PAD.left + chartW, targetY);
      ctx.stroke();
      ctx.restore();

      ctx.font = '8px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(251,191,36,0.7)';
      ctx.fillText('target', PAD.left + chartW, targetY - 5);
    }

    // ── Island capture event markers (vertical dashed lines) ──────────────
    const captureEvents = events.filter(
      (e) => e.type === 'island_capture' && e.tick >= minTick && e.tick <= maxTick,
    );
    for (const ev of captureEvents) {
      const x = tx(ev.tick);
      const color = ev.player === 'player1' ? P1_COLOR : P2_COLOR;
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = color + '88';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, PAD.top);
      ctx.lineTo(x, PAD.top + chartH);
      ctx.stroke();
      ctx.restore();

      // Dot marker at the bottom of the line
      ctx.beginPath();
      ctx.arc(x, PAD.top + chartH, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // ── Area fills ───────────────────────────────────────────────────────
    // Clip to chart area
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD.left, PAD.top, chartW, chartH);
    ctx.clip();

    function drawArea(key: 'player1Score' | 'player2Score', color: string) {
      const baseY = ty(0);
      const grad = c.createLinearGradient(0, PAD.top, 0, PAD.top + chartH);
      grad.addColorStop(0, color + '55');
      grad.addColorStop(1, color + '08');
      c.fillStyle = grad;
      c.beginPath();
      c.moveTo(tx(history[0].tick), baseY);
      for (const s of history) c.lineTo(tx(s.tick), ty(s[key]));
      c.lineTo(tx(history[history.length - 1].tick), baseY);
      c.closePath();
      c.fill();
    }

    drawArea('player1Score', P1_COLOR);
    drawArea('player2Score', P2_COLOR);

    // ── Score lines ──────────────────────────────────────────────────────
    function drawLine(key: 'player1Score' | 'player2Score', color: string) {
      c.strokeStyle = color;
      c.lineWidth = 2;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.beginPath();
      history.forEach((s, i) => {
        const x = tx(s.tick);
        const y = ty(s[key]);
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      c.stroke();
    }

    drawLine('player1Score', P1_COLOR);
    drawLine('player2Score', P2_COLOR);

    ctx.restore(); // end clip

    // ── Axes ──────────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD.left, PAD.top);
    ctx.lineTo(PAD.left, PAD.top + chartH);
    ctx.lineTo(PAD.left + chartW, PAD.top + chartH);
    ctx.stroke();

    // ── X-axis tick labels ────────────────────────────────────────────────
    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#475569';
    const xCount = 5;
    for (let i = 0; i <= xCount; i++) {
      const t = minTick + (tickSpan * i) / xCount;
      const sec = Math.round((t * tickRateMs) / 1000);
      ctx.fillText(`${sec}s`, tx(t), PAD.top + chartH + 5);
    }

    // ── Legend ────────────────────────────────────────────────────────────
    const legendY = H - 10;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = P1_COLOR;
    ctx.fillRect(PAD.left, legendY - 2, 10, 3);
    ctx.font = '9px system-ui, sans-serif';
    ctx.fillText(p1Name, PAD.left + 13, legendY);

    ctx.fillStyle = P2_COLOR;
    ctx.fillRect(PAD.left + 90, legendY - 2, 10, 3);
    ctx.fillText(p2Name, PAD.left + 103, legendY);

    // ── Capture legend marker ──────────────────────────────────────────────
    if (captureEvents.length > 0) {
      ctx.fillStyle = 'rgba(180,180,180,0.5)';
      ctx.fillRect(PAD.left + 180, legendY - 2, 10, 3);
      ctx.fillStyle = '#64748b';
      ctx.fillText('capture', PAD.left + 193, legendY);
    }
  }, [history, events, targetScore, p1Name, p2Name, tickRateMs]);

  if (history.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-lg text-sm h-[200px] text-slate-600 bg-[rgba(15,23,42,0.6)]">
        Not enough data to chart
      </div>
    );
  }

  return <canvas ref={canvasRef} className="w-full h-[200px] block rounded-lg" />;
}

// ─────────────────────────────────────────────
// Stats Panel
// ─────────────────────────────────────────────

interface StatsPanelProps {
  stats: GameStats;
  p1Name: string;
  p2Name: string;
  shipsPerPlayer: number;
}

function StatRow({
  label,
  p1Value,
  p2Value,
  highlight,
}: {
  label: string;
  p1Value: string | number;
  p2Value: string | number;
  highlight?: 'p1' | 'p2' | 'both' | 'none';
}) {
  const p1Bold = highlight === 'p1' || highlight === 'both';
  const p2Bold = highlight === 'p2' || highlight === 'both';

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 py-1 px-2 rounded bg-[rgba(15,23,42,0.4)] border-b border-slate-800/40">
      <div
        className={cn(
          'text-center tabular-nums text-xs font-bold',
          p1Bold ? 'text-blue-400' : 'text-slate-400',
        )}
      >
        {p1Value}
      </div>
      <div className="text-center text-[10px] tracking-wide text-slate-600 min-w-[100px]">{label}</div>
      <div
        className={cn(
          'text-center tabular-nums text-xs font-bold',
          p2Bold ? 'text-red-400' : 'text-slate-400',
        )}
      >
        {p2Value}
      </div>
    </div>
  );
}

function StatsPanel({ stats, p1Name, p2Name, shipsPerPlayer }: StatsPanelProps) {
  const p1Avg =
    stats.totalTicks > 0 ? (stats.player1TotalShipTicks / stats.totalTicks).toFixed(1) : '—';
  const p2Avg =
    stats.totalTicks > 0 ? (stats.player2TotalShipTicks / stats.totalTicks).toFixed(1) : '—';

  const p1Kd =
    stats.player1ShipsLost > 0
      ? (stats.player1ShipsSunk / stats.player1ShipsLost).toFixed(2)
      : stats.player1ShipsSunk > 0
        ? '∞'
        : '0.00';
  const p2Kd =
    stats.player2ShipsLost > 0
      ? (stats.player2ShipsSunk / stats.player2ShipsLost).toFixed(2)
      : stats.player2ShipsSunk > 0
        ? '∞'
        : '0.00';

  function higher(a: number, b: number): 'p1' | 'p2' | 'both' | 'none' {
    if (a === b) return 'both';
    return a > b ? 'p1' : 'p2';
  }

  function lower(a: number, b: number): 'p1' | 'p2' | 'both' | 'none' {
    if (a === b) return 'both';
    return a < b ? 'p1' : 'p2';
  }

  return (
    <div className="max-w-sm mx-auto">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 pb-1.5 mb-1">
        <div className="text-right text-xs font-bold tracking-wide text-blue-400">{p1Name}</div>
        <div className="min-w-[100px]" />
        <div className="text-left text-xs font-bold tracking-wide text-red-400">{p2Name}</div>
      </div>

      <div className="flex flex-col gap-0.5">
        <StatRow
          label="Ships Sunk"
          p1Value={stats.player1ShipsSunk}
          p2Value={stats.player2ShipsSunk}
          highlight={higher(stats.player1ShipsSunk, stats.player2ShipsSunk)}
        />
        <StatRow
          label="Ships Lost"
          p1Value={stats.player1ShipsLost}
          p2Value={stats.player2ShipsLost}
          highlight={lower(stats.player1ShipsLost, stats.player2ShipsLost)}
        />
        <StatRow label="Kill / Death" p1Value={p1Kd} p2Value={p2Kd} highlight="none" />
        <StatRow
          label="Islands Captured"
          p1Value={stats.player1IslandsCaptured}
          p2Value={stats.player2IslandsCaptured}
          highlight={higher(stats.player1IslandsCaptured, stats.player2IslandsCaptured)}
        />
        <StatRow
          label="Islands Lost"
          p1Value={stats.player1IslandsLost}
          p2Value={stats.player2IslandsLost}
          highlight={lower(stats.player1IslandsLost, stats.player2IslandsLost)}
        />
        <StatRow
          label="Longest Hold Streak"
          p1Value={`${stats.player1LongestHoldStreak}t`}
          p2Value={`${stats.player2LongestHoldStreak}t`}
          highlight={higher(stats.player1LongestHoldStreak, stats.player2LongestHoldStreak)}
        />
        <StatRow
          label={`Avg Ships Alive (/${shipsPerPlayer})`}
          p1Value={p1Avg}
          p2Value={p2Avg}
          highlight={higher(stats.player1TotalShipTicks, stats.player2TotalShipTicks)}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Key Moments Replay
// ─────────────────────────────────────────────

interface KeyMomentsProps {
  events: GameEvent[];
  p1Name: string;
  p2Name: string;
  tickRateMs: number;
}

function KeyMomentsReplay({ events, p1Name, p2Name, tickRateMs }: KeyMomentsProps) {
  // Filter to notable events: island captures/losses, score milestones,
  // and combat kills of 2+ ships
  const notable = events.filter((e) => {
    if (e.type === 'island_capture' || e.type === 'score_milestone') return true;
    if (e.type === 'combat_kill' && (e.count ?? 0) >= 2) return true;
    return false;
  });

  if (notable.length === 0) {
    return <p className="text-xs text-center py-2 text-slate-700">No key events recorded.</p>;
  }

  // Show most recent 20, oldest first
  const shown = notable.slice(-20);

  function eventIcon(e: GameEvent): string {
    if (e.type === 'island_capture') return '🏝️';
    if (e.type === 'island_lost') return '💥';
    if (e.type === 'score_milestone') return '⭐';
    if (e.type === 'combat_kill') return '⚔️';
    return '•';
  }

  function formatDescription(e: GameEvent): string {
    return e.description.replace('Player 1', p1Name).replace('Player 2', p2Name);
  }

  function tickToTime(tick: number): string {
    const sec = (tick * tickRateMs) / 1000;
    if (sec >= 60) {
      return `${Math.floor(sec / 60)}m${Math.round(sec % 60)}s`;
    }
    return `${sec.toFixed(1)}s`;
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto rounded-lg max-h-[180px] landscape:max-h-[80px] bg-[rgba(10,18,40,0.6)]">
      {shown.map((e, i) => (
        <div
          key={i}
          className="flex items-start gap-2 px-3 py-1.5 hover:bg-slate-800/40 transition-colors"
        >
          <span className="text-base leading-tight mt-0.5 flex-shrink-0">{eventIcon(e)}</span>
          <div className="flex-1 min-w-0">
            <span
              className={`text-xs leading-snug ${
                e.player === 'player1' ? 'text-blue-400' : 'text-red-400'
              }`}
            >
              {formatDescription(e)}
            </span>
          </div>
          <span className="text-xs flex-shrink-0 font-mono tabular-nums text-slate-700">
            {tickToTime(e.tick)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Winner Banner
// ─────────────────────────────────────────────

function WinnerBanner({
  result,
  p1Name,
  p2Name,
}: {
  result: GameResult;
  p1Name: string;
  p2Name: string;
}) {
  const isDraw = result.winner === 'draw';
  const isP1 = result.winner === 'player1';
  const winnerName = isDraw ? 'Both Pirates' : isP1 ? p1Name : p2Name;
  const conditionText =
    result.condition === 'score' ? 'reached the target score' : "had the most gold at time's up";

  const headlineClasses = isDraw
    ? 'text-amber-400 [text-shadow:0_0_24px_rgba(251,191,36,0.53)]'
    : isP1
      ? 'text-blue-400 [text-shadow:0_0_24px_rgba(96,165,250,0.53)]'
      : 'text-red-400 [text-shadow:0_0_24px_rgba(248,113,113,0.53)]';

  return (
    <div className="flex flex-col landscape:flex-row items-center gap-2 landscape:gap-3 py-2 landscape:py-1">
      {/* Trophy / skull */}
      <div className="text-5xl landscape:text-3xl leading-none [filter:drop-shadow(0_0_16px_gold)]">
        {isDraw ? '⚖️' : '🏆'}
      </div>

      <div className="flex flex-col items-center landscape:items-start">
        {/* Headline */}
        <h2 className={`text-3xl landscape:text-2xl font-extrabold tracking-tight text-center landscape:text-left ${headlineClasses}`}>
          {isDraw ? "It's a Draw!" : `${winnerName} Wins!`}
        </h2>

        {/* Sub-headline */}
        <p className="text-sm landscape:text-xs text-center landscape:text-left text-slate-400">
          {isDraw
            ? 'Both captains fought to a standstill.'
            : `The victorious captain ${conditionText}.`}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Score Comparison Bar
// ─────────────────────────────────────────────

function ScoreBar({
  p1Score,
  p2Score,
  p1Name,
  p2Name,
  targetScore,
}: {
  p1Score: number;
  p2Score: number;
  p1Name: string;
  p2Name: string;
  targetScore: number;
}) {
  const total = p1Score + p2Score;
  const p1Pct = total > 0 ? (p1Score / total) * 100 : 50;
  const p1TargetPct = Math.min(100, (p1Score / targetScore) * 100);
  const p2TargetPct = Math.min(100, (p2Score / targetScore) * 100);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Score numbers */}
      <div className="flex justify-between items-end">
        <div className="text-left">
          <div className="text-xs font-bold tracking-wide text-blue-400">{p1Name}</div>
          <div className="text-2xl landscape:text-xl font-extrabold tabular-nums text-amber-400">
            {p1Score.toLocaleString()}
          </div>
        </div>

        <div className="text-sm font-bold px-3 py-1 rounded-full text-slate-500 border border-slate-500/30">
          vs
        </div>

        <div className="text-right">
          <div className="text-xs font-bold tracking-wide text-red-400">{p2Name}</div>
          <div className="text-2xl landscape:text-xl font-extrabold tabular-nums text-amber-400">
            {p2Score.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Comparison bar */}
      <div className="h-2.5 rounded-full overflow-hidden flex bg-[rgba(15,23,42,0.8)]">
        <div
          className="h-full transition-all duration-700 bg-[linear-gradient(90deg,#60a5faaa,#60a5fa)]"
          style={{ width: `${p1Pct}%` }}
        />
        <div className="h-full flex-1 bg-[linear-gradient(90deg,#f87171,#f87171aa)]" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function GameOverModal({
  result,
  scoreHistory,
  gameEvents,
  gameStats,
  player1Name = 'Player 1',
  player2Name = 'Player 2',
  targetScore,
  tickRateMs = 100,
  onPlayAgain,
  onBackToSetup,
  onWatchReplay,
  onSwitchOpponent,
  nextOpponentName,
  backToSetupLabel,
  isCampaignMode = false,
  campaignContinueLabel,
  onCampaignContinue,
}: Props) {
  // Focus is managed by Radix Dialog

  const durationSec = Math.round((result.totalTicks * tickRateMs) / 1000);
  const durationStr =
    durationSec >= 60 ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : `${durationSec}s`;

  const shipsPerPlayer =
    gameStats.totalTicks > 0
      ? Math.round(
          (gameStats.player1TotalShipTicks + gameStats.player1ShipsLost) / gameStats.totalTicks,
        )
      : 5;

  // ── Shared sub-components ────────────────────────────────────
  const headerEl = null;

  const winnerEl = <WinnerBanner result={result} p1Name={player1Name} p2Name={player2Name} />;

  const scoreBarEl = (
    <ScoreBar
      p1Score={result.player1Score}
      p2Score={result.player2Score}
      p1Name={player1Name}
      p2Name={player2Name}
      targetScore={targetScore}
    />
  );

  const chartEl = (
    <div>
      <SectionHeader title="Score Over Time" titleClassName="text-xs font-bold tracking-widest uppercase text-slate-600 text-center" className="mb-1" />
      <ScoreChart history={scoreHistory} events={gameEvents} targetScore={targetScore} p1Name={player1Name} p2Name={player2Name} tickRateMs={tickRateMs} />
    </div>
  );

  const statsEl = (
    <div>
      <SectionHeader title="Battle Stats" titleClassName="text-xs font-bold tracking-widest uppercase text-slate-600 text-center" className="mb-1" />
      <StatsPanel stats={gameStats} p1Name={player1Name} p2Name={player2Name} shipsPerPlayer={shipsPerPlayer} />
    </div>
  );


  const buttonsEl = (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      {/* Campaign continue */}
      {isCampaignMode && onCampaignContinue && campaignContinueLabel && result.winner === 'player1' && (
        <button onClick={onCampaignContinue} className="flex-1 min-w-[100px] flex items-center justify-center py-2 px-4 rounded-xl font-bold text-sm active:scale-95 hover:brightness-110 bg-gradient-to-br from-[#d4af22] to-[#b8961c] text-[#0c1524] border border-[rgba(212,175,55,0.8)] shadow-[0_0_20px_rgba(212,175,55,0.35)]">
          {campaignContinueLabel}
        </button>
      )}
      {/* Rematch / Retry — hide retry when campaign win (continue is shown instead) */}
      {!(isCampaignMode && result.winner === 'player1' && onCampaignContinue) && (
        <button onClick={onPlayAgain} className={cn('flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold text-sm active:scale-95 hover:brightness-110', isCampaignMode ? 'bg-slate-800/70 text-slate-400 border border-slate-500/30' : 'bg-gradient-to-br from-[#d4af22] to-[#b8961c] text-[#0c1524] border border-[rgba(212,175,55,0.8)] shadow-[0_0_20px_rgba(212,175,55,0.35)]')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
          {isCampaignMode ? 'Retry' : 'Rematch'}
        </button>
      )}
      {/* Watch Replay */}
      {onWatchReplay && (
        <button onClick={onWatchReplay} className="flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2 px-4 rounded-xl font-bold text-sm active:scale-95 hover:brightness-110 bg-violet-500/[.18] text-violet-400 border border-violet-500/45">
          ▶ Watch Replay
        </button>
      )}
      {/* Back */}
      <button onClick={onBackToSetup} className="flex-1 min-w-[100px] flex items-center justify-center py-2 px-4 rounded-xl font-bold text-sm active:scale-95 bg-[rgba(15,23,42,0.9)] text-slate-500 border border-slate-500/30">
        {backToSetupLabel ?? 'Back to Setup'}
      </button>
    </div>
  );

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        aria-label="Game Over"
        overlayClassName="bg-[rgba(2,6,18,0.85)] backdrop-blur-sm"
        showCloseButton={false}
        className="!inset-0 !translate-x-0 !translate-y-0 !m-auto !h-fit w-[calc(100%-2rem)] max-w-3xl landscape:max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl p-5 landscape:p-4 flex flex-col gap-3 landscape:gap-2 outline-none bg-[rgba(5,12,30,0.97)] border-[#92741a] [box-shadow:0_0_60px_rgba(212,175,55,0.2),0_24px_64px_rgba(0,0,0,0.8)]"
      >
        <VisuallyHidden.Root asChild>
          <DialogTitle>Game Over</DialogTitle>
        </VisuallyHidden.Root>

        {/* ── Corner decorations ── */}
        <div className="absolute top-0 left-0 w-16 h-16 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.12),transparent_70%)] rounded-[inherit]" />
        <div className="absolute bottom-0 right-0 w-16 h-16 pointer-events-none bg-[radial-gradient(circle_at_bottom_right,rgba(212,175,55,0.08),transparent_70%)] rounded-[inherit]" />

        {/* ═══════ PORTRAIT LAYOUT (default) ═══════ */}
        <div className="flex flex-col gap-3 landscape:hidden">
          {headerEl}
          {winnerEl}
          {scoreBarEl}
          {chartEl}
          {statsEl}
          
          {buttonsEl}
        </div>

        {/* ═══════ LANDSCAPE LAYOUT ═══════ */}
        <div className="hidden landscape:flex landscape:flex-col landscape:gap-2 landscape:h-full">
          {/* Top bar: header + winner + scores — single row */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="shrink-0">{winnerEl}</div>
            <div className="flex-1 min-w-0">{scoreBarEl}</div>
            {/* duration removed */}
          </div>

          <Separator className="bg-[linear-gradient(90deg,transparent,#92741a55,transparent)]" />

          {/* Main content: 3 columns */}
          <div className="flex gap-3 flex-1 min-h-0">
            {/* Left: Chart */}
            <div className="flex-1 min-w-0 flex flex-col">{chartEl}</div>
            {/* Center: Stats */}
            <div className="flex-1 min-w-0 overflow-y-auto">{statsEl}</div>


          </div>

          {/* Bottom: buttons */}
          {buttonsEl}
        </div>
      </DialogContent>
    </Dialog>
  );
}
