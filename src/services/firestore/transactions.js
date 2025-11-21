/**
 * Firestore Transaction Utilities
 * For atomic updates and stat calculations
 */

import { runTransaction, doc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { serverTimestamp } from 'firebase/firestore'

/**
 * Update match score atomically
 */
export const updateMatchScoreTransaction = async (matchId, updates) => {
  const matchRef = doc(db, 'matches', matchId)

  try {
    await runTransaction(db, async (transaction) => {
      const matchDoc = await transaction.get(matchRef)
      if (!matchDoc.exists()) {
        throw new Error('Match not found')
      }

      const updateData = {
        ...updates,
        updatedAt: serverTimestamp(),
      }

      transaction.update(matchRef, updateData)
    })
  } catch (error) {
    console.error('Transaction error:', error)
    throw error
  }
}

/**
 * Update player stats atomically
 */
export const updatePlayerStatsTransaction = async (playerId, statUpdates) => {
  const playerRef = doc(db, 'players', playerId)

  try {
    await runTransaction(db, async (transaction) => {
      const playerDoc = await transaction.get(playerRef)
      if (!playerDoc.exists()) {
        throw new Error('Player not found')
      }

      const currentStats = playerDoc.data().baseStats || {}
      const updatedStats = {
        ...currentStats,
        ...statUpdates,
      }

      transaction.update(playerRef, {
        baseStats: updatedStats,
        updatedAt: serverTimestamp(),
      })
    })
  } catch (error) {
    console.error('Transaction error:', error)
    throw error
  }
}

/**
 * Batch update multiple players' stats
 */
export const batchUpdatePlayerStats = async (playerUpdates) => {
  const { writeBatch } = await import('firebase/firestore')
  const batch = writeBatch(db)

  try {
    playerUpdates.forEach(({ playerId, statUpdates }) => {
      const playerRef = doc(db, 'players', playerId)
      const currentStats = statUpdates // Assume statUpdates is already calculated
      
      batch.update(playerRef, {
        baseStats: currentStats,
        updatedAt: serverTimestamp(),
      })
    })

    await batch.commit()
  } catch (error) {
    console.error('Batch update error:', error)
    throw error
  }
}

export default {
  updateMatchScoreTransaction,
  updatePlayerStatsTransaction,
  batchUpdatePlayerStats,
}

