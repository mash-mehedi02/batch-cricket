/**
 * ICC-Compliant Statistics Engine
 * Central export for all statistics modules
 */

// Core definitions and utilities
export * from './iccDefinitions'
export * from './validateBallEvent'
export { detectNotOut, getNotOutFromSummary } from './notOutDetector'
export type { PlayerInnings } from './notOutDetector'
// Re-export MatchContext from notOutDetector (canonical source)
export type { MatchContext } from './notOutDetector'

// Calculators
export * from './battingCalculator'
export * from './bowlingCalculator'

// Aggregators
export * from './matchCounter'
export { aggregateBySeason } from './seasonAggregator'
// Re-export MatchWithSummary from seasonAggregator (canonical source)
export type { MatchWithSummary } from './seasonAggregator'
export * from './careerAggregator'

// Test utilities
export * from './testUtils'
