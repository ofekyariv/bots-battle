// ============================================================
// 🏴‍☠️ FleetGrid — Player 1 "My Fleet" bot selection
// ============================================================
// Shows saved custom bots (from server DB) + a "Starter Bot" fallback.
// Always has exactly one bot selected. Persists last selection.
// ============================================================

'use client';

import { useEffect, useState, useRef } from 'react';
import { listBots, getBot } from '@/lib/api/bots';
import type { BotMeta } from '@/lib/api/bots';
import { getBotRecord, getBotStyle, saveLastPlayer1, loadLastPlayer1 } from '@/lib/storage';
import type { BotStyle } from '@/lib/storage';
import type { BotSource } from '@/lib/GameContext';
import { BOT_REGISTRY } from '@/bots/index';
import { ROUTES } from '@/lib/routes';

// ─────────────────────────────────────────────
// Style badge config
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Starter bot — shown when user has no saved bots
// ─────────────────────────────────────────────

const STARTER_BOT_ID = '__starter__';
const STARTER_BOT: BotMeta = {
  id: STARTER_BOT_ID,
  name: 'Starter Bot',
  language: 'javascript',
  is_active: true,
  version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ─────────────────────────────────────────────
// BotCard
// ─────────────────────────────────────────────

interface BotCardProps {
  bot: BotMeta;
  isSelected: boolean;
  isStarter?: boolean;
  onSelect: () => void;
}

function BotCard({ bot, isSelected, isStarter, onSelect }: BotCardProps) {
  const record = isStarter ? { wins: 0, losses: 0, draws: 0, total: 0 } : getBotRecord(bot.id);
  const style = isStarter ? 'balanced' : getBotStyle(bot.id);
  const styleCfg = STYLE_CONFIG[style];

  const winRate = record.total > 0 ? Math.round((record.wins / record.total) * 100) : null;

  // Format last played date
  const lastPlayed = new Date(bot.updated_at);
  const now = new Date();
  const diffMs = now.getTime() - lastPlayed.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  let lastPlayedLabel: string;
  if (diffDays === 0) lastPlayedLabel = 'Today';
  else if (diffDays === 1) lastPlayedLabel = 'Yesterday';
  else if (diffDays < 7) lastPlayedLabel = `${diffDays}d ago`;
  else lastPlayedLabel = lastPlayed.toLocaleDateString();

  return (
    <button
      onClick={onSelect}
      className={`flex flex-col gap-1 p-3 rounded-xl text-left transition-all hover:scale-[1.02] active:scale-[0.98] relative ${
        isSelected
          ? 'bg-[rgba(245,166,35,0.08)] border-2 border-[#f5a623] shadow-[0_0_16px_rgba(245,166,35,0.25)]'
          : 'bg-[#0d1425] border border-ocean'
      }`}
    >
      {/* Top-right: selected indicator + edit button */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        {!isStarter && (
          <a
            href={`${ROUTES.editor}?load=${bot.id}`}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-slate-700/80 text-slate-300 hover:bg-sky-500/30 hover:text-sky-400 transition-colors"
            title="Edit bot"
          >
            ✎
          </a>
        )}
        {isSelected && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs bg-[#f5a623] text-[#0a0e1a]">
            ✓
          </div>
        )}
      </div>

      {/* Bot name */}
      <div
        className={`font-bold text-sm leading-tight pr-6 ${isSelected ? 'text-[#f5a623]' : 'text-slate-200'}`}
      >
        {isStarter ? '🚀 Starter Bot' : bot.name}
      </div>

      {/* Style badge or starter description */}
      {isStarter ? (
        <p className="text-xs text-slate-400 leading-relaxed">
          A ready-to-go bot to get you started. Edit it in the Code Editor to make it yours!
        </p>
      ) : (
        <div
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold w-fit ${styleCfg.classes}`}
        >
          <span>{styleCfg.emoji}</span>
          <span>{styleCfg.label}</span>
        </div>
      )}

      {/* Record row */}
      <div className="flex items-center gap-2 mt-auto">
        {record.total > 0 ? (
          <>
            <span className="text-xs font-mono text-green-500">{record.wins}W</span>
            <span className="text-xs font-mono text-red-500">{record.losses}L</span>
            {record.draws > 0 && (
              <span className="text-xs font-mono text-slate-400">{record.draws}D</span>
            )}
            {winRate !== null && (
              <span
                className={`text-xs ml-auto ${winRate >= 50 ? 'text-green-500' : 'text-slate-400'}`}
              >
                {winRate}%
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-slate-600">{isStarter ? 'Ready to battle!' : 'No battles yet'}</span>
        )}
      </div>

      {/* Last played */}
      {!isStarter && <div className="text-xs text-slate-700 truncate">Last edited: {lastPlayedLabel}</div>}
    </button>
  );
}

// ─────────────────────────────────────────────
// FleetGrid
// ─────────────────────────────────────────────

interface FleetGridProps {
  source: BotSource;
  onChange: (source: BotSource) => void;
  className?: string;
}

export default function FleetGrid({ source, onChange, className }: FleetGridProps) {
  const [bots, setBots] = useState<BotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const didAutoSelect = useRef(false);

  const refreshBots = async () => {
    try {
      const data = await listBots();
      setBots(data);
      return data;
    } catch {
      setBots([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Load bots on mount
  useEffect(() => {
    refreshBots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-read bots on focus (user might have saved in editor)
  useEffect(() => {
    const handler = () => refreshBots();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-select: restore last selection or pick first bot
  useEffect(() => {
    if (loading || didAutoSelect.current) return;
    didAutoSelect.current = true;

    const lastId = loadLastPlayer1();
    const hasCustomBots = bots.length > 0;

    const doAutoSelect = async () => {
      if (hasCustomBots) {
        // Try to restore last selection
        if (lastId && lastId !== STARTER_BOT_ID) {
          try {
            const full = await getBot(lastId);
            onChange({ type: 'custom', code: full.code, savedBotId: lastId });
            return;
          } catch {
            // Bot not found — fall through to first bot
          }
        }
        // Fall back to first bot
        try {
          const full = await getBot(bots[0].id);
          onChange({ type: 'custom', code: full.code, savedBotId: bots[0].id });
          saveLastPlayer1(bots[0].id);
        } catch {
          // ignore
        }
      } else {
        // No custom bots — use the "balanced" preset as starter
        const balancedBot = BOT_REGISTRY.find((b) => b.id === 'balanced');
        if (balancedBot) {
          onChange({ type: 'preset', id: 'balanced' });
          saveLastPlayer1(STARTER_BOT_ID);
        }
      }
    };

    doAutoSelect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, bots]);

  // Currently selected bot id
  const selectedId =
    source.type === 'custom'
      ? ((source as { type: 'custom'; code: string; savedBotId?: string }).savedBotId ?? null)
      : source.type === 'preset'
        ? STARTER_BOT_ID
        : null;

  const handleSelect = async (bot: BotMeta & { isStarter?: boolean }) => {
    if (bot.id === STARTER_BOT_ID || bot.isStarter) {
      // Starter bot = balanced preset
      onChange({ type: 'preset', id: 'balanced' });
      saveLastPlayer1(STARTER_BOT_ID);
      return;
    }
    try {
      const full = await getBot(bot.id);
      onChange({ type: 'custom', code: full.code, savedBotId: bot.id });
      saveLastPlayer1(bot.id);
    } catch {
      // ignore
    }
  };

  const hasCustomBots = bots.length > 0;

  // Build the list: custom bots, or starter bot if empty
  const displayBots: (BotMeta & { isStarter?: boolean })[] = hasCustomBots
    ? bots
    : [{ ...STARTER_BOT, isStarter: true }];

  return (
    <div className={`flex flex-col gap-4 ${className ?? ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚓</span>
          <div>
            <h2 className="text-base font-bold leading-tight text-[#f5a623]">My Bots</h2>
            <p className="text-xs text-slate-500">
              {hasCustomBots ? 'Select your bot for battle' : 'Get started with a ready-made bot'}
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

      {/* Bot grid */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-xs text-slate-500">
          Loading bots…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 p-1 -m-1 flex-1 overflow-y-auto scrollbar-thin">
          {displayBots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              isSelected={selectedId === bot.id}
              isStarter={'isStarter' in bot && bot.isStarter}
              onSelect={() => handleSelect(bot)}
            />
          ))}
        </div>
      )}

      {/* Selected bot indicator — only show for starter bot */}
      {selectedId === STARTER_BOT_ID && !hasCustomBots && (
        <div className="rounded-lg px-3 py-2 flex items-center gap-2 bg-[rgba(245,166,35,0.06)] border border-[rgba(245,166,35,0.2)]">
          <span className="text-xs text-[#f5a623]">
            ✓ Ready to battle: <strong>Starter Bot</strong>
          </span>
        </div>
      )}
    </div>
  );
}
