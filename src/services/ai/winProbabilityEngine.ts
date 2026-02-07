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

  let battingWinPercent = 50

  if (isFinishedMatch) {
    if (isChasing) {
      battingWinPercent = currentRuns >= (target || 0) ? 100 : 0
    } else {
      battingWinPercent = 50 // Standard fallback
    }
  } else if (!isChasing) {
    // --- FIRST INNINGS LOGIC ---
    // Benchmark for a 'safe' total
    const benchmarkRPO = CRR_BENCHMARK
    const benchmarkTotal = oversLimit * benchmarkRPO

    // Projection based on current momentum and resources
    // Wicket penalty: Each wicket lost reducs the projected potential
    const resourcesFactor = (wicketsRemaining / 10) * 0.5 + 0.5 // range 0.5 to 1.0
    const currentRPO = legalBalls > 12 ? (currentRuns / (legalBalls / 6)) : benchmarkRPO
    const projectedRPO = (currentRPO * 0.4) + (benchmarkRPO * 0.6 * resourcesFactor)
    const projectedTotal = currentRuns + (ballsRemaining / 6) * projectedRPO

    // Logistic gap comparison
    const gap = projectedTotal - benchmarkTotal
    battingWinPercent = 100 / (1 + Math.exp(-gap / 12)) // Smooth S-curve
  } else {
    // --- SECOND INNINGS LOGIC (Chase) ---
    const runsNeeded = (target || 0) - currentRuns

    if (runsNeeded <= 0) {
      battingWinPercent = 100
    } else if (ballsRemaining <= 0 || wicketsRemaining <= 0) {
      battingWinPercent = 0
    } else if (runsNeeded > ballsRemaining * 6) {
      battingWinPercent = 0
    } else {
      const rrr = (runsNeeded / ballsRemaining) * 6

      // Calculate "Pressure Index"
      // As balls run out, RRR becomes critical.
      const ballsFactor = Math.max(0.1, ballsRemaining / maxBalls)

      // Resource-corrected RRR: How many runs can we actually make?
      // A team 8 down can rarely chase at 12 RPO.
      const capabilityFactor = (wicketsRemaining / 10) * (1 - (0.2 * (1 - ballsFactor)))

      // The "Gap" is how much the required effort exceeds average capability
      // Negative gap means bowling side is favored
      let gap = 0

      if (ballsRemaining < 12) {
        // High-tension final overs: RPB based logistic gap
        const runsPerBallNeeded = runsNeeded / ballsRemaining
        // Every 0.5 runs per ball deviation from the '2.0 RPB' balanced state 
        // significantly shifts the odds.
        gap = (2.0 - runsPerBallNeeded) * 7

        // Wicket pressure in death: huge penalty if few wickets left
        if (wicketsRemaining <= 2) gap -= 10
        else if (wicketsRemaining <= 4) gap -= 4
      } else {
        // Standard chase logic
        const rrrBase = 8.5
        const currentMomentum = (currentRuns / (legalBalls / 6)) || rrrBase
        const projectedCapability = (rrrBase * 0.7 + currentMomentum * 0.3) * capabilityFactor * 1.15
        gap = (projectedCapability - rrr) * 4
      }

      battingWinPercent = 100 / (1 + Math.exp(-gap / 4))

      // Final sanity checks for extreme chasing scenarios
      if (ballsRemaining <= 6) {
        if (runsNeeded > (ballsRemaining * 6)) battingWinPercent = 0
        else if (runsNeeded > (ballsRemaining * 4) && wicketsRemaining < 2) battingWinPercent = Math.min(battingWinPercent, 1)
      }
    }
  }

  // --- LAYER 3: BALL IMPACT ADJUSTMENT (Momentum nudges) ---
  if (lastBallEvent !== undefined && !isFinishedMatch) {
    const event = String(lastBallEvent).toLowerCase()
    const impactScale = ballsRemaining < 12 ? 1.5 : 1 // Events move odds more at the end

    if (event.includes('6')) battingWinPercent += 3.5 * impactScale
    else if (event.includes('4')) battingWinPercent += 1.5 * impactScale
    else if (event.includes('wd') || event.includes('wide')) battingWinPercent += 2.5 * impactScale
    else if (event.includes('nb') || event.includes('no-ball')) battingWinPercent += 4.5 * impactScale
    else if (event.includes('w') || event.includes('out') || event.includes('wick')) battingWinPercent -= 12 * impactScale
  }

  battingWinPercent = Math.max(0, Math.min(100, battingWinPercent))
  const bowlingWinPercent = 100 - battingWinPercent

  // Determine explanation
  let explanation = 'Match is evenly poised.'
  if (battingWinPercent > 90) explanation = 'Batting side has practically sealed the win.'
  else if (battingWinPercent > 75) explanation = 'Batting side is in a very strong position.'
  else if (battingWinPercent > 60) explanation = 'Batting side has the upper hand.'
  else if (battingWinPercent < 10) explanation = 'Bowlers have almost secured the victory.'
  else if (battingWinPercent < 25) explanation = 'Bowling side is dominating the proceedings.'
  else if (battingWinPercent < 40) explanation = 'Bowling side currently in control.'

  return {
    teamAWinProb: Math.round(battingTeamSide === 'teamA' ? battingWinPercent : bowlingWinPercent),
    teamBWinProb: Math.round(battingTeamSide === 'teamB' ? battingWinPercent : bowlingWinPercent),
    battingWinProb: Math.round(battingWinPercent),
    bowlingWinProb: Math.round(bowlingWinPercent),
    defendingTeamWinProb: Math.round(isChasing ? bowlingWinPercent : battingWinPercent),
    chasingTeamWinProb: Math.round(isChasing ? battingWinPercent : bowlingWinPercent),
    explanation
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
