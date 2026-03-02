/**
 * Firestore Collection References
 * Centralized collection path definitions
 */

export const COLLECTIONS = {
  TOURNAMENTS: 'tournaments',
  SQUADS: 'squads',
  PLAYERS: 'players',
  MATCHES: 'matches',
  USERS: 'users',
  ADMINS: 'admins',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings',
  LOGIN_LOGS: 'login_logs',
  NAME_CHANGES: 'name_changes',
} as const

export const SUBCOLLECTIONS = {
  INNINGS: 'innings',
  BALLS: 'balls',
  COMMENTARY: 'commentary',
} as const

// Match subcollections path
export const MATCH_SUBCOLLECTIONS = {
  COMMENTARY: (matchId: string) => `matches/${matchId}/commentary`,
} as const

