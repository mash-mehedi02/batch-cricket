/**
 * AI Performance Prediction Module
 * 
 * Predicts player performance using statistical methods:
 * - Moving weighted average
 * - Exponential smoothing
 * - Recent 5-match form
 * - Opponent team's bowling strength
 * 
 * Uses lightweight algorithms suitable for real-time predictions.
 * No heavy ML models required - fast and scalable.
 * 
 * @module aiPrediction
 */

export interface PlayerHistory {
  runs?: number
  balls?: number
  wickets?: number
  runsConceded?: number
  ballsBowled?: number
  strikeRate?: number
  economy?: number
  opponentStrength?: number // 0-100 scale
  matchDate?: Date | string
}

export interface PredictionResult {
  predictedRuns: number
  predictedStrikeRate: number
  predictedWickets: number
  formRating: number // 0-100 scale
  confidence: number // 0-100 scale
  factors: {
    recentForm: number
    opponentStrength: number
    historicalAverage: number
  }
}

/**
 * Calculate moving weighted average
 * More recent matches have higher weight
 */
function movingWeightedAverage(
  values: number[],
  weights?: number[]
): number {
  if (values.length === 0) return 0

  // Default weights: exponential decay (most recent = highest weight)
  const defaultWeights = values.map((_, index) => {
    const position = values.length - index - 1
    return Math.pow(0.8, position) // Exponential decay
  })

  const w = weights || defaultWeights
  const totalWeight = w.reduce((sum, weight) => sum + weight, 0)

  if (totalWeight === 0) {
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  const weightedSum = values.reduce((sum, val, index) => {
    return sum + val * (w[index] || 1)
  }, 0)

  return weightedSum / totalWeight
}

/**
 * Exponential smoothing (Holt-Winters style)
 */
function exponentialSmoothing(
  values: number[],
  alpha: number = 0.3 // Smoothing factor (0-1)
): number {
  if (values.length === 0) return 0
  if (values.length === 1) return values[0]

  let smoothed = values[0]

  for (let i = 1; i < values.length; i++) {
    smoothed = alpha * values[i] + (1 - alpha) * smoothed
  }

  return smoothed
}

/**
 * Calculate recent form rating (last 5 matches)
 */
function calculateRecentForm(history: PlayerHistory[]): number {
  if (history.length === 0) return 50 // Neutral rating

  // Take last 5 matches
  const recent = history.slice(-5)

  // Calculate average performance
  const runs = recent
    .map((h) => h.runs || 0)
    .filter((r) => r > 0)
  const wickets = recent
    .map((h) => h.wickets || 0)
    .filter((w) => w > 0)

  let formScore = 50 // Base score

  // Batting form
  if (runs.length > 0) {
    const avgRuns = runs.reduce((sum, r) => sum + r, 0) / runs.length
    // Normalize: 0-20 runs = 0-40 points, 20-50 = 40-70, 50+ = 70-100
    if (avgRuns >= 50) formScore += 30
    else if (avgRuns >= 20) formScore += 20
    else formScore += (avgRuns / 20) * 20
  }

  // Bowling form
  if (wickets.length > 0) {
    const avgWickets = wickets.reduce((sum, w) => sum + w, 0) / wickets.length
    // Normalize: 0-2 wickets = 0-20 points, 2-4 = 20-40, 4+ = 40-60
    if (avgWickets >= 4) formScore += 40
    else if (avgWickets >= 2) formScore += 20
    else formScore += (avgWickets / 2) * 20
  }

  // Cap at 100
  return Math.min(100, Math.max(0, formScore))
}

/**
 * Predict batting performance
 */
export function predictBattingPerformance(
  playerHistory: PlayerHistory[],
  opponentBowlingStrength: number = 50 // 0-100 scale (50 = average)
): {
  predictedRuns: number
  predictedStrikeRate: number
  formRating: number
  confidence: number
} {
  if (playerHistory.length === 0) {
    return {
      predictedRuns: 0,
      predictedStrikeRate: 100,
      formRating: 50,
      confidence: 0,
    }
  }

  // Extract runs and strike rates
  const runsHistory = playerHistory
    .map((h) => h.runs || 0)
    .filter((r) => r >= 0)
  const strikeRateHistory = playerHistory
    .map((h) => h.strikeRate || 100)
    .filter((sr) => sr > 0)

  // Use moving weighted average for prediction
  const predictedRunsRaw = movingWeightedAverage(runsHistory)
  const predictedStrikeRateRaw = movingWeightedAverage(strikeRateHistory)

  // Adjust for opponent strength (stronger opponent = lower performance)
  const opponentFactor = 1 - (opponentBowlingStrength - 50) / 200 // -0.25 to +0.25 range
  const predictedRuns = Math.max(0, predictedRunsRaw * opponentFactor)
  const predictedStrikeRate = Math.max(50, predictedStrikeRateRaw * opponentFactor)

  // Calculate form rating
  const formRating = calculateRecentForm(playerHistory)

  // Confidence based on history length
  const confidence = Math.min(100, playerHistory.length * 15) // 15% per match, max 100%

  return {
    predictedRuns: Math.round(predictedRuns * 10) / 10,
    predictedStrikeRate: Math.round(predictedStrikeRate * 10) / 10,
    formRating: Math.round(formRating),
    confidence: Math.round(confidence),
  }
}

/**
 * Predict bowling performance
 */
export function predictBowlingPerformance(
  playerHistory: PlayerHistory[],
  opponentBattingStrength: number = 50 // 0-100 scale
): {
  predictedWickets: number
  predictedEconomy: number
  formRating: number
  confidence: number
} {
  if (playerHistory.length === 0) {
    return {
      predictedWickets: 0,
      predictedEconomy: 8.0,
      formRating: 50,
      confidence: 0,
    }
  }

  // Extract wickets and economy
  const wicketsHistory = playerHistory
    .map((h) => h.wickets || 0)
    .filter((w) => w >= 0)
  const economyHistory = playerHistory
    .map((h) => h.economy || 8.0)
    .filter((e) => e > 0)

  // Use exponential smoothing for bowling (more volatile)
  const predictedWicketsRaw = exponentialSmoothing(wicketsHistory, 0.4)
  const predictedEconomyRaw = exponentialSmoothing(economyHistory, 0.3)

  // Adjust for opponent strength (stronger batting = more runs, fewer wickets)
  const opponentFactor = 1 + (opponentBattingStrength - 50) / 200
  const predictedWickets = Math.max(0, predictedWicketsRaw / opponentFactor)
  const predictedEconomy = Math.max(3.0, predictedEconomyRaw * opponentFactor)

  // Calculate form rating
  const formRating = calculateRecentForm(playerHistory)

  // Confidence
  const confidence = Math.min(100, playerHistory.length * 15)

  return {
    predictedWickets: Math.round(predictedWickets * 10) / 10,
    predictedEconomy: Math.round(predictedEconomy * 10) / 10,
    formRating: Math.round(formRating),
    confidence: Math.round(confidence),
  }
}

/**
 * Predict overall player performance
 */
export function predictPlayerPerformance(
  playerHistory: PlayerHistory[],
  opponentStrength: number = 50,
  playerRole?: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper'
): PredictionResult {
  const battingPred = predictBattingPerformance(playerHistory, opponentStrength)
  const bowlingPred = predictBowlingPerformance(playerHistory, opponentStrength)

  // Combine based on role
  let predictedRuns = battingPred.predictedRuns
  let predictedStrikeRate = battingPred.predictedStrikeRate
  let predictedWickets = bowlingPred.predictedWickets
  let formRating = battingPred.formRating

  if (playerRole === 'Bowler') {
    formRating = bowlingPred.formRating
    predictedRuns = battingPred.predictedRuns * 0.5 // Bowlers bat less
  } else if (playerRole === 'All-rounder') {
    formRating = (battingPred.formRating + bowlingPred.formRating) / 2
  }

  // Calculate confidence (average of both)
  const confidence = (battingPred.confidence + bowlingPred.confidence) / 2

  // Factors breakdown
  const factors = {
    recentForm: formRating,
    opponentStrength: opponentStrength,
    historicalAverage: playerHistory.length > 0
      ? (battingPred.predictedRuns + bowlingPred.predictedWickets * 10) / 2
      : 0,
  }

  return {
    predictedRuns: Math.round(predictedRuns * 10) / 10,
    predictedStrikeRate: Math.round(predictedStrikeRate * 10) / 10,
    predictedWickets: Math.round(predictedWickets * 10) / 10,
    formRating: Math.round(formRating),
    confidence: Math.round(confidence),
    factors,
  }
}

/**
 * Calculate opponent team strength (0-100 scale)
 * Based on average bowling/batting stats
 */
export function calculateOpponentStrength(
  opponentPlayers: Array<{
    stats?: {
      runs?: number
      wickets?: number
      strikeRate?: number
      economy?: number
    }
  }>,
  type: 'batting' | 'bowling' = 'bowling'
): number {
  if (!opponentPlayers || opponentPlayers.length === 0) {
    return 50 // Average if no data
  }

  if (type === 'bowling') {
    // Calculate average economy and wickets
    const economies = opponentPlayers
      .map((p) => p.stats?.economy || 8.0)
      .filter((e) => e > 0)
    const wickets = opponentPlayers
      .map((p) => p.stats?.wickets || 0)
      .filter((w) => w >= 0)

    if (economies.length === 0) return 50

    const avgEconomy = economies.reduce((sum, e) => sum + e, 0) / economies.length
    const totalWickets = wickets.reduce((sum, w) => sum + w, 0)

    // Lower economy = stronger bowling (inverse relationship)
    // Normalize: economy 4-6 = 80-100, 6-8 = 60-80, 8-10 = 40-60, 10+ = 0-40
    let strength = 100 - (avgEconomy - 4) * 10
    strength = Math.max(0, Math.min(100, strength))

    // Boost for wickets (more wickets = stronger)
    const wicketBoost = Math.min(20, totalWickets / 10)
    strength = Math.min(100, strength + wicketBoost)

    return Math.round(strength)
  } else {
    // Batting strength
    const runs = opponentPlayers
      .map((p) => p.stats?.runs || 0)
      .filter((r) => r >= 0)
    const strikeRates = opponentPlayers
      .map((p) => p.stats?.strikeRate || 100)
      .filter((sr) => sr > 0)

    if (runs.length === 0) return 50

    const avgRuns = runs.reduce((sum, r) => sum + r, 0) / runs.length
    const avgStrikeRate = strikeRates.reduce((sum, sr) => sum + sr, 0) / strikeRates.length

    // Normalize: runs 0-20 = 0-40, 20-50 = 40-70, 50+ = 70-100
    let strength = (avgRuns / 50) * 70
    strength = Math.max(0, Math.min(100, strength))

    // Boost for strike rate
    const srBoost = ((avgStrikeRate - 100) / 100) * 20
    strength = Math.min(100, Math.max(0, strength + srBoost))

    return Math.round(strength)
  }
}

