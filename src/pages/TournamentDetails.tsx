/**
 * Tournament Details (Public)
 * Quick overview + navigation to points table.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import type { Match, Tournament } from '@/types'
import TournamentPointsTable from '@/pages/TournamentPointsTable'
import TournamentKeyStats from '@/pages/TournamentKeyStats'
import { coerceToDate, formatDateLabelTZ, formatTimeHMTo12h, formatTimeLabelBD } from '@/utils/date'

export default function TournamentDetails() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const [searchParams] = useSearchParams()

  const activeTab = useMemo(() => {
    const raw = String(searchParams.get('tab') || 'overview').toLowerCase().trim()
    if (raw === 'schedule' || raw === 'points' || raw === 'stats') return raw
    return 'overview'
  }, [searchParams])

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [inningsMap, setInningsMap] = useState<Map<string, { teamA: any | null; teamB: any | null }>>(new Map())
  const [playersById, setPlayersById] = useState<Map<string, any>>(new Map())
  const [squadsById, setSquadsById] = useState<Map<string, any>>(new Map())
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

        // Players map (for key stats) - realtime
        const unsubPlayers = playerService.subscribeAll((list) => {
          const pm = new Map<string, any>()
          ;(list as any[]).forEach((p) => p?.id && pm.set(p.id, p))
          setPlayersById(pm)
        })

        // Squads map (for live name resolution everywhere) - realtime
        const unsubSquads = squadService.subscribeAll((list) => {
          const sm = new Map<string, any>()
          ;(list as any[]).forEach((s) => s?.id && sm.set(s.id, s))
          setSquadsById(sm)
        })

        // Innings for stats/featured matches/points preview
        const entries = await Promise.all(
          ms.map(async (m) => {
            const [a, b] = await Promise.all([
              matchService.getInnings(m.id, 'teamA'),
              matchService.getInnings(m.id, 'teamB'),
            ])
            return [m.id, { teamA: a, teamB: b }] as const
          })
        )
        const im = new Map<string, { teamA: any | null; teamB: any | null }>()
        entries.forEach(([id, v]) => im.set(id, v))
        setInningsMap(im)

        return () => {
          unsubPlayers()
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

  const meta = useMemo(() => {
    return ((tournament as any)?.participantSquadMeta || {}) as Record<string, { name?: string; batch?: string }>
  }, [tournament])

  const participantNames = useMemo(() => {
    const ids = (tournament as any)?.participantSquadIds as string[] | undefined
    const list = (ids || Object.keys(meta || [])).map((id) => String(meta?.[id]?.name || '').trim()).filter(Boolean)
    return Array.from(new Set(list))
  }, [meta, tournament])

  const featuredMatches = useMemo(() => {
    // Show up to 3 matches: next upcoming by date/time + latest finished (based on innings availability)
    const parseDT = (m: any) => {
      const d0 = coerceToDate(m?.date)
      if (d0) return d0.getTime()
      const d = String(m.date || '').trim()
      const t = String(m.time || '').trim()
      if (!d) return 0
      const ts = Date.parse(`${d}T${t || '00:00'}:00`)
      return Number.isFinite(ts) ? ts : 0
    }

    const withTs = matches.map((m: any) => ({ m, ts: parseDT(m) }))
    const upcoming = withTs
      .filter((x) => x.ts > 0)
      .sort((a, b) => a.ts - b.ts)
      .slice(0, 2)
      .map((x) => x.m)

    const completed = matches
      .filter((m) => {
        const inn = inningsMap.get(m.id)
        return Boolean(inn?.teamA && inn?.teamB)
      })
      .slice()
      .reverse()
      .slice(0, 1)

    const combined = [...upcoming, ...completed]
    const seen = new Set<string>()
    return combined.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
  }, [inningsMap, matches])

  const overviewPoints = useMemo(() => {
    // Mini points table (simple points + NRR) from innings, across all matches.
    // NOTE: This is a lightweight preview; full logic is in Points Table page.
    const rows = new Map<string, { id: string; name: string; p: number; w: number; l: number; t: number; pts: number; rf: number; bf: number; ra: number; bb: number; nrr: number }>()
    const resolveId = (m: any, side: 'A' | 'B') => (side === 'A' ? (m.teamAId || m.teamASquadId || m.teamA) : (m.teamBId || m.teamBSquadId || m.teamB))
    const getName = (sid: string, m?: any, side?: 'A' | 'B') => {
      const fromSquad = String(squadsById.get(sid)?.name || squadsById.get(sid)?.teamName || '').trim()
      if (fromSquad) return fromSquad
      const fromMeta = String(meta?.[sid]?.name || '').trim()
      if (fromMeta) return fromMeta
      if (m && side === 'A') return String(m.teamAName || '').trim() || sid
      if (m && side === 'B') return String(m.teamBName || '').trim() || sid
      return sid
    }
    const ensure = (sid: string, name: string) => {
      if (!rows.has(sid)) rows.set(sid, { id: sid, name, p: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, bf: 0, ra: 0, bb: 0, nrr: 0 })
      return rows.get(sid)!
    }
    matches.forEach((m: any) => {
      const inn = inningsMap.get(m.id)
      if (!inn?.teamA || !inn?.teamB) return
      const aId = String(resolveId(m, 'A') || '').trim()
      const bId = String(resolveId(m, 'B') || '').trim()
      if (!aId || !bId) return
      const a = ensure(aId, getName(aId, m, 'A'))
      const b = ensure(bId, getName(bId, m, 'B'))
      const aRuns = Number(inn.teamA.totalRuns || 0)
      const bRuns = Number(inn.teamB.totalRuns || 0)
      const aBalls = Number(inn.teamA.legalBalls || 0)
      const bBalls = Number(inn.teamB.legalBalls || 0)
      a.p += 1
      b.p += 1
      a.rf += aRuns
      a.bf += aBalls
      a.ra += bRuns
      a.bb += bBalls
      b.rf += bRuns
      b.bf += bBalls
      b.ra += aRuns
      b.bb += aBalls
      if (aRuns > bRuns) {
        a.w += 1
        a.pts += 2
        b.l += 1
      } else if (bRuns > aRuns) {
        b.w += 1
        b.pts += 2
        a.l += 1
      } else {
        a.t += 1
        b.t += 1
        a.pts += 1
        b.pts += 1
      }
    })
    rows.forEach((r) => {
      const rf = r.bf > 0 ? r.rf / (r.bf / 6) : 0
      const ra = r.bb > 0 ? r.ra / (r.bb / 6) : 0
      r.nrr = Number((rf - ra).toFixed(3))
    })
    return Array.from(rows.values())
      .sort((a, b) => b.pts - a.pts || b.nrr - a.nrr || a.name.localeCompare(b.name))
      .slice(0, 6)
  }, [inningsMap, matches, meta])

  const resolveSquadName = useMemo(() => {
    return (m: any, side: 'A' | 'B') => {
      const sidRaw = side === 'A'
        ? (m.teamAId || m.teamASquadId || m.teamA)
        : (m.teamBId || m.teamBSquadId || m.teamB)
      const sid = String(sidRaw || '').trim()
      const fromSquad = String(squadsById.get(sid)?.name || squadsById.get(sid)?.teamName || '').trim()
      if (fromSquad) return fromSquad
      const fromMeta = String(meta?.[sid]?.name || '').trim()
      if (fromMeta) return fromMeta
      if (side === 'A') return String(m.teamAName || m.teamA || m.teamAId || 'Team A')
      return String(m.teamBName || m.teamB || m.teamBId || 'Team B')
    }
  }, [meta, squadsById])

  const keyStatsTop = useMemo(() => {
    // From innings batsmanStats/bowlerStats -> top 1 in each category
    const bat = new Map<string, { id: string; name: string; team: string; runs: number; balls: number; fifties: number; hundreds: number; sixes: number; sr: number }>()
    const bowl = new Map<string, { id: string; name: string; team: string; wickets: number }>()
    const getTeam = (pid: string) => {
      const sid = playersById.get(pid)?.squadId
      return String(meta?.[sid]?.name || '').trim() || 'Team'
    }
    inningsMap.forEach((inn) => {
      ;[inn.teamA, inn.teamB].filter(Boolean).forEach((i: any) => {
        ;(i?.batsmanStats || []).forEach((b: any) => {
          const pid = String(b.batsmanId || '')
          if (!pid) return
          const prev = bat.get(pid) || { id: pid, name: String(playersById.get(pid)?.name || b.batsmanName || 'Player'), team: getTeam(pid), runs: 0, balls: 0, fifties: 0, hundreds: 0, sixes: 0, sr: 0 }
          const runs = Number(b.runs || 0)
          const balls = Number(b.balls || 0)
          prev.runs += runs
          prev.balls += balls
          prev.sixes += Number(b.sixes || 0)
          prev.fifties += runs >= 50 && runs < 100 ? 1 : 0
          prev.hundreds += runs >= 100 ? 1 : 0
          bat.set(pid, prev)
        })
        ;(i?.bowlerStats || []).forEach((bw: any) => {
          const pid = String(bw.bowlerId || '')
          if (!pid) return
          const prev = bowl.get(pid) || { id: pid, name: String(playersById.get(pid)?.name || bw.bowlerName || 'Player'), team: getTeam(pid), wickets: 0 }
          prev.wickets += Number(bw.wickets || 0)
          bowl.set(pid, prev)
        })
      })
    })
    bat.forEach((r) => {
      r.sr = r.balls > 0 ? Number(((r.runs / r.balls) * 100).toFixed(2)) : 0
    })
    const mostRuns = Array.from(bat.values()).sort((a, b) => b.runs - a.runs)[0] || null
    const mostWickets = Array.from(bowl.values()).sort((a, b) => b.wickets - a.wickets)[0] || null
    const mostSixes = Array.from(bat.values()).sort((a, b) => b.sixes - a.sixes)[0] || null
    const bestSR = Array.from(bat.values()).filter((x) => x.balls >= 10).sort((a, b) => b.sr - a.sr)[0] || null
    return { mostRuns, mostWickets, mostSixes, bestSR }
  }, [inningsMap, meta, playersById])

  const scheduleMatches = useMemo(() => {
    const parseDT = (m: any) => {
      const d0 = coerceToDate(m?.date)
      if (d0) return d0.getTime()
      const d = String(m.date || '').trim()
      const t = String(m.time || '').trim()
      if (!d) return 0
      const ts = Date.parse(`${d}T${t || '00:00'}:00`)
      return Number.isFinite(ts) ? ts : 0
    }
    return matches
      .slice()
      .sort((a: any, b: any) => parseDT(a) - parseDT(b) || String(a.id).localeCompare(String(b.id)))
  }, [matches])

  if (!tournamentId) {
    return <div className="max-w-4xl mx-auto px-4 py-10">Tournament not found</div>
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-8 w-64 bg-slate-200 rounded animate-pulse mb-4" />
        <div className="h-4 w-80 bg-slate-200 rounded animate-pulse mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="text-4xl mb-3">🏆</div>
          <div className="text-xl font-bold text-slate-900">Tournament not found</div>
          <Link to="/tournaments" className="inline-block mt-6 px-4 py-2 rounded-xl bg-slate-900 text-white">
            Back to Tournaments
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/tournaments" className="text-sm font-semibold text-teal-700 hover:underline">
            ← Back to Tournaments
          </Link>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">{tournament.name}</h1>
          <p className="text-slate-600 mt-1">
            <span className="font-semibold">{tournament.year}</span> • {tournament.format} • {tournament.status}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex gap-1 px-2 py-2 sticky top-0 bg-white">
          <Link
            to={`/tournaments/${tournamentId}?tab=overview`}
            className={`px-4 py-2 rounded-xl font-semibold ${activeTab === 'overview' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
          >
            Overview
          </Link>
          <Link
            to={`/tournaments/${tournamentId}?tab=schedule`}
            className={`px-4 py-2 rounded-xl font-semibold ${activeTab === 'schedule' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
          >
            Schedule
          </Link>
          <Link
            to={`/tournaments/${tournamentId}?tab=points`}
            className={`px-4 py-2 rounded-xl font-semibold ${activeTab === 'points' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
          >
            Points Table
          </Link>
          <Link
            to={`/tournaments/${tournamentId}?tab=stats`}
            className={`px-4 py-2 rounded-xl font-semibold ${activeTab === 'stats' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
          >
            Key Stats
          </Link>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Left */}
          <div className="space-y-6">
            {/* Featured Matches */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="text-lg font-extrabold text-slate-900">Featured Matches</div>
                <Link to={`/tournaments/${tournamentId}?tab=schedule`} className="text-sm font-bold text-teal-700 hover:underline">
                  All Matches →
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {featuredMatches.length === 0 ? (
                  <div className="p-6 text-slate-600">No matches yet.</div>
                ) : (
                  featuredMatches.map((m: any) => {
                    const inn = inningsMap.get(m.id)
                    const aName = resolveSquadName(m, 'A')
                    const bName = resolveSquadName(m, 'B')
                    const done = Boolean(inn?.teamA && inn?.teamB)
                    const d = coerceToDate(m?.date)
                    const dtText = d
                      ? `${formatDateLabelTZ(d)} ${formatTimeLabelBD(d)}`
                      : `${String(m.date || '').trim()} ${formatTimeHMTo12h(String(m.time || '').trim())}`.trim()
                    return (
                      <div key={m.id} className="p-5 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 truncate">{aName} vs {bName}</div>
                          <div className="text-sm text-slate-600 mt-1">
                            {done
                              ? `Result: ${aName} ${inn.teamA.totalRuns}-${inn.teamA.totalWickets} • ${bName} ${inn.teamB.totalRuns}-${inn.teamB.totalWickets}`
                              : dtText || 'Scheduled'}
                          </div>
                        </div>
                        <Link
                          to={`/match/${m.id}`}
                          className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 font-bold text-slate-800"
                        >
                          View →
                        </Link>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Mini Points Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="text-lg font-extrabold text-slate-900">Points Table</div>
                <Link to={`/tournaments/${tournamentId}?tab=points`} className="text-sm font-bold text-teal-700 hover:underline">
                  Full Table →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">
                      <th className="text-left py-3 px-4">Team</th>
                      <th className="text-right py-3 px-3">P</th>
                      <th className="text-right py-3 px-3">W</th>
                      <th className="text-right py-3 px-3">Pts</th>
                      <th className="text-right py-3 px-3">NRR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overviewPoints.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">No standings yet.</td>
                      </tr>
                    ) : (
                      overviewPoints.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-semibold text-slate-900">{r.name}</td>
                          <td className="py-3 px-3 text-right text-slate-700">{r.p}</td>
                          <td className="py-3 px-3 text-right text-slate-700">{r.w}</td>
                          <td className="py-3 px-3 text-right font-extrabold text-slate-900">{r.pts}</td>
                          <td className="py-3 px-3 text-right text-slate-700">{Number(r.nrr).toFixed(3)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
                <div className="text-lg font-extrabold text-slate-900">Key Stats</div>
              </div>
              <div className="divide-y divide-slate-100">
                {([
                  { title: 'Most Runs', v: keyStatsTop.mostRuns ? `${keyStatsTop.mostRuns.runs}` : '—', who: keyStatsTop.mostRuns?.name, team: keyStatsTop.mostRuns?.team },
                  { title: 'Most Wickets', v: keyStatsTop.mostWickets ? `${keyStatsTop.mostWickets.wickets}` : '—', who: keyStatsTop.mostWickets?.name, team: keyStatsTop.mostWickets?.team },
                  { title: 'Most Sixes', v: keyStatsTop.mostSixes ? `${keyStatsTop.mostSixes.sixes}` : '—', who: keyStatsTop.mostSixes?.name, team: keyStatsTop.mostSixes?.team },
                  { title: 'Best Strike Rate', v: keyStatsTop.bestSR ? `${keyStatsTop.bestSR.sr}` : '—', who: keyStatsTop.bestSR?.name, team: keyStatsTop.bestSR?.team },
                ] as const).map((k) => (
                  <div key={k.title} className="p-5">
                    <div className="text-xs font-bold text-slate-500">{k.title}</div>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 truncate">{k.who || '—'}</div>
                        <div className="text-sm text-slate-600 truncate">{k.team || ''}</div>
                      </div>
                      <div className="text-2xl font-extrabold text-slate-900">{k.v}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-4 border-t border-slate-200 bg-white">
                <Link
                  to={`/tournaments/${tournamentId}?tab=stats`}
                  className="block w-full text-center px-4 py-3 rounded-xl bg-white border-2 border-slate-200 hover:bg-slate-50 font-extrabold text-slate-900"
                >
                  View All Key Stats →
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="text-sm font-extrabold text-slate-900">Teams</div>
              <div className="text-xs text-slate-500 mt-1">Tournament squads</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(participantNames.length ? participantNames : ['—']).slice(0, 12).map((n) => (
                  <span key={n} className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-800 text-sm font-semibold">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'schedule' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-lg font-extrabold text-slate-900">Schedule</div>
              <div className="text-sm text-slate-600 mt-0.5">All fixtures & results in this tournament</div>
            </div>
            <div className="text-sm font-semibold text-slate-600">{scheduleMatches.length} matches</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">
                  <th className="text-left py-3 px-4">Match</th>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Time</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-right py-3 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scheduleMatches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">No matches yet.</td>
                  </tr>
                ) : (
                  scheduleMatches.map((m: any) => {
                    const aName = resolveSquadName(m, 'A')
                    const bName = resolveSquadName(m, 'B')
                    const inn = inningsMap.get(m.id)
                    const done = Boolean(inn?.teamA && inn?.teamB)
                    const status = String(m.status || '').trim() || (done ? 'Finished' : 'Upcoming')
                    const d = coerceToDate(m?.date)
                    const dateText = d ? formatDateLabelTZ(d) : '—'
                    const timeText = String(m.time || '').trim()
                      ? formatTimeHMTo12h(String(m.time || '').trim())
                      : d
                        ? formatTimeLabelBD(d)
                        : '—'
                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-semibold text-slate-900">{aName} vs {bName}</td>
                        <td className="py-3 px-4 text-slate-700">{dateText}</td>
                        <td className="py-3 px-4 text-slate-700">{timeText}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${done ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                            {status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Link to={`/match/${m.id}`} className="inline-flex items-center px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 font-bold text-slate-800">
                            View →
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'points' ? (
        <TournamentPointsTable embedded tournamentId={tournamentId} />
      ) : null}

      {activeTab === 'stats' ? (
        <TournamentKeyStats embedded tournamentId={tournamentId} />
      ) : null}
    </div>
  )
}


