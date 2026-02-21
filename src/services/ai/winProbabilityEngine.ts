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
    target,
    oversLimit,
    battingTeamSide,
    lastBallEvent,
    isFinishedMatch
  } = input

  const maxBalls = oversLimit * 6
  const wicketsRemaining = 10 - wickets
  const ballsRemaining = Math.max(0, maxBalls - legalBalls)
  const isChasing = !!(target && target > 0)

  // Tension factor: odds become more volatile as balls run out
  const tensionFactor = Math.pow(1 - (ballsRemaining / maxBalls), 1.5)

  let battingWinPercent = 50

  if (isFinishedMatch) {
    if (isChasing) {
      battingWinPercent = currentRuns >= (target || 0) ? 100 : 0
    } else {
      battingWinPercent = 50
    }
  } else if (!isChasing) {
    // --- ADVANCED FIRST INNINGS LOGIC ---
    const benchmarkRPO = CRR_BENCHMARK
    const currentRPO = legalBalls > 12 ? (currentRuns / (legalBalls / 6)) : benchmarkRPO

    // Resource Factor (Curran-inspired)
    // Wickets are more valuable at the start than the end
    const resourcesFactor = (Math.pow(wicketsRemaining / 10, 0.7) * 0.6) + 0.4

    // Projected Total using a weighted average of CRR and Benchmark
    const projectedRPO = (currentRPO * 0.3) + (benchmarkRPO * 0.7 * resourcesFactor)
    const projectedTotal = currentRuns + (ballsRemaining / 6) * projectedRPO

    // Compare projected total to a "Winning Par" (e.g. 1.2x Benchmark)
    const winPar = (benchmarkRPO * oversLimit) * 1.05
    const gap = projectedTotal - winPar

    battingWinPercent = 100 / (1 + Math.exp(-gap / 15))
  } else {
    // --- ADVANCED SECOND INNINGS LOGIC (Chase) ---
    const runsNeeded = (target || 0) - currentRuns

    if (runsNeeded <= 0) {
      battingWinPercent = 100
    } else if (ballsRemaining <= 0 || wicketsRemaining <= 0) {
      battingWinPercent = 0
    } else if (runsNeeded > ballsRemaining * 6) {
      battingWinPercent = 0
    } else {
      const rrr = (runsNeeded / ballsRemaining) * 6

      // Resource-corrected capability
      const resourceCapacity = Math.pow(wicketsRemaining / 10, 0.8)
      const marketBaseRRR = 8.5 // Standard capability

      // Professional betting models use a logistic relationship between RRR and Balls
      // As balls decrease, even a small RRR increase impacts odds massively
      const capability = marketBaseRRR * (1 + (wicketsRemaining / 10 * 0.2)) * resourceCapacity

      let gap = (capability - rrr)

      // Scale gap based on match stage
      if (ballsRemaining < 18) {
        // Death Overs: Odds swing violently per run
        gap *= (6 / Math.sqrt(ballsRemaining + 1))
      } else {
        gap *= 3.5
      }

      battingWinPercent = 100 / (1 + Math.exp(-gap / 4))

      // Sharp correction for impossible/highly probable situations
      if (ballsRemaining <= 6) {
        const rpb = runsNeeded / ballsRemaining
        if (rpb > 4) battingWinPercent = Math.min(battingWinPercent, 3)
        if (rpb > 5) battingWinPercent = Math.min(battingWinPercent, 0.5)
        if (rpb < 0.5) battingWinPercent = Math.max(battingWinPercent, 98)
      }
    }
  }

  // --- MOMENTUM NUDGES (Micro-Impact) ---
  if (lastBallEvent !== undefined && !isFinishedMatch) {
    const event = String(lastBallEvent).toLowerCase()

    // Events move odds more as the match nears completion (Tension)
    const multiplier = 1 + (tensionFactor * 2.5)

    if (event.includes('6')) battingWinPercent += 4 * multiplier
    else if (event.includes('4')) battingWinPercent += 2 * multiplier
    else if (event.includes('w') || event.includes('out') || event.includes('wick')) {
      // Wicket impact is massive in close games
      battingWinPercent -= (isChasing ? 15 : 8) * multiplier
    } else if (event === '0' || event === '.') {
      if (isChasing) battingWinPercent -= 1.5 * multiplier
    }
  }

  battingWinPercent = Math.max(0.1, Math.min(99.9, battingWinPercent))
  const bowlingWinPercent = 100 - battingWinPercent

  return {
    teamAWinProb: Math.round(battingTeamSide === 'teamA' ? battingWinPercent : bowlingWinPercent),
    teamBWinProb: Math.round(battingTeamSide === 'teamB' ? battingWinPercent : bowlingWinPercent),
    battingWinProb: Math.round(battingWinPercent),
    bowlingWinProb: Math.round(bowlingWinPercent),
    defendingTeamWinProb: Math.round(isChasing ? bowlingWinPercent : battingWinPercent),
    chasingTeamWinProb: Math.round(isChasing ? battingWinPercent : bowlingWinPercent),
    explanation: getProbabilityExplanation(battingWinPercent)
  }
}

function getProbabilityExplanation(prob: number): string {
  if (prob >= 95) return 'Batting side has practically sealed the win.'
  if (prob >= 85) return 'Batting side is in a dominating position.'
  if (prob >= 70) return 'Batting side is looking strong.'
  if (prob >= 55) return 'Batting side has a slight edge.'
  if (prob >= 45) return 'The match is perfectly balanced.'
  if (prob >= 30) return 'Bowling side is pulling things back.'
  if (prob >= 15) return 'Bowling side is in control.'
  if (prob >= 5) return 'Bowlers have almost secured victory.'
  return 'Match is virtually over for the batting side.'
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
