import { db, auth } from '@/config/firebase'
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore'

import toast from 'react-hot-toast'

export type FollowType = 'tournament' | 'squad'

export const followService = {
    /**
     * Follow a tournament or squad
     */
    async follow(type: FollowType, id: string): Promise<boolean> {
        const user = auth.currentUser
        if (!user) {
            // Store pending follow for after login
            sessionStorage.setItem('pending_follow', JSON.stringify({ type, id }))
            return false
        }

        try {
            const userRef = doc(db, 'users', user.uid)
            // Security: Check role before following
            const userSnap = await getDoc(userRef)
            if (userSnap.exists()) {
                const userData = userSnap.data()
                if (userData.role === 'admin' || userData.role === 'super_admin') {
                    console.warn('[followService] Admins cannot follow items.')
                    return false
                }
            }

            const field = type === 'tournament' ? 'followedTournaments' : 'followedSquads'

            await updateDoc(userRef, {
                [field]: arrayUnion(id)
            })

            toast.success(`Following ${type}!`)
            return true
        } catch (error) {
            console.error('Follow error:', error)
            toast.error('Failed to follow')
            return false
        }
    },

    /**
     * Unfollow a tournament or squad
     */
    async unfollow(type: FollowType, id: string): Promise<boolean> {
        const user = auth.currentUser
        if (!user) return false

        try {
            const userRef = doc(db, 'users', user.uid)
            const field = type === 'tournament' ? 'followedTournaments' : 'followedSquads'

            await updateDoc(userRef, {
                [field]: arrayRemove(id)
            })

            toast.success(`Unfollowed ${type}`)
            return true
        } catch (error) {
            console.error('Unfollow error:', error)
            // toast.error('Failed to unfollow')
            return false
        }
    },

    /**
     * Check if user is following
     */
    isFollowing(user: any, type: FollowType, id: string): boolean {
        if (!user) return false
        const list = type === 'tournament' ? user.followedTournaments : user.followedSquads
        return Array.isArray(list) && list.includes(id)
    },

    /**
     * Process any pending follow after login
     */
    async processPendingFollow() {
        const pending = sessionStorage.getItem('pending_follow')
        if (pending && auth.currentUser) {
            try {
                const { type, id } = JSON.parse(pending)
                await this.follow(type, id)
                sessionStorage.removeItem('pending_follow')
            } catch (e) {
                console.error('Error processing pending follow:', e)
            }
        }
    }
}
