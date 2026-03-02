import { collection, query, where, getDocs, doc, writeBatch } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS, SUBCOLLECTIONS } from './collections'
import { tournamentService } from './tournaments'

/**
 * Propagates player name changes to all cached locations
 */
export async function propagatePlayerRename(playerId: string, newName: string): Promise<void> {
    console.log(`[CascadingUpdates] Propagating name change for player ${playerId} to ${newName}`)

    const batch = writeBatch(db)

    // 1. Update match innings (batsmanStats, bowlerStats, fallOfWickets)
    // We find matches where this player was in the Playing XI
    const matchesA = await getDocs(query(collection(db, COLLECTIONS.MATCHES), where('teamAPlayingXI', 'array-contains', playerId)))
    const matchesB = await getDocs(query(collection(db, COLLECTIONS.MATCHES), where('teamBPlayingXI', 'array-contains', playerId)))

    const allMatchDocs = [...matchesA.docs, ...matchesB.docs]

    for (const mDoc of allMatchDocs) {
        const matchId = mDoc.id
        for (const side of ['teamA', 'teamB'] as const) {
            const inningRef = doc(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.INNINGS, side)
            const inningSnap = await getDocs(query(collection(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.INNINGS)))
            const inningDoc = inningSnap.docs.find(d => d.id === side)

            if (inningDoc?.exists()) {
                const data = inningDoc.data()
                let changed = false

                const batsmanStats = (data.batsmanStats || []).map((b: any) => {
                    if (b.batsmanId === playerId) {
                        changed = true
                        return { ...b, batsmanName: newName }
                    }
                    return b
                })

                const bowlerStats = (data.bowlerStats || []).map((b: any) => {
                    if (b.bowlerId === playerId) {
                        changed = true
                        return { ...b, bowlerName: newName }
                    }
                    return b
                })

                const fallOfWickets = (data.fallOfWickets || []).map((f: any) => {
                    if (f.batsmanId === playerId) {
                        changed = true
                        return { ...f, batsmanName: newName }
                    }
                    return f
                })

                if (changed) {
                    batch.update(inningDoc.ref, { batsmanStats, bowlerStats, fallOfWickets })
                }
            }
        }
    }

    // 2. Update tournament awards
    const tournaments = await tournamentService.getAll()
    for (const t of tournaments) {
        let tChanged = false
        const tUpdate: any = {}

        if (t.playerOfTheTournament === playerId) {
            tUpdate.playerOfTheTournament = newName // If it's stored as name
            tChanged = true
        }
        // Add other award fields if they store names

        if (tChanged) {
            batch.update(doc(db, COLLECTIONS.TOURNAMENTS, t.id), tUpdate)
        }
    }

    await batch.commit()
    console.log(`[CascadingUpdates] Successfully propagated player rename.`)
}

/**
 * Propagates squad name changes to all cached locations
 */
export async function propagateSquadRename(squadId: string, newName: string): Promise<void> {
    console.log(`[CascadingUpdates] Propagating name change for squad ${squadId} to ${newName}`)

    const batch = writeBatch(db)

    // 1. Update matches (teamAName, teamBName)
    const matchesA = await getDocs(query(collection(db, COLLECTIONS.MATCHES), where('teamAId', '==', squadId)))
    const matchesB = await getDocs(query(collection(db, COLLECTIONS.MATCHES), where('teamBId', '==', squadId)))

    matchesA.docs.forEach(m => batch.update(m.ref, { teamAName: newName }))
    matchesB.docs.forEach(m => batch.update(m.ref, { teamBName: newName }))

    // 2. Update tournament participantSquadMeta
    const tournaments = await getDocs(query(collection(db, COLLECTIONS.TOURNAMENTS), where('participantSquadIds', 'array-contains', squadId)))

    tournaments.docs.forEach(tDoc => {
        const data = tDoc.data()
        const meta = data.participantSquadMeta || {}
        if (meta[squadId]) {
            meta[squadId] = { ...meta[squadId], name: newName }
            batch.update(tDoc.ref, { participantSquadMeta: meta })
        }
    })

    await batch.commit()
    console.log(`[CascadingUpdates] Successfully propagated squad rename.`)
}
