// ============================================================
// 🏴‍☠️ GameSetup — full game configuration form
// ============================================================
// Layout:
//   [Player 1 (You)]  ⚔️ VS  [Player 2 (Opponent)]
//
//   Player 1: "My Bots" grid (always one selected)
//   Player 2: OpponentGrid grouped by difficulty + ScoutingReport
//
//   🎮 Match Settings
//   [ Quick ]  [ Standard✓ ]  [ Epic ]  [ Custom ]
//   Quick-stats bar always visible
//   ▶ Advanced Settings (collapsed — opens automatically for Custom)
//
//              ⚔️ Start Battle!
//
// Persistence:
//   • Game config → localStorage['bots-battle:settings']
//   • Last opponent → localStorage['bots-battle:last-opponent']
//   • Last preset → localStorage['bots-battle:last-preset']
// ============================================================

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';

import { BOT_REGISTRY } from '@/bots/index';
import { ROUTES } from '@/lib/routes';
import {
  saveGameSettings,
  loadGameSettings,
  saveLastOpponent,
  loadLastOpponent,
  saveLastPreset,
  loadLastPreset,
} from '@/lib/storage';
import { getBot as getSavedBotById } from '@/lib/api/bots';
import { DEFAULT_CONFIG, type GameConfig } from '@/engine/types';
import { useGameContext, type BotSource } from '@/lib/GameContext';
import FleetGrid from '@/components/FleetGrid';
import OpponentGrid from '@/components/OpponentGrid';
import ScoutingReportModal from '@/components/ScoutingReportModal';
import { PirateCard, SectionHeader, GoldButton } from '@/components/ui';

// ─────────────────────────────────────────────
// Preset configurations
// ─────────────────────────────────────────────

const PRESET_CONFIGS: Record<
  string,
  { label: string; emoji: string; desc: string; config: GameConfig }
> = {
  quick: {
    label: 'Quick',
    emoji: '⚡',
    desc: '10 min · small map · 4 islands',
    config: {
      ...DEFAULT_CONFIG,
      gameDuration: 7500,
      mapWidth: 700,
      mapHeight: 500,
      numIslands: 4,
      shipsPerPlayer: 5,
      targetScore: 5000,
      islandEdgeMargin: 80,
    },
  },
  standard: {
    label: 'Standard',
    emoji: '⚔️',
    desc: '30 min · default · 7 islands · 8 ships',
    config: { ...DEFAULT_CONFIG },
  },
  epic: {
    label: 'Epic',
    emoji: '💥',
    desc: '45 min · large map · 11 islands · 12 ships',
    config: {
      ...DEFAULT_CONFIG,
      gameDuration: 22500,
      mapWidth: 1500,
      mapHeight: 1050,
      numIslands: 11,
      shipsPerPlayer: 12,
      targetScore: 15000,
    },
  },
};

/** Check if current config matches a named preset */
function detectPreset(config: GameConfig): string {
  for (const [key, preset] of Object.entries(PRESET_CONFIGS)) {
    const p = preset.config;
    if (
      config.gameDuration === p.gameDuration &&
      config.mapWidth === p.mapWidth &&
      config.mapHeight === p.mapHeight &&
      config.numIslands === p.numIslands &&
      config.shipsPerPlayer === p.shipsPerPlayer &&
      config.targetScore === p.targetScore
    ) {
      return key;
    }
  }
  return 'custom';
}

// ─────────────────────────────────────────────
// SliderRow — single config field (slider + number input)
// ─────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  sublabel?: string;
  helpText?: string;
  field: keyof GameConfig;
  min: number;
  max: number;
  step?: number;
  config: GameConfig;
  onChange: (k: keyof GameConfig, v: number) => void;
}

function SliderRow({
  label,
  sublabel,
  helpText,
  field,
  min,
  max,
  step = 1,
  config,
  onChange,
}: SliderRowProps) {
  const value = config[field] as number;
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const handleInput = (v: number) => {
    const clamped = Math.min(max, Math.max(min, v));
    const snapped = Math.round(clamped / step) * step;
    onChange(field, snapped);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-sm font-semibold truncate text-slate-200">{label}</span>
          {sublabel && <span className="text-xs text-slate-600">({sublabel})</span>}
        </div>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => handleInput(Number(e.target.value))}
          className="w-20 px-2 py-1 rounded text-center text-sm font-mono font-bold shrink-0 bg-[#0a0e1a] border border-amber-600 text-[#f5a623]"
        />
      </div>

      {/* Slider track */}
      <div className="relative h-3 rounded-full bg-ocean">
        <div
          className="absolute left-0 top-0 h-full rounded-full pointer-events-none bg-gradient-to-r from-amber-600 to-amber-400"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 pointer-events-none bg-amber-400 border-amber-600 shadow-[0_0_6px_rgba(245,166,35,0.6)]"
          style={{ left: `calc(${pct}% - 8px)` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => handleInput(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer m-0"
        />
      </div>

      {/* Min/max labels */}
      <div className="flex justify-between text-xs text-slate-700">
        <span>{min}</span>
        {helpText && <span className="italic text-slate-600">{helpText}</span>}
        <span>{max}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main GameSetup component
// ─────────────────────────────────────────────

export default function GameSetup() {
  const router = useRouter();
  const { setup, updatePlayer1, updatePlayer2, updateConfig, setReady } = useGameContext();

  const [scoutingBotId, setScoutingBotId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [activePreset, setActivePreset] = useState<string>('standard');

  // ── Hydrate from localStorage on mount ──────────────────────────
  useEffect(() => {
    const hydrate = async () => {
      // Restore saved game config
      const savedConfig = loadGameSettings();
      if (savedConfig) {
        const merged = { ...DEFAULT_CONFIG, ...savedConfig } as GameConfig;
        updateConfig(merged);
      }

      // Restore last opponent (supports both preset and custom/saved bots)
      const lastOpponent = loadLastOpponent();
      if (lastOpponent) {
        try {
          const parsed = JSON.parse(lastOpponent);
          if (parsed.type === 'custom' && parsed.savedBotId) {
            // Re-load code from server API in case it was updated
            try {
              const full = await getSavedBotById(parsed.savedBotId);
              updatePlayer2({ type: 'custom', code: full.code, savedBotId: parsed.savedBotId });
            } catch {
              // Bot not found or unauthenticated — skip
            }
          } else if (parsed.type === 'preset' && parsed.id) {
            const validBot = BOT_REGISTRY.find((b: { id: string }) => b.id === parsed.id);
            if (validBot) updatePlayer2({ type: 'preset', id: parsed.id });
          }
        } catch {
          // Legacy format: plain string ID
          const validBot = BOT_REGISTRY.find((b) => b.id === lastOpponent);
          if (validBot) {
            updatePlayer2({ type: 'preset', id: lastOpponent });
          }
        }
      }

      // Restore last preset
      const lastPreset = loadLastPreset();
      if (lastPreset && (lastPreset in PRESET_CONFIGS || lastPreset === 'custom')) {
        setActivePreset(lastPreset);
      } else if (savedConfig) {
        const detected = detectPreset({ ...DEFAULT_CONFIG, ...savedConfig } as GameConfig);
        setActivePreset(detected);
      }

      setHydrated(true);
    };

    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist config to localStorage whenever it changes ──────────
  useEffect(() => {
    if (!hydrated) return;
    saveGameSettings(setup.config);
  }, [setup.config, hydrated]);

  // ── Persist last opponent whenever player2 changes ──────────────
  useEffect(() => {
    if (!hydrated) return;
    const src = setup.player2.botSource;
    if (src.type === 'preset') {
      saveLastOpponent(JSON.stringify({ type: 'preset', id: src.id }));
    } else if (src.type === 'custom') {
      const custom = src as { type: 'custom'; code: string; savedBotId?: string };
      if (custom.savedBotId) {
        saveLastOpponent(JSON.stringify({ type: 'custom', savedBotId: custom.savedBotId }));
      }
    }
  }, [setup.player2.botSource, hydrated]);

  // ── Navigate to /game ────────────────────────────────────────────
  const handleStart = useCallback(() => {
    setReady(true);
    router.push(ROUTES.game);
  }, [setReady, router]);

  // ── Config change helper ─────────────────────────────────────────
  const cfgChange = useCallback(
    (k: keyof GameConfig, v: number) => {
      updateConfig({ [k]: v });
      // When manually changing config, switch to custom
      setActivePreset('custom');
      saveLastPreset('custom');
    },
    [updateConfig],
  );

  // ── Apply a preset config ────────────────────────────────────────
  const applyPreset = useCallback(
    (key: string) => {
      if (key === 'custom') {
        setActivePreset('custom');
        saveLastPreset('custom');
        return;
      }
      const preset = PRESET_CONFIGS[key];
      if (!preset) return;
      updateConfig(preset.config);
      setActivePreset(key);
      saveLastPreset(key);
    },
    [updateConfig],
  );

  // ── Derived display values ─────────────────────────────────────
  const { displayMins, displaySecs, tps } = useMemo(() => {
    const totalSeconds = Math.round((setup.config.gameDuration * setup.config.tickRateMs) / 1000);
    return {
      displayMins: Math.floor(totalSeconds / 60),
      displaySecs: totalSeconds % 60,
      tps: (1000 / setup.config.tickRateMs).toFixed(1),
    };
  }, [setup.config.gameDuration, setup.config.tickRateMs]);

  // ── Bot registry lookup set ──────────────────────────────────
  const allBotIds = useMemo(() => new Set(BOT_REGISTRY.map((b) => b.id)), []);

  // ── Config validation ─────────────────────────────────────
  const configWarnings = useMemo<string[]>(() => {
    const warnings: string[] = [];
    const c = setup.config;
    if (c.captureRadius > c.mapWidth / 4)
      warnings.push('Capture radius is very large for this map size.');
    if (c.shipsPerPlayer > 10 && c.numIslands < 5)
      warnings.push('Many ships but few islands — expect heavy crowding.');
    if (c.gameDuration * c.tickRateMs < 60_000)
      warnings.push('Very short game — bots may not have time to score.');
    return warnings;
  }, [setup.config]);

  // ── Opponent validity ───────────────────────────────────────
  const isOpponentValid = useMemo(() => {
    const src = setup.player2.botSource;
    if (src.type === 'custom') return src.code.trim().length > 0;
    return allBotIds.has(src.id);
  }, [setup.player2.botSource, allBotIds]);

  // All preset keys including custom
  const presetKeys = [...Object.keys(PRESET_CONFIGS), 'custom'] as const;

  return (
    <div className="flex flex-col gap-8">
      {/* ═══════════════════════════════════════════════════════════
          Bot Selection — VS layout
      ═══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-stretch items-start gap-6">
        {/* Player 1 */}
        <PirateCard className="rounded-2xl p-6 bg-gray-900 gap-0 w-full h-full overflow-hidden flex flex-col">
          <div className="flex flex-col gap-4 min-h-0 flex-1">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🧑‍✈️</span>
              <div>
                <h2 className="text-xl font-bold leading-tight text-[#f5a623]">Player 1 (You)</h2>
                <p className="text-xs text-slate-400">Deploy your bot into battle</p>
              </div>
            </div>
            <FleetGrid source={setup.player1.botSource} onChange={updatePlayer1} className="flex-1 min-h-0" />
          </div>
        </PirateCard>

        {/* VS divider */}
        <div className="flex lg:flex-col items-center justify-center gap-3 px-2 py-2 lg:pt-8 w-full lg:w-auto">
          <div className="h-px lg:h-auto lg:w-px flex-1 lg:min-h-[80px] bg-[linear-gradient(to_right,transparent,#d97706_40%,#d97706_60%,transparent)] lg:bg-[linear-gradient(to_bottom,transparent,#d97706_40%,#d97706_60%,transparent)]" />
          <div className="text-4xl font-black select-none leading-none text-[#f5a623] [text-shadow:0_0_24px_rgba(245,166,35,0.7)] shrink-0">
            ⚔️
          </div>
          <div className="text-lg font-black tracking-widest text-[#f5a623] shrink-0">VS</div>
          <div className="h-px lg:h-auto lg:w-px flex-1 lg:min-h-[80px] bg-[linear-gradient(to_right,#d97706_40%,transparent)] lg:bg-[linear-gradient(to_bottom,#d97706_40%,transparent)]" />
        </div>

        {/* Player 2 */}
        <PirateCard className="rounded-2xl p-6 bg-gray-900 gap-0 w-full h-full">
          <OpponentGrid
            source={setup.player2.botSource}
            onChange={updatePlayer2}
            onScout={(botId) => setScoutingBotId(botId)}
          />
        </PirateCard>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          Match Settings — Preset selector + Advanced
      ═══════════════════════════════════════════════════════════ */}
      <PirateCard className="rounded-2xl p-6 bg-gray-900 gap-0">
        <SectionHeader
          title="🎮 Match Settings"
          subtitle="Pick a game mode or customize the rules"
          className="mb-5"
        />

        {/* ── Preset buttons with active indicator ────────────── */}
        <div className="flex flex-wrap gap-3 mb-5">
          {presetKeys.map((key) => {
            const isActive = activePreset === key;
            const preset = key === 'custom'
              ? { label: 'Custom', emoji: '🔧', desc: 'Tweak every setting' }
              : PRESET_CONFIGS[key];

            return (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl transition-all hover:scale-105 active:scale-95 min-w-[120px] ${
                  isActive
                    ? 'bg-[rgba(245,166,35,0.1)] border-2 border-[#f5a623] shadow-[0_0_16px_rgba(245,166,35,0.2)]'
                    : 'bg-sky-500/[.08] border-[1.5px] border-sky-500/25 hover:bg-sky-500/15 hover:border-sky-400'
                }`}
              >
                <span className={`text-base font-bold ${isActive ? 'text-[#f5a623]' : 'text-slate-200'}`}>
                  {preset.emoji} {preset.label}
                  {isActive && ' ✓'}
                </span>
                <span className={`text-xs ${isActive ? 'text-amber-400/70' : 'text-slate-500'}`}>
                  {preset.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Quick-stats bar (always visible) ────────────────── */}
        <div className="px-4 py-3 rounded-xl flex flex-wrap gap-x-6 gap-y-1 text-xs font-mono mb-5 bg-[#0a0e1a] border border-ocean">
          <span className="text-slate-400">
            ⏱{' '}
            <strong className="text-[#f5a623]">
              {displayMins}m {displaySecs}s
            </strong>{' '}
            max duration
          </span>
          <span className="text-slate-400">
            🏆 First to{' '}
            <strong className="text-[#f5a623]">{setup.config.targetScore.toLocaleString()}</strong>{' '}
            pts
          </span>
          <span className="text-slate-400">
            ⚡ <strong className="text-[#f5a623]">{tps}</strong> ticks/sec
          </span>
          <span className="text-slate-400">
            🗺️{' '}
            <strong className="text-[#f5a623]">
              {setup.config.mapWidth}×{setup.config.mapHeight}
            </strong>{' '}
            map
          </span>
          <span className="text-slate-400">
            🏝️ <strong className="text-[#f5a623]">{setup.config.numIslands}</strong> islands
          </span>
          <span className="text-slate-400">
            🚢 <strong className="text-[#f5a623]">{setup.config.shipsPerPlayer}</strong> ships each
          </span>
        </div>

        {/* ── Advanced Settings (only for Custom preset) ─────── */}
        {activePreset === 'custom' && (
          <div>
            <div
              id="advanced-settings-panel"
              className="rounded-xl p-5 bg-[#0a1220] border border-ocean"
            >
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6">
                {/* ── Map ─── */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider mb-4 pb-1 text-slate-500 border-b border-ocean">
                    🗺️ Map
                  </div>
                </div>
                <SliderRow label="Map Width" sublabel="units" field="mapWidth" min={500} max={1500} step={50} config={setup.config} onChange={cfgChange} />
                <SliderRow label="Map Height" sublabel="units" field="mapHeight" min={350} max={1050} step={50} config={setup.config} onChange={cfgChange} />
                <SliderRow label="Islands" helpText="more = faster scoring" field="numIslands" min={3} max={11} config={setup.config} onChange={cfgChange} />

                {/* ── Ships ─── */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider mb-4 pb-1 text-slate-500 border-b border-ocean">
                    🚢 Ships
                  </div>
                </div>
                <SliderRow label="Ships / Player" field="shipsPerPlayer" min={4} max={12} config={setup.config} onChange={cfgChange} />
                <SliderRow label="Ship Speed" sublabel="units/tick" helpText="higher = faster" field="shipSpeed" min={2} max={8} config={setup.config} onChange={cfgChange} />
                <SliderRow label="Safe Zone Width" sublabel="units" helpText="spawn protection" field="safeZoneWidth" min={40} max={120} step={5} config={setup.config} onChange={cfgChange} />
                <SliderRow label="Respawn Delay" sublabel="ticks" field="respawnDelay" min={10} max={30} config={setup.config} onChange={cfgChange} />

                {/* ── Combat ─── */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider mb-4 pb-1 text-slate-500 border-b border-ocean">
                    ⚔️ Combat
                  </div>
                </div>
                <SliderRow label="Combat Range" sublabel="units" helpText="per-ship attack radius" field="attackRadius" min={25} max={77} config={setup.config} onChange={cfgChange} />
                <SliderRow label="Kill Delay" sublabel="ticks" helpText="ticks outnumbered to die" field="combatKillDelay" min={1} max={20} config={setup.config} onChange={cfgChange} />

                {/* ── Island Capture ─── */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider mb-4 pb-1 text-slate-500 border-b border-ocean">
                    🏝️ Island Capture
                  </div>
                </div>
                <SliderRow label="Capture Radius" sublabel="units" field="captureRadius" min={25} max={75} config={setup.config} onChange={cfgChange} />
                <SliderRow label="Capture Turns" sublabel="ticks" helpText="to claim a neutral island" field="captureTurns" min={8} max={23} config={setup.config} onChange={cfgChange} />

                {/* ── Match Rules ─── */}
                <div className="sm:col-span-2 lg:col-span-3">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider mb-4 pb-1 text-slate-500 border-b border-ocean">
                    🏆 Match Rules
                  </div>
                </div>
                <SliderRow label="Game Duration" sublabel="ticks" helpText={`≈ ${displayMins}m ${displaySecs}s`} field="gameDuration" min={7500} max={22500} step={100} config={setup.config} onChange={cfgChange} />
                <SliderRow label="Tick Rate" sublabel="ms/tick" helpText={`${tps} ticks/sec`} field="tickRateMs" min={60} max={180} step={10} config={setup.config} onChange={cfgChange} />
                <SliderRow label="Target Score" helpText="instant win threshold" field="targetScore" min={5000} max={15000} step={100} config={setup.config} onChange={cfgChange} />
              </div>

              {/* Reset to Defaults */}
              <div className="mt-6 pt-4 border-t border-ocean">
                <button
                  onClick={() => {
                    updateConfig(DEFAULT_CONFIG);
                    setActivePreset('standard');
                    saveLastPreset('standard');
                  }}
                  className="flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg transition-colors bg-[#0d1425] border border-slate-700 text-slate-400 hover:border-red-500 hover:text-red-300"
                  title="Reset all settings to default values"
                >
                  🔄 Reset to Defaults
                </button>
              </div>
            </div>
          </div>
        )}
      </PirateCard>

      {/* ═══════════════════════════════════════════════════════════
          Start Battle! Button
      ═══════════════════════════════════════════════════════════ */}
      <div className="flex flex-col items-center gap-4">
        {configWarnings.length > 0 && (
          <div className="flex flex-col gap-1 px-4 py-2 rounded-lg border border-amber-600/40 bg-amber-600/10 text-xs text-amber-400 font-mono max-w-xl w-full">
            {configWarnings.map((w, i) => (
              <span key={i}>⚠️ {w}</span>
            ))}
          </div>
        )}
        <GoldButton
          onClick={handleStart}
          disabled={!isOpponentValid}
          className="px-14 py-5 h-auto rounded-2xl font-black text-2xl tracking-[0.02em] shadow-[0_0_40px_rgba(245,166,35,0.45),0_4px_20px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 hover:shadow-[0_0_60px_rgba(245,166,35,0.7),0_8px_30px_rgba(0,0,0,0.5)] active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          ⚔️ Start Battle!
        </GoldButton>
        <p className="text-xs text-slate-600">
          The seas await, captain. May your algorithm conquer all.
        </p>
      </div>

      {/* Scouting Report Modal */}
      <ScoutingReportModal botId={scoutingBotId} onClose={() => setScoutingBotId(null)} />
    </div>
  );
}
