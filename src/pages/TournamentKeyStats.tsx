/**
 * Tournament Key Stats (Public)
 * Redesigned with Podium & Scrollable Categories
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { matchService } from '@/services/firestore/matches'
import { squadService } from '@/services/firestore/squads'
import { playerService } from '@/services/firestore/players'
import type { InningsStats, Match, Tournament } from '@/types'
import PlayerAvatar from '@/components/common/PlayerAvatar'

type StatCategory = 'runs' | 'wickets' | 'sixes' | 'hs' | 'bestFigures' | 'sr' | 'econ'

type BatAgg = {
  playerId: string
  playerName: string
  squadName: string
  runs: number
  balls: number
  inns: number
  outs: number
  sixes: number
  strikeRate: number
  fifties: number
  hundreds: number
  fours: number
  isNotOut?: boolean // for HS
}

type BowlAgg = {
  playerId: string
  playerName: string
  squadName: string
  wickets: number
  balls: number
  runsConceded: number
  economy: number
}

const safeNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0)

export default function TournamentKeyStats({
  embedded = false,
  tournamentId: tournamentIdProp,
  matches: matchesProp,
  inningsMap: inningsMapProp
}: {
  embedded?: boolean
  tournamentId?: string
  matches?: Match[]
  inningsMap?: Map<string, { teamA: InningsStats | null; teamB: InningsStats | null; aso?: InningsStats | null; bso?: InningsStats | null }>
} = {}) {
  const params = useParams<{ tournamentId: string }>()
  const tournamentId = tournamentIdProp || params.tournamentId
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [inningsMap, setInningsMap] = useState<Map<string, { teamA: InningsStats | null; teamB: InningsStats | null; aso?: InningsStats | null; bso?: InningsStats | null }>>(new Map())
  const [playersById, setPlayersById] = useState<Map<string, any>>(new Map())
  const [squadsById, setSquadsById] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<StatCategory>('runs')

  // Sync props to state if provided
  useEffect(() => {
    if (inningsMapProp) setInningsMap(inningsMapProp)
  }, [inningsMapProp])

  // Realtime Subscriptions (Sync Effect)
  useEffect(() => {
    const unsubPlayers = playerService.subscribeAll((list) => {
      const pMap = new Map<string, any>()
        ; (list as any[]).forEach((p) => p?.id && pMap.set(p.id, p))
      setPlayersById(pMap)
    })
    const unsubSquads = squadService.subscribeAll((list) => {
      const sMap = new Map<string, any>()
        ; (list as any[]).forEach((s) => s?.id && sMap.set(s.id, s))
      setSquadsById(sMap)
    })

    return () => {
      unsubPlayers()
      unsubSquads()
    }
  }, [])

  // Data Fetching (Async Effect)
  useEffect(() => {
    const run = async () => {
      if (!tournamentId) return

      // Only set loading if we don't have props
      if (!inningsMapProp) setLoading(true)

      try {
        const t = await tournamentService.getById(tournamentId)
        setTournament(t)

        // Fetch matches/innings ONLY if not provided via props
        if (!inningsMapProp) {
          const msProp = matchesProp || await matchService.getByTournament(tournamentId)
          // We don't store matches in state as they aren't used for rendering stats directly

          const entries = await Promise.all(
            msProp.map(async (m) => {
              const [a, b, aso, bso] = await Promise.all([
                matchService.getInnings(m.id, 'teamA'),
                matchService.getInnings(m.id, 'teamB'),
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
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [tournamentId, matchesProp, inningsMapProp])

  const statsData = useMemo(() => {
    const getPlayerName = (id: string) => String(playersById.get(id)?.name || '').trim() || 'Player'
    const getPlayerPhoto = (id: string) => playersById.get(id)?.photoUrl || playersById.get(id)?.photo
    const getSquadName = (playerId: string) => {
      const squadId = playersById.get(playerId)?.squadId
      const s = squadsById.get(squadId)
      return String(s?.name || s?.teamName || (tournament as any)?.participantSquadMeta?.[squadId]?.name || '').trim() || 'Team'
    }

    const batMap = new Map<string, BatAgg>()
    const bowlMap = new Map<string, BowlAgg>()

    // For single innings records
    let highestScores: BatAgg[] = []
    let bestFigures: BowlAgg[] = []

    const ensureBat = (pid: string) => {
      if (!batMap.has(pid)) {
        batMap.set(pid, {
          playerId: pid,
          playerName: getPlayerName(pid),
          squadName: getSquadName(pid),
          runs: 0, balls: 0, inns: 0, outs: 0, sixes: 0, strikeRate: 0, fifties: 0, hundreds: 0, fours: 0
        })
      }
      return batMap.get(pid)!
    }

    const ensureBowl = (pid: string) => {
      if (!bowlMap.has(pid)) {
        bowlMap.set(pid, {
          playerId: pid,
          playerName: getPlayerName(pid),
          squadName: getSquadName(pid),
          wickets: 0, balls: 0, runsConceded: 0, economy: 0
        })
      }
      return bowlMap.get(pid)!
    }

    inningsMap.forEach((inn) => {
      [inn.teamA, inn.teamB].filter(Boolean).forEach((i: any) => {
        // Batting
        const batters = Array.isArray(i?.batsmanStats) ? i.batsmanStats : []
        batters.forEach((b: any) => {
          const pid = String(b.batsmanId || '')
          if (!pid) return
          const runs = safeNum(b.runs)
          const balls = safeNum(b.balls)
          const sixes = safeNum(b.sixes)
          const notOut = Boolean(b.notOut)

          // Aggregate
          const agg = ensureBat(pid)
          agg.runs += runs
          agg.balls += balls
          agg.sixes += sixes
          agg.inns += 1
          if (!notOut) agg.outs += 1

          // Single Innings (Highest Score)
          if (runs > 0) {
            highestScores.push({
              playerId: pid,
              playerName: getPlayerName(pid),
              squadName: getSquadName(pid),
              runs, balls, inns: 1, outs: notOut ? 0 : 1, sixes,
              strikeRate: balls > 0 ? (runs / balls) * 100 : 0,
              isNotOut: notOut,
              fifties: 0, hundreds: 0, fours: 0
            })
          }
        })

        // Bowling
        const bowlers = Array.isArray(i?.bowlerStats) ? i.bowlerStats : []
        bowlers.forEach((bw: any) => {
          const pid = String(bw.bowlerId || '')
          if (!pid) return
          const wkts = safeNum(bw.wickets)
          const runs = safeNum(bw.runsConceded)
          const balls = safeNum(bw.ballsBowled)

          // Aggregate
          const agg = ensureBowl(pid)
          agg.wickets += wkts
          agg.runsConceded += runs
          agg.balls += balls

          // Single Innings (Best Figures)
          if (balls > 0) {
            bestFigures.push({
              playerId: pid,
              playerName: getPlayerName(pid),
              squadName: getSquadName(pid),
              wickets: wkts,
              runsConceded: runs,
              balls,
              economy: balls > 0 ? runs / (balls / 6) : 0
            })
          }
        })
      })
    })

    // Finalize aggregations
    batMap.forEach(r => {
      r.strikeRate = r.balls > 0 ? (r.runs / r.balls) * 100 : 0
    })
    bowlMap.forEach(r => {
      const overs = r.balls / 6
      r.economy = overs > 0 ? r.runsConceded / overs : 0
    })

    const batList = Array.from(batMap.values())
    const bowlList = Array.from(bowlMap.values())

    // Filter and Sort
    const mostRuns = [...batList].filter(r => r.runs > 0).sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate)
    const mostWickets = [...bowlList].filter(r => r.wickets > 0).sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)
    const mostSixes = [...batList].filter(r => r.sixes > 0).sort((a, b) => b.sixes - a.sixes || b.runs - a.runs)

    // Sort HS: Runs desc, then balls asc (faster scoring better)
    const hsList = highestScores.sort((a, b) => b.runs - a.runs || a.balls - b.balls)

    // Sort Best Figures: Wickets desc, then Runs asc
    const bfList = bestFigures.filter(r => r.wickets > 0).sort((a, b) => b.wickets - a.wickets || a.runsConceded - b.runsConceded)

    // Best SR (min 10 balls)
    const srList = batList.filter(r => r.balls >= 10 && r.runs > 0).sort((a, b) => b.strikeRate - a.strikeRate)

    // Best Economy (min 12 balls)
    const econList = bowlList.filter(r => r.balls >= 12).sort((a, b) => a.economy - b.economy || b.wickets - a.wickets)

    return { mostRuns, mostWickets, mostSixes, hsList, bfList, srList, econList, getPlayerPhoto }
  }, [inningsMap, playersById, squadsById, tournament])

  if (!tournamentId) return null
  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 py-10 animate-pulse space-y-8">
      <div className="h-8 w-48 bg-slate-200 rounded" />
      <div className="h-40 bg-slate-100 rounded-2xl" />
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-50 rounded-xl" />)}
      </div>
    </div>
  )

  const getCurrentList = () => {
    switch (activeCategory) {
      case 'runs': return statsData.mostRuns
      case 'wickets': return statsData.mostWickets
      case 'sixes': return statsData.mostSixes
      case 'hs': return statsData.hsList
      case 'bestFigures': return statsData.bfList
      case 'sr': return statsData.srList
      case 'econ': return statsData.econList
      default: return []
    }
  }

  const currentList = getCurrentList()
  const top3 = currentList.slice(0, 3)
  const rest = currentList.slice(3)

  const getPrimaryValue = (item: any) => {
    switch (activeCategory) {
      case 'runs': return item.runs
      case 'wickets': return item.wickets
      case 'sixes': return item.sixes
      case 'hs': return `${item.runs}${item.isNotOut ? '*' : ''}`
      case 'bestFigures': return `${item.wickets}-${item.runsConceded}`
      case 'sr': return item.strikeRate.toFixed(1)
      case 'econ': return item.economy.toFixed(2)
      default: return 0
    }
  }

  const getSecondaryLabel = () => {
    switch (activeCategory) {
      case 'runs': return 'Runs'
      case 'wickets': return 'Wickets'
      case 'sixes': return 'Sixes'
      case 'hs': return 'Score'
      case 'bestFigures': return 'Fig'
      case 'sr': return 'S/R'
      case 'econ': return 'Econ'
    }
  }

  const getSubInfo = (item: any) => {
    switch (activeCategory) {
      case 'runs': return `${item.inns} Inns`
      case 'wickets': return `${Number(item.balls / 6).toFixed(1)} Ov`
      case 'sixes': return `${item.inns} Inns`
      case 'hs': return `${item.balls} Balls`
      case 'bestFigures': return `${Number(item.balls / 6).toFixed(1)} Ov`
      case 'sr': return `${item.runs} Runs`
      case 'econ': return `${Number(item.balls / 6).toFixed(1)} Ov`
    }
  }

  // Podium Order: 2nd, 1st, 3rd to match visualization (left, center, right)
  const podiumOrder = [top3[1], top3[0], top3[2]]
  // Ranks for display
  const podiumRanks = [2, 1, 3]

  return (
    <div className={embedded ? 'space-y-6' : 'max-w-5xl mx-auto px-4 py-8 space-y-6'}>
      {!embedded && (
        <div className="flex items-center gap-4 mb-6 relative z-10">
          <Link
            to={`/tournaments/${tournamentId}`}
            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-emerald-600 transition-all active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tournament Stats</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{tournament?.name}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar mask-linear-fade">
        {[
          { id: 'runs', label: 'Most Runs' },
          { id: 'wickets', label: 'Most Wickets' },
          { id: 'sixes', label: 'Most Sixes' },
          { id: 'hs', label: 'Highest Score' },
          { id: 'bestFigures', label: 'Best Figures' },
          { id: 'sr', label: 'Best Strike Rate' },
          { id: 'econ', label: 'Best Economy' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id as any)}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeCategory === tab.id
              ? 'bg-slate-900 text-white shadow-lg scale-105'
              : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Podium Section */}
      {top3.length > 0 && (
        <div className="relative pt-8 pb-12 px-4">
          {/* Background Decoration */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50/50 to-transparent rounded-[2rem] -z-10" />

          <div className="flex items-end justify-center gap-4 sm:gap-8 md:gap-12">
            {podiumOrder.map((p, idx) => {
              const rank = podiumRanks[idx] // 2, 1, 3
              if (!p && rank === 1) return null // If no first place, show nothing (unlikely)
              if (!p) return <div key={idx} className="w-16 sm:w-24" /> // Spacer

              const isFirst = rank === 1
              const photo = statsData.getPlayerPhoto(p.playerId)
              const val = getPrimaryValue(p)
              const firstName = p.playerName.split(' ')[0]
              const lastName = p.playerName.split(' ').slice(1).join(' ') || ''

              return (
                <div key={`${p.playerId}-${idx}`} className={`flex flex-col items-center group cursor-pointer ${isFirst ? '-mt-12 z-10' : ''}`}>
                  <Link to={`/players/${p.playerId}`} className="text-center mb-4 transition-all group-hover:-translate-y-1">
                    <div className={`font-black tracking-widest text-slate-400 dark:text-slate-500 uppercase leading-none mb-1.5 truncate max-w-[120px] ${isFirst ? 'text-xs sm:text-sm' : 'text-[10px]'}`}>
                      {firstName} <span className="hidden sm:inline">{lastName}</span>
                    </div>
                    <div className={`font-black tracking-tighter drop-shadow-sm ${isFirst ? 'text-5xl sm:text-6xl text-slate-900 dark:text-white scale-110 mb-2' : 'text-3xl sm:text-4xl text-slate-800 dark:text-slate-200'}`}>
                      {val}
                    </div>
                  </Link>

                  <Link to={`/players/${p.playerId}`} className="relative transition-transform hover:scale-110">
                    <div className={`relative rounded-full border-4 border-white dark:border-slate-800 shadow-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 transition-all ${isFirst ? 'w-28 h-28 sm:w-40 sm:h-40 ring-4 ring-emerald-500/20' : 'w-20 h-20 sm:w-28 sm:h-28 ring-4 ring-slate-400/10'
                      }`}>
                      <PlayerAvatar
                        photoUrl={photo}
                        name={p.playerName}
                        size="full"
                        className="w-full h-full"
                      />
                    </div>
                    <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center font-black text-white shadow-xl transition-all ${isFirst ? 'bg-emerald-500 w-8 h-8 sm:w-10 sm:h-10 text-xs sm:text-sm ring-2 ring-white scale-125' : 'bg-slate-400 w-6 h-6 sm:w-8 sm:h-8 text-[10px] sm:text-xs ring-2 ring-white'
                      } rounded-full`}>
                      {rank}
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* List Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-50 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-4">
            <span className="w-6 text-center">Pos</span>
            <span>Name</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hidden sm:block w-16 text-right">Info</span>
            <span className="w-12 text-right">{getSecondaryLabel()}</span>
          </div>
        </div>

        <div className="divide-y divide-slate-50">
          {top3.concat(rest).map((p, idx) => {
            const photo = statsData.getPlayerPhoto(p.playerId)
            return (
              <div key={`${p.playerId}-${idx}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors group">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-6 text-center font-black ${idx < 3 ? 'text-emerald-500 text-lg' : 'text-slate-300 text-sm'}`}>
                    {idx + 1}
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 hidden sm:block border border-slate-100 dark:border-white/5">
                      <PlayerAvatar photoUrl={photo} name={p.playerName} size="sm" className="w-full h-full" />
                    </div>
                    <div className="min-w-0">
                      <Link to={`/players/${p.playerId}`} className="font-bold text-slate-900 text-sm truncate group-hover:text-emerald-700 transition-colors">
                        {p.playerName}
                      </Link>
                      <div className="text-[10px] text-slate-400 font-medium truncate uppercase tracking-wider">{p.squadName}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 pl-4">
                  <div className="hidden sm:block text-xs font-medium text-slate-400 w-16 text-right tabular-nums">
                    {getSubInfo(p)}
                  </div>
                  <div className="w-12 text-right font-black text-slate-900 text-base tabular-nums">
                    {getPrimaryValue(p)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
