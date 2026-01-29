/**
 * Firebase Cloud Functions
 * BatchCrick BD - Backend processing
 */

import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

admin.initializeApp()

const db = admin.firestore()

/**
 * Trigger when a ball is written
 * Automatically recalculates innings statistics
 */
export const onBallWrite = functions.firestore
  .document('matches/{matchId}/innings/{inningId}/balls/{ballId}')
  .onWrite(async (change, context) => {
    const { matchId, inningId } = context.params
    const ballData = change.after.exists ? change.after.data() : null

    if (!ballData) {
      // Ball was deleted, still need to recalculate
      await recalculateInnings(matchId, inningId as 'teamA' | 'teamB')
      return
    }

    // Trigger recalculation
    await recalculateInnings(matchId, inningId as 'teamA' | 'teamB')
  })

/**
 * Recalculate innings statistics
 * This is the core calculation engine running server-side
 */
async function recalculateInnings(
  matchId: string,
  inningId: 'teamA' | 'teamB'
): Promise<void> {
  // Get all balls for this innings
  const ballsSnapshot = await db
    .collection('matches')
    .doc(matchId)
    .collection('innings')
    .doc(inningId)
    .collection('balls')
    .orderBy('sequence', 'asc')
    .get()

  const balls = ballsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }))

  // Get match data
  const matchDoc = await db.collection('matches').doc(matchId).get()
  const matchData = matchDoc.data()

  if (!matchData) {
    console.error(`Match ${matchId} not found`)
    return
  }

  // Import recalculation logic (will be implemented)
  // For now, this is a placeholder
  // The actual recalculation logic should be imported from a shared module

  // Calculate innings stats
  const inningsStats = calculateInningsStats(balls, matchId, inningId, matchData)

  // Update innings document
  await db
    .collection('matches')
    .doc(matchId)
    .collection('innings')
    .doc(inningId)
    .set(inningsStats, { merge: true })

  console.log(`Recalculated innings ${inningId} for match ${matchId}`)
}

/**
 * Calculate innings statistics from balls
 * This should use the same logic as the frontend engine
 */
function calculateInningsStats(
  balls: any[],
  matchId: string,
  inningId: 'teamA' | 'teamB',
  matchData: any
): any {
  // TODO: Implement full calculation logic
  // This should match the recalculateInnings function in src/engine/recalculateInnings.ts

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
  const currentRunRate = legalBalls > 0 ? (totalRuns / legalBalls) * 6 : 0

  return {
    matchId,
    inningId,
    totalRuns,
    totalWickets,
    legalBalls,
    overs,
    currentRunRate,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: new Date().toISOString(),
  }
}

function formatOvers(balls: number): string {
  const overs = Math.floor(balls / 6)
  const remaining = balls % 6
  return `${overs}.${remaining}`
}

/**
 * Finalize match and update player stats
 */
export const finalizeMatch = functions.https.onCall(async (data, context) => {
  const { matchId } = data

  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated')
  }

  // Verify user is admin
  const userDoc = await db.collection('users').doc(context.auth.uid).get()
  const userData = userDoc.data()

  if (userData?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required')
  }

  // Update match status
  await db.collection('matches').doc(matchId).update({
    status: 'finished',
    matchPhase: 'finished',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  // Update player and squad statistics
  await updatePlayerStats(matchId)
  await updateSquadStats(matchId)

  return { success: true }
})

/**
 * Update player statistics from match
 */
async function updatePlayerStats(matchId: string): Promise<void> {
  // TODO: Implement player stats aggregation
  // This should:
  // 1. Get all innings for the match
  // 2. Aggregate stats for each player
  // 3. Update player documents with new stats
  console.log(`Updating player stats for match ${matchId}`)
}

/**
 * Update squad statistics from match
 */
async function updateSquadStats(matchId: string): Promise<void> {
  // TODO: Implement squad stats aggregation
  console.log(`Updating squad stats for match ${matchId}`)
}

// Export player claim functions
export * from './playerClaims';

// Export notification functions
export * from './notifications';