import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { Match } from '@/types'
import { formatShortTeamName, stripBatch } from '@/utils/teamName'
import PlayerLink from '@/components/PlayerLink'
import PlayerAvatar from '@/components/common/PlayerAvatar'


function formatRole(player: any): string {
  const role = String(player.role || '').toLowerCase()
  const batting = String(player.battingStyle || '').toLowerCase()
  const bowling = String(player.bowlingStyle || '').toLowerCase()

  if (role === 'batsman' || role === 'batter') {
    const side = batting.includes('left') ? 'LH' : 'RH'
    return `${side} Bat`
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
  if (role === 'wicket-keeper' || role === 'wk') return 'WK-Bat'

  return role ? (role.charAt(0).toUpperCase() + role.slice(1)) : 'Player'
}

export default function MatchPlayingXI({ compact = false, match: initialMatch }: { compact?: boolean, match?: Match }) {
  const { matchId } = useParams<{ matchId: string }>()

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  const [match, setMatch] = useState<Match | null>(initialMatch || null)
  const [loading, setLoading] = useState(!initialMatch)
  const [selectedTeam, setSelectedTeam] = useState<'A' | 'B'>('A')
  const [squadData, setSquadData] = useState<{ allA: any[], allB: any[] }>({ allA: [], allB: [] })
  const [prevXIs, setPrevXIs] = useState<{ a: string[], b: string[] }>({ a: [], b: [] })
  const [loadingSquads, setLoadingSquads] = useState(false)
  const didDefaultTeam = useRef(false)

  useEffect(() => {
    if (initialMatch) {
      setMatch(initialMatch)
      setLoading(false)
      return
    }
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
  }, [matchId, initialMatch])

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
    const twid = tw.toLowerCase()
    const decRaw = String((match as any).electedTo || (match as any).tossDecision || '').trim().toLowerCase()

    if (!tw || !decRaw) return { firstSide: 'A' as const, secondSide: 'B' as const }

    // Robust side detection (matching MatchLiveHero)
    const aId = String(match.teamAId || (match as any).teamASquadId || '').trim().toLowerCase()
    const bId = String(match.teamBId || (match as any).teamBSquadId || '').trim().toLowerCase()
    const aName = (match.teamAName || '').trim().toLowerCase()
    const bName = (match.teamBName || '').trim().toLowerCase()

    let tossSide: 'A' | 'B' = 'A'
    if (twid === 'teama' || (aId && twid === aId) || aName === twid || (aName.includes(twid) && twid.length > 3)) {
      tossSide = 'A'
    } else if (twid === 'teamb' || (bId && twid === bId) || bName === twid || (bName.includes(twid) && twid.length > 3)) {
      tossSide = 'B'
    }

    const battedFirst = decRaw.includes('bat') ? tossSide : (tossSide === 'A' ? 'B' : 'A')
    return {
      firstSide: battedFirst as 'A' | 'B',
      secondSide: (battedFirst === 'A' ? 'B' : 'A') as 'A' | 'B'
    }
  })()

  const prevTossRef = useRef<string | null>(null)

  // Default selection to first batting team once match loads or toss update
  useEffect(() => {
    if (match) {
      const currentTossKey = `${match.tossWinner}_${match.electedTo}`
      const tossChanged = prevTossRef.current !== null && prevTossRef.current !== currentTossKey

      // Auto-switch if:
      // 1. It's the first time we're setting a default
      // 2. The toss information just changed (live update)
      if (!didDefaultTeam.current || tossChanged) {
        setSelectedTeam(firstSide)
        didDefaultTeam.current = true
      }

      // Update ref to track toss changes
      if (match.tossWinner && match.electedTo) {
        prevTossRef.current = currentTossKey
      }
    }
  }, [match?.id, firstSide])

  if (loading) {
    return (
      <div className={`${compact ? 'bg-transparent' : 'min-h-screen bg-slate-50 dark:bg-[#060b16]'} flex items-center justify-center p-12`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-slate-200 dark:border-white/5 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Loading XI...</span>
        </div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className={`flex flex-col items-center justify-center p-12 text-center ${compact ? '' : 'min-h-screen bg-slate-50 dark:bg-[#060b16]'}`}>
        <div className="text-4xl mb-4">🏴</div>
        <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[11px]">Match unavailable</p>
      </div>
    )
  }

  const teamAName = stripBatch(match.teamAName || (match as any).teamA || 'Team A')
  const teamBName = stripBatch(match.teamBName || (match as any).teamB || 'Team B')
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
    const isSpecial = isCaptain || isKeeper || player.status === 'IN' || player.status === 'OUT'

    return (
      <div
        key={player.id}
        className={`relative p-3 rounded-2xl border transition-all duration-300 hover:shadow-md hover:border-blue-500/30 group ${isSpecial
          ? 'bg-gradient-to-br from-white to-slate-50/50 dark:from-white/5 dark:to-white/[0.02] border-slate-200 dark:border-white/10'
          : 'bg-white dark:bg-white/[0.03] border-slate-100 dark:border-white/5'
          }`}
      >
        {/* Subtle accent border for special players */}
        {isSpecial && (
          <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${player.status === 'IN' ? 'bg-emerald-500' :
            player.status === 'OUT' ? 'bg-rose-500' :
              'bg-[#b08b47]'
            }`} />
        )}

        <div className="flex items-center gap-4">
          <div className="relative shrink-0 transition-transform group-hover:scale-105 duration-300">
            <PlayerAvatar
              photoUrl={player.photoUrl || (player as any).photo}
              name={player.name}
              size="lg"
            />
            {/* Corner Rank or Number placeholder if needed, otherwise just the avatar */}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <PlayerLink
                playerId={player.id}
                playerName={player.name}
                className={`font-bold tracking-tight ${isCaptain || isKeeper ? 'text-[#b08b47]' : 'text-slate-900 dark:text-slate-100'
                  } truncate text-[15px] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-none`}
              />
              {(isCaptain || isKeeper) && (
                <span className="text-[10px] font-black text-[#b08b47] uppercase tracking-wider bg-[#b08b47]/10 px-1.5 py-0.5 rounded-md">
                  {isCaptain && isKeeper ? 'C & WK' : isCaptain ? 'CAPTAIN' : 'WK'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest truncate">{roleDisplay}</div>
              {player.status === 'IN' && (
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  IN <span className="text-[10px]">▲</span>
                </span>
              )}
              {player.status === 'OUT' && (
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                  OUT <span className="text-[10px]">▼</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${compact ? 'bg-transparent text-slate-900 dark:text-white pb-0' : 'min-h-screen bg-slate-50 dark:bg-[#060b16] text-slate-900 dark:text-white pb-20'}`}>

      {/* Team Tabs */}
      <div className={`${compact ? 'bg-slate-50 dark:bg-[#060b16] border-b border-slate-100 dark:border-white/5' : 'max-w-5xl mx-auto pt-8 px-3 sm:px-8'}`}>
        <div className={`flex gap-6 ${compact ? 'px-4' : 'p-1.5 bg-slate-100 dark:bg-white/5 rounded-[1.5rem] ring-1 ring-slate-200 dark:ring-white/10 max-w-md mx-auto'}`}>
          {[
            { side: firstSide, name: firstSide === 'A' ? teamAName : teamBName },
            { side: secondSide, name: secondSide === 'A' ? teamAName : teamBName }
          ].map((t) => {
            const isActive = selectedTeam === t.side
            if (compact) {
              return (
                <button
                  key={t.side}
                  onClick={() => setSelectedTeam(t.side)}
                  className={`relative py-4 text-[15px] font-bold transition-all ${isActive ? 'text-slate-900' : 'text-slate-400'}`}
                >
                  {formatShortTeamName(t.name)}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-rose-600 rounded-full" />
                  )}
                </button>
              )
            }
            return (
              <button
                key={t.side}
                onClick={() => setSelectedTeam(t.side)}
                className={`flex-1 py-3 px-4 rounded-[1.2rem] text-xs font-medium uppercase tracking-widest transition-all duration-300 ${isActive ? 'bg-blue-600 shadow-lg text-white ring-1 ring-blue-500/30' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {formatShortTeamName(t.name)}
              </button>
            )
          })}
        </div>
      </div>

      <div className={`max-w-5xl mx-auto ${compact ? 'px-0 py-0 pt-2' : 'px-4 sm:px-8 py-6'}`}>
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {loadingSquads ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(n => (
                <div key={n} className="h-20 bg-slate-100 dark:bg-white/5 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {(selectedTeam === 'A' && teamAPlayingXI.length === 0) || (selectedTeam === 'B' && teamBPlayingXI.length === 0) ? (
                <div className="space-y-8">
                  <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4 text-center">
                    <p className="text-slate-500 font-medium uppercase tracking-widest text-[10px]">Playing XI not announced yet</p>
                  </div>

                  {/* Show Full Squad */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {selectedTeam === 'A' ? (
                      squadData.allA.map((p) => renderPlayerCard(p, p.id === match.teamACaptainId, p.id === match.teamAKeeperId))
                    ) : (
                      squadData.allB.map((p) => renderPlayerCard(p, p.id === (match as any).teamBCaptainId, p.id === (match as any).teamBKeeperId))
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {selectedTeam === 'A' ? (
                      teamAData.playing.map((p) => renderPlayerCard(p, p.id === match.teamACaptainId, p.id === match.teamAKeeperId))
                    ) : (
                      teamBData.playing.map((p) => renderPlayerCard(p, p.id === (match as any).teamBCaptainId, p.id === (match as any).teamBKeeperId))
                    )}
                  </div>

                  {/* Bench Section with subtle styling */}
                  {(selectedTeam === 'A' ? teamAData.bench : teamBData.bench).length > 0 && (
                    <div className="mt-12">
                      <div className="mb-6">
                        <h3 className="text-[17px] font-bold text-slate-800">On Bench</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
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
