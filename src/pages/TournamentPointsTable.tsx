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
import { computeGroupStandings, computeQualification, validateTournamentConfig } from '@/engine/tournament'

type GroupConfig = { id: string; name: string; squadIds: string[] }

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

export default function TournamentPointsTable(
  { embedded = false, tournamentId: tournamentIdProp, filterSquadIds, hideQualification = false }: { embedded?: boolean; tournamentId?: string; filterSquadIds?: string[]; hideQualification?: boolean } = {}
) {
  const params = useParams<{ tournamentId: string }>()
  const tournamentId = tournamentIdProp || params.tournamentId
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [inningsMap, setInningsMap] = useState<Map<string, { teamA: InningsStats | null; teamB: InningsStats | null }>>(new Map())
  const [squadsById, setSquadsById] = useState<Map<string, any>>(new Map())
  const [squadIdByName, setSquadIdByName] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      if (!tournamentId) return
      setLoading(true)
      try {
        const t = await tournamentService.getById(tournamentId)
        setTournament(t)

        const ms = await matchService.getByTournament(tournamentId)
        setMatches(ms)

        // Realtime squads: so renames reflect immediately
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

        // Collect referenced squads from tournament config + matches
        const referenced: string[] = []
          ; (((t as any)?.participantSquadIds || []) as any[]).forEach((sid) => referenced.push(String(sid || '').trim()))
          ; (((t as any)?.groups || []) as any[]).forEach((g: any) => {
            ; (g?.squadIds || []).forEach((sid: any) => referenced.push(String(sid || '').trim()))
          })
        ms.forEach((m) => {
          referenced.push(String(resolveSquadId(m as any, 'A') || '').trim())
          referenced.push(String(resolveSquadId(m as any, 'B') || '').trim())
        })

        // Try to resolve name references to IDs first
        const referencedResolved = referenced
          .filter(Boolean)
          .map((x) => (byId.has(x) ? x : (byName.get(x.toLowerCase()) || x)))

        const uniqueMissing = Array.from(new Set(referencedResolved)).filter((id) => id && !byId.has(id))
        if (uniqueMissing.length > 0) {
          const fetched = await Promise.all(uniqueMissing.map((id) => squadService.getById(id).catch(() => null)))
          fetched.filter(Boolean).forEach((s: any) => {
            if (!s?.id) return
            byId.set(s.id, s)
            const key = getSquadDisplayName(s).toLowerCase()
            if (key) byName.set(key, s.id)
          })
        }
        // Push initial (includes any missing fetched byId)
        setSquadsById(new Map(byId))
        setSquadIdByName(new Map(byName))

        // Load innings for each match (needed to determine results + NRR)
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

        return () => {
          unsubSquads()
        }
      } finally {
        setLoading(false)
      }
    }
    let cleanup: undefined | (() => void)
    run().then((c: any) => { cleanup = typeof c === 'function' ? c : undefined }).catch(() => { })
    return () => cleanup?.()
  }, [tournamentId])

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

      const groups: GroupConfig[] = ((tournament as any)?.groups || []) as any
      const participantIds: string[] = (((tournament as any)?.participantSquadIds || []) as any)
        .map((x: any) => normalizeSquadRef(x))
        .filter(Boolean)

      const fallbackGroups: GroupConfig[] = participantIds.length
        ? [{ id: 'group-1', name: 'Group A', squadIds: participantIds }]
        : []
      const effectiveGroups = (groups.length ? groups : fallbackGroups).map((g: any) => ({
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

    return {
      groups: groupsList,
      groupBySquadId: squadToGroupMap,
      standingsByGroup: standingsData,
      confirmedQualifiedIds: Array.from(confirmedQualifiedIds),
    }
  }, [inningsMap, matches, squadIdByName, squadsById, tournament])

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)

  useEffect(() => {
    if (groups.length > 0 && !activeGroupId) {
      setActiveGroupId(groups[0].id)
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
          <Link to="/tournaments" className="text-xs font-medium text-teal-600 hover:text-teal-700 uppercase tracking-widest">
            ← Back to Tournaments
          </Link>
          <h1 className="text-2xl sm:text-3xl font-medium text-slate-900 tracking-tight">{tournament?.name || 'Points Table'}</h1>
          {tournament?.year && <p className="text-xs font-medium text-slate-400 uppercase tracking-widest leading-none mt-1">{tournament.year} Season</p>}
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-12 text-center text-slate-400 font-medium uppercase tracking-widest text-xs">
          No standings information available for this tournament.
        </div>
      ) : (
        <div className="space-y-8">
          {/* Group Selector Tabs */}
          {groups.length > 1 && (
            <div className="p-1 bg-slate-200/40 backdrop-blur rounded-[1.25rem] flex gap-1 w-fit mx-auto sm:mx-0">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroupId(g.id)}
                  className={`px-6 py-2.5 rounded-2xl text-[10px] sm:text-xs font-medium uppercase tracking-widest transition-all duration-300 ${activeGroupId === g.id
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-100Scale-[1.02]'
                    : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          )}

          {activeGroup && (
            <div key={activeGroup.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Standings Table Rendering moved here */}
              {(() => {
                let rows = standingsByGroup.get(activeGroup.id) || []
                if (filterSquadIds?.length) {
                  const filterSet = new Set(filterSquadIds)
                  rows = rows.filter((r: Row) => filterSet.has(r.squadId))
                  if (rows.length === 0) return null
                }
                const qCount = Number(
                  activeGroup.qualification?.qualifyCount ||
                  tournament?.qualification?.perGroup ||
                  (tournament as any)?.config?.qualification?.perGroup ||
                  0
                )

                return (
                  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-50 flex items-center justify-between">
                      <div className="font-medium text-slate-900 tracking-tight">{activeGroup.name}</div>
                      <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Sorted by Points & NRR</div>
                    </div>
                    <div className="overflow-x-auto no-scrollbar">
                      <table className="w-full">
                        <thead>
                          <tr className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400 border-b border-slate-50">
                            <th className="text-left py-4 px-6">Team</th>
                            <th className="text-center py-4 px-3">P</th>
                            <th className="text-center py-4 px-2">W</th>
                            <th className="text-center py-4 px-2">L</th>
                            <th className="text-center py-4 px-2">T</th>
                            <th className="text-center py-4 px-3">Pts</th>
                            <th className="text-right py-4 px-6">NRR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {rows.map((r: any, idx: number) => {
                            const isConfirmed = confirmedQualifiedIds.includes(r.squadId)
                            const isInQualZone = idx < qCount
                            return (
                              <tr
                                key={r.squadId}
                                className={`transition-colors duration-300 ${isInQualZone ? 'bg-emerald-100/40' : 'hover:bg-slate-50/50'}`}
                              >
                                <td className="py-4 px-6 min-w-[160px]">
                                  <div className="flex items-center gap-3">
                                    <div className={`text-[10px] font-medium w-5 transition-colors ${isInQualZone ? 'text-emerald-600' : 'text-slate-300'}`}>{idx + 1}</div>
                                    <div className="font-medium text-slate-900 text-sm tracking-tight">{r.squadName}</div>
                                    {isConfirmed && (
                                      <div className="bg-emerald-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm" title="Confirmed Qualified">
                                        Q
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-4 px-3 text-center tabular-nums text-sm text-slate-600 font-medium">{r.played}</td>
                                <td className="py-4 px-2 text-center tabular-nums text-sm text-slate-600">{r.won}</td>
                                <td className="py-4 px-2 text-center tabular-nums text-sm text-slate-600">{r.lost}</td>
                                <td className="py-4 px-2 text-center tabular-nums text-sm text-slate-600">{r.tied}</td>
                                <td className="py-4 px-3 text-center tabular-nums text-[15px] font-medium text-slate-900">{r.points}</td>
                                <td className="py-4 px-6 text-right tabular-nums text-xs font-medium text-slate-400">{(r.nrr >= 0 ? '+' : '') + r.nrr.toFixed(3)}</td>
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
      )}
    </div>
  )
}


