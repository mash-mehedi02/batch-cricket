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
  } = input

  const maxBalls = oversLimit * 6
  const wicketsRemaining = 10 - wickets
  const ballsRemaining = Math.max(0, maxBalls - legalBalls)
  const isChasing = !!(target && target > 0)

  // Stage calculation (how far into the match)
  const progressRatio = Math.min(1, legalBalls / maxBalls)

  // Base Win Probability
  let battingWinPercent = 50

  if (isFinishedMatch) {
    if (isChasing) {
      battingWinPercent = currentRuns >= (target || 0) ? 100 : 0
    } else {
      battingWinPercent = 50
    }
  } else if (!isChasing) {
    // --- FIRST INNINGS LOGIC ---
    // Reference CRR: 8.5 is par. 
    const currentCRR = legalBalls > 6 ? (currentRuns / (legalBalls / 6)) : 8.5

    // Resource Factor: How many wickets and balls are left
    const wicketFactor = Math.pow(wicketsRemaining / 10, 0.7)
    const ballsFactor = ballsRemaining / maxBalls

    // Projected score based on current pace vs ability to accelerate
    const accelerationPotential = 1.2 * wicketFactor * ballsFactor
    const expectedFinalRuns = currentRuns + (ballsRemaining / 6) * (currentCRR * 0.8 + 8.5 * 0.2 + accelerationPotential)

    // Compare to standard par for the format
    const formatPar = 8.5 * oversLimit
    const gap = expectedFinalRuns - formatPar

    // Logistic curve for 1st innings (SD = 18 runs)
    battingWinPercent = 100 / (1 + Math.exp(-gap / 18))
  } else {
    // --- SECOND INNINGS LOGIC (THE CHASE) ---
    const runsNeeded = (target || 0) - currentRuns
    const rrr = ballsRemaining > 0 ? (runsNeeded / ballsRemaining) * 6 : (runsNeeded > 0 ? 100 : 0)
    const crr = legalBalls > 0 ? (currentRuns / (legalBalls / 6)) : 0

    // 1. DYNAMIC CAPABILITY
    // Scales based on wickets remaining
    const resourceWeight = Math.pow(wicketsRemaining / 10, 0.8)
    const baseCapability = 9.8
    const teamCapability = baseCapability * resourceWeight

    // 2. GAP CALCULATION (Capability vs Requirement)
    const gap = teamCapability - rrr

    // 3. LOGISTIC SENSITIVITY (Alpha)
    // alpha increases as balls decrease
    const matchTypeFactor = Math.sqrt(oversLimit / 20)
    const alpha = (2.0 + (Math.pow(progressRatio, 1.5) * 8)) * matchTypeFactor

    battingWinPercent = 100 / (1 + Math.exp(-gap * (alpha / 5)))

    // 4. CLUTCH ZONE (Last 12 balls or < 15 runs needed)
    if (ballsRemaining <= 12 || runsNeeded <= 15) {
      const runRatePressure = rrr / 6 // runs per ball

      let situationalProb = 50
      if (runRatePressure <= 0.5) situationalProb = 95 - (runRatePressure * 20)
      else if (runRatePressure <= 1.5) situationalProb = 90 - (runRatePressure - 0.5) * 60
      else situationalProb = Math.max(5, 30 / runRatePressure)

      if (wicketsRemaining === 1) situationalProb *= 0.6
      else if (wicketsRemaining === 2) situationalProb *= 0.85

      const blendWeight = Math.pow(1 - (ballsRemaining / 12), 2)
      battingWinPercent = (battingWinPercent * (1 - blendWeight)) + (situationalProb * blendWeight)
    }

    // 5. SAFETY NETS
    if (runsNeeded <= 0) battingWinPercent = 100
    if (runsNeeded === 1 && ballsRemaining >= 2 && wicketsRemaining > 1) battingWinPercent = Math.max(battingWinPercent, 90)
  }

  // --- LAST BALL EVENT STABILIZATION ---
  if (lastBallEvent !== undefined && !isFinishedMatch) {
    const event = String(lastBallEvent).toLowerCase()

    if (event.includes('w') || event.includes('out')) {
      const impactScale = (1.1 - progressRatio) * (15 / (wicketsRemaining + 1))
      battingWinPercent -= Math.min(12, 5 * impactScale)
    } else if (event.includes('6')) {
      battingWinPercent += 2 * (1 - progressRatio)
    } else if (event.includes('4')) {
      battingWinPercent += 1 * (1 - progressRatio)
    }
  }

  // FINAL REFINEMENT
  const runsNeededFinal = (target || 0) - currentRuns
  if (isChasing && runsNeededFinal > ballsRemaining * 6) battingWinPercent = 0
  if (wicketsRemaining === 0) battingWinPercent = 0

  battingWinPercent = Math.max(1, Math.min(99, battingWinPercent))
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
