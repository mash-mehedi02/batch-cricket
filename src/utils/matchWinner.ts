import { InningsStats, Match } from '@/types'

export interface MatchWinnerResult {
  winner: string // Team name or "Match Tied"
  winMargin: string // "by 5 wickets" or "by 45 runs" or ""
  isTied: boolean
}

/**
 * Calculate match winner with proper cricket rules, supporting Super Overs
 */
export function calculateMatchWinner(
  teamAName: string,
  teamBName: string,
  teamAInnings: InningsStats | null,
  teamBInnings: InningsStats | null,
  match?: Match,
  teamASuperInnings?: InningsStats | null,
  teamBSuperInnings?: InningsStats | null
): MatchWinnerResult {
  const defaultResult: MatchWinnerResult = {
    winner: '',
    winMargin: '',
    isTied: false
  }

  if (!teamAInnings || !teamBInnings) return defaultResult

  // Calculate winner if match is finished OR in a tied state (for preview in admin panel)
  const status = String(match?.status || '').toLowerCase()
  const matchPhase = String((match as any)?.matchPhase || '').toLowerCase()
  const isTiedPhase = matchPhase === 'tied'
  if (status !== 'finished' && status !== 'completed' && !isTiedPhase && match) return defaultResult

  const aRuns = Number(teamAInnings.totalRuns || 0)
  const bRuns = Number(teamBInnings.totalRuns || 0)

  // --- Super Over Logic ---
  const isMainTied = aRuns === bRuns
  const hasSOData = (teamASuperInnings && (teamASuperInnings.totalRuns || 0) > 0) || (teamBSuperInnings && (teamBSuperInnings.totalRuns || 0) > 0)

  if (isMainTied && hasSOData) {
    const soARuns = Number(teamASuperInnings?.totalRuns || 0)
    const soBRuns = Number(teamBSuperInnings?.totalRuns || 0)

    if (soARuns === soBRuns) {
      return { winner: 'Match Tied', winMargin: '(After Super Over)', isTied: true }
    }

    const winnerSide = soARuns > soBRuns ? 'teamA' : 'teamB'
    const winnerName = winnerSide === 'teamA' ? teamAName : teamBName
    const runDiff = Math.abs(soARuns - soBRuns)

    return {
      winner: winnerName,
      winMargin: `won Super Over by ${runDiff} run${runDiff !== 1 ? 's' : ''}`,
      isTied: false
    }
  }

  if (isMainTied) {
    return { winner: 'Match Tied', winMargin: '', isTied: true }
  }

  // Determine who batted first
  let battedFirst: 'teamA' | 'teamB' | null = null

  // Method 1: Check target
  if (teamAInnings.target && teamAInnings.target > 0) battedFirst = 'teamB'
  else if (teamBInnings.target && teamBInnings.target > 0) battedFirst = 'teamA'

  // Method 2: Check match toss/decision if available and target is missing
  if (!battedFirst && match) {
    const tossWinner = match.tossWinner
    const electedTo = match.electedTo || (match as any).tossDecision
    if (tossWinner && electedTo) {
      if (tossWinner === 'teamA') {
        battedFirst = (electedTo === 'bat') ? 'teamA' : 'teamB'
      } else {
        battedFirst = (electedTo === 'bat') ? 'teamB' : 'teamA'
      }
    }
  }

  // Method 3: Fallback (Team A usually bats first in simple storage)
  if (!battedFirst) battedFirst = 'teamA'

  const winnerSide = aRuns > bRuns ? 'teamA' : 'teamB'
  const winnerName = winnerSide === 'teamA' ? teamAName : teamBName
  const winnerInnings = winnerSide === 'teamA' ? teamAInnings : teamBInnings

  const isChase = winnerSide !== battedFirst

  if (isChase) {
    const wktsLeft = Math.max(0, 10 - winnerInnings.totalWickets)
    return {
      winner: winnerName,
      winMargin: `won by ${wktsLeft} wicket${wktsLeft !== 1 ? 's' : ''}`,
      isTied: false
    }
  } else {
    const runDiff = Math.abs(aRuns - bRuns)
    return {
      winner: winnerName,
      winMargin: `won by ${runDiff} run${runDiff !== 1 ? 's' : ''}`,
      isTied: false
    }
  }
}

/**
 * Get match result string
 */
export function getMatchResultString(
  teamAName: string,
  teamBName: string,
  teamAInnings: InningsStats | null,
  teamBInnings: InningsStats | null,
  match?: Match,
  teamASuperInnings?: InningsStats | null,
  teamBSuperInnings?: InningsStats | null
): string {
  const result = calculateMatchWinner(teamAName, teamBName, teamAInnings, teamBInnings, match, teamASuperInnings, teamBSuperInnings)
  if (!result.winner) return ''
  if (result.isTied) return result.winner + (result.winMargin ? ` ${result.winMargin}` : '')
  return `${result.winner} ${result.winMargin}`
}
