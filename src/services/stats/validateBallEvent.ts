/**
 * Ball Event Validation
 * Ensures ball events follow ICC rules
 */

import { EXTRA_TYPES, WICKET_TYPES } from './iccDefinitions'

export interface BallEvent {
  runs?: number
  batRuns?: number
  extraType?: string
  wicketType?: string
  countsBall?: boolean
  isWicket?: boolean
  isBoundary?: boolean
}

/**
 * Validate if ball event is valid according to ICC rules
 */
export function validateBallEvent(event: BallEvent): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check for impossible combinations
  if (event.isWicket && event.extraType === EXTRA_TYPES.WIDE) {
    errors.push('Wide cannot be a wicket (except run-out)')
  }

  if (event.isWicket && event.extraType === EXTRA_TYPES.NO_BALL &&
    event.wicketType !== WICKET_TYPES.RUN_OUT) {
    errors.push('No-ball cannot be a wicket (except run-out)')
  }

  // Wide doesn't count as ball
  if (event.extraType === EXTRA_TYPES.WIDE && event.countsBall === true) {
    errors.push('Wide should not count as a ball')
  }

  // No-ball doesn't count as ball (ICC rule)
  if (event.extraType === EXTRA_TYPES.NO_BALL && event.countsBall === true) {
    errors.push('No-ball should not count as a ball')
  }

  // Check runs consistency
  const totalRuns = Number(event.runs || 0)
  const batRuns = Number(event.batRuns || 0)

  if (event.extraType === EXTRA_TYPES.WIDE) {
    // Wide: minimum 1 run (the wide itself)
    if (totalRuns < 1) {
      errors.push('Wide must have at least 1 run')
    }
  }

  if (event.extraType === EXTRA_TYPES.NO_BALL) {
    // No-ball: minimum 1 run (the no-ball itself)
    if (totalRuns < 1) {
      errors.push('No-ball must have at least 1 run')
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Get actual balls that count for this event
 */
export function getCountsBall(event: BallEvent): boolean {
  // Wides never count
  if (event.extraType === EXTRA_TYPES.WIDE) return false

  // No-balls never count
  if (event.extraType === EXTRA_TYPES.NO_BALL) return false

  // Use explicit countsBall if provided
  if (event.countsBall !== undefined) return event.countsBall

  // Default: legal balls count
  return true
}

