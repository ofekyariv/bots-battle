// ============================================================
// 🤖 CampaignFleet — Always-visible bot picker for Campaign
// ============================================================
// Custom bots only (no pre-built / starter).
// Persists last selected bot in localStorage.
// Similar layout to FleetGrid on /play.
// ============================================================
'use client';

import { useEffect, useState, useRef } from 'react';
import { listBots, getBotById, getBotRecord, getBotStyle } from '@/lib/storage';
import type { BotMeta, BotStyle } from '@/lib/storage';
import { ROUTES } from '@/lib/routes';
import { cn } from '@/lib/utils';

// ─── Persistence ─────────────────────────────────────────────

const CAMPAIGN_BOT_KEY = 'bots-battle:campaign-selected-bot';

export function getCampaignSelectedBot(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CAMPAIGN_BOT_KEY);
}

export function setCampaignSelectedBot(botId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CAMPAIGN_BOT_KEY, botId);
}

// ─── Style badge config ──────────────────────────────────────

const STYLE_CONFIG: Record<BotStyle, { label: string; emoji: string; classes: string }> = {
  aggressive: {
    label: 'Aggressive',
    emoji: '⚔️',
    classes: 'bg-red-500/[.12] text-red-500',
  },
  defensive: {
    label: 'Defensive',
    emoji: '🛡️',
    classes: 'bg-green-500/[.12] text-green-500',
  },
  balanced: {
    label: 'Balanced',
    emoji: '⚖️',
    classes: 'bg-sky-400/[.12] text-sky-400',
  },
};

// ─── BotCard ─────────────────────────────────────────────────

interface BotCardProps {
  bot: BotMeta;
  isSelected: boolean;
  onSelect: () => void;
}

function BotCard({ bot, isSelected, onSelect }: BotCardProps) {
  const record = getBotRecord(bot.id);
  const style = getBotStyle(bot.id);
  const styleCfg = STYLE_CONFIG[style];
  const winRate = record.total > 0 ? Math.round((record.wins / record.total) * 100) : null;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-1 p-3 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] relative',
        isSelected
          ? 'bg-[rgba(245,166,35,0.08)] border-2 border-[#f5a623] shadow-[0_0_16px_rgba(245,166,35,0.25)]'
          : 'bg-[#0d1425] border border-ocean',
      )}
    >
      {/* Top-right: edit + selected indicator */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        <a
          href={`${ROUTES.editor}?load=${bot.id}`}
          onClick={(e) => e.stopPropagation()}
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-slate-700/80 text-slate-300 hover:bg-sky-500/30 hover:text-sky-400 transition-colors"
          title="Edit bot"
        >
          ✎
        </a>
        {isSelected && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs bg-[#f5a623] text-[#0a0e1a]">
            ✓
          </div>
        )}
      </div>

      {/* Bot name */}
      <div className={cn('font-bold text-sm leading-tight pr-10', isSelected ? 'text-[#f5a623]' : 'text-slate-200')}>
        {bot.name}
      </div>

      {/* Style badge */}
      <div
        className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold w-fit',
          styleCfg.classes,
        )}
      >
        <span>{styleCfg.emoji}</span>
        <span>{styleCfg.label}</span>
      </div>

      {/* Record */}
      <div className="flex items-center gap-2 mt-auto">
        {record.total > 0 ? (
          <>
            <span className="text-xs font-mono text-green-500">{record.wins}W</span>
            <span className="text-xs font-mono text-red-500">{record.losses}L</span>
            {record.draws > 0 && <span className="text-xs font-mono text-slate-400">{record.draws}D</span>}
            {winRate !== null && (
              <span className={cn('text-xs ml-auto', winRate >= 50 ? 'text-green-500' : 'text-slate-400')}>
                {winRate}%
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-slate-600">No battles yet</span>
        )}
      </div>
    </button>
  );
}

// ─── CampaignFleet (always-open bot picker) ──────────────────

interface CampaignFleetProps {
  selectedBotId: string;
  onSelect: (botId: string) => void;
}

export function CampaignFleet({ selectedBotId, onSelect }: CampaignFleetProps) {
  const [bots, setBots] = useState<BotMeta[]>(() => {
    if (typeof window === 'undefined') return [];
    return listBots();
  });
  const didAutoSelect = useRef(false);

  // Re-read on focus (user might save a new bot in editor and come back)
  useEffect(() => {
    const refresh = () => setBots(listBots());
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  // Auto-select: restore persisted or pick first
  useEffect(() => {
    if (didAutoSelect.current || bots.length === 0) return;
    didAutoSelect.current = true;

    const saved = getCampaignSelectedBot();
    if (saved && bots.some((b) => b.id === saved)) {
      onSelect(saved);
    } else {
      onSelect(bots[0].id);
      setCampaignSelectedBot(bots[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots]);

  const handleSelect = (botId: string) => {
    onSelect(botId);
    setCampaignSelectedBot(botId);
  };

  const hasCustomBots = bots.length > 0;

  return (
    <div className="rounded-xl p-4 mb-6 bg-navy-card border border-[rgba(30,41,59,0.7)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚓</span>
          <div>
            <h2 className="text-base font-bold leading-tight text-[#f5a623]">Your Bot</h2>
            <p className="text-xs text-slate-500">
              {hasCustomBots ? 'Select your bot for campaign challenges' : 'Create a bot to start the campaign'}
            </p>
          </div>
        </div>
        <a
          href={`${ROUTES.editor}?new=1`}
          className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors hover:brightness-110 bg-sky-500/10 border border-sky-500/30 text-sky-400"
        >
          {hasCustomBots ? '+ New Bot' : '✍️ Create Bot'}
        </a>
      </div>

      {/* Bot grid or empty state */}
      {hasCustomBots ? (
        <div className="grid grid-cols-2 gap-2">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} isSelected={selectedBotId === bot.id} onSelect={() => handleSelect(bot.id)} />
          ))}
        </div>
      ) : (
        <div className="text-center py-6 rounded-xl border border-dashed border-[rgba(30,41,59,0.5)] bg-[rgba(30,41,59,0.15)]">
          <p className="text-sm text-[#64748b] mb-1">No custom bots yet</p>
          <p className="text-xs text-[#334155]">Head to the Code Editor to write your first bot</p>
        </div>
      )}
    </div>
  );
}
