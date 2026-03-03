// ============================================================
// 🏴‍☠️ Storage / Bots — CRUD operations for saved bots
// ============================================================
//   saveBot(name, code)         — create or overwrite by name
//   loadBot(name)               — get code by name (or null)
//   loadBotFull(name)           — get full SavedBot by name
//   listBots()                  — list metadata (no code)
//   deleteBot(name)             — remove by name
//   getBotById(id)              — get full SavedBot by UUID
//   deleteBotById(id)           — remove by UUID
//   saveOrUpdateBot(...)        — upsert with explicit UUID
//   addBotVersion(id, code)     — manually add a version snapshot
//   renameBotById(id, newName)  — rename without code change
//   botExists(name)             — check existence by name
//   exportBots()                — JSON string of all bots
//   importBots(json, mode)      — import from JSON
// ============================================================

import { runMigrations } from './migrations';
import { parseBotArray } from './schemas';
import type { SavedBot, BotMeta, BotVersion } from './schemas';

// Re-export types for consumers
export type { SavedBot, BotMeta, BotVersion };

// ─────────────────────────────────────────────
// Internal constants & helpers
// ─────────────────────────────────────────────

const STORAGE_KEY = 'bots-battle:saved-bots';
const MAX_VERSIONS = 20;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readAll(): SavedBot[] {
  if (!isBrowser()) return [];
  runMigrations();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parseBotArray(parsed);
  } catch (e) {
    console.warn('[storage/bots] readAll failed:', e);
    return [];
  }
}

function writeAll(bots: SavedBot[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bots));
}

/** Generate a UUID v4 without external dependencies */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Prepend a version entry and cap to MAX_VERSIONS */
function pushVersion(existing: BotVersion[], code: string, note?: string): BotVersion[] {
  const entry: BotVersion = {
    code,
    savedAt: new Date().toISOString(),
    note,
  };
  return [entry, ...existing].slice(0, MAX_VERSIONS);
}

// ─────────────────────────────────────────────
// Core CRUD — name-based API
// ─────────────────────────────────────────────

/**
 * Save (create or overwrite) a bot by name.
 * Each call creates a new version snapshot if code changed.
 */
export function saveBot(
  name: string,
  code: string,
  versionNote?: string,
  language?: SavedBot['language'],
): SavedBot {
  if (!name.trim()) throw new Error('Bot name cannot be empty.');

  const bots = readAll();
  const now = new Date().toISOString();
  const trimmedName = name.trim();

  const existingIdx = bots.findIndex((b) => b.name.toLowerCase() === trimmedName.toLowerCase());

  if (existingIdx !== -1) {
    const existing = bots[existingIdx];
    const newVersions =
      existing.code !== code
        ? pushVersion(existing.versions, existing.code, versionNote ?? 'Manual save')
        : existing.versions;

    const updated: SavedBot = {
      ...existing,
      name: trimmedName,
      code,
      language: language ?? existing.language ?? 'javascript',
      updatedAt: now,
      versions: newVersions,
    };
    bots[existingIdx] = updated;
    writeAll(bots);
    return updated;
  }

  const bot: SavedBot = {
    id: uuid(),
    name: trimmedName,
    code,
    language: language ?? 'javascript',
    createdAt: now,
    updatedAt: now,
    versions: [],
  };
  bots.push(bot);
  writeAll(bots);
  return bot;
}

/**
 * Load a bot's source code by name.
 */
export function loadBot(name: string): string | null {
  const trimmed = name.trim().toLowerCase();
  const bot = readAll().find((b) => b.name.toLowerCase() === trimmed);
  return bot?.code ?? null;
}

/**
 * Load full SavedBot metadata + code by name.
 */
export function loadBotFull(name: string): SavedBot | null {
  const trimmed = name.trim().toLowerCase();
  return readAll().find((b) => b.name.toLowerCase() === trimmed) ?? null;
}

/**
 * List all saved bots — metadata only (no code or versions).
 * Sorted by updatedAt descending.
 */
export function listBots(): BotMeta[] {
  return readAll()
    .map(({ id, name, language, createdAt, updatedAt }) => ({
      id,
      name,
      language,
      createdAt,
      updatedAt,
    }))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Delete a bot by name (case-insensitive).
 */
export function deleteBot(name: string): void {
  const trimmed = name.trim().toLowerCase();
  writeAll(readAll().filter((b) => b.name.toLowerCase() !== trimmed));
}

// ─────────────────────────────────────────────
// Extended helpers — UUID-based access
// ─────────────────────────────────────────────

/**
 * Get a single bot by its stable UUID.
 */
export function getBotById(id: string): SavedBot | null {
  return readAll().find((b) => b.id === id) ?? null;
}

/**
 * Delete a bot by its stable UUID.
 */
export function deleteBotById(id: string): void {
  writeAll(readAll().filter((b) => b.id !== id));
}

/**
 * Upsert a bot by UUID. Each save creates a new version snapshot if code changed.
 */
export function saveOrUpdateBot(
  id: string,
  name: string,
  code: string,
  versionNote?: string,
  language?: SavedBot['language'],
): SavedBot {
  if (!name.trim()) throw new Error('Bot name cannot be empty.');

  const bots = readAll();
  const now = new Date().toISOString();
  const trimmedName = name.trim();

  const idx = bots.findIndex((b) => b.id === id);
  if (idx !== -1) {
    const existing = bots[idx];
    const newVersions =
      existing.code !== code
        ? pushVersion(existing.versions, existing.code, versionNote ?? 'Manual save')
        : existing.versions;

    const updated: SavedBot = {
      ...existing,
      name: trimmedName,
      code,
      language: language ?? existing.language ?? 'javascript',
      updatedAt: now,
      versions: newVersions,
    };
    bots[idx] = updated;
    writeAll(bots);
    return updated;
  }

  const bot: SavedBot = {
    id,
    name: trimmedName,
    code,
    language: language ?? 'javascript',
    createdAt: now,
    updatedAt: now,
    versions: [],
  };
  bots.push(bot);
  writeAll(bots);
  return bot;
}

/**
 * Manually add a version snapshot to an existing bot.
 * Does NOT update the bot's current code.
 */
export function addBotVersion(id: string, code: string, note?: string): SavedBot | null {
  const bots = readAll();
  const idx = bots.findIndex((b) => b.id === id);
  if (idx === -1) return null;

  const existing = bots[idx];
  const newVersions = pushVersion(existing.versions, code, note);
  const updated: SavedBot = { ...existing, versions: newVersions };
  bots[idx] = updated;
  writeAll(bots);
  return updated;
}

/**
 * Rename a bot identified by UUID.
 */
export function renameBotById(id: string, newName: string): SavedBot {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Bot name cannot be empty.');

  const bots = readAll();
  const idx = bots.findIndex((b) => b.id === id);
  if (idx === -1) throw new Error(`Bot with id "${id}" not found.`);

  const collision = bots.find((b) => b.id !== id && b.name.toLowerCase() === trimmed.toLowerCase());
  if (collision) throw new Error(`A bot named "${trimmed}" already exists.`);

  const updated: SavedBot = {
    ...bots[idx],
    name: trimmed,
    updatedAt: new Date().toISOString(),
  };
  bots[idx] = updated;
  writeAll(bots);
  return updated;
}

/**
 * Check whether any bot with the given name exists.
 */
export function botExists(name: string): boolean {
  const trimmed = name.trim().toLowerCase();
  return readAll().some((b) => b.name.toLowerCase() === trimmed);
}

/**
 * Export all bots as a JSON string (for backup / sharing).
 */
export function exportBots(): string {
  return JSON.stringify(readAll(), null, 2);
}

/**
 * Import bots from a JSON string.
 * mode "merge" — add new bots (skip existing IDs)
 * mode "replace" — overwrite all existing bots
 */
export function importBots(json: string, mode: 'merge' | 'replace' = 'merge'): void {
  let incoming: SavedBot[];
  try {
    const raw = JSON.parse(json);
    incoming = parseBotArray(raw, 'import');
    if (incoming.length === 0 && Array.isArray(raw) && raw.length > 0) {
      throw new Error('All bot entries failed validation.');
    }
  } catch (e) {
    throw new Error(`Invalid bot export JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (mode === 'replace') {
    writeAll(incoming);
    return;
  }

  const existing = readAll();
  const existingIds = new Set(existing.map((b) => b.id));
  const merged = [...existing, ...incoming.filter((b) => !existingIds.has(b.id))];
  writeAll(merged);
}

/**
 * Access the raw bots array (used by export/import utilities).
 * @internal
 */
export { readAll as _readAllBots, writeAll as _writeAllBots };
