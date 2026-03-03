// ============================================================
// 🏴☠️ Bots Battle — Language Registry barrel export
// ============================================================

export type {
  LanguageId,
  LanguageConfig,
  HelperName,
  HelperSignature,
  CommandApi,
  SandboxType,
  SandboxConfig,
  SampleBot,
} from './types';

export {
  LANGUAGES,
  ALL_LANGUAGE_IDS,
  getLanguage,
  getAllLanguages,
  getHelperSignature,
  getAllHelperSignatures,
} from './registry';

export { CANONICAL_HELPERS, HELPER_SIGNATURES } from './helpers';

export { COMMAND_APIS, getCommandApi } from './commands';

export {
  buildPythonPreamble,
  buildKotlinHelpers,
  buildSwiftHelpers,
  buildCSharpHelperMap,
} from './codegen';
