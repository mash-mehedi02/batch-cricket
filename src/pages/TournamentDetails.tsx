/**
 * Tournament Details Page - Redesigned to match Squad Details structure
 * Same sticky header, tab navigation, and content layout
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import type { Match, Tournament, Squad, Player, InningsStats } from '@/types'
import { Timestamp } from 'firebase/firestore'
import { coerceToDate, formatDateLabelTZ, formatTimeHMTo12h, formatTimeLabelBD } from '@/utils/date'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import { getMatchResultString } from '@/utils/matchWinner'
import PageHeader from '@/components/common/PageHeader'
import TournamentPointsTable from '@/pages/TournamentPointsTable'
import TournamentKeyStats from '@/pages/TournamentKeyStats'

type Tab = 'overview' | 'matches' | 'teams' | 'points' | 'stats'

export default function TournamentDetails() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get('tab')?.toLowerCase()
    if (tab === 'matches' || tab === 'teams' || tab === 'points' || tab === 'stats') return tab as Tab
    return 'overview'
  })

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [inningsMap, setInningsMap] = useState<Map<string, { teamA: any | null; teamB: any | null }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({})

  // Update URL when tab changes
  useEffect(() => {
    setSearchParams({ tab: activeTab }, { replace: true })
  }, [activeTab, setSearchParams])

  // Data loading
  useEffect(() => {
    const run = async () => {
      if (!tournamentId) return
      setLoading(true)
      try {
        // Load tournament
        const t = await tournamentService.getById(tournamentId)
        setTournament(t)

        // Load matches
        const ms = await matchService.getByTournament(tournamentId)
        setMatches(ms)

        // Load squads
        const allSquads = await squadService.getAll()
        const tournamentSquads = allSquads.filter(s =>
          (t as any)?.participantSquadIds?.includes(s.id) ||
          ms.some(m => m.teamAId === s.id || m.teamBId === s.id)
        )
        setSquads(tournamentSquads)

        // Load players
        const allPlayers = await playerService.getAll()
        setPlayers(allPlayers)

        // End loading state here - page can now display!
        setLoading(false)

        // Load innings in background
        Promise.all(
          ms.map(async (m) => {
            const [a, b] = await Promise.all([
              matchService.getInnings(m.id, 'teamA'),
              matchService.getInnings(m.id, 'teamB'),
            ])
            return [m.id, { teamA: a, teamB: b }] as const
          })
        ).then(entries => {
          const im = new Map<string, { teamA: any | null; teamB: any | null }>()
          entries.forEach(([id, v]) => im.set(id, v))
          setInningsMap(im)
        })

      } catch (e) {
        console.error('Error loading tournament details:', e)
        setTournament(null)
        setLoading(false)
      }
    }
    run()
  }, [tournamentId])

  const handleImgError = (url: string) => {
    setBrokenImages(prev => ({ ...prev, [url]: true }))
  }

  const safeRender = (val: any) => {
    if (val instanceof Timestamp) {
      return val.toDate().getFullYear().toString()
    }
    if (typeof val === 'object' && val !== null) {
      return 'Tournament'
    }
    return val
  }

  const formatShortName = (name: string) => {
    if (!name) return '???'
    const parts = name.split(/[- ]+/).filter(Boolean)
    const label = parts[0]?.substring(0, 3).toUpperCase() || '???'
    const batch = parts[parts.length - 1]?.match(/\d+/) ? parts[parts.length - 1] : ''
    return batch ? `${label}-${batch}` : label
  }

  // Featured matches logic
  const featuredMatches = useMemo(() => {
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
      .filter((x) => x.ts > 0 && x.ts > Date.now())
      .sort((a, b) => a.ts - b.ts)
      .slice(0, 2)
      .map((x) => x.m)

    const live = matches.filter(m => String(m.status || '').toLowerCase() === 'live').slice(0, 1)

    const completed = matches
      .filter((m) => {
        const inn = inningsMap.get(m.id)
        return Boolean(inn?.teamA && inn?.teamB)
      })
      .slice()
      .reverse()
      .slice(0, 1)

    const combined = [...live, ...upcoming, ...completed]
    const seen = new Set<string>()
    return combined.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true))).slice(0, 3)
  }, [inningsMap, matches])

  // Key stats
  const keyStatsTop = useMemo(() => {
    const bat = new Map<string, { id: string; name: string; team: string; runs: number; balls: number; sixes: number; sr: number }>()
    const bowl = new Map<string, { id: string; name: string; team: string; wickets: number }>()

    const getTeam = (pid: string) => {
      const player = players.find(p => p.id === pid)
      const squad = squads.find(s => s.id === player?.squadId)
      return squad?.name || 'Team'
    }

    inningsMap.forEach((inn) => {
      [inn.teamA, inn.teamB].filter(Boolean).forEach((i: any) => {
        // Batsman stats
        const batsmanStats = Array.isArray(i?.batsmanStats) ? i.batsmanStats : []
        batsmanStats.forEach((b: any) => {
          const pid = String(b.batsmanId || '')
          if (!pid) return
          const player = players.find(p => p.id === pid)
          const prev = bat.get(pid) || { id: pid, name: player?.name || b.batsmanName || 'Player', team: getTeam(pid), runs: 0, balls: 0, sixes: 0, sr: 0 }
          const runs = Number(b.runs || 0)
          const balls = Number(b.balls || 0)
          prev.runs += runs
          prev.balls += balls
          prev.sixes += Number(b.sixes || 0)
          bat.set(pid, prev)
        })

        // Bowler stats
        const bowlerStats = Array.isArray(i?.bowlerStats) ? i.bowlerStats : []
        bowlerStats.forEach((bw: any) => {
          const pid = String(bw.bowlerId || '')
          if (!pid) return
          const player = players.find(p => p.id === pid)
          const prev = bowl.get(pid) || { id: pid, name: player?.name || bw.bowlerName || 'Player', team: getTeam(pid), wickets: 0 }
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
  }, [inningsMap, players, squads])

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-20 animate-pulse">
        <div className="h-[20vh] md:h-[30vh] bg-slate-200" />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="h-16 bg-slate-200 rounded-xl mb-6" />
          <div className="h-10 bg-slate-100 rounded-xl w-64 mb-6" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-slate-100 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🏆</div>
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Tournament Not Found</h2>
          <Link to="/tournaments" className="inline-block px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-xl hover:bg-emerald-700 transition-all">
            Back to Tournaments
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 pb-20 overflow-x-hidden">
      <PageHeader title={tournament.name} subtitle={tournament.year || tournament.season} />

      {/* Hero Banner */}
      <div className="relative h-[20vh] md:h-[30vh] overflow-hidden bg-slate-900">
        {tournament.bannerUrl && !brokenImages[tournament.bannerUrl] ? (
          <img src={tournament.bannerUrl} onError={() => handleImgError(tournament.bannerUrl || '')} alt={tournament.name} className="w-full h-full object-cover opacity-40" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/50 to-transparent" />
      </div>

      {/* Sticky Header Section */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4 mb-3">
            {/* Compact Logo */}
            <div className="w-12 h-12 bg-white rounded-2xl border-2 border-white shadow-lg overflow-hidden flex items-center justify-center p-1 shrink-0">
              {tournament.logoUrl && !brokenImages[tournament.logoUrl] ? (
                <img src={tournament.logoUrl} onError={() => handleImgError(tournament.logoUrl || '')} alt={tournament.name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-xl font-black text-emerald-600 uppercase">{tournament.name[0]}</span>
              )}
            </div>

            {/* Tournament Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight leading-none mb-1 truncate">
                {tournament.name}
              </h1>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">
                  {safeRender(tournament.year)}
                </span>
                <span className="text-slate-400 text-[9px] font-bold uppercase">
                  {tournament.format}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200 rounded-xl w-fit max-w-full overflow-x-auto no-scrollbar">
            {(['overview', 'matches', 'teams', 'points', 'stats'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Featured Matches */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-slate-900">Featured Matches</h2>
                <button onClick={() => setActiveTab('matches')} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                  All Matches →
                </button>
              </div>
              <div className="space-y-3">
                {featuredMatches.length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 font-bold">
                    No matches yet
                  </div>
                ) : (
                  featuredMatches.map(match => (
                    <MatchCard key={match.id} match={match} innings={inningsMap.get(match.id)} />
                  ))
                )}
              </div>
            </div>

            {/* Key Stats Cards */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-slate-900">Key Stats</h2>
                <button onClick={() => setActiveTab('stats')} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">
                  See More →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard title="Most Runs" value={keyStatsTop.mostRuns?.runs || 0} player={keyStatsTop.mostRuns?.name} team={keyStatsTop.mostRuns?.team} />
                <StatCard title="Most Wickets" value={keyStatsTop.mostWickets?.wickets || 0} player={keyStatsTop.mostWickets?.name} team={keyStatsTop.mostWickets?.team} />
                <StatCard title="Most Sixes" value={keyStatsTop.mostSixes?.sixes || 0} player={keyStatsTop.mostSixes?.name} team={keyStatsTop.mostSixes?.team} />
                <StatCard title="Best SR" value={keyStatsTop.bestSR?.sr || 0} player={keyStatsTop.bestSR?.name} team={keyStatsTop.bestSR?.team} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'matches' && (
          <TournamentMatchesTab matches={matches} inningsMap={inningsMap} />
        )}

        {activeTab === 'teams' && (
          <TournamentTeamsTab squads={squads} players={players} />
        )}

        {activeTab === 'points' && (
          <TournamentPointsTable embedded tournamentId={tournamentId!} matches={matches} inningsMap={inningsMap} />
        )}

        {activeTab === 'stats' && (
          <TournamentKeyStats embedded tournamentId={tournamentId!} matches={matches} inningsMap={inningsMap} />
        )}
      </div>
    </div>
  )
}

// Match Card Component
function MatchCard({ match, innings }: { match: Match; innings?: { teamA: any; teamB: any } }) {
  const status = String(match.status || '').toLowerCase()
  const isLive = status === 'live'
  const isFin = status === 'finished' || status === 'completed' || Boolean(innings?.teamA && innings?.teamB)

  const d = coerceToDate(match.date)
  const dStr = d
    ? `${formatDateLabelTZ(d)} ${formatTimeLabelBD(d)}`
    : `${String(match.date || '').trim()} ${formatTimeHMTo12h(String(match.time || '').trim())}`.trim()

  return (
    <Link
      to={`/match/${match.id}`}
      className={`block bg-white border rounded-2xl overflow-hidden transition-all hover:shadow-lg ${isLive ? 'border-red-500/30 shadow-md shadow-red-500/5' : 'border-slate-100'
        }`}
    >
      <div className={`px-4 py-2 flex items-center justify-between border-b ${isLive ? 'bg-red-50/50 border-red-100/50' : 'bg-slate-50 border-slate-100'
        }`}>
        <div className="flex items-center gap-2">
          {isLive ? (
            <span className="flex items-center gap-1.5 text-[9px] font-black text-red-500 tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live Now
            </span>
          ) : (
            <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase">
              {isFin ? 'Match Completed' : 'Upcoming'}
            </span>
          )}
        </div>
        <span className="text-[9px] font-bold text-slate-500 tabular-nums">{dStr}</span>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-slate-900">{match.teamAName}</span>
          {(isLive || isFin) && innings && (
            <span className="text-sm font-black text-slate-900 tabular-nums">
              {innings.teamA?.totalRuns || 0}/{innings.teamA?.totalWickets || 0}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-900">{match.teamBName}</span>
          {(isLive || isFin) && innings && (
            <span className="text-sm font-black text-slate-900 tabular-nums">
              {innings.teamB?.totalRuns || 0}/{innings.teamB?.totalWickets || 0}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// Stat Card Component
function StatCard({ title, value, player, team }: { title: string; value: number | string; player?: string; team?: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{title}</div>
      <div className="text-2xl font-black text-slate-900 mb-1">{value}</div>
      {player && (
        <>
          <div className="text-xs font-bold text-slate-700 truncate">{player}</div>
          <div className="text-[10px] text-slate-400 truncate">{team}</div>
        </>
      )}
    </div>
  )
}

// Matches Tab Component
function TournamentMatchesTab({ matches, inningsMap }: { matches: Match[]; inningsMap: Map<string, any> }) {
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all')

  const filteredMatches = useMemo(() => {
    let filtered = matches
    if (filter === 'live') {
      filtered = matches.filter(m => String(m.status || '').toLowerCase() === 'live')
    } else if (filter === 'upcoming') {
      filtered = matches.filter(m => {
        const status = String(m.status || '').toLowerCase()
        return status === 'upcoming' || status === 'scheduled' || !status
      })
    } else if (filter === 'finished') {
      filtered = matches.filter(m => {
        const status = String(m.status || '').toLowerCase()
        const inn = inningsMap.get(m.id)
        return status === 'finished' || status === 'completed' || Boolean(inn?.teamA && inn?.teamB)
      })
    }
    return filtered.sort((a, b) => {
      const aDate = coerceToDate(a.date)?.getTime() || 0
      const bDate = coerceToDate(b.date)?.getTime() || 0
      return bDate - aDate
    })
  }, [matches, filter, inningsMap])

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Filter */}
      <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200 rounded-xl w-fit">
        {(['all', 'live', 'upcoming', 'finished'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
              }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Match List */}
      <div className="space-y-3">
        {filteredMatches.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 font-bold">
            No {filter !== 'all' ? filter : ''} matches found
          </div>
        ) : (
          filteredMatches.map(match => (
            <MatchCard key={match.id} match={match} innings={inningsMap.get(match.id)} />
          ))
        )}
      </div>
    </div>
  )
}

// Teams Tab Component
function TournamentTeamsTab({ squads, players }: { squads: Squad[]; players: Player[] }) {
  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      {squads.length === 0 ? (
        <div className="bg-slate-50 rounded-2xl p-8 text-center text-slate-400 font-bold">
          No teams found
        </div>
      ) : (
        squads.map(squad => {
          const squadPlayers = players.filter(p => p.squadId === squad.id)
          return (
            <Link
              key={squad.id}
              to={`/squads/${squad.id}`}
              className="flex items-center gap-4 bg-slate-50/50 p-3 rounded-2xl border border-slate-100 hover:bg-white hover:border-emerald-200 transition-all hover:shadow-md group"
            >
              <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 overflow-hidden flex items-center justify-center p-1 shrink-0">
                {squad.logoUrl ? (
                  <img src={squad.logoUrl} alt={squad.name} className="w-full h-full object-contain" />
                ) : (
                  <span className="text-xl font-black text-emerald-600 uppercase">{squad.name[0]}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-900 group-hover:text-emerald-600 truncate">{squad.name}</div>
                <div className="text-xs text-slate-400 uppercase tracking-widest">{squadPlayers.length} Players</div>
              </div>
              <svg className="w-5 h-5 text-slate-300 group-hover:text-emerald-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )
        })
      )}
    </div>
  )
}
