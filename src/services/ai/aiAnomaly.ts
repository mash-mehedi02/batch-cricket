/**
 * AI Score Anomaly Detector (Error Catcher)
 * 
 * Detects impossible or suspicious cricket scoring events before they are saved.
 * Validates ball events against ICC cricket rules and common scoring patterns.
 * 
 * Detects:
 * - Impossible ball events (wicket + wide together, etc.)
 * - Overcount mismatches
 * - Impossible batting stats (SR > 600, etc.)
 * - Wrong bowler over-limit
 * - Wrong batsman strike position
 * - Extra inconsistencies
 * 
 * @module aiAnomaly
 */

export type AnomalySeverity = 'low' | 'medium' | 'high'

export interface AnomalyResult {
  isAnomaly: boolean
  message: string
  severity: AnomalySeverity
  field?: string
  suggestedFix?: string
}

export interface BallEventInput {
  runs: number
  batRuns?: number
  extraType?: 'no-ball' | 'wide' | 'leg-bye' | 'bye' | null
  isWicket?: boolean
  wicketType?: string | null
  countsBall?: boolean
  bowlerId?: string
  strikerId?: string
  nonStrikerId?: string
  over?: string
  ball?: number
}

export interface MatchStateInput {
  currentBowlerId?: string
  lastBowlerId?: string
  currentBatsmanId?: string
  currentNonStrikerId?: string
  balls?: number
  overs?: string
  wickets?: number
  runs?: number
  oversLimit?: number
  bowlerOvers?: Record<string, number> // bowlerId -> balls bowled
  batsmanStats?: Record<string, { runs: number; balls: number }>
}

/**
 * Check for impossible ball event combinations
 */
function checkImpossibleCombinations(event: BallEventInput): AnomalyResult | null {
  // Wicket + Wide together (impossible)
  if (event.isWicket && event.extraType === 'wide') {
    return {
      isAnomaly: true,
      message: 'Cannot have a wicket and wide ball on the same delivery.',
      severity: 'high',
      field: 'extraType',
      suggestedFix: 'Remove either the wicket or the wide designation.',
    }
  }

  // Wicket + No-ball (only run out, stumped, hit wicket allowed)
  if (event.isWicket && event.extraType === 'no-ball') {
    const allowedWickets = ['Run Out', 'Stumped', 'Hit Wicket']
    if (event.wicketType && !allowedWickets.includes(event.wicketType)) {
      return {
        isAnomaly: true,
        message: `Cannot have ${event.wicketType} on a no-ball. Only Run Out, Stumped, or Hit Wicket are allowed.`,
        severity: 'high',
        field: 'wicketType',
        suggestedFix: 'Change wicket type to Run Out, Stumped, or Hit Wicket, or remove no-ball.',
      }
    }
  }

  // No-ball + Bye/Leg-bye (leg bye can happen, but check logic)
  if (event.extraType === 'no-ball' && (event.extraType === 'bye' || event.extraType === 'leg-bye')) {
    // This is actually allowed, but both shouldn't be set as extraType
    // The extraType should be 'no-ball', and leg bye runs are separate
    // This check might need refinement based on your data model
  }

  // Wide with runs > 1 but no bat runs (should be 0 or 1)
  if (event.extraType === 'wide' && event.runs > 1 && (event.batRuns || 0) > 0) {
    return {
      isAnomaly: true,
      message: 'Wide ball cannot have batter runs. Only extra runs are allowed.',
      severity: 'medium',
      field: 'batRuns',
      suggestedFix: 'Set batter runs to 0 for wide balls.',
    }
  }

  return null
}

/**
 * Check for impossible batting statistics
 */
function checkBattingStats(
  batsmanStats: Record<string, { runs: number; balls: number }>
): AnomalyResult | null {
  for (const [playerId, stats] of Object.entries(batsmanStats)) {
    const { runs, balls } = stats

    // Impossible strike rate (> 600 is suspicious, > 1000 is definitely wrong)
    if (balls > 0) {
      const strikeRate = (runs / balls) * 100
      if (strikeRate > 1000) {
        return {
          isAnomaly: true,
          message: `Impossible strike rate detected for player: ${strikeRate.toFixed(1)}. Check runs and balls.`,
          severity: 'high',
          field: 'batsmanStats',
          suggestedFix: 'Verify runs and balls are correctly recorded.',
        }
      }
      if (strikeRate > 600) {
        return {
          isAnomaly: true,
          message: `Suspiciously high strike rate: ${strikeRate.toFixed(1)}. Please verify.`,
          severity: 'medium',
          field: 'batsmanStats',
          suggestedFix: 'Double-check runs and balls count.',
        }
      }
    }

    // Negative values
    if (runs < 0 || balls < 0) {
      return {
        isAnomaly: true,
        message: 'Negative runs or balls detected. Values cannot be negative.',
        severity: 'high',
        field: 'batsmanStats',
        suggestedFix: 'Check for calculation errors.',
      }
    }

    // Balls without runs is fine (dot balls), but runs without balls is suspicious
    if (runs > 0 && balls === 0 && runs > 1) {
      // Allow 1 run (could be a bye/leg bye without facing a ball)
      // But multiple runs without balls is suspicious
      return {
        isAnomaly: true,
        message: `Player has ${runs} runs but 0 balls faced. Verify if this is correct (e.g., run out on 0 balls).`,
        severity: 'low',
        field: 'batsmanStats',
        suggestedFix: 'Confirm if player was run out without facing a ball.',
      }
    }
  }

  return null
}

/**
 * Check for overcount mismatches
 */
function checkOvercount(matchState: MatchStateInput): AnomalyResult | null {
  const { balls, overs, oversLimit } = matchState

  if (balls === undefined || overs === undefined) {
    return null // Cannot check without data
  }

  // Convert overs string to balls
  const [oversPart, ballsPart] = overs.split('.')
  const oversInt = parseInt(oversPart || '0', 10)
  const ballsInt = parseInt(ballsPart || '0', 10)
  const oversAsBalls = oversInt * 6 + ballsInt

  // Check if balls match overs representation
  if (Math.abs(balls - oversAsBalls) > 1) {
    // Allow 1 ball difference due to rounding
    return {
      isAnomaly: true,
      message: `Overcount mismatch: ${balls} balls but overs show ${overs} (${oversAsBalls} balls).`,
      severity: 'medium',
      field: 'overs',
      suggestedFix: 'Recalculate overs from balls count.',
    }
  }

  // Check if overs exceed limit
  if (oversLimit && balls > oversLimit * 6) {
    return {
      isAnomaly: true,
      message: `Overs limit exceeded: ${overs} overs (${balls} balls) exceeds limit of ${oversLimit} overs.`,
      severity: 'high',
      field: 'balls',
      suggestedFix: `Match should have ended at ${oversLimit} overs.`,
    }
  }

  return null
}

/**
 * Check bowler over-limit
 */
function checkBowlerOvers(
  bowlerId: string,
  bowlerOvers: Record<string, number>,
  oversLimit?: number
): AnomalyResult | null {
  if (!bowlerOvers || !bowlerOvers[bowlerId]) {
    return null
  }

  const ballsBowled = bowlerOvers[bowlerId]
  const oversBowled = ballsBowled / 6

  // ICC Rule: In limited overs, bowler can bowl max 20% of total overs (or 4 overs in T20)
  // For school cricket, we'll use a flexible limit
  if (oversLimit) {
    const maxOversPerBowler = Math.ceil(oversLimit * 0.2) // 20% of total overs
    if (oversBowled > maxOversPerBowler) {
      return {
        isAnomaly: true,
        message: `Bowler has bowled ${oversBowled.toFixed(1)} overs, exceeding the limit of ${maxOversPerBowler} overs per bowler.`,
        severity: 'high',
        field: 'bowlerOvers',
        suggestedFix: `Select a different bowler. Maximum ${maxOversPerBowler} overs allowed per bowler.`,
      }
    }
  }

  return null
}

/**
 * Check for wrong batsman strike position
 */
function checkStrikePosition(
  event: BallEventInput,
  matchState: MatchStateInput
): AnomalyResult | null {
  // This is a basic check - in a real system, you'd track strike rotation
  // For now, we'll just check if striker and non-striker are different
  if (event.strikerId && event.nonStrikerId && event.strikerId === event.nonStrikerId) {
    return {
      isAnomaly: true,
      message: 'Striker and non-striker cannot be the same player.',
      severity: 'high',
      field: 'strikerId',
      suggestedFix: 'Select different players for striker and non-striker.',
    }
  }

  return null
}

/**
 * Check for extra inconsistencies
 */
function checkExtraInconsistencies(event: BallEventInput): AnomalyResult | null {
  // No-ball should not count as a ball
  if (event.extraType === 'no-ball' && event.countsBall === true) {
    // Actually, this depends on your implementation
    // In ICC rules, no-ball doesn't count as a legal delivery
    // But the ball is still "bowled" - check your rule engine logic
  }

  // Wide should not count as a ball
  if (event.extraType === 'wide' && event.countsBall === true) {
    return {
      isAnomaly: true,
      message: 'Wide ball should not count as a legal delivery.',
      severity: 'medium',
      field: 'countsBall',
      suggestedFix: 'Set countsBall to false for wide deliveries.',
    }
  }

  // Leg bye/bye with bat runs
  if ((event.extraType === 'leg-bye' || event.extraType === 'bye') && (event.batRuns || 0) > 0) {
    return {
      isAnomaly: true,
      message: `${event.extraType === 'leg-bye' ? 'Leg bye' : 'Bye'} cannot have batter runs.`,
      severity: 'medium',
      field: 'batRuns',
      suggestedFix: 'Set batter runs to 0 for leg byes/byes.',
    }
  }

  return null
}

/**
 * Main anomaly detection function
 * 
 * @param event - Ball event to validate
 * @param matchState - Current match state
 * @returns Anomaly result if detected, null otherwise
 */
export function detectAnomaly(
  event: BallEventInput,
  matchState: MatchStateInput
): AnomalyResult | null {
  // Check impossible combinations
  const combinationCheck = checkImpossibleCombinations(event)
  if (combinationCheck) return combinationCheck

  // Check extra inconsistencies
  const extraCheck = checkExtraInconsistencies(event)
  if (extraCheck) return extraCheck

  // Check strike position
  const strikeCheck = checkStrikePosition(event, matchState)
  if (strikeCheck) return strikeCheck

  // Check bowler overs if bowler is specified
  if (event.bowlerId && matchState.bowlerOvers) {
    const bowlerCheck = checkBowlerOvers(
      event.bowlerId,
      matchState.bowlerOvers,
      matchState.oversLimit
    )
    if (bowlerCheck) return bowlerCheck
  }

  // Check overcount
  const overcountCheck = checkOvercount(matchState)
  if (overcountCheck) return overcountCheck

  // Check batting stats if available
  if (matchState.batsmanStats) {
    const statsCheck = checkBattingStats(matchState.batsmanStats)
    if (statsCheck) return statsCheck
  }

  // No anomalies detected
  return {
    isAnomaly: false,
    message: 'No anomalies detected.',
    severity: 'low',
  }
}

/**
 * Batch anomaly detection for multiple events
 */
export function detectBatchAnomalies(
  events: BallEventInput[],
  matchState: MatchStateInput
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = []

  for (const event of events) {
    const result = detectAnomaly(event, matchState)
    if (result && result.isAnomaly) {
      anomalies.push(result)
    }
  }

  return anomalies
}

/**
 * Validate match state consistency
 */
export function validateMatchState(matchState: MatchStateInput): AnomalyResult[] {
  const anomalies: AnomalyResult[] = []

  // Check for negative values
  if (matchState.runs !== undefined && matchState.runs < 0) {
    anomalies.push({
      isAnomaly: true,
      message: 'Total runs cannot be negative.',
      severity: 'high',
      field: 'runs',
    })
  }

  if (matchState.wickets !== undefined && matchState.wickets < 0) {
    anomalies.push({
      isAnomaly: true,
      message: 'Wickets cannot be negative.',
      severity: 'high',
      field: 'wickets',
    })
  }

  if (matchState.balls !== undefined && matchState.balls < 0) {
    anomalies.push({
      isAnomaly: true,
      message: 'Balls cannot be negative.',
      severity: 'high',
      field: 'balls',
    })
  }

  // Check wickets limit
  if (matchState.wickets !== undefined && matchState.wickets > 10) {
    anomalies.push({
      isAnomaly: true,
      message: 'Wickets cannot exceed 10.',
      severity: 'high',
      field: 'wickets',
    })
  }

  return anomalies
}

