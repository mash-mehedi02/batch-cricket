/**
 * AI Player of the Match Engine
 * Deterministic scoring based on batting, bowling, and situational impact.
 */

export interface PlayerMatchStats {
  playerId: string
  playerName: string
  teamId: string

  // Batting stats
  runs: number
  balls: number
  fours: number
  sixes: number
  strikeRate: number

  // Bowling stats
  wickets: number
  runsConceded: number
  ballsBowled: number
  maidens: number
  economy: number

  // Situational (Optional)
  isWinningTeam?: boolean
  clutchPerformances?: number // Count of clutch moments
  matchTurningOvers?: number // Count of turning overs
}

export interface PotmResult {
  playerId: string
  playerName: string
  score: number
  reason: string
  breakdown: {
    battingImpact: number
    bowlingImpact: number
    fieldingImpact: number // Now used for bonuses/impact
  }
}

/**
 * Calculate Player of the Match score based on deterministic rules:
 * POTM_SCORE = (Runs * 1.2) + (SR * 0.3) + (Wickets * 25) + (EconomyBonus) + (MatchImpactBonus)
 */
export function calculatePlayerScore(stats: PlayerMatchStats) {
  const {
    runs,
    strikeRate,
    wickets,
    economy,
    ballsBowled,
    isWinningTeam,
    clutchPerformances = 0,
    matchTurningOvers = 0
  } = stats

  // 1. Batting Impact
  const battingImpact = (runs * 1.2) + (strikeRate * 0.3) + (runs >= 50 ? 10 : 0) + (runs >= 100 ? 20 : 0)

  // 2. Bowling Impact
  let bowlingImpact = (wickets * 25) + (wickets >= 3 ? 10 : 0) + (wickets >= 5 ? 20 : 0)
  if (ballsBowled >= 6) {
    if (economy <= 4.0) bowlingImpact += 15
    else if (economy <= 6.0) bowlingImpact += 10
    else if (economy <= 8.0) bowlingImpact += 5
    else if (economy > 12.0) bowlingImpact -= 10
  }

  // 3. Match Impact (Mapped to 'fieldingImpact' for UI consistency)
  let impactBonus = 0
  if (isWinningTeam) impactBonus += 20
  impactBonus += (clutchPerformances * 30)
  impactBonus += (matchTurningOvers * 40)

  const totalScore = Math.round((battingImpact + bowlingImpact + impactBonus) * 10) / 10

  return {
    totalScore,
    breakdown: {
      battingImpact: Math.round(battingImpact),
      bowlingImpact: Math.round(bowlingImpact),
      fieldingImpact: Math.round(impactBonus) // UI shows this as "Fielding" or we can rename if allowed
    }
  }
}

export function calculatePlayerOfMatch(
  players: PlayerMatchStats[],
  winningTeamId?: string
): PotmResult | null {
  if (!players || players.length === 0) return null

  // If winning team is specified, ONLY consider players from that team
  const filteredPlayers = winningTeamId
    ? players.filter(p => p.teamId === winningTeamId)
    : players;

  const finalPlayers = filteredPlayers.length > 0 ? filteredPlayers : players;

  const scoredPlayers = finalPlayers.map(p => {
    const isWin = winningTeamId ? p.teamId === winningTeamId : p.isWinningTeam
    const { totalScore, breakdown } = calculatePlayerScore({ ...p, isWinningTeam: isWin })

    let reason = ''
    if (p.runs > 30 && p.wickets > 0) reason = 'Outstanding all-round performance'
    else if (p.wickets >= 3) reason = `Brilliant spell of ${p.wickets} wickets`
    else if (p.runs >= 50) reason = `Masterful innings of ${p.runs} runs`
    else if (totalScore > 50) reason = 'Critical match-winning contribution'
    else reason = 'Impactful performance in the match'

    return {
      playerId: p.playerId,
      playerName: p.playerName,
      score: totalScore,
      reason,
      breakdown
    }
  })

  const sorted = scoredPlayers.sort((a, b) => b.score - a.score)
  return sorted[0] || null
}

export function getTopPlayers(
  players: PlayerMatchStats[],
  winningTeamId?: string,
  limit: number = 3
): PotmResult[] {
  if (!players) return []

  // If winning team is specified, prefer players from that team
  const filteredPlayers = winningTeamId
    ? players.filter(p => p.teamId === winningTeamId)
    : players;

  const finalPlayers = filteredPlayers.length > 0 ? filteredPlayers : players;

  const scoredPlayers = finalPlayers.map(p => {
    const isWin = winningTeamId ? p.teamId === winningTeamId : p.isWinningTeam
    const { totalScore, breakdown } = calculatePlayerScore({ ...p, isWinningTeam: isWin })

    let reason = ''
    if (p.runs > 30 && p.wickets > 0) reason = 'All-round excellence'
    else if (p.wickets >= 2) reason = `Influential ${p.wickets}-wicket haul`
    else if (p.runs >= 30) reason = `Vital contribution of ${p.runs} runs`
    else reason = 'Impactful performance'

    return {
      playerId: p.playerId,
      playerName: p.playerName,
      score: totalScore,
      reason,
      breakdown
    }
  })

  return scoredPlayers.sort((a, b) => b.score - a.score).slice(0, limit)
}
