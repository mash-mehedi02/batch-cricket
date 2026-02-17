/**
 * Tournament Service
 * Firestore operations for tournaments
 */

import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore'
import { db, auth } from '@/config/firebase'
import { Tournament } from '@/types'
import { COLLECTIONS } from './collections'

const tournamentsRef = collection(db, COLLECTIONS.TOURNAMENTS)

export const tournamentService = {
  /**
   * Get tournaments for a specific admin (or all for super admin)
   */
  async getByAdmin(adminId: string, isSuperAdmin: boolean = false): Promise<Tournament[]> {
    try {
      let q;
      if (isSuperAdmin) {
        q = query(tournamentsRef) // No server-side orderBy to avoid index requirement
      } else {
        q = query(
          tournamentsRef,
          where('adminId', '==', adminId)
        )
      }
      const snapshot = await getDocs(q)
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament))

      // Professional client-side sort
      return list.sort((a, b) => (Number(b.year || 0) - Number(a.year || 0)))
    } catch (error) {
      console.error('Error loading tournaments by admin:', error)
      return []
    }
  },

  /**
   * Get all tournaments (Public View)
   */
  async getAll(): Promise<Tournament[]> {
    try {
      const snapshot = await getDocs(query(tournamentsRef, orderBy('year', 'desc')))
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament))
    } catch (error) {
      console.error('Error loading tournaments:', error)
      return []
    }
  },

  /**
   * Create tournament
   */
  async create(data: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'> & { adminId: string }): Promise<string> {
    const now = Timestamp.now()
    const docRef = await addDoc(tournamentsRef, {
      ...data,
      adminId: data.adminId || auth.currentUser?.uid,
      createdAt: now,
      updatedAt: now,
    })
    return docRef.id
  },

  /**
   * Update tournament
   */
  async update(id: string, data: Partial<Tournament>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.TOURNAMENTS, id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    })
  },

  /**
   * Delete tournament
   */
  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTIONS.TOURNAMENTS, id)
    await deleteDoc(docRef)
  },

  /**
   * Get single tournament by ID
   */
  async getById(id: string): Promise<Tournament | null> {
    try {
      const docRef = doc(db, COLLECTIONS.TOURNAMENTS, id)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Tournament
      }
      return null
    } catch (error) {
      console.error('Error loading tournament:', error)
      return null
    }
  },

  /**
   * Subscribe to tournament by ID (Real-time)
   */
  subscribeToTournament(id: string, callback: (tournament: Tournament | null) => void): () => void {
    const docRef = doc(db, COLLECTIONS.TOURNAMENTS, id)
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null)
          return
        }
        callback({ id: snapshot.id, ...snapshot.data() } as Tournament)
      },
      (error) => {
        console.error(`[TournamentService] subscribeToTournament error for ${id}:`, error)
        callback(null)
      }
    )
  },
}
