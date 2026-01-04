/**
 * AI Insights & Smart Recommendations Module
 * 
 * Generates intelligent insights and recommendations for:
 * - Best bowler to use next over
 * - Weakness detection (e.g., batsman vs spin)
 * - Batting partnership strength rating
 * - Match win probability (%)
 * 
 * Uses simple logistic regression-style formulas (no ML training required).
 * Fast, lightweight, and production-ready.
 * 
 * @module aiInsights
 */

export interface PlayerStats {
  playerId: string
  playerName: string
  role?: string
  stats?: {
    runs?: number
    wickets?: number
    economy?: number
    strikeRate?: number
    matches?: number
  }
  currentMatch?: {
    runs?: number
    balls?: number
    wickets?: number
    runsConceded?: number
    ballsBowled?: number
    economy?: number
  }
}

export interface MatchContext {
  currentScore: number
  wickets: number
  oversBowled: number
  oversLimit: number
  requiredRuns?: number // For chase
  oversRemaining?: number // For chase
  opponentBowlingStrength?: number // 0-100
  opponentBattingStrength?: number // 0-100
}

export interface BowlerRecommendation {
  playerId: string
  playerName: string
  score: number
  reason: string
  factors: {
    economy: number
    wickets: number
    recentForm: number
    matchForm: number
  }
}

export interface PartnershipInsight {
  partnershipRuns: number
  partnershipBalls: number
  partnershipOvers: string
  strength: 'weak' | 'moderate' | 'strong' | 'excellent'
  rating: number // 0-100
  recommendation: string
}

export interface WinProbabilityResult {
  winProbability: number // 0-100
  factors: {
    currentRR: number
    requiredRR: number
    wicketsRemaining: number
    oversRemaining: number
    opponentStrength: number
  }
  recommendation: string
}

/**
 * Recommend best bowler for next over
 */
export function recommendBowler(
  availableBowlers: PlayerStats[],
  matchContext: MatchContext
): BowlerRecommendation | null {
  // Ensure availableBowlers is an array
  if (!availableBowlers || !Array.isArray(availableBowlers) || availableBowlers.length === 0) {
    return null
  }

  const recommendations: BowlerRecommendation[] = availableBowlers.map((bowler) => {
    const stats = bowler.stats || {}
    const currentMatch = bowler.currentMatch || {}

    // Economy (lower is better) - normalized to 0-40 points
    const economy = currentMatch.economy || stats.economy || 8.0
    const economyScore = Math.max(0, 40 - (economy - 4) * 5) // 4 econ = 40, 8 econ = 20, 12 econ = 0

    // Wickets in match - 0-30 points
    const matchWickets = currentMatch.wickets || 0
    const wicketsScore = Math.min(30, matchWickets * 7.5) // 4 wickets = 30 points

    // Recent form (career economy) - 0-15 points
    const formScore = stats.economy ? Math.max(0, 15 - (stats.economy - 6) * 3) : 7.5

    // Match form (current match performance) - 0-15 points
    const matchFormScore = currentMatch.economy
      ? Math.max(0, 15 - (currentMatch.economy - 6) * 3)
      : 7.5

    const totalScore = economyScore + wicketsScore + formScore + matchFormScore

    // Generate reason
    let reason = ''
    if (matchWickets > 0) {
      reason = `${bowler.playerName} has taken ${matchWickets} wicket${matchWickets > 1 ? 's' : ''} with economy of ${economy.toFixed(1)}`
    } else if (economy < 6) {
      reason = `${bowler.playerName} has been economical (${economy.toFixed(1)} RPO)`
    } else {
      reason = `${bowler.playerName} is a reliable option`
    }

    return {
      playerId: bowler.playerId,
      playerName: bowler.playerName,
      score: totalScore,
      reason,
      factors: {
        economy: economyScore,
        wickets: wicketsScore,
        recentForm: formScore,
        matchForm: matchFormScore,
      },
    }
  })

  // Return bowler with highest score
  return recommendations.reduce((best, current) =>
    current.score > best.score ? current : best
  )
}

/**
 * Detect batsman weakness (e.g., vs spin, vs pace)
 * 
 * This is a simplified version - in production, you'd analyze
 * historical performance against different bowling types
 */
export function detectBatsmanWeakness(
  batsman: PlayerStats,
  opponentBowlers: PlayerStats[]
): {
  weakness: string | null
  confidence: number
  recommendation: string
} {
  // Simplified: Check if batsman has low strike rate or high dismissal rate
  // In production, analyze by bowling type (spin vs pace)
  
  const stats = batsman.stats || {}
  const strikeRate = stats.strikeRate || 100

  if (strikeRate < 80) {
    return {
      weakness: 'Low strike rate suggests difficulty scoring quickly',
      confidence: 70,
      recommendation: 'Consider defensive approach or rotating strike',
    }
  }

  // Check if batsman struggles against specific economy ranges (proxy for bowling type)
  const avgOpponentEconomy = opponentBowlers
    .map((b) => b.stats?.economy || 8.0)
    .reduce((sum, e, _, arr) => sum + e / arr.length, 0)

  if (avgOpponentEconomy < 6 && strikeRate < 100) {
    return {
      weakness: 'May struggle against tight bowling',
      confidence: 60,
      recommendation: 'Focus on rotating strike and building partnership',
    }
  }

  return {
    weakness: null,
    confidence: 0,
    recommendation: 'No significant weakness detected',
  }
}

/**
 * Rate batting partnership strength
 */
export function ratePartnership(
  partnershipRuns: number,
  partnershipBalls: number,
  matchContext: MatchContext
): PartnershipInsight {
  const partnershipOvers = `${Math.floor(partnershipBalls / 6)}.${partnershipBalls % 6}`
  const partnershipRR = partnershipBalls > 0
    ? (partnershipRuns / (partnershipBalls / 6))
    : 0

  // Calculate rating based on runs, balls, and run rate
  let rating = 0

  // Runs contribution (0-40 points)
  if (partnershipRuns >= 100) rating += 40
  else if (partnershipRuns >= 50) rating += 30
  else if (partnershipRuns >= 30) rating += 20
  else rating += (partnershipRuns / 30) * 20

  // Run rate (0-30 points)
  if (partnershipRR >= 10) rating += 30
  else if (partnershipRR >= 8) rating += 25
  else if (partnershipRR >= 6) rating += 20
  else rating += (partnershipRR / 6) * 20

  // Stability (balls faced) (0-30 points)
  if (partnershipBalls >= 60) rating += 30
  else if (partnershipBalls >= 30) rating += 20
  else rating += (partnershipBalls / 30) * 20

  rating = Math.min(100, Math.max(0, rating))

  // Determine strength category
  let strength: PartnershipInsight['strength'] = 'weak'
  let recommendation = 'Partnership needs to build momentum'

  if (rating >= 80) {
    strength = 'excellent'
    recommendation = 'Excellent partnership! Keep building on this foundation'
  } else if (rating >= 60) {
    strength = 'strong'
    recommendation = 'Strong partnership. Maintain the momentum'
  } else if (rating >= 40) {
    strength = 'moderate'
    recommendation = 'Partnership is building. Focus on rotating strike'
  } else {
    strength = 'weak'
    recommendation = 'Partnership needs to accelerate. Look for scoring opportunities'
  }

  return {
    partnershipRuns,
    partnershipBalls,
    partnershipOvers,
    strength,
    rating: Math.round(rating),
    recommendation,
  }
}

/**
 * Calculate match win probability
 * 
 * Realistic cricket win probability based on:
 * - Projected full innings total (based on current run rate and wickets)
 * - Can 2nd team chase this target?
 * - Current run rate vs required run rate
 * - Wickets remaining (critical factor)
 * - Overs remaining
 * - Opponent strength
 * 
 * Uses WASP-inspired methodology with logistic regression
 */
export function calculateWinProbability(
  matchContext: MatchContext
): WinProbabilityResult {
  const {
    currentScore,
    wickets,
    oversBowled,
    oversLimit,
    requiredRuns,
    oversRemaining,
    opponentBowlingStrength = 50,
  } = matchContext

  const totalOvers = oversLimit
  const oversBowledDecimal = oversBowled || 0
  const oversRemainingDecimal = oversRemaining || 0
  const wicketsRemaining = 10 - wickets

  // Calculate current run rate (runs per over)
  // oversBowledDecimal is already in decimal overs format (e.g., 1.5 = 1.5 overs)
  // Formula: Run Rate = Runs / Overs
  const currentRR = oversBowledDecimal > 0
    ? currentScore / oversBowledDecimal
    : 0

  // If first innings: Project full innings total
  if (!requiredRuns || !oversRemaining) {
    // Project full innings based on current run rate
    // Formula: Projected = Current Run Rate * Total Overs
    // Example: 10 over match, 2 overs bowled, 15 runs (RR = 7.5)
    // Projected = 7.5 * 10 = 75 runs
    
    // Apply wicket factor: More wickets lost = teams slow down
    // Wicket factor: 10 wickets = 1.0, 7 wickets = 0.85, 5 wickets = 0.7, 3 wickets = 0.55, 1 wicket = 0.4
    const wicketFactor = Math.max(0.4, 0.4 + (wicketsRemaining / 10) * 0.6) // 0.4 to 1.0 based on wickets
    
    // Simple formula: Current Run Rate * Total Overs * Wicket Factor
    const projectedRuns = currentRR > 0 
      ? currentRR * totalOvers * wicketFactor
      : 0
    
    return {
      winProbability: 50, // Neutral for first innings
      factors: {
        currentRR: Math.round(currentRR * 10) / 10,
        requiredRR: 0,
        wicketsRemaining,
        oversRemaining: Math.round((totalOvers - oversBowledDecimal) * 10) / 10,
        opponentStrength: opponentBowlingStrength,
      },
      recommendation: `Projected total: ${Math.round(projectedRuns)} runs`,
    }
  }

  // Second innings (chase): Calculate win probability
  const requiredRR = oversRemainingDecimal > 0
    ? requiredRuns / (oversRemainingDecimal / 6)
    : Infinity

  // Factor 1: Run Rate Comparison (40% weight)
  // If current RR > required RR, higher probability
  // Use logistic function for smooth transition
  let rrFactor = 0.5
  if (requiredRR > 0 && currentRR > 0) {
    const rrRatio = currentRR / requiredRR
    // Logistic curve: rrRatio 0.5 = 0.1, 1.0 = 0.5, 1.5 = 0.9, 2.0 = 0.95
    rrFactor = 1 / (1 + Math.exp(-5 * (rrRatio - 1)))
  } else if (requiredRR === Infinity || requiredRuns <= 0) {
    rrFactor = 0.05 // Almost impossible
  } else if (currentRR === 0) {
    rrFactor = 0.1 // Very low if no runs scored yet
  }

  // Factor 2: Wickets Remaining (30% weight)
  // More wickets = exponentially higher probability
  // Formula: wicketsFactor = (wicketsRemaining/10)^1.5
  // This gives: 10 wickets = 1.0, 7 wickets = 0.66, 5 wickets = 0.35, 3 wickets = 0.16, 1 wicket = 0.03
  const wicketsFactor = Math.pow(wicketsRemaining / 10, 1.5)

  // Factor 3: Overs Remaining (20% weight)
  // More overs = higher probability, but diminishing returns
  // Formula: oversFactor = sqrt(oversRemaining / (totalOvers * 0.6))
  const oversFactor = Math.min(1, Math.sqrt(oversRemainingDecimal / (totalOvers * 0.6)))

  // Factor 4: Required Runs vs Overs (10% weight)
  // If required RR is very high (>12), very difficult
  // If required RR is low (<6), easier
  let runsFactor = 0.5
  if (requiredRR > 0) {
    if (requiredRR >= 12) {
      runsFactor = 0.1 // Very difficult
    } else if (requiredRR >= 10) {
      runsFactor = 0.25 // Difficult
    } else if (requiredRR >= 8) {
      runsFactor = 0.4 // Challenging
    } else if (requiredRR >= 6) {
      runsFactor = 0.6 // Moderate
    } else {
      runsFactor = 0.8 // Favorable
    }
  }

  // Opponent strength adjustment (modifies final probability)
  const opponentAdjustment = 1 - ((opponentBowlingStrength - 50) / 100) // -0.5 to +0.5

  // Combine factors with weights
  const baseProbability = (
    rrFactor * 0.40 +
    wicketsFactor * 0.30 +
    oversFactor * 0.20 +
    runsFactor * 0.10
  )

  // Apply opponent strength adjustment
  const adjustedProbability = Math.max(0, Math.min(1, baseProbability + opponentAdjustment * 0.15))

  const winProbability = adjustedProbability * 100

  // Generate recommendation
  let recommendation = ''
  if (winProbability >= 80) {
    recommendation = 'Excellent position! Maintain current run rate and wickets'
  } else if (winProbability >= 65) {
    recommendation = 'Strong position! Keep building steadily'
  } else if (winProbability >= 50) {
    recommendation = 'Favorable position. Keep rotating strike and building partnership'
  } else if (winProbability >= 35) {
    recommendation = 'Challenging situation. Need to accelerate while preserving wickets'
  } else if (winProbability >= 20) {
    recommendation = 'Difficult chase. Need quick runs but wickets are crucial'
  } else {
    recommendation = 'Very difficult situation. Need boundaries and wickets in hand'
  }

  return {
    winProbability: Math.round(winProbability),
    factors: {
      currentRR: Math.round(currentRR * 10) / 10,
      requiredRR: Math.round(requiredRR * 10) / 10,
      wicketsRemaining,
      oversRemaining: Math.round(oversRemainingDecimal * 10) / 10,
      opponentStrength: opponentBowlingStrength,
    },
    recommendation,
  }
}

/**
 * Get comprehensive match insights
 */
export function getMatchInsights(
  matchContext: MatchContext,
  availableBowlers: PlayerStats[] = [],
  partnershipRuns: number = 0,
  partnershipBalls: number = 0
): {
  winProbability: WinProbabilityResult
  bowlerRecommendation: BowlerRecommendation | null
  partnershipInsight: PartnershipInsight
} {
  // Ensure availableBowlers is an array
  const bowlersArray = Array.isArray(availableBowlers) ? availableBowlers : []
  
  return {
    winProbability: calculateWinProbability(matchContext),
    bowlerRecommendation: recommendBowler(bowlersArray, matchContext),
    partnershipInsight: ratePartnership(partnershipRuns, partnershipBalls, matchContext),
  }
}

