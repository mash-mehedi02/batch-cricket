import cron from 'node-cron'
import { db } from '../config/firebaseAdmin.js'

/**
 * Cron job to automatically update match statuses based on time
 * Runs every minute to check if matches should be set to "Live"
 */
class MatchStatusCron {
  constructor() {
    this.isRunning = false
    this.task = null
  }

  /**
   * Check and update match statuses
   */
  async checkAndUpdateMatchStatuses() {
    if (this.isRunning) {
      console.log('⏳ Match status check already running, skipping...')
      return
    }

    this.isRunning = true
    const now = new Date()
    
    try {
      console.log(`🔍 Checking match statuses at ${now.toISOString()}`)
      
      // Get all matches that are Upcoming or Live (exclude manually ended matches)
      const matchesRef = db.collection('matches')
      const snapshot = await matchesRef
        .where('status', 'in', ['Upcoming', 'Live'])
        .get()

      if (snapshot.empty) {
        console.log('✅ No matches to check')
        this.isRunning = false
        return
      }

      const updates = []
      let currentBatch = db.batch()
      let batchCount = 0
      const MAX_BATCH_SIZE = 500 // Firestore batch limit

      for (const doc of snapshot.docs) {
        const matchData = doc.data()
        
        // Calculate match datetime
        let matchDateTime
        if (matchData.matchDateTime) {
          matchDateTime = matchData.matchDateTime.toDate 
            ? matchData.matchDateTime.toDate()
            : new Date(matchData.matchDateTime)
        } else if (matchData.date && matchData.time) {
          // Combine date and time
          const dateStr = matchData.date
          const timeStr = matchData.time
          matchDateTime = new Date(`${dateStr}T${timeStr}`)
        } else {
          console.warn(`⚠️ Match ${doc.id} missing date/time, skipping`)
          continue
        }

        // Skip manually ended matches (they should not be auto-updated)
        if (matchData.manuallyEnded) {
          continue
        }

        // Check if match should be Live (only update Upcoming matches)
        if (matchData.status === 'Upcoming' && matchDateTime <= now) {
          updates.push({
            id: doc.id,
            oldStatus: matchData.status,
            newStatus: 'Live',
            matchDateTime: matchDateTime.toISOString(),
          })

          currentBatch.update(doc.ref, {
            status: 'Live',
            updatedAt: new Date(),
          })
          batchCount++

          // Commit batch if it reaches the limit and create new batch
          if (batchCount >= MAX_BATCH_SIZE) {
            await currentBatch.commit()
            currentBatch = db.batch()
            batchCount = 0
          }
        }
      }

      // Commit remaining updates
      if (batchCount > 0) {
        await currentBatch.commit()
      }

      if (updates.length > 0) {
        console.log(`✅ Updated ${updates.length} match(es) to Live:`)
        updates.forEach((update) => {
          console.log(`   - Match ${update.id}: ${update.oldStatus} → ${update.newStatus}`)
        })
      } else {
        console.log('✅ No matches needed status updates')
      }

      this.isRunning = false
    } catch (error) {
      console.error('❌ Error checking match statuses:', error)
      this.isRunning = false
    }
  }

  /**
   * Start the cron job (runs every minute)
   */
  start() {
    if (this.task) {
      console.log('⚠️ Cron job already running')
      return
    }

    // Run every minute: * * * * *
    // Format: second minute hour day month day-of-week
    this.task = cron.schedule('* * * * *', async () => {
      await this.checkAndUpdateMatchStatuses()
    }, {
      scheduled: true,
      timezone: 'UTC', // Adjust timezone as needed
    })

    console.log('🚀 Match status cron job started (runs every minute)')
    
    // Run immediately on start
    this.checkAndUpdateMatchStatuses()
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.task) {
      this.task.stop()
      this.task = null
      console.log('⏹️ Match status cron job stopped')
    }
  }

  /**
   * Get cron job status
   */
  getStatus() {
    return {
      isRunning: this.task !== null,
      isChecking: this.isRunning,
    }
  }
}

// Export singleton instance
export default new MatchStatusCron()

