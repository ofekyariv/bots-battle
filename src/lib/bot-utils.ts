// ─────────────────────────────────────────────────────────────
// Bot source helpers — shared across game + campaign pages
// ─────────────────────────────────────────────────────────────

import { getBotById } from '@/bots/index';
import { getBotById as getSavedBotById } from '@/lib/storage';
import type { BotSource as UseGameBotSource } from '@/lib/useGame';

/** Convert GameContext BotSource → useGame BotSource */
export function toUseBotSource(source: {
  type: string;
  id?: string;
  code?: string;
}): UseGameBotSource {
  if (source.type === 'preset' && source.id) {
    const entry = getBotById(source.id);
    if (entry) {
      return { kind: 'factory', factory: entry.factory };
    }
  }
  // Fallback: custom code or unknown preset → code path
  const code = source.type === 'custom' && source.code ? source.code : '';
  return { kind: 'code', code };
}

/** Human-readable bot name for display */
export function getBotName(source: { type: string; id?: string; savedBotId?: string }): string {
  if (source.type === 'preset' && source.id) {
    const entry = getBotById(source.id);
    return entry ? entry.name : source.id;
  }
  if (source.type === 'custom' && source.savedBotId) {
    const entry = getBotById(source.savedBotId);
    if (entry) return entry.name;
    const saved = getSavedBotById(source.savedBotId);
    return saved ? saved.name : 'Custom Bot';
  }
  return 'Custom Bot';
}
