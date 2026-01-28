import { collection, doc, setDoc, updateDoc, getDocs, query, where, Timestamp, increment } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from './collections'

const COLLECTION_NAME = 'playerMatchStats'

export interface PlayerMatchStats {
  runs: number
  balls: number
  fours: number
  sixes: number
  out: boolean
  dismissalType: string | null
  oversBowled: number
  runsConceded: number
  wickets: number
  matchId: string
  playerId: string
  lastUpdated: Timestamp
}

function docId(matchId: string, playerId: string): string {
  return `${matchId}_${playerId}`
}

export const playerMatchStatsService = {
  async ensureParticipation(matchId: string, playerId: string, opponentName?: string): Promise<void> {
    const id = docId(matchId, playerId)
    const ref = doc(collection(db, COLLECTION_NAME), id)
    await setDoc(
      ref,
      {
        matchId,
        playerId,
        opponent: opponentName || 'Opponent',
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
        dismissalType: null,
        oversBowled: 0,
        runsConceded: 0,
        wickets: 0,
        lastUpdated: Timestamp.now(),
      } as any,
      { merge: true }
    )
  },

  async updateBattingForBall(matchId: string, playerId: string, data: { runs: number; balls: number; fours?: number; sixes?: number; out?: boolean; dismissalType?: string | null }): Promise<void> {
    const id = docId(matchId, playerId)
    const ref = doc(collection(db, COLLECTION_NAME), id)
    await setDoc(ref, { matchId, playerId }, { merge: true })
    const patch: any = {
      runs: increment(Number(data.runs || 0)),
      balls: increment(Number(data.balls || 0)),
      fours: increment(Number(data.fours || 0)),
      sixes: increment(Number(data.sixes || 0)),
      lastUpdated: Timestamp.now(),
    }
    if (data.out === true) {
      patch.out = true
      if (data.dismissalType !== undefined) patch.dismissalType = data.dismissalType
    }
    await updateDoc(ref, patch)
  },

  async updateBowlingForBall(matchId: string, playerId: string, data: { oversDelta: number; runsConceded: number; wicket?: boolean }): Promise<void> {
    const id = docId(matchId, playerId)
    const ref = doc(collection(db, COLLECTION_NAME), id)
    await setDoc(ref, { matchId, playerId }, { merge: true })
    const patch: any = {
      oversBowled: increment(Number(data.oversDelta || 0)),
      runsConceded: increment(Number(data.runsConceded || 0)),
      lastUpdated: Timestamp.now(),
    }
    if (data.wicket === true) {
      patch.wickets = increment(1)
    }
    await updateDoc(ref, patch)
  },

  async aggregateCareerStats(playerId: string): Promise<void> {
    console.log(`[PlayerMatchStats] 📊 Aggregating career stats for ${playerId}...`)
    const q = query(collection(db, COLLECTION_NAME), where('playerId', '==', playerId))
    const snapshot = await getDocs(q)
    let matchesSet = new Set<string>()
    let batting = { innings: 0, runs: 0, balls: 0, outs: 0, average: 0, strikeRate: 0, fours: 0, sixes: 0, highestScore: 0, fifties: 0, hundreds: 0 }
    let bowling = { innings: 0, overs: 0, runsConceded: 0, wickets: 0, economy: 0, bowlingAverage: 0, strikeRate: 0 }

    console.log(`[PlayerMatchStats] Found ${snapshot.size} match records for player.`)

    snapshot.forEach((d) => {
      const s = d.data() as any
      const mid = String(s.matchId || '').trim()
      if (mid) matchesSet.add(mid)

      const runs = Number(s.runs || 0)
      const balls = Number(s.balls || 0)
      const fours = Number(s.fours || 0)
      const sixes = Number(s.sixes || 0)
      const out = Boolean(s.out)
      const oversBowled = Number(s.oversBowled || 0)
      const rc = Number(s.runsConceded || 0)
      const wkts = Number(s.wickets || 0)

      // Batting Innings: If they faced a ball or were out
      if (balls > 0 || out) {
        batting.innings += 1
      }

      batting.runs += runs
      batting.balls += balls
      batting.fours += fours
      batting.sixes += sixes
      if (out) batting.outs += 1

      // Track highest score
      if (runs > batting.highestScore) {
        batting.highestScore = runs
      }

      // Track 50s and 100s
      if (runs >= 100) {
        batting.hundreds += 1
      } else if (runs >= 50) {
        batting.fifties += 1
      }

      // Bowling Innings/Stats
      if (oversBowled > 0) {
        bowling.innings += 1
      }
      bowling.overs += oversBowled
      bowling.runsConceded += rc
      bowling.wickets += wkts
    })

    // Batting Averages
    batting.average = batting.outs > 0 ? batting.runs / batting.outs : (batting.outs === 0 && batting.runs > 0 ? batting.runs : 0)
    batting.strikeRate = batting.balls > 0 ? (batting.runs / batting.balls) * 100 : 0

    // Bowling Economy/Average
    bowling.economy = bowling.overs > 0 ? bowling.runsConceded / bowling.overs : 0
    bowling.bowlingAverage = bowling.wickets > 0 ? bowling.runsConceded / bowling.wickets : 0
    // Bowling Strike Rate = Balls per wicket
    const totalBallsBowled = bowling.overs * 6
    bowling.strikeRate = bowling.wickets > 0 ? totalBallsBowled / bowling.wickets : 0

    const careerStats = {
      matches: matchesSet.size,
      batting,
      bowling,
    }

    console.log(`[PlayerMatchStats] ✅ Result: ${careerStats.matches} matches, ${careerStats.batting.runs} runs.`)

    const playerRef = doc(collection(db, COLLECTIONS.PLAYERS), playerId)
    await updateDoc(playerRef, { stats: careerStats, updatedAt: Timestamp.now() } as any)
  },

  /**
   * Migrate legacy pastMatches array into the playerMatchStats collection
   */
  async migrateFromPastMatches(playerId: string, pastMatches: any[]): Promise<void> {
    if (!pastMatches || !Array.isArray(pastMatches) || pastMatches.length === 0) {
      console.warn(`[PlayerMatchStats] ⚠️ No past matches to migrate for ${playerId}`)
      return
    }

    console.log(`[PlayerMatchStats] 🚚 Migrating ${pastMatches.length} legacy matches for ${playerId}...`)

    const { getDoc, doc: fsDoc } = await import('firebase/firestore')
    const tasks = pastMatches.map(async (m: any) => {
      const mid = m.matchId || m.id
      if (!mid) return

      // Verify match exists globally before migrating
      const matchRef = fsDoc(db, COLLECTIONS.MATCHES, mid)
      const matchSnap = await getDoc(matchRef)
      if (!matchSnap.exists()) {
        console.warn(`[PlayerMatchStats] 🧟 Skipping zombie match ${mid} (not found in matches collection)`)
        return
      }

      const id = docId(mid, playerId)
      const ref = doc(collection(db, COLLECTION_NAME), id)

      // Map legacy format to new schema
      const runs = Number(m.runs ?? m.batting?.runs ?? 0)
      const balls = Number(m.balls ?? m.batting?.balls ?? 0)
      const fours = Number(m.fours ?? m.batting?.fours ?? 0)
      const sixes = Number(m.sixes ?? m.batting?.sixes ?? 0)
      const out = Boolean(m.out || m.batting?.out || !!m.dismissal || !!m.batting?.dismissal)
      const dismissalType = m.dismissal || m.batting?.dismissal || null

      const oversBowled = Number(m.oversBowled ?? m.bowling?.oversBowled ?? (Number(m.ballsBowled || 0) / 6))
      const runsConceded = Number(m.runsConceded ?? m.bowling?.runsConceded ?? 0)
      const wickets = Number(m.wickets ?? m.bowling?.wickets ?? 0)
      const opponent = m.opponentName || m.opponent || 'Opponent'

      console.log(`[PlayerMatchStats] Migrating match ${mid}: ${runs} runs, ${wickets} wkts.`)

      await setDoc(ref, {
        matchId: mid,
        playerId,
        opponent,
        runs,
        balls,
        fours,
        sixes,
        out,
        dismissalType,
        oversBowled,
        runsConceded,
        wickets,
        lastUpdated: Timestamp.now(),
      }, { merge: true })

      return String(mid)
    })

    const results = await Promise.all(tasks)
    const validMatchesBeforeAggregation = results.filter(Boolean) as string[]

    // 3. Update the player document's pastMatches to remove zombies (legacy cleanup)
    if (validMatchesBeforeAggregation.length !== pastMatches.length) {
      console.log(`[PlayerMatchStats] 🧹 Pruning ${pastMatches.length - validMatchesBeforeAggregation.length} zombie matches from player doc.`)
      const prunedPm = pastMatches.filter(m => {
        const mid = m.matchId || m.id
        return validMatchesBeforeAggregation.includes(String(mid))
      })
      const playerRef = fsDoc(db, COLLECTIONS.PLAYERS, playerId)
      await updateDoc(playerRef, { pastMatches: prunedPm })
    }

    console.log(`[PlayerMatchStats] 🏁 Migration complete. Aggregating...`)
    await this.aggregateCareerStats(playerId)
  },

  async bulkAggregateCareerStats(playerIds: string[]): Promise<void> {
    const tasks = playerIds.map((pid) => this.aggregateCareerStats(pid))
    await Promise.all(tasks)
  },
}
