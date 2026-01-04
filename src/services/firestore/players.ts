/**
 * Player Service
 * Firestore operations for players
 */

import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore'
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
}

