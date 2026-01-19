/**
 * Innings Recalculation Engine
 * ICC-compliant calculation of all innings statistics
 * This is the SINGLE SOURCE OF TRUTH for innings data
 */

import { Ball, InningsStats, BatsmanStats, BowlerStats, FallOfWicket, RecentOver, Partnership } from '@/types'
import {
  isLegalBall,
  countsTowardsBallsFaced,
  runsCreditedToBatsman,
  runsCreditedToBowler,
  wicketCreditedToBowler,
  formatOvers,
  calculateRunRate,
  calculateRequiredRunRate,
  calculateProjectedScore,
  getBallBadge,
  shouldRotateStrike,
} from '@/utils/icc-rules'
import { Timestamp } from 'firebase/firestore'

interface RecalculateOptions {
  balls: Ball[]
  matchId: string
  inningId: 'teamA' | 'teamB'
  matchData: {
    oversLimit: number
    currentStrikerId?: string
    currentNonStrikerId?: string
    currentBowlerId?: string
    target?: number // For second innings
  }
}

/**
 * Recalculate all innings statistics from balls
 * This function is ICC-compliant and handles all edge cases
 */
export function recalculateInnings(options: RecalculateOptions): InningsStats {
  const { balls, matchId, inningId, matchData } = options
  
  // Sort balls by sequence (chronological order)
  const sortedBalls = [...balls].sort((a, b) => a.sequence - b.sequence)
  
  // Initialize counters
  let totalRuns = 0
  let totalWickets = 0
  let legalBalls = 0
  let partnershipRuns = 0
  let partnershipBalls = 0
  let currentOverNumber = 1
  let legalBallsInCurrentOver = 0
  
  // Maps for aggregating stats
  const batsmanStatsMap = new Map<string, BatsmanStats>()
  const bowlerStatsMap = new Map<string, BowlerStats>()
  const fallOfWickets: FallOfWicket[] = []
  const oversMap = new Map<number, RecentOver>()
  
  // Track current partnership
  let currentStrikerId = matchData.currentStrikerId || ''
  let currentNonStrikerId = matchData.currentNonStrikerId || ''
  let lastWicketSequence = 0
  
  // Track extras
  const extras = {
    wides: 0,
    noBalls: 0,
    byes: 0,
    legByes: 0,
    penalty: 0,
  }
  
  // Process each ball
  for (const ball of sortedBalls) {
    const isLegal = isLegalBall(ball)
    const runsOffBat = runsCreditedToBatsman(ball)
    const totalBallRuns = ball.totalRuns

    // Capture over number BEFORE potential increment (so 6th legal ball belongs to the current over)
    const overNumberForBall = currentOverNumber

    // Ensure striker/non-striker are initialized (and corrected) from the ball stream.
    // This prevents bad match pointers from causing wrong strike behaviour.
    if (!currentStrikerId && ball.batsmanId) currentStrikerId = ball.batsmanId
    if (!currentNonStrikerId && ball.nonStrikerId) currentNonStrikerId = ball.nonStrikerId
    if (ball.batsmanId && currentStrikerId && ball.batsmanId !== currentStrikerId) currentStrikerId = ball.batsmanId
    if (ball.nonStrikerId && currentNonStrikerId && ball.nonStrikerId !== currentNonStrikerId) currentNonStrikerId = ball.nonStrikerId

    // Track whether this delivery completes the over (apply end-of-over swap AFTER ball processing)
    let endOfOver = false
    
    // Update totals
    totalRuns += totalBallRuns
    extras.wides += ball.extras.wides
    extras.noBalls += ball.extras.noBalls
    extras.byes += ball.extras.byes
    extras.legByes += ball.extras.legByes
    extras.penalty += ball.extras.penalty
    
    // Handle legal balls
    if (isLegal) {
      legalBalls += 1
      partnershipBalls += 1
      legalBallsInCurrentOver += 1
      
      // Check if over is complete
      if (legalBallsInCurrentOver >= 6) {
        endOfOver = true
      }
    }
    
    // Update batsman stats
    if (countsTowardsBallsFaced(ball)) {
      const batsmanId = ball.batsmanId
      if (!batsmanStatsMap.has(batsmanId)) {
        batsmanStatsMap.set(batsmanId, {
          batsmanId,
          batsmanName: '', // Will be populated from player data
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          strikeRate: 0,
          notOut: true,
        })
      }
      
      const stats = batsmanStatsMap.get(batsmanId)!
      
      // For leg-bye run-outs, runs completed before run-out should not be added to batter's individual score
      // Check if this is a run-out caused by a leg-bye delivery
      let runsToAdd = runsOffBat;
      if (ball.wicket && ball.wicket.type === 'run-out' && ball.extras.legByes > 0) {
        // This is a leg-bye run-out, don't add the runs to the batter's individual score
        runsToAdd = 0;
      }
      
      stats.runs += runsToAdd
      stats.balls += 1
      if (runsToAdd === 4) stats.fours += 1
      if (runsToAdd === 6) stats.sixes += 1
    }
    
    // Update bowler stats
    const bowlerRuns = runsCreditedToBowler(ball)
    const bowlerWicket = ball.wicket && wicketCreditedToBowler(ball)
    
    if (!bowlerStatsMap.has(ball.bowlerId)) {
      bowlerStatsMap.set(ball.bowlerId, {
        bowlerId: ball.bowlerId,
        bowlerName: '', // Will be populated from player data
        ballsBowled: 0,
        overs: '0.0',
        runsConceded: 0,
        wickets: 0,
        maidens: 0,
        economy: 0,
        average: null,
        strikeRate: null,
      })
    }
    
    const bowlerStats = bowlerStatsMap.get(ball.bowlerId)!
    if (isLegal) {
      bowlerStats.ballsBowled += 1
    }
    
    // For no-ball run-outs, runs completed before run-out should not be credited to bowler
    // According to ICC rules, no-balls should not charge the bowler for runs
    let runsToChargeBowler = bowlerRuns;
    if (ball.wicket && ball.wicket.type === 'run-out' && ball.extras.noBalls > 0) {
      // Calculate runs that should not be charged to bowler on no-ball run-out
      // Only the automatic no-ball run + bat runs should be charged to bowler
      // Running runs should not be charged if it resulted in a run-out
      const automaticNoBallRun = ball.extras.noBalls || 0;
      const batRuns = ball.runsOffBat || 0;
      const noBallRunsChargedToBowler = automaticNoBallRun + batRuns;
      runsToChargeBowler = Math.min(bowlerRuns, noBallRunsChargedToBowler);
    }
    
    bowlerStats.runsConceded += runsToChargeBowler
    if (bowlerWicket) {
      bowlerStats.wickets += 1
    }
    
    // Handle wicket
    if (ball.wicket) {
      totalWickets += 1
      const dismissedId = ball.wicket.dismissedPlayerId
      
      // Update batsman stats
      if (batsmanStatsMap.has(dismissedId)) {
        const stats = batsmanStatsMap.get(dismissedId)!
        stats.notOut = false
        // Build dismissal string
        const dismissalType = ball.wicket.type
        const bowlerName = bowlerStats.bowlerName
        const fielderName = ball.wicket.fielderId ? '' : '' // TODO: Get fielder name
        stats.dismissal = formatDismissal(dismissalType, bowlerName, fielderName)
      }
      
      // Add to fall of wickets
      fallOfWickets.push({
        wicket: totalWickets,
        runs: totalRuns,
        over: formatOvers(legalBalls),
        batsmanId: dismissedId,
        batsmanName: '', // Will be populated
        dismissal: '', // Will be populated
      })
      
      // Reset partnership
      partnershipRuns = 0
      partnershipBalls = 0
      lastWicketSequence = ball.sequence
      
      // Update striker if dismissed
      if (dismissedId === currentStrikerId) {
        currentStrikerId = '' // New batsman will come in
      } else if (dismissedId === currentNonStrikerId) {
        currentNonStrikerId = '' // New batsman will come in
      }
    } else {
      // Update partnership
      partnershipRuns += totalBallRuns
      if (shouldRotateStrike(ball)) {
        // Swap striker and non-striker (odd running runs)
        ;[currentStrikerId, currentNonStrikerId] = [currentNonStrikerId, currentStrikerId]
      }
    }
    
    // Handle special case: when a wicket occurs on a wide ball (e.g. run-out while attempting runs)
    // In this case, the runs from the wide ball (except the automatic 1) should not be added to the dismissed batter's score
    if (ball.wicket && ball.extras.wides > 0) {
      const dismissedId = ball.wicket.dismissedPlayerId;
      if (batsmanStatsMap.has(dismissedId)) {
        const stats = batsmanStatsMap.get(dismissedId)!;
        // If the batter got out on a wide ball, ensure no runs are added to their individual score
        // The runs would have been added to the team total via totalBallRuns
        // but should not be in the individual batter's score if they were out
        if (ball.wicket.type === 'run-out' && ball.runsOffBat > 0) {
          // For wide ball run-outs, subtract the runs that were added to the batter's score
          // if they were attempting runs and got out
          stats.runs = Math.max(0, stats.runs - ball.runsOffBat);
        }
      }
    }

    // End-of-over strike swap (ICC rule), applied after delivery-specific rotation
    if (endOfOver) {
      ;[currentStrikerId, currentNonStrikerId] = [currentNonStrikerId, currentStrikerId]
    }
    
    // Update recent overs
    if (!oversMap.has(overNumberForBall)) {
      oversMap.set(overNumberForBall, {
        overNumber: overNumberForBall,
        balls: [],
        deliveries: [],
        totalRuns: 0,
        isLocked: false,
      })
    }
    
    const currentOver = oversMap.get(overNumberForBall)!
    const badge = getBallBadge(ball)
    currentOver.deliveries = (currentOver as any).deliveries || []
    ;(currentOver as any).deliveries.push({
      value: badge.value,
      type: badge.type,
      runsOffBat,
      isLegal,
    })
    
    if (isLegal) {
      currentOver.balls.push({
        value: badge.value,
        type: badge.type,
        runsOffBat,
      })
    } else if (ball.extras.wides > 0 || ball.extras.noBalls > 0) {
      currentOver.extras = currentOver.extras || []
      currentOver.extras.push({
        badge: badge.value,
        runs: totalBallRuns,
      })
    }
    
    currentOver.totalRuns += totalBallRuns
    
    // Mark over as locked if complete
    if (currentOver.balls.length >= 6) {
      currentOver.isLocked = true
    }

    // Advance to next over AFTER recording the 6th legal delivery in the correct over
    if (endOfOver) {
      legalBallsInCurrentOver = 0
      currentOverNumber += 1
    }
  }
  
  // Finalize bowler stats
  bowlerStatsMap.forEach((stats) => {
    stats.overs = formatOvers(stats.ballsBowled)
    stats.economy = stats.ballsBowled > 0 
      ? calculateRunRate(stats.runsConceded, stats.ballsBowled)
      : 0
    stats.average = stats.wickets > 0 ? stats.runsConceded / stats.wickets : null
    stats.strikeRate = stats.wickets > 0 ? stats.ballsBowled / stats.wickets : null
    // TODO: Calculate maidens (overs with 0 runs)
  })
  
  // Finalize batsman stats
  batsmanStatsMap.forEach((stats) => {
    stats.strikeRate = stats.balls > 0 ? (stats.runs / stats.balls) * 100 : 0
  })
  
  // Calculate run rates
  const currentRunRate = calculateRunRate(totalRuns, legalBalls)
  const remainingBalls = matchData.oversLimit * 6 - legalBalls
  const target = matchData.target || null
  const runsNeeded = target ? target - totalRuns : null
  const requiredRunRate = runsNeeded !== null && runsNeeded > 0
    ? calculateRequiredRunRate(runsNeeded, remainingBalls)
    : null
  
  // Calculate projected score
  const projectedTotal = calculateProjectedScore(
    totalRuns,
    legalBalls,
    matchData.oversLimit
  )
  
  // Build recent overs array (sorted)
  const recentOvers = Array.from(oversMap.values()).sort((a, b) => a.overNumber - b.overNumber)
  
  // Get current over balls
  const currentOver = oversMap.get(currentOverNumber) || {
    overNumber: currentOverNumber,
    balls: [],
    totalRuns: 0,
    isLocked: false,
  }
  
  // Last ball summary
  const lastBall = sortedBalls[sortedBalls.length - 1]
  const lastBallSummary = lastBall ? {
    runs: lastBall.totalRuns,
    isWicket: !!lastBall.wicket,
    isBoundary: lastBall.runsOffBat === 4 || lastBall.runsOffBat === 6,
  } : null
  
  // Build innings stats
  const inningsStats: InningsStats = {
    matchId,
    inningId,
    totalRuns,
    totalWickets,
    legalBalls,
    overs: formatOvers(legalBalls),
    ballsInCurrentOver: legalBallsInCurrentOver,
    currentRunRate,
    requiredRunRate,
    remainingBalls: remainingBalls > 0 ? remainingBalls : 0,
    target,
    projectedTotal,
    lastBallSummary,
    partnership: {
      runs: partnershipRuns,
      balls: partnershipBalls,
      overs: formatOvers(partnershipBalls),
    },
    extras,
    fallOfWickets,
    batsmanStats: Array.from(batsmanStatsMap.values()),
    bowlerStats: Array.from(bowlerStatsMap.values()),
    recentOvers,
    currentOverBalls: currentOver.balls,
    currentStrikerId: currentStrikerId, // Don't fall back to matchData if currentStrikerId is empty after wicket
    nonStrikerId: currentNonStrikerId, // Don't fall back to matchData if nonStrikerId is empty after wicket
    currentBowlerId: matchData.currentBowlerId || '',
    lastUpdated: Timestamp.now(),
    updatedAt: new Date().toISOString(),
  }
  
  return inningsStats
}

/**
 * Format dismissal string (ICC format)
 */
function formatDismissal(type: string, bowlerName: string, fielderName?: string): string {
  const dismissals: Record<string, (b: string, f?: string) => string> = {
    'bowled': (b) => `b ${b}`,
    'caught': (b, f) => f ? `c ${f} b ${b}` : `c b ${b}`,
    'lbw': (b) => `lbw b ${b}`,
    'run-out': (b, f) => f ? `run out (${f})` : 'run out',
    'stumped': (b) => `st ${b}`,
    'hit-wicket': (b) => `hit wicket b ${b}`,
    'obstructing-field': () => 'obstructing the field',
    'retired': () => 'retired',
  }
  
  const formatter = dismissals[type.toLowerCase()] || ((b) => `b ${b}`)
  return formatter(bowlerName, fielderName)
}

