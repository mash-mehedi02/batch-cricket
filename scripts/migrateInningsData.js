/**
 * Migration Script: Recalculate Innings Data
 * 
 * This script recalculates all historical matches and populates innings summary documents.
 * Run this after deploying the new recalculateInnings engine.
 * 
 * Usage: node scripts/migrateInningsData.js
 */

const admin = require('firebase-admin')
const serviceAccount = require('../firebase-service-account.json') // Update path as needed

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  })
}

const db = admin.firestore()

/**
 * Recalculate innings for a match
 */
async function recalculateInningsForMatch(matchId, inningId) {
  try {
    console.log(`[Migration] Recalculating ${inningId} for match ${matchId}`)
    
    // Import recalculateInnings function
    // Note: This assumes the function is available in the Node.js environment
    // For production, you may need to create a Cloud Function or use the Firebase Admin SDK directly
    
    // For now, we'll use a simplified version that uses Admin SDK
    const ballsRef = db.collection('matches').doc(matchId).collection('balls')
    const ballsQuery = ballsRef.where('innings', '==', inningId).orderBy('sequence', 'asc')
    const ballsSnapshot = await ballsQuery.get()
    
    if (ballsSnapshot.empty) {
      console.log(`[Migration] No balls found for ${inningId} in match ${matchId}`)
      return null
    }
    
    const balls = []
    ballsSnapshot.forEach(doc => {
      balls.push({ id: doc.id, ...doc.data() })
    })
    
    // Get match data
    const matchDoc = await db.collection('matches').doc(matchId).get()
    if (!matchDoc.exists) {
      console.error(`[Migration] Match ${matchId} not found`)
      return null
    }
    const matchData = matchDoc.data()
    
    // Calculate innings statistics (simplified version)
    // In production, call the actual recalculateInnings function
    let totalRuns = 0
    let totalWickets = 0
    let legalBalls = 0
    
    balls.forEach(ball => {
      const isLegal = ball.isLegal !== false && !ball.isWide && !ball.isNoBall
      if (isLegal) {
        legalBalls += 1
      }
      totalRuns += ball.runs || 0
      if (ball.isWicket) {
        totalWickets += 1
      }
    })
    
    const overs = `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`
    const oversDecimal = legalBalls / 6
    const currentRunRate = oversDecimal > 0 ? totalRuns / oversDecimal : 0
    
    // Save innings document
    const inningsRef = db.collection('matches').doc(matchId).collection('innings').doc(inningId)
    await inningsRef.set({
      matchId,
      inningId,
      totalRuns,
      totalWickets,
      legalBalls,
      overs,
      currentRunRate: Number(currentRunRate.toFixed(2)),
      requiredRunRate: null,
      remainingBalls: null,
      target: null,
      partnership: { runs: 0, balls: 0, overs: '0.0' },
      extras: { byes: 0, legByes: 0, wides: 0, noBalls: 0, penalty: 0 },
      fallOfWickets: [],
      batsmanStats: [],
      bowlerStats: [],
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: new Date().toISOString(),
    }, { merge: true })
    
    console.log(`[Migration] ✅ Recalculated ${inningId} for match ${matchId}: ${totalRuns}/${totalWickets} (${overs})`)
    return { matchId, inningId, totalRuns, totalWickets, overs }
  } catch (error) {
    console.error(`[Migration] ❌ Error recalculating ${inningId} for match ${matchId}:`, error)
    return null
  }
}

/**
 * Main migration function
 */
async function migrateInningsData() {
  console.log('[Migration] Starting innings data migration...')
  
  try {
    // Fetch all matches
    const matchesRef = db.collection('matches')
    const matchesSnapshot = await matchesRef.get()
    
    if (matchesSnapshot.empty) {
      console.log('[Migration] No matches found')
      return
    }
    
    console.log(`[Migration] Found ${matchesSnapshot.size} matches`)
    
    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
    }
    
    // Process matches in batches
    const batchSize = 10
    const matches = []
    matchesSnapshot.forEach(doc => {
      matches.push({ id: doc.id, ...doc.data() })
    })
    
    for (let i = 0; i < matches.length; i += batchSize) {
      const batch = matches.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (match) => {
          // Recalculate teamA innings
          const teamAResult = await recalculateInningsForMatch(match.id, 'teamA')
          if (teamAResult) {
            results.success++
          } else {
            results.skipped++
          }
          
          // Recalculate teamB innings
          const teamBResult = await recalculateInningsForMatch(match.id, 'teamB')
          if (teamBResult) {
            results.success++
          } else {
            results.skipped++
          }
        })
      )
      
      console.log(`[Migration] Processed ${Math.min(i + batchSize, matches.length)}/${matches.length} matches`)
    }
    
    console.log('[Migration] ✅ Migration complete!')
    console.log(`[Migration] Results: ${results.success} successful, ${results.failed} failed, ${results.skipped} skipped`)
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run migration
if (require.main === module) {
  migrateInningsData()
    .then(() => {
      console.log('[Migration] Done')
      process.exit(0)
    })
    .catch((error) => {
      console.error('[Migration] Fatal error:', error)
      process.exit(1)
    })
}

module.exports = { migrateInningsData, recalculateInningsForMatch }

