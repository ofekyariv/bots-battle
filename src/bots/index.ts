// ============================================================
// 🏴‍☠️ Bots Battle — Pre-built Bot Registry
// ============================================================
//
// Each entry provides:
//   • id          — stable identifier (used in URLs, localStorage)
//   • name        — display name
//   • description — short strategy summary shown in the UI
//   • difficulty  — "easy" | "medium" | "hard"
//   • code        — JavaScript code string (eval'd in sandbox)
//   • factory     — compiled TypeScript factory (direct import)
//
// The `code` strings are safe to display in the editor so players
// can read, learn from, and remix the pre-built strategies.
// ============================================================

import type { BotFactory } from '@/engine/types';

import { createBot as rusherFactory, botCode as rusherCode } from './rusher';
import { createBot as defenderFactory, botCode as defenderCode } from './defender';
import { createBot as hunterFactory, botCode as hunterCode } from './hunter';
import { createBot as balancedFactory, botCode as balancedCode } from './balanced';
import { createBot as randomFactory, botCode as randomCode } from './random';

// ── New bots (v2) ──
import { createBot as flankerFactory, botCode as flankerCode } from './flanker';
import { createBot as swarmFactory, botCode as swarmCode } from './swarm';
import { createBot as guerrillaFactory, botCode as guerrillaCode } from './guerrilla';
import { createBot as economistFactory, botCode as economistCode } from './economist';
import { createBot as assassinFactory, botCode as assassinCode } from './assassin';
import { createBot as fortressFactory, botCode as fortressCode } from './fortress';
import { createBot as opportunistFactory, botCode as opportunistCode } from './opportunist';
import { createBot as zergFactory, botCode as zergCode } from './zerg';
import { createBot as admiralFactory, botCode as admiralCode } from './admiral';
import { createBot as chaosFactory, botCode as chaosCode } from './chaos';

// ─────────────────────────────────────────────
// Registry entry type
// ─────────────────────────────────────────────

export interface BotRegistryEntry {
  /** Stable ID — never changes. Used in URLs and localStorage. */
  id: string;
  /** Display name shown in the UI. */
  name: string;
  /** One-sentence strategy summary. */
  description: string;
  /** Flavour text — what makes this bot interesting to watch. */
  flavour: string;
  /** Difficulty for a human player to beat. */
  difficulty: 'easy' | 'medium' | 'hard';
  /**
   * Tags summarising the bot's approach.
   * Shown as chips in the bot picker.
   */
  tags: string[];
  /**
   * The bot's strategy code as a JavaScript string.
   * Injected into the sandbox via Function() constructor.
   * Also shown in the editor so players can learn from it.
   */
  code: string;
  /**
   * Compiled TypeScript factory — used when running pre-built bots
   * directly without going through the sandbox eval path.
   */
  factory: BotFactory;
}

// ─────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────

export const BOT_REGISTRY: BotRegistryEntry[] = [
  {
    id: 'rusher',
    name: 'Rusher',
    description:
      'All ships sprint for uncaptured islands — greedy spreading ensures no two ships waste time on the same target.',
    flavour:
      'Pure aggression. No defence, no formation — just race to claim the map before the enemy can react. Watch it spiral outward like a starfish.',
    difficulty: 'medium',
    tags: ['aggressive', 'expansion', 'early-game'],
    code: rusherCode,
    factory: rusherFactory,
  },
  {
    id: 'defender',
    name: 'Defender',
    description:
      'Secures the 3 nearest islands and defends them in pairs. A rapid-response floater reinforces wherever the enemy pushes.',
    flavour:
      "Fortress mode. Pairs of ships patrol their home islands, each providing 2v1 protection. Enemy can't take any island without fighting an uphill battle.",
    difficulty: 'medium',
    tags: ['defensive', 'territory', 'patrol'],
    code: defenderCode,
    factory: defenderFactory,
  },
  {
    id: 'hunter',
    name: 'Hunter',
    description:
      '3 ships form a kill squad that hunts enemy groups. 2 ships capture islands while the enemy is preoccupied staying alive.',
    flavour:
      'Asymmetric warfare. The kill squad creates a 3v1 death zone that no lone ship survives, while capturers exploit the panic. Dangerous and thrilling to watch.',
    difficulty: 'hard',
    tags: ['aggressive', 'combat', 'kill-squad'],
    code: hunterCode,
    factory: hunterFactory,
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description:
      'Adapts every 8 ticks: captures when safe, assaults isolated enemies, retreats when outnumbered, and defends contested islands.',
    flavour:
      'The thinking bot. Each ship independently reads the battlefield and picks the smartest action. Falls apart under extreme pressure but punishes sloppy opponents.',
    difficulty: 'hard',
    tags: ['adaptive', 'combat', 'defensive', 'capture'],
    code: balancedCode,
    factory: balancedFactory,
  },
  {
    id: 'random',
    name: 'Random',
    description:
      'Wanders randomly, occasionally stumbling onto islands. The baseline opponent — perfect for first games.',
    flavour:
      "Chaotic neutral. No strategy whatsoever. If you can't beat Random, start here and learn the API. Sometimes it accidentally wins just to humble you.",
    difficulty: 'easy',
    tags: ['random', 'baseline', 'easy'],
    code: randomCode,
    factory: randomFactory,
  },

  // ── v2 bots ──────────────────────────────────────────────

  {
    id: 'flanker',
    name: 'Flanker',
    description:
      'Splits into two wings that attack from opposite sides simultaneously, forcing the enemy to fight on two fronts at once.',
    flavour:
      'Classic pincer. Left wing swoops from above, right wing from below. If the enemy clumps together the wings merge — if they spread, they get picked off in pairs. Watch the coordinated approach routes.',
    difficulty: 'hard',
    tags: ['aggressive', 'combat', 'flanking', 'coordination'],
    code: flankerCode,
    factory: flankerFactory,
  },

  {
    id: 'swarm',
    name: 'Swarm',
    description:
      'All 5 ships move as a single unstoppable fist, overwhelming each island in turn. No enemy can stop 5v1 combat.',
    flavour:
      'Resistance is futile. The entire fleet descends on one island, captures it, then pivots to the next. Terrifying to watch but vulnerable to fast expanders that sneak behind it.',
    difficulty: 'medium',
    tags: ['aggressive', 'expansion', 'combat', 'zerg'],
    code: swarmCode,
    factory: swarmFactory,
  },

  {
    id: 'guerrilla',
    name: 'Guerrilla',
    description:
      'Hit-and-run specialist: capture islands then vanish when enemies approach. Uses weighted flee vectors to escape chases.',
    flavour:
      "Now you see it, now you don't. Each ship monitors threat range and flees the moment enemies close in. The map is always in flux — by the time you arrive, it's gone.",
    difficulty: 'hard',
    tags: ['evasive', 'capture', 'hit-and-run', 'adaptive'],
    code: guerrillaCode,
    factory: guerrillaFactory,
  },

  {
    id: 'economist',
    name: 'Economist',
    description:
      'Calculates the exact ROI of every island using the exponential scoring formula. Goes only where the math says to go.',
    flavour:
      'Pure EV calculation. It knows exactly how much each island is worth at every moment — capturing the island that doubles the score rate beats capturing the nearest one. Dangerous in the late game.',
    difficulty: 'hard',
    tags: ['scoring', 'expansion', 'adaptive', 'no-combat'],
    code: economistCode,
    factory: economistFactory,
  },

  {
    id: 'assassin',
    name: 'Assassin',
    description:
      "Identifies and hunts the enemy's most isolated ship with 2-ship kill squads. Never attacks fortified groups.",
    flavour:
      "Picks off stragglers with cold precision. Uses an isolation score to find ships the enemy left exposed, then sends a pair to guarantee the kill. Don't let your ships wander alone.",
    difficulty: 'hard',
    tags: ['combat', 'isolation', 'precision', 'hunter'],
    code: assassinCode,
    factory: assassinFactory,
  },

  {
    id: 'fortress',
    name: 'Fortress',
    description:
      'Claims the 2 most central islands and defends them with orbiting pairs. A raider captures bonus territory opportunistically.',
    flavour:
      'Impenetrable keeps. Two islands defended by 2 ships each make a 2v1 wall no lone attacker can crack. The fifth ship prowls for unguarded territory. Solid but loses to overwhelming force.',
    difficulty: 'medium',
    tags: ['defensive', 'territory', 'patrol', 'central'],
    code: fortressCode,
    factory: fortressFactory,
  },

  {
    id: 'opportunist',
    name: 'Opportunist',
    description:
      'Watches where enemies are NOT and sends ships there. Exploits every moment of inattention.',
    flavour:
      "Punishes over-commitment ruthlessly. Scores every island by how undefended it is and dispatches ships accordingly. You'll find your back-line islands captured the moment you look away.",
    difficulty: 'hard',
    tags: ['adaptive', 'expansion', 'counter-play', 'opportunistic'],
    code: opportunistCode,
    factory: opportunistFactory,
  },

  {
    id: 'zerg',
    name: 'Zerg',
    description:
      "Throws ships recklessly at enemies and islands. Death doesn't matter — every respawn charges again immediately.",
    flavour:
      "Death is temporary; pressure is forever. Three phases: Rush → Swarm → Overwhelm. At full pressure it's exhausting to deal with — but a smart scorer can rack up points while you're distracted fighting.",
    difficulty: 'medium',
    tags: ['aggressive', 'attrition', 'respawn', 'pressure'],
    code: zergCode,
    factory: zergFactory,
  },

  {
    id: 'admiral',
    name: 'Admiral',
    description:
      'Sophisticated 3-phase AI: expand early, consolidate mid-game, then defend the lead or make a final push. Role-based ship assignments updated every 20 ticks.',
    flavour:
      'The hardest pre-built opponent. Reads the game state holistically and assigns every ship a dynamic role. Punishes greedy expanders, survives attrition, and plays the endgame beautifully.',
    difficulty: 'hard',
    tags: ['adaptive', 'state-machine', 'phases', 'hard'],
    code: admiralCode,
    factory: admiralFactory,
  },

  {
    id: 'chaos',
    name: 'Chaos',
    description:
      'Randomly picks one of 3 completely different strategies at game start: Berserker (pure combat), Phantom (wide dispersal), or Blitz (hunters + capturers).',
    flavour:
      "You can't counter what you don't know is coming. Every game is different. Sometimes it rushes you with all 5 ships. Sometimes it disappears to corners of the map. Prepare for everything.",
    difficulty: 'medium',
    tags: ['random', 'unpredictable', 'adaptive', 'chaos'],
    code: chaosCode,
    factory: chaosFactory,
  },
];

// ─────────────────────────────────────────────
// Lookup helpers
// ─────────────────────────────────────────────

/** Get a bot by its stable ID. Returns undefined if not found. */
export function getBotById(id: string): BotRegistryEntry | undefined {
  return BOT_REGISTRY.find((b) => b.id === id);
}

/** Default bot for new players — the easy baseline. */
export const DEFAULT_BOT_ID = 'random';

/** Default opponent for new players — medium challenge. */
export const DEFAULT_OPPONENT_ID = 'rusher';
