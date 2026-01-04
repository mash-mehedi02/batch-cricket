/**
 * Performance-Based Win Prediction Module
 * 
 * Calculates match win probability using:
 * - Current run rate vs required run rate gap
 * - Batting power (weighted form of top 6 batters)
 * - Bowling resistance (average economy of remaining bowlers)
 * - Wickets remaining factor
 * - Logistic function for probability output
 * 
 * Fast, explainable, and suitable for real-time updates.
 */

export interface WinPredictionInput {
  // Current match state
  currentRuns: number
  wicketsLost: number
  legalBalls: number
  oversCompleted: number
  maxBalls: number
  
  // Chase context
  target?: number
  isChasing: boolean
  
  // Batting power (top 6 batters recent form - last 5 innings weighted)
  battingPower: {
    striker: { runs: number; strikeRate: number; form: number } // form 0-100
    nonStriker: { runs: number; strikeRate: number; form: number }
    nextBatters: Array<{ runs: number; strikeRate: number; form: number }> // next 3-4 batters
  }
  
  // Bowling resistance
  bowlingResistance: number // 0-100 (weighted average economy of remaining bowlers)
  
  // Optional factors
  pitchFactor?: number // 0-100 (default 50 = neutral)
  opponentStrength?: number // 0-100 (default 50 = average)
}

export interface WinPredictionResult {
  winProbability: number // 0-100%
  factors: {
    battingPower: number
    rrrGap: number
    bowlingResistance: number
    wicketsFactor: number
    overallScore: number
  }
  recommendation: string
  confidence: number // 0-100
}

/**
 * Calculate win probability using logistic regression-style formula
 */
export function calculateWinProbability(input: WinPredictionInput): WinPredictionResult {
  const {
    currentRuns,
    wicketsLost,
    legalBalls,
    oversCompleted,
    maxBalls,
    target,
    isChasing,
    battingPower,
    bowlingResistance,
    pitchFactor = 50,
    opponentStrength = 50,
  } = input

  // 1. Calculate Current Run Rate (CRR)
  const oversDecimal = legalBalls / 6
  const currentRR = oversDecimal > 0 ? currentRuns / oversDecimal : 0

  // 2. Calculate Required Run Rate (RRR) if chasing
  let requiredRR = 0
  let rrrGap = 0
  if (isChasing && target) {
    const remainingBalls = maxBalls - legalBalls
    const runsNeeded = target - currentRuns
    
    if (remainingBalls > 0 && runsNeeded > 0) {
      requiredRR = (runsNeeded / remainingBalls) * 6
      rrrGap = requiredRR - currentRR
    } else if (runsNeeded <= 0) {
      // Target already reached
      return {
        winProbability: 100,
        factors: {
          battingPower: 100,
          rrrGap: 0,
          bowlingResistance: 0,
          wicketsFactor: 100,
          overallScore: 100,
        },
        recommendation: 'Target achieved! Strong position.',
        confidence: 100,
      }
    }
  }

  // 3. Calculate Batting Power (weighted sum of striker + non-striker + next batters)
  const strikerWeight = 0.35
  const nonStrikerWeight = 0.25
  const nextBattersWeight = 0.40 / Math.max(1, battingPower.nextBatters.length)
  
  const strikerScore = (battingPower.striker.runs / 100) * 30 + 
                       (battingPower.striker.strikeRate / 200) * 20 + 
                       (battingPower.striker.form / 100) * 50
  
  const nonStrikerScore = (battingPower.nonStriker.runs / 100) * 30 + 
                          (battingPower.nonStriker.strikeRate / 200) * 20 + 
                          (battingPower.nonStriker.form / 100) * 50
  
  const nextBattersScore = battingPower.nextBatters.reduce((sum, batter) => {
    const score = (batter.runs / 100) * 30 + 
                  (batter.strikeRate / 200) * 20 + 
                  (batter.form / 100) * 50
    return sum + score
  }, 0) / Math.max(1, battingPower.nextBatters.length)
  
  const battingPowerScore = (strikerScore * strikerWeight) + 
                            (nonStrikerScore * nonStrikerWeight) + 
                            (nextBattersScore * nextBattersWeight)
  
  // Normalize to 0-100
  const battingPowerNormalized = Math.max(0, Math.min(100, battingPowerScore))

  // 4. Calculate Wickets Factor (more wickets = lower probability)
  const wicketsRemaining = 10 - wicketsLost
  const wicketsFactor = (wicketsRemaining / 10) * 100

  // 5. Calculate Overall Score using logistic function
  // Formula: score = alpha1*battingPower - alpha2*RRRgap - alpha3*bowlingResistance + alpha4*wicketsFactor + alpha5*pitchFactor
  const alpha1 = 0.4  // Batting power weight
  const alpha2 = 0.25 // RRR gap weight (negative impact)
  const alpha3 = 0.15 // Bowling resistance weight (negative impact)
  const alpha4 = 0.15 // Wickets factor weight
  const alpha5 = 0.05 // Pitch factor weight
  
  // Normalize RRR gap (assume max gap is 10 runs per over)
  const rrrGapNormalized = Math.max(-100, Math.min(100, (rrrGap / 10) * 100))
  
  // Bowling resistance is already 0-100 (higher = stronger bowling = negative for batting team)
  const bowlingResistanceImpact = bowlingResistance
  
  // Calculate raw score
  const rawScore = (alpha1 * battingPowerNormalized) - 
                   (alpha2 * Math.abs(rrrGapNormalized)) - 
                   (alpha3 * bowlingResistanceImpact) + 
                   (alpha4 * wicketsFactor) + 
                   (alpha5 * (pitchFactor - 50)) // Center pitch factor around 0
  
  // 6. Apply sigmoid function to get probability (0-100%)
  // Sigmoid: P = 1 / (1 + e^(-x))
  // Scale to 0-100: P = 50 + (50 * tanh(x/50))
  const sigmoidScore = 50 + (50 * Math.tanh(rawScore / 50))
  const winProbability = Math.max(0, Math.min(100, sigmoidScore))

  // 7. Generate recommendation
  let recommendation = ''
  if (winProbability >= 75) {
    recommendation = 'Strong position — maintain current run rate and rotate strike'
  } else if (winProbability >= 60) {
    recommendation = 'Good position — focus on building partnership and minimizing dot balls'
  } else if (winProbability >= 45) {
    recommendation = 'Balanced match — RRR manageable, target wickets or accelerate carefully'
  } else if (winProbability >= 30) {
    recommendation = 'RRR critical — need to accelerate or target key wickets'
  } else {
    recommendation = 'Challenging position — aggressive batting or wicket-taking strategy needed'
  }

  // 8. Calculate confidence (based on data completeness)
  const hasBattingData = battingPower.striker.form > 0 && battingPower.nonStriker.form > 0
  const hasBowlingData = bowlingResistance > 0
  const confidence = (hasBattingData ? 50 : 30) + (hasBowlingData ? 30 : 20) + 20 // Base confidence

  return {
    winProbability: Math.round(winProbability * 10) / 10,
    factors: {
      battingPower: Math.round(battingPowerNormalized * 10) / 10,
      rrrGap: Math.round(rrrGap * 10) / 10,
      bowlingResistance: Math.round(bowlingResistanceImpact * 10) / 10,
      wicketsFactor: Math.round(wicketsFactor * 10) / 10,
      overallScore: Math.round(rawScore * 10) / 10,
    },
    recommendation,
    confidence: Math.min(100, Math.round(confidence)),
  }
}

/**
 * Get batting power from current match state and player history
 */
export function calculateBattingPower(
  striker: { runs: number; balls: number; recentForm?: number[] },
  nonStriker: { runs: number; balls: number; recentForm?: number[] },
  nextBatters: Array<{ runs: number; balls: number; recentForm?: number[] }>
): WinPredictionInput['battingPower'] {
  const calculateForm = (recentForm?: number[]): number => {
    if (!recentForm || recentForm.length === 0) return 50 // Neutral
    const avg = recentForm.reduce((sum, r) => sum + r, 0) / recentForm.length
    // Normalize: 0-20 runs = 0-40, 20-50 = 40-70, 50+ = 70-100
    if (avg >= 50) return 85
    if (avg >= 20) return 40 + ((avg - 20) / 30) * 30
    return (avg / 20) * 40
  }

  const strikerSR = striker.balls > 0 ? (striker.runs / striker.balls) * 100 : 100
  const nonStrikerSR = nonStriker.balls > 0 ? (nonStriker.runs / nonStriker.balls) * 100 : 100

  return {
    striker: {
      runs: striker.runs,
      strikeRate: strikerSR,
      form: calculateForm(striker.recentForm),
    },
    nonStriker: {
      runs: nonStriker.runs,
      strikeRate: nonStrikerSR,
      form: calculateForm(nonStriker.recentForm),
    },
    nextBatters: nextBatters.map((batter) => {
      const sr = batter.balls > 0 ? (batter.runs / batter.balls) * 100 : 100
      return {
        runs: batter.runs,
        strikeRate: sr,
        form: calculateForm(batter.recentForm),
      }
    }),
  }
}

/**
 * Calculate bowling resistance from remaining bowlers' economy
 */
export function calculateBowlingResistance(
  remainingBowlers: Array<{ economy: number; recentForm?: number[] }>
): number {
  if (!remainingBowlers || remainingBowlers.length === 0) return 50 // Average

  // Weight by recent form if available
  const weightedEconomies = remainingBowlers.map((bowler) => {
    const formWeight = bowler.recentForm && bowler.recentForm.length > 0
      ? Math.min(1.5, 1 + (bowler.recentForm.reduce((sum, w) => sum + w, 0) / bowler.recentForm.length) / 20)
      : 1.0
    return bowler.economy * formWeight
  })

  const avgEconomy = weightedEconomies.reduce((sum, e) => sum + e, 0) / weightedEconomies.length

  // Lower economy = stronger bowling = higher resistance
  // Normalize: economy 4-6 = 80-100, 6-8 = 60-80, 8-10 = 40-60, 10+ = 0-40
  let resistance = 100 - (avgEconomy - 4) * 10
  resistance = Math.max(0, Math.min(100, resistance))

  return Math.round(resistance)
}

