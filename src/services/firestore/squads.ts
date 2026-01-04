/**
 * Squad Service
 * Firestore operations for squads
 */

import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Squad } from '@/types'
import { COLLECTIONS } from './collections'

const squadsRef = collection(db, COLLECTIONS.SQUADS)

function stripUndefined(obj: Record<string, any>) {
  const out: Record<string, any> = {}
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v !== undefined) out[k] = v
  })
  return out
}

export const squadService = {
  /**
   * Subscribe to all squads (realtime). Useful so renamed squads update everywhere instantly.
   */
  subscribeAll(callback: (squads: Squad[]) => void): () => void {
    // Avoid orderBy to prevent index requirements; sort client-side.
    return onSnapshot(
      squadsRef,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Squad))
          .sort((a, b) => {
            const yearCompare = (Number(b.year || 0) - Number(a.year || 0))
            if (yearCompare !== 0) return yearCompare
            return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase())
          })
        callback(list)
      },
      (error) => {
        console.error('[squadService] subscribeAll error:', error)
        callback([])
      }
    )
  },

  /**
   * Subscribe to a single squad doc (realtime).
   */
  subscribeToSquad(id: string, callback: (squad: Squad | null) => void): () => void {
    const ref = doc(db, COLLECTIONS.SQUADS, id)
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return callback(null)
        callback({ id: snap.id, ...snap.data() } as Squad)
      },
      (error) => {
        console.error('[squadService] subscribeToSquad error:', error)
        callback(null)
      }
    )
  },

  /**
   * Get all squads
   */
  async getAll(): Promise<Squad[]> {
    try {
      const snapshot = await getDocs(query(squadsRef, orderBy('year', 'desc'), orderBy('name')))
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Squad))
    } catch (error) {
      console.error('Error loading squads with orderBy:', error)
      // Try without orderBy if index doesn't exist
      try {
        const snapshot = await getDocs(squadsRef)
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Squad))
          .sort((a, b) => {
            const yearCompare = (b.year || 0) - (a.year || 0)
            if (yearCompare !== 0) return yearCompare
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
   * Get squads by tournament
   */
  async getByTournament(tournamentId: string): Promise<Squad[]> {
    const q = query(squadsRef, where('tournamentId', '==', tournamentId), orderBy('name'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Squad))
  },

  /**
   * Get squads by year
   */
  async getByYear(year: number): Promise<Squad[]> {
    const q = query(squadsRef, where('year', '==', year), orderBy('name'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Squad))
  },

  /**
   * Get squad by ID
   */
  async getById(id: string): Promise<Squad | null> {
    const docRef = doc(db, COLLECTIONS.SQUADS, id)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) return null
    return { id: docSnap.id, ...docSnap.data() } as Squad
  },

  /**
   * Get squads by exact name (useful for resolving legacy matches that stored names instead of IDs)
   */
  async getByName(name: string): Promise<Squad[]> {
    if (!name) return []
    try {
      const q = query(squadsRef, where('name', '==', name))
      const snapshot = await getDocs(q)
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Squad))
    } catch (error) {
      console.error('Error loading squads by name:', error)
      return []
    }
  },

  /**
   * Create squad
   */
  async create(data: Omit<Squad, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Timestamp.now()
    const docRef = await addDoc(squadsRef, {
      ...stripUndefined(data as any),
      createdAt: now,
      updatedAt: now,
    })
    return docRef.id
  },

  /**
   * Update squad
   */
  async update(id: string, data: Partial<Squad>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.SQUADS, id)
    await updateDoc(docRef, {
      ...stripUndefined(data as any),
      updatedAt: Timestamp.now(),
    })
  },

  /**
   * Delete squad
   */
  async delete(id: string): Promise<void> {
    const docRef = doc(db, COLLECTIONS.SQUADS, id)
    await deleteDoc(docRef)
  },
}

