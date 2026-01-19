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

export default function MatchScorecard() {
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      {/* Match Summary Header - Premium (cricket-style) */}
      <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Teams Row */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 mb-3">
            {/* Left Team */}
            <div className="min-w-0">
              <div className="text-base sm:text-xl font-extrabold tracking-tight truncate text-slate-900">{firstName}</div>
              <div className="text-xs sm:text-sm font-bold text-slate-500 mt-0.5">
                {firstInns?.totalRuns || 0}-{firstInns?.totalWickets || 0}{' '}
                <span className="text-slate-400 font-medium">({formatOversDisplay(firstInns?.legalBalls || 0)})</span>
              </div>
            </div>

            {/* VS Badge */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-white flex items-center justify-center text-[10px] sm:text-xs font-black shadow-lg border-2 border-white">
              VS
            </div>

            {/* Right Team */}
            <div className="min-w-0 text-right">
              <div className="text-base sm:text-xl font-extrabold tracking-tight truncate text-slate-900">{secondName}</div>
              <div className="text-xs sm:text-sm font-bold text-slate-500 mt-0.5">
                {secondInns?.totalRuns || 0}-{secondInns?.totalWickets || 0}{' '}
                <span className="text-slate-400 font-medium">({formatOversDisplay(secondInns?.legalBalls || 0)})</span>
              </div>
            </div>
          </div>

          {/* Result Row */}
          {matchResult ? (
            <div className="flex justify-center mt-2">
              <div className="inline-flex items-center text-center px-4 py-1.5 rounded-full bg-amber-50 border border-amber-100 text-amber-700 text-[11px] sm:text-xs font-black uppercase tracking-wider shadow-sm">
                {matchResult}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Scorecard Content */}
        {currentInningsData ? (
          <div className="space-y-6">
            {/* Team Score Button - Forced Same Row */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => inningsTabs[0] && setSelectedInning(inningsTabs[0].id)}
                className={[
                  'px-2 sm:px-5 py-2 sm:py-3 rounded-2xl font-extrabold tracking-tight text-[11px] sm:text-sm transition',
                  'border shadow-sm flex items-center justify-center text-center',
                  selectedInning === (inningsTabs[0]?.id || '')
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
                ].join(' ')}
              >
                <span className="truncate">
                  {inningsTabs[0]?.inningId === 'teamA' ? teamAName : teamBName}{' '}
                  {(inningsTabs[0]?.inningId === 'teamA' ? teamAInnings?.totalRuns : teamBInnings?.totalRuns) || 0}
                  -
                  {(inningsTabs[0]?.inningId === 'teamA' ? teamAInnings?.totalWickets : teamBInnings?.totalWickets) || 0}
                  {` (${(inningsTabs[0]?.inningId === 'teamA' ? teamAInnings?.overs : teamBInnings?.overs) || '0.0'})`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => inningsTabs[1] && setSelectedInning(inningsTabs[1].id)}
                className={[
                  'px-2 sm:px-5 py-2 sm:py-3 rounded-2xl font-extrabold tracking-tight text-[11px] sm:text-sm transition',
                  'border shadow-sm flex items-center justify-center text-center',
                  selectedInning === (inningsTabs[1]?.id || '')
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
                ].join(' ')}
              >
                <span className="truncate">
                  {inningsTabs[1]?.inningId === 'teamA' ? teamAName : teamBName}{' '}
                  {(inningsTabs[1]?.inningId === 'teamA' ? teamAInnings?.totalRuns : teamBInnings?.totalRuns) || 0}
                  -
                  {(inningsTabs[1]?.inningId === 'teamA' ? teamAInnings?.totalWickets : teamBInnings?.totalWickets) || 0}
                  {` (${(inningsTabs[1]?.inningId === 'teamA' ? teamAInnings?.overs : teamBInnings?.overs) || '0.0'})`}
                </span>
              </button>
            </div>

            {/* Batting Table - Dark Theme */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">Batting</div>
                </div>
                {/* Header row (always visible, screenshot-style) */}
                <div className="mt-3">
                  <div
                    className="grid items-center gap-1 sm:gap-2 text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider"
                    style={{
                      gridTemplateColumns: 'minmax(0,1fr) 36px 36px 36px 36px 56px',
                    }}
                  >
                    <div className="text-left">Batter</div>
                    <div className="text-right">R</div>
                    <div className="text-right">B</div>
                    <div className="text-right">4S</div>
                    <div className="text-right">6S</div>
                    <div className="text-right">SR</div>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {(!currentInningsData.batsmanStats || currentInningsData.batsmanStats.length === 0) ? (
                  <div className="px-5 py-10 text-center text-slate-500">Yet to bat</div>
                ) : (
                  currentInningsData.batsmanStats.map((batsman: any, idx: number) => {
                    const batsmanId = batsman.batsmanId || batsman.id || batsman.playerId
                    const player = batsmanId ? playersMap.get(batsmanId) : null
                    const batsmanName = batsman.batsmanName || batsman.name || player?.name || 'Player'

                    const runs = typeof batsman.runs === 'number' ? batsman.runs : (Number(batsman.runs) || 0)
                    const balls = typeof batsman.balls === 'number' ? batsman.balls : (Number(batsman.balls) || 0)
                    const fours = typeof batsman.fours === 'number' ? batsman.fours : (Number(batsman.fours) || 0)
                    const sixes = typeof batsman.sixes === 'number' ? batsman.sixes : (Number(batsman.sixes) || 0)
                    const strikeRate = batsman.strikeRate
                      ? (typeof batsman.strikeRate === 'number' ? batsman.strikeRate : parseFloat(batsman.strikeRate) || 0)
                      : (balls > 0 ? (runs / balls) * 100 : 0)

                    const isNotOut =
                      batsman.notOut === true ||
                      (batsman.notOut !== false && !batsman.dismissal && !batsman.dismissed && balls > 0)
                    const dismissalText = String(batsman.dismissal || batsman.dismissalText || '').trim()

                    // Get first word of name for mobile view
                    const displayName = isMobile ? getFirstName(batsmanName) : batsmanName

                    return (
                      <div key={idx} className="px-5 py-4">
                        <div
                          className="grid items-start gap-1 sm:gap-2"
                          style={{
                            gridTemplateColumns: 'minmax(0,1fr) 36px 36px 36px 36px 56px',
                          }}
                        >
                          <div className="min-w-0">
                            <PlayerLink playerId={batsmanId} playerName={batsmanName} className="text-sm sm:text-base font-extrabold text-slate-900 truncate block" title={batsmanName}>
                              {displayName}
                            </PlayerLink>
                            <div className="text-xs sm:text-sm mt-1">
                              {isNotOut ? (
                                <span className="text-emerald-700 font-semibold">Not out</span>
                              ) : (
                                <span className="text-slate-600 break-words">{dismissalText || 'Out'}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right tabular-nums font-extrabold text-slate-900">{runs}</div>
                          <div className="text-right tabular-nums text-slate-600">{balls}</div>
                          <div className="text-right tabular-nums text-slate-600">{fours}</div>
                          <div className="text-right tabular-nums text-slate-600">{sixes}</div>
                          <div className="text-right tabular-nums text-slate-600">{strikeRate.toFixed(2)}</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* Extras */}
            {currentInningsData.extras && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-slate-600 font-semibold">Extras:</div>
                  <div className="text-right">
                    <div className="text-slate-900 font-extrabold tabular-nums">
                      {Number(currentInningsData.extras.wides || 0) +
                        Number(currentInningsData.extras.noBalls || 0) +
                        Number(currentInningsData.extras.byes || 0) +
                        Number(currentInningsData.extras.legByes || 0)}
                    </div>
                    <div className="text-slate-500 text-sm">{formatExtrasShort(currentInningsData.extras) || '—'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Did Not Bat */}
            {currentTab?.inningId === 'teamA' && (
              <DidNotBatSection
                playingXI={matchData.teamAPlayingXI || []}
                batsmenStats={currentInningsData.batsmanStats || []}
                playersMap={playersMap}
              />
            )}
            {currentTab?.inningId === 'teamB' && (
              <DidNotBatSection
                playingXI={matchData.teamBPlayingXI || []}
                batsmenStats={currentInningsData.batsmanStats || []}
                playersMap={playersMap}
              />
            )}

            {/* Bowling Table - Dark Theme */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
              <div className="px-5 py-4 border-b border-slate-200">
                <div className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">Bowling</div>
                {/* Header row (always visible, screenshot-style) */}
                <div className="mt-3">
                  <div
                    className="grid items-center gap-1 sm:gap-2 text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider"
                    style={{
                      gridTemplateColumns: 'minmax(0,1fr) 36px 36px 36px 36px 56px',
                    }}
                  >
                    <div className="text-left">Bowler</div>
                    <div className="text-right">O</div>
                    <div className="text-right">M</div>
                    <div className="text-right">R</div>
                    <div className="text-right">W</div>
                    <div className="text-right">ECO</div>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {(currentInningsData.bowlerStats || []).length === 0 ? (
                  <div className="px-5 py-10 text-center text-slate-500">No bowling data available</div>
                ) : (
                  (currentInningsData.bowlerStats || []).map((bowler: any, idx: number) => {
                    const player = playersMap.get(bowler.bowlerId)
                    const name = bowler.bowlerName || player?.name || 'Bowler'
                    const overs = String(bowler.overs || '0.0')
                    const maidens = Number(bowler.maidens || 0)
                    const runsConceded = Number(bowler.runsConceded || 0)
                    const wickets = Number(bowler.wickets || 0)
                    const eco = bowler.economy ? Number(bowler.economy).toFixed(2) : '0.00'
                    
                    // Get first word of name for mobile view
                    const displayName = isMobile ? getFirstName(name) : name

                    return (
                      <div key={idx} className="px-5 py-4">
                        <div
                          className="grid items-center gap-1 sm:gap-2"
                          style={{
                            gridTemplateColumns: 'minmax(0,1fr) 36px 36px 36px 36px 56px',
                          }}
                        >
                          <PlayerLink playerId={bowler.bowlerId} playerName={name} className="min-w-0 text-sm sm:text-base text-slate-900 font-extrabold truncate block" title={name}>
                            {displayName}
                          </PlayerLink>
                          <div className="text-right tabular-nums text-slate-600">{overs}</div>
                          <div className="text-right tabular-nums text-slate-600">{maidens}</div>
                          <div className="text-right tabular-nums text-slate-600">{runsConceded}</div>
                          <div className="text-right tabular-nums text-slate-600">{wickets}</div>
                          <div className="text-right tabular-nums text-slate-600">{eco}</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p>Innings data not available</p>
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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-4">
      <div className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-4">Did Not Bat</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {didNotBat.map((playerIdOrObj: any) => {
          const playerId = typeof playerIdOrObj === 'string' ? playerIdOrObj : playerIdOrObj.playerId || playerIdOrObj.id
          const player = playersMap.get(playerId)
          const playerName = player?.name || 'Player'
          const stats = player?.stats || {}
          const strikeRate = stats.balls > 0 ? ((stats.runs || 0) / stats.balls) * 100 : 0

          return (
            <div key={playerId} className="flex items-center gap-2">
              <PlayerAvatar
                photoUrl={player?.photoUrl || (player as any)?.photo}
                name={playerName}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <PlayerLink playerId={playerId} playerName={playerName} className="text-sm font-semibold text-slate-900 truncate block" />
                <div className="text-xs text-slate-500">SR: {strikeRate.toFixed(2)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
