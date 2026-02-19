import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { Match } from '@/types'
import { formatShortTeamName } from '@/utils/teamName'
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

export default function MatchPlayingXI({ compact = false }: { compact?: boolean }) {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState<'A' | 'B'>('A')
  const [squadData, setSquadData] = useState<{ allA: any[], allB: any[] }>({ allA: [], allB: [] })
  const [prevXIs, setPrevXIs] = useState<{ a: string[], b: string[] }>({ a: [], b: [] })
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

    const fetchPrevXI = async (squadId: string, currentMatchId: string): Promise<string[]> => {
      try {
        const matches = await matchService.getBySquad(squadId)
        // Filter out current match and sort to find the most recent one BEFORE current
        // getBySquad is already descending by date
        const otherMatches = matches.filter(m => m.id !== currentMatchId)
        if (otherMatches.length === 0) return []

        const lastMatch = otherMatches[0]
        const isSideA = (lastMatch as any).teamAId === squadId || (lastMatch as any).teamASquadId === squadId || (lastMatch as any).teamA === squadId
        return isSideA ? (lastMatch.teamAPlayingXI || []) : (lastMatch.teamBPlayingXI || [])
      } catch (e) {
        console.warn('Failed to fetch prev XI:', e)
        return []
      }
    }

    const loadSquads = async () => {
      if (!match) return

      try {
        setLoadingSquads(true)
        const teamAName = match.teamAName || (match as any).teamA || ''
        const teamBName = match.teamBName || (match as any).teamB || ''
        const squadAId = await resolveSquadId((match as any).teamASquadId || (match as any).teamAId || (match as any).teamA, teamAName)
        const squadBId = await resolveSquadId((match as any).teamBSquadId || (match as any).teamBId || (match as any).teamB, teamBName)

        const [playersA, playersB, pxiA, pxiB] = await Promise.all([
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
          squadAId ? fetchPrevXI(squadAId, match.id) : Promise.resolve([]),
          squadBId ? fetchPrevXI(squadBId, match.id) : Promise.resolve([])
        ])

        setSquadData({
          allA: toUiPlayers(playersA as any[]),
          allB: toUiPlayers(playersB as any[]),
        })
        setPrevXIs({ a: pxiA, b: pxiB })
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
      <div className="min-h-screen bg-slate-50 dark:bg-[#060b16] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 dark:border-white/5 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="text-xs font-medium text-slate-500 uppercase tracking-widest">Loading XI...</span>
        </div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#060b16] flex items-center justify-center p-6">
        <div className="text-center bg-white dark:bg-[#0f172a] p-12 rounded-[2rem] shadow-xl border border-slate-200 dark:border-white/5">
          <div className="text-5xl mb-6">🏴</div>
          <p className="text-slate-500 font-medium mb-8 uppercase tracking-widest">Match data unavailable</p>
          <button onClick={() => navigate('/')} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-medium shadow-lg hover:shadow-xl transition-all">Go Home</button>
        </div>
      </div>
    )
  }

  const teamAName = match.teamAName || (match as any).teamA || 'Team A'
  const teamBName = match.teamBName || (match as any).teamB || 'Team B'
  const teamAPlayingXI = match.teamAPlayingXI || []
  const teamBPlayingXI = match.teamBPlayingXI || []

  const getPlayingAndBench = (allPlayers: any[], playingXIIds: string[], prevXIIds: string[]) => {
    const playing = playingXIIds.map(id => {
      const p = allPlayers.find(p => p.id === id)
      if (!p) return null
      const isNew = prevXIIds.length > 0 && !prevXIIds.includes(id)
      return { ...p, status: isNew ? 'IN' : null }
    }).filter(Boolean)

    const bench = allPlayers.filter(p => !playingXIIds.includes(p.id)).map(p => {
      const wasPlaying = prevXIIds.length > 0 && prevXIIds.includes(p.id)
      return { ...p, status: wasPlaying ? 'OUT' : null }
    })

    return { playing, bench }
  }

  const teamAData = getPlayingAndBench(squadData.allA, teamAPlayingXI, prevXIs.a)
  const teamBData = getPlayingAndBench(squadData.allB, teamBPlayingXI, prevXIs.b)

  const renderPlayerCard = (player: any, isCaptain: boolean, isKeeper: boolean) => {
    const roleDisplay = formatRole(player)
    return (
      <div key={player.id} className="relative group">
        <div className="bg-white dark:bg-[#0f172a] rounded-[1.5rem] p-3 sm:p-4 border border-slate-200 dark:border-white/5 flex items-center gap-3 sm:gap-4 hover:border-blue-500/30 hover:shadow-md transition-all duration-300">
          <div className="relative shrink-0">
            <PlayerAvatar
              photoUrl={player.photoUrl || (player as any).photo}
              name={player.name}
              size="lg"
            />
            {player.status === 'IN' && (
              <div className="absolute -top-1 -left-1 bg-green-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-sm border-2 border-white">↑</div>
            )}
            {player.status === 'OUT' && (
              <div className="absolute -top-1 -left-1 bg-rose-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-sm border-2 border-white">↓</div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <PlayerLink playerId={player.id} playerName={player.name} className="font-medium text-slate-900 dark:text-white truncate text-sm sm:text-base hover:text-blue-600 dark:hover:text-blue-400 transition-colors" />
              {(isCaptain || isKeeper) && (
                <div className="flex gap-1">
                  {isCaptain && <span className="text-[8px] sm:text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded-md font-medium uppercase tracking-tighter">(C)</span>}
                  {isKeeper && <span className="text-[8px] sm:text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded-md font-medium uppercase tracking-tighter">WK</span>}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-[10px] sm:text-xs text-slate-500 font-medium truncate uppercase tracking-tight">{roleDisplay}</div>
              {player.status && (
                <span className={`text-[9px] font-black uppercase tracking-widest ${player.status === 'IN' ? 'text-green-600' : 'text-rose-500'}`}>
                  {player.status}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060b16] text-slate-900 dark:text-white pb-20">
      {/* Premium Header */}
      {!compact && (
        <div className="bg-[#0f172a] border-b border-white/5 sticky top-0 z-50 px-4 sm:px-8 py-6 shadow-sm shadow-black/20">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-white">Playing XI</h1>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium uppercase tracking-[0.2em] mt-1">Match Day Squad Details</p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-3 sm:px-8 py-8 space-y-10">
        {/* Team Tabs - Custom Design */}
        <div className="p-1.5 bg-slate-100 dark:bg-white/5 backdrop-blur rounded-[1.5rem] flex gap-2 w-full max-w-md mx-auto ring-1 ring-slate-200 dark:ring-white/10">
          {[
            { side: firstSide, name: firstSide === 'A' ? teamAName : teamBName },
            { side: secondSide, name: secondSide === 'A' ? teamAName : teamBName }
          ].map((t) => (
            <button
              key={t.side}
              onClick={() => setSelectedTeam(t.side)}
              className={`flex-1 py-3 px-4 rounded-[1.2rem] text-xs font-medium uppercase tracking-widest transition-all duration-300 ${selectedTeam === t.side ? 'bg-blue-600 shadow-lg text-white ring-1 ring-blue-500/30' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
              {formatShortTeamName(t.name)}
            </button>
          ))}
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {loadingSquads ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="bg-white rounded-[1.5rem] p-6 border border-slate-100 h-24 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {(selectedTeam === 'A' && teamAPlayingXI.length === 0) || (selectedTeam === 'B' && teamBPlayingXI.length === 0) ? (
                <div className="space-y-8">
                  <div className="bg-slate-100 dark:bg-white/5 rounded-2xl p-4 text-center">
                    <p className="text-slate-500 font-medium uppercase tracking-widest text-[10px]">Playing XI not announced yet</p>
                  </div>

                  {/* Show Full Squad */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    {selectedTeam === 'A' ? (
                      squadData.allA.map((p) => renderPlayerCard(p, p.id === match.teamACaptainId, p.id === match.teamAKeeperId))
                    ) : (
                      squadData.allB.map((p) => renderPlayerCard(p, p.id === match.teamACaptainId, p.id === match.teamAKeeperId))
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    {selectedTeam === 'A' ? (
                      teamAData.playing.map((p) => renderPlayerCard(p, p.id === match.teamACaptainId, p.id === match.teamAKeeperId))
                    ) : (
                      teamBData.playing.map((p) => renderPlayerCard(p, p.id === match.teamBCaptainId, p.id === match.teamBKeeperId))
                    )}
                  </div>

                  {/* Bench Section with subtle styling */}
                  {(selectedTeam === 'A' ? teamAData.bench : teamBData.bench).length > 0 && (
                    <div className="mt-16">
                      <div className="flex items-center gap-4 mb-8">
                        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-[0.3em] whitespace-nowrap">On Bench</h3>
                        <div className="h-px bg-white/5 w-full" />
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:gap-4 opacity-80 filter grayscale-[0.3]">
                        {selectedTeam === 'A' ? (
                          teamAData.bench.map((p) => renderPlayerCard(p, false, false))
                        ) : (
                          teamBData.bench.map((p) => renderPlayerCard(p, false, false))
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
