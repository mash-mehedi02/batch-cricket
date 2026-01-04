/**
 * Season-by-Season Statistics Aggregator
 * Groups and calculates stats by year/season
 */

import { calculateBattingStats, BattingMatchSummary } from './battingCalculator'
import { calculateBowlingStats, BowlingMatchSummary } from './bowlingCalculator'
import { countMatches, MatchData } from './matchCounter'
import { MatchContext } from './battingCalculator'

export interface SeasonStats {
  year: number
  matches: number
  batting: ReturnType<typeof calculateBattingStats>
  bowling: ReturnType<typeof calculateBowlingStats>
}

export interface MatchWithSummary {
  match: MatchData
  battingSummary?: BattingMatchSummary
  bowlingSummary?: BowlingMatchSummary
  matchContext?: MatchContext
  year?: number
}

/**
 * Aggregate statistics by season/year
 */
export function aggregateBySeason(
  matchesWithSummaries: MatchWithSummary[],
  playerId: string
): Map<number, SeasonStats> {
  const seasonMap = new Map<number, SeasonStats>()

  if (!matchesWithSummaries || !Array.isArray(matchesWithSummaries)) {
    return seasonMap
  }

  // Group by year
  const yearGroups = new Map<number, MatchWithSummary[]>()
  
  matchesWithSummaries.forEach((item) => {
    const year = item.year || 
                 (item.match.year ? Number(item.match.year) : null) ||
                 new Date().getFullYear()
    
    if (!yearGroups.has(year)) {
      yearGroups.set(year, [])
    }
    yearGroups.get(year)!.push(item)
  })

  // Calculate stats for each season
  yearGroups.forEach((items, year) => {
    const battingSummaries = items
      .map((item) => item.battingSummary)
      .filter((s): s is BattingMatchSummary => s !== undefined)
    
    const bowlingSummaries = items
      .map((item) => item.bowlingSummary)
      .filter((s): s is BowlingMatchSummary => s !== undefined)
    
    const matchContexts = items
      .map((item) => item.matchContext)
      .filter((c): c is MatchContext => c !== undefined)
    
    const matches = items.map((item) => item.match)

    seasonMap.set(year, {
      year,
      matches: countMatches(matches, playerId),
      batting: calculateBattingStats(battingSummaries, matchContexts),
      bowling: calculateBowlingStats(bowlingSummaries),
    })
  })

  return seasonMap
}

/**
 * Get season stats as array sorted by year (newest first)
 */
export function getSeasonStatsArray(
  seasonMap: Map<number, SeasonStats>
): SeasonStats[] {
  return Array.from(seasonMap.values()).sort((a, b) => b.year - a.year)
}

