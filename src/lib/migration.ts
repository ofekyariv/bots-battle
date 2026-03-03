// ============================================================
// 🏴☠️ Migration — localStorage bots → database
// ============================================================

import type { SavedBot } from '@/lib/storage/schemas';
import { parseBotArray } from '@/lib/storage/schemas';

const STORAGE_KEY = 'bots-battle:saved-bots';
const MIGRATION_FLAG = 'bots-battle:migration-complete';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Reads localStorage and returns any SavedBot[] found.
 * Returns empty array on server or if nothing is stored.
 */
export function detectLocalBots(): SavedBot[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parseBotArray(parsed, 'migration');
  } catch {
    return [];
  }
}

/**
 * Returns true if the user has already completed (or dismissed) migration.
 */
export function isMigrationComplete(): boolean {
  if (!isBrowser()) return true;
  return localStorage.getItem(MIGRATION_FLAG) === 'true';
}

/**
 * Sets a localStorage flag so the modal won't show again.
 */
export function markMigrationComplete(): void {
  if (!isBrowser()) return;
  localStorage.setItem(MIGRATION_FLAG, 'true');
}

export interface MigrationResult {
  bot: SavedBot;
  success: boolean;
  error?: string;
}

/**
 * POSTs each bot to /api/bots.
 * Returns per-bot success/failure results.
 */
export async function migrateBotsToServer(bots: SavedBot[]): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  for (const bot of bots) {
    try {
      const res = await fetch('/api/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bot.name,
          language: bot.language ?? 'javascript',
          code: bot.code,
        }),
      });

      if (res.ok) {
        results.push({ bot, success: true });
      } else {
        const body = await res.json().catch(() => ({}));
        const message = body?.error ?? `HTTP ${res.status}`;
        results.push({ bot, success: false, error: message });
      }
    } catch (e) {
      results.push({
        bot,
        success: false,
        error: e instanceof Error ? e.message : 'Network error',
      });
    }
  }

  return results;
}

/**
 * Removes only the successfully migrated bots from localStorage,
 * preserving any that failed.
 */
export function clearLocalBots(migratedIds: string[]): void {
  if (!isBrowser()) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const all = parseBotArray(parsed, 'migration-clear');
    const remaining = all.filter((b) => !migratedIds.includes(b.id));
    if (remaining.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    }
  } catch {
    // ignore
  }
}
