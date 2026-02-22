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
  partnershipRuns?: number
  partnershipBalls?: number
  recentOvers?: any[]
  firstInningsStageScore?: { runs: number, wickets: number } // Match at same balls in 1st innings
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
 * Professional Betting-Style Win Prediction Engine
 * Focuses on Resources (Balls x Wickets) vs Required Intensity (RRR)
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
    isFinishedMatch,
    partnershipRuns,
    partnershipBalls,
    recentOvers,
    firstInningsStageScore
  } = input

  const maxBalls = oversLimit * 6
  const wicketsRemaining = 10 - wickets
  const ballsRemaining = Math.max(0, maxBalls - legalBalls)
  const isChasing = !!(target && target > 0)

  // Stage calculation (how far into the match)
  const progressRatio = legalBalls / maxBalls

  let battingWinPercent = 50

  if (isFinishedMatch) {
    if (isChasing) {
      battingWinPercent = currentRuns >= (target || 0) ? 100 : 0
    } else {
      battingWinPercent = 50
    }
  } else if (!isChasing) {
    // --- FIRST INNINGS LOGIC ---
    const currentCRR = legalBalls > 12 ? (currentRuns / (legalBalls / 6)) : 8.5
    // Defensive weighting: early wickets hurt more
    const wicketImpact = Math.pow(wicketsRemaining / 10, 0.8)
    const projectedTotal = currentRuns + (ballsRemaining / 6) * currentCRR * (0.7 + 0.3 * wicketImpact)

    // Gap vs Standard Par (170 for 20 overs)
    const standardPar = 8.5 * oversLimit
    const gap = projectedTotal - standardPar
    battingWinPercent = 100 / (1 + Math.exp(-gap / 15))
  } else {
    // --- SECOND INNINGS LOGIC (THE CHASE) ---
    const runsNeeded = (target || 0) - currentRuns
    const rrr = ballsRemaining > 0 ? (runsNeeded / ballsRemaining) * 6 : 100
    const crr = legalBalls > 0 ? (currentRuns / (legalBalls / 6)) : 0

    // 1. BASE CAPABILITY (How fast can they score?)
    // Betting sites use a variable capability: 10 wickets = high, 1 wicket = low
    // Base capability for a modern team is around 9.5 RPO in T20
    const baseCapability = 9.5
    const resourceFactor = Math.pow(wicketsRemaining / 10, 0.85) * (1 + (ballsRemaining / maxBalls) * 0.15)
    const teamCapability = baseCapability * resourceFactor

    // 2. LOGISTIC GAP CALCULATION plus Momentum & Partnership
    // gap = capability - rrr
    let gap = (teamCapability - rrr)

    // Momentum Adjustment: Recent RPO
    if (recentOvers && recentOvers.length > 0) {
      const lastOverRuns = recentOvers[recentOvers.length - 1]?.totalRuns || 0
      if (lastOverRuns > 12) gap += 0.5
      else if (lastOverRuns < 3) gap -= 0.5
    }

    // 3. PRESSURE MULTIPLIER (Volatility increases at the death)
    // multiplier = 2.5 (start) to 12.5 (end)
    const multiplier = 2.5 + (Math.pow(progressRatio, 2) * 10)

    battingWinPercent = 100 / (1 + Math.exp(-gap * (multiplier / 5)))

    // --- CLUTCH FINISH OVERRIDE (CRITICAL FIX) ---
    // In the last over (or 2), logistic curves become unreliable for tiny run counts.
    if (ballsRemaining <= 12 && runsNeeded <= 12) {
      // If needing 1 run in 1 ball, it's roughly a 50-60% chance (considering dots/wickets vs runs)
      // If needing 1 run in 6 balls, it's 95%+
      const runsPerBall = runsNeeded / ballsRemaining

      let clutchProb = 50 // Base for 1 rpb

      if (runsPerBall < 1) clutchProb = 100 - (runsPerBall * 50)
      else clutchProb = 50 / runsPerBall

      // Adjust for wickets - if 9 down, penalty is heavy
      if (wicketsRemaining === 1) clutchProb -= 20
      else if (wicketsRemaining === 2) clutchProb -= 5

      // Blend the logistic result with the clutch math
      const weight = 1 - (ballsRemaining / 12) // Weight increases as balls decrease
      battingWinPercent = (battingWinPercent * (1 - weight)) + (clutchProb * weight)
    }

    // 4. "AT THIS STAGE" NUDGE
    // If they are ahead of the 1st innings score at this stage, they get a boost
    if (firstInningsStageScore) {
      const runsAhead = currentRuns - firstInningsStageScore.runs
      const comparisonNudge = Math.max(-10, Math.min(10, runsAhead / 2))
      battingWinPercent += comparisonNudge
    }

    // 5. HARD RECOVERIES / SAFETY
    if (runsNeeded === 1 && ballsRemaining >= 1 && wicketsRemaining > 1) {
      battingWinPercent = Math.max(battingWinPercent, 70) // If 1 run needed, it's always high unless 10th wicket
    }
    if (runsNeeded <= ballsRemaining && wicketsRemaining >= 3) {
      battingWinPercent = Math.max(battingWinPercent, 85)
    }

    // 6. IMPOSSIBILITY CLAMPS
    if (runsNeeded > ballsRemaining * 6) battingWinPercent = 0.1
    if (wicketsRemaining === 0) battingWinPercent = 0.1
  }

  // --- MOMENTUM & BALL IMPACT ---
  // Unlike earlier logic, we don't subtract flat 12% for a wicket if they only need 5 runs.
  if (lastBallEvent !== undefined && !isFinishedMatch) {
    const event = String(lastBallEvent).toLowerCase()

    if (event.includes('w') || event.includes('out')) {
      // Wicket impact is significant ONLY if the RRR is high or wickets are low
      const rrr = isChasing ? ((target || 0) - currentRuns) / (ballsRemaining / 6) : 0
      const wicketPain = (rrr > 8 || wicketsRemaining < 4) ? 15 : 5
      battingWinPercent -= wicketPain * (0.5 + progressRatio)
    } else if (event.includes('6')) {
      battingWinPercent += 6 * (0.5 + progressRatio)
    } else if (event.includes('4')) {
      battingWinPercent += 3 * (0.5 + progressRatio)
    }
  }

  // Final Smoothing & Clamp
  battingWinPercent = Math.max(0.5, Math.min(99.5, battingWinPercent))
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

const CRR_BENCHMARK = 8.5 // Exported for visibility but used internally as 8.5 in logic

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
