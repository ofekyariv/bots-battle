// ============================================================
// Bot API Reference — generated from the language registry
// Used in LLM prompts on /editor and /llm-helper
//
// All content derives from the language registry:
//   - types       → lang.typeDefinitions
//   - bot struct  → lang.docSnippets.tickSignature / commandUsage
//   - commands    → lang.commandApi
//   - helpers     → lang.helperSignatures (via getAllHelperSignatures)
//
// To add a new helper: edit engine/helpers.ts + src/lib/languages/helpers.ts
// To add a new language: add it to src/lib/languages/registry.ts
// The reference strings here auto-update from the registry.
// ============================================================

import { getAllHelperSignatures } from '../languages/helpers';
import { getLanguage } from '../languages/registry';
import type { LanguageId } from '../languages/types';

// ─────────────────────────────────────────────
// Generate helper reference section from registry
// ─────────────────────────────────────────────

function generateHelperSection(langId: LanguageId): string {
  const sigs = getAllHelperSignatures(langId);
  const lines: string[] = ['--- Helper functions (injected globally — no imports needed) ---', ''];
  for (const sig of sigs) {
    const padding = ' '.repeat(Math.max(1, 60 - sig.signature.length));
    lines.push(`${sig.signature}${padding}// ${sig.description}`);
  }
  return lines.join('\n');
}

// ─────────────────────────────────────────────
// Build the full reference string per language from registry
// ─────────────────────────────────────────────

function buildApiReference(langId: LanguageId): string {
  const lang = getLanguage(langId);
  const cmd = lang.commandApi;
  const helpers = generateHelperSection(langId);

  const sections: string[] = [];

  // Header
  sections.push(`=== BOT API REFERENCE (${lang.displayName}) ===`);
  sections.push('');

  // Types
  sections.push('--- Types ---');
  sections.push('');
  sections.push(lang.typeDefinitions.trim());
  sections.push('');

  // Bot structure
  sections.push('--- Bot Structure ---');
  sections.push('');
  sections.push(lang.docSnippets.tickSignature);
  sections.push('');
  sections.push('// Command examples:');
  sections.push(lang.docSnippets.commandUsage);
  sections.push('');

  // Command API
  sections.push('--- Command API ---');
  sections.push('');
  sections.push(cmd.description);
  sections.push(`  Idle: ${cmd.idle}`);
  sections.push(`  Move: ${cmd.move}`);
  if (cmd.moveToObject) {
    sections.push(`  Move (object): ${cmd.moveToObject}`);
  }
  sections.push('');

  // Helpers
  sections.push(helpers);

  return sections.join('\n').trim();
}

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────

export type BotLanguage = LanguageId;

/** JS/TS reference (legacy named export — backward compat) */
export const BOT_API_REFERENCE = buildApiReference('javascript');
export const BOT_API_REFERENCE_PYTHON = buildApiReference('python');
export const BOT_API_REFERENCE_KOTLIN = buildApiReference('kotlin');
export const BOT_API_REFERENCE_JAVA = buildApiReference('java');
export const BOT_API_REFERENCE_CSHARP = buildApiReference('csharp');
export const BOT_API_REFERENCE_SWIFT = buildApiReference('swift');

/** Returns the API reference string for the given language. */
export function getBotApiReferenceForLanguage(language: BotLanguage): string {
  return buildApiReference(language);
}
