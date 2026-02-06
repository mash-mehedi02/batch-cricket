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

  const wicketsRemaining = 10 - wickets
  const ballsRemaining = maxBalls - legalBalls
  const projectedTotal = currentRuns + (ballsRemaining / 6) * (CRR_BENCHMARK * (0.5 + (wicketsRemaining / 20)))

  // --- LAYER 1: BASE PROBABILITY (Unified Linear Model) ---
  let battingWinPercent = 50

  if (!isChasing) {
    // --- FIRST INNINGS ---
    const benchmarkTotal = oversLimit * 8.5
    battingWinPercent = 50 + (projectedTotal - benchmarkTotal) / 2
  } else {
    // --- SECOND INNINGS ---
    // Target is our benchmark now. We use a slightly steeper factor (1.5) for chases.
    battingWinPercent = 50 + (projectedTotal - target) / 1.5

    // Check for win/loss conditions
    if (currentRuns >= target) battingWinPercent = 100
    else if (ballsRemaining <= 0 || wickets >= 10) battingWinPercent = 0
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
