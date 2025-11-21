/**
 * ICC Cricket Rule Engine
 * Complete implementation of ICC T20/ODI cricket rules
 * All cricket logic centralized here for consistency and accuracy
 */

/**
 * Delivery Types
 */
export const DELIVERY_TYPES = {
  LEGAL: 'legal',
  WIDE: 'wide',
  NO_BALL: 'no-ball',
  BYE: 'bye',
  LEG_BYE: 'leg-bye',
}

/**
 * Wicket Types
 */
export const WICKET_TYPES = {
  BOWLED: 'Bowled',
  CAUGHT: 'Caught',
  CAUGHT_BOWLED: 'Caught & Bowled',
  LBW: 'LBW',
  RUN_OUT: 'Run Out',
  STUMPED: 'Stumped',
  HIT_WICKET: 'Hit Wicket',
  OBSTRUCTING: 'Obstructing the Field',
  RETIRED_HURT: 'Retired Hurt',
  RETIRED_OUT: 'Retired Out',
  TIMED_OUT: 'Timed Out',
}

/**
 * Check if a delivery counts as a valid ball
 */
export const countsAsValidBall = (deliveryType) => {
  return deliveryType === DELIVERY_TYPES.LEGAL || deliveryType === DELIVERY_TYPES.BYE || deliveryType === DELIVERY_TYPES.LEG_BYE
}

/**
 * Check if runs should be credited to batsman
 */
export const creditRunsToBatsman = (deliveryType, runs) => {
  if (deliveryType === DELIVERY_TYPES.WIDE || deliveryType === DELIVERY_TYPES.NO_BALL) {
    // Wide/No-ball: Only penalty runs (runs - 1) go to extras, bat runs go to batsman if he hits it
    return runs > 1 ? runs - 1 : 0
  }
  if (deliveryType === DELIVERY_TYPES.BYE || deliveryType === DELIVERY_TYPES.LEG_BYE) {
    return 0 // Byes/Leg-byes don't count as bat runs
  }
  return runs // Legal delivery: all runs to batsman
}

/**
 * Check if runs should be credited to bowler
 */
export const creditRunsToBowler = (deliveryType) => {
  return deliveryType === DELIVERY_TYPES.LEGAL || deliveryType === DELIVERY_TYPES.NO_BALL
}

/**
 * Calculate strike rotation
 * @param {number} runs - Runs scored on this ball (total runs including extras)
 * @param {boolean} isBoundary - Is it a boundary (4 or 6)
 * @param {boolean} isWicket - Is it a wicket
 * @param {string} wicketType - Type of wicket (if applicable)
 * @param {string} deliveryType - Type of delivery (legal, wide, no-ball, etc.)
 * @returns {boolean} - Should strike rotate
 */
export const shouldRotateStrike = (runs, isBoundary, isWicket, wicketType, deliveryType = DELIVERY_TYPES.LEGAL) => {
  // Boundary: No strike rotation (ICC Rule)
  if (isBoundary) {
    return false
  }

  // Wicket: Only rotate if striker is out (not run out of non-striker)
  if (isWicket) {
    // Run out: Strike rotation depends on who was run out
    if (wicketType === WICKET_TYPES.RUN_OUT) {
      return false // Strike rotation handled separately for run out
    }
    // Other wickets: Striker is out, so strike rotates
    return true
  }

  // ICC Rule: For wide/no-ball, strike rotates based on runs scored (if any)
  // If wide/no-ball with runs, rotate based on those runs
  // If wide/no-ball with no runs (just penalty), no rotation
  if (deliveryType === DELIVERY_TYPES.WIDE || deliveryType === DELIVERY_TYPES.NO_BALL) {
    // Wide/No-ball: Strike rotates if odd runs scored (excluding penalty)
    // For wide: runs = 1 (penalty) + any runs scored
    // For no-ball: runs = 1 (penalty) + any runs scored
    const runsScored = runs > 1 ? runs - 1 : 0 // Exclude penalty run
    return runsScored % 2 === 1
  }

  // Legal delivery: Odd runs rotate, even runs don't
  return runs % 2 === 1
}

/**
 * Check if over is complete
 * @param {number} validBalls - Number of valid balls bowled in this over
 * @returns {boolean}
 */
export const isOverComplete = (validBalls) => {
  return validBalls >= 6
}

/**
 * Calculate over notation (e.g., "12.4" means 12 overs and 4 balls)
 * @param {number} totalBalls - Total valid balls bowled
 * @returns {string} - Over notation
 */
export const formatOvers = (totalBalls) => {
  const overs = Math.floor(totalBalls / 6)
  const balls = totalBalls % 6
  return `${overs}.${balls}`
}

/**
 * Parse over notation to total balls
 * @param {string} oversString - Over notation (e.g., "12.4")
 * @returns {number} - Total balls
 */
export const parseOvers = (oversString) => {
  if (!oversString) return 0
  const [overs, balls] = oversString.toString().split('.')
  return parseInt(overs || 0, 10) * 6 + parseInt(balls || 0, 10)
}

/**
 * Free Hit Logic
 * Check if a wicket type is allowed on free hit
 */
export const isWicketAllowedOnFreeHit = (wicketType) => {
  // On free hit, only these dismissals are allowed:
  const allowedTypes = [
    WICKET_TYPES.RUN_OUT,
    WICKET_TYPES.STUMPED,
    WICKET_TYPES.HIT_WICKET,
    WICKET_TYPES.OBSTRUCTING,
  ]
  return allowedTypes.includes(wicketType)
}

/**
 * Calculate partnership runs and balls
 */
export const calculatePartnership = (battingLineup, strikerId, nonStrikerId) => {
  const striker = battingLineup.find((p) => p.playerId === strikerId)
  const nonStriker = battingLineup.find((p) => p.playerId === nonStrikerId)

  if (!striker || !nonStriker) {
    return { runs: 0, balls: 0 }
  }

  // Partnership runs = sum of both players' runs since partnership started
  // For simplicity, we'll track this separately in match state
  // This is a helper for calculation
  return {
    runs: (striker.runs || 0) + (nonStriker.runs || 0),
    balls: (striker.balls || 0) + (nonStriker.balls || 0),
  }
}

/**
 * Calculate fall of wicket notation
 * @param {number} runs - Score when wicket fell
 * @param {number} wickets - Wickets fallen
 * @param {string} over - Over notation (e.g., "12.4")
 * @returns {string} - FOW notation (e.g., "120/3 (12.4)")
 */
export const formatFallOfWicket = (runs, wickets, over) => {
  return `${runs}/${wickets} (${over})`
}

/**
 * Check if bowler can bowl more overs
 * @param {number} oversBowled - Overs already bowled by this bowler
 * @param {number} maxOvers - Maximum overs allowed per bowler
 * @returns {boolean}
 */
export const canBowlerBowlMore = (oversBowled, maxOvers) => {
  const oversDecimal = parseOvers(oversBowled)
  const maxOversDecimal = parseOvers(maxOvers)
  return oversDecimal < maxOversDecimal
}

/**
 * Calculate bowler's economy rate
 * @param {number} runsConceded - Runs conceded
 * @param {string} overs - Overs bowled (e.g., "4.2")
 * @returns {number} - Economy rate
 */
export const calculateEconomy = (runsConceded, overs) => {
  const oversDecimal = parseOvers(overs)
  if (oversDecimal === 0) return 0
  return (runsConceded / oversDecimal) * 6
}

/**
 * Calculate batting strike rate
 * @param {number} runs - Runs scored
 * @param {number} balls - Balls faced
 * @returns {number} - Strike rate
 */
export const calculateStrikeRate = (runs, balls) => {
  if (balls === 0) return 0
  return (runs / balls) * 100
}

/**
 * Calculate batting average
 * @param {number} runs - Total runs
 * @param {number} dismissals - Number of times dismissed
 * @returns {number} - Batting average
 */
export const calculateBattingAverage = (runs, dismissals) => {
  if (dismissals === 0) return runs > 0 ? Infinity : 0
  return runs / dismissals
}

/**
 * Calculate bowling average
 * @param {number} runsConceded - Runs conceded
 * @param {number} wickets - Wickets taken
 * @returns {number} - Bowling average
 */
export const calculateBowlingAverage = (runsConceded, wickets) => {
  if (wickets === 0) return runsConceded > 0 ? Infinity : 0
  return runsConceded / wickets
}

/**
 * Calculate bowling strike rate
 * @param {number} balls - Balls bowled
 * @param {number} wickets - Wickets taken
 * @returns {number} - Bowling strike rate
 */
export const calculateBowlingStrikeRate = (balls, wickets) => {
  if (wickets === 0) return balls > 0 ? Infinity : 0
  return balls / wickets
}

/**
 * Process a ball event according to ICC rules
 * @param {Object} params - Ball parameters
 * @returns {Object} - Processed ball result
 */
export const processBallEvent = ({
  deliveryType = DELIVERY_TYPES.LEGAL,
  runs = 0,
  isWicket = false,
  wicketType = null,
  isBoundary = false,
  currentBalls = 0,
  currentRuns = 0,
  currentWickets = 0,
  freeHit = false,
}) => {
  const countsBall = countsAsValidBall(deliveryType)
  const batRuns = creditRunsToBatsman(deliveryType, runs)
  const creditToBowler = creditRunsToBowler(deliveryType)

  // Calculate new totals
  const newBalls = countsBall ? currentBalls + 1 : currentBalls
  const newRuns = currentRuns + runs
  const newWickets = isWicket ? currentWickets + 1 : currentWickets

  // Free hit logic
  let nextFreeHit = freeHit
  if (deliveryType === DELIVERY_TYPES.NO_BALL) {
    nextFreeHit = true
  } else if (freeHit && countsBall && !isWicket) {
    // Free hit consumed if ball is legal and no wicket
    nextFreeHit = false
  }

  // Check if wicket is allowed on free hit
  const wicketAllowed = !freeHit || (freeHit && isWicketAllowedOnFreeHit(wicketType))

  // Strike rotation (pass deliveryType for wide/no-ball handling)
  const shouldRotate = shouldRotateStrike(runs, isBoundary, isWicket, wicketType, deliveryType)

  // Over completion: Check if 6 valid balls have been bowled
  // ICC Rule: Over is complete when 6 valid balls are bowled
  const overComplete = countsBall && (newBalls % 6 === 0)

  return {
    countsBall,
    batRuns,
    creditToBowler,
    newBalls,
    newRuns,
    newWickets,
    nextFreeHit,
    wicketAllowed,
    shouldRotate,
    overComplete,
    overs: formatOvers(newBalls),
  }
}

/**
 * Validate match state according to ICC rules
 */
export const validateMatchState = (match) => {
  const errors = []

  // Check if overs limit exceeded
  if (match.oversLimit) {
    const teamABalls = parseOvers(match.score?.teamA?.overs || '0.0')
    const teamBBalls = parseOvers(match.score?.teamB?.overs || '0.0')
    const maxBalls = match.oversLimit * 6

    if (teamABalls > maxBalls) {
      errors.push(`Team A has exceeded overs limit (${match.oversLimit} overs)`)
    }
    if (teamBBalls > maxBalls) {
      errors.push(`Team B has exceeded overs limit (${match.oversLimit} overs)`)
    }
  }

  // Check if wickets exceeded
  if (match.score?.teamA?.wickets > 10) {
    errors.push('Team A has more than 10 wickets')
  }
  if (match.score?.teamB?.wickets > 10) {
    errors.push('Team B has more than 10 wickets')
  }

  return errors
}

export default {
  DELIVERY_TYPES,
  WICKET_TYPES,
  countsAsValidBall,
  creditRunsToBatsman,
  creditRunsToBowler,
  shouldRotateStrike,
  isOverComplete,
  formatOvers,
  parseOvers,
  isWicketAllowedOnFreeHit,
  calculatePartnership,
  formatFallOfWicket,
  canBowlerBowlMore,
  calculateEconomy,
  calculateStrikeRate,
  calculateBattingAverage,
  calculateBowlingAverage,
  calculateBowlingStrikeRate,
  processBallEvent,
  validateMatchState,
}

