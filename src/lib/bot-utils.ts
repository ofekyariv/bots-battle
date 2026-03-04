// ─────────────────────────────────────────────────────────────
// Bot source helpers — shared across game + campaign pages
// ─────────────────────────────────────────────────────────────

import { getBotById } from '@/bots/index';
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
  // For custom bots, we don't have a sync lookup — return a placeholder
  // (the actual name is available when the bot is loaded from the API)
  return 'Custom Bot';
}
