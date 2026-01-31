/**
 * Match Scorecard Page
 * CREX-style full scorecard with innings tabs
 */

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { Match, InningsStats } from '@/types'
import ScorecardSkeleton from '@/components/skeletons/ScorecardSkeleton'
import PlayerLink from '@/components/PlayerLink'
import PlayerAvatar from '@/components/common/PlayerAvatar'

// Format overs helper
const formatOversDisplay = (legalBalls: number): string => {
  const overs = Math.floor(legalBalls / 6)
  const balls = legalBalls % 6
  return `${overs}.${balls}`
}

// Format extras breakdown
const formatExtrasShort = (extras: any): string => {
  if (!extras) return ''
  const parts = []
  if (extras.wides) parts.push(`${extras.wides}w`)
  if (extras.noBalls) parts.push(`${extras.noBalls}nb`)
  if (extras.legByes) parts.push(`${extras.legByes}lb`)
  if (extras.byes) parts.push(`${extras.byes}b`)
  return parts.length > 0 ? parts.join(', ') : ''
}

// Format player name: Mehedi Hasan -> M Hasan
const formatPlayerScorecardName = (name: string): string => {
  if (!name) return '';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length <= 1) return name;
  const initial = parts[0][0].toUpperCase();
  const lastName = parts[parts.length - 1];
  return `${initial} ${lastName}`;
}

export default function MatchScorecard({ compact = false }: { compact?: boolean }) {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const [matchData, setMatchData] = useState<Match | null>(null)
  const [teamAInnings, setTeamAInnings] = useState<InningsStats | null>(null)
  const [teamBInnings, setTeamBInnings] = useState<InningsStats | null>(null)
  const [playersMap, setPlayersMap] = useState<Map<string, any>>(new Map())
  const [selectedInning, setSelectedInning] = useState<string>('teamA-1')
  const [loading, setLoading] = useState(true)

  // Load match with comprehensive data
  useEffect(() => {
    if (!matchId) return

    const loadMatch = async () => {
      try {
        const match = await matchService.getById(matchId)
        if (match) {
          setMatchData(match)
          setLoading(false)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('Error loading match:', error)
        setLoading(false)
      }
    }

    loadMatch()

    // Subscribe to real-time updates
    const unsubscribe = matchService.subscribeToMatch(matchId, (match) => {
      if (match) {
        setMatchData(match)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [matchId])

  // Subscribe to innings and load initial data
  useEffect(() => {
    if (!matchId) return

    // Load initial data first - Important for first render
    const loadInitialInnings = async () => {
      try {
        const [inningsA, inningsB] = await Promise.all([
          matchService.getInnings(matchId, 'teamA').catch((err) => {
            console.warn('[MatchScorecard] ⚠️ Team A innings not found:', err)
            return null
          }),
          matchService.getInnings(matchId, 'teamB').catch((err) => {
            console.warn('[MatchScorecard] ⚠️ Team B innings not found:', err)
            return null
          }),
        ])

        if (inningsA) {
          console.log('[MatchScorecard] ✅ Initial Loaded Team A innings:', {
            totalRuns: inningsA.totalRuns,
            totalWickets: inningsA.totalWickets,
            batsmanStatsCount: inningsA.batsmanStats?.length || 0,
            overs: inningsA.overs,
          })
          setTeamAInnings(inningsA)
        } else {
          console.log('[MatchScorecard] ℹ️ No Team A innings data found')
        }

        if (inningsB) {
          console.log('[MatchScorecard] ✅ Initial Loaded Team B innings:', {
            totalRuns: inningsB.totalRuns,
            totalWickets: inningsB.totalWickets,
            batsmanStatsCount: inningsB.batsmanStats?.length || 0,
            overs: inningsB.overs,
          })
          setTeamBInnings(inningsB)
        } else {
          console.log('[MatchScorecard] ℹ️ No Team B innings data found')
        }
      } catch (error) {
        console.error('[MatchScorecard] ❌ Error loading initial innings:', error)
      }
    }

    loadInitialInnings()

    // Subscribe to real-time updates
    const unsubA = matchService.subscribeToInnings(matchId, 'teamA', (innings) => {
      if (innings) {
        setTeamAInnings(innings)
      }
    })

    const unsubB = matchService.subscribeToInnings(matchId, 'teamB', (innings) => {
      if (innings) {
        setTeamBInnings(innings)
      }
    })

    return () => {
      unsubA()
      unsubB()
    }
  }, [matchId])

  const teamAName = matchData?.teamAName || (matchData as any)?.teamA || 'Team A'
  const teamBName = matchData?.teamBName || (matchData as any)?.teamB || 'Team B'

  // Highly optimized player loading
  useEffect(() => {
    const loadPlayers = async () => {
      if (!matchData) return

      try {
        const squadAId = matchData.teamAId || (matchData as any).teamASquadId || (matchData as any).teamA
        const squadBId = matchData.teamBId || (matchData as any).teamBSquadId || (matchData as any).teamB

        if (!squadAId && !squadBId) return

        // Fetch both squads' players in parallel without redundant squad info calls
        const [playersA, playersB] = await Promise.all([
          squadAId ? playerService.getBySquad(squadAId).catch(() => []) : Promise.resolve([]),
          squadBId ? playerService.getBySquad(squadBId).catch(() => []) : Promise.resolve([])
        ]);

        const map = new Map<string, any>()
        playersA.forEach((p: any) => map.set(p.id, p))
        playersB.forEach((p: any) => map.set(p.id, p))

        setPlayersMap(map)
      } catch (error) {
        console.error('[MatchScorecard] Performance Error in loadPlayers:', error)
      }
    }

    loadPlayers()
  }, [matchData])

  // Generate innings tabs
  const inningsTabs = useMemo(() => {
    if (!matchData) return []

    const tabs: Array<{ id: string; label: string; inningId: 'teamA' | 'teamB'; inningNumber: 1 | 2 }> = []

    const resolveSideFromValue = (v: any): 'teamA' | 'teamB' | null => {
      if (v === 'teamA' || v === 'teamB') return v
      const s = String(v || '').trim().toLowerCase()
      if (!s) return null
      if (s === 'teama' || s === 'team a' || s === 'team_a' || s === 'a') return 'teamA'
      if (s === 'teamb' || s === 'team b' || s === 'team_b' || s === 'b') return 'teamB'

      const aId = String((matchData as any).teamAId || (matchData as any).teamASquadId || (matchData as any).teamA || '').trim().toLowerCase()
      const bId = String((matchData as any).teamBId || (matchData as any).teamBSquadId || (matchData as any).teamB || '').trim().toLowerCase()
      const aName = String(teamAName || '').trim().toLowerCase()
      const bName = String(teamBName || '').trim().toLowerCase()
      if (aId && s === aId) return 'teamA'
      if (bId && s === bId) return 'teamB'
      if (aName && s === aName) return 'teamA'
      if (bName && s === bName) return 'teamB'
      return null
    }

    const normalizeElectedTo = (v: any): 'bat' | 'bowl' | null => {
      const s = String(v || '').trim().toLowerCase()
      if (!s) return null
      if (s === 'bat' || s === 'batting' || s === 'chose to bat' || s === 'choose to bat') return 'bat'
      if (s === 'bowl' || s === 'bowling' || s === 'field' || s === 'fielding' || s === 'chose to bowl' || s === 'choose to bowl') return 'bowl'
      return null
    }

    const hasStarted = (inn: any) =>
      Boolean(inn) &&
      (Number(inn.legalBalls || 0) > 0 || Number(inn.totalRuns || 0) > 0 || Number(inn.totalWickets || 0) > 0)

    const aHas = hasStarted(teamAInnings)
    const bHas = hasStarted(teamBInnings)

    // Prefer toss-based "who batted first". If missing, fall back to which innings actually has data.
    const tossWinner = resolveSideFromValue((matchData as any).tossWinner)
    const electedTo = normalizeElectedTo((matchData as any).electedTo || (matchData as any).tossDecision)
    const inferredFirst: 'teamA' | 'teamB' =
      tossWinner && electedTo
        ? (electedTo === 'bat' ? tossWinner : (tossWinner === 'teamA' ? 'teamB' : 'teamA'))
        : (aHas && !bHas ? 'teamA' : bHas && !aHas ? 'teamB' : 'teamA')

    const first = inferredFirst
    const second: 'teamA' | 'teamB' = first === 'teamA' ? 'teamB' : 'teamA'

    const nameFor = (side: 'teamA' | 'teamB') => (side === 'teamA' ? teamAName : teamBName)

    // Always show BOTH pills/tabs (fixed order): 1st innings on left, 2nd innings on right.
    tabs.push({ id: `${first}-1`, label: `${nameFor(first)} 1st Inn`, inningId: first, inningNumber: 1 })
    tabs.push({ id: `${second}-2`, label: `${nameFor(second)} 2nd Inn`, inningId: second, inningNumber: 2 })

    return tabs
  }, [matchData, teamAInnings, teamBInnings, teamAName, teamBName])

  // Ensure selectedInning always points to an existing tab (important when first-innings side isn't teamA)
  useEffect(() => {
    if (inningsTabs.length === 0) return
    if (!inningsTabs.some((t) => t.id === selectedInning)) {
      setSelectedInning(inningsTabs[0].id)
    }
  }, [inningsTabs, selectedInning])

  const currentTab = inningsTabs.find(t => t.id === selectedInning) || inningsTabs[0]
  const currentInningsDataRaw = currentTab?.inningId === 'teamA' ? teamAInnings : teamBInnings

  // Fallback: Build batsmanStats from playingXI if innings data exists but batsmanStats is empty
  const currentInningsData = useMemo(() => {
    if (!matchData || !currentTab) return currentInningsDataRaw

    // If user clicks 2nd innings before it starts, show an empty "yet to bat" innings card instead of blank page.
    if (!currentInningsDataRaw) {
      const playingXI = currentTab.inningId === 'teamA' ? (matchData.teamAPlayingXI || []) : (matchData.teamBPlayingXI || [])
      return {
        matchId: matchData.id,
        inningId: currentTab.inningId,
        totalRuns: 0,
        totalWickets: 0,
        legalBalls: 0,
        overs: '0.0',
        ballsInCurrentOver: 0,
        currentRunRate: 0,
        requiredRunRate: null,
        remainingBalls: (matchData.oversLimit || 20) * 6,
        target: null,
        projectedTotal: 0,
        lastBallSummary: null,
        partnership: { runs: 0, balls: 0, overs: '0.0' },
        extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
        fallOfWickets: [],
        batsmanStats: [], // keep empty so "Did Not Bat" becomes all XI
        bowlerStats: [],
        recentOvers: [],
        currentOverBalls: [],
        currentStrikerId: '',
        nonStrikerId: '',
        currentBowlerId: '',
        lastUpdated: (matchData as any)?.updatedAt || (matchData as any)?.createdAt,
        updatedAt: new Date().toISOString(),
        _isPlaceholder: true,
        _playingXI: playingXI,
      } as any
    }

    // If we have innings data but no batsmanStats, try to build from playingXI
    if (currentInningsDataRaw && (!currentInningsDataRaw.batsmanStats || currentInningsDataRaw.batsmanStats.length === 0)) {
      const playingXI = currentTab?.inningId === 'teamA'
        ? (matchData.teamAPlayingXI || [])
        : (matchData.teamBPlayingXI || [])

      if (playingXI && playingXI.length > 0 && playersMap.size > 0) {
        // Build batsmanStats from playingXI
        const fallbackBatsmanStats = playingXI
          .map((playerIdOrObj: any) => {
            const playerId = typeof playerIdOrObj === 'string' ? playerIdOrObj : (playerIdOrObj.playerId || playerIdOrObj.id)
            const player = playersMap.get(playerId)
            if (!player) return null

            return {
              batsmanId: playerId,
              batsmanName: player.name || 'Player',
              runs: 0,
              balls: 0,
              fours: 0,
              sixes: 0,
              strikeRate: 0,
              notOut: true,
            }
          })
          .filter(Boolean)

        if (fallbackBatsmanStats.length > 0) {
          console.log('[MatchScorecard] 🔄 Using fallback batsmanStats from playingXI:', fallbackBatsmanStats.length)
          return {
            ...currentInningsDataRaw,
            batsmanStats: fallbackBatsmanStats,
          }
        }
      }
    }

    return currentInningsDataRaw
  }, [currentInningsDataRaw, matchData, currentTab, playersMap])

  // Debug logging
  useEffect(() => {
    if (currentInningsData) {
      console.log('[MatchScorecard] 🔍 Current Innings Data:', {
        totalRuns: currentInningsData.totalRuns,
        totalWickets: currentInningsData.totalWickets,
        batsmanStatsCount: currentInningsData.batsmanStats?.length || 0,
        bowlerStatsCount: currentInningsData.bowlerStats?.length || 0,
        batsmanStats: currentInningsData.batsmanStats,
        overs: currentInningsData.overs,
      })

      // Log each batsman's data
      if (currentInningsData.batsmanStats && currentInningsData.batsmanStats.length > 0) {
        currentInningsData.batsmanStats.forEach((batsman: any, idx: number) => {
          console.log(`[MatchScorecard] Batsman ${idx + 1}:`, {
            batsmanId: batsman.batsmanId,
            batsmanName: batsman.batsmanName,
            runs: batsman.runs,
            balls: batsman.balls,
            fromMap: playersMap.get(batsman.batsmanId)?.name,
          })
        })
      }
    }
    console.log('[MatchScorecard] 👥 Players Map Size:', playersMap.size)
    if (playersMap.size > 0) {
      console.log('[MatchScorecard] Players in Map:', Array.from(playersMap.entries()).slice(0, 5).map(([id, player]) => ({ id, name: player?.name })))
    }
  }, [currentInningsData, playersMap, teamAInnings, teamBInnings])

  if (loading) {
    return <ScorecardSkeleton />
  }

  if (!matchData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Match not found</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-batchcrick-teal text-white rounded-lg hover:bg-batchcrick-teal-dark"
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }


  return (
    <div className="min-h-screen bg-[#f5f7f9] text-[#1a1a1a] pb-20 font-sans">
      {/* 1. Header Area - Minimal sticky header */}
      {!compact && (
        <div className="bg-white border-b border-slate-100 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:text-slate-800 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 text-center pr-8">
              <h1 className="text-[14px] font-bold text-slate-800 uppercase tracking-tight">
                Scorecard
              </h1>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 2. Top Innings Tab Switcher */}
        <div className="flex gap-4">
          {inningsTabs.slice(0, 2).map((tab) => {
            const side = tab.inningId;
            const inn = side === 'teamA' ? teamAInnings : teamBInnings;
            const isActive = selectedInning === tab.id;
            const name = side === 'teamA' ? teamAName : teamBName;
            const shortName = name.substring(0, 3).toUpperCase();
            const overs = formatOversDisplay(inn?.legalBalls || 0);

            return (
              <button
                key={tab.id}
                onClick={() => setSelectedInning(tab.id)}
                className={`flex-1 py-3.5 px-6 rounded-xl transition-all duration-300 flex items-center justify-center font-bold text-[15px] shadow-sm
                  ${isActive
                    ? 'bg-[#004e96] text-white'
                    : 'bg-white text-slate-500 border border-slate-100'
                  }`}
              >
                <span>{shortName}</span>
                {!isActive && inn?.totalRuns !== undefined && (
                  <span className="ml-2 font-medium">
                    {inn.totalRuns}-{inn.totalWickets || 0}
                    <span className="ml-1 text-[12px] opacity-60">({overs})</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 3. Main Body Sections */}
        {currentInningsData ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">

            {/* BATTING SECTION */}
            <div className="pb-4">
              <div className="bg-slate-50/50 px-5 py-3 border-y border-slate-100 mb-2">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">BATTING</h3>
              </div>

              <div className="px-5 py-3 grid grid-cols-[1fr,40px,40px,40px,40px,50px] gap-2 items-center text-slate-400 text-[11px] font-bold border-b border-slate-50">
                <span className="text-[#4a90e2]">Batter</span>
                <span className="text-center">R</span>
                <span className="text-center">B</span>
                <span className="text-center">4s</span>
                <span className="text-center">6s</span>
                <span className="text-right">SR</span>
              </div>

              <div className="divide-y divide-slate-50">
                {currentInningsData.batsmanStats?.map((b: any, idx: number) => {
                  const isActive = (b.batsmanId === (matchData as any).currentStrikerId || b.batsmanId === (matchData as any).currentNonStrikerId);
                  const isStriker = b.batsmanId === (matchData as any).currentStrikerId;

                  return (
                    <div key={idx} className="px-5 py-5 transition-colors group hover:bg-slate-50/30">
                      <div className="grid grid-cols-[1fr,40px,40px,40px,40px,50px] gap-2 items-start">
                        <div className="min-w-0">
                          <PlayerLink
                            playerId={b.batsmanId}
                            playerName={b.batsmanName}
                            className={`text-[14px] font-bold leading-none block truncate ${isActive ? 'text-[#004e96]' : 'text-slate-800'}`}
                          >
                            {formatPlayerScorecardName(b.batsmanName)}
                            {b.batsmanId === (currentTab?.inningId === 'teamA' ? matchData.teamACaptainId : matchData.teamBCaptainId) && ' (c)'}
                            {b.batsmanId === (currentTab?.inningId === 'teamA' ? matchData.teamAKeeperId : matchData.teamBKeeperId) && ' (wk)'}
                            {isStriker && isActive && '*'}
                          </PlayerLink>
                          <div className="text-[11px] mt-1.5 font-medium text-slate-400 leading-tight">
                            {b.dismissal || (isActive && matchData.status === 'live' ? 'Batting' : 'Not out')}
                          </div>
                        </div>
                        <span className="text-center text-[15px] font-black text-slate-900 tabular-nums">{b.runs}</span>
                        <span className="text-center text-[13px] font-medium text-slate-400 tabular-nums pt-0.5">{b.balls}</span>
                        <span className="text-center text-[13px] font-medium text-slate-400 tabular-nums pt-0.5">{b.fours}</span>
                        <span className="text-center text-[13px] font-medium text-slate-400 tabular-nums pt-0.5">{b.sixes}</span>
                        <span className="text-right text-[12px] font-medium text-slate-400 tabular-nums pt-0.5">
                          {b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Extras Final Section */}
                <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/10">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-bold text-slate-500">Extras</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-black text-slate-800">
                        {Number(currentInningsData.extras?.wides || 0) +
                          Number(currentInningsData.extras?.noBalls || 0) +
                          Number(currentInningsData.extras?.byes || 0) +
                          Number(currentInningsData.extras?.legByes || 0)}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">({formatExtrasShort(currentInningsData.extras)})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* YET TO BAT SECTION */}
            <div className="px-6 py-8 space-y-8">
              <h3 className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">YET TO BAT</h3>
              <div className="grid grid-cols-2 gap-y-10 gap-x-12">
                {(() => {
                  const battedPlayerIds = new Set(currentInningsData.batsmanStats?.map((b: any) => b.batsmanId));
                  const playingXI = currentTab?.inningId === 'teamA' ? (matchData.teamAPlayingXI || []) : (matchData.teamBPlayingXI || []);
                  const yetToBat = playingXI.filter((item: any) => {
                    const id = typeof item === 'string' ? item : (item as any).playerId || (item as any).id;
                    return id && !battedPlayerIds.has(id);
                  });

                  return yetToBat.map((playerIdOrObj: any) => {
                    const pid = typeof playerIdOrObj === 'string' ? playerIdOrObj : playerIdOrObj.playerId || playerIdOrObj.id;
                    const p = playersMap.get(pid);
                    return (
                      <div key={pid} className="flex items-center gap-5 group">
                        <div className="w-12 h-12 rounded-full border border-slate-100 overflow-hidden shrink-0 shadow-sm transition-transform group-hover:scale-105">
                          <PlayerAvatar photoUrl={p?.photoUrl || p?.photo} name={p?.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <PlayerLink playerId={pid} playerName={p?.name || 'Player'} className={`text-[14px] font-bold text-slate-800 block group-hover:text-[#004e96]`}>
                            {formatPlayerScorecardName(p?.name || 'Player')}
                            {pid === (currentTab?.inningId === 'teamA' ? matchData.teamACaptainId : matchData.teamBCaptainId) && ' (c)'}
                            {pid === (currentTab?.inningId === 'teamA' ? matchData.teamAKeeperId : matchData.teamBKeeperId) && ' (wk)'}
                          </PlayerLink>
                          <div className="text-[12px] font-medium text-slate-400 mt-1">
                            SR: {(() => {
                              const sr = p?.stats?.batting?.strikeRate ?? p?.stats?.strikeRate ?? p?.strikeRate;
                              return sr !== undefined ? Number(sr).toFixed(1) : '-';
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* BOWLING SECTION */}
            <div className="pt-2">
              <div className="bg-slate-50/50 px-5 py-3 border-y border-slate-100 mb-2">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">BOWLING</h3>
              </div>

              <div className="px-5 py-3 grid grid-cols-[1fr,40px,40px,40px,40px,50px] gap-2 items-center text-slate-400 text-[11px] font-bold border-b border-slate-50">
                <div className="flex items-center gap-1 text-[#4a90e2]">
                  Bowler <span className="text-[10px]">↓</span>
                </div>
                <span className="text-center">O</span>
                <span className="text-center">M</span>
                <span className="text-center">R</span>
                <span className="text-center">W</span>
                <span className="text-right">Eco</span>
              </div>

              <div className="divide-y divide-slate-50">
                {currentInningsData.bowlerStats?.map((bw: any, idx: number) => {
                  const isActive = bw.bowlerId === currentInningsData.currentBowlerId;
                  return (
                    <div key={idx} className="px-5 py-5 hover:bg-slate-50/30 transition-colors">
                      <div className="grid grid-cols-[1fr,40px,40px,40px,40px,50px] gap-2 items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerLink
                            playerId={bw.bowlerId}
                            playerName={bw.bowlerName}
                            className={`text-[14px] font-medium truncate whitespace-nowrap text-slate-700 hover:text-[#4a90e2]`}
                          >
                            {formatPlayerScorecardName(bw.bowlerName)}
                          </PlayerLink>
                          {isActive && <div className="w-2 h-2 bg-slate-400 rounded-full"></div>}
                        </div>
                        <span className="text-center text-[13px] font-medium text-slate-600 tabular-nums">{bw.overs}</span>
                        <span className="text-center text-[13px] font-medium text-slate-600 tabular-nums">{bw.maidens || 0}</span>
                        <span className="text-center text-[13px] font-medium text-slate-600 tabular-nums">{bw.runsConceded}</span>
                        <span className="text-center text-[14px] font-black text-slate-900 tabular-nums">{bw.wickets}</span>
                        <span className="text-right text-[13px] font-medium text-slate-400 tabular-nums">{(bw.economy || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FALL OF WICKETS SECTION */}
            {(currentInningsData.fallOfWickets?.length || 0) > 0 && (
              <div className="mt-4">
                <div className="bg-slate-50/50 px-5 py-3 border-y border-slate-100 mb-2">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">FALL OF WICKETS</h3>
                </div>

                <div className="px-5 py-3 flex items-center justify-between text-slate-400 text-[11px] font-bold border-b border-slate-50">
                  <span className="w-1/2">Batter</span>
                  <div className="flex-1 flex justify-between pr-2">
                    <span className="flex-1 text-center">W-Runs</span>
                    <span className="w-12 text-right">Over</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-50">
                  {currentInningsData.fallOfWickets.map((fw: any, i: number) => (
                    <div key={i} className="px-5 py-4.5 flex items-center justify-between">
                      <div className="w-1/2 min-w-0 pr-4">
                        <div className="text-[14px] font-bold text-slate-800 truncate">
                          {fw.batsmanName || 'Player'}
                          {fw.batsmanId === (currentTab?.inningId === 'teamA' ? matchData.teamACaptainId : matchData.teamBCaptainId) && ' (c)'}
                        </div>
                      </div>

                      <div className="flex-1 flex justify-between items-center pr-2">
                        <span className="flex-1 text-center text-[14px] font-black text-slate-900">
                          {fw.wicket}-{fw.score}
                        </span>
                        <span className="w-12 text-right text-[13px] font-medium text-slate-400 tabular-nums">
                          {fw.over}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PARTNERSHIPS SECTION */}
            <div className="pt-2 pb-6">
              {/* Header Label */}
              <div className="bg-slate-50/50 px-5 py-3 border-y border-slate-100 mb-2">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">PARTNERSHIPS</h3>
              </div>

              {/* Batter Indicators */}
              <div className="flex items-center justify-between px-5 mb-4">
                <span className="text-[11px] font-bold text-[#004e96] uppercase tracking-wider">
                  {(() => {
                    const p = currentInningsData?.partnership?.batter1;
                    const id = p?.id || (matchData as any).currentStrikerId;
                    return playersMap.get(id)?.name || currentInningsData?.batsmanStats?.find((s: any) => s.batsmanId === id)?.batsmanName || 'Batter 1';
                  })()}
                </span>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {(() => {
                    const p = currentInningsData?.partnership?.batter2;
                    const id = p?.id || (matchData as any).currentNonStrikerId;
                    return playersMap.get(id)?.name || currentInningsData?.batsmanStats?.find((s: any) => s.batsmanId === id)?.batsmanName || 'Batter 2';
                  })()}
                </span>
              </div>

              {/* DETAILED PARTNERSHIPS HISTORY */}
              <div className="space-y-1">
                {(() => {
                  const allP = [...(currentInningsData.partnerships || [])];
                  if (currentInningsData.partnership && currentInningsData.partnership.runs !== undefined) {
                    allP.push({
                      ...currentInningsData.partnership,
                      isCurrent: true,
                      wicketNo: (currentInningsData.partnerships?.length || 0) + 1
                    });
                  }

                  return allP.map((p: any, idx: number) => {
                    const b1Id = p.batter1?.id;
                    const b2Id = p.batter2?.id;
                    const getRefinedName = (id: string, providedName: string, fallback: string) => {
                      if (providedName && providedName !== 'Player' && providedName !== 'Batter 1' && providedName !== 'Batter 2') return providedName;
                      const fromMap = playersMap.get(id)?.name;
                      if (fromMap) return fromMap;
                      const fromStats = currentInningsData?.batsmanStats?.find((s: any) => s.batsmanId === id)?.batsmanName;
                      if (fromStats) return fromStats;
                      return fallback;
                    };

                    const b1Name = getRefinedName(b1Id, p.batter1?.name, 'Batter 1');
                    const b2Name = getRefinedName(b2Id, p.batter2?.name, 'Batter 2');

                    const totalR = p.runs || 1;
                    const b1Runs = p.batter1?.runs || 0;
                    const b2Runs = p.batter2?.runs || 0;
                    const b1Pct = totalR > 0 ? (b1Runs / totalR) * 100 : 50;
                    const b2Pct = 100 - b1Pct;
                    const wNo = p.wicketNo;
                    const suffix = wNo === 1 ? 'ST' : wNo === 2 ? 'ND' : wNo === 3 ? 'RD' : 'TH';

                    return (
                      <div key={idx} className={`px-5 py-6 ${p.isCurrent ? 'bg-blue-50/10 shadow-[inset_4px_0_0_#f5a623]' : 'bg-white'} border-b border-slate-50`}>
                        <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-4">
                          {wNo}{suffix} WICKET
                        </div>

                        <div className="flex items-start justify-between">
                          <div className="w-1/3 min-w-0">
                            <div className="text-[14px] font-bold text-slate-800 truncate mb-1">
                              {b1Name}
                            </div>
                            <div className="text-[14px] font-black text-slate-900 leading-none">
                              {b1Runs} <span className="text-[11px] text-slate-400 font-bold ml-0.5">({p.batter1?.balls || 0})</span>
                            </div>
                          </div>

                          <div className="flex-1 flex flex-col items-center pt-0.5">
                            <div className="flex items-baseline gap-1.5 mb-3">
                              <span className="text-[18px] font-black text-[#f5a623]">{p.runs}</span>
                              <span className="text-[12px] font-bold text-slate-300">({p.balls})</span>
                            </div>

                            <div className="w-[100px] h-[6px] bg-slate-50 flex overflow-hidden rounded-full ring-1 ring-slate-100/50">
                              <div className="h-full bg-[#76af43]" style={{ width: `${b1Pct}%` }}></div>
                              <div className="h-full bg-[#b54242]" style={{ width: `${b2Pct}%` }}></div>
                            </div>
                          </div>

                          <div className="w-1/3 text-right min-w-0">
                            <div className="text-[14px] font-bold text-slate-800 truncate mb-1">
                              {b2Name}
                            </div>
                            <div className="text-[14px] font-black text-slate-900 leading-none">
                              <span className="text-[11px] text-slate-400 font-bold mr-1">({p.batter2?.balls || 0})</span> {b2Runs}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-40 text-center bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-slate-300">🏟️</span>
            </div>
            <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.4em]">Innings Not Started Yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
