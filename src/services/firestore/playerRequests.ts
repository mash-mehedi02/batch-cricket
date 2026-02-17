import { db, auth } from '@/config/firebase'
import {
    collection,
    addDoc,
    updateDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
    orderBy,
    limit,
    Timestamp,
    deleteDoc,
    setDoc
} from 'firebase/firestore'
import { PlayerRole, BattingStyle, BowlingStyle, Player } from '@/types'

export interface PlayerRegistrationRequest {
    id?: string
    uid: string
    email: string
    name: string
    school: string
    squadId: string
    squadName: string
    role: PlayerRole
    battingStyle: BattingStyle
    bowlingStyle: BowlingStyle
    photoUrl?: string
    status: 'pending' | 'approved' | 'rejected'
    createdAt: Timestamp
    updatedAt: Timestamp
    adminComment?: string
    reviewedBy?: string
    reviewedAt?: Timestamp
    playerId?: string
}

export const playerRequestService = {
    /**
     * Submit a new registration request
     */
    async submitRequest(data: Omit<PlayerRegistrationRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) {
        if (!auth.currentUser) throw new Error('Authentication required')

        // Check if user already has a pending request
        const existing = await this.getUserRequest(auth.currentUser.uid)
        if (existing && existing.status === 'pending') {
            throw new Error('You already have a pending registration request.')
        }

        const requestData = {
            ...data,
            status: 'pending' as const,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }

        const docRef = await addDoc(collection(db, 'player_requests'), requestData)
        return docRef.id
    },

    /**
     * Get request for a specific user
     */
    async getUserRequest(uid: string): Promise<PlayerRegistrationRequest | null> {
        try {
            const q = query(
                collection(db, 'player_requests'),
                where('uid', '==', uid),
                orderBy('createdAt', 'desc'),
                limit(1)
            )
            const snap = await getDocs(q)
            if (snap.empty) return null
            return { id: snap.docs[0].id, ...snap.docs[0].data() } as PlayerRegistrationRequest
        } catch (error: any) {
            console.warn('[playerRequestService] getUserRequest: Index missing, falling back to client-side sort', error);
            const q = query(
                collection(db, 'player_requests'),
                where('uid', '==', uid)
            )
            const snap = await getDocs(q)
            if (snap.empty) return null
            const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerRegistrationRequest))
            return list.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0]
        }
    },

    /**
     * Admin: Get all pending requests
     */
    async getPendingRequests(): Promise<PlayerRegistrationRequest[]> {
        try {
            const q = query(
                collection(db, 'player_requests'),
                where('status', '==', 'pending'),
                orderBy('createdAt', 'desc')
            )
            const snap = await getDocs(q)
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerRegistrationRequest))
        } catch (error: any) {
            console.warn('[playerRequestService] getPendingRequests: Index missing, falling back to client-side sort', error);
            const q = query(
                collection(db, 'player_requests'),
                where('status', '==', 'pending')
            )
            const snap = await getDocs(q)
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlayerRegistrationRequest))
                .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
        }
    },

    /**
     * Admin: Review a request
     */
    async reviewRequest(requestId: string, status: 'approved' | 'rejected', comment?: string) {
        if (!auth.currentUser) throw new Error('Authentication required')

        const requestRef = doc(db, 'player_requests', requestId)
        const requestSnap = await getDoc(requestRef)
        if (!requestSnap.exists()) throw new Error('Request not found')

        const requestData = requestSnap.data() as PlayerRegistrationRequest

        if (status === 'approved') {
            await this.approveRequest(requestId, requestData)
        } else {
            await updateDoc(requestRef, {
                status,
                adminComment: comment || '',
                reviewedBy: auth.currentUser.uid,
                reviewedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            })
        }
    },

    /**
     * Internal approval logic: Creates player, updates squad, updates user
     */
    async approveRequest(requestId: string, request: PlayerRegistrationRequest) {
        if (!auth.currentUser) throw new Error('Authentication required')

        // 1. Create Player Document
        const playerRef = doc(collection(db, 'players'))
        const playerId = playerRef.id

        const playerData: Omit<Player, 'id'> = {
            name: request.name,
            role: request.role,
            school: request.school,
            squadId: request.squadId,
            battingStyle: request.battingStyle,
            bowlingStyle: request.bowlingStyle,
            photoUrl: request.photoUrl || undefined,
            claimed: true,
            ownerUid: request.uid,
            email: request.email,
            maskedEmail: request.email.replace(/(..)(.*)(@.*)/, '$1****$3'),
            createdAt: serverTimestamp() as Timestamp,
            updatedAt: serverTimestamp() as Timestamp,
            createdBy: auth.currentUser.uid,
            // @ts-ignore
            adminId: auth.currentUser.uid
        }

        await setDoc(playerRef, playerData)

        // 2. Update Squad
        const squadRef = doc(db, 'squads', request.squadId)
        const squadSnap = await getDoc(squadRef)
        if (squadSnap.exists()) {
            const currentIds = squadSnap.data().playerIds || []
            if (!currentIds.includes(playerId)) {
                await updateDoc(squadRef, {
                    playerIds: [...currentIds, playerId]
                })
            }
        }

        // 3. Update User Profile
        const userRef = doc(db, 'users', request.uid)
        await updateDoc(userRef, {
            role: 'player',
            playerId: playerId,
            isRegisteredPlayer: true,
            updatedAt: serverTimestamp()
        })

        // 4. Update Request Status
        const requestRef = doc(db, 'player_requests', requestId)
        await updateDoc(requestRef, {
            status: 'approved',
            playerId: playerId,
            reviewedBy: auth.currentUser.uid,
            reviewedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        })
    },

    /**
     * Delete a request (cleanup)
     */
    async deleteRequest(requestId: string) {
        await deleteDoc(doc(db, 'player_requests', requestId))
    }
}
