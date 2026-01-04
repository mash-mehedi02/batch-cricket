/**
 * Bowling Statistics Calculator
 * ICC-Compliant bowling statistics
 */

import {
  getBallsBowled,
  calculateBowlingAverage,
  calculateBowlingStrikeRate,
  calculateEconomy,
  ballsToOvers,
  compareBestBowling,
} from './iccDefinitions'

export interface BowlingMatchSummary {
  wickets?: number
  runsConceded?: number
  ballsBowled?: number
  widesBowled?: number
  noBallsBowled?: number
  oversBowled?: string | number
}

export interface BowlingStats {
  innings: number
  overs: number
  ballsBowled: number
  runsConceded: number
  wickets: number
  economy: number
  average: number | null
  strikeRate: number
  bestBowling: string
  bestBowlingWickets: number
  bestBowlingRuns: number
  fiveWickets: number
}

/**
 * Calculate bowling statistics from match summaries
 */
export function calculateBowlingStats(
  matchSummaries: BowlingMatchSummary[]
): BowlingStats {
  const stats: BowlingStats = {
    innings: 0,
    overs: 0,
    ballsBowled: 0,
    runsConceded: 0,
    wickets: 0,
    economy: 0,
    average: null,
    strikeRate: 0,
    bestBowling: '0/0',
    bestBowlingWickets: 0,
    bestBowlingRuns: 999,
    fiveWickets: 0,
  }

  if (!matchSummaries || !Array.isArray(matchSummaries)) {
    return stats
  }

  matchSummaries.forEach((summary) => {
    const wickets = Number(summary.wickets || 0)
    const runsConceded = Number(summary.runsConceded || 0)

    // Count innings if player bowled
    const balls = getBallsBowled({
      ballsBowled: summary.ballsBowled,
      widesBowled: summary.widesBowled,
      noBallsBowled: summary.noBallsBowled,
    })

    if (balls > 0 || wickets > 0) {
      stats.innings += 1
    }

    // Accumulate stats
    stats.ballsBowled += balls
    stats.runsConceded += runsConceded
    stats.wickets += wickets

    // Update best bowling
    if (
      compareBestBowling(
        stats.bestBowlingWickets,
        stats.bestBowlingRuns,
        wickets,
        runsConceded
      ) > 0
    ) {
      stats.bestBowlingWickets = wickets
      stats.bestBowlingRuns = runsConceded
      stats.bestBowling = `${wickets}/${runsConceded}`
    }

    // Count 5-wicket hauls
    if (wickets >= 5) {
      stats.fiveWickets += 1
    }
  })

  // Calculate overs (from balls)
  stats.overs = stats.ballsBowled / 6

  // Calculate derived stats
  stats.economy = calculateEconomy(stats.runsConceded, stats.overs)
  stats.average = calculateBowlingAverage(stats.runsConceded, stats.wickets)
  stats.strikeRate = calculateBowlingStrikeRate(stats.ballsBowled, stats.wickets)

  return stats
}

/**
 * Format bowling average for display
 */
export function formatBowlingAverage(average: number | null): string {
  if (average === null) return '—'
  return average.toFixed(2)
}

/**
 * Format overs for display (x.y format)
 */
export function formatOvers(balls: number): string {
  return ballsToOvers(balls)
}

