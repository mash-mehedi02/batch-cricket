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
import { schoolConfig } from '@/config/school'
import SquadDetailsSkeleton from '@/components/skeletons/SquadDetailsSkeleton'

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

        loadedPlayers.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
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

  const formatShortName = (name: string) => {
    if (!name) return '???'
    const parts = name.split(/[- ]+/).filter(Boolean)
    const label = parts[0]?.substring(0, 3).toUpperCase() || '???'
    const batch = parts[parts.length - 1]?.match(/\d+/) ? parts[parts.length - 1] : ''
    return batch ? `${label}-${batch}` : label
  }

  const handleImgError = (url: string) => {
    setBrokenImages(prev => ({ ...prev, [url]: true }))
  }

  const SquadMatchCard = ({ match: initialMatch }: { match: Match }) => {
    const [match, setMatch] = useState<Match>(initialMatch)
    const [scoreA, setScoreA] = useState<InningsStats | null>(null)
    const [scoreB, setScoreB] = useState<InningsStats | null>(null)

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

      return () => {
        unsubMatch()
        unsubA()
        unsubB()
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
                  <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-black text-emerald-600 shadow-sm shrink-0 overflow-hidden group-hover:scale-110 transition-transform">
                    {tALogo && !brokenImages[tALogo] ? (
                      <img src={tALogo} onError={() => handleImgError(tALogo)} className="w-full h-full object-contain p-1" alt="" />
                    ) : (
                      <span className="uppercase text-lg">{(match.teamAName || 'T')[0]}</span>
                    )}
                  </div>
                  <span className="text-[15px] font-black text-slate-900 tracking-tight leading-none">{formatShortName(match.teamAName)}</span>
                </div>
                {(isLive || isFin) && (
                  <div className="flex flex-col items-end tabular-nums">
                    <span className="text-[17px] font-black text-slate-900 leading-none">{sA.r}/{sA.w}</span>
                    <span className="text-[10px] font-bold text-slate-500 mt-0.5">{sA.o} Ov</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shadow-sm shrink-0 overflow-hidden group-hover:scale-110 transition-transform">
                    {tBLogo && !brokenImages[tBLogo] ? (
                      <img src={tBLogo} onError={() => handleImgError(tBLogo)} className="w-full h-full object-contain p-1" alt="" />
                    ) : (
                      <span className="uppercase text-lg">{(match.teamBName || 'T')[0]}</span>
                    )}
                  </div>
                  <span className="text-[15px] font-black text-slate-900 tracking-tight leading-none">{formatShortName(match.teamBName)}</span>
                </div>
                {(isLive || isFin) ? (
                  <div className="flex flex-col items-end tabular-nums">
                    <span className="text-[17px] font-black text-slate-900 leading-none">{sB.r}/{sB.w}</span>
                    <span className="text-[10px] font-bold text-slate-500 mt-0.5">{sB.o} Ov</span>
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
                    // 1. Prefer explicit result summary if available
                    if (match.resultSummary) return match.resultSummary.toUpperCase();

                    // 2. Exact match winner utility (Mirroring MatchLive)
                    const result = getMatchResultString(
                      match.teamAName,
                      match.teamBName,
                      scoreA,
                      scoreB,
                      match
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
    <div className="min-h-screen bg-white text-slate-900 pb-20">
      <PageHeader title={squad.name} subtitle={`Batch ${squad.batch || squad.year}`} />

      <div className="relative h-[20vh] md:h-[30vh] overflow-hidden bg-slate-100">
        {squad.bannerUrl && !brokenImages[squad.bannerUrl] ? (
          <img src={squad.bannerUrl} onError={() => handleImgError(squad.bannerUrl || '')} alt={squad.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-200 via-emerald-50 to-slate-100" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/50 to-transparent" />
      </div>

      {/* Sticky Header Section */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-4 mb-3">
            {/* Compact Logo */}
            <div className="w-12 h-12 bg-white rounded-2xl border-2 border-white shadow-lg overflow-hidden flex items-center justify-center p-1 shrink-0">
              {squad.logoUrl && !brokenImages[squad.logoUrl] ? (
                <img src={squad.logoUrl} onError={() => handleImgError(squad.logoUrl || '')} alt={squad.name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-xl font-black text-emerald-600 uppercase">{squad.name[0]}</span>
              )}
            </div>

            {/* Squad Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight leading-none mb-1 truncate">
                {squad.name}
              </h1>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">
                  Batch {safeRender(squad.batch || squad.year)}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 p-1 bg-slate-50 border border-slate-200 rounded-xl w-fit">
            {(['squad', 'matches', 'achievement'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
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
                <Link key={p.id} to={`/players/${p.id}`} className="flex items-center gap-2 sm:gap-4 bg-slate-50/50 p-2 sm:p-3 rounded-2xl border border-slate-100 hover:bg-white hover:border-emerald-200 transition-all hover:shadow-md group relative">
                  <PlayerAvatar photoUrl={p.photoUrl || (p as any).photo} name={p.name} size="sm" className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 group-hover:text-emerald-600 truncate text-[10px] sm:text-base">
                        {p.name}
                      </span>
                      {squad.captainId === p.id && (
                        <span className="bg-amber-100 text-amber-700 text-[7px] sm:text-[9px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">
                          C
                        </span>
                      )}
                      {squad.wicketKeeperId === p.id && (
                        <span className="bg-blue-100 text-blue-700 text-[7px] sm:text-[9px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">
                          WK
                        </span>
                      )}
                    </div>
                    <div className="text-[7px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{p.role}</div>
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
          <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-100 animate-in fade-in duration-500">
            <div className="text-5xl mb-4">🏆</div>
            <div className="font-bold text-slate-400 uppercase tracking-widest text-xs">Achievement History Coming Soon</div>
          </div>
        )}
      </div>
    </div>
  )
}
