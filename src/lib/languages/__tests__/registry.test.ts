// ============================================================
// 🏴☠️ Language Registry Integration Tests
// ============================================================
//
// Verifies every registered language has all required fields,
// helper signatures for all BOT_HELPERS, no duplicate IDs.
// ============================================================

import { describe, it, expect } from 'vitest';
import { LANGUAGES, ALL_LANGUAGE_IDS, getAllLanguages } from '../registry';
import { CANONICAL_HELPERS } from '../helpers';
import { BOT_HELPERS } from '@/engine/helpers';
import type { LanguageId } from '../types';

const BOT_HELPER_KEYS = Object.keys(BOT_HELPERS) as string[];
const EXPECTED_HELPER_COUNT = BOT_HELPER_KEYS.length;

describe('Language Registry', () => {
  it('has no duplicate language IDs', () => {
    const seen = new Set<LanguageId>();
    for (const id of ALL_LANGUAGE_IDS) {
      expect(seen.has(id), `Duplicate language ID: ${id}`).toBe(false);
      seen.add(id);
    }
    expect(seen.size).toBe(ALL_LANGUAGE_IDS.length);
  });

  it('ALL_LANGUAGE_IDS matches LANGUAGES keys', () => {
    const registryKeys = Object.keys(LANGUAGES).sort();
    const listKeys = [...ALL_LANGUAGE_IDS].sort();
    expect(registryKeys).toEqual(listKeys);
  });

  it('getAllLanguages() returns configs in declared order', () => {
    const langs = getAllLanguages();
    expect(langs.map((l) => l.id)).toEqual(ALL_LANGUAGE_IDS);
  });

  describe.each(ALL_LANGUAGE_IDS)('Language: %s', (langId) => {
    const config = LANGUAGES[langId];

    it('has a config entry', () => {
      expect(config).toBeDefined();
    });

    it('has required string fields', () => {
      expect(config.id).toBe(langId);
      expect(typeof config.displayName).toBe('string');
      expect(config.displayName.length).toBeGreaterThan(0);
      expect(typeof config.monacoLanguage).toBe('string');
      expect(typeof config.fileExtension).toBe('string');
      expect(typeof config.color).toBe('string');
      expect(typeof config.icon).toBe('string');
    });

    it('has non-empty starterCode', () => {
      expect(typeof config.starterCode).toBe('string');
      expect(config.starterCode.length).toBeGreaterThan(20);
    });

    it('has non-empty typeDefinitions', () => {
      expect(typeof config.typeDefinitions).toBe('string');
      expect(config.typeDefinitions.length).toBeGreaterThan(10);
    });

    it('has commandApi with idle and move', () => {
      expect(config.commandApi).toBeDefined();
      expect(typeof config.commandApi.idle).toBe('string');
      expect(typeof config.commandApi.move).toBe('string');
      expect(typeof config.commandApi.description).toBe('string');
    });

    it('has sandbox config', () => {
      expect(config.sandbox).toBeDefined();
      expect(['js-direct', 'transpile-to-js', 'remote-compile']).toContain(config.sandbox.type);
      expect(typeof config.sandbox.isAsync).toBe('boolean');
      expect(['instant', 'low', 'high']).toContain(config.sandbox.latency);
    });

    it('has docSnippets', () => {
      expect(config.docSnippets).toBeDefined();
      expect(typeof config.docSnippets.tickSignature).toBe('string');
      expect(typeof config.docSnippets.commandUsage).toBe('string');
    });

    it('has sampleBots array with at least one entry', () => {
      expect(Array.isArray(config.sampleBots)).toBe(true);
      expect(config.sampleBots.length).toBeGreaterThanOrEqual(1);
      for (const bot of config.sampleBots) {
        expect(typeof bot.name).toBe('string');
        expect(typeof bot.description).toBe('string');
        expect(typeof bot.code).toBe('string');
        expect(bot.code.length).toBeGreaterThan(10);
      }
    });

    it(`has helperSignatures for all ${EXPECTED_HELPER_COUNT} helpers`, () => {
      expect(config.helperSignatures).toBeDefined();
      const sigKeys = Object.keys(config.helperSignatures);
      expect(sigKeys.length).toBe(EXPECTED_HELPER_COUNT);
    });

    it('helperSignatures covers every BOT_HELPERS key', () => {
      for (const helperName of BOT_HELPER_KEYS) {
        expect(
          config.helperSignatures[helperName as keyof typeof config.helperSignatures],
          `Missing helper "${helperName}" for language "${langId}"`,
        ).toBeDefined();
      }
    });

    it('each helperSignature has required fields', () => {
      for (const helperName of BOT_HELPER_KEYS) {
        const sig = config.helperSignatures[helperName as keyof typeof config.helperSignatures];
        expect(sig.canonicalName, `${helperName}.canonicalName`).toBe(helperName);
        expect(typeof sig.signature, `${helperName}.signature`).toBe('string');
        expect(sig.signature.length, `${helperName}.signature non-empty`).toBeGreaterThan(0);
        expect(typeof sig.description, `${helperName}.description`).toBe('string');
        expect(typeof sig.returnType, `${helperName}.returnType`).toBe('string');
        expect(typeof sig.example, `${helperName}.example`).toBe('string');
      }
    });

    it('CANONICAL_HELPERS count matches BOT_HELPERS count', () => {
      expect(CANONICAL_HELPERS.length).toBe(EXPECTED_HELPER_COUNT);
    });
  });
});
