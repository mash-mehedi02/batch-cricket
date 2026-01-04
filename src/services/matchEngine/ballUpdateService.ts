/**
 * Ball Update Service
 * Handles ball additions with instant updates and over completion detection
 */

import { collection, doc, setDoc, getDocs, query, where, Timestamp, runTransaction } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { recalculateInnings } from './recalculateInnings'

const MATCHES_COLLECTION = 'matches'
const BALLS_SUBCOLLECTION = 'balls'

export interface BallData {
  matchId: string
  inningId: 'teamA' | 'teamB'
  sequence: number
  runsOffBat: number
  extras: {
    wides?: number
    noBalls?: number
    byes?: number
    legByes?: number
    penalty?: number
  }
  isLegal: boolean
  isWide: boolean
  isNoBall: boolean
  batsmanId: string
  bowlerId: string
  nonStrikerId: string
  wicket?: {
    type: string
    dismissedPlayerId: string
    creditedToBowler: boolean
    fielderId?: string
  } | null
  freeHit: boolean
  timestamp: Timestamp
}

export interface BallUpdateResult {
  success: boolean
  ballId?: string
  inningsData?: any
  overComplete?: boolean
  newBowlerRequired?: boolean
  error?: string
}

/**
 * Add a ball and instantly update innings
 * Returns updated innings data immediately
 */
export async function addBall(
  matchId: string,
  inningId: 'teamA' | 'teamB',
  ballData: Omit<BallData, 'matchId' | 'inningId' | 'sequence' | 'timestamp'>
): Promise<BallUpdateResult> {
  try {
    // Get sequence number
    const ballsRef = collection(db, MATCHES_COLLECTION, matchId, BALLS_SUBCOLLECTION)
    const existingBallsQuery = query(ballsRef, where('innings', '==', inningId))
    const existingBallsSnapshot = await getDocs(existingBallsQuery)
    const sequence = existingBallsSnapshot.size + 1

    // Create complete ball document
    const completeBallData: BallData = {
      ...ballData,
      matchId,
      inningId,
      sequence,
      timestamp: Timestamp.now(),
      // Ensure innings field for queries
      innings: inningId,
    }

    // Save ball in transaction
    const ballDocRef = doc(ballsRef)
    
    await runTransaction(db, async (transaction) => {
      transaction.set(ballDocRef, completeBallData)
    })

    // Immediately recalculate innings (this gives us updated stats)
    const inningsData = await recalculateInnings(matchId, inningId, { useTransaction: false })

    // Check if over is complete (6 legal balls)
    const ballsInCurrentOver = inningsData.ballsInCurrentOver || 0
    const overComplete = ballsInCurrentOver === 0 && inningsData.legalBalls > 0

    return {
      success: true,
      ballId: ballDocRef.id,
      inningsData,
      overComplete,
      newBowlerRequired: overComplete,
    }
  } catch (error: any) {
    console.error('[BallUpdateService] Error adding ball:', error)
    return {
      success: false,
      error: error.message || 'Failed to add ball',
    }
  }
}

