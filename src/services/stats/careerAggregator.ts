/**
 * Career Statistics Aggregator
 * Calculates overall career statistics from all matches
 */

import { calculateBattingStats, BattingMatchSummary } from './battingCalculator'
import { calculateBowlingStats, BowlingMatchSummary } from './bowlingCalculator'
import { countMatches, MatchData } from './matchCounter'
import { MatchContext } from './battingCalculator'

export interface CareerStats {
  matches: number
  batting: ReturnType<typeof calculateBattingStats>
  bowling: ReturnType<typeof calculateBowlingStats>
  wins: number
  losses: number
  ties: number
  winPercentage: number
}

export interface MatchWithSummary {
  match: MatchData
  battingSummary?: BattingMatchSummary
  bowlingSummary?: BowlingMatchSummary
  matchContext?: MatchContext
  result?: 'Won' | 'Lost' | 'Tied'
}

/**
 * Calculate overall career statistics
 */
export function calculateCareerStats(
  matchesWithSummaries: MatchWithSummary[],
  playerId: string
): CareerStats {
  const stats: CareerStats = {
    matches: 0,
    batting: calculateBattingStats([]),
    bowling: calculateBowlingStats([]),
    wins: 0,
    losses: 0,
    ties: 0,
    winPercentage: 0,
  }

  if (!matchesWithSummaries || !Array.isArray(matchesWithSummaries)) {
    return stats
  }

  // Extract all summaries
  const battingSummaries: BattingMatchSummary[] = []
  const bowlingSummaries: BowlingMatchSummary[] = []
  const matchContexts: MatchContext[] = []
  const matches: MatchData[] = []

  matchesWithSummaries.forEach((item) => {
    if (item.match) {
      matches.push(item.match)
    }
    if (item.battingSummary) {
      battingSummaries.push(item.battingSummary)
      matchContexts.push(item.matchContext || {})
    }
    if (item.bowlingSummary) {
      bowlingSummaries.push(item.bowlingSummary)
    }

    // Count match results
    if (item.result === 'Won') stats.wins += 1
    if (item.result === 'Lost') stats.losses += 1
    if (item.result === 'Tied') stats.ties += 1
  })

  // Calculate stats
  stats.matches = countMatches(matches, playerId)
  stats.batting = calculateBattingStats(battingSummaries, matchContexts)
  stats.bowling = calculateBowlingStats(bowlingSummaries)

  // Calculate win percentage
  const totalMatches = stats.wins + stats.losses + stats.ties
  if (totalMatches > 0) {
    stats.winPercentage = (stats.wins / totalMatches) * 100
  }

  return stats
}

/**
 * Round number to specified decimal places
 */
export function roundTo(value: number, digits: number = 2): number {
  if (!Number.isFinite(value)) return 0
  return Number(value.toFixed(digits))
}

