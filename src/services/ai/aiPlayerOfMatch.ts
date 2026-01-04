/**
 * AI Player of the Match Engine
 * 
 * Calculates weighted impact scores for all players in a match
 * and determines the Player of the Match (POTM) based on:
 * - Batting impact (runs, boundaries, strike rate)
 * - Bowling impact (wickets, maiden overs, economy)
 * - Fielding impact (catches, runouts)
 * 
 * Uses normalized scoring system for fair comparison across roles.
 * 
 * @module aiPlayerOfMatch
 */

export interface PlayerMatchStats {
  playerId: string
  playerName: string
  role?: string
  
  // Batting stats
  runs?: number
  balls?: number
  fours?: number
  sixes?: number
  strikeRate?: number
  notOut?: boolean
  
  // Bowling stats
  wickets?: number
  runsConceded?: number
  ballsBowled?: number
  maidenOvers?: number
  economy?: number
  
  // Fielding stats
  catches?: number
  runouts?: number
  stumpings?: number
}

export interface PotmResult {
  playerId: string
  playerName: string
  score: number
  reason: string
  breakdown: {
    battingImpact: number
    bowlingImpact: number
    fieldingImpact: number
  }
}

/**
 * Calculate batting impact score
 */
function calculateBattingImpact(stats: PlayerMatchStats): number {
  const runs = stats.runs || 0
  const balls = stats.balls || 0
  const fours = stats.fours || 0
  const sixes = stats.sixes || 0
  const strikeRate = stats.strikeRate || 0

  // Base runs impact (weighted by 1.2)
  const runsImpact = runs * 1.2

  // Boundary bonus (weighted by 1.5)
  const boundaryImpact = (fours * 1.5) + (sixes * 2.0)

  // Strike rate impact (normalized, divided by 20 for scaling)
  const strikeRateImpact = strikeRate > 0 ? strikeRate / 20 : 0

  // Not out bonus (10% boost)
  const notOutBonus = stats.notOut ? runs * 0.1 : 0

  // Milestone bonuses
  let milestoneBonus = 0
  if (runs >= 100) milestoneBonus += 20 // Century bonus
  else if (runs >= 50) milestoneBonus += 10 // Half-century bonus
  else if (runs >= 30) milestoneBonus += 5 // Good innings bonus

  return runsImpact + boundaryImpact + strikeRateImpact + notOutBonus + milestoneBonus
}

/**
 * Calculate bowling impact score
 */
function calculateBowlingImpact(stats: PlayerMatchStats): number {
  const wickets = stats.wickets || 0
  const runsConceded = stats.runsConceded || 0
  const ballsBowled = stats.ballsBowled || 0
  const maidenOvers = stats.maidenOvers || 0
  const economy = stats.economy || 0

  // Wickets impact (weighted by 25)
  const wicketsImpact = wickets * 25

  // Maiden overs bonus (weighted by 10)
  const maidenImpact = maidenOvers * 10

  // Economy factor (lower is better, normalized)
  // Excellent economy (< 6): +15, Good (< 8): +10, Average (< 10): +5
  let economyFactor = 0
  if (economy > 0) {
    if (economy < 6) economyFactor = 15
    else if (economy < 8) economyFactor = 10
    else if (economy < 10) economyFactor = 5
    else if (economy > 12) economyFactor = -5 // Penalty for expensive bowling
  }

  // Wicket milestones
  let wicketMilestoneBonus = 0
  if (wickets >= 5) wicketMilestoneBonus = 20 // 5-wicket haul
  else if (wickets >= 4) wicketMilestoneBonus = 10 // 4 wickets
  else if (wickets >= 3) wicketMilestoneBonus = 5 // 3 wickets

  // Strike rate bonus (wickets per over)
  const strikeRateBonus = wickets > 0 && ballsBowled > 0 
    ? (wickets / (ballsBowled / 6)) * 5 
    : 0

  return wicketsImpact + maidenImpact + economyFactor + wicketMilestoneBonus + strikeRateBonus
}

/**
 * Calculate fielding impact score
 */
function calculateFieldingImpact(stats: PlayerMatchStats): number {
  const catches = stats.catches || 0
  const runouts = stats.runouts || 0
  const stumpings = stats.stumpings || 0

  // Catches (weighted by 6)
  const catchesImpact = catches * 6

  // Runouts (weighted by 10, more impactful)
  const runoutsImpact = runouts * 10

  // Stumpings (weighted by 8)
  const stumpingsImpact = stumpings * 8

  return catchesImpact + runoutsImpact + stumpingsImpact
}

/**
 * Generate human-readable reason for POTM selection
 */
function generatePotmReason(
  playerName: string,
  breakdown: PotmResult['breakdown']
): string {
  const { battingImpact, bowlingImpact, fieldingImpact } = breakdown
  const total = battingImpact + bowlingImpact + fieldingImpact

  const reasons: string[] = []

  // Batting contribution
  if (battingImpact > 30) {
    if (battingImpact > 80) {
      reasons.push('outstanding batting performance')
    } else if (battingImpact > 50) {
      reasons.push('excellent batting display')
    } else {
      reasons.push('valuable batting contribution')
    }
  }

  // Bowling contribution
  if (bowlingImpact > 30) {
    if (bowlingImpact > 80) {
      reasons.push('exceptional bowling spell')
    } else if (bowlingImpact > 50) {
      reasons.push('brilliant bowling performance')
    } else {
      reasons.push('key bowling contribution')
    }
  }

  // Fielding contribution
  if (fieldingImpact > 15) {
    reasons.push('outstanding fielding effort')
  }

  // All-rounder
  if (battingImpact > 20 && bowlingImpact > 20) {
    reasons.push('all-round excellence')
  }

  // Default if no specific reason
  if (reasons.length === 0) {
    reasons.push('match-winning contribution')
  }

  return `${playerName} - ${reasons.join(' and ')}`
}

/**
 * Calculate Player of the Match
 * 
 * @param players - Array of player match statistics
 * @returns POTM result with player, score, and reason
 */
export function calculatePlayerOfMatch(
  players: PlayerMatchStats[]
): PotmResult | null {
  if (!players || players.length === 0) {
    return null
  }

  // Calculate impact scores for all players
  const playerScores = players.map((player) => {
    const battingImpact = calculateBattingImpact(player)
    const bowlingImpact = calculateBowlingImpact(player)
    const fieldingImpact = calculateFieldingImpact(player)

    const totalScore = battingImpact + bowlingImpact + fieldingImpact

    return {
      playerId: player.playerId,
      playerName: player.playerName,
      score: totalScore,
      breakdown: {
        battingImpact,
        bowlingImpact,
        fieldingImpact,
      },
    }
  })

  // Find player with highest score
  const potm = playerScores.reduce((prev, current) =>
    current.score > prev.score ? current : prev
  )

  // Generate reason
  const reason = generatePotmReason(potm.playerName, potm.breakdown)

  return {
    ...potm,
    reason,
  }
}

/**
 * Get top N players by impact score
 * 
 * @param players - Array of player match statistics
 * @param topN - Number of top players to return (default: 3)
 * @returns Array of top players sorted by score
 */
export function getTopPlayers(
  players: PlayerMatchStats[],
  topN: number = 3
): PotmResult[] {
  if (!players || players.length === 0) {
    return []
  }

  const playerScores = players.map((player) => {
    const battingImpact = calculateBattingImpact(player)
    const bowlingImpact = calculateBowlingImpact(player)
    const fieldingImpact = calculateFieldingImpact(player)

    return {
      playerId: player.playerId,
      playerName: player.playerName,
      score: battingImpact + bowlingImpact + fieldingImpact,
      breakdown: {
        battingImpact,
        bowlingImpact,
        fieldingImpact,
      },
      reason: generatePotmReason(player.playerName, {
        battingImpact,
        bowlingImpact,
        fieldingImpact,
      }),
    }
  })

  // Sort by score (descending) and return top N
  return playerScores
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}

/**
 * Normalize impact scores to 0-100 scale for display
 */
export function normalizeImpactScore(score: number, maxScore: number): number {
  if (maxScore === 0) return 0
  return Math.min(100, Math.round((score / maxScore) * 100))
}

