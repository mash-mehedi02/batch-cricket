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
  { embedded = false, tournamentId: tournamentIdProp }: { embedded?: boolean; tournamentId?: string } = {}
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
          ;(allSquads as any[]).forEach((s) => {
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
        ;(((t as any)?.participantSquadIds || []) as any[]).forEach((sid) => referenced.push(String(sid || '').trim()))
        ;(((t as any)?.groups || []) as any[]).forEach((g: any) => {
          ;(g?.squadIds || []).forEach((sid: any) => referenced.push(String(sid || '').trim()))
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
    run().then((c: any) => { cleanup = typeof c === 'function' ? c : undefined }).catch(() => {})
    return () => cleanup?.()
  }, [tournamentId])

  const { groups, groupBySquadId, standingsByGroup, qualifiedIds } = useMemo(() => {
    // Prefer config-driven engine when available
    const cfg = (tournament as any)?.config as TournamentConfig | undefined
    if (cfg?.version === 1) {
      const v = validateTournamentConfig(cfg)
      if (!v.ok) {
        return { groups: [], groupBySquadId: new Map(), standingsByGroup: new Map(), qualifiedIds: [] }
      }

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

      // Compute standings + qualification
      const standings = computeGroupStandings(cfg, results)
      const qual = computeQualification(cfg, standings)
      const qualifiedSet = new Set(qual.allSlots.map((s) => s.squadId))

      // Build display rows
      const standingsByGroup = new Map<string, Row[]>()
      const groupBySquadId = new Map<string, { id: string; name: string }>()

      cfg.groups.forEach((g) => {
        ;(g.squadIds || []).forEach((sid) => groupBySquadId.set(sid, { id: g.id, name: g.name }))
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
        standingsByGroup.set(gs.groupId, rows)
      })

      return {
        groups: cfg.groups.map((g) => ({ id: g.id, name: g.name, squadIds: g.squadIds })),
        groupBySquadId,
        standingsByGroup,
        qualifiedIds: Array.from(qualifiedSet.values()),
      }
    }

    const meta = ((tournament as any)?.participantSquadMeta || {}) as Record<string, { name?: string }>

    // Fallback names from match documents (useful when squads collection is legacy/incomplete)
    const matchNameById = new Map<string, string>()
    matches.forEach((m: any) => {
      const aId = String(resolveSquadId(m, 'A') || '').trim()
      const bId = String(resolveSquadId(m, 'B') || '').trim()
      if (aId) {
        const nm = String(m.teamAName || '').trim()
        if (nm) matchNameById.set(aId, nm)
      }
      if (bId) {
        const nm = String(m.teamBName || '').trim()
        if (nm) matchNameById.set(bId, nm)
      }
    })

    const displayNameForId = (id: string) => {
      const fromSquads = getSquadDisplayName(squadsById.get(id))
      if (fromSquads) return fromSquads
      const fromMeta = String(meta?.[id]?.name || '').trim()
      if (fromMeta) return fromMeta
      const fromMatch = String(matchNameById.get(id) || '').trim()
      if (fromMatch) return fromMatch
      return id || 'Squad'
    }

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

    // Fallback: if no groups configured, create a single group with all participants.
    const fallbackGroups: GroupConfig[] = participantIds.length
      ? [{ id: 'group-1', name: 'Group A', squadIds: participantIds }]
      : []
    const effectiveGroups = (groups.length ? groups : fallbackGroups).map((g: any) => ({
      ...g,
      squadIds: (g.squadIds || []).map((sid: any) => normalizeSquadRef(sid)).filter(Boolean),
    }))

    const groupBySquadId = new Map<string, { id: string; name: string }>()
    effectiveGroups.forEach((g) => {
      ;(g.squadIds || []).forEach((sid) => groupBySquadId.set(sid, { id: g.id, name: g.name }))
    })

    const initRow = (sid: string): Row => {
      const group = groupBySquadId.get(sid) || { id: 'group-1', name: 'Group A' }
      const squadName = displayNameForId(sid)
      return {
        squadId: sid,
        squadName,
        groupId: group.id,
        groupName: group.name,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        noResult: 0,
        points: 0,
        runsFor: 0,
        ballsFaced: 0,
        runsAgainst: 0,
        ballsBowled: 0,
        nrr: 0,
      }
    }

    const rows = new Map<string, Row>()
    effectiveGroups.forEach((g) => (g.squadIds || []).forEach((sid) => rows.set(sid, initRow(sid))))

    const addMatchTo = (sid: string, patch: Partial<Row>) => {
      if (!rows.has(sid)) rows.set(sid, initRow(sid))
      const r = rows.get(sid)!
      Object.assign(r, {
        played: r.played + (patch.played || 0),
        won: r.won + (patch.won || 0),
        lost: r.lost + (patch.lost || 0),
        tied: r.tied + (patch.tied || 0),
        noResult: r.noResult + (patch.noResult || 0),
        points: r.points + (patch.points || 0),
        runsFor: r.runsFor + (patch.runsFor || 0),
        ballsFaced: r.ballsFaced + (patch.ballsFaced || 0),
        runsAgainst: r.runsAgainst + (patch.runsAgainst || 0),
        ballsBowled: r.ballsBowled + (patch.ballsBowled || 0),
      })
    }

    // Basic points rules
    const WIN = 2
    const TIE = 1
    const NR = 1

    matches.forEach((m) => {
      const innings = inningsMap.get(m.id)
      if (!innings?.teamA || !innings?.teamB) return

      const aId = normalizeSquadRef(resolveSquadId(m as any, 'A'))
      const bId = normalizeSquadRef(resolveSquadId(m as any, 'B'))
      if (!aId || !bId) return

      const aRuns = innings.teamA.totalRuns || 0
      const bRuns = innings.teamB.totalRuns || 0
      const aBalls = innings.teamA.legalBalls || 0
      const bBalls = innings.teamB.legalBalls || 0

      // Update NRR aggregates
      addMatchTo(aId, { played: 1, runsFor: aRuns, ballsFaced: aBalls, runsAgainst: bRuns, ballsBowled: bBalls })
      addMatchTo(bId, { played: 1, runsFor: bRuns, ballsFaced: bBalls, runsAgainst: aRuns, ballsBowled: aBalls })

      // Determine result (simple: compare totals)
      if (aRuns > bRuns) {
        addMatchTo(aId, { won: 1, points: WIN })
        addMatchTo(bId, { lost: 1 })
      } else if (bRuns > aRuns) {
        addMatchTo(bId, { won: 1, points: WIN })
        addMatchTo(aId, { lost: 1 })
      } else {
        addMatchTo(aId, { tied: 1, points: TIE })
        addMatchTo(bId, { tied: 1, points: TIE })
      }
    })

    // Compute NRR
    rows.forEach((r) => {
      const rf = ballsToOversDecimal(r.ballsFaced) > 0 ? r.runsFor / ballsToOversDecimal(r.ballsFaced) : 0
      const ra = ballsToOversDecimal(r.ballsBowled) > 0 ? r.runsAgainst / ballsToOversDecimal(r.ballsBowled) : 0
      r.nrr = Number((rf - ra).toFixed(3))
    })

    const sortRows = (a: Row, b: Row) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.nrr !== a.nrr) return b.nrr - a.nrr
      return a.squadName.localeCompare(b.squadName)
    }

    const standingsByGroup = new Map<string, Row[]>()
    effectiveGroups.forEach((g) => {
      const groupRows = (g.squadIds || []).map((sid) => rows.get(sid) || initRow(sid)).sort(sortRows)
      standingsByGroup.set(g.id, groupRows)
    })

    // Qualification
    const perGroup = Number((tournament as any)?.qualification?.perGroup ?? 0)
    const wildcards = Number((tournament as any)?.qualification?.wildcards ?? 0)
    const qualified = new Set<string>()
    effectiveGroups.forEach((g) => {
      const top = (standingsByGroup.get(g.id) || []).slice(0, Math.max(0, perGroup))
      top.forEach((r) => qualified.add(r.squadId))
    })
    if (wildcards > 0) {
      const overall = Array.from(rows.values()).filter((r) => !qualified.has(r.squadId)).sort(sortRows)
      overall.slice(0, wildcards).forEach((r) => qualified.add(r.squadId))
    }

    return {
      groups: effectiveGroups,
      groupBySquadId,
      standingsByGroup,
      qualifiedIds: Array.from(qualified.values()),
    }
  }, [inningsMap, matches, squadIdByName, squadsById, tournament])

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

  return (
    <div className={embedded ? 'space-y-6' : 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6'}>
      {!embedded ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link to="/tournaments" className="text-sm font-semibold text-teal-700 hover:underline">
              ← Back to Tournaments
            </Link>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">Points Table</h1>
            <p className="text-slate-600 mt-1">
              <span className="font-semibold">{tournament?.name || 'Tournament'}</span>
              {tournament?.year ? <> • {tournament.year}</> : null}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
            <div className="text-xs font-bold text-slate-500">QUALIFIED (auto)</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {qualifiedIds.length
                ? qualifiedIds
                    .map((id) => {
                      const meta = ((tournament as any)?.participantSquadMeta || {}) as Record<string, { name?: string }>
                      return (
                        getSquadDisplayName(squadsById.get(id)) ||
                        String(meta?.[id]?.name || '').trim() ||
                        String((matches.find((m: any) => String(resolveSquadId(m, 'A') || '').trim() === id)?.teamAName) || '').trim() ||
                        String((matches.find((m: any) => String(resolveSquadId(m, 'B') || '').trim() === id)?.teamBName) || '').trim() ||
                        id ||
                        'Squad'
                      )
                    })
                    .join(', ')
                : '—'}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
          <div className="text-xs font-bold text-slate-500">QUALIFIED (auto)</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {qualifiedIds.length
              ? qualifiedIds
                  .map((id) => {
                    const meta = ((tournament as any)?.participantSquadMeta || {}) as Record<string, { name?: string }>
                    return (
                      getSquadDisplayName(squadsById.get(id)) ||
                      String(meta?.[id]?.name || '').trim() ||
                      String((matches.find((m: any) => String(resolveSquadId(m, 'A') || '').trim() === id)?.teamAName) || '').trim() ||
                      String((matches.find((m: any) => String(resolveSquadId(m, 'B') || '').trim() === id)?.teamBName) || '').trim() ||
                      id ||
                      'Squad'
                    )
                  })
                  .join(', ')
              : '—'}
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center text-slate-600">
          No groups configured yet. Admin can select squads + groups from the tournament edit page.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            const rows = standingsByGroup.get(g.id) || []
            return (
              <div key={g.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="font-extrabold text-slate-900">{g.name}</div>
                  <div className="text-xs font-bold text-slate-500">Sorted by Points, then NRR</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">
                        <th className="text-left py-3 px-4">Team</th>
                        <th className="text-right py-3 px-3">P</th>
                        <th className="text-right py-3 px-3">W</th>
                        <th className="text-right py-3 px-3">L</th>
                        <th className="text-right py-3 px-3">T</th>
                        <th className="text-right py-3 px-3">Pts</th>
                        <th className="text-right py-3 px-3">NRR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((r, idx) => {
                        const isQualified = qualifiedIds.includes(r.squadId)
                        return (
                          <tr key={r.squadId} className={isQualified ? 'bg-emerald-50/60' : ''}>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-extrabold text-slate-500 w-6">{idx + 1}</div>
                                <div className="font-semibold text-slate-900">{r.squadName}</div>
                                {isQualified ? (
                                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                    Q
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-semibold text-slate-900">{r.played}</td>
                            <td className="py-3 px-3 text-right text-slate-700">{r.won}</td>
                            <td className="py-3 px-3 text-right text-slate-700">{r.lost}</td>
                            <td className="py-3 px-3 text-right text-slate-700">{r.tied}</td>
                            <td className="py-3 px-3 text-right font-extrabold text-slate-900">{r.points}</td>
                            <td className="py-3 px-3 text-right text-slate-700">{r.nrr.toFixed(3)}</td>
                          </tr>
                        )
                      })}
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            No squads assigned to this group.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


