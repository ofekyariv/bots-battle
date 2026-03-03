// ============================================================
// 🏴‍☠️ GameControls — playback controls bar
//
// Features:
//   • Speed multiplier buttons: 1x, 2x, 5x, 10x
//   • Play / Pause toggle
//   • Restart button
//
// Props-driven — parent owns the speed & running state.
// ============================================================

'use client';

import { memo, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { GameStatus } from '@/engine/types';
import type { CameraMode } from '@/components/GameCanvas';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type GameSpeed = 1 | 2 | 5 | 10 | 20;

export interface OpponentOption {
  id: string;
  name: string;
  locked: boolean;
}

interface Props {
  /** Current speed multiplier (1 | 2 | 5 | 10). Ignored while paused. */
  speed: GameSpeed;
  /** Whether the game loop is currently paused */
  isPaused: boolean;
  /** Current game status — disables controls when idle/finished */
  status: GameStatus;
  /** Called when the user picks a new speed */
  onSpeedChange: (speed: GameSpeed) => void;
  /** Toggle play / pause */
  onPlayPause: () => void;
  /** Restart the match from scratch */
  onRestart: () => void;
  /** Available opponents for the dropdown (optional) */
  opponents?: OpponentOption[];
  /** Currently selected opponent ID */
  currentOpponentId?: string;
  /** Called when user selects a different opponent */
  onSwitchOpponent?: (botId: string) => void;
  /** Camera mode toggle */
  cameraMode?: CameraMode;
  onCameraModeChange?: (mode: CameraMode) => void;
  /** Quit / leave the game */
  onQuit?: () => void;
}

// ─────────────────────────────────────────────
// Speed options
// ─────────────────────────────────────────────

const SPEED_OPTIONS: GameSpeed[] = [1, 2, 5, 10, 20];

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

interface SpeedButtonProps {
  value: GameSpeed;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}

function SpeedButton({ value, active, disabled, onClick }: SpeedButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'relative px-3 py-1.5 rounded text-sm font-bold font-mono transition-all duration-150 select-none',
            active
              ? 'bg-gradient-to-br from-[#d4af22] to-[#b8961c] text-[#0c1524] border border-[rgba(212,175,55,0.8)] shadow-[0_0_12px_rgba(212,175,55,0.4)]'
              : 'bg-slate-800/80 border border-slate-500/30',
            !active && (disabled ? 'text-slate-700' : 'text-slate-400'),
            disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
          )}
        >
          {value}×
        </button>
      </TooltipTrigger>
      <TooltipContent>Set speed to {value}×</TooltipContent>
    </Tooltip>
  );
}

interface IconButtonProps {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  variant?: 'gold' | 'danger' | 'default';
}

const ICON_BTN_VARIANT_CLASSES = {
  gold: 'bg-gradient-to-br from-[#d4af22] to-[#b8961c] text-[#0c1524] border border-[rgba(212,175,55,0.8)] shadow-[0_0_12px_rgba(212,175,55,0.35)]',
  danger: 'bg-gradient-to-br from-[#7f1d1d] to-red-800 text-red-300 border border-red-900/60',
  default: 'bg-slate-800/80 text-slate-400 border border-slate-500/30',
} as const;

function IconButton({ onClick, disabled, title, children, variant = 'default' }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          disabled={disabled}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all duration-150 select-none',
            disabled
              ? 'bg-[rgba(15,23,42,0.6)] text-slate-700 border border-slate-700/40 opacity-50 cursor-not-allowed'
              : ICON_BTN_VARIANT_CLASSES[variant],
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

// GameControls is wrapped in React.memo with default shallow comparison.
// It only needs to re-render when speed, isPaused, or status change.
// For memo to be effective, the callback props (onSpeedChange, onPlayPause,
// onRestart) must be stable references — see GameRunner for useCallback usage.
function GameControls({ speed, isPaused, status, onSpeedChange, onPlayPause, onRestart, opponents, currentOpponentId, onSwitchOpponent, cameraMode, onCameraModeChange, onQuit }: Props) {
  const isActive = status === 'running' || status === 'paused';
  const isFinished = status === 'finished';

  return (
    <TooltipProvider>
      <div
        className="flex flex-wrap items-center justify-center gap-2 px-3 py-2 rounded-xl font-mono select-none
          bg-[rgba(5,12,30,0.88)] backdrop-blur-md border border-[rgba(212,175,55,0.25)]
          shadow-[0_4px_20px_rgba(0,0,0,0.6)] max-w-[calc(100vw-1.5rem)]"
        role="toolbar"
        aria-label="Game controls"
      >
        {/* ── Speed label (hidden on very small screens) ── */}
        <span className="hidden sm:inline text-xs tracking-widest uppercase text-slate-600">
          Speed
        </span>

        {/* ── Speed buttons ── */}
        <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
          {SPEED_OPTIONS.map((s) => (
            <SpeedButton
              key={s}
              value={s}
              active={!isPaused && speed === s && isActive}
              disabled={!isActive || isFinished}
              onClick={() => onSpeedChange(s)}
            />
          ))}
        </div>

        {/* ── Divider ── */}
        <div className="h-5 w-px mx-1 bg-[rgba(212,175,55,0.2)]" aria-hidden="true" />

        {/* ── Play / Pause ── */}
        <IconButton
          onClick={onPlayPause}
          disabled={!isActive || isFinished}
          title={isPaused ? 'Resume' : 'Pause'}
          variant={isPaused ? 'gold' : 'default'}
        >
          {isPaused ? (
            <>
              <PlayIcon />
              <span>Resume</span>
            </>
          ) : (
            <>
              <PauseIcon />
              <span>Pause</span>
            </>
          )}
        </IconButton>

        {/* ── Restart ── */}
        <IconButton onClick={onRestart} title="Restart match" variant="danger">
          <RestartIcon />
          <span>Restart</span>
        </IconButton>

        {/* ── Opponent Selector (optional) ── */}
        {opponents && opponents.length > 0 && onSwitchOpponent && (
          <>
            <div className="h-5 w-px mx-1 bg-[rgba(212,175,55,0.2)]" aria-hidden="true" />
            <OpponentDropdown
              opponents={opponents}
              currentId={currentOpponentId}
              onSelect={onSwitchOpponent}
            />
          </>
        )}

        {/* ── Camera mode toggle ── */}
        {cameraMode && onCameraModeChange && (
          <>
            <div className="h-5 w-px mx-1 bg-[rgba(212,175,55,0.2)]" aria-hidden="true" />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onCameraModeChange(cameraMode === 'dynamic' ? 'static' : 'dynamic')}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-bold transition-all duration-150 select-none border',
                    cameraMode === 'dynamic'
                      ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                      : 'bg-slate-800/80 text-slate-400 border-slate-500/30',
                  )}
                >
                  {cameraMode === 'dynamic' ? <DynamicCamIcon /> : <StaticCamIcon />}
                  <span>{cameraMode === 'dynamic' ? 'Dynamic Map' : 'Static Map'}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {cameraMode === 'dynamic' ? 'Camera follows ships — click for static view' : 'Static full-map view — click for dynamic'}
              </TooltipContent>
            </Tooltip>
          </>
        )}

        {/* ── Quit ── */}
        {onQuit && (
          <>
            <div className="h-5 w-px mx-1 bg-[rgba(212,175,55,0.2)]" aria-hidden="true" />
            <IconButton onClick={onQuit} title="Quit to menu" variant="danger">
              <QuitIcon />
              <span>Quit</span>
            </IconButton>
          </>
        )}

        {/* ── Status badge ── */}
        <StatusBadge status={status} isPaused={isPaused} />
      </div>
    </TooltipProvider>
  );
}

// ─────────────────────────────────────────────
// Opponent Dropdown
// ─────────────────────────────────────────────

function OpponentDropdown({ opponents, currentId, onSelect }: {
  opponents: OpponentOption[];
  currentId?: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = opponents.find(o => o.id === currentId);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold transition-all duration-150 select-none',
          'bg-slate-800/80 text-sky-400 border border-sky-500/30 hover:border-sky-400/50',
        )}
      >
        <SwapIcon />
        <span className="max-w-[100px] truncate">vs {current?.name ?? '...'}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 min-w-[180px] max-h-[240px] overflow-y-auto rounded-lg border border-slate-600/50 bg-[rgba(5,12,30,0.95)] backdrop-blur-md shadow-xl z-50">
          {opponents.map(o => (
            <button
              key={o.id}
              disabled={o.locked}
              onClick={() => {
                if (!o.locked) {
                  onSelect(o.id);
                  setOpen(false);
                }
              }}
              className={cn(
                'w-full text-left px-3 py-2 text-sm font-mono transition-colors',
                o.id === currentId && 'bg-sky-500/15 text-sky-300',
                o.locked
                  ? 'text-slate-600 cursor-not-allowed'
                  : o.id !== currentId && 'text-slate-300 hover:bg-slate-700/50 hover:text-white',
              )}
            >
              <span className="flex items-center gap-2">
                {o.locked ? '🔒' : o.id === currentId ? '⚔️' : '🏴‍☠️'}
                <span>{o.name}</span>
                {o.locked && <span className="text-xs text-slate-600 ml-auto">Campaign</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SwapIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16V4m0 0L3 8m4-4l4 4" />
      <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={cn('transition-transform', open ? 'rotate-180' : '')}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// ─────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────

/** Tailwind classes per status key */
const STATUS_CLASSES: Record<
  string,
  { label: string; wrapClasses: string; dotClasses?: string; animate?: boolean }
> = {
  idle: { label: 'Idle', wrapClasses: 'bg-slate-800/60 text-slate-500 border border-slate-500/20' },
  running: {
    label: 'Live',
    wrapClasses: 'bg-emerald-500/10 text-green-400 border border-green-400/20',
    dotClasses: 'bg-green-400 shadow-[0_0_6px_#4ade80]',
    animate: true,
  },
  paused: {
    label: 'Paused',
    wrapClasses: 'bg-amber-400/10  text-amber-400 border border-amber-400/20',
    dotClasses: 'bg-amber-400 shadow-[0_0_6px_#fbbf24]',
    animate: false,
  },
  finished: {
    label: 'Finished',
    wrapClasses: 'bg-red-400/10    text-red-400   border border-red-400/20',
  },
};

function StatusBadge({ status, isPaused }: { status: GameStatus; isPaused: boolean }) {
  const key = isPaused ? 'paused' : status;
  const entry = STATUS_CLASSES[key] ?? STATUS_CLASSES.idle;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold tracking-wide uppercase ml-1',
        entry.wrapClasses,
      )}
    >
      {entry.dotClasses && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full inline-block',
            entry.dotClasses,
            entry.animate && 'animate-pulse',
          )}
        />
      )}
      {entry.label}
    </div>
  );
}

// ─────────────────────────────────────────────
// SVG Icons
// ─────────────────────────────────────────────

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function QuitIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function DynamicCamIcon() {
  // Crosshair — "tracking/following"
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

function StaticCamIcon() {
  // Grid/map — "full static map view"
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}

export default memo(GameControls);
