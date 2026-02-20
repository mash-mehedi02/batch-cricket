/**
 * Ball Update Service
 * Handles ball additions with instant updates and over completion detection
 */

import { collection, doc, getDoc, Timestamp, runTransaction } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { recalculateInnings } from './recalculateInnings'
import { InningId } from '@/types'

const MATCHES_COLLECTION = 'matches'
const BALLS_SUBCOLLECTION = 'balls'

export interface BallData {
  matchId: string
  inningId: InningId
  innings?: InningId // Legacy field for backwards compatibility with queries
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
  inningId: InningId,
  ballData: Omit<BallData, 'matchId' | 'inningId' | 'innings' | 'sequence' | 'timestamp'>,
  options?: { sequence?: number; previousBalls?: any[] }
): Promise<BallUpdateResult> {
  try {
    console.log('[BallUpdateService] Adding ball for match:', matchId, 'inning:', inningId);

    const ballsRef = collection(db, MATCHES_COLLECTION, matchId, 'innings', inningId, BALLS_SUBCOLLECTION)

    // Calculate sequence: use passed sequence or max of previous + 1
    let sequence = options?.sequence;
    if (!sequence) {
      if (options?.previousBalls && options.previousBalls.length > 0) {
        sequence = Math.max(0, ...options.previousBalls.map((b: any) => b.sequence || 0)) + 1;
      } else {
        const { getCountFromServer } = await import('firebase/firestore');
        const snapshot = await getCountFromServer(ballsRef);
        sequence = snapshot.data().count + 1;
      }
    }

    console.log('[BallUpdateService] Sequence number:', sequence);

    // Create complete ball document
    const completeBallData: BallData = {
      ...ballData,
      matchId,
      inningId,
      sequence,
      timestamp: Timestamp.now(),
      innings: inningId,
    }

    // Save ball in transaction for atomicity
    const ballDocRef = doc(ballsRef)
    await runTransaction(db, async (transaction) => {
      transaction.set(ballDocRef, completeBallData)
    })

    // Speed optimization: Use previous balls + current ball to recalculate instantly
    // avoiding the need to wait for Firestore indexing of the new ball.
    const allBalls = options?.previousBalls ? [...options.previousBalls, completeBallData] : undefined;

    const inningsData = await recalculateInnings(matchId, inningId, {
      useTransaction: false,
      balls: allBalls
    })

    // Check if over is complete (6 legal balls)
    const overComplete = completeBallData.isLegal && (inningsData.legalBalls % 6 === 0) && inningsData.legalBalls > 0

      // SYNC: Fire and forget (don't await) to keep scoring instant
      ; (async () => {
        try {
          const matchSnap = await getDoc(doc(db, MATCHES_COLLECTION, matchId))
          const matchData = matchSnap.data()
          const matchStatus = matchData?.status?.toLowerCase()

          if (matchStatus === 'finished' || matchStatus === 'completed') {
            const { syncMatchToPlayerProfiles } = await import('../syncPlayerStats')
            await syncMatchToPlayerProfiles(matchId)
          }
        } catch (err) {
          console.warn('[BallUpdateService] Background sync failed:', err)
        }
      })();

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

