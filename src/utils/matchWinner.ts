/**
 * Match Winner Calculation Utility
 * Follows proper ICC cricket rules for determining match winners
 * 
 * CRICKET RULES:
 * 1. Team batting SECOND and wins → "won by X wickets" (wickets remaining)
 * 2. Team batting FIRST and wins → "won by X runs" (run difference)
 * 3. Equal scores → "Match Tied"
 */

import { InningsStats } from '@/types'

export interface MatchWinnerResult {
  winner: string // Team name or "Match Tied"
  winMargin: string // "by 5 wickets" or "by 45 runs" or ""
  isTied: boolean
}

/**
 * Calculate match winner with proper cricket rules
 * 
 * @param teamAName - Name of Team A
 * @param teamBName - Name of Team B
 * @param teamAInnings - Team A innings statistics
 * @param teamBInnings - Team B innings statistics
 * @returns Match winner result with proper margin calculation
 */
export function calculateMatchWinner(
  teamAName: string,
  teamBName: string,
  teamAInnings: InningsStats | null,
  teamBInnings: InningsStats | null
): MatchWinnerResult {
  // Default result
  const defaultResult: MatchWinnerResult = {
    winner: '',
    winMargin: '',
    isTied: false
  }

  // Validation
  if (!teamAInnings || !teamBInnings) {
    return defaultResult
  }

  const teamARuns = teamAInnings.totalRuns
  const teamBRuns = teamBInnings.totalRuns

  // Match Tied
  if (teamARuns === teamBRuns) {
    return {
      winner: 'Match Tied',
      winMargin: '',
      isTied: true
    }
  }

  // Team A wins
  if (teamARuns > teamBRuns) {
    const runDiff = teamARuns - teamBRuns

    // Check if Team A chased (batted second)
    // If target is set, they batted second and won by wickets
    if (teamAInnings.target && teamAInnings.target > 0) {
      const wicketsRemaining = 10 - teamAInnings.totalWickets
      return {
        winner: teamAName,
        winMargin: `by ${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''}`,
        isTied: false
      }
    } else {
      // Team A batted first and defended - won by runs
      return {
        winner: teamAName,
        winMargin: `by ${runDiff} run${runDiff !== 1 ? 's' : ''}`,
        isTied: false
      }
    }
  }

  // Team B wins
  if (teamBRuns > teamARuns) {
    const runDiff = teamBRuns - teamARuns

    // Check if Team B chased (batted second)
    if (teamBInnings.target && teamBInnings.target > 0) {
      const wicketsRemaining = 10 - teamBInnings.totalWickets
      return {
        winner: teamBName,
        winMargin: `by ${wicketsRemaining} wicket${wicketsRemaining !== 1 ? 's' : ''}`,
        isTied: false
      }
    } else {
      // Team B batted first and defended - won by runs
      return {
        winner: teamBName,
        winMargin: `by ${runDiff} run${runDiff !== 1 ? 's' : ''}`,
        isTied: false
      }
    }
  }

  return defaultResult
}

/**
 * Get match result string
 * @param teamAName - Name of Team A
 * @param teamBName - Name of Team B
 * @param teamAInnings - Team A innings statistics
 * @param teamBInnings - Team B innings statistics
 * @returns Full result string like "Team A won by 5 wickets" or "Match Tied"
 */
export function getMatchResultString(
  teamAName: string,
  teamBName: string,
  teamAInnings: InningsStats | null,
  teamBInnings: InningsStats | null
): string {
  const result = calculateMatchWinner(teamAName, teamBName, teamAInnings, teamBInnings)
  
  if (!result.winner) {
    return ''
  }

  if (result.isTied) {
    return 'Match Tied'
  }

  return `${result.winner} ${result.winMargin}`
}
