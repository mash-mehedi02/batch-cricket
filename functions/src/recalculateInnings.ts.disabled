/**
 * Innings Recalculation Logic for Cloud Functions
 * Server-side implementation matching frontend engine
 */

import { Ball, InningsStats } from '../types'
import { formatOvers, calculateRunRate } from '../utils/icc-rules'

export interface RecalculateOptions {
  balls: Ball[]
  matchId: string
  inningId: 'teamA' | 'teamB'
  matchData: {
    oversLimit: number
    currentStrikerId?: string
    currentNonStrikerId?: string
    currentBowlerId?: string
    target?: number
  }
}

export function recalculateInningsCloud(options: RecalculateOptions): InningsStats {
  const { balls, matchId, inningId, matchData } = options
  
  // This should be a copy of the frontend logic
  // For now, simplified version
  let totalRuns = 0
  let totalWickets = 0
  let legalBalls = 0

  for (const ball of balls) {
    if (ball.isLegal) {
      legalBalls++
    }
    totalRuns += ball.totalRuns || 0
    if (ball.wicket) {
      totalWickets++
    }
  }

  const overs = formatOvers(legalBalls)
  const currentRunRate = calculateRunRate(totalRuns, legalBalls)

  return {
    matchId,
    inningId,
    totalRuns,
    totalWickets,
    legalBalls,
    overs,
    ballsInCurrentOver: legalBalls % 6,
    currentRunRate,
    requiredRunRate: null,
    remainingBalls: matchData.oversLimit * 6 - legalBalls,
    target: matchData.target || null,
    projectedTotal: null,
    lastBallSummary: null,
    partnership: { runs: 0, balls: 0, overs: '0.0' },
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
    fallOfWickets: [],
    batsmanStats: [],
    bowlerStats: [],
    recentOvers: [],
    currentOverBalls: [],
    currentStrikerId: matchData.currentStrikerId || '',
    nonStrikerId: matchData.currentNonStrikerId || '',
    currentBowlerId: matchData.currentBowlerId || '',
    lastUpdated: null as any,
    updatedAt: new Date().toISOString(),
  }
}

