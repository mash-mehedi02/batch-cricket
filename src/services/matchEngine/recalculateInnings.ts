/**
 * Innings Recalculation Engine
 * ICC-Compliant real-time innings statistics calculation
 * 
 * This module recalculates ALL innings statistics from ball events
 * following strict ICC rules for legal balls, wickets, runs, and extras.
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore'
import { db } from '../../config/firebase'

const MATCHES_COLLECTION = 'matches'
const BALLS_SUBCOLLECTION = 'balls'
const INNINGS_SUBCOLLECTION = 'innings'

/**
 * Ball Event Interface (ICC Standard)
 */
export interface BallEvent {
  id?: string
  runs: number
  batRuns?: number
  extraRuns?: number
  isLegal: boolean // true = legal delivery, false = wide/no-ball
  isWide?: boolean
  isNoBall?: boolean
  isWicket?: boolean
  wicketType?: string // 'bowled', 'caught', 'run-out', etc.
  dismissedBatsmanId?: string
  batsmanId: string
  bowlerId: string
  nonStrikerId?: string
  timestamp?: any
  over?: string
  ball?: number
  extraType?: string
  countsBall?: boolean // Legacy field - use isLegal
  creditRunsToBowler?: boolean
}

/**
 * Ball in over representation for Recent Overs display
 */
export interface OverBall {
  value: string // Display value: '0', '1', '4', '6', 'W', 'wd', 'nb', etc.
  type: 'normal' | 'wide' | 'noball' | 'wicket' | 'bye' | 'legbye' // Type of ball
  runsOffBat?: number // Runs scored off bat (for normal balls)
}

/**
 * Recent Over representation
 */
export interface RecentOver {
  overNumber: number // 1-based over number
  balls: OverBall[] // Balls in this over (max 6 legal balls, extras shown separately)
  extras?: Array<{ badge: string; runs: number }> // Wides/no-balls that don't count as balls
  totalRuns: number // Total runs scored in this over
  isLocked: boolean // Whether over is complete (6 legal balls)
  innings: 'teamA' | 'teamB'
}

/**
 * Innings Statistics Interface
 */
export interface InningsStats {
  matchId: string
  inningId: 'teamA' | 'teamB'
  totalRuns: number
  totalWickets: number
  legalBalls: number
  overs: string // Format: "x.y"
  ballsInCurrentOver: number // 0-5 legal balls in current incomplete over
  currentRunRate: number
  requiredRunRate: number | null
  remainingBalls: number | null
  remainingRuns: number | null
  target: number | null
  projectedTotal: number | null
  lastBallSummary: string | null
  partnership: {
    runs: number
    balls: number
    overs: string
  }
  extras: {
    byes: number
    legByes: number
    wides: number
    noBalls: number
    penalty: number
  }
  fallOfWickets: Array<{
    wicket: number
    score: number
    over: string
    batsmanId: string
    batsmanName: string
    dismissal: string
  }>
  batsmanStats: Array<{
    batsmanId: string
    batsmanName: string
    runs: number
    balls: number
    fours: number
    sixes: number
    strikeRate: number
    dismissal?: string
    notOut: boolean
  }>
  bowlerStats: Array<{
    bowlerId: string
    bowlerName: string
    ballsBowled: number
    overs: string
    runsConceded: number
    wickets: number
    economy: number
    average: number | null
    strikeRate: number | null
  }>
  recentOvers: RecentOver[] // Recent overs array for UI display (in chronological order, left→right)
  currentOverBalls: OverBall[] // Current incomplete over balls
  currentStrikerId: string
  nonStrikerId: string
  currentBowlerId: string
  lastUpdated: Timestamp
  updatedAt: string
}

/**
 * Convert balls to overs format (ICC Standard)
 * Example: 18 balls = "3.0", 19 balls = "3.1"
 */
function ballsToOvers(balls: number): string {
  const totalBalls = Number.isFinite(balls) && balls >= 0 ? Math.floor(balls) : 0
  const overs = Math.floor(totalBalls / 6)
  const remaining = totalBalls % 6
  return `${overs}.${remaining}`
}

/**
 * Parse ball event to determine ICC-compliant properties
 */
function parseBallEvent(ball: any): BallEvent & { 
  sequence?: number
  runsOffBat?: number
  extras?: { wides?: number; noBalls?: number; byes?: number; legByes?: number; penalty?: number }
  wicket?: { type?: string; dismissedPlayerId?: string; creditedToBowler?: boolean; fielderId?: string }
  freeHit?: boolean
} {
  // Determine if ball is legal (ICC Rule: Wide and No-ball are NOT legal)
  const isWide = ball.extraType === 'wide' || ball.isWide === true
  const isNoBall = ball.extraType === 'no-ball' || ball.isNoBall === true || ball.extraType === 'noBall'
  const isLegal = ball.isLegal !== false && !isWide && !isNoBall
  
  // Determine runs
  // Priority: Use ball.runs (total), otherwise calculate from components
  const runsOffBat = Number(ball.runsOffBat || ball.batRuns || 0)
  const rawExtras = ball.extras || {}
  // Normalize legacy keys (legBye/legbye/bye) -> (legByes/byes)
  const extras = {
    wides: Number(rawExtras.wides || 0),
    noBalls: Number(rawExtras.noBalls || 0),
    byes: Number(rawExtras.byes || rawExtras.bye || 0),
    legByes: Number(rawExtras.legByes || rawExtras.legBye || rawExtras.legbye || 0),
    penalty: Number(rawExtras.penalty || 0),
  }
  const totalExtras = Number(extras.wides || 0) + Number(extras.noBalls || 0) + Number(extras.byes || 0) + Number(extras.legByes || 0) + Number(extras.penalty || 0)
  const runs = ball.runs !== undefined && ball.runs !== null ? Number(ball.runs) : (runsOffBat + totalExtras)
  const batRuns = runsOffBat
  const extraRuns = runs - batRuns
  
  // Determine wicket
  const wicket = ball.wicket || {}
  const isWicket = ball.isWicket === true || Boolean(wicket.type) || Boolean(ball.wicketType) || Boolean(ball.dismissal)
  const wicketType = wicket.type || ball.wicketType || ball.dismissal || ''
  const isRunOut = wicketType.toLowerCase().includes('run out') || 
                   wicketType.toLowerCase().includes('runout') ||
                   wicketType.toLowerCase().includes('ro')
  
  return {
    id: ball.id,
    sequence: ball.sequence,
    runs,
    batRuns,
    extraRuns,
    isLegal,
    isWide,
    isNoBall,
    isWicket,
    wicketType,
    dismissedBatsmanId: wicket.dismissedPlayerId || ball.dismissedBatsmanId || ball.dismissedPlayerId || (isWicket ? (ball.batsmanId || ball.strikerId) : undefined),
    batsmanId: ball.batsmanId || ball.strikerId || '',
    bowlerId: ball.bowlerId || '',
    nonStrikerId: ball.nonStrikerId || '',
    timestamp: ball.timestamp,
    over: ball.over,
    ball: ball.ball,
    extraType: ball.extraType,
    countsBall: isLegal,
    creditRunsToBowler: wicket.creditedToBowler !== false && !isRunOut, // Default true, except for run-outs
    runsOffBat,
    extras,
    wicket,
    freeHit: ball.freeHit === true,
  }
}

/**
 * Convert ball to display badge for Recent Overs
 */
function ballToBadge(ball: ReturnType<typeof parseBallEvent>): { value: string; type: OverBall['type'] } {
  if (ball.isWicket) {
    return { value: 'W', type: 'wicket' }
  }
  if (ball.isWide) {
    const runs = ball.runs > 1 ? ball.runs.toString() : ''
    return { value: runs ? `wd+${runs}` : 'wd', type: 'wide' }
  }
  if (ball.isNoBall) {
    const runs = (ball.runsOffBat || 0) + (ball.extras?.noBalls || 0)
    if (runs > 1) {
      return { value: `nb+${runs}`, type: 'noball' }
    }
    return { value: 'nb', type: 'noball' }
  }
  // Byes / Leg-byes (legal deliveries, but runs are extras)
  const lb = Number(ball.extras?.legByes || 0)
  if (lb > 0) {
    return { value: `${lb}lb`, type: 'legbye' }
  }
  const by = Number(ball.extras?.byes || 0)
  if (by > 0) {
    return { value: `${by}b`, type: 'bye' }
  }
  const runs = ball.runsOffBat || 0
  if (runs === 0) {
    return { value: '0', type: 'normal' }
  }
  return { value: runs.toString(), type: 'normal' }
}

/**
 * Recalculate innings statistics from all ball events
 * ICC-Compliant calculation following all rules
 * 
 * This is the SINGLE SOURCE OF TRUTH for all innings aggregations.
 * All team/innings totals MUST be computed here and written to innings documents.
 * 
 * @param matchId - Match document ID
 * @param inningId - Inning ID ('teamA' or 'teamB')
 * @param options - Optional parameters
 * @param options.useTransaction - Use Firestore transaction (default: false)
 */
export async function recalculateInnings(
  matchId: string,
  inningId: 'teamA' | 'teamB',
  options?: { useTransaction?: boolean }
): Promise<InningsStats> {
  const { useTransaction = false } = options || {}
  try {
    console.log(`[MatchEngine] Recalculating innings ${inningId} for match ${matchId}`)

    // Get match data for context
    const matchRef = doc(db, MATCHES_COLLECTION, matchId)
    const matchDoc = await getDoc(matchRef)
    const matchData = matchDoc.exists() ? matchDoc.data() : null
    
    if (!matchData) {
      throw new Error(`Match ${matchId} not found`)
    }

    // Fetch all balls for this innings ordered by sequence
    let balls: ReturnType<typeof parseBallEvent>[] = []
    
    try {
      const ballsRef = collection(db, MATCHES_COLLECTION, matchId, BALLS_SUBCOLLECTION)
      
      // Try sequence orderBy first (most reliable)
      let ballsQuery
      try {
        ballsQuery = query(
          ballsRef,
          where('innings', '==', inningId),
          orderBy('sequence', 'asc')
        )
      } catch (seqError) {
        // Fallback to timestamp if sequence index doesn't exist
        try {
          ballsQuery = query(
            ballsRef,
            where('innings', '==', inningId),
            orderBy('timestamp', 'asc')
          )
        } catch (tsError) {
          // Last resort: no orderBy
          ballsQuery = query(
            ballsRef,
            where('innings', '==', inningId)
          )
        }
      }
      
      const ballsSnapshot = await getDocs(ballsQuery)
      ballsSnapshot.forEach((ballDoc) => {
        const parsed = parseBallEvent({ id: ballDoc.id, ...ballDoc.data() })
        balls.push(parsed)
      })
      
      // Sort by sequence if available, otherwise by timestamp
      balls.sort((a, b) => {
        if (a.sequence !== undefined && b.sequence !== undefined && a.sequence !== b.sequence) {
          return a.sequence - b.sequence
        }
        const aTime = a.timestamp?.toMillis?.() || (a.timestamp ? new Date(a.timestamp).getTime() : 0) || 0
        const bTime = b.timestamp?.toMillis?.() || (b.timestamp ? new Date(b.timestamp).getTime() : 0) || 0
        return aTime - bTime
      })
      
      console.log(`[MatchEngine] Fetched ${balls.length} balls from subcollection for ${inningId}`)
    } catch (subcollectionError) {
      // Fallback: Use recentBalls from match document
      console.log('[MatchEngine] Balls subcollection not found, using recentBalls array')
      const recentBalls = Array.isArray(matchData.recentBalls) ? matchData.recentBalls : []
      balls = recentBalls
        .filter((ball) => ball.innings === inningId || ball.team === inningId)
        .reverse() // recentBalls is stored newest first, reverse for chronological
        .map((ball, idx) => parseBallEvent({ ...ball, sequence: idx + 1 }))
      
      console.log(`[MatchEngine] Using ${balls.length} balls from recentBalls array`)
    }
    
    if (balls.length === 0) {
      console.warn(`[MatchEngine] ⚠️ No balls found for ${inningId}`)
    }

    // Get player names from match data
    const getPlayerName = (playerId: string): string => {
      const teamAPlayingXI = matchData.teamAPlayingXI || []
      const teamBPlayingXI = matchData.teamBPlayingXI || []
      const allPlayers = [...teamAPlayingXI, ...teamBPlayingXI]
      const player = allPlayers.find((p) => (p.playerId || p.id) === playerId)
      return player?.name || 'Unknown'
    }

    // Initialize aggregators
    let totalRuns = 0
    let totalWickets = 0
    let legalBalls = 0 // Only legal deliveries (excludes wides/no-balls)
    let partnershipRuns = 0 // Only runs off bat (not extras)
    let partnershipBalls = 0 // Only legal balls
    
    // Extras tracking
    const extras = {
      byes: 0,
      legByes: 0,
      wides: 0,
      noBalls: 0,
      penalty: 0,
    }
    
    // Trackers
    const fallOfWickets: InningsStats['fallOfWickets'] = []
    const batsmanStatsMap = new Map<string, {
      batsmanId: string
      batsmanName: string
      runs: number
      balls: number // Balls faced (ICC: wides don't count; no-balls DO count)
      fours: number
      sixes: number
      dismissal?: string
      notOut: boolean
    }>()
    const bowlerStatsMap = new Map<string, {
      bowlerId: string
      bowlerName: string
      ballsBowled: number // Only legal deliveries
      runsConceded: number // Includes wides/no-balls attributed to bowler
      wickets: number // Only when creditedToBowler === true
      currentOverRuns: number // For maiden calculation
      maidens: number
    }>()

    // Recent Overs tracking - group balls by over
    const oversMap = new Map<number, RecentOver>() // overNumber -> RecentOver

    // Process each ball chronologically
    balls.forEach((ball, index) => {
      // ICC Rule: Determine if ball is legal (wide and no-ball are NOT legal)
      const isWide =
        Number((ball as any)?.extras?.wides || 0) > 0 ||
        ball.isWide === true ||
        ball.extraType === 'wide'
      const isNoBall =
        Number((ball as any)?.extras?.noBalls || 0) > 0 ||
        ball.isNoBall === true ||
        ball.extraType === 'no-ball' ||
        ball.extraType === 'noBall'
      const isLegal = ball.isLegal !== false && !isWide && !isNoBall
      
      // Calculate runs from this ball BEFORE updating legalBalls (needed for over assignment)
      const runsOffBat = ball.runsOffBat || ball.batRuns || 0
      const totalBallRuns = ball.runs || (runsOffBat + (ball.extras?.wides || 0) + (ball.extras?.noBalls || 0) + (ball.extras?.byes || 0) + (ball.extras?.legByes || 0) + (ball.extras?.penalty || 0))
      
      // CRITICAL: Determine which over this ball belongs to BEFORE incrementing legalBalls
      // Over number calculation:
      // - For legal balls: overNumber = floor((legalBalls) / 6) + 1 (1-based)
      // - For wides/no-balls: use the same over as the current legal balls count (they don't increment legalBalls)
      // Example: 3 legal balls = Over 1 (floor(3/6) + 1 = 0 + 1 = 1)
      //          6 legal balls = Over 2 (floor(6/6) + 1 = 1 + 1 = 2)
      const currentOverNumber = Math.floor(legalBalls / 6) + 1
      
      // ICC Rule: Only legal deliveries count as legalBalls
      if (isLegal) {
        legalBalls += 1
        partnershipBalls += 1
      }
      
      // Determine which over this ball belongs to
      // For legal balls: calculate based on legalBalls AFTER increment
      // For wides/no-balls: use the over number BEFORE increment (same over)
      const overNumber = isLegal ? Math.floor((legalBalls - 1) / 6) + 1 : currentOverNumber
      
      // ICC Rule: Add runs (always count, even for extras)
      totalRuns += totalBallRuns
      
      // Partnership runs: only runs off bat (not extras)
      partnershipRuns += runsOffBat
      
      // Track extras breakdown
      if (ball.extras) {
        extras.byes += Number(ball.extras.byes || 0)
        extras.legByes += Number(ball.extras.legByes || 0)
        extras.wides += Number(ball.extras.wides || 0)
        extras.noBalls += Number(ball.extras.noBalls || 0)
        extras.penalty += Number(ball.extras.penalty || 0)
      }

      // Update batsman stats
      if (ball.batsmanId) {
        const batsmanId = ball.batsmanId
        if (!batsmanStatsMap.has(batsmanId)) {
          batsmanStatsMap.set(batsmanId, {
            batsmanId,
            batsmanName: getPlayerName(batsmanId),
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            notOut: true,
          })
        }
        const batsman = batsmanStatsMap.get(batsmanId)!
        
        // Add runs off bat (always count, even on no-ball)
        batsman.runs += runsOffBat
        
        // ICC Rule: Balls faced increments for all deliveries except wides.
        // No-ball counts as a ball faced (but does NOT count as a legal ball for overs).
        if (!isWide) batsman.balls += 1
        
        // Count boundaries
        if (runsOffBat === 4) batsman.fours += 1
        if (runsOffBat === 6) batsman.sixes += 1
        
        // Mark as dismissed if wicket
        if (ball.isWicket && ball.dismissedBatsmanId === batsmanId) {
          batsman.dismissal = ball.wicketType || 'Out'
          batsman.notOut = false
        }
      }

      // Update bowler stats
      if (ball.bowlerId) {
        const bowlerId = ball.bowlerId
        if (!bowlerStatsMap.has(bowlerId)) {
          bowlerStatsMap.set(bowlerId, {
            bowlerId,
            bowlerName: getPlayerName(bowlerId),
            ballsBowled: 0,
            runsConceded: 0,
            wickets: 0,
            maidens: 0,
            currentOverRuns: 0,
          })
        }
        const bowler = bowlerStatsMap.get(bowlerId)!
        
        // ICC Rule: Only legal deliveries count for bowler's ballsBowled
        if (isLegal) {
          const ballsInOver = bowler.ballsBowled % 6
          
          // If starting a new over, check if previous over was maiden
          if (ballsInOver === 0 && bowler.ballsBowled > 0 && bowler.currentOverRuns === 0) {
            bowler.maidens += 1
          }
          
          // Reset current over runs if starting new over
          if (ballsInOver === 0) {
            bowler.currentOverRuns = 0
          }
          
          bowler.ballsBowled += 1
        }
        
        // ICC Rule: Bowler gets runs (runsOffBat + wides + no-balls)
        // Byes and leg-byes do NOT count to bowler's runsConceded
        const bowlerRuns = runsOffBat + (isWide ? (ball.extras?.wides || 0) : 0) + (isNoBall ? (ball.extras?.noBalls || 0) : 0)
        bowler.runsConceded += bowlerRuns
        bowler.currentOverRuns += bowlerRuns
        
        // ICC Rule: Wickets credited to bowler only if creditedToBowler === true
        if (ball.isWicket && ball.creditRunsToBowler !== false) {
          bowler.wickets += 1
        }
      }

      // ICC Rule: Count wickets
      if (ball.isWicket) {
        totalWickets += 1
        
        // Record fall of wicket
        const wicketOver = ballsToOvers(legalBalls)
        const dismissedBatsmanId = ball.dismissedBatsmanId || ball.batsmanId
        fallOfWickets.push({
          wicket: totalWickets,
          score: totalRuns,
          over: wicketOver,
          batsmanId: dismissedBatsmanId,
          batsmanName: getPlayerName(dismissedBatsmanId),
          dismissal: ball.wicketType || 'Out',
        })

        // Reset partnership on wicket
        partnershipRuns = 0
        partnershipBalls = 0
      }
      
      // Add ball to Recent Overs
      if (!oversMap.has(overNumber)) {
        oversMap.set(overNumber, {
          overNumber,
          balls: [],
          extras: [],
          totalRuns: 0,
          isLocked: false,
          innings: inningId,
        })
      }
      
      const over = oversMap.get(overNumber)!
      const badge = ballToBadge(ball)
      
      // ICC Rule: Only legal balls go into the 6-ball slots
      // Wides/no-balls go to extras array but are shown in the same over
      if (isLegal) {
        over.balls.push({ value: badge.value, type: badge.type, runsOffBat })
      } else if (isWide || isNoBall) {
        // Add to extras array (shown separately but in same over)
        over.extras = over.extras || []
        over.extras.push({ badge: badge.value, runs: totalBallRuns })
      }
      
      over.totalRuns += totalBallRuns
      
      // Mark over as locked if it has 6 legal balls
      // Check legal balls in this over by counting balls in the over array
      if (over.balls.length >= 6) {
        over.isLocked = true
      }
    })

    // Calculate overs
    const overs = ballsToOvers(legalBalls)
    const ballsInCurrentOver = legalBalls % 6

    // Calculate Current Run Rate (CRR)
    const oversDecimal = legalBalls / 6
    const currentRunRate = oversDecimal > 0 ? totalRuns / oversDecimal : (legalBalls > 0 ? (totalRuns * 6) / legalBalls : 0)

    // Calculate Required Run Rate (RRR) for second innings
    let requiredRunRate: number | null = null
    let remainingBalls: number | null = null
    let remainingRuns: number | null = null
    let target: number | null = null
    let projectedTotal: number | null = null

    if (matchData.matchPhase === 'SecondInnings' && inningId === 'teamB') {
      const oversLimit = Number(matchData.oversLimit) || 50
      const maxBalls = oversLimit * 6
      
      // Get target from first innings
      const teamAScore = matchData.score?.teamA?.runs || matchData.runs1 || 0
      target = teamAScore + 1
      remainingRuns = target - totalRuns
      remainingBalls = Math.max(maxBalls - legalBalls, 0)
      
      // Check if match is finished
      const allWicketsDown = totalWickets >= 10
      const allOversCompleted = legalBalls >= maxBalls
      const targetAchieved = totalRuns >= target
      const isMatchFinished = allWicketsDown || allOversCompleted || targetAchieved
      
      if (isMatchFinished) {
        remainingBalls = 0
        requiredRunRate = targetAchieved ? 0 : null
      } else if (remainingBalls > 0 && remainingRuns > 0) {
        requiredRunRate = (remainingRuns / remainingBalls) * 6
      } else if (remainingRuns <= 0) {
        requiredRunRate = 0
      }
    }
    
    // Calculate projected total using current run rate
    if (oversDecimal > 0 && matchData.oversLimit) {
      const oversLimit = Number(matchData.oversLimit) || 50
      const oversLeft = oversLimit - oversDecimal
      if (oversLeft > 0) {
        projectedTotal = Math.round(totalRuns + (currentRunRate * oversLeft))
      } else {
        projectedTotal = totalRuns // Already completed all overs
      }
    }

    // Generate last ball summary
    let lastBallSummary: string | null = null
    if (balls.length > 0) {
      const lastBall = balls[balls.length - 1]
      const lastBatsmanName = getPlayerName(lastBall.batsmanId)
      if (lastBall.isWicket) {
        lastBallSummary = `Wicket! ${lastBatsmanName} ${lastBall.wicketType || 'out'}`
      } else if (lastBall.runsOffBat > 0) {
        lastBallSummary = `${lastBatsmanName} scores ${lastBall.runsOffBat} run${lastBall.runsOffBat > 1 ? 's' : ''}`
      } else if (lastBall.isWide) {
        lastBallSummary = `Wide ball, ${lastBall.runs} run${lastBall.runs > 1 ? 's' : ''}`
      } else if (lastBall.isNoBall) {
        lastBallSummary = `No ball, ${lastBall.runs} run${lastBall.runs > 1 ? 's' : ''}`
      } else {
        lastBallSummary = `Dot ball`
      }
    }

    // Get current striker, non-striker, and bowler from match data
    // CRITICAL: After recalculation, check if current bowler has completed over
    // and update currentBowlerId accordingly
    let currentStrikerId = matchData?.currentStrikerId || ''
    let nonStrikerId = matchData?.nonStrikerId || ''
    let currentBowlerId = matchData?.currentBowlerId || ''
    
    // CRITICAL: Check if current bowler has completed their over (6 legal balls)
    // If yes, bowler must be changed (set to empty string to force admin to select new bowler)
    const originalBowlerId = currentBowlerId
    if (currentBowlerId) {
      const currentBowlerStats = bowlerStats.find(b => b.bowlerId === currentBowlerId)
      if (currentBowlerStats) {
        const bowlerBallsInOver = currentBowlerStats.ballsBowled % 6
        // If bowler has completed exactly 6 legal balls (modulo = 0) and has bowled balls, over is complete
        if (bowlerBallsInOver === 0 && currentBowlerStats.ballsBowled > 0) {
          // Over complete - bowler must be changed
          currentBowlerId = ''
          console.log(`[MatchEngine] Over complete: Bowler ${originalBowlerId} (${currentBowlerStats.bowlerName}) has completed over (${currentBowlerStats.ballsBowled} balls bowled). Bowler must be changed.`)
        }
      }
    }

    // Build batsman stats array
    const batsmanStats = Array.from(batsmanStatsMap.values())
      .sort((a, b) => {
        // Dismissed first, then by runs desc
        if (!a.notOut && b.notOut) return -1
        if (a.notOut && !b.notOut) return 1
        return b.runs - a.runs
      })
      .map((batsman) => ({
        ...batsman,
        strikeRate: batsman.balls > 0 ? Number(((batsman.runs / batsman.balls) * 100).toFixed(2)) : 0,
      }))

    // Build bowler stats array
    const bowlerStats = Array.from(bowlerStatsMap.values()).map((bowler) => {
      const oversDecimal = bowler.ballsBowled / 6
      const economy = oversDecimal > 0 ? bowler.runsConceded / oversDecimal : 0
      const average = bowler.wickets > 0 ? bowler.runsConceded / bowler.wickets : null
      const strikeRate = bowler.wickets > 0 ? bowler.ballsBowled / bowler.wickets : null
      
      // Check if current over is maiden (if over is complete)
      let finalMaidens = bowler.maidens
      const ballsInCurrentOver = bowler.ballsBowled % 6
      if (ballsInCurrentOver === 0 && bowler.ballsBowled > 0 && bowler.currentOverRuns === 0) {
        finalMaidens += 1
      }

      return {
        bowlerId: bowler.bowlerId,
        bowlerName: bowler.bowlerName,
        ballsBowled: bowler.ballsBowled,
        overs: ballsToOvers(bowler.ballsBowled),
        runsConceded: bowler.runsConceded,
        wickets: bowler.wickets,
        economy: Number(economy.toFixed(2)),
        average: average ? Number(average.toFixed(2)) : null,
        strikeRate: strikeRate ? Number(strikeRate.toFixed(1)) : null,
      }
    })
    
    // Build recent overs array (in chronological order, left→right)
    const recentOvers = Array.from(oversMap.values())
      .sort((a, b) => a.overNumber - b.overNumber)
    
    // Get current over balls (incomplete over)
    const currentOver = recentOvers[recentOvers.length - 1] || null
    const currentOverBalls: OverBall[] = currentOver && !currentOver.isLocked ? [...currentOver.balls] : []

    // Build innings document
    const inningsStats: InningsStats = {
      matchId,
      inningId,
      totalRuns,
      totalWickets,
      legalBalls,
      overs,
      ballsInCurrentOver,
      currentRunRate: Number(currentRunRate.toFixed(2)),
      requiredRunRate: requiredRunRate !== null ? Number(requiredRunRate.toFixed(2)) : null,
      remainingBalls,
      remainingRuns,
      target,
      projectedTotal,
      lastBallSummary,
      partnership: {
        runs: partnershipRuns,
        balls: partnershipBalls,
        overs: ballsToOvers(partnershipBalls),
      },
      extras,
      fallOfWickets,
      batsmanStats,
      bowlerStats,
      recentOvers,
      currentOverBalls,
      currentStrikerId,
      nonStrikerId,
      currentBowlerId,
      lastUpdated: Timestamp.now(),
      updatedAt: new Date().toISOString(),
    }

    // Save/update innings document (with transaction if requested)
    const inningsRef = doc(db, MATCHES_COLLECTION, matchId, INNINGS_SUBCOLLECTION, inningId)
    
    if (useTransaction) {
      await runTransaction(db, async (transaction) => {
        transaction.set(inningsRef, inningsStats, { merge: true })
      })
    } else {
      await setDoc(inningsRef, inningsStats, { merge: true })
    }

    console.log(`[MatchEngine] ✅ Innings ${inningId} recalculated and saved:`, {
      totalRuns,
      totalWickets,
      legalBalls,
      overs,
      ballsInCurrentOver,
      currentRunRate: inningsStats.currentRunRate,
      requiredRunRate: inningsStats.requiredRunRate,
      partnership: inningsStats.partnership,
      recentOversCount: inningsStats.recentOvers.length,
      batsmanStatsCount: inningsStats.batsmanStats.length,
      bowlerStatsCount: inningsStats.bowlerStats.length,
      fallOfWicketsCount: inningsStats.fallOfWickets.length,
    })

    return inningsStats
  } catch (error) {
    console.error('[MatchEngine] Error recalculating innings:', error)
    throw error
  }
}

/**
 * Get innings document
 */
export async function getInnings(matchId: string, inningId: 'teamA' | 'teamB'): Promise<InningsStats | null> {
  try {
    const inningsRef = doc(db, MATCHES_COLLECTION, matchId, INNINGS_SUBCOLLECTION, inningId)
    const inningsDoc = await getDoc(inningsRef)
    if (inningsDoc.exists()) {
      return { ...inningsDoc.data() } as InningsStats
    }
    return null
  } catch (error) {
    console.error('[MatchEngine] Error getting innings:', error)
    throw error
  }
}

/**
 * Subscribe to innings document (real-time updates)
 */
export function subscribeToInnings(
  matchId: string,
  inningId: 'teamA' | 'teamB',
  callback: (innings: InningsStats | null) => void
) {
  const inningsRef = doc(db, MATCHES_COLLECTION, matchId, INNINGS_SUBCOLLECTION, inningId)
  
  return onSnapshot(
    inningsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data()
        callback({
          ...data,
          lastUpdated: data.lastUpdated || Timestamp.now(),
        } as InningsStats)
      } else {
        callback(null)
      }
    },
    (error) => {
      console.error('[MatchEngine] Error subscribing to innings:', error)
      callback(null)
    }
  )
}

