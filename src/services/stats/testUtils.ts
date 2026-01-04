/**
 * Test Utilities for Statistics Engine
 * Automated test functions to verify ICC-compliant calculations
 */

import { shouldCountInnings } from './iccDefinitions'
import { calculateBattingStats } from './battingCalculator'
import { calculateBowlingStats } from './bowlingCalculator'
import { countMatches } from './matchCounter'
import { detectNotOut } from './notOutDetector'
import { validateBallEvent } from './validateBallEvent'

/**
 * Test innings counting logic
 */
export function testInningsCounting() {
  const tests = [
    {
      name: 'Player faced 1 ball',
      summary: { balls: 1, runs: 5 },
      expected: true,
    },
    {
      name: 'Player run out on 0 balls',
      summary: { balls: 0, runs: 0, dismissed: true, wicketType: 'run-out' },
      expected: true,
    },
    {
      name: 'Player never batted',
      summary: { balls: 0, runs: 0 },
      expected: false,
    },
    {
      name: 'Player faced wide (does not count as ball)',
      summary: { balls: 0, runs: 1, widesFaced: 1 },
      expected: false, // Wides don't count as balls faced
    },
  ]

  const results = tests.map((test) => {
    const result = shouldCountInnings(test.summary)
    return {
      ...test,
      result,
      passed: result === test.expected,
    }
  })

  return {
    allPassed: results.every((r) => r.passed),
    results,
  }
}

/**
 * Test batting average calculation
 */
export function testBattingAverage() {
  const tests = [
    {
      name: 'Normal average',
      runs: 100,
      innings: 10,
      notOuts: 2,
      expected: 12.5, // 100 / (10 - 2) = 12.5
    },
    {
      name: 'All not out',
      runs: 100,
      innings: 5,
      notOuts: 5,
      expected: null, // Should return null (display as "—")
    },
    {
      name: 'No dismissals but has runs',
      runs: 50,
      innings: 3,
      notOuts: 3,
      expected: null,
    },
  ]

  const results = tests.map((test) => {
    const { calculateBattingAverage } = require('./iccDefinitions')
    const result = calculateBattingAverage(test.runs, test.innings, test.notOuts)
    const passed = result === test.expected || 
                   (result !== null && Math.abs(result - test.expected) < 0.01)
    return {
      ...test,
      result,
      passed,
    }
  })

  return {
    allPassed: results.every((r) => r.passed),
    results,
  }
}

/**
 * Test ball validation
 */
export function testBallValidation() {
  const tests = [
    {
      name: 'Valid legal ball',
      event: { runs: 4, countsBall: true },
      expectedValid: true,
    },
    {
      name: 'Wide with wicket (invalid)',
      event: { extraType: 'wide', isWicket: true, wicketType: 'bowled' },
      expectedValid: false,
    },
    {
      name: 'Wide that counts as ball (invalid)',
      event: { extraType: 'wide', countsBall: true },
      expectedValid: false,
    },
    {
      name: 'No-ball that counts as ball (invalid)',
      event: { extraType: 'no-ball', countsBall: true },
      expectedValid: false,
    },
  ]

  const results = tests.map((test) => {
    const validation = validateBallEvent(test.event)
    return {
      ...test,
      result: validation.isValid,
      passed: validation.isValid === test.expectedValid,
      errors: validation.errors,
    }
  })

  return {
    allPassed: results.every((r) => r.passed),
    results,
  }
}

/**
 * Test overs calculation
 */
export function testOversCalculation() {
  const { ballsToOvers, oversToBalls } = require('./iccDefinitions')
  
  const tests = [
    {
      name: '6 balls = 1.0 overs',
      balls: 6,
      expectedOvers: '1.0',
    },
    {
      name: '13 balls = 2.1 overs',
      balls: 13,
      expectedOvers: '2.1',
    },
    {
      name: '0 balls = 0.0 overs',
      balls: 0,
      expectedOvers: '0.0',
    },
  ]

  const results = tests.map((test) => {
    const overs = ballsToOvers(test.balls)
    const backToBalls = oversToBalls(overs)
    return {
      ...test,
      result: overs,
      backToBalls,
      passed: overs === test.expectedOvers && backToBalls === test.balls,
    }
  })

  return {
    allPassed: results.every((r) => r.passed),
    results,
  }
}

/**
 * Test best bowling comparison
 */
export function testBestBowling() {
  const { compareBestBowling } = require('./iccDefinitions')
  
  const tests = [
    {
      name: 'Higher wickets is better',
      wickets1: 3,
      runs1: 30,
      wickets2: 5,
      runs2: 50,
      expected: 1, // Second is better (positive)
    },
    {
      name: 'Same wickets, lower runs is better',
      wickets1: 3,
      runs1: 30,
      wickets2: 3,
      runs2: 20,
      expected: -1, // First is better (negative)
    },
    {
      name: 'Equal figures',
      wickets1: 3,
      runs1: 30,
      wickets2: 3,
      runs2: 30,
      expected: 0,
    },
  ]

  const results = tests.map((test) => {
    const result = compareBestBowling(
      test.wickets1,
      test.runs1,
      test.wickets2,
      test.runs2
    )
    return {
      ...test,
      result,
      passed: Math.sign(result) === Math.sign(test.expected),
    }
  })

  return {
    allPassed: results.every((r) => r.passed),
    results,
  }
}

/**
 * Test not-out detection
 */
export function testNotOutDetection() {
  const tests = [
    {
      name: 'Explicitly not out',
      innings: { notOut: true },
      context: {},
      expected: true,
    },
    {
      name: 'Explicitly dismissed',
      innings: { dismissed: true, wicketType: 'bowled' },
      context: {},
      expected: false,
    },
    {
      name: 'Retired hurt',
      innings: { wicketType: 'retired-hurt' },
      context: {},
      expected: true,
    },
    {
      name: 'Target reached',
      innings: { runs: 50, balls: 30 },
      context: { targetReached: true, inningsComplete: true },
      expected: true,
    },
    {
      name: 'Overs completed',
      innings: { runs: 30, balls: 20 },
      context: { oversComplete: true, inningsComplete: true },
      expected: true,
    },
  ]

  const results = tests.map((test) => {
    const result = detectNotOut(test.innings, test.context)
    return {
      ...test,
      result,
      passed: result === test.expected,
    }
  })

  return {
    allPassed: results.every((r) => r.passed),
    results,
  }
}

/**
 * Run all tests
 */
export function runAllTests() {
  const testResults = {
    inningsCounting: testInningsCounting(),
    battingAverage: testBattingAverage(),
    ballValidation: testBallValidation(),
    oversCalculation: testOversCalculation(),
    bestBowling: testBestBowling(),
    notOutDetection: testNotOutDetection(),
  }

  const allPassed = Object.values(testResults).every((result) => result.allPassed)

  return {
    allPassed,
    results: testResults,
    summary: {
      total: Object.keys(testResults).length,
      passed: Object.values(testResults).filter((r) => r.allPassed).length,
      failed: Object.values(testResults).filter((r) => !r.allPassed).length,
    },
  }
}

