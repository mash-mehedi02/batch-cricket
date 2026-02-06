/**
 * Tournament Details Page - Redesigned for a premium, high-fidelity experience
 * Features instant series switching, clean typography, and professional layouts
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import type { Match, Tournament, Squad, Player, InningsStats } from '@/types'
import { formatTimeLabelBD, coerceToDate } from '@/utils/date.ts'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import { getMatchResultString } from '@/utils/matchWinner'
import TournamentPointsTable from '@/pages/TournamentPointsTable'
import TournamentKeyStats from '@/pages/TournamentKeyStats'

type Tab = 'overview' | 'matches' | 'teams' | 'points' | 'stats'

// Helper for mobile-optimized short names
const formatShortName = (name: string) => {
  if (!name) return '???'
  const parts = name.split(/[- ]+/).filter(Boolean)
  const label = parts[0]?.substring(0, 3).toUpperCase() || '???'
  const batch = parts[parts.length - 1]?.match(/\d+/) ? parts[parts.length - 1] : ''
  return batch ? `${label}-${batch}` : label
}

export default function TournamentDetails() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get('tab')?.toLowerCase()
    if (tab === 'matches' || tab === 'teams' || tab === 'points' || tab === 'stats') return tab as Tab
    return 'overview'
  })

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [inningsMap, setInningsMap] = useState<Map<string, { teamA: InningsStats | null; teamB: InningsStats | null }>>(new Map())
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

      try {
        // Load all tournaments for the top slider
        if (allTournaments.length === 0) {
          const allT = await tournamentService.getAll()
          setAllTournaments(allT)
        }

        setLoading(true)

        // Load current tournament
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

        setLoading(false)

        // OPTIMIZATION: Load innings ONLY for finished/live matches to calculate stats.
        // Skip upcoming matches completely.
        // Defer this to not block main thread immediately.
        setTimeout(async () => {
          const relevantMatches = ms.filter(m => {
            const s = String(m.status || '').toLowerCase()
            return s === 'live' || s === 'finished' || s === 'completed'
          })

          if (relevantMatches.length > 0) {
            const entries = await Promise.all(
              relevantMatches.map(async (m) => {
                const [a, b] = await Promise.all([
                  matchService.getInnings(m.id, 'teamA').catch(() => null),
                  matchService.getInnings(m.id, 'teamB').catch(() => null),
                ])
                return [m.id, { teamA: a, teamB: b }] as const
              })
            )
            const im = new Map<string, { teamA: InningsStats | null; teamB: InningsStats | null }>()
            entries.forEach(([id, v]) => im.set(id, v))
            setInningsMap(im)
          }
        }, 500)

      } catch (e) {
        console.error('Error loading tournament details:', e)
        setTournament(null)
        setLoading(false)
      }
    }
    run()
  }, [tournamentId, allTournaments.length])

  // Featured matches logic
  const featuredMatches = useMemo(() => {
    const parseDT = (m: any) => {
      const d0 = coerceToDate(m?.date)
      if (d0) return d0.getTime()
      return 0
    }

    const live = matches.filter(m => String(m.status || '').toLowerCase() === 'live')
    const upcoming = matches
      .filter(m => {
        const s = String(m.status || '').toLowerCase()
        return (s === 'upcoming' || s === 'scheduled' || !s) && parseDT(m) > Date.now()
      })
      .sort((a, b) => parseDT(a) - parseDT(b))

    const finished = matches
      .filter(m => {
        const s = String(m.status || '').toLowerCase()
        return s === 'finished' || s === 'completed'
      })
      .sort((a, b) => parseDT(b) - parseDT(a))

    const combined = [...live, ...upcoming, ...finished]
    const seen = new Set<string>()
    return combined.filter(m => (seen.has(m.id) ? false : (seen.add(m.id), true))).slice(0, 3)
  }, [matches])

  // Key stats
  const keyStatsTop = useMemo(() => {
    const bat = new Map<string, { id: string; name: string; team: string; runs: number; balls: number; sixes: number; sr: number }>()
    const bowl = new Map<string, { id: string; name: string; team: string; wickets: number }>()

    const getTeamName = (pid: string) => {
      const player = players.find(p => p.id === pid)
      const squad = squads.find(s => s.id === player?.squadId)
      return (squad as any)?.shortName || formatShortName(squad?.name || '') || 'Team'
    }

    // For highest score and best figures
    let highestScore: { id: string; name: string; team: string; value: string; photoUrl?: string } | null = null
    let bestFigures: { id: string; name: string; team: string; value: string; photoUrl?: string } | null = null

    let maxHS = -1
    let maxWkts = -1
    let minRuns = 9999

    inningsMap.forEach((inn) => {
      [inn.teamA, inn.teamB].filter(Boolean).forEach((i: any) => {
        // Batting
        const batters = Array.isArray(i?.batsmanStats) ? i.batsmanStats : []
        batters.forEach((b: any) => {
          const pid = String(b.batsmanId || '')
          if (!pid) return

          // Aggergate
          const runs = Number(b.runs || 0)
          const balls = Number(b.balls || 0)
          const sixes = Number(b.sixes || 0)

          const player = players.find(p => p.id === pid)
          const prev = bat.get(pid) || { id: pid, name: player?.name || b.batsmanName || 'Player', team: getTeamName(pid), runs: 0, balls: 0, sixes: 0, sr: 0 }
          prev.runs += runs
          prev.balls += balls
          prev.sixes += sixes
          bat.set(pid, prev)

          // Highest Score
          if (runs > maxHS) {
            maxHS = runs
            highestScore = {
              id: pid,
              name: player?.name || b.batsmanName || 'Player',
              team: getTeamName(pid),
              value: `${runs}${b.notOut ? '*' : ''}`
            }
          }
        })

        // Bowling
        const bowlers = Array.isArray(i?.bowlerStats) ? i.bowlerStats : []
        bowlers.forEach((bw: any) => {
          const pid = String(bw.bowlerId || '')
          if (!pid) return

          const wkts = Number(bw.wickets || 0)
          const r = Number(bw.runsConceded || 0)

          const player = players.find(p => p.id === pid)
          const prev = bowl.get(pid) || { id: pid, name: player?.name || bw.bowlerName || 'Player', team: getTeamName(pid), wickets: 0 }
          prev.wickets += wkts
          bowl.set(pid, prev)

          // Best Figures
          if (wkts > maxWkts || (wkts === maxWkts && r < minRuns)) {
            maxWkts = wkts
            minRuns = r
            bestFigures = {
              id: pid,
              name: player?.name || bw.bowlerName || 'Player',
              team: getTeamName(pid),
              value: `${wkts}/${r}`
            }
          }
        })
      })
    })

    const mostRuns = Array.from(bat.values()).sort((a, b) => b.runs - a.runs)[0] || null
    const mostWickets = Array.from(bowl.values()).sort((a, b) => b.wickets - a.wickets)[0] || null
    const mostSixes = Array.from(bat.values()).sort((a, b) => b.sixes - a.sixes)[0] || null

    // Helper to get photo URL
    const getPhoto = (pid?: string) => {
      if (!pid) return undefined
      const p = players.find(x => x.id === pid)
      return p?.photoUrl || (p as any)?.photo
    }

    return {
      mostRuns: mostRuns ? { ...mostRuns, photoUrl: getPhoto(mostRuns.id) } : null,
      mostWickets: mostWickets ? { ...mostWickets, photoUrl: getPhoto(mostWickets.id) } : null,
      mostSixes: mostSixes ? { ...mostSixes, photoUrl: getPhoto(mostSixes.id) } : null,
      bestFigures: bestFigures ? { ...bestFigures, photoUrl: getPhoto(bestFigures?.id) } : null,
      highestScore: highestScore ? { ...highestScore, photoUrl: getPhoto(highestScore?.id) } : null,
    }
  }, [inningsMap, players, squads])

  // No early return for loading to keep slider always visible
  // if (loading && !tournament) ... 

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white pb-20 transition-colors">

      {/* 1. Top Banners Slider */}
      <div className="pt-4 pb-4 overflow-x-auto no-scrollbar bg-white dark:bg-slate-950">
        <div className="flex gap-4 px-4 min-w-max">
          {allTournaments.map((t) => (
            <Link
              key={t.id}
              to={`/tournaments/${t.id}`}
              className={`relative w-36 h-48 rounded-2xl overflow-hidden border-2 transition-all ${t.id === tournamentId ? 'border-red-500 scale-105 z-10' : 'border-transparent opacity-70'}`}
            >
              {t.bannerUrl && !brokenImages[t.bannerUrl] ? (
                <img src={t.bannerUrl} alt={t.name} className="w-full h-full object-cover" onError={() => setBrokenImages(p => ({ ...p, [t.bannerUrl!]: true }))} />
              ) : (
                <div className="w-full h-full bg-slate-200 dark:bg-slate-900 flex items-center justify-center p-4">
                  <span className="text-slate-400 dark:text-slate-600 text-[10px] font-bold uppercase text-center">{t.name}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>

      {!tournament && loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-red-500 rounded-full animate-spin" />
        </div>
      ) : !tournament ? (
        <div className="text-center py-20 px-4">
          <div className="text-4xl mb-4">🏆</div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 uppercase">Series Not Found</h2>
          <Link to="/tournaments" className="inline-block px-8 py-3 bg-red-600 text-white rounded-full font-bold shadow-lg hover:bg-red-700 transition-all uppercase text-xs tracking-widest">
            Explore Series
          </Link>
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-40 bg-white dark:bg-slate-950 transition-colors shadow-sm pt-[var(--status-bar-height)]">
            {/* 2. Series Header */}
            <div className="px-5 py-4 pb-2">
              <div className="flex items-center justify-between mb-1">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-none uppercase">
                  {tournament.name}
                </h1>
                <button className="px-5 py-1.5 border border-slate-200 dark:border-white/10 rounded-full text-xs font-medium shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-all">
                  Follow
                </button>
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-xs font-normal">
                {tournament.startDate && tournament.endDate ? (
                  `${new Date(tournament.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} to ${new Date(tournament.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`
                ) : (
                  tournament.year
                )}
              </div>
            </div>

            {/* 3. Tab Navigation */}
            <div className="border-b border-slate-100 dark:border-white/5">
              <div className="max-w-4xl mx-auto px-4 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-6 py-3">
                  {(['overview', 'matches', 'teams', 'points', 'stats'] as Tab[]).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`text-sm font-bold capitalize transition-all whitespace-nowrap relative pb-2 -mb-2 ${activeTab === tab
                        ? 'text-red-500'
                        : 'text-slate-400 dark:text-slate-600'
                        }`}
                    >
                      {tab}
                      {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-500 rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Content Section */}
          <div className="max-w-4xl mx-auto px-4 pt-6">
            {activeTab === 'overview' && (
              <div className="space-y-10 pb-10">
                {/* Featured Matches */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Featured Matches</h2>
                    <button onClick={() => setActiveTab('matches')} className="text-xs font-bold text-blue-600 hover:underline">
                      All Matches
                    </button>
                  </div>
                  <div className="space-y-3">
                    {featuredMatches.length === 0 ? (
                      <div className="p-10 text-center text-slate-400 text-xs uppercase font-medium">No matches scheduled</div>
                    ) : (
                      featuredMatches.map(match => (
                        <MatchCard key={match.id} match={match} squads={squads} innings={inningsMap.get(match.id)} />
                      ))
                    )}
                  </div>
                </div>

                {/* Team Squads */}
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight mb-4">Team Squads</h2>
                  <div className="overflow-x-auto no-scrollbar -mx-4 px-4">
                    <div className="flex gap-3 min-w-max">
                      {squads.map(s => (
                        <Link
                          key={s.id}
                          to={`/squads/${s.id}`}
                          className="w-28 h-36 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-white/5 flex flex-col items-center justify-center p-4 transition-all hover:bg-white dark:hover:bg-slate-800"
                        >
                          <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center overflow-hidden mb-3 border border-slate-100 p-1">
                            {s.logoUrl ? (
                              <img src={s.logoUrl} alt={s.name} className="w-full h-full object-contain" />
                            ) : (
                              <span className="text-lg font-bold text-slate-300">{s.name[0]}</span>
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-slate-900 dark:text-white text-center uppercase tracking-tight line-clamp-2">
                            {(s as any).shortName || formatShortName(s.name)}
                          </span>
                        </Link>
                      ))}
                      {squads.length === 0 && <div className="text-slate-400 text-xs py-10">No teams registered</div>}
                    </div>
                  </div>
                </div>

                {/* Series Info */}
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight mb-4">Series Info</h2>
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden shadow-sm">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                        <tr>
                          <td className="px-6 py-4 text-slate-500">Series</td>
                          <td className="px-6 py-4 text-slate-900 dark:text-white font-bold">{tournament.name}</td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 text-slate-500">Duration</td>
                          <td className="px-6 py-4 text-slate-900 dark:text-white font-bold">
                            {tournament.startDate ? new Date(tournament.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'TBD'} - {tournament.endDate ? new Date(tournament.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'TBD'}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4 text-slate-500">Format</td>
                          <td className="px-6 py-4 text-slate-900 dark:text-white font-bold uppercase">{tournament.format}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Key Stats */}
                {/* Key Stats Grid */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Key Stats</h2>
                    <button onClick={() => setActiveTab('stats')} className="text-xs font-bold text-blue-600 hover:underline">
                      View All
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Most Runs - Wide */}
                    <div className="col-span-2">
                      <StatCard
                        title="Most Runs"
                        value={keyStatsTop.mostRuns?.runs || 0}
                        player={keyStatsTop.mostRuns?.name}
                        playerId={keyStatsTop.mostRuns?.id}
                        team={keyStatsTop.mostRuns?.team}
                        photoUrl={keyStatsTop.mostRuns?.photoUrl}
                        metric="Runs"
                        variant="large"
                      />
                    </div>

                    {/* Most Wickets - Square */}
                    <div className="col-span-1">
                      <StatCard
                        title="Most Wickets"
                        value={keyStatsTop.mostWickets?.wickets || 0}
                        player={keyStatsTop.mostWickets?.name}
                        playerId={keyStatsTop.mostWickets?.id}
                        team={keyStatsTop.mostWickets?.team}
                        photoUrl={keyStatsTop.mostWickets?.photoUrl}
                        metric="Wickets"
                        variant="square"
                      />
                    </div>

                    {/* Best Figures - Square */}
                    <div className="col-span-1">
                      <StatCard
                        title="Best Figures"
                        value={keyStatsTop.bestFigures?.value || '-'}
                        player={keyStatsTop.bestFigures?.name}
                        playerId={keyStatsTop.bestFigures?.id}
                        team={keyStatsTop.bestFigures?.team}
                        photoUrl={keyStatsTop.bestFigures?.photoUrl}
                        metric="Figures"
                        variant="square"
                      />
                    </div>

                    {/* Highest Score - Thin */}
                    <div className="col-span-2">
                      <StatCard
                        title="Highest Score"
                        value={keyStatsTop.highestScore?.value || 0}
                        player={keyStatsTop.highestScore?.name}
                        playerId={keyStatsTop.highestScore?.id}
                        team={keyStatsTop.highestScore?.team}
                        photoUrl={keyStatsTop.highestScore?.photoUrl}
                        metric="Runs"
                        variant="thin"
                      />
                    </div>

                    {/* Most Sixes - Thin */}
                    <div className="col-span-2">
                      <StatCard
                        title="Most Sixes"
                        value={keyStatsTop.mostSixes?.sixes || 0}
                        player={keyStatsTop.mostSixes?.name}
                        playerId={keyStatsTop.mostSixes?.id}
                        team={keyStatsTop.mostSixes?.team}
                        photoUrl={keyStatsTop.mostSixes?.photoUrl}
                        metric="Sixes"
                        variant="thin"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Other Tabs */}
            {activeTab === 'matches' && <TournamentMatchesTab matches={matches} squads={squads} inningsMap={inningsMap} />}
            {activeTab === 'teams' && <TournamentTeamsTab squads={squads} players={players} />}
            {activeTab === 'points' && <TournamentPointsTable embedded tournamentId={tournamentId!} matches={matches} inningsMap={inningsMap} />}
            {activeTab === 'stats' && <TournamentKeyStats embedded tournamentId={tournamentId!} matches={matches} inningsMap={inningsMap} />}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * HELPER COMPONENTS
 */

function MatchCard({ match, squads, innings }: { match: Match; squads: Squad[]; innings?: { teamA: InningsStats | null; teamB: InningsStats | null } }) {
  const status = String(match.status || '').toLowerCase()
  const isLive = status === 'live'
  const isFin = status === 'finished' || status === 'completed'

  const squadA = squads.find(s => s.id === match.teamAId)
  const squadB = squads.find(s => s.id === match.teamBId)

  const d = coerceToDate(match.date)
  const timeStr = d ? formatTimeLabelBD(d) : ''
  const dateStr = d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : ''

  const resultStr = isFin ? getMatchResultString(
    match.teamAName || 'Team A',
    match.teamBName || 'Team B',
    innings?.teamA || null,
    innings?.teamB || null,
    match
  ) : ''

  return (
    <Link
      to={`/match/${match.id}`}
      className="block bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-2xl p-5 transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center overflow-hidden bg-white p-1 shrink-0">
            {squadA?.logoUrl ? (
              <img src={squadA.logoUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-[10px] font-bold text-slate-300">{(match.teamAName || 'T')[0]}</span>
            )}
          </div>
          <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
            {squadA ? ((squadA as any).shortName || formatShortName(squadA.name)) : (match.teamAName?.substring(0, 3) || 'T1')}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center min-w-[80px]">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest">{timeStr}</span>
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">{dateStr}</span>
          {isLive && <span className="text-[8px] font-bold text-red-600 uppercase animate-pulse mt-1">Live</span>}
        </div>

        <div className="flex items-center gap-3 flex-1 justify-end">
          <span className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">
            {squadB ? ((squadB as any).shortName || formatShortName(squadB.name)) : (match.teamBName?.substring(0, 3) || 'T2')}
          </span>
          <div className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center overflow-hidden bg-white p-1 shrink-0">
            {squadB?.logoUrl ? (
              <img src={squadB.logoUrl} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="text-[10px] font-bold text-slate-300">{(match.teamBName || 'T')[0]}</span>
            )}
          </div>
        </div>
      </div>

      {isFin && resultStr && (
        <div className="mt-4 pt-4 border-t border-dashed border-slate-100 dark:border-white/5 text-center">
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">{resultStr}</p>
        </div>
      )}
    </Link>
  )
}

function StatCard({
  title,
  value,
  player,
  playerId,
  team,
  photoUrl,
  metric,
  variant = 'default'
}: {
  title: string;
  value: any;
  player?: string;
  playerId?: string;
  team?: string;
  photoUrl?: string;
  metric: string;
  variant?: 'default' | 'large' | 'square' | 'thin'
}) {
  const Container = playerId ? Link : 'div'
  const props = playerId ? { to: `/players/${playerId}` } : {}

  if (variant === 'large') {
    return (
      <Container {...props} className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-5 flex items-center justify-between border border-slate-100 dark:border-white/5 relative overflow-hidden group block hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer">
        <div className="flex items-center gap-5 relative z-10">
          <div className="w-20 h-20 rounded-full bg-white border-2 border-slate-100 dark:border-slate-800 overflow-hidden shrink-0 shadow-lg">
            <PlayerAvatar photoUrl={photoUrl || ''} name={player || 'Player'} size="full" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</span>
            <span className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate group-hover:text-red-500 transition-colors">{player || 'Player'}</span>
            <span className="text-xs font-medium text-slate-500">{team}</span>
          </div>
        </div>
        <div className="text-right relative z-10">
          <div className="text-4xl font-black text-slate-900 dark:text-white leading-none tracking-tight">{value}</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{metric}</div>
        </div>
        {/* Decorative background element */}
        <div className="absolute -right-6 -bottom-6 text-9xl text-slate-100 dark:text-slate-800/50 opacity-10 font-black select-none pointer-events-none group-hover:opacity-20 transition-opacity">
          {metric[0]}
        </div>
      </Container>
    )
  }

  if (variant === 'square') {
    return (
      <Container {...props} className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 flex flex-col items-center justify-center text-center border border-slate-100 dark:border-white/5 h-full relative overflow-hidden block hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer group">
        <div className="w-16 h-16 rounded-full bg-white border border-slate-100 dark:border-slate-800 overflow-hidden shrink-0 mb-3 shadow-md">
          <PlayerAvatar photoUrl={photoUrl || ''} name={player || 'Player'} size="full" className="w-full h-full object-cover" />
        </div>
        <div className="mb-4 w-full">
          <span className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-1">{title}</span>
          <div className="flex items-center justify-center gap-1">
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[80px] group-hover:text-red-500 transition-colors">{player?.split(' ').pop() || 'Player'}</span>
            <span className="text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400 font-bold">{team?.substring(0, 3)}</span>
          </div>
        </div>
        <div>
          <span className="text-3xl font-black text-slate-900 dark:text-white leading-none">{value}</span>
          <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{metric}</span>
        </div>
      </Container>
    )
  }

  if (variant === 'thin') {
    return (
      <Container {...props} className="bg-slate-50 dark:bg-slate-900 rounded-xl px-5 py-3 flex items-center justify-between border border-slate-100 dark:border-white/5 block hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer group">
        <div className="flex flex-col">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest mb-0.5">{title}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-red-500 transition-colors">{player || 'Player'}</span>
            <span className="text-[10px] font-bold text-slate-400">{team}</span>
          </div>
        </div>
        <div className="text-right flex flex-col items-end">
          <span className="text-xl font-black text-slate-900 dark:text-white leading-none">{value}</span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{metric}</span>
        </div>
      </Container>
    )
  }

  // Default variant
  return (
    <Container {...props} className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 flex items-center justify-between border border-slate-100 dark:border-white/5 block hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-white border border-slate-100 overflow-hidden shrink-0">
          <PlayerAvatar photoUrl={photoUrl || ''} name={player || 'Player'} className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-normal text-slate-400 uppercase tracking-widest mb-0.5">{title}</span>
          <span className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate group-hover:text-red-500 transition-colors">{player || 'Player'}</span>
          <span className="text-[11px] text-slate-500">{team}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{value}</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{metric}</div>
      </div>
    </Container>
  )
}

function TournamentMatchesTab({ matches, squads, inningsMap }: { matches: Match[]; squads: Squad[]; inningsMap: Map<string, any> }) {
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all')

  const filtered = useMemo(() => {
    let f = matches
    if (filter === 'live') f = matches.filter(m => m.status?.toLowerCase() === 'live')
    else if (filter === 'upcoming') f = matches.filter(m => (m.status?.toLowerCase() === 'upcoming' || !m.status) && coerceToDate(m.date)?.getTime()! > Date.now())
    else if (filter === 'finished') f = matches.filter(m => m.status?.toLowerCase() === 'finished' || m.status?.toLowerCase() === 'completed')

    return f.sort((a, b) => (coerceToDate(b.date)?.getTime() || 0) - (coerceToDate(a.date)?.getTime() || 0))
  }, [matches, filter])

  return (
    <div className="space-y-4 pb-10">
      <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar">
        {(['all', 'live', 'upcoming', 'finished'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-5 py-2 rounded-full text-xs font-bold uppercase transition-all ${filter === f ? 'bg-red-500 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-900 text-slate-400'}`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {filtered.map(m => <MatchCard key={m.id} match={m} squads={squads} innings={inningsMap.get(m.id)} />)}
        {filtered.length === 0 && <div className="text-center py-20 text-slate-400 text-xs">No matches in this category</div>}
      </div>
    </div>
  )
}

function TournamentTeamsTab({ squads, players }: { squads: Squad[]; players: Player[] }) {
  return (
    <div className="space-y-3 pb-10">
      {squads.map(s => {
        const pCount = players.filter(p => p.squadId === s.id).length
        return (
          <Link
            key={s.id}
            to={`/squads/${s.id}`}
            className="flex items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-white/5 hover:bg-white dark:hover:bg-slate-800 transition-all group"
          >
            <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 p-1 shrink-0 overflow-hidden">
              {s.logoUrl ? (
                <img src={s.logoUrl} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xl font-black text-red-600 uppercase">{s.name[0]}</span>
              )}
            </div>
            <div className="flex-1">
              <div className="font-bold text-slate-900 dark:text-white group-hover:text-red-500 transition-colors uppercase tracking-tight">{s.name}</div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{pCount} Players Registered</div>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 group-hover:bg-red-50 group-hover:text-red-500 transition-all">
              →
            </div>
          </Link>
        )
      })}
    </div>
  )
}
