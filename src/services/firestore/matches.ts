/**
 * Match Service
 * Firestore operations for matches
 */

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, onSnapshot, Timestamp
} from 'firebase/firestore'
import { db, auth } from '@/config/firebase'
import { Match, Ball, InningsStats } from '@/types'
import { COLLECTIONS, SUBCOLLECTIONS } from './collections'

const matchesRef = collection(db, COLLECTIONS.MATCHES)

export const matchService = {
  /**
   * Get match by ID
   */
  async getById(id: string): Promise<Match | null> {
    const docRef = doc(db, COLLECTIONS.MATCHES, id)
    const docSnap = await getDoc(docRef)
    if (!docSnap.exists()) return null
    return { id: docSnap.id, ...docSnap.data() } as Match
  },

  /**
   * Get matches by tournament
   */
  async getByTournament(tournamentId: string): Promise<Match[]> {
    try {
      // Fetch without server-side orderBy to avoid immediate index requirements
      const q = query(
        matchesRef,
        where('tournamentId', '==', tournamentId)
      )
      const snapshot = await getDocs(q)
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Match))

      // Professional in-memory sort (Date desc, Time desc, Version desc)
      return list.sort((a: any, b: any) => {
        const dateA = String(a.date || '')
        const dateB = String(b.date || '')
        if (dateA !== dateB) return dateB.localeCompare(dateA)
        const timeA = String(a.time || '')
        const timeB = String(b.time || '')
        if (timeA !== timeB) return timeB.localeCompare(timeA)
        const tsA = (a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0) as number
        const tsB = (b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0) as number
        return tsB - tsA
      })
    } catch (error) {
      console.error('[MatchService] getByTournament failed:', error)
      return []
    }
  },

  /**
   * Get live matches
   */
  async getLiveMatches(adminId?: string, isSuperAdmin: boolean = false): Promise<Match[]> {
    try {
      // Try all variations of live and innings break statuses
      const statuses = ['live', 'Live', 'inningsbreak', 'InningsBreak', 'INNINGS BREAK']
      const queries = statuses.map(s => {
        let q = query(matchesRef, where('status', '==', s))
        if (adminId && !isSuperAdmin) {
          q = query(q, where('adminId', '==', adminId))
        }
        return q
      })

      const snapshots = await Promise.all(queries.map(q => getDocs(q).catch(() => ({ docs: [] }))))

      const matches = new Map()
      snapshots.forEach(snapshot => {
        snapshot.docs.forEach((doc: any) => {
          matches.set(doc.id, { id: doc.id, ...doc.data() } as Match)
        })
      })

      return Array.from(matches.values()).sort((a: any, b: any) => {
        const dateA = String(a.date || '')
        const dateB = String(b.date || '')
        return dateB.localeCompare(dateA)
      })
    } catch (error) {
      console.error('Error loading live matches:', error)
      return []
    }
  },

  /**
   * Delete a specific ball
   */
  async deleteBall(matchId: string, inningId: 'teamA' | 'teamB', ballId: string): Promise<void> {
    const ballRef = doc(
      db,
      COLLECTIONS.MATCHES,
      matchId,
      SUBCOLLECTIONS.INNINGS,
      inningId,
      SUBCOLLECTIONS.BALLS,
      ballId
    )
    await deleteDoc(ballRef)
  },

  /**
   * Get matches for a specific admin (or all for super admin)
   */
  async getByAdmin(adminId: string, isSuperAdmin: boolean = false): Promise<Match[]> {
    try {
      let q;
      if (isSuperAdmin) {
        q = query(matchesRef) // Remove orderBy to avoid index requirement
      } else {
        q = query(
          matchesRef,
          where('adminId', '==', adminId)
        )
      }
      const snapshot = await getDocs(q)
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match))

      // Client-side sort to avoid Missing Index errors
      return list.sort((a: any, b: any) => {
        const dateA = String(a.date || '')
        const dateB = String(b.date || '')
        return dateB.localeCompare(dateA)
      })
    } catch (error) {
      console.error('Error loading matches by admin:', error)
      return []
    }
  },

  /**
   * Get all matches (Public View)
   */
  async getAll(): Promise<Match[]> {
    try {
      const snapshot = await getDocs(query(matchesRef, orderBy('date', 'desc')))
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match))
    } catch (error) {
      console.error('Error loading matches:', error)
      return []
    }
  },

  /**
   * Get matches by squad (teamA or teamB)
   */
  async getBySquad(squadId: string): Promise<Match[]> {
    try {
      const [snapA, snapB] = await Promise.all([
        getDocs(query(matchesRef, where('teamAId', '==', squadId), orderBy('date', 'desc'))),
        getDocs(query(matchesRef, where('teamBId', '==', squadId), orderBy('date', 'desc')))
      ])

      const matches = new Map<string, Match>()
      snapA.docs.forEach(d => matches.set(d.id, { id: d.id, ...d.data() } as Match))
      snapB.docs.forEach(d => matches.set(d.id, { id: d.id, ...d.data() } as Match))

      return Array.from(matches.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    } catch (error) {
      console.warn('[MatchService] getBySquad: orderBy query failed, falling back to client-side sort.', error)
      // Fallback without orderBy
      const [snapA, snapB] = await Promise.all([
        getDocs(query(matchesRef, where('teamAId', '==', squadId))),
        getDocs(query(matchesRef, where('teamBId', '==', squadId)))
      ])
      const matches = new Map<string, Match>()
      snapA.docs.forEach(d => matches.set(d.id, { id: d.id, ...d.data() } as Match))
      snapB.docs.forEach(d => matches.set(d.id, { id: d.id, ...d.data() } as Match))

      return Array.from(matches.values()).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    }
  },

  /**
   * Subscribe to match updates
   */
  subscribeToMatch(matchId: string, callback: (match: Match | null) => void): () => void {
    const docRef = doc(db, COLLECTIONS.MATCHES, matchId)
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null)
          return
        }
        callback({ id: snapshot.id, ...snapshot.data() } as Match)
      },
      (error) => {
        console.error(`[MatchService] subscribeToMatch error for match ${matchId}:`, error)
        callback(null)
      }
    )
  },

  /**
   * Get innings data
   */
  async getInnings(matchId: string, inningId: 'teamA' | 'teamB'): Promise<InningsStats | null> {
    try {
      const docRef = doc(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.INNINGS, inningId)
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) return null
      return { ...docSnap.data() } as InningsStats
    } catch (error) {
      console.error(`[MatchService] Error getting innings ${inningId} for match ${matchId}:`, error)
      return null
    }
  },

  /**
   * Subscribe to innings updates
   */
  subscribeToInnings(
    matchId: string,
    inningId: 'teamA' | 'teamB',
    callback: (innings: InningsStats | null) => void
  ): () => void {
    const docRef = doc(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.INNINGS, inningId)
    return onSnapshot(
      docRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null)
          return
        }
        callback({ ...snapshot.data() } as InningsStats)
      },
      (error) => {
        console.error(`[MatchService] subscribeToInnings error for match ${matchId} inning ${inningId}:`, error)
        callback(null)
      }
    )
  },

  /**
   * Get balls for an innings
   */
  async getBalls(matchId: string, inningId: 'teamA' | 'teamB'): Promise<Ball[]> {
    const ballsRef = collection(
      db,
      COLLECTIONS.MATCHES,
      matchId,
      SUBCOLLECTIONS.INNINGS,
      inningId,
      SUBCOLLECTIONS.BALLS
    )
    const q = query(ballsRef, orderBy('sequence', 'asc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ball))
  },

  /**
   * Subscribe to balls for an innings (real-time)
   */
  subscribeToBalls(
    matchId: string,
    inningId: 'teamA' | 'teamB',
    callback: (balls: Ball[]) => void
  ): () => void {
    const ballsRef = collection(
      db,
      COLLECTIONS.MATCHES,
      matchId,
      SUBCOLLECTIONS.INNINGS,
      inningId,
      SUBCOLLECTIONS.BALLS
    )
    const q = query(ballsRef, orderBy('sequence', 'asc'))
    return onSnapshot(
      q,
      (snapshot) => {
        callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Ball)))
      },
      (error) => {
        console.error(`[MatchService] subscribeToBalls error for match ${matchId} inning ${inningId}:`, error)
        callback([])
      }
    )
  },

  /**
   * Create match
   */
  async create(data: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> & { adminId: string }): Promise<string> {
    const now = Timestamp.now()
    const docRef = await addDoc(matchesRef, {
      ...data,
      adminId: data.adminId || auth.currentUser?.uid,
      createdAt: now,
      updatedAt: now,
    })
    return docRef.id
  },

  /**
   * Update match
   */
  async update(id: string, data: Partial<Match>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.MATCHES, id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now(),
    })

    // If status updated to finished, trigger sync
    const status = (data.status as string)?.toLowerCase()
    if (status === 'finished' || status === 'completed') {
      console.log(`[MatchService] Match ${id} finished, triggering player stats sync...`)
      const { syncMatchToPlayerProfiles } = await import('../syncPlayerStats')
      await syncMatchToPlayerProfiles(id).catch(err => console.error('Sync failed:', err))
    }
  },

  /**
   * Delete match
   * This will also remove match stats from all players who played in this match
   */
  async delete(id: string): Promise<void> {
    // First, remove match stats from all players
    await this.removeMatchStatsFromPlayers(id)

    // Delete innings subcollections
    const inningsRefs: ('teamA' | 'teamB')[] = ['teamA', 'teamB']
    for (const inningId of inningsRefs) {
      const ballsRef = collection(
        db,
        COLLECTIONS.MATCHES,
        id,
        SUBCOLLECTIONS.INNINGS,
        inningId,
        SUBCOLLECTIONS.BALLS
      )
      const ballsSnapshot = await getDocs(ballsRef)
      const ballDeletePromises = ballsSnapshot.docs.map((ballDoc) => deleteDoc(ballDoc.ref))
      await Promise.all(ballDeletePromises)

      const inningRef = doc(db, COLLECTIONS.MATCHES, id, SUBCOLLECTIONS.INNINGS, inningId)
      const inningDoc = await getDoc(inningRef)
      if (inningDoc.exists()) {
        await deleteDoc(inningRef)
      }
    }

    // Delete match document
    const matchRef = doc(db, COLLECTIONS.MATCHES, id)
    await deleteDoc(matchRef)

    // Cleanup playerMatchStats collection
    try {
      const statsRef = collection(db, 'playerMatchStats')
      const qStats = query(statsRef, where('matchId', '==', id))
      const statsSnap = await getDocs(qStats)
      const deletePromises = statsSnap.docs.map(d => deleteDoc(d.ref))
      await Promise.all(deletePromises)
      console.log(`[MatchService] Cleaned up ${deletePromises.length} playerMatchStats for match ${id}`)
    } catch (err) {
      console.error('[MatchService] playerMatchStats cleanup failed:', err)
    }
  },

  /**
   * Remove match stats from all players who played in this match
   */
  async removeMatchStatsFromPlayers(matchId: string): Promise<void> {
    const { playerService } = await import('./players')
    const players = await playerService.getAll()

    // Helper function to recalculate stats from pastMatches
    const recalculateStats = (pastMatches: any[]) => {
      const totals = pastMatches.reduce(
        (acc, match) => {
          const runs = Number(match.runs || 0)
          const balls = Number(match.balls || 0)
          const fours = Number(match.fours || 0)
          const sixes = Number(match.sixes || 0)
          const wickets = Number(match.wickets || 0)
          const ballsBowled = Number(match.ballsBowled || 0)
          const runsConceded = Number(match.runsConceded || 0)

          if (match.played) acc.matches += 1
          acc.runs += runs
          acc.balls += balls
          acc.fours += fours
          acc.sixes += sixes
          acc.wickets += wickets
          acc.ballsBowled += ballsBowled
          acc.runsConceded += runsConceded

          if (match.batted) {
            acc.battingInnings += 1
            if (match.notOut) {
              acc.notOuts += 1
            } else {
              acc.dismissals += 1
            }
          }

          if (runs > acc.highest) acc.highest = runs
          if (runs >= 50 && runs < 100) acc.fifties += 1
          if (runs >= 100) acc.hundreds += 1

          return acc
        },
        {
          matches: 0,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          wickets: 0,
          ballsBowled: 0,
          runsConceded: 0,
          battingInnings: 0,
          dismissals: 0,
          notOuts: 0,
          highest: 0,
          fifties: 0,
          hundreds: 0,
        }
      )

      const strikeRate = totals.balls > 0 ? (totals.runs / totals.balls) * 100 : 0
      const average =
        totals.dismissals > 0
          ? totals.runs / totals.dismissals
          : totals.battingInnings > 0 && totals.runs > 0
            ? totals.runs
            : 0
      const economy = totals.ballsBowled > 0 ? totals.runsConceded / (totals.ballsBowled / 6) : 0
      const bowlingAverage = totals.wickets > 0 ? totals.runsConceded / totals.wickets : 0
      const bowlingStrikeRate = totals.wickets > 0 ? totals.ballsBowled / totals.wickets : 0

      return {
        matches: totals.matches,
        innings: totals.battingInnings,
        runs: totals.runs,
        balls: totals.balls,
        fours: totals.fours,
        sixes: totals.sixes,
        wickets: totals.wickets,
        ballsBowled: totals.ballsBowled,
        runsConceded: totals.runsConceded,
        dismissals: totals.dismissals,
        notOuts: totals.notOuts,
        highestScore: totals.highest,
        average: Number(average.toFixed(2)),
        strikeRate: Number(strikeRate.toFixed(2)),
        hundreds: totals.hundreds,
        fifties: totals.fifties,
        economy: Number(economy.toFixed(2)),
        bowlingAverage: Number(bowlingAverage.toFixed(2)),
        bowlingStrikeRate: Number(bowlingStrikeRate.toFixed(2)),
      }
    }

    // Update each player
    const updatePromises = players.map(async (player) => {
      const pastMatches = (player.pastMatches || []).filter(
        (match: any) => match.matchId !== matchId && match.id !== matchId
      )

      // Only update if match was found and removed
      if (pastMatches.length !== (player.pastMatches || []).length) {
        const aggregatedStats = recalculateStats(pastMatches)
        await playerService.update(player.id, {
          pastMatches,
          stats: aggregatedStats,
        })
      }
    })

    await Promise.all(updatePromises)
  },
}

