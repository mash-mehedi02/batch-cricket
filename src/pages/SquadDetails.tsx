/**
 * Squad Details Page - Premium Mobile-First Design
 * Tabs, mobile-optimized cards, match history with dark theme
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { squadService } from '@/services/firestore/squads'
import { tournamentService } from '@/services/firestore/tournaments'
import { playerService } from '@/services/firestore/players'
import { matchService } from '@/services/firestore/matches'
import { Player, Squad, Tournament, Match } from '@/types'
import toast from 'react-hot-toast'
import { Timestamp } from 'firebase/firestore'
import PlayerAvatar from '@/components/common/PlayerAvatar'

type Tab = 'squad' | 'matches' | 'achievement'

export default function SquadDetails() {
  const { squadId } = useParams<{ squadId: string }>()
  const [loading, setLoading] = useState(true)
  const [squad, setSquad] = useState<Squad | null>(null)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('squad')

  useEffect(() => {
    const run = async () => {
      if (!squadId) return
      setLoading(true)
      try {
        const squadData = await squadService.getById(squadId)
        if (!squadData) {
          setSquad(null)
          return
        }

        setSquad(squadData)

        // Tournament (optional)
        try {
          if (squadData.tournamentId) {
            const t = await tournamentService.getById(squadData.tournamentId)
            setTournament(t)
          }
        } catch {
          setTournament(null)
        }

        // Players
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

        // Matches
        setLoadingMatches(true)
        try {
          const squadMatches = await matchService.getBySquad(squadId)
          setMatches(squadMatches)
        } catch (err) {
          console.error('Error loading matches:', err)
        } finally {
          setLoadingMatches(false)
        }

      } catch (e) {
        console.error('Error loading squad details:', e)
        toast.error('Failed to load squad.')
        setSquad(null)
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [squadId])

  const captain = useMemo(() => {
    if (!squad?.captainId) return null
    return players.find((p) => p.id === squad.captainId) || null
  }, [players, squad?.captainId])

  const wicketKeeper = useMemo(() => {
    if (!squad?.wicketKeeperId) return null
    return players.find((p) => p.id === squad.wicketKeeperId) || null
  }, [players, squad?.wicketKeeperId])

  // Helper to safely render values
  const safeRender = (val: any) => {
    if (val instanceof Timestamp) {
      return val.toDate().getFullYear().toString()
    }
    if (typeof val === 'object' && val !== null) {
      return 'Batch'
    }
    return val
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white p-4 pt-20">
        <div className="max-w-7xl mx-auto space-y-8 animate-pulse">
          <div className="h-64 bg-slate-800/50 rounded-xl"></div>
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-slate-800/50 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!squad) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold">Squad Not Found</h2>
          <Link to="/squads" className="inline-block mt-6 px-6 py-3 bg-emerald-600 rounded-xl hover:bg-emerald-700 transition">
            Back to Squads
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      {/* Hero Banner */}
      <div className="relative h-[25vh] md:h-[35vh] overflow-hidden group">
        {squad.bannerUrl ? (
          <img
            src={squad.bannerUrl}
            alt={squad.name}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-teal-900 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-slate-950/60 to-slate-950" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 md:-mt-32 relative z-10">
        {/* Squad Identity */}
        <div className="flex flex-row items-end gap-4 md:gap-8 mb-8 md:mb-12">
          {/* Logo */}
          <div className="relative animate-in zoom-in-95 duration-700 flex-shrink-0">
            <div className="absolute inset-0 bg-emerald-500/10 rounded-2xl md:rounded-[2rem] blur-xl md:blur-2xl animate-pulse" />
            <div className="relative w-20 h-20 md:w-36 md:h-36 bg-slate-900/40 backdrop-blur-xl rounded-2xl md:rounded-[2.5rem] border-2 md:border-4 border-slate-800/50 overflow-hidden shadow-2xl flex items-center justify-center p-2 md:p-4 hover:scale-105 transition-transform duration-500">
              {squad.logoUrl ? (
                <img src={squad.logoUrl} alt={squad.name} className="w-full h-full object-contain filter drop-shadow-lg scale-[2.2] md:scale-[2.5]" />
              ) : (
                <span className="text-2xl md:text-5xl font-black text-emerald-500">{squad.name[0]}</span>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 pb-0.5 md:pb-1 animate-in slide-in-from-left-8 duration-700 delay-100 min-w-0">
            <h1 className="text-2xl md:text-6xl font-black text-white tracking-tighter mb-1 md:mb-3 drop-shadow-2xl truncate">
              {squad.name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-slate-400 text-xs md:text-base font-bold">
              <span className="flex items-center gap-1.5 text-emerald-400/90 bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-500/20">
                {safeRender(squad.batch || squad.year)}
              </span>
              {tournament?.school && (
                <div className="flex items-center gap-1.5 text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded-md border border-white/5 truncate max-w-[150px] md:max-w-xs">
                  {tournament.school}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-8 bg-slate-900/50 p-1 rounded-xl backdrop-blur-md border border-white/5 w-fit overflow-x-auto max-w-full">
          {(['squad', 'matches', 'achievement'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 md:px-6 py-2 rounded-lg text-xs md:text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* SQUAD TAB */}
          {activeTab === 'squad' && (
            <div className="space-y-8">
              {/* Summary Cards - Grid 3 Mobile */}
              <div className="grid grid-cols-3 gap-2 md:gap-6">
                {/* Total Players */}
                <div className="bg-slate-900/40 backdrop-blur-xl p-3 md:p-8 rounded-2xl md:rounded-[2rem] border border-white/5 flex flex-col items-center md:items-start text-center md:text-left">
                  <div className="text-lg md:text-3xl mb-1 md:mb-3">👥</div>
                  <div className="text-[8px] md:text-xs font-black text-slate-500 uppercase tracking-wider mb-0.5 md:mb-2 leading-tight">Players</div>
                  <div className="text-sm md:text-3xl font-black text-white">{players.length}</div>
                </div>

                {/* Captain */}
                <div className="bg-slate-900/40 backdrop-blur-xl p-3 md:p-8 rounded-2xl md:rounded-[2rem] border border-white/5 flex flex-col items-center md:items-start text-center md:text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-8 h-8 md:w-16 md:h-16 bg-yellow-500/10 rounded-bl-full md:rounded-bl-[2rem]" />
                  <div className="text-lg md:text-3xl mb-1 md:mb-3 text-yellow-500">👑</div>
                  <div className="text-[8px] md:text-xs font-black text-slate-500 uppercase tracking-wider mb-0.5 md:mb-2 leading-tight">Captain</div>
                  <div className="text-xs md:text-2xl font-black text-white truncate w-full">{captain?.name?.split(' ')[0] || 'N/A'}</div>
                </div>

                {/* Wicket Keeper */}
                <div className="bg-slate-900/40 backdrop-blur-xl p-3 md:p-8 rounded-2xl md:rounded-[2rem] border border-white/5 flex flex-col items-center md:items-start text-center md:text-left relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-8 h-8 md:w-16 md:h-16 bg-blue-500/10 rounded-bl-full md:rounded-bl-[2rem]" />
                  <div className="text-lg md:text-3xl mb-1 md:mb-3 text-blue-500">🧤</div>
                  <div className="text-[8px] md:text-xs font-black text-slate-500 uppercase tracking-wider mb-0.5 md:mb-2 leading-tight">Keeper</div>
                  <div className="text-xs md:text-2xl font-black text-white truncate w-full">{wicketKeeper?.name?.split(' ')[0] || 'N/A'}</div>
                </div>
              </div>

              {/* Player Roster */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <div className="h-4 w-1 bg-emerald-500 rounded-full" />
                  <h2 className="text-lg md:text-2xl font-black text-white">Full Squad</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {players.map((p) => (
                    <Link
                      key={p.id}
                      to={`/players/${p.id}`}
                      className="group relative bg-slate-900/40 backdrop-blur-md rounded-2xl md:rounded-[2rem] p-3 md:p-5 border border-white/5 hover:border-emerald-500/30 hover:bg-slate-900/60 transition-all duration-300"
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        {/* Player Photo */}
                        <div className="relative w-12 h-12 md:w-16 md:h-16 flex-shrink-0">
                          <div className="absolute inset-0 bg-emerald-500/10 rounded-xl md:rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="relative w-full h-full rounded-xl md:rounded-2xl border-2 border-slate-800 group-hover:border-emerald-500/50 transition-all flex items-center justify-center">
                            <PlayerAvatar
                              photoUrl={p.photoUrl || (p as any).photo}
                              name={p.name}
                              size="lg"
                              className="w-full h-full border-none"
                            />
                          </div>
                          {/* Badges */}
                          {(squad.captainId === p.id || squad.wicketKeeperId === p.id) && (
                            <div className="absolute -top-1 -right-1 flex gap-1">
                              {squad.captainId === p.id && <span className="bg-yellow-500 text-slate-950 text-[8px] font-black px-1 rounded">C</span>}
                              {squad.wicketKeeperId === p.id && <span className="bg-blue-500 text-slate-950 text-[8px] font-black px-1 rounded">WK</span>}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white group-hover:text-emerald-400 transition-colors truncate text-sm md:text-lg">
                            {p.name}
                          </h3>
                          <div className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                            {p.role}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MATCHES TAB */}
          {activeTab === 'matches' && (
            <div className="space-y-6">
              {loadingMatches ? (
                <div className="text-center py-10 text-slate-500">Loading matches...</div>
              ) : matches.length === 0 ? (
                <div className="text-center py-10 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800">
                  <div className="text-4xl mb-2">🏏</div>
                  <div className="text-slate-400 font-bold">No matches found</div>
                </div>
              ) : (
                <>
                  {/* Recent Matches */}
                  <div className="space-y-3">
                    <div className="px-1 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Recent</h3>
                    </div>
                    {matches
                      .filter(m => m.status === 'finished' || m.status === 'live')
                      .sort((a, b) => {
                        if (a.status === 'live' && b.status !== 'live') return -1
                        if (a.status !== 'live' && b.status === 'live') return 1
                        return (b.date || '').localeCompare(a.date || '')
                      })
                      .map(match => {
                        const isTeamA = match.teamAId === squad.id
                        const opponentName = isTeamA ? match.teamBName : match.teamAName
                        return (
                          <Link key={match.id} to={`/match/${match.id}`} className="block bg-slate-900/40 hover:bg-slate-800/60 border border-white/5 rounded-2xl p-4 transition-all group">
                            <div className="flex items-center justify-between mb-3">
                              <div className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${match.status === 'live' ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-emerald-500/10 text-emerald-500'
                                }`}>
                                {match.status}
                              </div>
                              <div className="text-xs text-slate-500 font-bold">{match.date}</div>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex flex-col gap-1 w-1/2">
                                <span className="text-xs text-slate-500 uppercase font-bold group-hover:text-emerald-500 transition-colors">vs {opponentName}</span>
                                <span className="text-sm font-black text-white truncate">{(match as any).result || 'Match in progress'}</span>
                              </div>
                              <div className="text-right">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">→</div>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    {matches.filter(m => m.status === 'finished' || m.status === 'live').length === 0 && (
                      <div className="text-slate-500 text-xs italic px-2">No recent matches.</div>
                    )}
                  </div>

                  {/* Upcoming Matches */}
                  <div className="space-y-3">
                    <div className="px-1 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Upcoming</h3>
                    </div>
                    {matches
                      .filter(m => (m.status as any) === 'upcoming' || (m.status as any) === 'scheduled')
                      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
                      .map(match => {
                        const isTeamA = match.teamAId === squad.id
                        const opponentName = isTeamA ? match.teamBName : match.teamAName
                        return (
                          <Link key={match.id} to={`/match/${match.id}`} className="block bg-slate-900/40 hover:bg-slate-800/60 border border-white/5 rounded-2xl p-4 transition-all group">
                            <div className="flex items-center justify-between mb-3">
                              <div className="bg-slate-700/50 text-slate-400 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded">
                                {match.status}
                              </div>
                              <div className="text-xs text-slate-500 font-bold">{match.date}</div>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-slate-500 uppercase font-bold">vs</span>
                                <span className="text-lg font-black text-white truncate">{opponentName || 'TBD'}</span>
                              </div>
                              <div className="text-right text-xs text-slate-500 italic">
                                {match.venue ? `at ${match.venue}` : 'Venue TBD'}
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    {matches.filter(m => (m.status as any) === 'upcoming' || (m.status as any) === 'scheduled').length === 0 && (
                      <div className="text-slate-500 text-xs italic px-2">No upcoming matches.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ACHIEVEMENT TAB */}
          {activeTab === 'achievement' && (
            <div className="bg-slate-900/40 rounded-2xl border border-white/5 p-8 text-center">
              <div className="text-5xl mb-4">🏆</div>
              <h3 className="text-xl font-bold text-white mb-2">Team Achievements</h3>
              <p className="text-slate-400 text-sm">
                Trophy cabinet and history coming soon.
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
