// ============================================================
// 🏴‍☠️ OpponentGrid — Player 2 opponent selection
// ============================================================
// Compact button grid of all unlocked bots (via campaign progress).
// Selected bot shows a detail card with description, tags, record.
// Locked bots shown as disabled with lock icon.
// ============================================================

'use client';

import { useEffect, useState, useMemo } from 'react';
import { BOT_REGISTRY } from '@/bots/index';
import type { BotRegistryEntry } from '@/bots/index';
import { getPlayerRecordVsOpponent, listBots, getBotById } from '@/lib/storage';
import { getUnlockedBotIds } from '@/lib/campaign';
import type { BotSource } from '@/lib/GameContext';
import type { BotMeta } from '@/lib/storage';

// ─────────────────────────────────────────────
// Difficulty config
// ─────────────────────────────────────────────

const DIFFICULTY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  easy: { text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  medium: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  hard: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
};

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: '🟢 Easy',
  medium: '🟡 Medium',
  hard: '🔴 Hard',
};

// ─────────────────────────────────────────────
// RecordLine
// ─────────────────────────────────────────────

function RecordLine({ opponentId }: { opponentId: string }) {
  const [record, setRecord] = useState({ wins: 0, losses: 0, draws: 0, total: 0 });

  useEffect(() => {
    setRecord(getPlayerRecordVsOpponent(opponentId));
  }, [opponentId]);

  if (record.total === 0) {
    return <span className="text-xs text-slate-600">No battles yet</span>;
  }

  const winRate = Math.round((record.wins / record.total) * 100);

  return (
    <div className="flex items-center gap-1.5 text-xs font-mono">
      <span className="text-green-500">{record.wins}W</span>
      <span className="text-slate-600">/</span>
      <span className="text-red-500">{record.losses}L</span>
      {record.draws > 0 && (
        <>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">{record.draws}D</span>
        </>
      )}
      <span
        className={`ml-1 px-1 rounded ${
          winRate >= 50 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
        }`}
      >
        {winRate}%
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Detail card for the selected bot
// ─────────────────────────────────────────────

function BotDetail({ bot, onScout }: { bot: BotRegistryEntry; onScout: () => void }) {
  const colors = DIFFICULTY_COLOR[bot.difficulty] ?? DIFFICULTY_COLOR.medium;

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3 bg-[#0d1425] border border-ocean">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="font-bold text-base text-[#f5a623]">{bot.name}</span>
          <span className={`text-xs font-semibold ${colors.text}`}>
            {DIFFICULTY_LABEL[bot.difficulty]}
          </span>
        </div>
        <button
          onClick={onScout}
          className={`text-xs px-2.5 py-1 rounded font-semibold transition-colors hover:brightness-110 active:scale-95 ${colors.bg} border ${colors.border} ${colors.text}`}
        >
          🔍 Scout
        </button>
      </div>

      {/* Description */}
      <p className="text-xs leading-relaxed text-slate-400">{bot.description}</p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {bot.tags.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="text-xs px-1.5 py-0.5 rounded font-mono bg-ocean text-slate-500"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Record */}
      <div className="flex items-center gap-2 pt-1 border-t border-ocean">
        <span className="text-xs text-slate-600">Your record:</span>
        <RecordLine opponentId={bot.id} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// OpponentGrid
// ─────────────────────────────────────────────

interface OpponentGridProps {
  source: BotSource;
  onChange: (source: BotSource) => void;
  onScout: (botId: string) => void;
}

export default function OpponentGrid({ source, onChange, onScout }: OpponentGridProps) {
  const selectedId = source.type === 'preset' ? source.id : null;
  const selectedCustomId =
    source.type === 'custom' ? (source as { type: 'custom'; savedBotId?: string }).savedBotId : null;

  const [myBots, setMyBots] = useState<BotMeta[]>([]);

  useEffect(() => {
    setMyBots(listBots());
  }, []);

  const handleSelectMyBot = (bot: BotMeta) => {
    const full = getBotById(bot.id);
    if (!full) return;
    onChange({ type: 'custom', code: full.code, savedBotId: bot.id });
  };

  const unlockedIds = useMemo(() => getUnlockedBotIds(), []);

  // Group bots by difficulty, preserving registry order
  const groups = useMemo(() => {
    const order: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
    const map = new Map<string, BotRegistryEntry[]>();
    for (const d of order) map.set(d, []);
    for (const bot of BOT_REGISTRY) {
      map.get(bot.difficulty)?.push(bot);
    }
    return order
      .map((d) => ({ difficulty: d, bots: map.get(d) ?? [] }))
      .filter((g) => g.bots.length > 0);
  }, []);

  const selectedBot = selectedId ? BOT_REGISTRY.find((b) => b.id === selectedId) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-3xl">💀</span>
        <div>
          <h2 className="text-xl font-bold leading-tight text-[#f5a623]">Player 2 (Opponent)</h2>
          <p className="text-xs text-slate-400">Pick an opponent to battle against</p>
        </div>
      </div>

      {/* My Bots section */}
      {myBots.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
            🤖 My Bots
          </span>
          <div className="flex flex-wrap gap-2">
            {myBots.map((bot) => {
              const isSelected = selectedCustomId === bot.id;
              return (
                <button
                  key={bot.id}
                  onClick={() => handleSelectMyBot(bot)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-[rgba(245,166,35,0.12)] border-2 border-[#f5a623] text-[#f5a623] shadow-[0_0_10px_rgba(245,166,35,0.2)]'
                      : 'bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:brightness-125 hover:scale-105 active:scale-95'
                  }`}
                >
                  {bot.name}
                  {isSelected ? ' ✓' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bot buttons grouped by difficulty */}
      {groups.map((group) => {
        const colors = DIFFICULTY_COLOR[group.difficulty];
        return (
          <div key={group.difficulty} className="flex flex-col gap-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
              {DIFFICULTY_LABEL[group.difficulty]}
            </span>
            <div className="flex flex-wrap gap-2">
              {group.bots.map((bot) => {
                const isSelected = selectedId === bot.id;
                const isLocked = !unlockedIds.has(bot.id);

                return (
                  <button
                    key={bot.id}
                    onClick={() => !isLocked && onChange({ type: 'preset', id: bot.id })}
                    disabled={isLocked}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isLocked
                        ? 'bg-[#0a0e1a] border border-ocean text-slate-700 cursor-not-allowed opacity-50'
                        : isSelected
                          ? 'bg-[rgba(245,166,35,0.12)] border-2 border-[#f5a623] text-[#f5a623] shadow-[0_0_10px_rgba(245,166,35,0.2)]'
                          : `${colors.bg} border ${colors.border} ${colors.text} hover:brightness-125 hover:scale-105 active:scale-95`
                    }`}
                    title={isLocked ? 'Beat this bot in Campaign to unlock' : bot.name}
                  >
                    {isLocked ? '🔒 ' : ''}
                    {bot.name}
                    {isSelected ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Selected bot detail card */}
      {selectedBot ? (
        <BotDetail bot={selectedBot} onScout={() => onScout(selectedBot.id)} />
      ) : selectedCustomId ? (
        <div className="rounded-xl p-4 flex flex-col gap-2 bg-[#0d1425] border border-sky-500/30">
          <span className="font-bold text-base text-[#f5a623]">
            {myBots.find((b) => b.id === selectedCustomId)?.name ?? 'Custom Bot'}
          </span>
          <span className="text-xs text-slate-400">Your custom bot — battle against your own creation</span>
        </div>
      ) : (
        <div className="rounded-xl p-4 flex items-center justify-center bg-[#0d1425] border border-dashed border-ocean">
          <span className="text-xs text-slate-600">Select an opponent above</span>
        </div>
      )}
    </div>
  );
}
