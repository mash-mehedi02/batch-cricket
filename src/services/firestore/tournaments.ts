/**
 * Tournament Service
 * Firestore operations for tournaments
 */

import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Tournament } from '@/types'
import { COLLECTIONS } from './collections'

const tournamentsRef = collection(db, COLLECTIONS.TOURNAMENTS)

export const tournamentService = {
  /**
   * Get all tournaments
   */
  async getAll(): Promise<Tournament[]> {
    try {
      const snapshot = await getDocs(query(tournamentsRef, orderBy('year', 'desc')))
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament))
    } catch (error) {
      console.error('Error loading tournaments with orderBy:', error)
      // Try without orderBy if index doesn't exist
      try {
        const snapshot = await getDocs(tournamentsRef)
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament))
          .sort((a, b) => (b.year || 0) - (a.year || 0))
      } catch (fallbackError) {
        console.error('Error in fallback query:', fallbackError)
        return []
      }
    }
  },

  /**
   * Get tournaments by year
   */
  async getByYear(year: number): Promise<Tournament[]> {
    const q = query(tournamentsRef, where('year', '==', year), orderBy('name'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament))
  },

  /**
   * Get tournament by ID
   */
  async getById(id: string): Promise<Tournament | null> {
    const docRef = doc(db, COLLECTIONS.TOURNAMENTS, id)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) return null
    return { id: docSnap.id, ...docSnap.data() } as Tournament
  },

  /**
   * Create tournament
   */
  async create(data: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Timestamp.now()
    const docRef = await addDoc(tournamentsRef, {
      ...data,
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
}

