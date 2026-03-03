// ============================================================
// 🏴☠️ ScoutingReportModal — pre-battle intel on an opponent
// ============================================================
// Shows:
//   • Opponent description + flavour text
//   • Difficulty rating (star-based)
//   • Strategy tags
//   • Player's all-time record vs this opponent
//   • Recommended counter-strategy suggestion
// ============================================================

'use client';

import { useEffect, useState } from 'react';
import { BOT_REGISTRY } from '@/bots/index';
import type { BotRegistryEntry } from '@/bots/index';
import { getPlayerRecordVsOpponent } from '@/lib/storage';
import { Dialog, DialogContent, DialogClose, Badge, Separator } from '@/components/ui';

// ─────────────────────────────────────────────
// Counter suggestions per bot
// ─────────────────────────────────────────────

const COUNTER_TIPS: Record<string, { tip: string; weakness: string }> = {
  random: {
    weakness: 'No strategy whatsoever',
    tip: 'Any coordinated bot beats Random. Capture islands early and you win on scoring. Perfect for learning the API.',
  },
  rusher: {
    weakness: 'Weak against organised defence',
    tip: 'Rusher over-commits to islands individually. Pair your ships so any single Rusher ship gets a 2v1. Defender or Hunter style beats it consistently.',
  },
  defender: {
    weakness: "Slow to expand — can't patrol everywhere",
    tip: 'Defender only protects 3 islands. Rush the 4+ undefended islands fast and build a scoring lead. Rusher-style spread wins here.',
  },
  hunter: {
    weakness: 'Kill squad falls apart vs grouped ships',
    tip: 'Hunter sends 3 ships together — never fight them alone. Keep your ships in groups of 3+ to neutralise the kill squad. The 2 capturers are easy solo kills.',
  },
  balanced: {
    weakness: 'Reactive rather than proactive',
    tip: 'Balanced adapts but reacts slowly. Hit it hard in the first 30 ticks before it finds its rhythm. Aggressive early island capture denies its adaptive logic.',
  },
};

const DIFFICULTY_STARS: Record<string, number> = {
  random: 1,
  rusher: 2,
  defender: 3,
  hunter: 4,
  balanced: 5,
};

/** Badge className overrides for each difficulty */
const DIFFICULTY_BADGE_CLASSES: Record<string, string> = {
  easy: 'bg-green-500/[.09] text-green-500 border border-green-500/20',
  medium: 'bg-amber-400/[.09] text-amber-400 border border-amber-400/20',
  hard: 'bg-red-500/[.09]   text-red-500   border border-red-500/20',
};

/** Tailwind text-color class for active stars per difficulty */
const DIFFICULTY_STAR_ACTIVE: Record<string, string> = {
  easy: 'text-green-500',
  medium: 'text-amber-400',
  hard: 'text-red-500',
};

// ─────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────

interface ScoutingReportModalProps {
  botId: string | null;
  onClose: () => void;
}

export default function ScoutingReportModal({ botId, onClose }: ScoutingReportModalProps) {
  const [record, setRecord] = useState({ wins: 0, losses: 0, draws: 0, total: 0 });

  const bot: BotRegistryEntry | null = botId
    ? (BOT_REGISTRY.find((b) => b.id === botId) ?? null)
    : null;

  useEffect(() => {
    if (botId) {
      setRecord(getPlayerRecordVsOpponent(botId));
    }
  }, [botId]);

  const stars = bot ? (DIFFICULTY_STARS[bot.id] ?? 3) : 0;
  const badgeClasses = bot
    ? (DIFFICULTY_BADGE_CLASSES[bot.difficulty] ??
      'bg-slate-400/10 text-slate-400 border border-slate-400/20')
    : '';
  const starActiveClass = bot ? (DIFFICULTY_STAR_ACTIVE[bot.difficulty] ?? 'text-slate-400') : '';
  const counterTip = bot ? COUNTER_TIPS[bot.id] : null;
  const winRate = record.total > 0 ? Math.round((record.wins / record.total) * 100) : null;

  return (
    <Dialog
      open={!!bot && !!botId}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-lg bg-[#111827] border-[1.5px] border-ocean shadow-[0_0_60px_rgba(0,0,0,0.6)] max-h-[90vh] overflow-y-auto flex flex-col gap-5 p-6"
        showCloseButton={false}
      >
        {bot && (
          <>
            {/* Custom close button */}
            <DialogClose
              aria-label="Close scouting report"
              className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-sm transition-colors hover:brightness-110 bg-ocean text-foam focus:outline-none focus:ring-2 focus:ring-gold/60"
            >
              <span aria-hidden="true">✕</span>
            </DialogClose>

            {/* Header */}
            <div className="flex items-start gap-4 pr-8">
              <span className="text-4xl">🔍</span>
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-black text-[#f5a623]">Scouting Report</h2>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-200">{bot.name}</span>
                  <Badge variant="outline" className={`font-bold uppercase ${badgeClasses}`}>
                    {bot.difficulty}
                  </Badge>
                </div>
                {/* Stars */}
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span
                      key={i}
                      className={`text-sm ${i < stars ? starActiveClass : 'text-ocean'}`}
                    >
                      ★
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <Separator className="bg-ocean" />

            {/* Description */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
                Strategy
              </span>
              <p className="text-sm leading-relaxed text-slate-300">{bot.description}</p>
              <p className="text-xs italic leading-relaxed text-slate-500">{bot.flavour}</p>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {bot.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-xs font-mono bg-ocean text-slate-400 border-transparent"
                >
                  {tag}
                </Badge>
              ))}
            </div>

            <Separator className="bg-ocean" />

            {/* Your record vs this opponent */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
                Your Record vs {bot.name}
              </span>

              {record.total === 0 ? (
                <div className="rounded-lg px-4 py-3 text-sm bg-[#0d1425] border border-ocean text-slate-600">
                  You haven&apos;t faced {bot.name} yet. No data.
                </div>
              ) : (
                <div className="rounded-lg px-4 py-3 flex items-center gap-4 bg-[#0d1425] border border-ocean">
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-black text-green-500">{record.wins}</span>
                    <span className="text-xs text-slate-600">Wins</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-black text-red-500">{record.losses}</span>
                    <span className="text-xs text-slate-600">Losses</span>
                  </div>
                  {record.draws > 0 && (
                    <div className="flex flex-col items-center">
                      <span className="text-xl font-black text-slate-400">{record.draws}</span>
                      <span className="text-xs text-slate-600">Draws</span>
                    </div>
                  )}
                  <div className="ml-auto flex flex-col items-end">
                    <span
                      className={`text-2xl font-black ${winRate !== null && winRate >= 50 ? 'text-green-500' : 'text-red-500'}`}
                    >
                      {winRate}%
                    </span>
                    <span className="text-xs text-slate-600">win rate</span>
                  </div>
                </div>
              )}
            </div>

            {/* Counter suggestion */}
            {counterTip && (
              <div className="rounded-xl p-4 flex flex-col gap-2 bg-[rgba(245,166,35,0.06)] border border-[rgba(245,166,35,0.25)]">
                <div className="flex items-center gap-2">
                  <span className="text-base">💡</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#f5a623]">
                    Recommended Counter
                  </span>
                </div>
                <p className="text-xs font-semibold text-red-500">
                  Weakness: {counterTip.weakness}
                </p>
                <p className="text-sm leading-relaxed text-slate-300">{counterTip.tip}</p>
              </div>
            )}

            {/* Close button at bottom */}
            <DialogClose
              aria-label="Close scouting report"
              className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110 active:scale-95 bg-gradient-to-br from-[#c05621] to-amber-600 text-[#0a0e1a] focus:outline-none focus:ring-2 focus:ring-gold/60"
            >
              ✕ Close Report
            </DialogClose>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
