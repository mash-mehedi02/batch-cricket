/**
 * Innings Firestore Service
 * Handles real-time innings statistics recalculation
 */
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../../config/firebase'

const MATCHES_COLLECTION = 'matches'
const BALLS_SUBCOLLECTION = 'balls'
const INNINGS_SUBCOLLECTION = 'innings'

/**
 * Convert balls to overs format (e.g., 18 balls = "3.0")
 */
function ballsToOvers(balls) {
  const totalBalls = Number.isFinite(balls) ? balls : 0
  const overs = Math.floor(totalBalls / 6)
  const remaining = totalBalls % 6
  return `${overs}.${remaining}`
}

/**
 * Recalculate innings statistics from all balls
 * ICC Rules:
 * - Wide balls DO NOT increase legalBalls
 * - No-balls DO NOT increase legalBalls
 * - Legal deliveries increase legalBalls by +1
 */
export async function recalculateInningsStats(matchId, inningId) {
  try {
    console.log(`[InningsService] Recalculating innings stats for match ${matchId}, inning ${inningId}`)

    // Fetch all balls for this innings
    // Try subcollection first, fallback to match document's recentBalls array
    let balls = []
    
    try {
      const ballsRef = collection(db, MATCHES_COLLECTION, matchId, BALLS_SUBCOLLECTION)
      const ballsQuery = query(
        ballsRef,
        where('innings', '==', inningId),
        orderBy('timestamp', 'asc')
      )
      const ballsSnapshot = await getDocs(ballsQuery)
      ballsSnapshot.forEach((ballDoc) => {
        balls.push({ id: ballDoc.id, ...ballDoc.data() })
      })
    } catch (subcollectionError) {
      // Fallback: Use recentBalls from match document
      console.log('[InningsService] Balls subcollection not found, using recentBalls array')
      const matchRef = doc(db, MATCHES_COLLECTION, matchId)
      const matchDoc = await getDoc(matchRef)
      if (matchDoc.exists()) {
        const matchData = matchDoc.data()
        const recentBalls = Array.isArray(matchData.recentBalls) ? matchData.recentBalls : []
        // Filter by innings and reverse to get chronological order
        balls = recentBalls
          .filter((ball) => ball.innings === inningId || ball.team === inningId)
          .reverse() // recentBalls is stored newest first, reverse for chronological
      }
    }

    // Initialize aggregators
    let totalRuns = 0
    let totalWickets = 0
    let legalBalls = 0
    let partnershipRuns = 0
    let partnershipBalls = 0
    let lastWicketBallIndex = -1

    // Bowler stats map: { bowlerId: { runs: 0, wickets: 0, balls: 0 } }
    const bowlerStats = new Map()

    // Process each ball
    balls.forEach((ball) => {
      // ICC Rule: Only count legal deliveries
      const countsBall = ball.countsBall !== false // Default to true if not specified
      if (countsBall) {
        legalBalls += 1
        partnershipBalls += 1
      }

      // Add runs (always count, even for extras)
      const ballRuns = Number(ball.runs) || 0
      totalRuns += ballRuns

      // Partnership runs (only bat runs, not extras)
      const batRuns = Number(ball.batRuns) || 0
      partnershipRuns += batRuns

      // Check for wicket
      if (ball.isWicket === true) {
        totalWickets += 1
        lastWicketBallIndex = balls.length - 1
        // Reset partnership on wicket
        partnershipRuns = 0
        partnershipBalls = 0
      } else {
        // Continue partnership if no wicket
        // (partnershipRuns and partnershipBalls already incremented above)
      }

      // Update bowler stats
      if (ball.bowler) {
        const bowlerId = ball.bowlerId || ball.bowler
        if (!bowlerStats.has(bowlerId)) {
          bowlerStats.set(bowlerId, {
            runs: 0,
            wickets: 0,
            balls: 0,
            name: ball.bowler || 'Unknown',
          })
        }
        const stats = bowlerStats.get(bowlerId)

        // ICC Rule: Bowler gets runs if creditRunsToBowler is true (default true)
        // For wides/no-balls, runs are credited to bowler
        const creditRuns = ball.creditRunsToBowler !== false // Default true
        if (creditRuns) {
          stats.runs += ballRuns
        }

        // ICC Rule: Only legal balls count for bowler
        if (countsBall) {
          stats.balls += 1
        }

        // Wickets (only if wicket belongs to this bowler)
        if (ball.isWicket === true && ball.bowlerId === bowlerId) {
          // Check if wicket type credits bowler (not run-out)
          const dismissal = ball.dismissal || ''
          const isRunOut = dismissal.toLowerCase().includes('run out') || 
                          dismissal.toLowerCase().includes('runout')
          if (!isRunOut) {
            stats.wickets += 1
          }
        }
      }
    })

    // Calculate derived stats
    const overs = ballsToOvers(legalBalls)
    const runRate = legalBalls > 0 ? (totalRuns / (legalBalls / 6)).toFixed(2) : '0.00'

    // Get match data to calculate required run rate (for second innings)
    const matchRef = doc(db, MATCHES_COLLECTION, matchId)
    const matchDoc = await getDoc(matchRef)
    const matchData = matchDoc.exists() ? matchDoc.data() : null

    let requiredRunRate = null
    let remainingBalls = null
    let target = null

    if (matchData && matchData.matchPhase === 'SecondInnings' && inningId === 'teamB') {
      const oversLimit = Number(matchData.oversLimit) || 0
      const oversLimitBalls = oversLimit * 6
      remainingBalls = Math.max(oversLimitBalls - legalBalls, 0)

      // Get target from match data
      const teamAScore = matchData.score?.teamA?.runs || matchData.runs1 || 0
      target = teamAScore + 1
      const runsNeeded = target - totalRuns

      if (remainingBalls > 0 && runsNeeded > 0) {
        requiredRunRate = (runsNeeded / (remainingBalls / 6)).toFixed(2)
      } else if (runsNeeded <= 0) {
        requiredRunRate = '0.00'
      }
    }

    // Get current striker and non-striker from match data
    const currentStrikerId = matchData?.currentStrikerId || ''
    const nonStrikerId = matchData?.nonStrikerId || ''

    // Build bowler figures array
    const bowlerFigures = Array.from(bowlerStats.entries()).map(([bowlerId, stats]) => ({
      bowlerId,
      name: stats.name,
      runs: stats.runs,
      wickets: stats.wickets,
      balls: stats.balls,
      overs: ballsToOvers(stats.balls),
      economy: stats.balls > 0 ? (stats.runs / (stats.balls / 6)).toFixed(2) : '0.00',
    }))

    // Current bowler (from match data)
    const currentBowlerId = matchData?.currentBowlerId || ''

    // Build innings document
    const inningsData = {
      matchId,
      inningId,
      totalRuns,
      totalWickets,
      legalBalls,
      overs,
      runRate,
      requiredRunRate,
      remainingBalls,
      target,
      partnership: {
        runs: partnershipRuns,
        balls: partnershipBalls,
        overs: ballsToOvers(partnershipBalls),
      },
      currentStrikerId,
      nonStrikerId,
      currentBowlerId,
      bowlerFigures,
      lastUpdated: Timestamp.now(),
      updatedAt: new Date().toISOString(),
    }

    // Save/update innings document
    const inningsRef = doc(db, MATCHES_COLLECTION, matchId, INNINGS_SUBCOLLECTION, inningId)
    await setDoc(inningsRef, inningsData, { merge: true })

    console.log(`[InningsService] Innings stats updated:`, {
      inningId,
      totalRuns,
      totalWickets,
      legalBalls,
      overs,
      runRate,
    })

    return inningsData
  } catch (error) {
    console.error('[InningsService] Error recalculating innings stats:', error)
    throw error
  }
}

/**
 * Get innings document
 */
export async function getInnings(matchId, inningId) {
  try {
    const inningsRef = doc(db, MATCHES_COLLECTION, matchId, INNINGS_SUBCOLLECTION, inningId)
    const inningsDoc = await getDoc(inningsRef)
    if (inningsDoc.exists()) {
      return { id: inningsDoc.id, ...inningsDoc.data() }
    }
    return null
  } catch (error) {
    console.error('[InningsService] Error getting innings:', error)
    throw error
  }
}

/**
 * Subscribe to innings document (real-time updates)
 * Re-exported from recalculateInnings for backward compatibility
 */
export function subscribeToInnings(matchId, inningId, callback) {
  const { onSnapshot } = require('firebase/firestore')
  const inningsRef = doc(db, MATCHES_COLLECTION, matchId, INNINGS_SUBCOLLECTION, inningId)
  
  return onSnapshot(
    inningsRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() })
      } else {
        callback(null)
      }
    },
    (error) => {
      console.error('[InningsService] Error subscribing to innings:', error)
      callback(null)
    }
  )
}

/**
 * Re-export recalculateInnings from matchEngine for backward compatibility
 */
export async function recalculateInningsStats(matchId, inningId) {
  const { recalculateInnings } = await import('../matchEngine/recalculateInnings')
  return recalculateInnings(matchId, inningId, { useTransaction: true })
}

