/**
 * Player Service
 * Firestore operations for players
 */

import { collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc, deleteDoc, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Player } from '@/types'
import { COLLECTIONS } from './collections'

const playersRef = collection(db, COLLECTIONS.PLAYERS)

export const playerService = {
  /**
   * Subscribe to all players (realtime). Useful so renamed players update everywhere instantly.
   */
  subscribeAll(callback: (players: Player[]) => void): () => void {
    // Avoid orderBy to prevent composite index requirements; sort client-side.
    return onSnapshot(
      playersRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Player))
          .sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()))
        callback(list)
      },
      (error) => {
        console.error('[playerService] subscribeAll error:', error)
        callback([])
      }
    )
  },

  /**
   * Subscribe to players by squad (realtime). Keeps live match UI in sync with player renames.
   */
  subscribeBySquad(squadId: string, callback: (players: Player[]) => void): () => void {
    const q = query(playersRef, where('squadId', '==', squadId))
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Player))
          .sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()))
        callback(list)
      },
      async (error) => {
        console.warn('[playerService] subscribeBySquad failed; falling back to getBySquad()', error)
        try {
          const list = await playerService.getBySquad(squadId)
          callback(list)
        } catch {
          callback([])
        }
      }
    )
  },

  /**
   * Get all players
   */
  async getAll(): Promise<Player[]> {
    try {
      const snapshot = await getDocs(query(playersRef, orderBy('name')))
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player))
    } catch (error) {
      console.error('Error loading players with orderBy:', error)
      // Try without orderBy if index doesn't exist
      try {
        const snapshot = await getDocs(playersRef)
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player))
          .sort((a, b) => {
            const nameA = (a.name || '').toLowerCase()
            const nameB = (b.name || '').toLowerCase()
            return nameA.localeCompare(nameB)
          })
      } catch (fallbackError) {
        console.error('Error in fallback query:', fallbackError)
        return []
      }
    }
  },

  /**
   * Get players by squad
   */
  async getBySquad(squadId: string): Promise<Player[]> {
    try {
      const q = query(playersRef, where('squadId', '==', squadId), orderBy('name'))
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player))
    } catch (error: any) {
      // If composite index doesn't exist, query without orderBy and sort in memory
      const isIndexError =
        error?.code === 'failed-precondition' ||
        (typeof error?.message === 'string' && (
          error.message.includes('requires an index') ||
          error.message.includes('The query requires an index') ||
          error.message.includes('index')
        ))

      if (isIndexError) {
        console.warn('[playerService] Composite index not available for getBySquad; falling back without orderBy')
        try {
          const q = query(playersRef, where('squadId', '==', squadId))
          const snapshot = await getDocs(q)
          return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Player))
            .sort((a, b) => (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase()))
        } catch (fallbackError) {
          console.error('[playerService] Fallback query failed:', fallbackError)
          return []
        }
      }

      console.error('[playerService] Error querying players by squad:', error)
      return []
    }
  },

  /**
   * Get player by ID
   */
  async getById(id: string): Promise<Player | null> {
    const docRef = doc(db, COLLECTIONS.PLAYERS, id)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) return null
    return { id: docSnap.id, ...docSnap.data() } as Player
  },

  /**
   * Create player
   */
  async create(data: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Timestamp.now()
    const docRef = await addDoc(playersRef, {
      ...data,
      createdAt: now,
      updatedAt: now,
    })
    return docRef.id
  },

  /**
   * Update player
   */
  async update(id: string, data: Partial<Player>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.PLAYERS, id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    })
  },

  /**
   * Delete player
   */
  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTIONS.PLAYERS, id)
    await deleteDoc(docRef)
  },

  /**
   * Upsert a match performance and recompute career stats
   * Handles both the legacy pastMatches array and the new playerMatchStats collection
   */
  async upsertPastMatchAndRecompute(playerId: string, performance: any): Promise<void> {
    try {
      const playerRef = doc(db, COLLECTIONS.PLAYERS, playerId)
      const playerSnap = await getDoc(playerRef)
      if (!playerSnap.exists()) return

      const playerData = playerSnap.data() as Player
      const pastMatches = playerData.pastMatches || []
      const matchId = performance.matchId

      // 1. Update legacy pastMatches array (for backwards compatibility/UI)
      const existingIndex = pastMatches.findIndex((m: any) => m.matchId === matchId || m.id === matchId)
      let newPastMatches = [...pastMatches]
      if (existingIndex >= 0) {
        newPastMatches[existingIndex] = { ...newPastMatches[existingIndex], ...performance }
      } else {
        newPastMatches.push(performance)
      }

      // 2. Add/Update records in playerMatchStats collection (the new source of truth)
      const statsId = `${matchId}_${playerId}`
      const statsRef = doc(collection(db, 'playerMatchStats'), statsId)

      const statsPayload = {
        matchId,
        playerId,
        opponent: performance.opponentName || performance.opponent || 'Opponent',
        runs: Number(performance.runs || 0),
        balls: Number(performance.balls || 0),
        fours: Number(performance.fours || 0),
        sixes: Number(performance.sixes || 0),
        out: Boolean(performance.notOut === false),
        dismissalType: performance.dismissal || null,
        oversBowled: Number(performance.ballsBowled || 0) / 6,
        runsConceded: Number(performance.runsConceded || 0),
        wickets: Number(performance.wickets || 0),
        lastUpdated: Timestamp.now(),
      }

      await setDoc(statsRef, statsPayload, { merge: true })

      // 3. Save player document updates
      await updateDoc(playerRef, {
        pastMatches: newPastMatches,
        updatedAt: Timestamp.now()
      })

      // 4. Trigger full aggregation for accurate career totals
      const { playerMatchStatsService } = await import('./playerMatchStats')
      await playerMatchStatsService.aggregateCareerStats(playerId)

    } catch (error) {
      console.error(`[playerService] upsertPastMatchAndRecompute failed for ${playerId}:`, error)
      throw error
    }
  }
}

