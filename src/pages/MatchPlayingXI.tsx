/**
 * Playing XI Page
 * Display playing XI for both teams
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { Match } from '@/types'
import { SkeletonText } from '@/components/skeletons/SkeletonCard'
import PlayerLink from '@/components/PlayerLink'

function getInitials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatRole(player: any): string {
  const role = String(player.role || '').toLowerCase()
  const batting = String(player.battingStyle || '').toLowerCase()
  const bowling = String(player.bowlingStyle || '').toLowerCase()

  if (role === 'batsman' || role === 'batter') {
    const side = batting.includes('left') ? 'LHB' : 'RHB'
    return `${side} Batter`
  }
  if (role === 'bowler') {
    if (bowling) {
      if (bowling.includes('fast')) return 'Pacer'
      if (bowling.includes('medium')) return 'Medium Pacer'
      if (bowling.includes('spin')) {
        if (bowling.includes('leg')) return 'Leg Spinner'
        if (bowling.includes('off')) return 'Off Spinner'
        return 'Spinner'
      }
      return bowling.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
    }
    return 'Bowler'
  }
  if (role === 'all-rounder') return 'All Rounder'
  if (role === 'wicket-keeper' || role === 'wk') return 'WK-Batter'

  return role ? (role.charAt(0).toUpperCase() + role.slice(1)) : 'Player'
}

export default function MatchPlayingXI() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState<'A' | 'B'>('A')
  const [squadData, setSquadData] = useState<{ allA: any[], allB: any[] }>({ allA: [], allB: [] })
  const [loadingSquads, setLoadingSquads] = useState(false)

  useEffect(() => {
    if (!matchId) return

    matchService.getById(matchId).then((matchData) => {
      if (matchData) {
        setMatch(matchData)
        setLoading(false)
      } else {
        setLoading(false)
      }
    }).catch((error) => {
      console.error('Error loading match:', error)
      setLoading(false)
    })

    const unsubscribe = matchService.subscribeToMatch(matchId, (matchData) => {
      if (matchData) setMatch(matchData)
    })

    return () => unsubscribe()
  }, [matchId])

  useEffect(() => {
    const resolveSquadId = async (candidate?: string, nameFallback?: string): Promise<string | null> => {
      // Try as ID
      if (candidate) {
        try {
          const s = await squadService.getById(candidate)
          if (s?.id) return s.id
        } catch {
          // ignore
        }
      }
      // Try by name (legacy matches stored name instead of ID)
      const name = nameFallback || candidate
      if (name) {
        const list = await squadService.getByName(name)
        if (list?.[0]?.id) return list[0].id
      }
      return null
    }

    const toUiPlayers = (players: any[]) => {
      return (players || [])
        .map((player: any) => {
          const stats = player.stats || {}
          const balls = Number(stats.balls || stats.ballsFaced || 0)
          const runs = Number(stats.runs || stats.runsScored || 0)
          const strikeRate = balls > 0 ? (runs / balls) * 100 : 0
          return {
            id: player.id,
            name: player.name || 'Player',
            role: player.role || '',
            photoUrl: player.photoUrl,
            photo: (player as any).photo,
            battingStyle: player.battingStyle,
            bowlingStyle: player.bowlingStyle,
            strikeRate,
          }
        })
        .sort((a: any, b: any) => (a?.name || '').localeCompare(b?.name || ''))
    }

    const loadSquads = async () => {
      if (!match) return

      try {
        setLoadingSquads(true)
        const teamAName = match.teamAName || (match as any).teamA || ''
        const teamBName = match.teamBName || (match as any).teamB || ''
        const squadAId = await resolveSquadId((match as any).teamASquadId || (match as any).teamAId || (match as any).teamA, teamAName)
        const squadBId = await resolveSquadId((match as any).teamBSquadId || (match as any).teamBId || (match as any).teamB, teamBName)

        const [playersA, playersB] = await Promise.all([
          squadAId
            ? playerService.getBySquad(squadAId).catch(async () => {
              const all = await playerService.getAll()
              return all.filter((p: any) => p.squadId === squadAId)
            })
            : Promise.resolve([]),
          squadBId
            ? playerService.getBySquad(squadBId).catch(async () => {
              const all = await playerService.getAll()
              return all.filter((p: any) => p.squadId === squadBId)
            })
            : Promise.resolve([]),
        ])

        setSquadData({
          allA: toUiPlayers(playersA as any[]),
          allB: toUiPlayers(playersB as any[]),
        })
      } catch (error) {
        console.error('Error loading squads/players:', error)
        setSquadData({ allA: [], allB: [] })
      } finally {
        setLoadingSquads(false)
      }
    }

    loadSquads()
  }, [match])

  // NOW conditional returns are safe (all hooks are called)
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-slate-50 flex items-center justify-center">
        <div className="text-center text-slate-900">
          <div className="text-xl mb-4">Loading...</div>
        </div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white to-slate-50 flex items-center justify-center">
        <div className="text-center text-slate-900">
          <p className="text-slate-600 mb-4">Match not found</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  const teamAName = match.teamAName || (match as any).teamA || 'Team A'
  const teamBName = match.teamBName || (match as any).teamB || 'Team B'
  const teamAPlayingXI = match.teamAPlayingXI || []
  const teamBPlayingXI = match.teamBPlayingXI || []

  // Helper function (not a hook)
  const getPlayingAndBench = (allPlayers: any[], playingXIIds: string[]) => {
    const playing = playingXIIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean)
    const bench = allPlayers.filter(p => !playingXIIds.includes(p.id))
    return { playing, bench }
  }

  const teamAData = getPlayingAndBench(squadData.allA, teamAPlayingXI)
  const teamBData = getPlayingAndBench(squadData.allB, teamBPlayingXI)

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-slate-50 text-slate-900">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="text-slate-700 hover:text-slate-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <h1 className="text-2xl font-bold">Playing XI</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            <button
              onClick={() => setSelectedTeam('A')}
              className={`px-6 py-3 text-sm font-semibold transition relative ${selectedTeam === 'A'
                ? 'border-b-2 border-amber-500 text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              {teamAName}
            </button>
            <button
              onClick={() => setSelectedTeam('B')}
              className={`px-6 py-3 text-sm font-semibold transition relative ${selectedTeam === 'B'
                ? 'border-b-2 border-amber-500 text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              {teamBName}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loadingSquads ? (
          <div className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <SkeletonText lines={3} className="text-slate-300" />
              </div>
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <SkeletonText lines={3} className="text-slate-300" />
              </div>
            </div>
          </div>
        ) : null}

        {selectedTeam === 'A' && teamAPlayingXI.length === 0 ? (
          <div className="mb-4 bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
            Playing XI is not set yet for <span className="font-bold text-slate-900">{teamAName}</span>.
          </div>
        ) : null}
        {selectedTeam === 'B' && teamBPlayingXI.length === 0 ? (
          <div className="mb-4 bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
            Playing XI is not set yet for <span className="font-bold text-slate-900">{teamBName}</span>.
          </div>
        ) : null}

        {selectedTeam === 'A' ? (
          <>
            {/* Main Playing XI - 2 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {teamAData.playing.map((player) => {
                const isCaptain = player.id === match.teamACaptainId
                const isKeeper = player.id === match.teamAKeeperId
                const roleDisplay = formatRole(player)

                return (
                  <div key={player.id} className="bg-white rounded-lg p-4 border border-slate-200 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden border border-slate-100 relative">
                      <span className="text-slate-900 text-sm font-bold">
                        {getInitials(player.name)}
                      </span>
                      {(player.photoUrl || (player as any).photo) && (
                        <img
                          src={player.photoUrl || (player as any).photo}
                          alt={player.name}
                          className="absolute inset-0 w-full h-full rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PlayerLink playerId={player.id} playerName={player.name} className="font-semibold text-slate-900 truncate" />
                        {isCaptain && <span className="text-xs text-yellow-400 font-bold">(c)</span>}
                        {isKeeper && <span className="text-xs text-green-400 font-bold">(wk)</span>}
                        <span className="ml-auto text-xs text-green-400 font-bold">IN ↑</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">{roleDisplay}</div>
                      <div className="text-xs text-slate-500 mt-1">SR: {player.strikeRate.toFixed(2)}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* On Bench Section */}
            {teamAData.bench.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-bold text-slate-900 mb-4">On Bench</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {teamAData.bench.map((player) => {
                    const roleDisplay = formatRole(player)

                    return (
                      <div key={player.id} className="bg-white rounded-lg p-4 border border-slate-200 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                          {player.photoUrl ? (
                            <img src={player.photoUrl} alt={player.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className="text-slate-900 text-sm font-bold">
                              {getInitials(player.name)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <PlayerLink playerId={player.id} playerName={player.name} className="font-semibold text-slate-900 truncate" />
                            <span className="ml-auto text-xs text-red-400 font-bold">OUT ↓</span>
                          </div>
                          <div className="text-xs text-slate-600 mt-1">{roleDisplay}</div>
                          <div className="text-xs text-slate-500 mt-1">SR: {player.strikeRate.toFixed(2)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Main Playing XI - 2 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {teamBData.playing.map((player) => {
                const isCaptain = player.id === match.teamBCaptainId
                const isKeeper = player.id === match.teamBKeeperId
                const roleDisplay = formatRole(player)

                return (
                  <div key={player.id} className="bg-white rounded-lg p-4 border border-slate-200 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 overflow-hidden border border-slate-100 relative">
                      <span className="text-slate-900 text-sm font-bold">
                        {getInitials(player.name)}
                      </span>
                      {(player.photoUrl || (player as any).photo) && (
                        <img
                          src={player.photoUrl || (player as any).photo}
                          alt={player.name}
                          className="absolute inset-0 w-full h-full rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PlayerLink playerId={player.id} playerName={player.name} className="font-semibold text-slate-900 truncate" />
                        {isCaptain && <span className="text-xs text-yellow-400 font-bold">(c)</span>}
                        {isKeeper && <span className="text-xs text-green-400 font-bold">(wk)</span>}
                        <span className="ml-auto text-xs text-green-400 font-bold">IN ↑</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1">{roleDisplay}</div>
                      <div className="text-xs text-slate-500 mt-1">SR: {player.strikeRate.toFixed(2)}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* On Bench Section */}
            {teamBData.bench.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-bold text-slate-900 mb-4">On Bench</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {teamBData.bench.map((player) => {
                    const roleDisplay = formatRole(player)

                    return (
                      <div key={player.id} className="bg-white rounded-lg p-4 border border-slate-200 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                          {player.photoUrl ? (
                            <img src={player.photoUrl} alt={player.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className="text-slate-900 text-sm font-bold">
                              {getInitials(player.name)}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <PlayerLink playerId={player.id} playerName={player.name} className="font-semibold text-slate-900 truncate" />
                            <span className="ml-auto text-xs text-red-400 font-bold">OUT ↓</span>
                          </div>
                          <div className="text-xs text-slate-600 mt-1">{roleDisplay}</div>
                          <div className="text-xs text-slate-500 mt-1">SR: {player.strikeRate.toFixed(2)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
