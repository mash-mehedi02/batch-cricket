/**
 * Production-Ready Win Prediction Engine
 * Deterministic, smooth, and cricket-realistic probability model.
 */

export interface WinPredictionInput {
  currentRuns: number
  wicketsLost: number
  legalBalls: number
  maxBalls: number
  target: number
  isChasing: boolean
  lastBallEvent?: string | number
  tossWinner?: string
  battingTeamId?: string
}

export interface WinPredictionResult {
  winProbability: number // 0-100%
  battingWin: number
  bowlingWin: number
  recommendation: string
}

/**
 * Calculate win probability using a deterministic 3-layer system:
 * 1. Base Probability (Start/Toss)
 * 2. Match Pressure Engine (RRR vs Wickets)
 * 3. Ball Impact Adjustment (Micro-changes)
 */
export function calculateWinProbability(input: WinPredictionInput): WinPredictionResult {
  const {
    currentRuns,
    wicketsLost,
    legalBalls,
    maxBalls,
    target,
    isChasing,
    lastBallEvent,
    tossWinner,
    battingTeamId
  } = input

  // Match NOT started or first innings (Simplified to 50/50 for first innings if no target)
  if (!isChasing || !target) {
    let winProb = 50
    // Toss advantage (max ±5%)
    if (tossWinner && battingTeamId) {
      winProb += (tossWinner === battingTeamId) ? 2 : -2
    }
    return {
      winProbability: winProb,
      battingWin: winProb,
      bowlingWin: 100 - winProb,
      recommendation: 'Match in early stages. Balanced contest.'
    }
  }

  // --- 1. DATA DERIVATION ---
  const R = Math.max(0, target - currentRuns)
  const B = Math.max(0, maxBalls - legalBalls)
  const W = Math.max(0, 10 - wicketsLost)

  const oversRemaining = B / 6

  const RRR = oversRemaining > 0 ? (R / oversRemaining) : (R > 0 ? 100 : 0)

  // --- 2. EXTREME CASES (Layer 6 & 7 Safety Rules) ---

  // Target Reached
  if (R <= 0) {
    return { winProbability: 100, battingWin: 100, bowlingWin: 0, recommendation: 'Target achieved!' }
  }

  // Impossible Case (R > max_possible_runs)
  const maxPossibleRuns = B * 6
  if (R > maxPossibleRuns) {
    return { winProbability: 0, battingWin: 0, bowlingWin: 100, recommendation: 'Impossible chase' }
  }

  // Barely Possible Case
  if (R === maxPossibleRuns && B > 0) {
    return { winProbability: 1, battingWin: 1, bowlingWin: 99, recommendation: 'Near impossible' }
  }

  // All Out
  if (W === 0) {
    return { winProbability: 0, battingWin: 0, bowlingWin: 100, recommendation: 'All out' }
  }

  // --- 3. PRESSURE ENGINE (Layer 3 & 4) ---

  // Logistic required run rate curve
  // pressure = RRR / 6
  const pressure = RRR / 6

  // base_win = 1 / (1 + e^(pressure - 1.2))
  // We center around 1.2 (which is RRR 7.2)
  const baseWin = 1 / (1 + Math.exp(pressure - 1.2))

  // Wicket Factor (Layer 4)
  // wicket_factor = W / 10
  const wicketFactor = W / 10

  // adjusted_win = base_win * wicket_factor
  let adjustedWin = baseWin * wicketFactor

  // --- 4. BALL IMPACT ADJUSTMENT (Layer 5) ---
  let ballAdjustment = 0
  if (lastBallEvent !== undefined) {
    const event = String(lastBallEvent)
    if (event === '0') ballAdjustment = -0.3
    else if (event === '1') ballAdjustment = 0
    else if (event === '2') ballAdjustment = 0.2
    else if (event === '3') ballAdjustment = 0.4
    else if (event === '4') ballAdjustment = 0.7
    else if (event === '6') ballAdjustment = 1.2
    else if (event.toLowerCase().includes('w') || event.toLowerCase().includes('out')) ballAdjustment = -3.0
  }

  // --- 5. FINAL CLAMP & PROTECTION (Layer 6) ---
  let finalBatWin = (adjustedWin * 100) + ballAdjustment

  // Protection: Equal fight
  // if R <= B*6 AND RRR <= 12: Batting% >= 5%
  if (R <= maxPossibleRuns && RRR <= 12 && finalBatWin < 5) {
    finalBatWin = 5
  }

  // Protection: Extreme pressure zone
  // if RRR >= 20 AND B <= 12: Batting ≈ 5–10%
  if (RRR >= 20 && B <= 12 && finalBatWin > 10) {
    finalBatWin = 10
  }

  // Final Clamp
  finalBatWin = Math.max(0, Math.min(100, finalBatWin))

  // Recommendation logic
  let recommendation = ''
  if (finalBatWin > 80) recommendation = 'Batting team in total control'
  else if (finalBatWin > 60) recommendation = 'Batting team has the edge'
  else if (finalBatWin > 40) recommendation = 'Balanced match - any team can win'
  else if (finalBatWin > 20) recommendation = 'Bowling team is dominant'
  else recommendation = 'Challenging road ahead for batters'

  return {
    winProbability: Math.round(finalBatWin * 10) / 10,
    battingWin: Math.round(finalBatWin * 10) / 10,
    bowlingWin: Math.round((100 - finalBatWin) * 10) / 10,
    recommendation
  }
}
