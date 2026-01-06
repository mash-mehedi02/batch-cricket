import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { Match } from '@/types'
import { SkeletonText } from '@/components/skeletons/SkeletonCard'
import PlayerLink from '@/components/PlayerLink'
import PlayerAvatar from '@/components/common/PlayerAvatar'

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
  const didDefaultTeam = useRef(false)

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
      if (candidate) {
        try {
          const s = await squadService.getById(candidate)
          if (s?.id) return s.id
        } catch {
          // ignore
        }
      }
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

  // Batting Order logic
  const { firstSide, secondSide } = (() => {
    if (!match) return { firstSide: 'A' as const, secondSide: 'B' as const }
    const tw = String((match as any).tossWinner || '').trim()
    const decRaw = String((match as any).electedTo || (match as any).tossDecision || '').trim().toLowerCase()
    if (!tw || !decRaw) return { firstSide: 'A' as const, secondSide: 'B' as const }

    const tossSide = (tw === 'teamA' || tw === (match as any).teamAId || tw === (match as any).teamASquadId) ? 'A' : 'B'
    const battedFirst = decRaw.includes('bat') ? tossSide : (tossSide === 'A' ? 'B' : 'A')
    return {
      firstSide: battedFirst as 'A' | 'B',
      secondSide: (battedFirst === 'A' ? 'B' : 'A') as 'A' | 'B'
    }
  })()

  // Default selection to first batting team once match loads
  useEffect(() => {
    if (match && !didDefaultTeam.current) {
      setSelectedTeam(firstSide)
      didDefaultTeam.current = true
    }
  }, [match, firstSide])

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

  const getPlayingAndBench = (allPlayers: any[], playingXIIds: string[]) => {
    const playing = playingXIIds.map(id => allPlayers.find(p => p.id === id)).filter(Boolean)
    const bench = allPlayers.filter(p => !playingXIIds.includes(p.id))
    return { playing, bench }
  }

  const teamAData = getPlayingAndBench(squadData.allA, teamAPlayingXI)
  const teamBData = getPlayingAndBench(squadData.allB, teamBPlayingXI)

  const renderPlayerCard = (player: any, isCaptain: boolean, isKeeper: boolean, badgeText?: string, badgeColor: string = 'text-green-500') => {
    const roleDisplay = formatRole(player)
    return (
      <div key={player.id} className="bg-white rounded-lg p-2 sm:p-4 border border-slate-200 flex items-center gap-2 sm:gap-3">
        <PlayerAvatar
          photoUrl={player.photoUrl || (player as any).photo}
          name={player.name}
          size="lg"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
            <PlayerLink playerId={player.id} playerName={player.name} className="font-bold text-slate-900 truncate text-[11px] sm:text-base" />
            {isCaptain && <span className="text-[8px] sm:text-xs text-yellow-500 font-bold">(c)</span>}
            {isKeeper && <span className="text-[8px] sm:text-xs text-green-500 font-bold">(wk)</span>}
            {badgeText && <span className={`ml-auto text-[8px] sm:text-xs font-bold ${badgeColor}`}>{badgeText}</span>}
          </div>
          <div className="text-[9px] sm:text-xs text-slate-600 mt-0.5 line-clamp-1">{roleDisplay}</div>
          <div className="text-[9px] sm:text-xs text-slate-500 mt-0.5">SR: {player.strikeRate.toFixed(1)}</div>
        </div>
      </div>
    )
  }

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
              onClick={() => setSelectedTeam(firstSide)}
              className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold transition relative ${selectedTeam === firstSide
                ? 'border-b-2 border-amber-500 text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              {firstSide === 'A' ? teamAName : teamBName}
            </button>
            <button
              onClick={() => setSelectedTeam(secondSide)}
              className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-semibold transition relative ${selectedTeam === secondSide
                ? 'border-b-2 border-amber-500 text-slate-900'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              {secondSide === 'A' ? teamAName : teamBName}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-2 sm:px-8 py-6">
        {loadingSquads && (
          <div className="mb-6 grid grid-cols-2 gap-2 sm:gap-4">
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <SkeletonText lines={2} className="text-slate-300" />
            </div>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <SkeletonText lines={2} className="text-slate-300" />
            </div>
          </div>
        )}

        {(selectedTeam === 'A' && teamAPlayingXI.length === 0) || (selectedTeam === 'B' && teamBPlayingXI.length === 0) ? (
          <div className="mb-4 bg-white border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
            Playing XI is not set yet for <span className="font-bold text-slate-900">{selectedTeam === 'A' ? teamAName : teamBName}</span>.
          </div>
        ) : null}

        {selectedTeam === 'A' ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-6">
              {teamAData.playing.map((player) =>
                renderPlayerCard(player, player.id === match.teamACaptainId, player.id === match.teamAKeeperId, 'IN ↑', 'text-green-500')
              )}
            </div>
            {teamAData.bench.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-bold text-slate-900 mb-4 px-2">On Bench</h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  {teamAData.bench.map((player) =>
                    renderPlayerCard(player, false, false, 'OUT ↓', 'text-red-400')
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-6">
              {teamBData.playing.map((player) =>
                renderPlayerCard(player, player.id === match.teamBCaptainId, player.id === match.teamBKeeperId, 'IN ↑', 'text-green-500')
              )}
            </div>
            {teamBData.bench.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-bold text-slate-900 mb-4 px-2">On Bench</h3>
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                  {teamBData.bench.map((player) =>
                    renderPlayerCard(player, false, false, 'OUT ↓', 'text-red-400')
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
