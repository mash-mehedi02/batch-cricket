import { db } from '../../config/firebase'
import {
    doc,
    updateDoc,
    increment,
    onSnapshot,
    setDoc,
    getDoc
} from 'firebase/firestore'

export interface VoteData {
    teamAVotes: number
    teamBVotes: number
    totalVotes: number
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
        const voteRef = doc(db, 'matchVotes', matchId)

        try {
            // Check if document exists, if not create it
            const snap = await getDoc(voteRef)
            if (!snap.exists()) {
                await setDoc(voteRef, {
                    teamAVotes: 0,
                    teamBVotes: 0
                })
            }

            await updateDoc(voteRef, {
                [team === 'teamA' ? 'teamAVotes' : 'teamBVotes']: increment(1)
            })

            // Save to local storage to prevent multiple votes from same device
            localStorage.setItem(`voted_${matchId}`, team)
            return true
        } catch (error) {
            console.error('[VoteService] Failed to cast vote:', error)
            return false
        }
    },

    /**
     * Check if user already voted for this match
     */
    getUserVote(matchId: string): string | null {
        return localStorage.getItem(`voted_${matchId}`)
    }
}
