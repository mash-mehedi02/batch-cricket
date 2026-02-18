/**
 * Squad Details Page - Premium Mobile-First Design
 * Tabs, mobile-optimized cards, match history with dark theme
 */

import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { squadService } from '@/services/firestore/squads'
import { tournamentService } from '@/services/firestore/tournaments'
import { playerService } from '@/services/firestore/players'
import { matchService } from '@/services/firestore/matches'
import { Player, Squad, Tournament, Match, InningsStats } from '@/types'
import toast from 'react-hot-toast'
import { Timestamp } from 'firebase/firestore'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import PageHeader from '@/components/common/PageHeader'
import { getMatchResultString } from '@/utils/matchWinner'
import { formatShortTeamName } from '@/utils/teamName'
import { schoolConfig } from '@/config/school'
import SquadDetailsSkeleton from '@/components/skeletons/SquadDetailsSkeleton'
import { Trophy, Medal, ChevronRight } from 'lucide-react'

type Tab = 'squad' | 'matches' | 'achievement'

export default function SquadDetails() {
  const { squadId } = useParams<{ squadId: string }>()
  const [loading, setLoading] = useState(true)
  const [squad, setSquad] = useState<Squad | null>(null)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [squadsMap, setSquadsMap] = useState<Record<string, Squad>>({})
  const [activeTab, setActiveTab] = useState<Tab>('squad')
  const [achievements, setAchievements] = useState<Array<{ type: 'winner' | 'runner-up'; tournament: Tournament }>>([])
  const [loadingAchievements, setLoadingAchievements] = useState(false)
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({})
  const liveMatchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const run = async () => {
      if (!squadId) return
      setLoading(true)
      try {
        // Load squad data first (critical)
        const squadData = await squadService.getById(squadId)
        if (!squadData) {
          setSquad(null)
          return
        }

        setSquad(squadData)

        // Load players immediately (critical for display)
        const ids = Array.isArray(squadData.playerIds) ? squadData.playerIds : []
        let loadedPlayers: Player[] = []

        if (ids.length > 0) {
          const results = await Promise.all(ids.map((id) => playerService.getById(id)))
          loadedPlayers = results.filter(Boolean) as Player[]
        } else {
          const all = await playerService.getAll()
          loadedPlayers = all.filter((p) => p.squadId === squadData.id)
        }

        const roleOrder: Record<string, number> = {
          'batsman': 1,
          'batter': 1,
          'all-rounder': 2,
          'wicket-keeper': 3,
          'bowler': 4,
          'all-rounder (captain)': 2, // backup for some data formats
        }

        loadedPlayers.sort((a, b) => {
          const rA = roleOrder[(a.role || '').toLowerCase()] || 99
          const rB = roleOrder[(b.role || '').toLowerCase()] || 99
          if (rA !== rB) return rA - rB
          return (a.name || '').localeCompare(b.name || '')
        })
        setPlayers(loadedPlayers)

        // End loading state here - page can now display!
        setLoading(false)

        // Load non-critical data in background (parallel)
        Promise.all([
          // Tournament (optional)
          (async () => {
            try {
              if (squadData.tournamentId) {
                const t = await tournamentService.getById(squadData.tournamentId)
                setTournament(t)
              }
            } catch {
              setTournament(null)
            }
          })(),

          // Matches (for matches tab)
          (async () => {
            setLoadingMatches(true)
            try {
              const allMatches = await matchService.getAll()
              const squadMatches = allMatches.filter(m =>
                m.teamAId === squadId ||
                m.teamBId === squadId ||
                (m as any).teamA === squadId ||
                (m as any).teamB === squadId
              )
              setMatches(squadMatches)
            } catch (err) {
              console.error('Error loading matches:', err)
            } finally {
              setLoadingMatches(false)
            }
          })(),

          // All Squads for logos (for match cards)
          (async () => {
            try {
              const allSq = await squadService.getAll()
              const sMap: Record<string, Squad> = {}
              allSq.forEach(s => sMap[s.id] = s)
              setSquadsMap(sMap)
            } catch (err) {
              console.error('Error loading squads map:', err)
            }
          })(),

          // Achievements (Tournaments where squad won or was runner-up)
          (async () => {
            setLoadingAchievements(true)
            try {
              const allTournaments = await tournamentService.getAll()
              const squadAchievements: Array<{ type: 'winner' | 'runner-up'; tournament: Tournament }> = []

              allTournaments.forEach(t => {
                if (t.winnerSquadId === squadId) {
                  squadAchievements.push({ type: 'winner', tournament: t })
                } else if (t.runnerUpSquadId === squadId) {
                  squadAchievements.push({ type: 'runner-up', tournament: t })
                }
              })

              setAchievements(squadAchievements.sort((a, b) => (b.tournament.year || 0) - (a.tournament.year || 0)))
            } catch (err) {
              console.error('Error loading achievements:', err)
            } finally {
              setLoadingAchievements(false)
            }
          })()
        ])

      } catch (e) {
        console.error('Error loading squad details:', e)
        toast.error('Failed to load squad.')
        setSquad(null)
        setLoading(false)
      }
    }

    run()
  }, [squadId])

  useEffect(() => {
    if (activeTab === 'matches' && !loadingMatches && matches.length > 0) {
      setTimeout(() => {
        liveMatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [activeTab, loadingMatches, matches.length])

  const captain = useMemo(() => {
    if (!squad?.captainId) return null
    return players.find((p) => p.id === squad.captainId) || null
  }, [players, squad?.captainId])

  const wicketKeeper = useMemo(() => {
    if (!squad?.wicketKeeperId) return null
    return players.find((p) => p.id === squad.wicketKeeperId) || null
  }, [players, squad?.wicketKeeperId])

  const safeRender = (val: any) => {
    if (val instanceof Timestamp) {
      return val.toDate().getFullYear().toString()
    }
    if (typeof val === 'object' && val !== null) {
      return 'Batch'
    }
    return val
  }


  const handleImgError = (url: string) => {
    setBrokenImages(prev => ({ ...prev, [url]: true }))
  }

  const SquadMatchCard = ({ match: initialMatch }: { match: Match }) => {
    const [match, setMatch] = useState<Match>(initialMatch)
    const [scoreA, setScoreA] = useState<InningsStats | null>(null)
    const [scoreB, setScoreB] = useState<InningsStats | null>(null)
    const [scoreASO, setScoreASO] = useState<InningsStats | null>(null)
    const [scoreBSO, setScoreBSO] = useState<InningsStats | null>(null)

    const status = String(match.status || '').toLowerCase()
    const isLive = status === 'live'
    const isFin = status === 'finished' || status === 'completed'
    const dStr = match.date instanceof Timestamp
      ? match.date.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : 'TBD'

    useEffect(() => {
      if (!isLive && !isFin) return

      // Subscribe to match document for latest resultSummary and status
      const unsubMatch = matchService.subscribeToMatch(initialMatch.id, (updatedMatch) => {
        if (updatedMatch) setMatch(updatedMatch)
      })

      // Always subscribe to innings for the most accurate data (source of truth)
      const unsubA = matchService.subscribeToInnings(initialMatch.id, 'teamA', (data) => {
        if (data) setScoreA(data)
      })
      const unsubB = matchService.subscribeToInnings(initialMatch.id, 'teamB', (data) => {
        if (data) setScoreB(data)
      })
      const unsubASO = matchService.subscribeToInnings(initialMatch.id, 'teamA_super', (data) => {
        if (data) setScoreASO(data)
      })
      const unsubBSO = matchService.subscribeToInnings(initialMatch.id, 'teamB_super', (data) => {
        if (data) setScoreBSO(data)
      })

      return () => {
        unsubMatch(); unsubA(); unsubB(); unsubASO(); unsubBSO();
      }
    }, [initialMatch.id, isLive, isFin])

    const getS = (id: 'teamA' | 'teamB') => {
      const liveScore = id === 'teamA' ? scoreA : scoreB
      if (liveScore) {
        return {
          r: Number(liveScore.totalRuns || 0),
          w: Number(liveScore.totalWickets || 0),
          o: String(liveScore.overs || '0.0')
        }
      }

      const p = id === 'teamA' ? 'teamA' : 'teamB'
      const fromDoc = match.score?.[id]
      const r = Number(fromDoc?.runs ?? (match as any)[`${p}Runs`] ?? 0)
      const w = Number(fromDoc?.wickets ?? (match as any)[`${p}Wickets`] ?? 0)
      const o = String(fromDoc?.overs ?? (match as any)[`${p}Overs`] ?? '0.0')
      return { r, w, o }
    }

    const sA = getS('teamA'), sB = getS('teamB')

    // UI Helpers for Logos
    const teamAData = squadsMap[match.teamAId || (match as any).teamA]
    const teamBData = squadsMap[match.teamBId || (match as any).teamB]
    const tALogo = (match as any).teamALogoUrl || teamAData?.logoUrl
    const tBLogo = (match as any).teamBLogoUrl || teamBData?.logoUrl

    return (
      <Link
        to={`/match/${match.id}`}
        className={`block group bg-white border rounded-[1.2rem] overflow-hidden transition-all duration-300 active:scale-[0.98] ${isLive ? 'border-red-500/30 shadow-md shadow-red-500/5' : 'border-slate-100 shadow-sm'
          } mb-3`}
      >
        <div className={`px-4 py-2 flex items-center justify-between border-b ${isLive ? 'bg-red-50/50 border-red-100/50' : 'bg-slate-50 border-slate-100'}`}>
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
          <div className="flex items-center justify-between gap-6">
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm shrink-0 overflow-hidden group-hover:scale-110 transition-transform relative">
                    {tALogo && !brokenImages[tALogo] ? (
                      <img src={tALogo} onError={() => handleImgError(tALogo)} className="w-full h-full object-contain p-1" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-base font-black uppercase">
                        {(match.teamAName || 'T')[0]}
                      </div>
                    )}
                  </div>
                  <span className="text-[18px] font-black text-slate-900 tracking-tight leading-none">{formatShortTeamName(match.teamAName)}</span>
                </div>
                {(isLive || isFin) && (
                  <div className="flex flex-col items-end">
                    <div className="flex flex-col items-end tabular-nums">
                      <span className="text-[17px] font-black text-slate-900 leading-none">{sA.r}/{sA.w}</span>
                      <span className="text-[10px] font-bold text-slate-500 mt-0.5">{sA.o} Ov</span>
                    </div>
                    {scoreASO && (Number(scoreASO.totalRuns || 0) > 0 || Number(scoreASO.totalWickets || 0) > 0) && (
                      <div className="text-[9px] font-black text-amber-600 bg-amber-50 px-1 rounded-sm border border-amber-100 -mt-0.5">
                        S.O: {scoreASO.totalRuns}/{scoreASO.totalWickets}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm shrink-0 overflow-hidden group-hover:scale-110 transition-transform relative">
                    {tBLogo && !brokenImages[tBLogo] ? (
                      <img src={tBLogo} onError={() => handleImgError(tBLogo)} className="w-full h-full object-contain p-1" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-500 to-pink-600 text-white text-base font-black uppercase">
                        {(match.teamBName || 'T')[0]}
                      </div>
                    )}
                  </div>
                  <span className="text-[18px] font-black text-slate-900 tracking-tight leading-none">{formatShortTeamName(match.teamBName)}</span>
                </div>
                {(isLive || isFin) ? (
                  <div className="flex flex-col items-end">
                    <div className="flex flex-col items-end tabular-nums">
                      <span className="text-[17px] font-black text-slate-900 leading-none">{sB.r}/{sB.w}</span>
                      <span className="text-[10px] font-bold text-slate-500 mt-0.5">{sB.o} Ov</span>
                    </div>
                    {scoreBSO && (Number(scoreBSO.totalRuns || 0) > 0 || Number(scoreBSO.totalWickets || 0) > 0) && (
                      <div className="text-[9px] font-black text-amber-600 bg-amber-50 px-1 rounded-sm border border-amber-100 -mt-0.5">
                        S.O: {scoreBSO.totalRuns}/{scoreBSO.totalWickets}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 uppercase tracking-tighter">Scheduled</span>
                )}
              </div>
            </div>

            {isLive && (
              <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex flex-col items-center justify-center shadow-lg shadow-red-500/20 active:scale-95 transition-all">
                <span className="text-[9px] font-black uppercase">Live</span>
              </div>
            )}
          </div>

          {(isLive || isFin) && (
            <div className={`mt-4 pt-4 border-t flex flex-col gap-2 ${isLive ? 'border-red-50' : 'border-slate-50'}`}>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className={`text-[11px] font-black uppercase tracking-wider ${isLive ? 'text-slate-700' : 'text-amber-500'}`}>
                  {isLive ? 'Match in progress' : (() => {
                    if (match.resultSummary) return match.resultSummary.toUpperCase();
                    const result = getMatchResultString(
                      match.teamAName,
                      match.teamBName,
                      scoreA,
                      scoreB,
                      match,
                      scoreASO,
                      scoreBSO
                    );
                    return result ? result.toUpperCase() : 'MATCH COMPLETED';
                  })()}
                </span>
              </div>
            </div>
          )}
        </div>
      </Link>
    )
  }

  if (loading) {
    return <SquadDetailsSkeleton />
  }

  if (!squad) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold">Squad Not Found</h2>
          <Link to="/squads" className="inline-block mt-6 px-6 py-3 bg-emerald-600 rounded-xl">
            Back to Squads
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#050B18] text-slate-900 dark:text-white pb-20 transition-colors duration-300">
      <PageHeader title={squad.name} subtitle={`Batch ${squad.batch || squad.year}`} />

      <div className="relative h-[20vh] md:h-[30vh] overflow-hidden bg-slate-100 dark:bg-slate-900">
        {squad.bannerUrl && !brokenImages[squad.bannerUrl] ? (
          <img src={squad.bannerUrl} onError={() => handleImgError(squad.bannerUrl || '')} alt={squad.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-200 dark:from-slate-800 via-emerald-50 dark:via-emerald-900/10 to-slate-100 dark:to-slate-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#050B18] via-white/50 dark:via-[#050B18]/50 to-transparent" />
      </div>

      {/* Sticky Header Section */}
      <div className="sticky top-[var(--status-bar-height)] z-40 bg-white/95 dark:bg-[#050B18]/95 backdrop-blur-md border-b border-slate-100 dark:border-white/5 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4 mb-3">
            {/* Compact Logo */}
            <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl border-2 border-white dark:border-slate-800 shadow-lg overflow-hidden flex items-center justify-center shrink-0 relative">
              {squad.logoUrl && !brokenImages[squad.logoUrl] ? (
                <img src={squad.logoUrl} onError={() => handleImgError(squad.logoUrl || '')} alt={squad.name} className="w-full h-full object-contain p-1" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xl font-black uppercase">
                  {squad.name[0]}
                </div>
              )}
            </div>

            {/* Squad Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1 truncate">
                {squad.name}
              </h1>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">
                  Batch {safeRender(squad.batch || squad.year)}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl w-fit">
            {(['squad', 'matches', 'achievement'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto px-4 pt-6">

        {activeTab === 'squad' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-2 sm:gap-3">
              {players.map(p => (
                <Link key={p.id} to={`/players/${p.id}`} className="flex items-center gap-2 sm:gap-4 bg-slate-50/50 dark:bg-slate-900/40 p-2 sm:p-3 rounded-2xl border border-slate-100 dark:border-white/5 hover:bg-white dark:hover:bg-slate-800 hover:border-emerald-200 dark:hover:border-emerald-500/30 transition-all hover:shadow-md group relative">
                  <PlayerAvatar photoUrl={p.photoUrl || (p as any).photo} name={p.name} size="sm" className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 truncate text-[10px] sm:text-base">
                        {p.name}
                      </span>
                      {squad.captainId === p.id && (
                        <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[7px] sm:text-[9px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">
                          C
                        </span>
                      )}
                      {squad.wicketKeeperId === p.id && (
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[7px] sm:text-[9px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">
                          WK
                        </span>
                      )}
                    </div>
                    <div className="text-[7px] sm:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">{p.role}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'matches' && (
          <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {loadingMatches ? (
              <div className="text-center py-10 text-slate-400 font-bold uppercase tracking-widest text-[10px]">Loading Matches...</div>
            ) : matches.length === 0 ? (
              <div className="text-center py-10 text-slate-400">No matches found.</div>
            ) : (
              <div className="flex flex-col">
                {(() => {
                  const fin = matches.filter(m => {
                    const s = String(m.status || '').toLowerCase()
                    return s === 'finished' || s === 'completed'
                  }).sort((a, b) => {
                    const tA = a.date instanceof Timestamp ? a.date.toDate().getTime() : 0
                    const tB = b.date instanceof Timestamp ? b.date.toDate().getTime() : 0
                    return tA - tB
                  })
                  if (fin.length === 0) return null
                  return (
                    <div className="space-y-3 mb-8">
                      <div className="px-1 flex items-center gap-2 mb-2">
                        <div className="h-3 w-0.5 bg-slate-300 rounded-full" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Finished Matches</span>
                      </div>
                      {fin.map(m => <SquadMatchCard key={m.id} match={m} />)}
                    </div>
                  )
                })()}

                {(() => {
                  const live = matches.filter(m => String(m.status || '').toLowerCase() === 'live')
                  if (live.length === 0) return null
                  return (
                    <div ref={liveMatchRef} className="space-y-3 mb-8 scroll-mt-20">
                      <div className="px-1 flex items-center gap-2 mb-2">
                        <div className="h-3 w-0.5 bg-red-500 rounded-full" />
                        <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1.5">
                          Live Now <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        </span>
                      </div>
                      {live.map(m => <SquadMatchCard key={m.id} match={m} />)}
                    </div>
                  )
                })()}

                {(() => {
                  const up = matches.filter(m => {
                    const s = String(m.status || '').toLowerCase()
                    return s === 'upcoming' || s === 'scheduled' || !s
                  }).sort((a, b) => {
                    const tA = a.date instanceof Timestamp ? a.date.toDate().getTime() : 0
                    const tB = b.date instanceof Timestamp ? b.date.toDate().getTime() : 0
                    return tA - tB
                  })
                  if (up.length === 0) return null
                  return (
                    <div className="space-y-3">
                      <div className="px-1 flex items-center gap-2 mb-2">
                        <div className="h-3 w-0.5 bg-blue-500 rounded-full" />
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Upcoming Matches</span>
                      </div>
                      {up.map(m => <SquadMatchCard key={m.id} match={m} />)}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {activeTab === 'achievement' && (
          <div className="space-y-6 animate-in fade-in duration-500 pb-10">
            {loadingAchievements ? (
              <div className="text-center py-20">
                <div className="w-10 h-10 border-4 border-slate-200 dark:border-slate-800 border-t-amber-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Polishing trophies...</p>
              </div>
            ) : achievements.length === 0 ? (
              <div className="bg-slate-50 dark:bg-white/[0.03] rounded-3xl p-16 text-center border border-slate-100 dark:border-white/5 shadow-sm">
                <div className="text-5xl mb-6 grayscale opacity-30">🏆</div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">The quest for glory...</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto uppercase tracking-widest font-black text-[10px]">No historical achievements recorded for this squad yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {achievements.map((ach, idx) => (
                  <Link
                    key={ach.tournament.id + idx}
                    to={`/tournaments/${ach.tournament.id}`}
                    className={`relative overflow-hidden group p-6 rounded-[2rem] border transition-all duration-300 shadow-lg hover:shadow-2xl ${ach.type === 'winner'
                      ? 'bg-gradient-to-br from-amber-500 to-amber-600 border-amber-400 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-white/10 text-slate-900 dark:text-white'
                      }`}
                  >
                    {/* Background Icon Decoration */}
                    {ach.type === 'winner' ? (
                      <Trophy size={100} className="absolute -bottom-6 -right-6 opacity-10 -rotate-12 group-hover:scale-110 transition-transform" />
                    ) : (
                      <Medal size={100} className="absolute -bottom-6 -right-6 opacity-[0.03] dark:opacity-[0.05] -rotate-12 group-hover:scale-110 transition-transform" />
                    )}

                    <div className="relative flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${ach.type === 'winner'
                            ? 'bg-white/20 text-white'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-500'
                            }`}>
                            {ach.tournament.year}
                          </span>
                          <span className={`${ach.type === 'winner' ? 'text-white/80' : 'text-slate-400'}`}>
                            <Trophy size={14} className={ach.type === 'winner' ? 'fill-white' : 'fill-amber-500'} />
                          </span>
                        </div>

                        <h3 className="text-xl font-black tracking-tight mb-1">{ach.tournament.name}</h3>
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${ach.type === 'winner' ? 'bg-white' : 'bg-amber-500'}`} />
                          <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${ach.type === 'winner' ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`}>
                            {ach.type === 'winner' ? 'Tournament Champions' : 'Runners Up'}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 w-16 h-16 bg-white rounded-2xl p-1 shadow-inner relative overflow-hidden group-hover:scale-110 transition-transform">
                        <img
                          src={ach.tournament.logoUrl || '/placeholder-tournament.png'}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>

                    <div className={`mt-6 pt-4 border-t flex items-center justify-between ${ach.type === 'winner' ? 'border-white/20' : 'border-slate-100 dark:border-white/5'}`}>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${ach.type === 'winner' ? 'text-white/70' : 'text-slate-400'}`}>
                        Hall of Fame Member
                      </span>
                      <div className="flex items-center gap-1 group-hover:gap-2 transition-all">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${ach.type === 'winner' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          View Series
                        </span>
                        <ChevronRight size={14} className={ach.type === 'winner' ? 'text-white' : 'text-emerald-600'} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
