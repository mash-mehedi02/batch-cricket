/**
 * Type definitions and constants for CrickSMA Live
 */

// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  SCORER: 'scorer',
  VIEWER: 'viewer',
}

// Match Status
export const MATCH_STATUS = {
  UPCOMING: 'upcoming',
  LIVE: 'live',
  FINISHED: 'finished',
  CANCELLED: 'cancelled',
}

// Player Roles
export const PLAYER_ROLES = {
  BAT: 'BAT',
  BOWL: 'BOWL',
  ALL: 'ALL',
  WK: 'WK',
}

// Batting Styles
export const BATTING_STYLES = {
  RIGHT: 'Right-handed',
  LEFT: 'Left-handed',
}

// Bowling Styles
export const BOWLING_STYLES = {
  RIGHT_ARM_FAST: 'Right-arm Fast',
  RIGHT_ARM_MEDIUM: 'Right-arm Medium',
  RIGHT_ARM_SLOW: 'Right-arm Slow',
  LEFT_ARM_FAST: 'Left-arm Fast',
  LEFT_ARM_MEDIUM: 'Left-arm Medium',
  LEFT_ARM_SLOW: 'Left-arm Slow',
  RIGHT_ARM_LEG_SPIN: 'Right-arm Leg Spin',
  RIGHT_ARM_OFF_SPIN: 'Right-arm Off Spin',
  LEFT_ARM_ORTHODOX: 'Left-arm Orthodox',
  LEFT_ARM_UNORTHODOX: 'Left-arm Unorthodox',
}

// Wicket Types
export const WICKET_TYPES = {
  BOWLED: 'Bowled',
  CAUGHT: 'Caught',
  CAUGHT_BOWLED: 'Caught & Bowled',
  LBW: 'LBW',
  RUN_OUT: 'Run Out',
  STUMPED: 'Stumped',
  HIT_WICKET: 'Hit Wicket',
}

// Extra Types
export const EXTRA_TYPES = {
  NO_BALL: 'no-ball',
  WIDE: 'wide',
  LEG_BYE: 'leg-bye',
  BYE: 'bye',
}

// Collection Names
export const COLLECTIONS = {
  TOURNAMENTS: 'tournaments',
  SQUADS: 'squads',
  PLAYERS: 'players',
  MATCHES: 'matches',
  ADMINS: 'admin', // Note: Collection name is 'admin' (singular) in Firestore
}

// Cache Keys
export const CACHE_KEYS = {
  SCHEDULE: 'cricksma_schedule',
  SQUADS: 'cricksma_squads',
  TOURNAMENTS: 'cricksma_tournaments',
}

// Cache TTL (Time To Live) in milliseconds
export const CACHE_TTL = {
  SCHEDULE: 5 * 60 * 1000, // 5 minutes
  SQUADS: 10 * 60 * 1000, // 10 minutes
  TOURNAMENTS: 30 * 60 * 1000, // 30 minutes
}

