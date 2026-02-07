/**
 * Ball Update Service
 * Handles ball additions with instant updates and over completion detection
 */

import { collection, doc, getDocs, getDoc, Timestamp, runTransaction } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { recalculateInnings } from './recalculateInnings'

const MATCHES_COLLECTION = 'matches'
const BALLS_SUBCOLLECTION = 'balls'

export interface BallData {
  matchId: string
  inningId: 'teamA' | 'teamB'
  innings?: 'teamA' | 'teamB' // Legacy field for backwards compatibility with queries
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
  ballData: Omit<BallData, 'matchId' | 'inningId' | 'innings' | 'sequence' | 'timestamp'>
): Promise<BallUpdateResult> {
  try {
    console.log('[BallUpdateService] Adding ball for match:', matchId, 'inning:', inningId);

    // FIXED: Save balls under innings subcollection to match recalculateInnings expectations
    // Path: matches/{matchId}/innings/{inningId}/balls/
    const ballsRef = collection(db, MATCHES_COLLECTION, matchId, 'innings', inningId, BALLS_SUBCOLLECTION)

    // Get sequence number - count existing balls
    const existingBallsSnapshot = await getDocs(ballsRef)
    const sequence = existingBallsSnapshot.size + 1

    console.log('[BallUpdateService] Sequence number:', sequence);

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

    console.log('[BallUpdateService] Saving ball to Firestore...');
    await runTransaction(db, async (transaction) => {
      transaction.set(ballDocRef, completeBallData)
    })

    console.log('[BallUpdateService] Ball saved successfully. ID:', ballDocRef.id);

    // Immediately recalculate innings (this gives us updated stats)
    console.log('[BallUpdateService] Recalculating innings...');
    const inningsData = await recalculateInnings(matchId, inningId, { useTransaction: false })

    // Check if over is complete (6 legal balls)
    const overComplete = completeBallData.isLegal && (inningsData.legalBalls % 6 === 0) && inningsData.legalBalls > 0

    // NEW: Sync to player profiles if match finished or innings completed
    // This handles the "instant update" for career stats after a match
    const { syncMatchToPlayerProfiles } = await import('../syncPlayerStats')

    // We check if the match status is now 'finished' or if we should sync anyway
    const matchSnap = await getDoc(doc(db, MATCHES_COLLECTION, matchId))
    const matchData = matchSnap.data()
    const matchStatus = matchData?.status?.toLowerCase()

    if (matchStatus === 'finished' || matchStatus === 'completed') {
      console.log('[BallUpdateService] Match finished, triggering player stats sync...');
      await syncMatchToPlayerProfiles(matchId).catch(err => console.error('Sync error:', err))
    }

    // Status transitions and innings end detection are now handled automatically
    // inside recalculateInnings() called above.

    console.log('[BallUpdateService] Success! Over complete:', overComplete);

    console.log('[BallUpdateService] Success! Over complete:', overComplete);

    return {
      success: true,
      ballId: ballDocRef.id,
      inningsData,
      overComplete,
      newBowlerRequired: overComplete,
    }
  } catch (error: any) {
    console.error('[BallUpdateService] Error adding ball:', error)
    console.error('[BallUpdateService] Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    return {
      success: false,
      error: error.message || 'Failed to add ball',
    }
  }
}

