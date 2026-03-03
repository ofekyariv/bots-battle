'use client';

// ============================================================
// 🏴☠️ BotMigrationModal — import localStorage bots to server
// ============================================================
// Shown once after first login when localStorage bots are found.
// Lists bots with checkboxes; lets user import all or selected.
// ============================================================

import * as React from 'react';
import {
  detectLocalBots,
  migrateBotsToServer,
  markMigrationComplete,
  clearLocalBots,
  isMigrationComplete,
  type MigrationResult,
} from '@/lib/migration';
import type { SavedBot } from '@/lib/storage/schemas';

interface Props {
  onDone: () => void;
}

type Phase = 'select' | 'migrating' | 'done';

export function BotMigrationModal({ onDone }: Props) {
  const [bots, setBots] = React.useState<SavedBot[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [phase, setPhase] = React.useState<Phase>('select');
  const [results, setResults] = React.useState<MigrationResult[]>([]);

  React.useEffect(() => {
    const found = detectLocalBots();
    setBots(found);
    setSelected(new Set(found.map((b) => b.id)));
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === bots.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(bots.map((b) => b.id)));
    }
  };

  const runMigration = async (toMigrate: SavedBot[]) => {
    setPhase('migrating');
    const res = await migrateBotsToServer(toMigrate);
    setResults(res);

    const succeededIds = res.filter((r) => r.success).map((r) => r.bot.id);
    clearLocalBots(succeededIds);
    markMigrationComplete();
    setPhase('done');
  };

  const handleImportAll = () => runMigration(bots);
  const handleImportSelected = () => runMigration(bots.filter((b) => selected.has(b.id)));

  const handleSkip = () => {
    markMigrationComplete();
    onDone();
  };

  const handleClose = () => onDone();

  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 rounded-xl border border-gold/30 bg-navy shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10">
          <h2 className="text-xl font-bold text-gold">⚓ Import Your Bots</h2>
          <p className="mt-1 text-sm text-white/60">
            We found {bots.length} bot{bots.length !== 1 ? 's' : ''} saved locally. Import them to
            your account so they&#39;re available everywhere.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          {phase === 'select' && (
            <>
              {/* Select all row */}
              <label className="flex items-center gap-3 py-2 cursor-pointer text-sm text-white/70 hover:text-white border-b border-white/10 mb-2">
                <input
                  type="checkbox"
                  checked={selected.size === bots.length && bots.length > 0}
                  onChange={toggleAll}
                  className="accent-gold w-4 h-4"
                />
                <span className="font-medium">Select all</span>
              </label>

              {bots.map((bot) => (
                <label
                  key={bot.id}
                  className="flex items-center gap-3 py-2 cursor-pointer hover:bg-white/5 rounded px-1"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(bot.id)}
                    onChange={() => toggle(bot.id)}
                    className="accent-gold w-4 h-4 flex-shrink-0"
                  />
                  <span className="flex-1 text-sm font-medium truncate">{bot.name}</span>
                  <span className="text-xs text-white/40 flex-shrink-0">{bot.language}</span>
                </label>
              ))}
            </>
          )}

          {phase === 'migrating' && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-white/60">Importing bots…</p>
            </div>
          )}

          {phase === 'done' && (
            <div className="space-y-3">
              {succeeded.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-green-400 mb-1">
                    ✓ {succeeded.length} imported successfully
                  </p>
                  {succeeded.map((r) => (
                    <p key={r.bot.id} className="text-xs text-white/50 pl-3">
                      {r.bot.name}
                    </p>
                  ))}
                </div>
              )}
              {failed.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-red-400 mb-1">
                    ✗ {failed.length} failed
                  </p>
                  {failed.map((r) => (
                    <p key={r.bot.id} className="text-xs text-white/50 pl-3">
                      {r.bot.name}
                      {r.error ? ` — ${r.error}` : ''}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
          {phase === 'select' && (
            <>
              <button
                onClick={handleSkip}
                className="px-4 py-2 text-sm rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={handleImportSelected}
                disabled={selected.size === 0}
                className="px-4 py-2 text-sm rounded-lg border border-gold/40 text-gold hover:bg-gold/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Import Selected ({selected.size})
              </button>
              <button
                onClick={handleImportAll}
                className="px-4 py-2 text-sm rounded-lg bg-gold text-navy font-semibold hover:bg-gold/90 transition-colors"
              >
                Import All
              </button>
            </>
          )}

          {phase === 'done' && (
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm rounded-lg bg-gold text-navy font-semibold hover:bg-gold/90 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
