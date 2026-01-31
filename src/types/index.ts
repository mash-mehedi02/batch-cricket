/**
 * BatchCrick BD - Type Definitions
 * All TypeScript interfaces and types for the platform
 */

import { Timestamp } from 'firebase/firestore'

// ==================== AUTH ====================

export type UserRole = 'admin' | 'scorer' | 'viewer'

export interface User {
  uid: string
  email: string
  displayName?: string
  role: UserRole
  createdAt: Timestamp
  lastLogin?: Timestamp
}

// ==================== TOURNAMENT ====================

export type TournamentStageStatus = 'pending' | 'active' | 'completed' | 'paused'

export interface TournamentStageInfo {
  id: string
  name: string
  type: 'group' | 'knockout'
  order: number
  status: TournamentStageStatus
  startedAt?: Timestamp
  completedAt?: Timestamp
}

export interface Tournament {
  id: string
  name: string
  year: number
  school: string
  location?: string
  format: 'T20' | 'ODI' | 'Test' | 'Batch Cricket'
  status: 'upcoming' | 'ongoing' | 'completed' | 'paused'
  startDate?: string
  endDate?: string
  description?: string
  logoUrl?: string
  bannerUrl?: string

  // High-fidelity structure
  stages: TournamentStageInfo[]
  activeStageId?: string

  // Tournament structure
  tournamentType?: 'standard' | 'custom'
  config?: any // v1 TournamentConfig from engine

  participantSquadIds?: string[]
  participantSquadMeta?: Record<string, { name: string; batch?: string; logo?: string }>

  // Admin-confirmed progression
  confirmedQualifiers?: Record<string, string[]> // stageId -> squadIds
  finalRankingsConfirmed?: boolean

  // Winner info
  winnerSquadId?: string
  winnerSquadName?: string
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}

// ==================== SQUAD ====================

export interface Squad {
  id: string
  name: string
  // Legacy/compat: used for sorting + season grouping. We'll auto-fill from batch or tournament year.
  year: number
  // New: indicates which batch this squad represents (e.g. "2006", "Batch-17")
  batch: string
  // Optional: squad logo and banner URLs (for premium design)
  logoUrl?: string
  bannerUrl?: string
  // Deprecated: squads are no longer stored "under" a tournament; tournaments select squads.
  // Kept optional for legacy data.
  tournamentId?: string
  playerIds: string[]
  captainId?: string
  wicketKeeperId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
}

// ==================== PLAYER ====================

export type PlayerRole = 'batsman' | 'bowler' | 'all-rounder' | 'wicket-keeper'
export type BattingStyle = 'right-handed' | 'left-handed'
export type BowlingStyle = 'right-arm-fast' | 'right-arm-medium' | 'right-arm-spin' | 'left-arm-fast' | 'left-arm-medium' | 'left-arm-spin'

export interface Player {
  id: string
  name: string
  role: PlayerRole
  battingStyle?: BattingStyle
  bowlingStyle?: BowlingStyle
  dateOfBirth?: string
  photoUrl?: string // Cloudinary URL
  squadId: string // MANDATORY - player must belong to a squad
  batch?: string // Batch year/name
  stats?: {
    matches?: number
    innings?: number
    runs?: number
    balls?: number
    fours?: number
    sixes?: number
    notOuts?: number
    dismissals?: number
    highestScore?: number
    average?: number
    strikeRate?: number
    hundreds?: number
    fifties?: number
    // Bowling
    wickets?: number
    ballsBowled?: number
    overs?: number
    runsConceded?: number
    maidens?: number
    economy?: number
    bowlingAverage?: number
    bowlingStrikeRate?: number
    bestBowling?: { wickets: number; runs: number }
  }
  pastMatches?: any[]
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string

  // Player Claim System
  email?: string // Admin set, read-only for player (publicly masked, privately stored)
  maskedEmail?: string // e.g. "me*********57@gmail.com"
  securityCodeHash?: string // Store hashed version of the claim code
  claimed: boolean
  ownerUid?: string | null // UID of the player who claimed this profile
  username?: string // Customizable display name
  bio?: string
  school?: string // Fixed school name
  socialLinks?: SocialLink[]
  address?: string
}

export interface SocialLink {
  platform: 'instagram' | 'facebook' | 'x' | 'linkedin'
  url: string
  username: string
}

// Player career stats (aggregated across all matches)
export interface PlayerCareerStats {
  playerId: string
  matches: number
  innings: number
  runs: number
  balls: number
  fours: number
  sixes: number
  notOuts: number
  highestScore: number
  average: number
  strikeRate: number
  hundreds: number
  fifties: number
  // Bowling
  ballsBowled: number
  overs: number
  runsConceded: number
  wickets: number
  maidens: number
  economy: number
  bowlingAverage: number
  bowlingStrikeRate: number
  bestBowling?: { wickets: number; runs: number }
  // Season-wise stats stored separately
}

export interface PlayerSeasonStats {
  playerId: string
  year: number
  tournamentId: string
  // Same fields as PlayerCareerStats but for this season
  matches: number
  innings: number
  runs: number
  // ... etc
}

// ==================== MATCH ====================

export type MatchStatus = 'upcoming' | 'live' | 'finished' | 'abandoned' | 'InningsBreak'
export type BallType = 'red' | 'white' | 'pink'

export interface Match {
  id: string
  tournamentId: string
  // Optional: for group-stage tournaments (prevents cross-group fixtures)
  groupId?: string
  groupName?: string
  matchNo?: string // Unique match number (e.g., SFM01, SMT02)
  teamAId: string // Squad ID
  teamBId: string // Squad ID
  teamAName: string
  teamBName: string
  venue: string
  date: string | Timestamp | any // Support both YYYY-MM-DD and Firestore Timestamp
  time: string
  year?: number | string
  startTime?: Timestamp
  oversLimit: number
  ballType: BallType
  tossWinner?: 'teamA' | 'teamB'
  electedTo?: 'bat' | 'bowl'
  status: MatchStatus
  matchPhase: 'FirstInnings' | 'SecondInnings' | 'InningsBreak' | 'finished'
  target?: number
  innings1Score?: number
  innings1Wickets?: number
  innings1Overs?: string
  // Lineups
  teamAPlayingXI: string[] // Player IDs
  teamBPlayingXI: string[] // Player IDs
  teamAPlayingXIWithNames?: Array<{ id: string; name: string }>
  teamBPlayingXIWithNames?: Array<{ id: string; name: string }>
  playersDataSynced?: boolean
  teamACaptainId?: string
  teamAKeeperId?: string
  teamBCaptainId?: string
  teamBKeeperId?: string
  // Current state
  currentBatting?: 'teamA' | 'teamB'
  currentStrikerId?: string
  currentNonStrikerId?: string
  currentBowlerId?: string
  lastOverBowlerId?: string
  freeHit: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
  resultSummary?: string
  winnerId?: string
  score?: {
    teamA?: { runs: number; wickets: number; overs: string }
    teamB?: { runs: number; wickets: number; overs: string }
  }
}

// ==================== BALL ====================

export type WicketType =
  | 'bowled'
  | 'caught'
  | 'lbw'
  | 'run-out'
  | 'stumped'
  | 'hit-wicket'
  | 'obstructing-field'
  | 'retired'
  | 'retired-hurt'
  | 'retired-out'
  | 'timed-out'
  | 'handled-ball'
  | 'hit-ball-twice'

export interface BallWicket {
  type: WicketType
  dismissedPlayerId: string
  creditedToBowler: boolean // false for run-out, stumped, etc.
  fielderId?: string
  bowlerId: string
}

export interface BallExtras {
  wides: number
  noBalls: number
  byes: number
  legByes: number
  penalty: number
}

export interface Ball {
  id: string
  matchId: string
  inningId: 'teamA' | 'teamB'
  innings?: 'teamA' | 'teamB' // Legacy/Optional compatibility
  sequence: number // Chronological order
  // ...

  overNumber: number // 1-based
  ballInOver: number | null // 0-5 for legal balls, null for wides/no-balls
  batsmanId: string
  bowlerId: string
  nonStrikerId: string
  runsOffBat: number
  extras: BallExtras
  totalRuns: number // runsOffBat + extras total
  isLegal: boolean // true if not wide/no-ball
  wicket: BallWicket | null
  freeHit: boolean
  timestamp: Timestamp
  createdAt: string
}

// ==================== INNINGS ====================

export interface BatsmanStats {
  batsmanId: string
  batsmanName: string
  runs: number
  balls: number
  fours: number
  sixes: number
  strikeRate: number
  dismissal?: string
  notOut: boolean
}

export interface BowlerStats {
  bowlerId: string
  bowlerName: string
  ballsBowled: number
  overs: string // Format: "3.4"
  runsConceded: number
  wickets: number
  maidens: number
  economy: number
  average: number | null
  strikeRate: number | null
}

export interface FallOfWicket {
  wicket: number
  runs: number
  over: string
  batsmanId: string
  batsmanName: string
  dismissal: string
}

export interface RecentOver {
  overNumber: number
  balls: Array<{
    value: string
    type: string
    runsOffBat: number
  }>
  // Ordered list of ALL deliveries in the over (legal + extras like wide/no-ball) in sequence order
  // Used for "0 wd 0 0 4 1 0" style UIs.
  deliveries?: Array<{
    value: string
    type: string
    runsOffBat: number
    isLegal: boolean
  }>
  extras?: Array<{
    badge: string
    runs: number
  }>
  totalRuns: number
  isLocked: boolean
}

export interface PartnershipBatter {
  id: string
  name: string
  runs: number
  balls: number
}

export interface Partnership {
  runs: number
  balls: number
  overs: string
  batter1?: PartnershipBatter
  batter2?: PartnershipBatter
  wicketNo?: number
}

export interface InningsStats {
  matchId: string
  inningId: 'teamA' | 'teamB'
  totalRuns: number
  totalWickets: number
  legalBalls: number
  overs: string // Format: "13.4"
  ballsInCurrentOver: number // 0-5
  currentRunRate: number
  requiredRunRate: number | null
  remainingBalls: number | null
  remainingRuns: number | null
  target: number | null
  projectedTotal: number | null
  lastBallSummary: {
    runs: number
    isWicket: boolean
    isBoundary: boolean
  } | null
  partnership: Partnership
  partnerships?: Partnership[]
  extras: BallExtras
  fallOfWickets: FallOfWicket[]
  batsmanStats: BatsmanStats[]
  bowlerStats: BowlerStats[]
  recentOvers: RecentOver[]
  currentOverBalls: Array<{
    value: string
    type: string
    runsOffBat: number
    wicketType?: string
  }>
  oversProgress: Array<{
    over: string
    balls: number
    runs: number
    wickets: number
  }>
  currentStrikerId?: string
  nonStrikerId?: string
  currentBowlerId: string
  lastUpdated: Timestamp
  updatedAt: string
}

// ==================== COMMENTARY ====================

export interface Commentary {
  id: string
  matchId: string
  inningId: 'teamA' | 'teamB'
  text: string
  over: string
  ball: number
  runs: number
  isWicket: boolean
  isBoundary: boolean
  batsman?: string
  bowler?: string
  tone: 'neutral' | 'excited' | 'dramatic'
  isHighlight: boolean
  timestamp: Timestamp
  createdAt: string
}

// ==================== AI INSIGHTS ====================

export interface WinProbability {
  teamA: number
  teamB: number
  reasoning: string
}

export interface ProjectedScore {
  at10Overs: number
  at15Overs: number
  at20Overs: number
  final: number
}

export interface MatchInsights {
  winProbability: WinProbability
  projectedScore: ProjectedScore
  recommendedBowler?: string
  keyMoments: string[]
}

