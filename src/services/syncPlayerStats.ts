import { matchService } from './firestore/matches'
import { playerService } from './firestore/players'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/config/firebase'

interface MatchPerformance {
    matchId: string
    opponentName: string
    opponentSquadId: string
    date: string
    result: 'won' | 'lost' | 'tied' | 'unknown'
    // Batting
    runs: number
    balls: number
    fours: number
    sixes: number
    strikeRate: number
    dismissal?: string
    notOut: boolean
    // Bowling
    wickets?: number
    ballsBowled?: number
    overs?: string
    runsConceded?: number
    economy?: number
}

/**
 * Sync match statistics to all participating player profiles
 * Updates career stats and adds match to pastMatches history
 */
export async function syncMatchToPlayerProfiles(matchId: string): Promise<void> {
    try {
        console.log(`[SyncPlayerStats] Starting sync for match ${matchId}`)

        // 1. Fetch match data
        const match = await matchService.getById(matchId)
        if (!match) {
            throw new Error('Match not found')
        }

        // 2. Fetch both innings
        const [teamAInnings, teamBInnings] = await Promise.all([
            matchService.getInnings(matchId, 'teamA').catch(() => null),
            matchService.getInnings(matchId, 'teamB').catch(() => null),
        ])

        if (!teamAInnings && !teamBInnings) {
            throw new Error('No innings data found')
        }

        // 3. Determine match result for each team
        const getTeamResult = (teamSide: 'teamA' | 'teamB'): 'won' | 'lost' | 'tied' | 'unknown' => {
            const statusLower = String(match.status || '').toLowerCase()
            if (statusLower !== 'finished' && statusLower !== 'completed') {
                return 'unknown'
            }

            const teamARuns = teamAInnings?.totalRuns || 0
            const teamBRuns = teamBInnings?.totalRuns || 0

            if (teamARuns === teamBRuns) return 'tied'

            if (teamSide === 'teamA') {
                return teamARuns > teamBRuns ? 'won' : 'lost'
            } else {
                return teamBRuns > teamARuns ? 'won' : 'lost'
            }
        }

        const teamAResult = getTeamResult('teamA')
        const teamBResult = getTeamResult('teamB')

        // 4. Collect all players from Team A & B Paying XIs
        const teamAPlayingXI: string[] = (match as any).teamAPlayingXI || []
        const teamBPlayingXI: string[] = (match as any).teamBPlayingXI || []
        const allParticipants = new Set([...teamAPlayingXI, ...teamBPlayingXI])

        if (allParticipants.size === 0) {
            console.warn(`[SyncPlayerStats] No Playing XI found for match ${matchId}. Using stats to find players.`)
        }

        const teamBName = match.teamBName || 'Team B'
        const teamBId = (match as any).teamBId || (match as any).teamBSquadId || ''
        const teamAName = match.teamAName || 'Team A'
        const teamAId = (match as any).teamAId || (match as any).teamASquadId || ''

        // Helper to collect performance for a player
        const getPerformance = (playerId: string, teamSide: 'teamA' | 'teamB'): MatchPerformance => {
            const innings = teamSide === 'teamA' ? teamAInnings : teamBInnings
            const oppInnings = teamSide === 'teamA' ? teamBInnings : teamAInnings
            const result = teamSide === 'teamA' ? teamAResult : teamBResult
            const enemyName = teamSide === 'teamA' ? teamBName : teamAName
            const enemyId = teamSide === 'teamA' ? teamBId : teamAId

            // Batting info
            const batsStat = innings?.batsmanStats?.find(b => b.batsmanId === playerId)
            // A player "batted" if they appear in batsmanStats (meaning they were at the crease)

            // Bowling info (from the OTHER team's innings)
            const bowlStat = oppInnings?.bowlerStats?.find(b => b.bowlerId === playerId)

            return {
                matchId,
                opponentName: enemyName,
                opponentSquadId: enemyId,
                date: (match as any).date || new Date().toISOString(),
                result,
                // Batting stats
                runs: Number(batsStat?.runs || 0),
                balls: Number(batsStat?.balls || 0),
                fours: Number(batsStat?.fours || 0),
                sixes: Number(batsStat?.sixes || 0),
                strikeRate: Number(batsStat?.strikeRate || 0),
                dismissal: batsStat?.dismissal || null, // Firebase doesn't like undefined
                notOut: batsStat?.notOut || false,
                // Bowling stats
                wickets: Number(bowlStat?.wickets || 0),
                ballsBowled: Number(bowlStat?.ballsBowled || 0),
                overs: bowlStat?.overs || null, // Firebase doesn't like undefined
                runsConceded: Number(bowlStat?.runsConceded || 0),
                economy: Number(bowlStat?.economy || 0),
            } as any
        }

        // 5. Process Team A participants
        for (const playerId of teamAPlayingXI) {
            if (!playerId) continue
            const perf = getPerformance(playerId, 'teamA')
            await updatePlayerStats(playerId, perf, 'batting')
        }

        // 6. Process Team B participants
        for (const playerId of teamBPlayingXI) {
            if (!playerId) continue
            const perf = getPerformance(playerId, 'teamB')
            await updatePlayerStats(playerId, perf, 'batting')
        }

        // 7. Safety: Process anyone in stats who MIGHT not be in PlayingXI (shouldn't happen but good for robustness)
        const statsPlayers = new Set([
            ...(teamAInnings?.batsmanStats?.map(b => b.batsmanId) || []),
            ...(teamAInnings?.bowlerStats?.map(b => b.bowlerId) || []), // Bowlers in Team A innings are Team B players
            ...(teamBInnings?.batsmanStats?.map(b => b.batsmanId) || []),
            ...(teamBInnings?.bowlerStats?.map(b => b.bowlerId) || []) // Bowlers in Team B innings are Team A players
        ])

        for (const playerId of statsPlayers) {
            if (!playerId) continue
            if (teamAPlayingXI.includes(playerId) || teamBPlayingXI.includes(playerId)) continue

            // Determine side
            const isTeamA = teamAInnings?.batsmanStats?.some(b => b.batsmanId === playerId) ||
                teamBInnings?.bowlerStats?.some(b => b.bowlerId === playerId)

            const side = isTeamA ? 'teamA' : 'teamB'
            const perf = getPerformance(playerId, side)
            await updatePlayerStats(playerId, perf, 'batting')
        }

        console.log(`[SyncPlayerStats] ✅ Successfully synced match ${matchId}`)
    } catch (error) {
        console.error('[SyncPlayerStats] ❌ Error syncing match:', error)
        throw error
    }
}

/**
 * Update a single player's stats with new match performance
 * Consolidates into playerService.upsertPastMatchAndRecompute for reliable re-calculation
 */
async function updatePlayerStats(
    playerId: string,
    performance: MatchPerformance,
    _primaryAction: 'batting' | 'bowling'
): Promise<void> {
    try {
        // Enrich performance object with compatibility fields
        const enrichedPerformance = {
            ...performance,
            played: true,
            batted: (performance.balls || 0) > 0 || !!performance.dismissal || performance.notOut === true,
            bowled: (performance.ballsBowled || 0) > 0,
            // Nesting for extra compatibility with various UI components
            batting: {
                runs: Number(performance.runs || 0),
                balls: Number(performance.balls || 0),
                fours: Number(performance.fours || 0),
                sixes: Number(performance.sixes || 0),
                strikeRate: Number(performance.strikeRate || 0),
                notOut: Boolean(performance.notOut),
                dismissal: performance.dismissal || null,
            },
            bowling: (performance.ballsBowled || 0) > 0 ? {
                wickets: Number(performance.wickets || 0),
                ballsBowled: Number(performance.ballsBowled || 0),
                overs: performance.overs || null,
                runsConceded: Number(performance.runsConceded || 0),
                economy: Number(performance.economy || 0),
            } : null // Use null instead of undefined for Firestore
        }

        // Use playerService to upsert and recompute (handles updates to existing matches)
        await playerService.upsertPastMatchAndRecompute(playerId, enrichedPerformance)
    } catch (error) {
        console.error(`[SyncPlayerStats] ❌ Error updating player ${playerId}:`, error)
        throw error
    }
}

/**
 * Global Sync: Scans the ENTIRE database for matches involving this player.
 * Ensures that "every match in the database" is counted as requested.
 */
export async function syncAllMatchesForPlayer(playerId: string): Promise<void> {
    try {
        console.log(`[SyncPlayerStats] 🔍 Starting global backfill for player ${playerId}...`)
        const matchesRef = collection(db, 'matches')

        // Query for matches where player was in either Playing XI
        const qA = query(matchesRef, where('teamAPlayingXI', 'array-contains', playerId))
        const qB = query(matchesRef, where('teamBPlayingXI', 'array-contains', playerId))

        const [snapA, snapB] = await Promise.all([getDocs(qA), getDocs(qB)])

        const allMatches = new Map<string, any>()
        snapA.docs.forEach(d => allMatches.set(d.id, { id: d.id, ...d.data() }))
        snapB.docs.forEach(d => allMatches.set(d.id, { id: d.id, ...d.data() }))

        console.log(`[SyncPlayerStats] Found ${allMatches.size} matches total for player ${playerId}.`)

        // Process them one by one (upsert handles duplicates)
        for (const [id, match] of allMatches) {
            await syncMatchToPlayerProfiles(id, match)
        }

        console.log(`[SyncPlayerStats] ✅ Global backfill complete for ${playerId}`)
    } catch (error) {
        console.error(`[SyncPlayerStats] ❌ Global backfill failed for ${playerId}:`, error)
    }
}
