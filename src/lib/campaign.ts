// ============================================================
// 🏴‍☠️ Campaign Mode — Progressive Difficulty Levels
// ============================================================
// Inspired by CodinGame's league system.
// 10 levels, each with 3-5 bots to beat in sequence.
// Progress tracked in localStorage.
// ============================================================

import type { GameConfig } from '@/engine/types';
import { DEFAULT_CONFIG } from '@/engine/types';

// ─── Level Definition ───────────────────────────────────────

export interface CampaignBot {
  /** Bot registry id */
  id: string;
  /** Display name (can differ from registry name for flavour) */
  name: string;
  /** Tactical hint shown to the player */
  hint: string;
}

export interface CampaignLevel {
  /** 1-indexed level number */
  level: number;
  /** Military rank title */
  rank: string;
  /** Short punchy title */
  title: string;
  /** Narrative description / what this level teaches */
  description: string;
  /** Emoji icon for visual flair */
  emoji: string;
  /** Ordered list of bots to beat (3-5). Beat ALL to unlock next level. */
  bots: CampaignBot[];
  /** Optional game config overrides. Merged with DEFAULT_CONFIG. */
  configOverride?: Partial<GameConfig>;
}

// ─── The 10 Campaign Levels ─────────────────────────────────

export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  // ── Level 1: Tutorial ────────────────────────────────────
  {
    level: 1,
    rank: 'Deckhand',
    title: 'Learn the Ropes',
    description:
      'Your first command. The seas are calm, the map is small. Beat three bumbling pirates to earn your place on the crew.',
    emoji: '⚓',
    bots: [
      {
        id: 'random',
        name: 'Stumbling Pete',
        hint: 'Any strategy works. Just move your ships toward islands.',
      },
      {
        id: 'random',
        name: 'Dizzy Diaz',
        hint: 'Capture islands and hold them. Watch the score climb.',
      },
      {
        id: 'random',
        name: 'Clueless Carmen',
        hint: 'You have this. The exponential scoring rewards holding multiple islands.',
      },
    ],
    configOverride: {
      mapWidth: 800,
      mapHeight: 500,
      numIslands: 3,
      shipSpeed: 2,
      gameDuration: 1200,
      targetScore: 500,
      attackRadius: 25,
      captureRadius: 50,
      captureTurns: 15,
    },
  },

  // ── Level 2: Speed ──────────────────────────────────────
  {
    level: 2,
    rank: 'Boatswain',
    title: 'Keep Up the Pace',
    description:
      "The Rusher charges islands at full speed. If you dawdle, you'll be chasing its tail all game. Learn to move fast.",
    emoji: '💨',
    bots: [
      {
        id: 'random',
        name: 'Wandering Willy',
        hint: 'Warm up with an easy target.',
      },
      {
        id: 'rusher',
        name: 'Rusher',
        hint: "Race it to unclaimed islands — don't let it snowball early.",
      },
      {
        id: 'rusher',
        name: 'Rusher+',
        hint: 'Same strategy, less patience. Act in the first 10 seconds.',
      },
    ],
    configOverride: {
      mapWidth: 900,
      mapHeight: 600,
      numIslands: 5,
      gameDuration: 1500,
      targetScore: 750,
    },
  },

  // ── Level 3: Grouping ────────────────────────────────────
  {
    level: 3,
    rank: 'First Mate',
    title: 'Strength in Numbers',
    description:
      'The Defender clusters its ships in pairs — a 2v1 wall nothing alone can crack. Group up or be picked apart one by one.',
    emoji: '🛡️',
    bots: [
      {
        id: 'rusher',
        name: 'Rusher',
        hint: 'Speed alone is no longer enough. Grouping matters here.',
      },
      {
        id: 'defender',
        name: 'Defender',
        hint: 'Never send a lone ship into 2. Move in pairs and you win 2v1.',
      },
      {
        id: 'defender',
        name: 'Defender+',
        hint: 'More islands to contest. Maintain group discipline.',
      },
    ],
    configOverride: {
      mapWidth: 1000,
      mapHeight: 700,
      numIslands: 9,
      gameDuration: 1800,
      targetScore: 900,
    },
  },

  // ── Level 4: Combat ──────────────────────────────────────
  {
    level: 4,
    rank: 'Quartermaster',
    title: 'Hunt or Be Hunted',
    description:
      'The Hunter deploys kill squads of 3 that guarantee a 3v1 kill. Your positioning is your only defence — never be caught alone.',
    emoji: '⚔️',
    bots: [
      {
        id: 'defender',
        name: 'Defender',
        hint: 'Use the grouping you learned in level 3.',
      },
      {
        id: 'hunter',
        name: 'Hunter',
        hint: 'Stay in groups of 2+. Let it chase ghosts while you capture.',
      },
      {
        id: 'hunter',
        name: 'Hunter+',
        hint: 'Counter-hunt: form your own kill squad and take the fight to it.',
      },
    ],
    configOverride: {
      numIslands: 7,
      attackRadius: 35,
    },
  },

  // ── Level 5: Real challenge ───────────────────────────────
  {
    level: 5,
    rank: 'Captain',
    title: 'The Thinking Enemy',
    description:
      'Balanced adapts every 8 ticks — captures when safe, attacks isolated enemies, retreats when outnumbered. No easy openings.',
    emoji: '🏴‍☠️',
    bots: [
      {
        id: 'hunter',
        name: 'Hunter',
        hint: 'Final warm-up before the real gauntlet.',
      },
      {
        id: 'balanced',
        name: 'Balanced',
        hint: 'Read the board. Balanced punishes every mistake. Use all you know.',
      },
      {
        id: 'balanced',
        name: 'Balanced+',
        hint: 'Tougher map. Keep adapting — it is.',
      },
      {
        id: 'balanced',
        name: 'Balanced Final',
        hint: 'Victory here earns you the flag of Captain.',
      },
    ],
    configOverride: { ...DEFAULT_CONFIG },
  },

  // ── Level 6: v2 Intro ────────────────────────────────────
  {
    level: 6,
    rank: 'Commodore',
    title: 'New Adversaries',
    description:
      'Elite pirates with new tactics enter the fray. The Flanker pincer-attacks from two sides simultaneously. The Swarm rolls as one unstoppable fist.',
    emoji: '🦅',
    bots: [
      {
        id: 'balanced',
        name: 'Balanced',
        hint: 'Your benchmark. Beat it again to warm up.',
      },
      {
        id: 'flanker',
        name: 'Flanker',
        hint: 'Watch for the pincer — break one wing before they merge.',
      },
      {
        id: 'swarm',
        name: 'Swarm',
        hint: "It's one big group. Race to uncontested islands while it's busy.",
      },
    ],
  },

  // ── Level 7: Hit-and-Run ─────────────────────────────────
  {
    level: 7,
    rank: 'Rear Admiral',
    title: 'Hit and Run',
    description:
      'The Guerrilla vanishes the moment you approach. The Economist knows the exact ROI of every island. Both exploit every gap ruthlessly.',
    emoji: '👻',
    bots: [
      {
        id: 'flanker',
        name: 'Flanker',
        hint: 'A familiar face, now just a stepping stone.',
      },
      {
        id: 'guerrilla',
        name: 'Guerrilla',
        hint: "Don't chase it. Cap islands instead — it runs too fast to catch.",
      },
      {
        id: 'economist',
        name: 'Economist',
        hint: 'Block the high-value islands. Deny the math.',
      },
      {
        id: 'guerrilla',
        name: 'Guerrilla+',
        hint: 'Wider map. More places to hide. Good luck.',
      },
    ],
    configOverride: {
      mapWidth: 1400,
      mapHeight: 900,
      numIslands: 9,
      gameDuration: 2400,
      targetScore: 2000,
    },
  },

  // ── Level 8: Precision ───────────────────────────────────
  {
    level: 8,
    rank: 'Vice Admiral',
    title: 'Precision and Pressure',
    description:
      'The Assassin hunts your isolated ships with 2-ship kill squads. Fortress holds the centre with orbital defenders. Opportunist pounces on every gap.',
    emoji: '🗡️',
    bots: [
      {
        id: 'assassin',
        name: 'Assassin',
        hint: 'Keep your ships together — it only targets stragglers.',
      },
      {
        id: 'fortress',
        name: 'Fortress',
        hint: 'Overwhelm one defended island with 3+ ships simultaneously.',
      },
      {
        id: 'opportunist',
        name: 'Opportunist',
        hint: 'Watch your back line — it exploits every gap.',
      },
      {
        id: 'zerg',
        name: 'Zerg',
        hint: 'Let it waste ships. Score faster than it can respawn.',
      },
    ],
  },

  // ── Level 9: Elite ───────────────────────────────────────
  {
    level: 9,
    rank: 'Admiral',
    title: 'Controlled Chaos',
    description:
      "Chaos picks a random strategy every game — you'll never know what's coming. Admiral plays a full 3-phase campaign and never makes obvious mistakes.",
    emoji: '🌊',
    bots: [
      {
        id: 'opportunist',
        name: 'Opportunist',
        hint: 'You should be past this. Show it.',
      },
      {
        id: 'chaos',
        name: 'Chaos',
        hint: 'Scout its opening strategy in the first 5 seconds and adapt.',
      },
      {
        id: 'admiral',
        name: 'Admiral',
        hint: 'The hardest pre-built. Use every trick you know.',
      },
      {
        id: 'chaos',
        name: 'Chaos+',
        hint: 'Different strategy, same danger. Stay flexible.',
      },
    ],
    configOverride: {
      mapWidth: 1400,
      mapHeight: 900,
      numIslands: 9,
      targetScore: 3000,
      gameDuration: 4000,
    },
  },

  // ── Level 10: Pirate King ────────────────────────────────
  {
    level: 10,
    rank: 'Pirate King',
    title: 'The Final Armada',
    description:
      'The ultimate gauntlet. Admiral and Chaos alternate — a precise strategist and a wildcard. Only a truly masterful algorithm survives all five.',
    emoji: '👑',
    bots: [
      {
        id: 'admiral',
        name: 'Admiral',
        hint: "Methodical and dangerous. Don't give it time to consolidate.",
      },
      {
        id: 'chaos',
        name: 'Chaos',
        hint: 'Adapt. It plays completely differently every game.',
      },
      {
        id: 'admiral',
        name: 'Grand Admiral',
        hint: 'Full difficulty. No shortcuts. No mercy.',
      },
      {
        id: 'chaos',
        name: 'Chaos Incarnate',
        hint: 'Expect everything and nothing.',
      },
      {
        id: 'admiral',
        name: 'The Pirate King',
        hint: 'Defeat this and you have truly mastered the seas.',
      },
    ],
    configOverride: {
      mapWidth: 1600,
      mapHeight: 1000,
      numIslands: 11,
      targetScore: 4000,
      gameDuration: 5000,
      attackRadius: 35,
      shipSpeed: 3,
    },
  },
];

// ─── Progress Tracking ───────────────────────────────────────

export interface CampaignLevelProgress {
  /** 0-based index of the next bot to fight in this level */
  currentBotIndex: number;
  /** 0-based indices of bots already beaten in this level */
  completedBotIndices: number[];
}

export interface CampaignAttempt {
  level: number;
  botIndex: number;
  botId: string;
  result: 'win' | 'loss';
  timestamp: string;
}

export interface CampaignProgress {
  /** 1-indexed: the level the player is currently working on */
  currentLevel: number;
  /** Level numbers that are fully completed */
  completedLevels: number[];
  /** Per-level progress */
  levelProgress: Record<number, CampaignLevelProgress>;
  /** Recent match attempts (capped at 200) */
  attempts: CampaignAttempt[];
}

const CAMPAIGN_KEY = 'bots-battle:campaign';
const CAMPAIGN_PENDING_KEY = 'bots-battle:campaign-pending';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function defaultProgress(): CampaignProgress {
  return {
    currentLevel: 1,
    completedLevels: [],
    levelProgress: {},
    attempts: [],
  };
}

export function getCampaignProgress(): CampaignProgress {
  if (!isBrowser()) return defaultProgress();
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    if (!raw) return defaultProgress();
    return JSON.parse(raw) as CampaignProgress;
  } catch {
    return defaultProgress();
  }
}

export function saveCampaignProgress(progress: CampaignProgress): void {
  if (!isBrowser()) return;
  localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(progress));
}

export function resetCampaignProgress(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(CAMPAIGN_KEY);
}

/**
 * Record the result of a campaign battle.
 * Returns { progress, levelCompleted }.
 */
export function recordCampaignResult(
  level: number,
  botIndex: number,
  botId: string,
  result: 'win' | 'loss',
): { progress: CampaignProgress; levelCompleted: boolean } {
  const progress = getCampaignProgress();

  // Cap attempts at 200
  progress.attempts = [
    ...progress.attempts.slice(-199),
    { level, botIndex, botId, result, timestamp: new Date().toISOString() },
  ];

  if (result === 'win') {
    const lp: CampaignLevelProgress = progress.levelProgress[level] ?? {
      currentBotIndex: 0,
      completedBotIndices: [],
    };
    if (!lp.completedBotIndices.includes(botIndex)) {
      lp.completedBotIndices.push(botIndex);
    }

    const levelDef = CAMPAIGN_LEVELS.find((l) => l.level === level);
    const totalBots = levelDef?.bots.length ?? 1;

    if (botIndex + 1 < totalBots) {
      // Advance within level
      lp.currentBotIndex = botIndex + 1;
      progress.levelProgress[level] = lp;
      saveCampaignProgress(progress);
      return { progress, levelCompleted: false };
    }

    // All bots beaten → level complete
    lp.currentBotIndex = totalBots; // past the end = done
    progress.levelProgress[level] = lp;
    if (!progress.completedLevels.includes(level)) {
      progress.completedLevels.push(level);
    }
    if (level >= progress.currentLevel && level < CAMPAIGN_LEVELS.length) {
      progress.currentLevel = level + 1;
    }
    saveCampaignProgress(progress);
    return { progress, levelCompleted: true };
  }

  // Loss — just save the attempt
  saveCampaignProgress(progress);
  return { progress, levelCompleted: false };
}

/** Resolve effective GameConfig for a campaign level (DEFAULT_CONFIG + overrides) */
export function getLevelConfig(level: CampaignLevel): GameConfig {
  return { ...DEFAULT_CONFIG, ...(level.configOverride ?? {}) };
}

/** Check if a level is unlocked for the player */
export function isLevelUnlocked(levelNum: number, progress: CampaignProgress): boolean {
  return levelNum <= progress.currentLevel;
}

/** Check if a level is fully completed */
export function isLevelComplete(levelNum: number, progress: CampaignProgress): boolean {
  return progress.completedLevels.includes(levelNum);
}

/** Get set of bot IDs unlocked via campaign (appeared in any completed level) */
export function getUnlockedBotIds(progress?: CampaignProgress): Set<string> {
  const p = progress ?? getCampaignProgress();
  const ids = new Set<string>();
  // 'random' is always available
  ids.add('random');
  for (const level of CAMPAIGN_LEVELS) {
    if (p.completedLevels.includes(level.level)) {
      for (const bot of level.bots) {
        ids.add(bot.id);
      }
    }
  }
  return ids;
}

// ─── Pending Campaign Context ────────────────────────────────
// Written by the campaign page before navigating to /game.
// Read by the game page to know we're in campaign mode.

export interface CampaignPending {
  level: number;
  botIndex: number;
  botId: string;
}

export function setCampaignPending(ctx: CampaignPending): void {
  if (!isBrowser()) return;
  localStorage.setItem(CAMPAIGN_PENDING_KEY, JSON.stringify(ctx));
}

export function getCampaignPending(): CampaignPending | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(CAMPAIGN_PENDING_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CampaignPending;
  } catch {
    return null;
  }
}

export function clearCampaignPending(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(CAMPAIGN_PENDING_KEY);
}
