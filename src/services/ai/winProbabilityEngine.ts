/**
 * Win Probability Engine
 * Lightweight explainable model for calculating win probability
 * Based on current match state, resources, and ICC-derived trends
 */

export interface WinProbabilityInput {
  currentRuns: number
  wickets: number
  legalBalls: number
  target?: number | null
  oversLimit: number
  battingTeamSide: 'teamA' | 'teamB'
  batsmenForm?: Array<{ playerId: string; average: number; strikeRate: number }>
  remainingBowlers?: Array<{ playerId: string; economy: number; average: number }>
}

export interface WinProbabilityOutput {
  teamAWinProb: number
  teamBWinProb: number
  explanation: string
  recommendedBowler?: {
    playerId: string
    reason: string
  }
}

/**
 * Calculate win probability using dynamic resource-based model
 */
export function calculateWinProbability(input: WinProbabilityInput): WinProbabilityOutput {
  const {
    currentRuns,
    wickets,
    legalBalls,
    target,
    oversLimit,
  } = input

  const totalBalls = oversLimit * 6
  const remainingBalls = Math.max(totalBalls - legalBalls, 0)
  const ballsBowled = legalBalls
  const oversDecimal = ballsBowled / 6
  const currentRunRate = oversDecimal > 0 ? (currentRuns / (ballsBowled / 6)) : 0

  // 1. --- FIRST INNINGS LOGIC ---
  if (!target || target <= 0) {
    // Par score for Batch Cricket (School/Academy level) is usually around 7.5 - 8.0 RPO
    const parRPO = 7.5
    const parTotal = oversLimit * parRPO

    // Resource Remaining (Wickets = 60%, Balls = 40% weight)
    const wicketResource = Math.pow((10 - wickets) / 10, 0.7) // Curved to give more value to top wickets
    const ballResource = remainingBalls / totalBalls
    const totalResource = (wicketResource * 0.6) + (ballResource * 0.4)

    const projectedFinal = currentRuns + (parTotal * totalResource)

    // If they score more than par, batting team has > 50%
    let battingProb = 50 + ((projectedFinal - parTotal) / parTotal) * 100

    // Clamp
    battingProb = Math.max(10, Math.min(90, battingProb))

    // Penalize heavily for excessive wickets in early overs
    if (wickets > (legalBalls / 12) + 2) {
      battingProb -= (wickets * 3)
    }

    const bowlingProb = 100 - battingProb

    return {
      teamAWinProb: Math.round(input.battingTeamSide === 'teamA' ? battingProb : bowlingProb),
      teamBWinProb: Math.round(input.battingTeamSide === 'teamB' ? battingProb : bowlingProb),
      explanation: `Projected score and wickets in hand suggest ${battingProb > 50 ? 'batting' : 'bowling'} team has the upper hand.`,
    }
  }

  // 2. --- SECOND INNINGS LOGIC ---
  const runsNeeded = target - currentRuns
  const requiredRunRate = remainingBalls > 0 ? (runsNeeded / remainingBalls) * 6 : 0

  // Quick exit for finished states
  if (runsNeeded <= 0) return { teamAWinProb: input.battingTeamSide === 'teamA' ? 100 : 0, teamBWinProb: input.battingTeamSide === 'teamB' ? 100 : 0, explanation: 'Target achieved!' }
  if (wickets >= 10 || (remainingBalls <= 0 && runsNeeded > 0)) return { teamAWinProb: input.battingTeamSide === 'teamA' ? 0 : 100, teamBWinProb: input.battingTeamSide === 'teamB' ? 0 : 100, explanation: 'Innings complete.' }

  /**
   * Win Probability formula for 2nd innings (simplified WASP):
   * Base factor is RRR vs CRR.
   * Most critical factor is Wickets vs Runs Needed.
   */

  // A: Score factor (how many runs per wicket remaining?)
  const wicketsInHand = 10 - wickets
  const runsPerWicketNeeded = runsNeeded / (wicketsInHand || 1)

  // In T20, 15+ runs per wicket needed is "Hard", 25+ is "Critical"
  // We'll use this to create a base probability
  let chasingProb = 100 - (runsPerWicketNeeded * 3.5)

  // B: Required Run Rate factor
  const rrrPenalty = Math.max(0, (requiredRunRate - 7) * 8)
  chasingProb -= rrrPenalty

  // C: Balls Remaining Bonus
  const cushion = (remainingBalls / 6) * 2
  chasingProb += cushion

  // Weighting and Clamping
  chasingProb = Math.max(1, Math.min(99, chasingProb))

  // Final adjust: If RRR is massive (double CRR) and few wickets left, it's near zero.
  if (requiredRunRate > currentRuns / (oversDecimal || 1) * 2 && wickets >= 7) {
    chasingProb = Math.min(chasingProb, 15)
  }

  return {
    teamAWinProb: Math.round(input.battingTeamSide === 'teamA' ? chasingProb : 100 - chasingProb),
    teamBWinProb: Math.round(input.battingTeamSide === 'teamB' ? chasingProb : 100 - chasingProb),
    explanation: requiredRunRate > 10 ? 'High required rate putting pressure on chasing team.' : 'Chasing team is maintaining a steady pace.',
  }
}

/**
 * Calculate projected score at different over intervals
 */
export function calculateProjectedScores(
  currentRuns: number,
  currentOvers: number,
  currentRunRate: number,
  oversLimit: number
): Array<{ overs: number; projectedScore: number }> {
  const intervals = []

  if (oversLimit <= 20) {
    intervals.push(10, 15, 20)
  } else if (oversLimit <= 50) {
    intervals.push(20, 30, 40, 50)
  } else {
    intervals.push(20, 30, 40, 50, oversLimit)
  }

  return intervals
    .filter(ov => ov > currentOvers && ov <= oversLimit)
    .map(overs => {
      const remainingOvers = overs - currentOvers
      const projectedAdditionalRuns = currentRunRate * remainingOvers
      return {
        overs,
        projectedScore: Math.round(currentRuns + projectedAdditionalRuns),
      }
    })
}
