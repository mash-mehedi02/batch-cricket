/**
 * Win Probability Engine
 * Lightweight explainable model for calculating win probability
 * Based on current match state and ICC rules
 */

export interface WinProbabilityInput {
  currentRuns: number
  wickets: number
  legalBalls: number
  target?: number | null
  oversLimit: number
  batsmenForm?: Array<{ playerId: string; average: number; strikeRate: number }>
  remainingBowlers?: Array<{ playerId: string; economy: number; average: number }>
}

export interface WinProbabilityOutput {
  chasingTeamWinProb: number
  defendingTeamWinProb: number
  explanation: string
  recommendedBowler?: {
    playerId: string
    reason: string
  }
}

/**
 * Calculate win probability using lightweight model
 * Formula: w1*(battingPower) - w2*(RRR gap) - w3*(bowlingResistance) + w4*(wicketsFactor)
 */
export function calculateWinProbability(input: WinProbabilityInput): WinProbabilityOutput {
  const {
    currentRuns,
    wickets,
    legalBalls,
    target,
    oversLimit,
    batsmenForm = [],
    remainingBowlers = [],
  } = input

  // If no target, return 50/50 (first innings)
  if (!target || target <= 0) {
    return {
      chasingTeamWinProb: 50,
      defendingTeamWinProb: 50,
      explanation: 'First innings in progress. Win probability will be calculated during chase.',
    }
  }

  const oversLimitBalls = oversLimit * 6
  const remainingBalls = Math.max(oversLimitBalls - legalBalls, 0)
  const runsNeeded = target - currentRuns
  const oversDecimal = legalBalls / 6
  const currentRunRate = oversDecimal > 0 ? currentRuns / oversDecimal : 0
  const requiredRunRate = remainingBalls > 0 ? (runsNeeded / remainingBalls) * 6 : 0

  // If already won or lost
  if (runsNeeded <= 0) {
    return {
      chasingTeamWinProb: 100,
      defendingTeamWinProb: 0,
      explanation: 'Target achieved! Chasing team has won.',
    }
  }

  if (wickets >= 10 || remainingBalls <= 0) {
    return {
      chasingTeamWinProb: 0,
      defendingTeamWinProb: 100,
      explanation: 'All wickets down or overs completed. Defending team has won.',
    }
  }

  // Weight factors
  const w1 = 0.3 // Batting power weight
  const w2 = 0.25 // RRR gap weight
  const w3 = 0.25 // Bowling resistance weight
  const w4 = 0.2 // Wickets factor weight

  // 1. Batting Power (based on current run rate and remaining resources)
  const battingPower = Math.min(currentRunRate / 10, 1) * (1 - wickets / 10) * (remainingBalls / oversLimitBalls)
  const battingPowerScore = battingPower * 100

  // 2. RRR Gap (how far off required rate)
  const rrrGap = requiredRunRate > 0 ? Math.abs(currentRunRate - requiredRunRate) / requiredRunRate : 0
  const rrrGapScore = Math.max(0, 50 - (rrrGap * 50))

  // 3. Bowling Resistance (based on remaining bowlers)
  const avgBowlerEconomy = remainingBowlers.length > 0
    ? remainingBowlers.reduce((sum, b) => sum + b.economy, 0) / remainingBowlers.length
    : 7.0
  const bowlingResistance = Math.max(0, 1 - (avgBowlerEconomy / 15))
  const bowlingResistanceScore = bowlingResistance * 50

  // 4. Wickets Factor (more wickets = lower probability)
  const wicketsFactor = (10 - wickets) / 10
  const wicketsFactorScore = wicketsFactor * 50

  // Calculate final probability
  const chasingScore =
    w1 * battingPowerScore +
    w2 * rrrGapScore +
    w3 * bowlingResistanceScore +
    w4 * wicketsFactorScore

  // Normalize to 0-100
  const chasingTeamWinProb = Math.max(0, Math.min(100, chasingScore))
  const defendingTeamWinProb = 100 - chasingTeamWinProb

  // Generate explanation
  let explanation = ''
  if (chasingTeamWinProb > 70) {
    explanation = 'Chasing team is in a strong position. Current run rate is favorable and wickets in hand provide good support.'
  } else if (chasingTeamWinProb > 50) {
    explanation = 'Chasing team has a slight advantage. Maintaining current run rate should be sufficient.'
  } else if (chasingTeamWinProb > 30) {
    explanation = 'Match is evenly balanced. Chasing team needs to accelerate slightly to stay on track.'
  } else {
    explanation = 'Defending team is in a strong position. Chasing team needs to significantly increase run rate.'
  }

  // Recommend bowler (if defending)
  let recommendedBowler: { playerId: string; reason: string } | undefined
  if (remainingBowlers.length > 0) {
    const bestBowler = remainingBowlers.reduce((best, bowler) => {
      const bowlerScore = bowler.economy * 0.6 + bowler.average * 0.4
      const bestScore = best.economy * 0.6 + best.average * 0.4
      return bowlerScore < bestScore ? bowler : best
    })
    
    recommendedBowler = {
      playerId: bestBowler.playerId,
      reason: `Best economy (${bestBowler.economy.toFixed(2)}) and average (${bestBowler.average.toFixed(2)})`,
    }
  }

  return {
    chasingTeamWinProb: Math.round(chasingTeamWinProb),
    defendingTeamWinProb: Math.round(defendingTeamWinProb),
    explanation,
    recommendedBowler,
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
    // T20: show 10, 15, 20
    intervals.push(10, 15, 20)
  } else if (oversLimit <= 50) {
    // ODI: show 20, 30, 40, 50
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

