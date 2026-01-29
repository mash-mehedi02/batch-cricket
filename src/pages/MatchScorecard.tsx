/**
 * Match Scorecard Page
 * CREX-style full scorecard with innings tabs
 */

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { Match, InningsStats } from '@/types'
import ScorecardSkeleton from '@/components/skeletons/ScorecardSkeleton'
import PlayerLink from '@/components/PlayerLink'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import { getMatchResultString } from '@/utils/matchWinner'
import cricketBatIcon from '@/assets/cricket-bat.png'
import cricketBallIcon from '@/assets/cricket-ball.png'

// Helper function to get first word of name
const getFirstName = (fullName: string) => {
  const words = fullName.trim().split(/\s+/)
  return words[0] || fullName
}
// Format overs helper
const formatOversDisplay = (legalBalls: number): string => {
  const overs = Math.floor(legalBalls / 6)
  const balls = legalBalls % 6
  return `${overs}.${balls}`
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
  const [isMobile, setIsMobile] = useState(false)

  // Check if mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

  // Load players
  useEffect(() => {
    const loadPlayers = async () => {
      if (!matchData) return

      try {
        const map = new Map<string, any>()

        const resolveSquadId = (m: any, side: 'A' | 'B') => {
          if (side === 'A') return m.teamAId || m.teamASquadId || m.teamA
          return m.teamBId || m.teamBSquadId || m.teamB
        }

        // Team A
        const squadAId = resolveSquadId(matchData as any, 'A')
        if (squadAId) {
          try {
            await squadService.getById(squadAId)
          } catch (err) {
            console.warn('[MatchScorecard] Failed to load squad A details:', err)
          }

          // Load players via players collection
          const playersA = await playerService.getBySquad(squadAId).catch(async () => {
            const allPlayers = await playerService.getAll()
            return allPlayers.filter((p: any) => p.squadId === squadAId)
          })
            ; (playersA as any[]).forEach((p: any) => map.set(p.id, p))
        }

        // Team B
        const squadBId = resolveSquadId(matchData as any, 'B')
        if (squadBId) {
          try {
            await squadService.getById(squadBId)
          } catch (err) {
            console.warn('[MatchScorecard] Failed to load squad B details:', err)
          }

          const playersB = await playerService.getBySquad(squadBId).catch(async () => {
            const allPlayers = await playerService.getAll()
            return allPlayers.filter((p: any) => p.squadId === squadBId)
          })
            ; (playersB as any[]).forEach((p: any) => map.set(p.id, p))
        }

        setPlayersMap(map)
      } catch (error) {
        console.error('Error loading players:', error)
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

  // --- Batting Order for Header ---
  const { firstSide, secondSide } = useMemo(() => {
    if (inningsTabs.length >= 2) {
      return {
        firstSide: inningsTabs[0].inningId as 'teamA' | 'teamB',
        secondSide: inningsTabs[1].inningId as 'teamA' | 'teamB'
      }
    }
    return { firstSide: 'teamA' as const, secondSide: 'teamB' as const }
  }, [inningsTabs])

  const firstInns = firstSide === 'teamA' ? teamAInnings : teamBInnings
  const secondInns = secondSide === 'teamA' ? teamAInnings : teamBInnings
  const firstName = firstSide === 'teamA' ? teamAName : teamBName
  const secondName = secondSide === 'teamA' ? teamAName : teamBName

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

  // Calculate match result - PROPER CRICKET RULES
  const getMatchResult = () => {
    return getMatchResultString(teamAName, teamBName, teamAInnings, teamBInnings, matchData)
  }

  const matchResult = getMatchResult()

  const formatExtrasShort = (extras: any) => {
    const byes = Number(extras?.byes || 0)
    const legByes = Number(extras?.legByes || 0)
    const wides = Number(extras?.wides || 0)
    const noBalls = Number(extras?.noBalls || 0)
    const parts: string[] = []
    if (legByes > 0) parts.push(`${legByes}lb`)
    if (byes > 0) parts.push(`${byes}b`)
    if (wides > 0) parts.push(`${wides}w`)
    if (noBalls > 0) parts.push(`${noBalls}nb`)
    return parts.join(', ')
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-20">
      {/* Match Summary Header - High Fidelity */}
      {!compact && (
        <div className="bg-white border-b border-slate-100 sticky top-0 z-50 px-4 sm:px-8 py-6 shadow-sm shadow-slate-200/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-5">
            {/* Teams Grid */}
            <div className="flex items-center justify-between gap-4">
              {/* Team A Info */}
              <div className="flex-1 min-w-0">
                <h1 className="text-sm sm:text-xl font-medium text-slate-900 uppercase tracking-tighter truncate">{firstName}</h1>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-lg sm:text-2xl font-medium text-blue-600">{firstInns?.totalRuns || 0}-{firstInns?.totalWickets || 0}</span>
                  <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-widest">({formatOversDisplay(firstInns?.legalBalls || 0)})</span>
                </div>
              </div>

              {/* Separator / VS */}
              <div className="flex flex-col items-center shrink-0 px-2 sm:px-6">
                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-[10px] sm:text-xs font-medium shadow-xl border-2 border-white rotate-3">
                  VS
                </div>
              </div>

              {/* Team B Info */}
              <div className="flex-1 min-w-0 text-right">
                <h1 className="text-sm sm:text-xl font-medium text-slate-900 uppercase tracking-tighter truncate">{secondName}</h1>
                <div className="flex items-baseline justify-end gap-1.5 mt-1">
                  <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-widest">({formatOversDisplay(secondInns?.legalBalls || 0)})</span>
                  <span className="text-lg sm:text-2xl font-medium text-emerald-600">{secondInns?.totalRuns || 0}-{secondInns?.totalWickets || 0}</span>
                </div>
              </div>
            </div>

            {/* Status Badge */}
            {matchResult && (
              <div className="mt-4 flex justify-center">
                <div className="inline-flex items-center gap-2 px-5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-medium text-amber-600 uppercase tracking-[0.2em] shadow-inner">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  {matchResult}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Innings Selector - Professional Switch */}
        <div className="p-1.5 bg-slate-200/50 backdrop-blur rounded-[1.5rem] flex gap-2">
          {inningsTabs.slice(0, 2).map((tab, idx) => {
            const side = tab.inningId
            const inn = side === 'teamA' ? teamAInnings : teamBInnings
            const isActive = selectedInning === tab.id
            const name = side === 'teamA' ? teamAName : teamBName

            return (
              <button
                key={tab.id}
                onClick={() => setSelectedInning(tab.id)}
                className={`flex-1 flex flex-col items-center justify-center py-3 px-4 rounded-[1.25rem] transition-all duration-300 ${isActive
                  ? 'bg-white shadow-xl shadow-slate-200/50 scale-[1.02] border border-slate-100'
                  : 'text-slate-500 hover:bg-white/50'
                  }`}
              >
                <span className={`text-[10px] font-medium uppercase tracking-widest leading-none mb-1.5 ${isActive ? 'text-blue-600' : 'opacity-60'}`}>
                  {idx === 0 ? '1st Innings' : '2nd Innings'}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-sm sm:text-base font-medium ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>{name}</span>
                  <span className={`text-xs font-medium tabular-nums ${isActive ? 'text-blue-500' : 'opacity-40'}`}>
                    {inn?.totalRuns || 0}/{inn?.totalWickets || 0}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {/* Current Innings Content */}
        {currentInningsData ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Batting Card */}
            <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/10 flex items-center justify-center">
                    <img src={cricketBatIcon} alt="" className="w-5 h-5 object-contain" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-900 uppercase tracking-widest">Batting Analysis</h3>
                </div>
              </div>

              {/* Batting Table Header */}
              <div className="px-6 pt-6 pb-2">
                <div
                  className="grid items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-widest"
                  style={{ gridTemplateColumns: 'minmax(0,1fr) 40px 40px 30px 30px 60px' }}
                >
                  <div className="text-left">Batsman</div>
                  <div className="text-right">Runs</div>
                  <div className="text-right">Balls</div>
                  <div className="text-right">4s</div>
                  <div className="text-right">6s</div>
                  <div className="text-right">S/R</div>
                </div>
              </div>

              <div className="divide-y divide-slate-50">
                {(!currentInningsData.batsmanStats || currentInningsData.batsmanStats.length === 0) ? (
                  <div className="px-6 py-16 text-center text-slate-400 italic font-medium uppercase tracking-widest text-xs">Waiting for first ball...</div>
                ) : (
                  currentInningsData.batsmanStats.map((batsman: any, idx: number) => {
                    const batsmanId = batsman.batsmanId || batsman.id || batsman.playerId
                    const player = playersMap.get(batsmanId)
                    const batsmanName = batsman.batsmanName || player?.name || 'Unknown'
                    const runs = Number(batsman.runs || 0)
                    const balls = Number(batsman.balls || 0)
                    const fours = Number(batsman.fours || 0)
                    const sixes = Number(batsman.sixes || 0)
                    const sr = balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0'

                    // Improved Not Out logic
                    const isDismissed = Boolean(batsman.dismissal)
                    const isNotOut = !isDismissed && (batsman.notOut === true || balls > 0)
                    const dismissal = batsman.dismissal || (isNotOut ? 'not out' : 'yet to bat')

                    return (
                      <div key={idx} className={`px-6 py-5 group transition-colors ${isNotOut ? 'bg-blue-50/20' : 'hover:bg-slate-50/30'}`}>
                        <div
                          className="grid items-start gap-2"
                          style={{ gridTemplateColumns: 'minmax(0,1fr) 40px 40px 30px 30px 60px' }}
                        >
                          <div className="min-w-0">
                            <PlayerLink
                              playerId={batsmanId}
                              playerName={batsmanName}
                              className="text-sm sm:text-base font-medium text-slate-900 truncate hover:text-blue-600 transition-colors"
                            >
                              {isMobile ? getFirstName(batsmanName) : batsmanName}
                            </PlayerLink>
                            <span className={`text-[10px] sm:text-xs font-medium leading-relaxed block mt-1 ${isNotOut ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                              {dismissal}
                            </span>
                          </div>
                          <div className="text-right tabular-nums font-medium text-slate-900">{runs}</div>
                          <div className="text-right tabular-nums text-slate-500 font-medium">{balls}</div>
                          <div className="text-right tabular-nums text-blue-500 font-medium">{fours}</div>
                          <div className="text-right tabular-nums text-emerald-500 font-medium">{sixes}</div>
                          <div className="text-right tabular-nums text-slate-400 font-medium text-xs">{sr}</div>
                        </div>
                      </div>
                    )
                  })
                )}

              </div>

              {/* Extras Strip */}
              {currentInningsData.extras && (
                <div className="bg-slate-50/50 px-6 py-4 flex items-center justify-between border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Extras</span>
                    <span className="text-sm font-medium text-slate-900">
                      {Number(currentInningsData.extras.wides || 0) + Number(currentInningsData.extras.noBalls || 0) + Number(currentInningsData.extras.byes || 0) + Number(currentInningsData.extras.legByes || 0)}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">{formatExtrasShort(currentInningsData.extras) || 'None'}</span>
                </div>
              )}
            </div>

            {/* Bowling Card */}
            <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600/10 flex items-center justify-center">
                    <img src={cricketBallIcon} alt="" className="w-5 h-5 object-contain" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-900 uppercase tracking-widest">Bowling Analysis</h3>
                </div>
              </div>

              {/* Bowling Header */}
              <div className="px-6 pt-6 pb-2">
                <div
                  className="grid items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-widest"
                  style={{ gridTemplateColumns: 'minmax(0,1fr) 40px 30px 40px 40px 60px' }}
                >
                  <div className="text-left">Bowler</div>
                  <div className="text-right">O</div>
                  <div className="text-right">M</div>
                  <div className="text-right">R</div>
                  <div className="text-right">W</div>
                  <div className="text-right">Eco</div>
                </div>
              </div>

              <div className="divide-y divide-slate-50">
                {(currentInningsData.bowlerStats || []).length === 0 ? (
                  <div className="py-12 text-center text-slate-400 italic uppercase font-medium text-xs tracking-widest">Waiting for bowlers...</div>
                ) : (
                  currentInningsData.bowlerStats.map((bowler: any, idx: number) => {
                    const player = playersMap.get(bowler.bowlerId)
                    const name = bowler.bowlerName || player?.name || 'Bowler'
                    const eco = (bowler.economy ? Number(bowler.economy) : 0).toFixed(2)

                    return (
                      <div key={idx} className="px-6 py-5 hover:bg-slate-50/30 transition-colors">
                        <div
                          className="grid items-center gap-2"
                          style={{ gridTemplateColumns: 'minmax(0,1fr) 40px 30px 40px 40px 60px' }}
                        >
                          <PlayerLink playerId={bowler.bowlerId} playerName={name} className="text-sm sm:text-base font-medium text-slate-900 truncate" />
                          <div className="text-right tabular-nums text-slate-900 font-medium">{bowler.overs || '0.0'}</div>
                          <div className="text-right tabular-nums text-slate-400 font-medium">{bowler.maidens || 0}</div>
                          <div className="text-right tabular-nums text-slate-900 font-medium">{bowler.runsConceded || 0}</div>
                          <div className="text-right tabular-nums text-emerald-600 font-medium">{bowler.wickets || 0}</div>
                          <div className="text-right tabular-nums text-slate-400 font-medium text-xs">{eco}</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Did Not Bat (Refined) */}
            <DidNotBatSection
              playingXI={currentTab?.inningId === 'teamA' ? (matchData.teamAPlayingXI || []) : (matchData.teamBPlayingXI || [])}
              batsmenStats={currentInningsData.batsmanStats || []}
              playersMap={playersMap}
            />
          </div>
        ) : (
          <div className="py-40 text-center">
            <span className="text-5xl block mb-4 opacity-10">🏟️</span>
            <p className="text-sm font-medium text-slate-300 uppercase tracking-[0.4em]">Innings Data Unavailable</p>
          </div>
        )}
      </div>
    </div>
  )
}

function DidNotBatSection({
  playingXI,
  batsmenStats,
  playersMap
}: {
  playingXI: any[]
  batsmenStats: any[]
  playersMap: Map<string, any>
}) {
  const battedPlayerIds = new Set(batsmenStats.map((b: any) => b.batsmanId))
  const didNotBat = (playingXI || []).filter(item => {
    const id = typeof item === 'string' ? item : (item as any).playerId || (item as any).id
    return id && !battedPlayerIds.has(id)
  })

  if (didNotBat.length === 0) return null



  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 bg-slate-50/50 border-b border-slate-100">
        <h3 className="text-xs font-medium text-slate-400 uppercase tracking-[0.2em]">Did Not Bat</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {didNotBat.map((playerIdOrObj: any) => {
            const playerId = typeof playerIdOrObj === 'string' ? playerIdOrObj : playerIdOrObj.playerId || playerIdOrObj.id
            const player = playersMap.get(playerId)
            const playerName = player?.name || 'Player'

            return (
              <div key={playerId} className="flex items-center gap-3 p-2 rounded-[1rem] hover:bg-slate-50 transition-colors group">
                <div className="relative shrink-0">
                  <PlayerAvatar
                    photoUrl={player?.photoUrl || player?.photo}
                    name={playerName}
                    size="md"
                  />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                  </div>
                </div>
                <div className="min-w-0">
                  <PlayerLink
                    playerId={playerId}
                    playerName={playerName}
                    className="text-xs font-medium text-slate-900 truncate block group-hover:text-blue-600 transition-colors"
                  />
                  <span className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">{player?.role || 'Batter'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
