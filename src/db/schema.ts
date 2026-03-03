import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  pgEnum,
  primaryKey,
} from 'drizzle-orm/pg-core';

// Enums
export const botLanguageEnum = pgEnum('bot_language', [
  'javascript',
  'typescript',
  'python',
  'kotlin',
  'java',
  'csharp',
  'swift',
]);

export const matchStatusEnum = pgEnum('match_status', [
  'queued',
  'running',
  'completed',
  'errored',
]);

export const tournamentStatusEnum = pgEnum('tournament_status', [
  'open',
  'in_progress',
  'completed',
]);

export const tournamentFormatEnum = pgEnum('tournament_format', [
  'round_robin',
  'single_elim',
  'double_elim',
]);

// Tables
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  image: text('image'),
  eloRating: integer('elo_rating').notNull().default(1000),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const bots = pgTable('bots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  name: varchar('name', { length: 64 }).notNull(),
  language: botLanguageEnum('language').notNull(),
  code: text('code').notNull(),
  compiledJs: text('compiled_js'),
  version: integer('version').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const tournaments = pgTable('tournaments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 128 }).notNull(),
  creatorId: uuid('creator_id')
    .notNull()
    .references(() => users.id),
  status: tournamentStatusEnum('status').notNull().default('open'),
  format: tournamentFormatEnum('format').notNull(),
  maxPlayers: integer('max_players').notNull().default(10),
  config: jsonb('config').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
});

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  status: matchStatusEnum('status').notNull().default('queued'),
  player1BotId: uuid('player1_bot_id')
    .notNull()
    .references(() => bots.id),
  player2BotId: uuid('player2_bot_id')
    .notNull()
    .references(() => bots.id),
  winnerBotId: uuid('winner_bot_id').references(() => bots.id),
  config: jsonb('config').notNull().default({}),
  replayKey: text('replay_key'),
  player1Score: integer('player1_score').notNull().default(0),
  player2Score: integer('player2_score').notNull().default(0),
  ticksPlayed: integer('ticks_played').notNull().default(0),
  durationMs: integer('duration_ms').notNull().default(0),
  tournamentId: uuid('tournament_id').references(() => tournaments.id),
  round: integer('round'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const tournamentEntries = pgTable(
  'tournament_entries',
  {
    tournamentId: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    botId: uuid('bot_id')
      .notNull()
      .references(() => bots.id),
    finalRank: integer('final_rank'),
    wins: integer('wins').notNull().default(0),
    losses: integer('losses').notNull().default(0),
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.tournamentId, table.userId] }),
  })
);

// Challenge status enum
export const challengeStatusEnum = pgEnum('challenge_status', [
  'pending',
  'accepted',
  'expired',
]);

export const challenges = pgTable('challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  challengerId: uuid('challenger_id')
    .notNull()
    .references(() => users.id),
  challengerBotId: uuid('challenger_bot_id')
    .notNull()
    .references(() => bots.id),
  code: varchar('code', { length: 8 }).notNull().unique(),
  config: jsonb('config').notNull().default({}),
  status: challengeStatusEnum('status').notNull().default('pending'),
  opponentId: uuid('opponent_id').references(() => users.id),
  opponentBotId: uuid('opponent_bot_id').references(() => bots.id),
  matchId: uuid('match_id').references(() => matches.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
});

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Bot = typeof bots.$inferSelect;
export type NewBot = typeof bots.$inferInsert;
export type Match = typeof matches.$inferSelect;
export type NewMatch = typeof matches.$inferInsert;
export type Tournament = typeof tournaments.$inferSelect;
export type NewTournament = typeof tournaments.$inferInsert;
export type TournamentEntry = typeof tournamentEntries.$inferSelect;
export type NewTournamentEntry = typeof tournamentEntries.$inferInsert;
export type Challenge = typeof challenges.$inferSelect;
export type NewChallenge = typeof challenges.$inferInsert;
