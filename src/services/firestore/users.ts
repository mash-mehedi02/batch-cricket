/**
 * User Service
 * Firestore operations for managing the 'users' collection
 */

import {
    collection,
    doc,
    getDocs,
    updateDoc,
    query,
    orderBy,
    serverTimestamp
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from './collections'
import { User } from '@/types'

const usersRef = collection(db, COLLECTIONS.USERS)

export const userService = {
    /**
     * Get all registered users (Admin only)
     */
    async getAll(): Promise<User[]> {
        try {
            const q = query(usersRef, orderBy('createdAt', 'desc'))
            const snapshot = await getDocs(q)
            return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User))
        } catch (error) {
            console.error('[userService] getAll failed:', error)
            // Fallback: fetch without order if index is missing
            const snapshot = await getDocs(usersRef)
            return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User))
        }
    },

    /**
     * Update user role
     */
    async updateRole(uid: string, role: string): Promise<void> {
        const docRef = doc(db, COLLECTIONS.USERS, uid)
        await updateDoc(docRef, {
            role,
            updatedAt: serverTimestamp()
        })
    },

    /**
     * Link a user to a player profile
     */
    async linkToPlayer(uid: string, playerId: string): Promise<void> {
        const docRef = doc(db, COLLECTIONS.USERS, uid)
        await updateDoc(docRef, {
            playerId: playerId,
            linkedPlayerId: playerId,
            isRegisteredPlayer: true,
            'playerProfile.isRegisteredPlayer': true,
            updatedAt: serverTimestamp()
        })
    }
}
