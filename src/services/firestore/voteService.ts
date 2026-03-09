import { db } from '../../config/firebase'
import {
    doc,
    increment,
    onSnapshot,
    runTransaction
} from 'firebase/firestore'
import { useAuthStore } from '../../store/authStore'

console.log('[VoteService] Module loaded');

export interface VoteData {
    teamAVotes: number
    teamBVotes: number
    totalVotes: number
}

// Ensure a persistent voter ID for guests
const getVoterId = () => {
    try {
        const authStore = useAuthStore.getState();
        if (authStore.user?.uid) return authStore.user.uid;
    } catch (e) {
        console.warn('[VoteService] Could not access authStore state');
    }

    let guestId = localStorage.getItem('guest_voter_id')
    if (!guestId) {
        guestId = 'g_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        localStorage.setItem('guest_voter_id', guestId)
    }
    return guestId
}

export const voteService = {
    /**
     * Subscribe to live vote counts for a match
     */
    subscribeToVotes(matchId: string, callback: (data: VoteData) => void) {
        const voteRef = doc(db, 'matchVotes', matchId)

        return onSnapshot(voteRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data()
                callback({
                    teamAVotes: data.teamAVotes || 0,
                    teamBVotes: data.teamBVotes || 0,
                    totalVotes: (data.teamAVotes || 0) + (data.teamBVotes || 0)
                })
            } else {
                callback({ teamAVotes: 0, teamBVotes: 0, totalVotes: 0 })
            }
        })
    },

    /**
     * Cast a vote for a team
     */
    async castVote(matchId: string, team: 'teamA' | 'teamB') {
        const voterId = getVoterId() || 'anonymous'
        console.log('[VoteService] Attempting vote:', { matchId, voterId, team })
        const voteRef = doc(db, 'matchVotes', matchId)
        const ballotRef = doc(db, 'matchVotes', matchId, 'ballots', voterId)
        console.log('[VoteService] Paths:', {
            votePath: voteRef.path,
            ballotPath: ballotRef.path
        })

        try {
            await runTransaction(db, async (transaction) => {
                // 1. Check if ballot already exists
                const ballotSnap = await transaction.get(ballotRef)
                if (ballotSnap.exists()) {
                    throw new Error('ALREADY_VOTED')
                }

                // 2. Check if aggregate doc exists
                const voteSnap = await transaction.get(voteRef)
                if (!voteSnap.exists()) {
                    transaction.set(voteRef, {
                        teamAVotes: 0,
                        teamBVotes: 0
                    })
                }

                // 3. Increment counters
                transaction.update(voteRef, {
                    [team === 'teamA' ? 'teamAVotes' : 'teamBVotes']: increment(1)
                })

                // 4. Record the ballot
                transaction.set(ballotRef, {
                    choice: team,
                    voterId: voterId,
                    timestamp: new Date()
                })
            })

            // Save to local storage for instant UI feedback across sessions
            localStorage.setItem(`voted_${matchId}`, team)
            return { success: true }
        } catch (error: any) {
            console.error('[VoteService] Failed to cast vote:', error)
            if (error.message === 'ALREADY_VOTED') {
                localStorage.setItem(`voted_${matchId}`, 'unknown') // Tag as voted
                return { success: false, reason: 'ALREADY_VOTED' }
            }
            return { success: false, reason: 'ERROR' }
        }
    },

    /**
     * Check if user already voted for this match
     */
    getUserVote(matchId: string): string | null {
        return localStorage.getItem(`voted_${matchId}`)
    }
}
