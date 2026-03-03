/**
 * Pirate theme tokens for Bots Battle.
 * Values mirror the CSS custom properties in globals.css.
 */

export const NAVY = '#0a1628';
export const NAVY_LIGHT = '#0f1f3d';
export const NAVY_MID = '#122040';
export const NAVY_CARD = '#0d1a30';

export const GOLD = '#d4a843';
export const GOLD_LIGHT = '#e8c06a';
export const GOLD_DARK = '#b8912e';
export const GOLD_GLOW = 'rgba(212, 168, 67, 0.35)';

export const CRIMSON = '#dc2626';
export const OCEAN = '#1e3a5f';
export const FOAM = '#94a3b8';
export const WHITE = '#f1f5f9';

/** All pirate theme color tokens as a typed record. */
export const pirateColors = {
  navy: NAVY,
  'navy-light': NAVY_LIGHT,
  'navy-mid': NAVY_MID,
  'navy-card': NAVY_CARD,
  gold: GOLD,
  'gold-light': GOLD_LIGHT,
  'gold-dark': GOLD_DARK,
  'gold-glow': GOLD_GLOW,
  crimson: CRIMSON,
  ocean: OCEAN,
  foam: FOAM,
  white: WHITE,
} as const;

export type PirateColorKey = keyof typeof pirateColors;
