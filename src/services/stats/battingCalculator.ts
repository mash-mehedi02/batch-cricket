/**
 * Batting Statistics Calculator
 * ICC-Compliant batting statistics
 */

import {
  shouldCountInnings,
  getBallsFacedForStrikeRate,
  calculateBattingAverage,
  calculateStrikeRate,
  isFifty,
  isHundred,
  formatHighestScore,
} from './iccDefinitions'
import { detectNotOut, getNotOutFromSummary } from './notOutDetector'

export interface BattingMatchSummary {
  runs?: number
  balls?: number
  widesFaced?: number
  noBallsFaced?: number
  notOut?: boolean
  dismissed?: boolean
  wicketType?: string
  status?: string
  fours?: number
  sixes?: number
  retiredHurt?: boolean
}

export interface MatchContext {
  inningsComplete?: boolean
  targetReached?: boolean
  oversComplete?: boolean
  allOut?: boolean
  matchAbandoned?: boolean
}

export interface BattingStats {
  matches: number
  innings: number
  notOuts: number
  dismissals: number
  runs: number
  ballsFaced: number
  average: number | null
  strikeRate: number
  fours: number
  sixes: number
  fifties: number
  hundreds: number
  highest: number
  highestNotOut: boolean
}

/**
 * Calculate batting statistics from match summaries
 */
export function calculateBattingStats(
  matchSummaries: BattingMatchSummary[],
  matchContexts?: MatchContext[]
): BattingStats {
  const stats: BattingStats = {
    matches: 0,
    innings: 0,
    notOuts: 0,
    dismissals: 0,
    runs: 0,
    ballsFaced: 0,
    average: null,
    strikeRate: 0,
    fours: 0,
    sixes: 0,
    fifties: 0,
    hundreds: 0,
    highest: 0,
    highestNotOut: false,
  }

  if (!matchSummaries || !Array.isArray(matchSummaries)) {
    return stats
  }

  matchSummaries.forEach((summary, index) => {
    const runs = Number(summary.runs || 0)
    const balls = Number(summary.balls || 0)
    const fours = Number(summary.fours || 0)
    const sixes = Number(summary.sixes || 0)

    // Count innings if player batted
    if (shouldCountInnings(summary)) {
      stats.innings += 1

      // Determine not out status
      const matchContext = matchContexts?.[index]
      const notOut = matchContext
        ? detectNotOut(summary, matchContext)
        : getNotOutFromSummary(summary)

      if (notOut) {
        stats.notOuts += 1
      } else {
        stats.dismissals += 1
      }

      // Update highest score
      if (runs > stats.highest) {
        stats.highest = runs
        stats.highestNotOut = notOut
      } else if (runs === stats.highest && notOut && !stats.highestNotOut) {
        // If same score but this one is not out, prefer not out
        stats.highestNotOut = true
      }
    }

    // Accumulate runs
    stats.runs += runs

    // Calculate balls faced for strike rate (includes no-balls, excludes wides)
    const ballsForSR = getBallsFacedForStrikeRate({
      balls,
      widesFaced: summary.widesFaced,
      noBallsFaced: summary.noBallsFaced,
    })
    stats.ballsFaced += ballsForSR

    // Count boundaries
    stats.fours += fours
    stats.sixes += sixes

    // Count milestones
    if (isFifty(runs)) {
      stats.fifties += 1
    }
    if (isHundred(runs)) {
      stats.hundreds += 1
    }
  })

  // Calculate derived stats
  stats.average = calculateBattingAverage(stats.runs, stats.innings, stats.notOuts)
  stats.strikeRate = calculateStrikeRate(stats.runs, stats.ballsFaced)

  return stats
}

/**
 * Format batting average for display
 */
export function formatBattingAverage(average: number | null): string {
  if (average === null) return '—'
  return average.toFixed(2)
}

/**
 * Format highest score for display
 */
export function formatHighestScoreDisplay(
  highest: number,
  highestNotOut: boolean
): string {
  return formatHighestScore(highest, highestNotOut)
}

