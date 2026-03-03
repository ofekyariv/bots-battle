export const ROUTES = {
  home: '/play',
  play: '/play',
  editor: '/editor',
  game: '/game',
  docs: '/docs',
  replays: '/replays',
  campaign: '/campaign',

  // Auth
  login: '/login',

  // Profile
  profile: '/profile',
  userProfile: (userId: string) => `/profile/${userId}` as const,

  // Matches
  matches: '/matches',
  match: (id: string) => `/matches/${id}` as const,

  // Tournaments
  tournaments: '/tournaments',
  tournament: (id: string) => `/tournaments/${id}` as const,
  tournamentCreate: '/tournaments/create',

  // Leaderboard
  leaderboard: '/leaderboard',

  // Challenge
  challenge: (code: string) => `/challenge/${code}` as const,
} as const;

/** Static route values (excludes dynamic route functions) */
export type AppRoute = Extract<(typeof ROUTES)[keyof typeof ROUTES], string>;
