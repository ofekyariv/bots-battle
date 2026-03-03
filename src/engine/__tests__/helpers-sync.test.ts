// ============================================================
// 🏴☠️ Helpers Sync Tests
// ============================================================
//
// Verifies BOT_HELPERS keys are in sync with every language's
// registered helper signatures, and no helper is present in
// BOT_HELPERS but absent from any language registry entry.
// ============================================================

import { describe, it, expect } from 'vitest';
import { BOT_HELPERS } from '@/engine/helpers';
import { CANONICAL_HELPERS } from '@/lib/languages/helpers';
import { LANGUAGES, ALL_LANGUAGE_IDS } from '@/lib/languages/registry';

const BOT_HELPER_KEYS = Object.keys(BOT_HELPERS);

describe('BOT_HELPERS ↔ Language Registry sync', () => {
  it('CANONICAL_HELPERS count equals BOT_HELPERS key count', () => {
    expect(CANONICAL_HELPERS.length).toBe(BOT_HELPER_KEYS.length);
  });

  it('CANONICAL_HELPERS keys match BOT_HELPERS keys exactly', () => {
    const sortedCanonical = [...CANONICAL_HELPERS].sort();
    const sortedBotHelpers = [...BOT_HELPER_KEYS].sort();
    expect(sortedCanonical).toEqual(sortedBotHelpers);
  });

  it('no helper in BOT_HELPERS is missing from CANONICAL_HELPERS', () => {
    for (const key of BOT_HELPER_KEYS) {
      expect(
        CANONICAL_HELPERS.includes(key as typeof CANONICAL_HELPERS[number]),
        `BOT_HELPERS key "${key}" missing from CANONICAL_HELPERS`,
      ).toBe(true);
    }
  });

  describe.each(ALL_LANGUAGE_IDS)('Language %s helperSignatures ↔ BOT_HELPERS', (langId) => {
    const config = LANGUAGES[langId];

    it('has a signature for every BOT_HELPERS key', () => {
      for (const key of BOT_HELPER_KEYS) {
        expect(
          config.helperSignatures[key as keyof typeof config.helperSignatures],
          `Language "${langId}" missing helperSignature for BOT_HELPERS key "${key}"`,
        ).toBeDefined();
      }
    });

    it('has no extra signatures beyond BOT_HELPERS keys', () => {
      const sigKeys = Object.keys(config.helperSignatures);
      for (const sigKey of sigKeys) {
        expect(
          BOT_HELPER_KEYS.includes(sigKey),
          `Language "${langId}" has extra signature "${sigKey}" not in BOT_HELPERS`,
        ).toBe(true);
      }
    });

    it('signature count matches BOT_HELPERS count', () => {
      expect(Object.keys(config.helperSignatures).length).toBe(BOT_HELPER_KEYS.length);
    });
  });
});
