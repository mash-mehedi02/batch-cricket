/**
 * Tournament Points Table (Public)
 * Standings computed from matches + innings data (ICC-style basics)
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { matchService } from '@/services/firestore/matches'
import { squadService } from '@/services/firestore/squads'
import type { Match, Tournament, InningsStats } from '@/types'
import type { TournamentConfig, MatchResult } from '@/engine/tournament'
import { computeGroupStandings, validateTournamentConfig } from '@/engine/tournament'



type Row = {
  squadId: string
  squadName: string
  groupId: string
  groupName: string
  played: number
  won: number
  lost: number
  tied: number
  noResult: number
  points: number
  runsFor: number
  ballsFaced: number
  runsAgainst: number
  ballsBowled: number
  nrr: number
}

const ballsToOversDecimal = (balls: number) => (balls > 0 ? balls / 6 : 0)

const resolveSquadId = (m: any, side: 'A' | 'B') => {
  if (side === 'A') return m.teamAId || m.teamASquadId || m.teamA
  return m.teamBId || m.teamBSquadId || m.teamB
}

const getSquadDisplayName = (s: any): string => {
  return (
    String(s?.name || '').trim() ||
    String(s?.teamName || '').trim() ||
    String(s?.squadName || '').trim() ||
    String(s?.title || '').trim() ||
    ''
  )
}

// ... imports

export default function TournamentPointsTable({
  embedded = false,
  tournamentId: tournamentIdProp,
  filterSquadIds,
  matches: matchesProp,
  inningsMap: inningsMapProp
}: {
  embedded?: boolean
  tournamentId?: string
  filterSquadIds?: string[]
  matches?: Match[]
  inningsMap?: Map<string, { teamA: InningsStats | null; teamB: InningsStats | null }>
} = {}) {
  const params = useParams<{ tournamentId: string }>()
  const tournamentId = tournamentIdProp || params.tournamentId
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [inningsMap, setInningsMap] = useState<Map<string, { teamA: InningsStats | null; teamB: InningsStats | null }>>(new Map())
  const [squadsById, setSquadsById] = useState<Map<string, any>>(new Map())
  const [squadIdByName, setSquadIdByName] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  // Sync props
  useEffect(() => {
    if (matchesProp) setMatches(matchesProp)
    if (inningsMapProp) setInningsMap(inningsMapProp)
  }, [matchesProp, inningsMapProp])

  useEffect(() => {
    const run = async () => {
      if (!tournamentId) return

      if (!matchesProp && !inningsMapProp) setLoading(true)

      try {
        const t = await tournamentService.getById(tournamentId)
        setTournament(t)

        const ms = matchesProp || await matchService.getByTournament(tournamentId)
        if (!matchesProp) setMatches(ms)

        // Realtime squads
        const byId = new Map<string, any>()
        const byName = new Map<string, string>()
        const unsubSquads = squadService.subscribeAll((allSquads) => {
          byId.clear()
          byName.clear()
            ; (allSquads as any[]).forEach((s) => {
              if (!s?.id) return
              byId.set(s.id, s)
              const key = getSquadDisplayName(s).toLowerCase()
              if (key) byName.set(key, s.id)
            })
          setSquadsById(new Map(byId))
          setSquadIdByName(new Map(byName))
        })

        // Load innings if needed
        if (!inningsMapProp) {
          const entries = await Promise.all(
            ms.map(async (m) => {
              const [a, b] = await Promise.all([
                matchService.getInnings(m.id, 'teamA'),
                matchService.getInnings(m.id, 'teamB'),
              ])
              return [m.id, { teamA: a, teamB: b }] as const
            })
          )
          const im = new Map<string, { teamA: InningsStats | null; teamB: InningsStats | null }>()
          entries.forEach(([id, v]) => im.set(id, v))
          setInningsMap(im)
        }

        return () => {
          unsubSquads()
        }
      } finally {
        setLoading(false)
      }
    }
    const cleanup = run()
    return () => { }
  }, [tournamentId, matchesProp, inningsMapProp])

  const { groups, groupBySquadId, standingsByGroup, confirmedQualifiedIds } = useMemo(() => {
    // Basic point rules
    const WIN = 2
    const TIE = 1
    const NR = 1

    const getQualificationThreshold = (tournament: any, groupId: string) => {
      const g = (tournament as any)?.groups?.find((g: any) => g.id === groupId)
      return Number(g?.qualification?.qualifyCount || (tournament as any)?.qualification?.perGroup || 0)
    }

    // Prefer config-driven engine when available
    const cfg = (tournament as any)?.config as TournamentConfig | undefined
    let standingsData: Map<string, Row[]> = new Map()
    let groupsList: any[] = []
    let squadToGroupMap: Map<string, any> = new Map()

    if (cfg?.version === 1) {
      const v = validateTournamentConfig(cfg)
      if (v.ok) {
        const meta = ((tournament as any)?.participantSquadMeta || {}) as Record<string, { name?: string }>
        const matchNameById = new Map<string, string>()
        matches.forEach((m: any) => {
          const aId = String(resolveSquadId(m, 'A') || '').trim()
          const bId = String(resolveSquadId(m, 'B') || '').trim()
          if (aId && m.teamAName) matchNameById.set(aId, String(m.teamAName).trim())
          if (bId && m.teamBName) matchNameById.set(bId, String(m.teamBName).trim())
        })

        const normalizeSquadRef = (ref: any): string => {
          const raw = String(ref || '').trim()
          if (!raw) return ''
          if (squadsById.has(raw)) return raw
          const byName = squadIdByName.get(raw.toLowerCase())
          if (byName) return byName
          return raw
        }

        const groupIdByTeam = new Map<string, string>()
        cfg.groups.forEach((g) => (g.squadIds || []).forEach((sid) => groupIdByTeam.set(sid, g.id)))

        const results: MatchResult[] = []
        matches.forEach((m: any) => {
          const inn = inningsMap.get(m.id)
          if (!inn?.teamA || !inn?.teamB) return
          const aId = normalizeSquadRef(resolveSquadId(m, 'A'))
          const bId = normalizeSquadRef(resolveSquadId(m, 'B'))
          if (!aId || !bId) return
          const aRuns = Number(inn.teamA.totalRuns || 0)
          const bRuns = Number(inn.teamB.totalRuns || 0)
          const aBalls = Number(inn.teamA.legalBalls || 0)
          const bBalls = Number(inn.teamB.legalBalls || 0)
          const groupA = groupIdByTeam.get(aId) || ''
          const groupB = groupIdByTeam.get(bId) || ''
          results.push({
            matchId: m.id,
            tournamentId: String(tournamentId || ''),
            teamA: aId,
            teamB: bId,
            groupA,
            groupB,
            result: aRuns > bRuns ? 'win' : aRuns < bRuns ? 'loss' : 'tie',
            teamARunsFor: aRuns,
            teamABallsFaced: aBalls,
            teamARunsAgainst: bRuns,
            teamABallsBowled: bBalls,
          })
        })

        const standings = computeGroupStandings(cfg, results)
        groupsList = cfg.groups.map((g) => ({ id: g.id, name: g.name, squadIds: g.squadIds }))
        cfg.groups.forEach((g) => {
          ; (g.squadIds || []).forEach((sid) => squadToGroupMap.set(sid, { id: g.id, name: g.name }))
        })

        const displayNameForId = (id: string) =>
          getSquadDisplayName(squadsById.get(id)) ||
          String(meta?.[id]?.name || '').trim() ||
          String(matchNameById.get(id) || '').trim() ||
          id

        standings.forEach((gs) => {
          const groupName = cfg.groups.find((g) => g.id === gs.groupId)?.name || gs.groupId
          const rows: Row[] = gs.rows.map((r) => ({
            squadId: r.squadId,
            squadName: displayNameForId(r.squadId),
            groupId: gs.groupId,
            groupName,
            played: r.played,
            won: r.won,
            lost: r.lost,
            tied: r.tied,
            noResult: r.noResult,
            points: r.points,
            runsFor: r.runsFor,
            ballsFaced: r.ballsFaced,
            runsAgainst: r.runsAgainst,
            ballsBowled: r.ballsBowled,
            nrr: r.nrr,
          }))
          standingsData.set(gs.groupId, rows)
        })
      }
    } else {
      // Legacy manual calculation
      const meta = ((tournament as any)?.participantSquadMeta || {}) as Record<string, { name?: string }>
      const matchNameById = new Map<string, string>()
      matches.forEach((m: any) => {
        if (m.teamAId) {
          const nm = String(m.teamAName || '').trim()
          if (nm) matchNameById.set(m.teamAId, nm)
        }
        if (m.teamBId) {
          const nm = String(m.teamBName || '').trim()
          if (nm) matchNameById.set(m.teamBId, nm)
        }
      })

      const displayNameForId = (id: string) =>
        getSquadDisplayName(squadsById.get(id)) ||
        String(meta?.[id]?.name || '').trim() ||
        String(matchNameById.get(id) || '').trim() ||
        id || 'Squad'

      const normalizeSquadRef = (ref: any): string => {
        const raw = String(ref || '').trim()
        if (!raw) return ''
        if (squadsById.has(raw)) return raw
        const byName = squadIdByName.get(raw.toLowerCase())
        if (byName) return byName
        return raw
      }

      let rawGroups = ((tournament as any)?.groups || []) as any
      if (!rawGroups.length) {
        const pIds = new Set<string>()
        // From explicit list
        if (Array.isArray((tournament as any)?.participantSquadIds)) {
          (tournament as any).participantSquadIds.forEach((id: any) => pIds.add(String(id)))
        }
        // From matches (Critical fallback)
        matches.forEach((m: any) => {
          const aId = resolveSquadId(m, 'A'); if (aId) pIds.add(String(aId))
          const bId = resolveSquadId(m, 'B'); if (bId) pIds.add(String(bId))
        })

        const uniqueIds = Array.from(pIds).filter(Boolean)
        if (uniqueIds.length > 0) {
          rawGroups = [{ id: 'all', name: 'Standings', squadIds: uniqueIds }]
        }
      }

      const effectiveGroups = rawGroups.map((g: any) => ({
        ...g,
        squadIds: (g.squadIds || []).map((sid: any) => normalizeSquadRef(sid)).filter(Boolean),
      }))

      groupsList = effectiveGroups
      effectiveGroups.forEach((g) => {
        ; (g.squadIds || []).forEach((sid) => squadToGroupMap.set(sid, { id: g.id, name: g.name }))
      })

      const initRow = (sid: string): Row => {
        const group = squadToGroupMap.get(sid) || { id: 'group-1', name: 'Group A' }
        return {
          squadId: sid,
          squadName: displayNameForId(sid),
          groupId: group.id,
          groupName: group.name,
          played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0,
          runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0, nrr: 0,
        }
      }

      const rows = new Map<string, Row>()
      effectiveGroups.forEach((g) => (g.squadIds || []).forEach((sid) => rows.set(sid, initRow(sid))))

      matches.forEach((m) => {
        const inn = inningsMap.get(m.id)
        if (!inn?.teamA || !inn?.teamB) return
        const aId = normalizeSquadRef(resolveSquadId(m as any, 'A'))
        const bId = normalizeSquadRef(resolveSquadId(m as any, 'B'))
        if (!aId || !bId) return
        if (!rows.has(aId)) rows.set(aId, initRow(aId))
        if (!rows.has(bId)) rows.set(bId, initRow(bId))
        const rA = rows.get(aId)!, rB = rows.get(bId)!
        rA.played += 1; rB.played += 1
        rA.runsFor += inn.teamA.totalRuns; rA.ballsFaced += inn.teamA.legalBalls
        rA.runsAgainst += inn.teamB.totalRuns; rA.ballsBowled += inn.teamB.legalBalls
        rB.runsFor += inn.teamB.totalRuns; rB.ballsFaced += inn.teamB.legalBalls
        rB.runsAgainst += inn.teamA.totalRuns; rB.ballsBowled += inn.teamA.legalBalls
        if (inn.teamA.totalRuns > inn.teamB.totalRuns) { rA.won += 1; rA.points += WIN; rB.lost += 1 }
        else if (inn.teamB.totalRuns > inn.teamA.totalRuns) { rB.won += 1; rB.points += WIN; rA.lost += 1 }
        else { rA.tied += 1; rA.points += TIE; rB.tied += 1; rB.points += TIE }
      })

      rows.forEach((r) => {
        const rf = ballsToOversDecimal(r.ballsFaced) > 0 ? r.runsFor / ballsToOversDecimal(r.ballsFaced) : 0
        const ra = ballsToOversDecimal(r.ballsBowled) > 0 ? r.runsAgainst / ballsToOversDecimal(r.ballsBowled) : 0
        r.nrr = Number((rf - ra).toFixed(3))
      })

      const sortRows = (a: Row, b: Row) => (b.points - a.points) || (b.nrr - a.nrr) || a.squadName.localeCompare(b.squadName)
      groupsList.forEach((g) => standingsData.set(g.id, g.squadIds.map((sid: string) => rows.get(sid) || initRow(sid)).sort(sortRows)))
    }

    // --- Confirmation Logic (Manual + Heuristic) ---
    const confirmedQualifiedIds = new Set<string>()

    // 1. Priority: Manual Admin Confirmations
    const manualConfirmed = (tournament as any)?.confirmedQualifiers || {}
    Object.values(manualConfirmed).forEach((sIds: any) => {
      if (Array.isArray(sIds)) {
        sIds.forEach(id => confirmedQualifiedIds.add(id))
      }
    })

    // 2. Fallback: Mathematical Heuristic (Safe slots)
    // Only apply if no manual confirmations exist for that group yet? 
    // Or just combine them. User wants "Q" when confirmed.
    standingsData.forEach((rows, groupId) => {
      const qCount = getQualificationThreshold(tournament, groupId)
      if (qCount <= 0 || rows.length === 0) return

      // If this group already has manual confirmations, maybe don't auto-add heuristic to avoid confusion
      // but the user wants "Q" for what is confirmed.
      // Let's stick to what's in the confirmedQualifiers map mainly.
    })

    // 3. Filter groups by filterSquadIds if provided
    let finalGroups = groupsList
    if (filterSquadIds?.length) {
      const filterSet = new Set(filterSquadIds)
      finalGroups = groupsList.filter(g =>
        (g.squadIds || []).some((sid: string) => filterSet.has(sid))
      )
    }

    return {
      groups: finalGroups,
      groupBySquadId: squadToGroupMap,
      standingsByGroup: standingsData,
      confirmedQualifiedIds: Array.from(confirmedQualifiedIds),
    }
  }, [inningsMap, matches, squadIdByName, squadsById, tournament, filterSquadIds])

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)

  useEffect(() => {
    if (groups.length > 0) {
      // If none of our groups match the current activeGroupId, reset to the first one
      if (!activeGroupId || !groups.find(g => g.id === activeGroupId)) {
        setActiveGroupId(groups[0].id)
      }
    }
  }, [groups, activeGroupId])

  if (!tournamentId) return null

  if (loading) {
    return (
      <div className={embedded ? 'py-4' : 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10'}>
        <div className="h-8 w-56 bg-slate-200 rounded animate-pulse mb-4" />
        <div className="h-4 w-80 bg-slate-200 rounded animate-pulse mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0]

  return (
    <div className={embedded ? 'space-y-6' : 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6'}>
      {!embedded && (
        <div className="flex flex-col gap-2">
          <Link to="/tournaments" className="text-xs font-black text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-widest">
            ← Back to Tournaments
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">
            {tournament?.name || 'Points Table'}
          </h1>
          {tournament?.year && <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-2">{tournament.year} Season</p>}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
          No standings information available
        </div>
      ) : (
        <div className="space-y-8">
          {/* Group Selector Tabs */}
          {groups.length > 1 && (
            <div className="p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl flex gap-1 w-fit max-w-full overflow-x-auto no-scrollbar mx-auto sm:mx-0 border border-slate-200 dark:border-white/5">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroupId(g.id)}
                  className={`px-6 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${activeGroupId === g.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-md ring-1 ring-slate-200 dark:ring-white/10'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}

          {activeGroup && (() => {
            let rows = standingsByGroup.get(activeGroup.id) || []
            if (filterSquadIds?.length) {
              const filterSet = new Set(filterSquadIds)
              rows = rows.filter((r: Row) => filterSet.has(r.squadId))
            }
            if (rows.length === 0) return null

            const qCount = Number(
              (activeGroup as any)?.qualification?.qualifyCount ||
              (tournament as any)?.qualification?.perGroup ||
              (tournament as any)?.config?.qualification?.perGroup ||
              0
            )

            return (
              <div key={activeGroup.id} className="bg-white dark:bg-slate-950 rounded-[2rem] border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                {!embedded && (
                  <div className="px-6 py-5 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <div className="font-black text-slate-900 dark:text-white uppercase tracking-tight">{activeGroup.name}</div>
                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Live Standings</div>
                  </div>
                )}
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-white/5">
                        <th className="text-left py-4 px-6">Team</th>
                        <th className="text-center py-4 px-2">P</th>
                        <th className="text-center py-4 px-2">W</th>
                        <th className="text-center py-4 px-2">L</th>
                        <th className="text-center py-4 px-2">NR</th>
                        <th className="text-center py-4 px-4">NRR</th>
                        <th className="text-center py-4 px-4">Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {rows.map((r: any, idx: number) => {
                        const isConfirmed = confirmedQualifiedIds.includes(r.squadId)
                        const isInQualZone = idx < qCount
                        const squad = squadsById.get(r.squadId)
                        return (
                          <tr
                            key={r.squadId}
                            className={`transition-colors duration-300 ${isInQualZone ? 'bg-amber-50/30 dark:bg-amber-500/5 shadow-inner' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                          >
                            <td className="py-4 px-6 min-w-[180px]">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  {isConfirmed && (
                                    <div className="absolute -top-1.5 -left-1.5 bg-amber-500 text-white text-[8px] font-black w-4 h-4 rounded shadow-sm flex items-center justify-center z-10 animate-in zoom-in" title="Qualified">Q</div>
                                  )}
                                  <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden p-1">
                                    {squad?.logoUrl ? (
                                      <img src={squad.logoUrl} alt="" className="w-full h-full object-contain" />
                                    ) : (
                                      <span className="text-[10px] font-black text-slate-300">{r.squadName?.substring(0, 1)}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="font-black text-slate-900 dark:text-white uppercase tracking-tight line-clamp-1">{r.squadName}</div>
                              </div>
                            </td>
                            <td className="py-4 px-2 text-center tabular-nums text-slate-600 dark:text-slate-400 font-bold">{r.played}</td>
                            <td className="py-4 px-2 text-center tabular-nums text-slate-600 dark:text-slate-400 font-bold">{r.won}</td>
                            <td className="py-4 px-2 text-center tabular-nums text-slate-600 dark:text-slate-400 font-bold">{r.lost}</td>
                            <td className="py-4 px-2 text-center tabular-nums text-slate-600 dark:text-slate-400 font-bold">{r.noResult || 0}</td>
                            <td className="py-4 px-4 text-center tabular-nums font-bold text-slate-400 dark:text-slate-500">{(r.nrr >= 0 ? '+' : '') + r.nrr.toFixed(3)}</td>
                            <td className="py-4 px-4 text-center tabular-nums text-sm font-black text-amber-600 dark:text-amber-500">{r.points}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}


