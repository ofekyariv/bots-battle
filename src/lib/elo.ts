// ============================================================
// 🏴☠️ Bots Battle — ELO Rating System
// ============================================================

import { db } from '@/db';
import { users, bots } from '@/db/schema';
import { eq } from 'drizzle-orm';

// ─────────────────────────────────────────────
// Core ELO formula
// ─────────────────────────────────────────────

/**
 * Calculate new ELO ratings after a match.
 * Returns [newWinnerRating, newLoserRating].
 */
export function calculateElo(
  winnerRating: number,
  loserRating: number,
  k = 32,
): [number, number] {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 - expectedWinner;

  const newWinnerRating = Math.round(winnerRating + k * (1 - expectedWinner));
  const newLoserRating = Math.round(loserRating + k * (0 - expectedLoser));

  return [newWinnerRating, newLoserRating];
}

// ─────────────────────────────────────────────
// DB update helpers
// ─────────────────────────────────────────────

/**
 * Update ELO ratings for both users after a match.
 * Looks up user IDs via bot IDs, then updates users table.
 */
export async function updateRatingsAfterMatch(
  winnerBotId: string,
  loserBotId: string,
): Promise<void> {
  // Load winner bot → user
  const [winnerBot] = await db.select({ userId: bots.userId }).from(bots).where(eq(bots.id, winnerBotId));
  const [loserBot] = await db.select({ userId: bots.userId }).from(bots).where(eq(bots.id, loserBotId));

  if (!winnerBot || !loserBot) return;

  // Load current ratings
  const [winnerUser] = await db.select({ id: users.id, eloRating: users.eloRating }).from(users).where(eq(users.id, winnerBot.userId));
  const [loserUser] = await db.select({ id: users.id, eloRating: users.eloRating }).from(users).where(eq(users.id, loserBot.userId));

  if (!winnerUser || !loserUser) return;
  // Skip ELO update if same user (bot vs own bot)
  if (winnerUser.id === loserUser.id) return;

  const [newWinnerRating, newLoserRating] = calculateElo(winnerUser.eloRating, loserUser.eloRating);

  await Promise.all([
    db.update(users).set({ eloRating: newWinnerRating, updatedAt: new Date() }).where(eq(users.id, winnerUser.id)),
    db.update(users).set({ eloRating: newLoserRating, updatedAt: new Date() }).where(eq(users.id, loserUser.id)),
  ]);
}
