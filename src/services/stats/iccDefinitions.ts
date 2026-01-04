/**
 * ICC-Compliant Cricket Statistics Definitions
 * Based on official ICC rules and standards
 */

export const EXTRA_TYPES = {
  WIDE: 'wide',
  NO_BALL: 'no-ball',
  BYE: 'bye',
  LEG_BYE: 'leg-bye',
  PENALTY: 'penalty',
} as const

export const WICKET_TYPES = {
  BOWLED: 'bowled',
  CAUGHT: 'caught',
  LBW: 'lbw',
  RUN_OUT: 'run-out',
  STUMPED: 'stumped',
  HIT_WICKET: 'hit-wicket',
  OBSTRUCTING: 'obstructing',
  RETIRED_HURT: 'retired-hurt',
  RETIRED_OUT: 'retired-out',
  TIMED_OUT: 'timed-out',
} as const

export const MATCH_STATUS = {
  UPCOMING: 'upcoming',
  LIVE: 'live',
  FINISHED: 'finished',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
} as const

/**
 * ICC Rule: Match Counting
 * A match counts if:
 * 1. Match status is "live" or "finished"
 * 2. Player is in Playing XI
 */
export function shouldCountMatch(match: {
  status?: string
  playingXI?: string[]
  teamAPlayingXI?: string[]
  teamBPlayingXI?: string[]
}, playerId: string): boolean {
  const status = (match.status || '').toLowerCase()
  const isLiveOrFinished = status === 'live' || status === 'finished' || status === 'completed'
  
  if (!isLiveOrFinished) return false
  
  const playingXI = match.playingXI || []
  const teamAPlayingXI = match.teamAPlayingXI || []
  const teamBPlayingXI = match.teamBPlayingXI || []
  
  const allPlayingXI = [...playingXI, ...teamAPlayingXI, ...teamBPlayingXI]
  return allPlayingXI.includes(playerId)
}

/**
 * ICC Rule: Innings Counting
 * An innings counts if:
 * 1. Player faces at least 1 ball (legal or illegal)
 * 2. OR player is dismissed without facing (run out on 0 balls)
 */
export function shouldCountInnings(matchSummary: {
  balls?: number
  runs?: number
  notOut?: boolean
  dismissed?: boolean
  wicketType?: string
}): boolean {
  const balls = Number(matchSummary.balls || 0)
  const isDismissed = matchSummary.dismissed === true || 
                      matchSummary.notOut === false ||
                      Boolean(matchSummary.wicketType)
  
  // ICC Rule: Innings if faced at least 1 ball OR was dismissed
  return balls > 0 || isDismissed
}

/**
 * ICC Rule: Balls Faced for Strike Rate
 * Includes: Legal balls, No-balls (without bat)
 * Excludes: Wides, Penalty balls
 */
export function getBallsFacedForStrikeRate(matchSummary: {
  balls?: number
  widesFaced?: number
  noBallsFaced?: number
}): number {
  const legalBalls = Number(matchSummary.balls || 0)
  const noBalls = Number(matchSummary.noBallsFaced || 0)
  // Wides don't count for strike rate
  return legalBalls + noBalls
}

/**
 * ICC Rule: Balls Bowled
 * Includes: Legal balls only
 * Excludes: Wides, No-balls
 */
export function getBallsBowled(matchSummary: {
  ballsBowled?: number
  widesBowled?: number
  noBallsBowled?: number
}): number {
  const legalBalls = Number(matchSummary.ballsBowled || 0)
  // Wides and no-balls don't count as balls bowled
  return legalBalls
}

/**
 * ICC Rule: Batting Average
 * Average = Total Runs / Times Out
 * Times Out = Innings - Not Outs
 * If Times Out = 0, show "—" (not Infinity)
 */
export function calculateBattingAverage(
  runs: number,
  innings: number,
  notOuts: number
): number | null {
  const timesOut = innings - notOuts
  if (timesOut <= 0) {
    return null // Will be displayed as "—"
  }
  return runs / timesOut
}

/**
 * ICC Rule: Strike Rate
 * Strike Rate = (Runs / Balls Faced) × 100
 */
export function calculateStrikeRate(runs: number, ballsFaced: number): number {
  if (ballsFaced <= 0) return 0
  return (runs / ballsFaced) * 100
}

/**
 * ICC Rule: Bowling Average
 * Bowling Average = Runs Conceded / Wickets
 * If wickets = 0, undefined (not 0)
 */
export function calculateBowlingAverage(
  runsConceded: number,
  wickets: number
): number | null {
  if (wickets <= 0) return null
  return runsConceded / wickets
}

/**
 * ICC Rule: Bowling Strike Rate
 * Strike Rate = Balls Bowled / Wickets
 */
export function calculateBowlingStrikeRate(
  ballsBowled: number,
  wickets: number
): number {
  if (wickets <= 0) return 0
  return ballsBowled / wickets
}

/**
 * ICC Rule: Economy Rate
 * Economy = Runs Conceded / Overs
 */
export function calculateEconomy(runsConceded: number, overs: number): number {
  if (overs <= 0) return 0
  return runsConceded / overs
}

/**
 * ICC Rule: Convert balls to overs (x.y format)
 */
export function ballsToOvers(balls: number): string {
  const overs = Math.floor(balls / 6)
  const remainingBalls = balls % 6
  return `${overs}.${remainingBalls}`
}

/**
 * ICC Rule: Convert overs string to balls
 */
export function oversToBalls(oversValue: string | number): number {
  if (typeof oversValue === 'number') {
    const whole = Math.floor(oversValue)
    const fraction = Math.round((oversValue - whole) * 10)
    return whole * 6 + fraction
  }
  const [oversPart, ballsPart] = String(oversValue).split('.')
  const oversInt = Number.parseInt(oversPart || '0', 10)
  const ballsInt = Number.parseInt(ballsPart || '0', 10)
  return oversInt * 6 + ballsInt
}

/**
 * ICC Rule: Check if player is Not Out
 */
export function isNotOut(matchSummary: {
  notOut?: boolean
  dismissed?: boolean
  wicketType?: string
  status?: string
}): boolean {
  // Explicitly not out
  if (matchSummary.notOut === true) return true
  
  // Explicitly dismissed
  if (matchSummary.dismissed === true || matchSummary.notOut === false) return false
  
  // Has wicket type = dismissed
  if (matchSummary.wicketType) {
    // Retired hurt is not out
    if (matchSummary.wicketType === WICKET_TYPES.RETIRED_HURT) return true
    return false
  }
  
  // If status is "not out" or similar
  if (matchSummary.status === 'not out' || matchSummary.status === 'not-out') return true
  
  // Default: if no dismissal info, assume not out if has runs/balls
  return true
}

/**
 * ICC Rule: Check if score qualifies for 50
 */
export function isFifty(runs: number): boolean {
  return runs >= 50 && runs < 100
}

/**
 * ICC Rule: Check if score qualifies for 100
 */
export function isHundred(runs: number): boolean {
  return runs >= 100
}

/**
 * ICC Rule: Format highest score with * if not out
 */
export function formatHighestScore(runs: number, notOut: boolean): string {
  if (runs <= 0) return '-'
  return notOut ? `${runs}*` : String(runs)
}

/**
 * ICC Rule: Compare best bowling figures
 * Best = highest wickets, if equal then lowest runs
 */
export function compareBestBowling(
  wickets1: number,
  runs1: number,
  wickets2: number,
  runs2: number
): number {
  // Higher wickets is better
  if (wickets1 !== wickets2) {
    return wickets2 - wickets1 // Descending order
  }
  // If wickets equal, lower runs is better
  return runs1 - runs2 // Ascending order
}

