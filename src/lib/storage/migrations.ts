// ============================================================
// 🏴‍☠️ Storage Migrations — versioned schema upgrades
// ============================================================

import { parseBotArray, parseMatchResultArray } from './schemas';

// ─────────────────────────────────────────────
// Version constant — bump when schema changes
// ─────────────────────────────────────────────

export const STORAGE_VERSION = 3;

// Storage keys
const VERSION_KEY = 'bots-battle:storage-version';
const STORAGE_KEY = 'bots-battle:saved-bots';
const MATCH_RESULTS_KEY = 'bots-battle:match-results';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

// ─────────────────────────────────────────────
// Individual migration steps
// ─────────────────────────────────────────────

/**
 * Migration v1 → v2:
 * - Ensure all bots have a `versions` array (was missing in some old records).
 * - Run Zod validation pass — corrupted entries are dropped with a warning.
 * - Normalize match results array.
 */
function migrateV1toV2(): void {
  // Migrate bots
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.warn('[storage/migration v1→v2] Bots JSON is corrupted — resetting.');
        localStorage.removeItem(STORAGE_KEY);
        parsed = [];
      }
      // Add missing `versions` arrays before schema validation
      if (Array.isArray(parsed)) {
        const normalised = parsed.map((b: Record<string, unknown>) => ({
          ...b,
          versions: Array.isArray(b.versions) ? b.versions : [],
        }));
        const validated = parseBotArray(normalised, 'migration-v1-v2');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
      }
    }
  } catch (e) {
    console.warn('[storage/migration v1→v2] Bot migration failed:', e);
  }

  // Migrate match results
  try {
    const raw = localStorage.getItem(MATCH_RESULTS_KEY);
    if (raw) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.warn('[storage/migration v1→v2] Match results JSON corrupted — resetting.');
        localStorage.removeItem(MATCH_RESULTS_KEY);
        parsed = [];
      }
      const validated = parseMatchResultArray(parsed, 'migration-v1-v2');
      localStorage.setItem(MATCH_RESULTS_KEY, JSON.stringify(validated));
    }
  } catch (e) {
    console.warn('[storage/migration v1→v2] Match result migration failed:', e);
  }

  console.info('[storage] Migrated from v1 → v2');
}

/**
 * Migration v2 → v3:
 * - Backfill `language` field on saved bots that are missing it.
 *   Defaults to 'javascript' for all existing bots (the only language
 *   that existed before multi-language support was added).
 */
function migrateV2toV3(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        console.warn('[storage/migration v2→v3] Bots JSON is corrupted — skipping language backfill.');
        return;
      }
      if (Array.isArray(parsed)) {
        const normalised = parsed.map((b: Record<string, unknown>) => ({
          ...b,
          language: b.language ?? 'javascript',
        }));
        const validated = parseBotArray(normalised, 'migration-v2-v3');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
      }
    }
  } catch (e) {
    console.warn('[storage/migration v2→v3] Language backfill failed:', e);
  }

  console.info('[storage] Migrated from v2 → v3 (language field backfilled)');
}

// ─────────────────────────────────────────────
// Migration runner — called once on app init
// ─────────────────────────────────────────────

let _migrationDone = false;

/**
 * Run all pending migrations on first call.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function runMigrations(): void {
  if (!isBrowser()) return;
  if (_migrationDone) return;
  _migrationDone = true;

  const stored = localStorage.getItem(VERSION_KEY);
  const currentVersion = stored ? parseInt(stored, 10) : 1;

  if (currentVersion < STORAGE_VERSION) {
    if (currentVersion < 2) migrateV1toV2();
    if (currentVersion < 3) migrateV2toV3();
    // Future: if (currentVersion < 4) migrateV3toV4();

    localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
    console.info(`[storage] Upgraded from v${currentVersion} → v${STORAGE_VERSION}`);
  }
}
