/**
 * Win Prediction Module
 * Calculates win probability based on current match state
 * Uses explainable function: score = w1*(battingPower) - w2*(RRR gap) - w3*(bowlingResistance) + w4*(wicketsFactor)
 */

/**
 * Calculate batting power from current batsmen
 * @param {Object} striker - Striker stats
 * @param {Object} nonStriker - Non-striker stats
 * @param {Array} nextBatters - Next batters in lineup
 * @returns {number} - Batting power score (0-100)
 */
export function calculateBattingPower(striker, nonStriker, nextBatters = []) {
  if (!striker && !nonStriker) return 50 // Neutral if no data
  
  const strikerSR = striker?.balls > 0 ? (striker.runs / striker.balls) * 100 : 0
  const nonStrikerSR = nonStriker?.balls > 0 ? (nonStriker.runs / nonStriker.balls) * 100 : 0
  
  // Average strike rate of current partnership
  const avgSR = strikerSR > 0 && nonStrikerSR > 0 
    ? (strikerSR + nonStrikerSR) / 2 
    : strikerSR || nonStrikerSR || 50
  
  // Normalize to 0-100 scale (assuming 200 SR = 100 power)
  const power = Math.min(100, (avgSR / 200) * 100)
  
  return power
}

/**
 * Calculate bowling resistance
 * @param {Array} bowlers - Array of bowler economy rates
 * @returns {number} - Bowling resistance score (0-100, higher = better bowling)
 */
export function calculateBowlingResistance(bowlers) {
  if (!bowlers || bowlers.length === 0) return 50 // Neutral
  
  const avgEconomy = bowlers.reduce((sum, b) => sum + (b.economy || 7.0), 0) / bowlers.length
  
  // Lower economy = higher resistance
  // Normalize: 3.0 economy = 100 resistance, 10.0 economy = 0 resistance
  const resistance = Math.max(0, Math.min(100, ((10.0 - avgEconomy) / 7.0) * 100))
  
  return resistance
}

/**
 * Calculate win probability
 * @param {Object} params - Match parameters
 * @param {number} params.currentRuns - Current runs scored
 * @param {number} params.wicketsLost - Wickets lost
 * @param {number} params.legalBalls - Legal balls bowled
 * @param {number} params.oversCompleted - Overs completed (as decimal)
 * @param {number} params.maxBalls - Maximum balls in innings
 * @param {number} params.target - Target runs (for chasing team)
 * @param {boolean} params.isChasing - Whether team is chasing
 * @param {number} params.battingPower - Batting power score
 * @param {number} params.bowlingResistance - Bowling resistance score
 * @returns {Object} - { pWin: number, reason: string, recommendedBowler: string }
 */
export function calculateWinProbability({
  currentRuns,
  wicketsLost,
  legalBalls,
  oversCompleted,
  maxBalls,
  target,
  isChasing,
  battingPower,
  bowlingResistance,
}) {
  if (!isChasing || !target) {
    // First innings or no target - return neutral
    return {
      pWin: 50,
      reason: 'First innings in progress',
      recommendedBowler: null,
    }
  }
  
  const remainingRuns = target - currentRuns
  const remainingBalls = maxBalls - legalBalls
  const requiredRR = remainingBalls > 0 ? (remainingRuns / remainingBalls) * 6 : 0
  const currentRR = oversCompleted > 0 ? (currentRuns / oversCompleted) : 0
  const rrrGap = requiredRR - currentRR
  
  // Calculate factors
  const w1 = 0.4 // Batting power weight
  const w2 = 0.3 // RRR gap weight
  const w3 = 0.2 // Bowling resistance weight
  const w4 = 0.1 // Wickets factor weight
  
  const battingFactor = battingPower / 100
  const rrrFactor = Math.max(-1, Math.min(1, -rrrGap / 5)) // Normalize RRR gap
  const bowlingFactor = bowlingResistance / 100
  const wicketsFactor = (10 - wicketsLost) / 10 // More wickets = better
  
  // Calculate score
  const score = (w1 * battingFactor) - (w2 * rrrFactor) - (w3 * bowlingFactor) + (w4 * wicketsFactor)
  
  // Apply sigmoid function to get probability
  const sigmoid = (x) => 1 / (1 + Math.exp(-x))
  const pWin = sigmoid(score * 2) * 100 // Scale for better sensitivity
  
  // Generate reason
  let reason = ''
  if (pWin > 70) {
    reason = 'Strong position - ahead of required rate'
  } else if (pWin > 50) {
    reason = 'Slightly ahead - maintain current rate'
  } else if (pWin > 30) {
    reason = 'Behind required rate - need acceleration'
  } else {
    reason = 'Difficult position - need quick runs'
  }
  
  return {
    pWin: Math.round(pWin),
    reason,
    recommendedBowler: null, // TODO: Implement bowler recommendation
  }
}

