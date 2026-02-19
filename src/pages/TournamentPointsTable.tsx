import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { matchService } from '@/services/firestore/matches'
import { squadService } from '@/services/firestore/squads'
import type { Match, Tournament, InningsStats } from '@/types'
import type { MatchResult } from '@/engine/tournament'
import { computeGroupStandings, validateTournamentConfig } from '@/engine/tournament'
import { formatShortTeamName } from '@/utils/teamName'

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

export default function TournamentPointsTable({
  embedded = false,
  tournamentId: tournamentIdProp,
  matches: matchesProp,
  inningsMap: inningsMapProp,
  highlightMatch,
  filterSquadIds,
  hideQualification = false,
  forcedDark
}: {
  embedded?: boolean
  tournamentId?: string
  matches?: Match[]
  inningsMap?: Map<string, { teamA: InningsStats | null; teamB: InningsStats | null; aso?: InningsStats | null; bso?: InningsStats | null }>
  highlightMatch?: Match
  filterSquadIds?: string[]
  hideQualification?: boolean
  forcedDark?: boolean
} = {}) {
  const params = useParams<{ tournamentId: string }>()
  const tournamentId = tournamentIdProp || params.tournamentId
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [inningsMap, setInningsMap] = useState<Map<string, { teamA: InningsStats | null; teamB: InningsStats | null; aso?: InningsStats | null; bso?: InningsStats | null }>>(new Map())
  const [squadsById, setSquadsById] = useState<Map<string, any>>(new Map())
  const [squadIdByName, setSquadIdByName] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [showTeamForm, setShowTeamForm] = useState(false)

  // Sync props
  useEffect(() => {
    if (matchesProp) setMatches(matchesProp)
    if (inningsMapProp) setInningsMap(inningsMapProp)
  }, [matchesProp, inningsMapProp])

  useEffect(() => {
    if (highlightMatch?.groupId) {
      setActiveGroupId(highlightMatch.groupId)
    }
  }, [highlightMatch])

  useEffect(() => {
    const run = async () => {
      if (!tournamentId) return
      if (!matchesProp && !inningsMapProp) setLoading(true)

      try {
        const t = await tournamentService.getById(tournamentId)
        setTournament(t)

        const ms = matchesProp || await matchService.getByTournament(tournamentId)
        if (!matchesProp) setMatches(ms)

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

        if (!inningsMapProp) {
          const entries = await Promise.all(
            ms.map(async (m) => {
              const [a, b, aso, bso] = await Promise.all([
                matchService.getInnings(m.id, 'teamA').catch(() => null),
                matchService.getInnings(m.id, 'teamB').catch(() => null),
                matchService.getInnings(m.id, 'teamA_super').catch(() => null),
                matchService.getInnings(m.id, 'teamB_super').catch(() => null),
              ])
              return [m.id, { teamA: a, teamB: b, aso, bso }] as const
            })
          )
          const im = new Map<string, { teamA: InningsStats | null; teamB: InningsStats | null; aso?: InningsStats | null; bso?: InningsStats | null }>()
          entries.forEach(([id, v]) => im.set(id, v))
          setInningsMap(im)
        }

        return () => unsubSquads()
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [tournamentId, matchesProp, inningsMapProp])

  const { groups, standingsByGroup, confirmedQualifiedIds } = useMemo(() => {
    const WIN = 2
    const TIE = 1

    const cfg = (tournament as any)?.config
    let standingsData: Map<string, Row[]> = new Map()
    let groupsList: any[] = []

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
          return squadIdByName.get(raw.toLowerCase()) || raw
        }

        const groupIdByTeam = new Map<string, string>()
        cfg.groups.forEach((g: any) => (g.squadIds || []).forEach((sid: string) => groupIdByTeam.set(sid, g.id)))

        const results: MatchResult[] = []
        matches.forEach((m: any) => {
          const status = String(m.status || '').toLowerCase()
          if (status !== 'finished' && status !== 'completed') return

          const inn = inningsMap.get(m.id)
          if (!inn?.teamA || !inn?.teamB) return
          const aId = normalizeSquadRef(resolveSquadId(m, 'A'))
          const bId = normalizeSquadRef(resolveSquadId(m, 'B'))
          if (!aId || !bId) return

          const mainARuns = inn.teamA.totalRuns;
          const mainBRuns = inn.teamB.totalRuns;
          const soARuns = Number(inn.aso?.totalRuns || 0);
          const soBRuns = Number(inn.bso?.totalRuns || 0);

          let res: 'win' | 'loss' | 'tie' = 'tie';

          if (mainARuns > mainBRuns) {
            res = 'win';
          } else if (mainBRuns > mainARuns) {
            res = 'loss';
          } else {
            // Main match tied - Check super over runs
            if (soARuns > soBRuns) {
              res = 'win';
            } else if (soBRuns > soARuns) {
              res = 'loss';
            } else {
              // Super over also tied or not played, fallback to winnerId or resultSummary
              const winnerId = normalizeSquadRef(m.winnerId || (m as any).winner);
              const resultSummary = String(m.resultSummary || '').toLowerCase();
              const teamAName = String(m.teamAName || '').toLowerCase();
              const teamBName = String(m.teamBName || '').toLowerCase();

              if (winnerId === aId) res = 'win';
              else if (winnerId === bId) res = 'loss';
              else if (resultSummary.includes(teamAName) && (resultSummary.includes('won') || resultSummary.includes('win'))) res = 'win';
              else if (resultSummary.includes(teamBName) && (resultSummary.includes('won') || resultSummary.includes('win'))) res = 'loss';
              else res = 'tie';
            }
          }

          results.push({
            matchId: m.id,
            tournamentId: String(tournamentId || ''),
            teamA: aId,
            teamB: bId,
            groupA: groupIdByTeam.get(aId) || '',
            groupB: groupIdByTeam.get(bId) || '',
            result: res,
            teamARunsFor: inn.teamA.totalRuns,
            teamABallsFaced: inn.teamA.legalBalls,
            teamARunsAgainst: inn.teamB.totalRuns,
            teamABallsBowled: inn.teamB.legalBalls,
          })
        })

        const standings = computeGroupStandings(cfg, results)
        groupsList = cfg.groups.map((g: any) => ({ id: g.id, name: g.name, squadIds: g.squadIds }))

        standings.forEach((gs) => {
          const groupName = cfg.groups.find((g: any) => g.id === gs.groupId)?.name || gs.groupId
          const rows: Row[] = gs.rows.map((r: any) => ({
            ...r,
            squadName: getSquadDisplayName(squadsById.get(r.squadId)) || meta[r.squadId]?.name || matchNameById.get(r.squadId) || r.squadId,
            groupName,
          }))
          standingsData.set(gs.groupId, rows)
        })
      }
    } else {
      // Legacy fallback logic
      const meta = ((tournament as any)?.participantSquadMeta || {}) as Record<string, { name?: string }>
      const matchNameById = new Map<string, string>()
      matches.forEach((m: any) => {
        if (m.teamAId && m.teamAName) matchNameById.set(m.teamAId, m.teamAName)
        if (m.teamBId && m.teamBName) matchNameById.set(m.teamBId, m.teamBName)
      })

      const normalizeSquadRef = (ref: any): string => {
        const raw = String(ref || '').trim()
        if (!raw) return ''
        return squadsById.has(raw) ? raw : (squadIdByName.get(raw.toLowerCase()) || raw)
      }

      let rawGroups = ((tournament as any)?.groups || []) as any
      if (!rawGroups.length) {
        const pIds = new Set<string>()
        if (Array.isArray((tournament as any)?.participantSquadIds)) {
          (tournament as any).participantSquadIds.forEach((id: any) => pIds.add(String(id)))
        }
        matches.forEach((m: any) => {
          const aId = resolveSquadId(m, 'A'); if (aId) pIds.add(String(aId))
          const bId = resolveSquadId(m, 'B'); if (bId) pIds.add(String(bId))
        })
        const uniqueIds = Array.from(pIds).filter(Boolean)
        if (uniqueIds.length > 0) rawGroups = [{ id: 'all', name: 'Standings', squadIds: uniqueIds }]
      }

      groupsList = rawGroups
      const rowsMap = new Map<string, Row>()

      matches.forEach((m: any) => {
        const status = String(m.status || '').toLowerCase()
        if (status !== 'finished' && status !== 'completed' && status !== 'abandoned') return

        const inn = inningsMap.get(m.id)
        const aId = normalizeSquadRef(resolveSquadId(m, 'A'))
        const bId = normalizeSquadRef(resolveSquadId(m, 'B'))
        if (!aId || !bId) return

        if (!rowsMap.has(aId)) rowsMap.set(aId, { squadId: aId, squadName: getSquadDisplayName(squadsById.get(aId)) || meta[aId]?.name || matchNameById.get(aId) || aId, groupId: 'all', groupName: 'Standings', played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0, runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0, nrr: 0 })
        if (!rowsMap.has(bId)) rowsMap.set(bId, { squadId: bId, squadName: getSquadDisplayName(squadsById.get(bId)) || meta[bId]?.name || matchNameById.get(bId) || bId, groupId: 'all', groupName: 'Standings', played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0, runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0, nrr: 0 })

        const rA = rowsMap.get(aId)!, rB = rowsMap.get(bId)!

        if (status === 'abandoned') {
          rA.played++; rB.played++; rA.noResult++; rB.noResult++; rA.points += TIE; rB.points += TIE;
          return;
        }

        if (!inn?.teamA || !inn?.teamB) return
        rA.played++; rB.played++;
        rA.runsFor += inn.teamA.totalRuns; rA.ballsFaced += inn.teamA.legalBalls;
        rA.runsAgainst += inn.teamB.totalRuns; rA.ballsBowled += inn.teamB.legalBalls;
        rB.runsFor += inn.teamB.totalRuns; rB.ballsFaced += inn.teamB.legalBalls;
        rB.runsAgainst += inn.teamA.totalRuns; rB.ballsBowled += inn.teamA.legalBalls;

        const mainARuns = inn.teamA.totalRuns;
        const mainBRuns = inn.teamB.totalRuns;
        const soARuns = Number(inn.aso?.totalRuns || 0);
        const soBRuns = Number(inn.bso?.totalRuns || 0);

        if (mainARuns > mainBRuns) {
          rA.won++; rA.points += WIN; rB.lost++;
        } else if (mainBRuns > mainARuns) {
          rB.won++; rB.points += WIN; rA.lost++;
        } else {
          // Main match tied - Check super over
          if (soARuns > soBRuns) {
            rA.won++; rA.points += WIN; rB.lost++;
          } else if (soBRuns > soARuns) {
            rB.won++; rB.points += WIN; rA.lost++;
          } else {
            // Super over also tied or generic winnerId check
            const winnerId = normalizeSquadRef(m.winnerId || (m as any).winner);
            const resultSummary = String(m.resultSummary || '').toLowerCase();
            const teamAName = String(m.teamAName || '').toLowerCase();
            const teamBName = String(m.teamBName || '').toLowerCase();

            if (winnerId === aId) { rA.won++; rA.points += WIN; rB.lost++; }
            else if (winnerId === bId) { rB.won++; rB.points += WIN; rA.lost++; }
            else if (resultSummary.includes(teamAName) && (resultSummary.includes('won') || resultSummary.includes('win'))) { rA.won++; rA.points += WIN; rB.lost++; }
            else if (resultSummary.includes(teamBName) && (resultSummary.includes('won') || resultSummary.includes('win'))) { rB.won++; rB.points += WIN; rA.lost++; }
            else { rA.tied++; rB.tied++; rA.points += TIE; rB.points += TIE; }
          }
        }
      })

      rowsMap.forEach(r => {
        const rf = ballsToOversDecimal(r.ballsFaced) > 0 ? r.runsFor / ballsToOversDecimal(r.ballsFaced) : 0
        const ra = ballsToOversDecimal(r.ballsBowled) > 0 ? r.runsAgainst / ballsToOversDecimal(r.ballsBowled) : 0
        r.nrr = Number((rf - ra).toFixed(3))
      })

      const sortFn = (a: Row, b: Row) => (b.points - a.points) || (b.nrr - a.nrr)
      groupsList.forEach(g => {
        let groupRows = (g.squadIds || []).map((sid: string) => rowsMap.get(sid)).filter(Boolean).sort(sortFn)

        // Apply filter if specified
        if (filterSquadIds && filterSquadIds.length > 0) {
          groupRows = groupRows.filter((r: Row) => filterSquadIds.includes(r.squadId))
        }

        standingsData.set(g.id, groupRows.map((r: any) => ({ ...r })))
      })
    }

    const manualConfirmed = (tournament as any)?.confirmedQualifiers || {}
    const confirmedQualifiedIds = new Set<string>()
    Object.values(manualConfirmed).forEach((sIds: any) => {
      if (Array.isArray(sIds)) sIds.forEach(id => confirmedQualifiedIds.add(id))
    })

    return { groups: groupsList, standingsByGroup: standingsData, confirmedQualifiedIds: hideQualification ? [] : Array.from(confirmedQualifiedIds) }
  }, [inningsMap, matches, squadIdByName, squadsById, tournament, tournamentId, filterSquadIds, hideQualification])

  useEffect(() => {
    if (groups.length > 0 && !activeGroupId) setActiveGroupId(groups[0].id)
  }, [groups, activeGroupId])

  if (loading) return <div className="p-10 text-center animate-pulse">Loading standings...</div>

  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0]
  const rows = standingsByGroup.get(activeGroup?.id || '') || []

  return (
    <div className={embedded ? 'pt-4' : 'max-w-4xl mx-auto p-5'}>
      {/* Table Header Section */}
      <div className="flex items-center justify-between mb-5">
        <h2 className={`text-base font-bold ${forcedDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>Points Table</h2>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Team form</span>
          <button
            onClick={() => setShowTeamForm(!showTeamForm)}
            className={`w-9 h-5 rounded-full relative transition-colors ${showTeamForm ? 'bg-[#0f172a]' : 'bg-slate-200 dark:bg-slate-800'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${showTeamForm ? 'left-4.5' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Group Pills */}
      {groups.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-6 pb-2">
          {groups.map(g => (
            <button
              key={g.id}
              onClick={() => setActiveGroupId(g.id)}
              className={`px-5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${activeGroupId === g.id
                ? 'bg-blue-600 text-white shadow-lg'
                : forcedDark
                  ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-500 hover:bg-slate-200'
                }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {/* Standings Table */}
      <div className={`${forcedDark ? 'bg-slate-950/20' : 'bg-white dark:bg-slate-950'} rounded-2xl border ${forcedDark ? 'border-white/5' : 'border-slate-100 dark:border-white/5'} shadow-sm overflow-hidden mb-6`}>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-[11px] font-medium">
            <thead>
              <tr className={`${forcedDark ? 'text-slate-500' : 'text-slate-400 dark:text-slate-500'} border-b ${forcedDark ? 'border-white/5' : 'border-slate-100 dark:border-white/5'} uppercase tracking-tighter`}>
                <th className="text-left py-4 px-4 font-bold">Team</th>
                <th className="text-center py-4 px-1">P</th>
                <th className="text-center py-4 px-1">W</th>
                <th className="text-center py-4 px-1">L</th>
                <th className="text-center py-4 px-1">D</th>
                <th className="text-center py-4 px-2">NRR</th>
                <th className="text-center py-4 px-4">Pts</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${forcedDark ? 'divide-white/5' : 'divide-slate-100 dark:divide-white/5'}`}>
              {rows.map((r, idx) => {
                const isConfirmed = Array.from(confirmedQualifiedIds).includes(r.squadId)
                const isInQualZone = !hideQualification && idx < 2
                const squad = squadsById.get(r.squadId)
                const isHighlighted = highlightMatch && (
                  r.squadId === highlightMatch.teamAId ||
                  r.squadId === highlightMatch.teamBId ||
                  r.squadId === (highlightMatch as any).teamASquadId ||
                  r.squadId === (highlightMatch as any).teamBSquadId ||
                  (r.squadName && (r.squadName === highlightMatch.teamAName || r.squadName === highlightMatch.teamBName))
                )

                return (
                  <tr
                    key={r.squadId}
                    className={`
                      ${isInQualZone ? 'bg-amber-50/20 dark:bg-amber-500/5' : ''} 
                      ${isHighlighted ? 'animate-pulse bg-blue-50/50 dark:bg-blue-900/20 ring-1 ring-inset ring-blue-500/30' : ''}
                      transition-all duration-500
                    `}
                  >
                    <td className="py-4 px-4">
                      <Link to={`/squads/${r.squadId}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div className="relative">
                          {isConfirmed && (
                            <div className="absolute -top-1 -left-1 w-3.5 h-3.5 bg-yellow-400 text-black text-[7px] font-black flex items-center justify-center rounded-sm shadow-sm z-10">Q</div>
                          )}
                          <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center overflow-hidden bg-white dark:bg-slate-800 shadow-sm shrink-0">
                            {squad?.logoUrl ? (
                              <img src={squad.logoUrl} alt="" className="w-full h-full object-contain p-1" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[12px] font-black uppercase">
                                {r.squadName.charAt(0)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className={`${forcedDark ? 'text-white' : 'text-slate-900 dark:text-white'} font-bold uppercase truncate max-w-[100px]`}>
                          {squad ? formatShortTeamName(squad.name, squad.batch) : r.squadName}
                        </div>
                      </Link>
                    </td>
                    <td className={`text-center tabular-nums ${forcedDark ? 'text-slate-400' : 'text-slate-600 dark:text-slate-400'}`}>{r.played}</td>
                    <td className={`text-center tabular-nums ${forcedDark ? 'text-slate-400' : 'text-slate-600 dark:text-slate-400'}`}>{r.won}</td>
                    <td className={`text-center tabular-nums ${forcedDark ? 'text-slate-400' : 'text-slate-600 dark:text-slate-400'}`}>{r.lost}</td>
                    <td className={`text-center tabular-nums ${forcedDark ? 'text-slate-400' : 'text-slate-600 dark:text-slate-400'}`}>{(r.tied || 0) + (r.noResult || 0)}</td>
                    <td className={`text-center tabular-nums ${forcedDark ? 'text-slate-500' : 'text-slate-400 dark:text-slate-500'}`}>{(r.nrr >= 0 ? '+' : '') + r.nrr.toFixed(3)}</td>
                    <td className={`text-center tabular-nums text-sm font-bold ${forcedDark ? 'text-amber-500' : 'text-amber-600 dark:text-amber-500'} px-4`}>{r.points}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        {!hideQualification && (
          <div className={`px-5 py-3 border-t ${forcedDark ? 'border-white/5 bg-white/5' : 'border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/20'} flex items-center gap-2`}>
            <div className="w-3.5 h-3.5 bg-yellow-400 text-black text-[7px] font-black flex items-center justify-center rounded-sm">Q</div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Qualified</span>
          </div>
        )}
      </div>

    </div>
  )
}

