// ============================================================
// 🏴‍☠️ LevelCard — Individual Campaign Level Display
// ============================================================
'use client';

import { cn } from '@/lib/utils';
import {
  isLevelComplete,
  isLevelUnlocked,
  type CampaignProgress,
  type CampaignLevel,
} from '@/lib/campaign';
import { getBotById } from '@/bots/index';
import { Badge } from '@/components/ui';

// ─── Helpers ─────────────────────────────────────────────────

export function getLevelBotProgress(progress: CampaignProgress, levelNum: number) {
  return (
    progress.levelProgress[levelNum] ?? {
      currentBotIndex: 0,
      completedBotIndices: [],
    }
  );
}

export function getLevelStatusLabel(
  levelNum: number,
  progress: CampaignProgress,
): 'locked' | 'current' | 'complete' {
  if (isLevelComplete(levelNum, progress)) return 'complete';
  if (isLevelUnlocked(levelNum, progress)) return 'current';
  return 'locked';
}

// ─── PlayerBotBadge ──────────────────────────────────────────

export function PlayerBotBadge({ botName }: { botName: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-sky-500/[0.15] text-sky-400 border border-sky-500/[0.35]">
      🤖 {botName}
    </span>
  );
}

// ─── BotStatusIcon ───────────────────────────────────────────

function BotStatusIcon({
  completed,
  isCurrent,
  locked,
}: {
  completed: boolean;
  isCurrent: boolean;
  locked: boolean;
}) {
  if (completed) return <span className="text-base">✅</span>;
  if (locked) return <span className="text-base opacity-30">🔒</span>;
  if (isCurrent)
    return (
      <span className="inline-flex w-5 h-5 items-center justify-center rounded-full text-xs font-bold bg-gold/20 border border-[rgba(212,168,67,0.6)] text-gold">
        ▶
      </span>
    );
  return <span className="text-base opacity-40">⚪</span>;
}

// ─── LevelCard ───────────────────────────────────────────────

export interface LevelCardProps {
  levelDef: CampaignLevel;
  progress: CampaignProgress;
  isExpanded: boolean;
  onToggle: () => void;
  onChallenge: (levelNum: number, botIndex: number) => void;
  playerBotName: string;
  /** When true, challenge/retry buttons are disabled (e.g. no custom bots) */
  disabled?: boolean;
}

export function LevelCard({
  levelDef,
  progress,
  isExpanded,
  onToggle,
  onChallenge,
  playerBotName: _playerBotName,
  disabled = false,
}: LevelCardProps) {
  const status = getLevelStatusLabel(levelDef.level, progress);
  const levelBotProgress = getLevelBotProgress(progress, levelDef.level);
  const completedCount = levelBotProgress.completedBotIndices.length;
  const totalBots = levelDef.bots.length;
  const completedAttemptsForLevel = progress.attempts.filter((a) => a.level === levelDef.level);
  const wins = completedAttemptsForLevel.filter((a) => a.result === 'win').length;
  const losses = completedAttemptsForLevel.filter((a) => a.result === 'loss').length;

  const isLocked = status === 'locked';
  const isCurrent = status === 'current';
  const isComplete = status === 'complete';

  const currentBotIndex = isComplete ? totalBots : (levelBotProgress.currentBotIndex ?? 0);

  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden transition-all duration-200',
        isLocked ? 'bg-[rgba(5,10,20,0.5)] opacity-[0.55]' : 'bg-navy-card',
        isComplete
          ? 'border border-[rgba(212,168,67,0.45)]'
          : isCurrent
            ? 'border border-[rgba(212,168,67,0.8)]'
            : 'border border-[rgba(30,41,59,0.6)]',
        isCurrent
          ? 'shadow-[0_0_20px_rgba(212,168,67,0.15),0_4px_16px_rgba(0,0,0,0.4)]'
          : 'shadow-[0_2px_8px_rgba(0,0,0,0.3)]',
      )}
    >
      {/* ── Card Header (always visible, clickable) ── */}
      <button
        className={cn(
          'w-full text-left px-5 py-4 flex items-center gap-4 transition-colors bg-transparent',
          isLocked ? 'cursor-default' : 'cursor-pointer',
        )}
        onClick={isLocked ? undefined : onToggle}
        disabled={isLocked}
      >
        {/* Level number badge */}
        <div
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-black border-[1.5px]',
            isComplete
              ? 'bg-gold/20 border-[rgba(212,168,67,0.7)] text-gold'
              : isCurrent
                ? 'bg-gold/[0.12] border-[rgba(212,168,67,0.5)] text-gold'
                : 'bg-[rgba(30,41,59,0.5)] border-[rgba(30,41,59,0.8)]',
            isLocked && 'text-[#334155]',
            !isComplete && !isCurrent && !isLocked && 'text-[#475569]',
          )}
        >
          {isComplete ? '✓' : levelDef.level}
        </div>

        {/* Emoji */}
        <span className={cn('text-2xl flex-shrink-0', isLocked && 'grayscale')}>
          {levelDef.emoji}
        </span>

        {/* Title block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'text-xs font-bold tracking-widest uppercase',
                isLocked ? 'text-[#334155]' : isComplete ? 'text-gold' : 'text-[#64748b]',
              )}
            >
              {levelDef.rank}
            </span>
            {isCurrent && (
              <Badge
                variant="outline"
                className="font-bold bg-gold/[0.15] text-gold border-gold/40"
              >
                Current
              </Badge>
            )}
            {isLocked && (
              <Badge
                variant="outline"
                className="font-bold bg-[rgba(30,41,59,0.5)] text-[#334155] border-transparent"
              >
                🔒 Locked
              </Badge>
            )}
          </div>
          <div
            className={cn('font-bold text-base mt-0.5', isLocked ? 'text-[#334155]' : 'text-white')}
          >
            {levelDef.title}
          </div>
        </div>

        {/* Progress indicator */}
        <div className="flex-shrink-0 text-right">
          {isComplete ? (
            <span className="text-2xl">🏆</span>
          ) : isLocked ? (
            <span className="text-xl">🔒</span>
          ) : (
            <div>
              <div
                className={cn(
                  'text-xs font-bold tabular-nums',
                  isCurrent ? 'text-gold' : 'text-[#475569]',
                )}
              >
                {completedCount}/{totalBots}
              </div>
              <div className="text-xs text-[#334155]">bots</div>
            </div>
          )}
        </div>

        {/* Expand chevron */}
        {!isLocked && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isComplete ? '#92741a' : '#475569'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              'flex-shrink-0 transition-transform duration-200',
              isExpanded ? 'rotate-180' : 'rotate-0',
            )}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {/* ── Progress bar (mini) ── */}
      {!isLocked && totalBots > 0 && (
        <div className="mx-5 mb-1 h-1 rounded-full overflow-hidden bg-[rgba(30,41,59,0.6)]">
          {/* width is JS-computed — must stay as style */}
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              isComplete
                ? 'bg-[linear-gradient(90deg,#92741a,#d4a843)]'
                : 'bg-[linear-gradient(90deg,rgba(212,168,67,0.4),rgba(212,168,67,0.7))]',
            )}
            style={{ width: `${(completedCount / totalBots) * 100}%` }}
          />
        </div>
      )}

      {/* ── Expanded Content ── */}
      {isExpanded && !isLocked && (
        <div className="px-5 pb-5 pt-3 flex flex-col gap-4">
          {/* Description */}
          <p className="text-sm leading-relaxed text-foam">{levelDef.description}</p>

          {/* Config tweaks pills */}
          {levelDef.configOverride && Object.keys(levelDef.configOverride).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {levelDef.configOverride.mapWidth && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[rgba(30,41,59,0.6)] text-[#64748b] border border-[rgba(30,41,59,0.8)]">
                  🗺️ {levelDef.configOverride.mapWidth}×{levelDef.configOverride.mapHeight} map
                </span>
              )}
              {levelDef.configOverride.numIslands && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[rgba(30,41,59,0.6)] text-[#64748b] border border-[rgba(30,41,59,0.8)]">
                  🏝️ {levelDef.configOverride.numIslands} islands
                </span>
              )}
              {levelDef.configOverride.shipSpeed && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[rgba(30,41,59,0.6)] text-[#64748b] border border-[rgba(30,41,59,0.8)]">
                  ⚡ Speed {levelDef.configOverride.shipSpeed}
                </span>
              )}
              {levelDef.configOverride.targetScore && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[rgba(30,41,59,0.6)] text-[#64748b] border border-[rgba(30,41,59,0.8)]">
                  🎯 Target {levelDef.configOverride.targetScore.toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* Stats */}
          {(wins > 0 || losses > 0) && (
            <div className="flex gap-3 text-xs">
              <span className="text-[#4ade80]">✅ {wins} wins</span>
              <span className="text-[#f87171]">❌ {losses} losses</span>
            </div>
          )}

          {/* Bot list */}
          <div className="flex flex-col gap-2">
            <div className="text-xs font-bold tracking-widest uppercase mb-1 text-[#334155]">
              Opponents
            </div>
            {levelDef.bots.map((bot, idx) => {
              const botEntry = getBotById(bot.id);
              const isCompleted = levelBotProgress.completedBotIndices.includes(idx);
              const isBotCurrent = !isComplete && idx === currentBotIndex;
              const isBotLocked = !isComplete && idx > currentBotIndex;

              return (
                <div
                  key={idx}
                  className={cn(
                    'flex items-start gap-3 rounded-lg p-3 transition-colors border',
                    isBotCurrent
                      ? 'bg-gold/[0.06] border-[rgba(212,168,67,0.25)]'
                      : isCompleted
                        ? 'bg-[rgba(74,222,128,0.04)] border-[rgba(74,222,128,0.15)]'
                        : 'bg-[rgba(15,23,42,0.4)] border-[rgba(30,41,59,0.4)]',
                    isBotLocked && 'opacity-50',
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <BotStatusIcon
                      completed={isCompleted}
                      isCurrent={isBotCurrent}
                      locked={isBotLocked}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          'text-sm font-bold',
                          isCompleted
                            ? 'text-[#4ade80]'
                            : isBotCurrent
                              ? 'text-gold'
                              : isBotLocked
                                ? 'text-[#334155]'
                                : 'text-white',
                        )}
                      >
                        {bot.name}
                      </span>
                      {botEntry && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-[rgba(30,41,59,0.6)] text-[#475569]">
                          {botEntry.difficulty}
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        'text-xs mt-0.5 leading-relaxed',
                        isBotLocked ? 'text-[#1e293b]' : 'text-[#64748b]',
                      )}
                    >
                      {bot.hint}
                    </p>
                  </div>

                  {/* Challenge button for current bot */}
                  {isBotCurrent && (
                    <button
                      onClick={() => onChallenge(levelDef.level, idx)}
                      disabled={disabled}
                      className={cn(
                        'flex-shrink-0 px-4 py-2 rounded-lg font-bold text-sm transition-all',
                        disabled
                          ? 'opacity-40 cursor-not-allowed bg-[rgba(30,41,59,0.5)] text-[#475569]'
                          : 'hover:scale-105 active:scale-95 bg-[linear-gradient(135deg,#92741a,#d4a843)] text-[#0c1524] shadow-[0_2px_12px_rgba(212,168,67,0.35)]',
                      )}
                    >
                      ⚔️ Challenge
                    </button>
                  )}

                  {/* Retry button for completed bots */}
                  {isCompleted && (
                    <button
                      onClick={() => onChallenge(levelDef.level, idx)}
                      disabled={disabled}
                      className={cn(
                        'flex-shrink-0 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all border',
                        disabled
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:opacity-80',
                        'bg-[rgba(30,41,59,0.5)] text-[#475569] border-[rgba(30,41,59,0.6)]',
                      )}
                    >
                      Retry
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Start level CTA button */}
          {!isComplete && currentBotIndex === 0 && completedCount === 0 && (
            <button
              onClick={() => onChallenge(levelDef.level, 0)}
              disabled={disabled}
              className={cn(
                'w-full py-3 rounded-xl font-bold text-base transition-all',
                disabled
                  ? 'opacity-40 cursor-not-allowed bg-[rgba(30,41,59,0.5)] text-[#475569]'
                  : 'hover:scale-[1.02] active:scale-[0.98] bg-[linear-gradient(135deg,#92741a,#d4a843)] text-[#0c1524] shadow-[0_4px_20px_rgba(212,168,67,0.35)]',
              )}
            >
              ⚔️ Start Level {levelDef.level} — vs {levelDef.bots[0].name}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
