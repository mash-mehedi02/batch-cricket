/**
 * Production-Ready Win Prediction Engine
 * Deterministic, smooth, and cricket-realistic probability model.
 */

export interface WinProbabilityInput {
  currentRuns: number
  wickets: number
  legalBalls: number
  target?: number | null
  oversLimit: number
  battingTeamSide: 'teamA' | 'teamB'
  lastBallEvent?: string | number
  tossWinner?: string
  isFinishedMatch?: boolean
}

export interface WinProbabilityOutput {
  teamAWinProb: number
  teamBWinProb: number
  explanation: string
  battingWinProb: number
  bowlingWinProb: number
  defendingTeamWinProb: number
  chasingTeamWinProb: number
  recommendedBowler?: {
    playerId: string
    reason: string
  }
}

/**
 * Calculate win probability using the deterministic 3-layer system:
 * 1. Base Probability
 * 2. Match Pressure Engine (Logistic Curve)
 * 3. Ball Impact Adjustment
 */
export function calculateWinProbability(input: WinProbabilityInput): WinProbabilityOutput {
  const {
    currentRuns,
    wickets,
    legalBalls,
    target, // this target is a number (e.g. 150)
    oversLimit,
    battingTeamSide,
    lastBallEvent,
    isFinishedMatch
  } = input

  const maxBalls = oversLimit * 6
  const isChasing = target && target > 0

  // --- LAYER 1: BASE PROBABILITY (50%) ---
  let battingWinPercent = 50

  if (!isChasing) {
    // --- FIRST INNINGS LOGIC ---
    // In first innings, win prob is based on the projected total vs a benchmark
    const wicketsRemaining = 10 - wickets
    const ballsRemaining = maxBalls - legalBalls

    // Simple but effective: Projected total = current + (balls/6 * 8.0 * wicketFactor)
    const projectedTotal = currentRuns + (ballsRemaining / 6) * (CRR_BENCHMARK * (0.5 + (wicketsRemaining / 20)))

    // Benchmark for a "good" total in school/amateur cricket seems to be high
    const benchmarkTotal = oversLimit * 8.5

    battingWinPercent = 50 + (projectedTotal - benchmarkTotal) / 2
    battingWinPercent = Math.max(10, Math.min(90, battingWinPercent))
  } else {
    // --- SECOND INNINGS LOGIC (THE BRAIN) ---
    const R = Math.max(0, target - currentRuns)
    const B = Math.max(0, maxBalls - legalBalls)
    const W = Math.max(0, 10 - wickets)

    // 1. Immediate results
    if (R <= 0) battingWinPercent = 100
    else if (B <= 0 || W <= 0) battingWinPercent = 0
    else {
      // 2. Resource-based Expected Score
      // CRR provides a hint of the team's momentum
      const CRR = legalBalls > 0 ? (currentRuns / legalBalls) * 6 : 8.0

      // Expected Rate (How fast they are likely to go from here)
      // It's a blend of their current form (CRR) and their resources (Wickets)
      const resourceFactor = (W / 10) // 0.1 to 1.0
      const likelyRPO = (CRR * 0.6) + (CRR_BENCHMARK * 0.4) + (resourceFactor - 0.5) * 4

      const expectedRuns = (B / 6) * likelyRPO
      const margin = expectedRuns - R

      // 3. Logistic Curve for Winning Probability
      // k (sensitivity) increases as match balls decrease
      const k = 0.1 + (0.7 * (maxBalls - B) / maxBalls)

      battingWinPercent = (1 / (1 + Math.exp(-k * margin))) * 100

      // 4. Specialized Protection for ultra-low requirements
      if (R <= B && W >= 3) {
        const ratio = R / B // e.g. 2/4 = 0.5
        if (ratio < 0.8) {
          // If they need less than 0.8 runs per ball, they are very likely to win
          const boost = (0.8 - ratio) * 100 // (0.8 - 0.5) * 100 = 30
          battingWinPercent = Math.max(battingWinPercent, 60 + boost) // 60 + 30 = 90%
        }
      }

      // Secondary absolute protection: 2 needed in 4 balls is basically a win
      if (R <= 3 && B >= 4 && W >= 5) {
        battingWinPercent = Math.max(battingWinPercent, 95)
      }

      // 5. Hard Clamp for impossible miracle zones
      const RRR = (R / (B / 6))
      if (RRR > 24 && B < 12) battingWinPercent = Math.min(battingWinPercent, 2)
      if (RRR > 36) battingWinPercent = 0.1
    }
  }

  // --- LAYER 3: BALL IMPACT ADJUSTMENT ---
  if (lastBallEvent !== undefined && !isFinishedMatch) {
    const event = String(lastBallEvent).toLowerCase()
    if (event === '4') battingWinPercent += 2
    else if (event === '6') battingWinPercent += 4
    else if (event === 'w' || event.includes('out') || event.includes('wick')) battingWinPercent -= 8
  }

  battingWinPercent = Math.max(0, Math.min(100, battingWinPercent))
  const bowlingWinPercent = 100 - battingWinPercent

  return {
    teamAWinProb: Math.round(battingTeamSide === 'teamA' ? battingWinPercent : bowlingWinPercent),
    teamBWinProb: Math.round(battingTeamSide === 'teamB' ? battingWinPercent : bowlingWinPercent),
    battingWinProb: Math.round(battingWinPercent),
    bowlingWinProb: Math.round(bowlingWinPercent),
    defendingTeamWinProb: Math.round(isChasing ? bowlingWinPercent : battingWinPercent),
    chasingTeamWinProb: Math.round(isChasing ? battingWinPercent : bowlingWinPercent),
    explanation: battingWinPercent > 70 ? 'Batting side in command.' : (battingWinPercent < 30 ? 'Bowlers dominating the game.' : 'Match is evenly poised.')
  }
}

const CRR_BENCHMARK = 8.5 // Average RPO in this tournament/type

/**
 * Calculate projected score (Deterministic)
 */
export function calculateProjectedScores(
  currentRuns: number,
  currentOvers: number,
  currentRunRate: number,
  oversLimit: number
): Array<{ overs: number; projectedScore: number }> {
  const intervals = [10, 15, 20].filter(ov => ov > currentOvers && ov <= oversLimit)
  if (intervals.length === 0 && oversLimit > currentOvers) intervals.push(oversLimit)

  return intervals.map(overs => {
    const remaining = overs - currentOvers
    return {
      overs,
      projectedScore: Math.round(currentRuns + (currentRunRate * remaining))
    }
  })
}
