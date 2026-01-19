/**
 * ICC Cricket Rules Engine
 * Implements official ICC rules for scoring
 */

import { Ball, BallExtras } from '@/types'

/**
 * Check if a ball counts as a legal delivery
 * ICC Rule: Only deliveries that are not wide/no-ball count as legal
 */
export function isLegalBall(ball: Ball): boolean {
  return ball.isLegal && !ball.extras.wides && !ball.extras.noBalls
}

/**
 * Check if ball increments batsman's balls faced
 * ICC Rule: Wides do NOT count as a ball faced. No-balls DO count as a ball faced.
 */
export function countsTowardsBallsFaced(ball: Ball): boolean {
  const wides = Number(ball.extras?.wides || 0)
  return wides === 0
}

/**
 * Check if runs are credited to batsman
 * ICC Rule: Only runs off the bat are credited to batsman
 */
export function runsCreditedToBatsman(ball: Ball): number {
  return ball.runsOffBat
}

/**
 * Check if runs are credited to bowler
 * ICC Rule: Wides and no-balls count towards bowler's runs conceded
 */
export function runsCreditedToBowler(ball: Ball): number {
  // ICC: bowler is not charged for byes/leg-byes (penalty runs are treated separately).
  // For wides/no-balls with additional running runs, those runs ARE charged to the bowler.
  const byes = ball.extras.byes || 0
  const legByes = ball.extras.legByes || 0
  const penalty = ball.extras.penalty || 0
  return Math.max(0, (ball.totalRuns || 0) - byes - legByes - penalty)
}

/**
 * Check if wicket is credited to bowler
 * ICC Rule: Run-out, stumped, obstructing field do NOT credit bowler
 */
export function wicketCreditedToBowler(ball: Ball): boolean {
  if (!ball.wicket) return false
  return ball.wicket.creditedToBowler
}

/**
 * Calculate total runs from a ball
 */
export function getTotalRuns(ball: Ball): number {
  return ball.totalRuns
}

/**
 * Check if strike should rotate
 * ICC Rule: Strike rotates on odd runs, boundaries don't rotate
 */
export function shouldRotateStrike(ball: Ball): boolean {
  // If wicket falls, strike handling depends on crossing and dismissal type.
  // For now we keep it simple: do not rotate on the wicket ball itself.
  if (ball.wicket) return false

  // Boundary off the bat (no running) does not rotate strike
  if ((ball.runsOffBat === 4 || ball.runsOffBat === 6) && ball.extras.byes === 0 && ball.extras.legByes === 0) {
    // If there were additional running runs (rare, e.g. overthrows), rotation is based on running runs.
    // Our model can infer extra running runs from totalRuns.
  }

  // Strike rotation depends on "running runs" (not the automatic wide/no-ball +1).
  // Compute running runs as: off-bat + byes + leg byes + any additional runs beyond the automatic extras.
  const automaticWide = (ball.extras.wides || 0) > 0 ? 1 : 0
  const automaticNoBall = (ball.extras.noBalls || 0) > 0 ? 1 : 0
  const penalty = ball.extras.penalty || 0

  const baseAutomaticExtras = automaticWide + automaticNoBall + penalty
  const accounted = (ball.runsOffBat || 0) + (ball.extras.byes || 0) + (ball.extras.legByes || 0) + baseAutomaticExtras
  const additionalRunning = Math.max(0, (ball.totalRuns || 0) - accounted)
  const runningRuns = (ball.runsOffBat || 0) + (ball.extras.byes || 0) + (ball.extras.legByes || 0) + additionalRunning

  // If the only scoring was an automatic wide/no-ball run (no running), do not rotate.
  if (runningRuns === 0) return false

  // Rotate on odd running runs
  return runningRuns % 2 === 1
}

/**
 * Check if over is complete
 * ICC Rule: Over is complete when 6 legal balls have been bowled
 */
export function isOverComplete(legalBallsInOver: number): boolean {
  return legalBallsInOver >= 6
}

/**
 * Format balls to overs (ICC format: overs.balls)
 */
export function formatOvers(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6)
  const balls = legalBalls % 6
  return `${overs}.${balls}`
}

/**
 * Parse overs string to legal balls
 */
export function parseOvers(oversString: string): number {
  const [overs, balls] = oversString.split('.').map(Number)
  return (overs || 0) * 6 + (balls || 0)
}

/**
 * Calculate run rate
 */
export function calculateRunRate(runs: number, legalBalls: number): number {
  if (legalBalls === 0) return 0
  return (runs / legalBalls) * 6
}

/**
 * Calculate required run rate
 */
export function calculateRequiredRunRate(
  runsNeeded: number,
  ballsRemaining: number
): number | null {
  if (ballsRemaining <= 0) return null
  return (runsNeeded / ballsRemaining) * 6
}

/**
 * Calculate projected score based on current run rate
 */
export function calculateProjectedScore(
  currentRuns: number,
  currentBalls: number,
  totalOvers: number
): number {
  if (currentBalls === 0) return 0
  const currentRunRate = calculateRunRate(currentRuns, currentBalls)
  const totalBalls = totalOvers * 6
  return Math.round((currentRunRate / 6) * totalBalls)
}

/**
 * Check if free hit is valid for wicket
 * ICC Rule: On free hit, only run-out, stumped, hit-wicket, obstructing field result in dismissal
 */
export function isWicketAllowedOnFreeHit(wicketType: string): boolean {
  const allowedTypes = ['run-out', 'stumped', 'hit-wicket', 'obstructing-field']
  return allowedTypes.includes(wicketType.toLowerCase())
}

/**
 * Get ball display badge value
 */
export function getBallBadge(ball: Ball): { value: string; type: string } {
  // Support legacy/compat "type" field from ball docs (e.g. 'leg-bye', 'bye')
  const legacyType = String((ball as any)?.type || '').toLowerCase().trim()

  if (ball.wicket) {
    return { value: 'W', type: 'wicket' }
  }
  if (ball.runsOffBat === 6) {
    return { value: '6', type: 'six' }
  }
  if (ball.runsOffBat === 4) {
    return { value: '4', type: 'four' }
  }
  if (ball.extras.wides > 0) {
    // Show total wide runs (including any additional runs) in a human-friendly way
    const total = ball.totalRuns || ball.extras.wides
    return { value: total > 1 ? `Wd${total}` : 'Wd', type: 'wide' }
  }
  if (ball.extras.noBalls > 0) {
    const total = ball.totalRuns || (ball.extras.noBalls + (ball.runsOffBat || 0))
    return { value: total > 1 ? `Nb${total}` : 'Nb', type: 'noball' }
  }
  // Byes / Leg-byes: runs are extras, but should NOT be shown as dot
  const legByes =
    Number(ball.extras?.legByes || 0) ||
    Number((ball.extras as any)?.legBye || 0) ||
    Number((ball.extras as any)?.legbye || 0) ||
    0
  const byes =
    Number(ball.extras?.byes || 0) ||
    Number((ball.extras as any)?.bye || 0) ||
    0

  // If legacy type says bye/leg-bye but extras are missing, fall back to totalRuns (runsOffBat is 0 in both cases)
  const fallbackExtraRuns = Number((ball as any)?.totalRuns ?? 0) || 0

  if (legByes > 0 || legacyType === 'leg-bye' || legacyType === 'legbye' || legacyType === 'legbye') {
    const n = legByes > 0 ? legByes : fallbackExtraRuns
    if (n > 0) return { value: `${n}lb`, type: 'legbye' }
  }
  if (byes > 0 || legacyType === 'bye') {
    const n = byes > 0 ? byes : fallbackExtraRuns
    if (n > 0) return { value: `${n}b`, type: 'bye' }
  }

  if (ball.runsOffBat === 0) {
    return { value: '·', type: 'dot' }
  }
  return { value: String(ball.runsOffBat), type: 'run' }
}

