/**
 * Match Scorecard Page
 * CREX-style full scorecard with innings tabs
 */

import React, { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { Match, InningsStats } from '@/types'
import ScorecardSkeleton from '@/components/skeletons/ScorecardSkeleton'
import PlayerLink from '@/components/PlayerLink'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import { formatShortTeamName } from '@/utils/teamName'

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
  const [matchData, setMatchData] = React.useState<Match | null>(null)
  const [teamAInnings, setTeamAInnings] = React.useState<InningsStats | null>(null)
  const [teamBInnings, setTeamBInnings] = React.useState<InningsStats | null>(null)
  const [teamASuperInnings, setTeamASuperInnings] = React.useState<InningsStats | null>(null)
  const [teamBSuperInnings, setTeamBSuperInnings] = React.useState<InningsStats | null>(null)
  const [playersMap, setPlayersMap] = React.useState<Map<string, any>>(new Map())
  const [selectedInning, setSelectedInning] = React.useState<string>('teamA-1')
  const [loading, setLoading] = React.useState(true)
  const didAutoSelect = React.useRef(false)

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
        const [inningsA, inningsB, inningsASO, inningsBSO] = await Promise.all([
          matchService.getInnings(matchId, 'teamA').catch(() => null),
          matchService.getInnings(matchId, 'teamB').catch(() => null),
          matchService.getInnings(matchId, 'teamA_super').catch(() => null),
          matchService.getInnings(matchId, 'teamB_super').catch(() => null),
        ])

        if (inningsA) setTeamAInnings(inningsA)
        if (inningsB) setTeamBInnings(inningsB)
        if (inningsASO) setTeamASuperInnings(inningsASO)
        if (inningsBSO) setTeamBSuperInnings(inningsBSO)
      } catch (err) {
        console.warn('[MatchScorecard] Initial load failed:', err)
      }
    }

    loadInitialInnings()

    // Subscribe to real-time updates
    const unsubA = matchService.subscribeToInnings(matchId, 'teamA', (innings) => {
      if (innings) setTeamAInnings(innings)
    })

    const unsubB = matchService.subscribeToInnings(matchId, 'teamB', (innings) => {
      if (innings) setTeamBInnings(innings)
    })

    const unsubASuper = matchService.subscribeToInnings(matchId, 'teamA_super', (innings) => {
      if (innings) setTeamASuperInnings(innings)
    })

    const unsubBSuper = matchService.subscribeToInnings(matchId, 'teamB_super', (innings) => {
      if (innings) setTeamBSuperInnings(innings)
    })

    return () => {
      unsubA()
      unsubB()
      unsubASuper()
      unsubBSuper()
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

    const tabs: Array<{ id: string; label: string; inningId: string; inningNumber: number }> = []

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
    const shortNameFor = (side: 'teamA' | 'teamB') => formatShortTeamName(nameFor(side))

    // Always show BOTH pills/tabs (fixed order): 1st innings on left, 2nd innings on right.
    tabs.push({ id: `${first}-1`, label: `${shortNameFor(first)}`, inningId: first, inningNumber: 1 })
    tabs.push({ id: `${second}-2`, label: `${shortNameFor(second)}`, inningId: second, inningNumber: 2 })

    // Add Super Over tabs if match has super over data
    if (matchData.isSuperOver || hasStarted(teamASuperInnings) || hasStarted(teamBSuperInnings)) {
      // In Super Over, team that batted second bats first
      const soFirst = second  // team batting second in main match bats first in SO
      const soSecond = first
      tabs.push({ id: `${soFirst}_super`, label: `${shortNameFor(soFirst)} SO`, inningId: `${soFirst}_super`, inningNumber: 3 })
      tabs.push({ id: `${soSecond}_super`, label: `${shortNameFor(soSecond)} SO`, inningId: `${soSecond}_super`, inningNumber: 4 })
    }

    return tabs
  }, [matchData, teamAInnings, teamBInnings, teamASuperInnings, teamBSuperInnings, teamAName, teamBName])

  // Ensure selectedInning always points to an existing tab (important when first-innings side isn't teamA)
  useEffect(() => {
    if (inningsTabs.length === 0) return
    if (!inningsTabs.some((t) => t.id === selectedInning)) {
      setSelectedInning(inningsTabs[0].id)
    }
  }, [inningsTabs, selectedInning])

  const currentTab = inningsTabs.find(t => t.id === selectedInning) || inningsTabs[0]

  // Auto-select live innings tab once match data is available
  useEffect(() => {
    if (matchData && inningsTabs.length > 0 && !didAutoSelect.current) {
      const status = matchData.status?.toLowerCase()
      const isLive = status === 'live' || status === 'inningsbreak'
      const isFinished = status === 'finished' || status === 'completed'

      if (isLive) {
        const currentBatting = matchData.currentBatting || 'teamA'
        const liveTab = inningsTabs.find(t => t.inningId === currentBatting)
        if (liveTab) {
          setSelectedInning(liveTab.id)
          didAutoSelect.current = true
        }
      } else if (isFinished) {
        // For finished matches, jump to the last innings played (usually 2nd innings or Super Over)
        const lastTab = inningsTabs[inningsTabs.length - 1]
        if (lastTab) {
          setSelectedInning(lastTab.id)
          didAutoSelect.current = true
        }
      }
    }
  }, [matchData, inningsTabs])

  const currentInningsDataRaw = useMemo(() => {
    if (!currentTab) return null
    const iid = currentTab.inningId
    if (iid === 'teamA') return teamAInnings
    if (iid === 'teamB') return teamBInnings
    if (iid === 'teamA_super') return teamASuperInnings
    if (iid === 'teamB_super') return teamBSuperInnings
    return null
  }, [currentTab, teamAInnings, teamBInnings, teamASuperInnings, teamBSuperInnings])

  // Fallback: Build batsmanStats from playingXI if innings data exists but batsmanStats is empty
  const currentInningsData = useMemo(() => {
    if (!matchData || !currentTab) return currentInningsDataRaw

    const isSuper = currentTab.inningId.includes('super')
    const isTeamA = currentTab.inningId.startsWith('teamA')
    const mainTotal = !isSuper ? (isTeamA ? matchData.mainMatchScore?.teamA : matchData.mainMatchScore?.teamB) : null

    // Case 1: Active Inning with real ball-by-ball data
    if (currentInningsDataRaw && (currentInningsDataRaw.totalRuns > 0 || currentInningsDataRaw.legalBalls > 0)) {
      // If our summary has MORE runs than detail (sync delay), update summary fields but keep stats
      if (mainTotal && mainTotal.runs > currentInningsDataRaw.totalRuns) {
        return {
          ...currentInningsDataRaw,
          totalRuns: mainTotal.runs,
          totalWickets: mainTotal.wickets,
          overs: mainTotal.overs,
        }
      }
      return currentInningsDataRaw
    }

    // Case 2: Inning has not "truly" started but we have summary data (for main match tabs during SO)
    if (!isSuper && mainTotal && (mainTotal.runs > 0 || mainTotal.wickets > 0)) {
      return {
        matchId: matchData.id,
        inningId: currentTab.inningId,
        totalRuns: mainTotal.runs,
        totalWickets: mainTotal.wickets,
        overs: mainTotal.overs,
        legalBalls: 0,
        batsmanStats: currentInningsDataRaw?.batsmanStats || [],
        bowlerStats: currentInningsDataRaw?.bowlerStats || [],
        fallOfWickets: currentInningsDataRaw?.fallOfWickets || [],
        partnership: currentInningsDataRaw?.partnership || { runs: 0, balls: 0, overs: '0.0' },
        extras: currentInningsDataRaw?.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
        recentOvers: [],
        _isSummaryOnly: !((currentInningsDataRaw?.batsmanStats?.length || 0) > 0),
        _playingXI: isTeamA ? (matchData.teamAPlayingXI || []) : (matchData.teamBPlayingXI || [])
      } as any
    }

    return currentInningsDataRaw
  }, [currentInningsDataRaw, matchData, currentTab, playersMap])



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
    <div className="min-h-screen bg-slate-50 dark:bg-[#060b16] text-slate-900 dark:text-white pb-20 font-sans">
      {/* 1. Header Area - Minimal sticky header */}
      {!compact && (
        <div className="bg-[#0f172a] border-b border-white/5 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 text-center pr-8">
              <h1 className="text-[14px] font-semibold text-white uppercase tracking-tight">
                Scorecard
              </h1>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 2. Top Innings Tab Switcher */}
        <div className="flex gap-2.5 px-0.5 overflow-x-auto no-scrollbar pb-1">
          {inningsTabs.map((tab) => {
            const isSuperTab = tab.inningId.includes('super');
            const baseSide = tab.inningId.replace('_super', '').replace('_super2', '') as 'teamA' | 'teamB';
            const inn = isSuperTab
              ? (tab.inningId === 'teamA_super' ? teamASuperInnings : teamBSuperInnings)
              : (baseSide === 'teamA' ? teamAInnings : teamBInnings);

            // Logic to pick best available score
            const mainTotal = !isSuperTab ? (baseSide === 'teamA' ? matchData?.mainMatchScore?.teamA : matchData?.mainMatchScore?.teamB) : null;

            let displayRuns = inn?.totalRuns || 0;
            let displayWickets = inn?.totalWickets || 0;
            let displayOvers = formatOversDisplay(inn?.legalBalls || 0);

            // If detail is 0 but summary has data, use summary
            if (!isSuperTab && mainTotal && mainTotal.runs > displayRuns) {
              displayRuns = mainTotal.runs;
              displayWickets = mainTotal.wickets;
              displayOvers = mainTotal.overs;
            }

            const isActive = selectedInning === tab.id;
            const hasData = displayRuns > 0 || displayWickets > 0 || (inn && inn.legalBalls > 0);

            return (
              <button
                key={tab.id}
                onClick={() => setSelectedInning(tab.id)}
                className={`flex-1 min-w-[120px] px-5 py-3 rounded-xl transition-all duration-200 border
                  ${isActive
                    ? (isSuperTab
                      ? 'bg-amber-500 border-amber-400 text-white shadow-md'
                      : 'bg-[#0f4c81] border-[#0f4c81] text-white shadow-md')
                    : 'bg-white dark:bg-[#111827] border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
              >
                <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                  <span className={`text-[13px] font-bold uppercase tracking-wide
                    ${isActive ? 'text-white' : 'text-slate-700 dark:text-slate-300'}
                  `}>
                    {tab.label}
                  </span>

                  {hasData ? (
                    <span className={`text-[14px] font-bold tabular-nums
                      ${isActive ? 'text-white' : 'text-slate-900 dark:text-white'}
                    `}>
                      {displayRuns}-{displayWickets}
                      <span className={`text-[11px] font-medium ml-0.5 ${isActive ? 'text-white/70' : 'text-slate-400'}`}>({displayOvers})</span>
                    </span>
                  ) : (
                    <span className={`text-[11px] font-medium italic
                      ${isActive ? 'text-white/80' : 'text-slate-400'}
                    `}>
                      {isSuperTab ? 'Waiting...' : 'Yet to bat'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* 3. Main Body Sections */}
        {currentInningsData ? (
          <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-sm border border-slate-100 dark:border-white/5 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
            {currentInningsData._isSummaryOnly && (
              <div className="bg-blue-50/50 dark:bg-blue-900/20 px-6 py-8 text-center border-b border-blue-100 dark:border-blue-500/20">
                <div className="text-[24px] font-semibold text-slate-900 dark:text-white mb-1">
                  {currentInningsData.totalRuns}-{currentInningsData.totalWickets}
                </div>
                <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-widest">
                  Overs: {currentInningsData.overs}
                </div>
                <div className="mt-4 text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-500/10 py-1 px-3 rounded-full inline-block">
                  Main Match Score Summary
                </div>
              </div>
            )}

            {/* BATTING SECTION */}
            <div className="pb-4">
              <div className="bg-slate-50/50 dark:bg-white/[0.03] px-5 py-3 border-y border-slate-100 dark:border-white/5 mb-2">
                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em]">BATTING</h3>
              </div>

              <div className="px-5 py-3.5 grid grid-cols-[5fr,1fr,1fr,1fr,1fr,1.3fr] gap-1 items-center text-slate-400 text-[10px] font-semibold border-b border-slate-100 dark:border-white/5 uppercase tracking-wider">
                <span className="text-blue-600 dark:text-[#4a90e2]">Batter</span>
                <span className="text-center font-medium">R</span>
                <span className="text-center font-medium">B</span>
                <span className="text-center font-medium">4s</span>
                <span className="text-center font-medium">6s</span>
                <span className="text-right font-medium">SR</span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {(() => {
                  const rawBatsmen = [...(currentInningsData.batsmanStats || [])];
                  const hasBattingPosition = rawBatsmen.some((b: any) => b.battingPosition !== undefined);

                  let sortedBatsmen: any[];
                  if (hasBattingPosition) {
                    // New data: sort by battingPosition from engine
                    sortedBatsmen = rawBatsmen.sort((a: any, b: any) =>
                      (a.battingPosition ?? 999) - (b.battingPosition ?? 999)
                    );
                  } else {
                    // Existing matches: infer batting order from fallOfWickets
                    const fow = currentInningsData.fallOfWickets || [];
                    const fowOrder = new Map<string, number>();
                    fow.forEach((fw: any, i: number) => {
                      if (fw.batsmanId && !fowOrder.has(fw.batsmanId)) {
                        fowOrder.set(fw.batsmanId, i);
                      }
                    });

                    // Dismissed batsmen in FOW order (approximates batting position)
                    const dismissed = rawBatsmen
                      .filter((b: any) => fowOrder.has(b.batsmanId))
                      .sort((a: any, b: any) => (fowOrder.get(a.batsmanId) ?? 0) - (fowOrder.get(b.batsmanId) ?? 0));

                    // Not-out batsmen at end, sorted by balls faced desc (more balls = came in earlier)
                    const notOut = rawBatsmen
                      .filter((b: any) => !fowOrder.has(b.batsmanId))
                      .sort((a: any, b: any) => (b.balls || 0) - (a.balls || 0));

                    sortedBatsmen = [...dismissed, ...notOut];
                  }

                  return sortedBatsmen;
                })().map((b: any, idx: number) => {
                  const isActive = (b.batsmanId === (matchData as any).currentStrikerId || b.batsmanId === (matchData as any).currentNonStrikerId);
                  const isStriker = b.batsmanId === (matchData as any).currentStrikerId;

                  return (
                    <div key={idx} className="px-5 py-5 transition-colors group hover:bg-slate-50 dark:hover:bg-white/[0.03]">
                      <div className="grid grid-cols-[5fr,1fr,1fr,1fr,1fr,1.3fr] gap-1 items-start">
                        <div className="min-w-0 pr-2">
                          <PlayerLink
                            playerId={b.batsmanId}
                            playerName={b.batsmanName}
                            className={`text-[13px] font-semibold leading-none block truncate ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-slate-200'}`}
                          >
                            {formatPlayerScorecardName(b.batsmanName)}
                            {b.batsmanId === (currentTab?.inningId.startsWith('teamA') ? matchData.teamACaptainId : matchData.teamBCaptainId) && ' (C)'}
                            {b.batsmanId === (currentTab?.inningId.startsWith('teamA') ? matchData.teamAKeeperId : matchData.teamBKeeperId) && ' (wk)'}
                            {isStriker && isActive && '*'}
                          </PlayerLink>
                          <div className="text-[10px] mt-1.5 font-medium text-slate-500 leading-tight truncate">
                            {b.dismissal || (isActive && matchData.status === 'live' ? 'Batting' : 'Not out')}
                          </div>
                        </div>
                        <span className="text-center text-[14px] font-semibold text-slate-900 dark:text-white tabular-nums">{b.runs}</span>
                        <span className="text-center text-[11px] font-semibold text-slate-600 dark:text-slate-400 tabular-nums pt-0.5">{b.balls}</span>
                        <span className="text-center text-[11px] font-semibold text-slate-600 dark:text-slate-400 tabular-nums pt-0.5">{b.fours}</span>
                        <span className="text-center text-[11px] font-semibold text-slate-600 dark:text-slate-400 tabular-nums pt-0.5">{b.sixes}</span>
                        <span className="text-right text-[10px] font-semibold text-slate-600 dark:text-slate-400 tabular-nums pt-0.5">
                          {b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : '0.0'}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Extras Final Section */}
                <div className="px-5 py-4 border-t border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-slate-400">Extras</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-slate-900 dark:text-white">
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
              <h3 className="text-[12px] font-semibold text-slate-400 uppercase tracking-wider">YET TO BAT</h3>
              <div className="grid grid-cols-2 gap-y-10 gap-x-12">
                {(() => {
                  const battedPlayerIds = new Set(currentInningsData.batsmanStats?.map((b: any) => b.batsmanId));
                  const playingXI = currentTab?.inningId.startsWith('teamA') ? (matchData.teamAPlayingXI || []) : (matchData.teamBPlayingXI || []);
                  const yetToBat = playingXI.filter((item: any) => {
                    const id = typeof item === 'string' ? item : (item as any).playerId || (item as any).id;
                    return id && !battedPlayerIds.has(id);
                  });

                  return yetToBat.map((playerIdOrObj: any) => {
                    const pid = typeof playerIdOrObj === 'string' ? playerIdOrObj : playerIdOrObj.playerId || playerIdOrObj.id;
                    const p = playersMap.get(pid);
                    return (
                      <div key={pid} className="flex items-center gap-5 group">
                        <div className="w-12 h-12 rounded-full border border-white/10 overflow-hidden shrink-0 shadow-sm transition-transform group-hover:scale-105">
                          <PlayerAvatar photoUrl={p?.photoUrl || p?.photo} name={p?.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0">
                          <PlayerLink playerId={pid} playerName={p?.name || 'Player'} className={`text-[14px] font-semibold text-slate-800 dark:text-slate-200 block group-hover:text-blue-500`}>
                            {formatPlayerScorecardName(p?.name || 'Player')}
                            {pid === (currentTab?.inningId.startsWith('teamA') ? matchData.teamACaptainId : matchData.teamBCaptainId) && ' (C)'}
                            {pid === (currentTab?.inningId.startsWith('teamA') ? matchData.teamAKeeperId : matchData.teamBKeeperId) && ' (wk)'}
                          </PlayerLink>
                          <div className="text-[12px] font-medium text-slate-500 mt-1">
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
              <div className="bg-white/[0.03] px-5 py-3 border-y border-white/5 mb-2">
                <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.2em]">BOWLING</h3>
              </div>

              <div className="px-5 py-3.5 grid grid-cols-2 gap-2 items-center text-slate-400 text-[10px] font-semibold border-b border-slate-100 dark:border-white/5 uppercase tracking-wider">
                <div className="flex items-center gap-1 text-[#4a90e2]">
                  Bowler <span className="text-[10px]">↓</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  <span className="text-center font-medium">O</span>
                  <span className="text-center font-medium">M</span>
                  <span className="text-center font-medium">R</span>
                  <span className="text-center font-medium">W</span>
                  <span className="text-right font-medium">Eco</span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-white/5">
                {currentInningsData.bowlerStats?.map((bw: any, idx: number) => {
                  const isActive = bw.bowlerId === currentInningsData.currentBowlerId;
                  return (
                    <div key={idx} className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group border-b border-slate-100 dark:border-white/5 last:border-0">
                      <div className="grid grid-cols-2 gap-2 items-center">
                        <div className="flex items-center gap-2 min-w-0">
                          <PlayerLink
                            playerId={bw.bowlerId}
                            playerName={bw.bowlerName}
                            className={`text-[14px] font-semibold truncate whitespace-nowrap text-slate-800 dark:text-slate-300 hover:text-blue-500`}
                          >
                            {formatPlayerScorecardName(bw.bowlerName)}
                          </PlayerLink>
                          {isActive && <div className="w-2 h-2 bg-slate-500 rounded-full"></div>}
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          <span className="text-center text-[13px] font-semibold text-slate-700 dark:text-slate-400 tabular-nums">{bw.overs}</span>
                          <span className="text-center text-[13px] font-semibold text-slate-700 dark:text-slate-400 tabular-nums">{bw.maidens || 0}</span>
                          <span className="text-center text-[13px] font-semibold text-slate-700 dark:text-slate-400 tabular-nums">{bw.runsConceded}</span>
                          <span className="text-center text-[14px] font-semibold text-slate-900 dark:text-white tabular-nums">{bw.wickets}</span>
                          <span className="text-right text-[13px] font-semibold text-slate-700 dark:text-slate-500 tabular-nums">{(bw.economy || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FALL OF WICKETS SECTION */}
            {(currentInningsData.fallOfWickets?.length || 0) > 0 && (
              <div className="mt-4">
                <div className="bg-white/[0.03] px-5 py-3 border-y border-white/5 mb-2">
                  <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.2em]">FALL OF WICKETS</h3>
                </div>

                <div className="px-5 py-3.5 flex items-center justify-between text-slate-400 text-[10px] font-semibold border-b border-slate-100 dark:border-white/5 uppercase tracking-wider">
                  <span className="w-1/2">Batter</span>
                  <div className="flex-1 flex justify-between pr-2">
                    <span className="flex-1 text-center">Score</span>
                    <span className="w-14 text-right">Over</span>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {currentInningsData.fallOfWickets.map((fw: any, i: number) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors">
                      <div className="w-1/2 min-w-0 pr-4">
                        <div className="text-[14px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {fw.batsmanName || 'Player'}
                          {fw.batsmanId === (currentTab?.inningId.startsWith('teamA') ? matchData.teamACaptainId : matchData.teamBCaptainId) && ' (C)'}
                        </div>
                      </div>

                      <div className="flex-1 flex justify-between items-center pr-2">
                        <span className="flex-1 text-center text-[14px] font-semibold text-slate-900 dark:text-white tabular-nums">
                          {fw.wicket}-{fw.score}
                        </span>
                        <span className="w-14 text-right text-[13px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
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
              <div className="bg-white/[0.03] px-5 py-3 border-y border-white/5 mb-2">
                <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.2em]">PARTNERSHIPS</h3>
              </div>

              {/* Batter Indicators */}
              <div className="flex items-center justify-between px-5 mb-4 gap-4 flex-wrap">
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider truncate max-w-[45%]">
                  {(() => {
                    const p = currentInningsData?.partnership?.batter1;
                    const id = p?.id || (matchData as any).currentStrikerId;
                    return playersMap.get(id)?.name || currentInningsData?.batsmanStats?.find((s: any) => s.batsmanId === id)?.batsmanName || 'Batter 1';
                  })()}
                </span>
                <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-500 uppercase tracking-wider truncate max-w-[45%]">
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
                      <div key={idx} className={`px-5 py-6 ${p.isCurrent ? 'bg-blue-500/5 shadow-[inset_4px_0_0_#f5a623]' : 'bg-transparent'} border-b border-slate-100 dark:border-white/5 last:border-0`}>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-4">
                          {wNo}{suffix} WICKET
                        </div>

                        <div className="flex items-start justify-between">
                          <div className="w-1/3 min-w-0">
                            <div className="text-[14px] font-semibold text-emerald-600 dark:text-emerald-400 truncate mb-1">
                              {b1Name}
                            </div>
                            <div className="text-[14px] font-semibold text-slate-900 dark:text-white leading-none">
                              {b1Runs} <span className="text-[11px] text-slate-600 dark:text-slate-500 font-semibold ml-0.5">({p.batter1?.balls || 0})</span>
                            </div>
                          </div>

                          <div className="flex-1 flex flex-col items-center pt-0.5">
                            <div className="flex items-baseline gap-1.5 mb-3">
                              <span className="text-[18px] font-semibold text-[#f5a623]">{p.runs}</span>
                              <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-500">({p.balls})</span>
                            </div>

                            <div className="w-[100px] h-[6px] bg-slate-200 dark:bg-slate-800 flex overflow-hidden rounded-full ring-1 ring-slate-300 dark:ring-white/10">
                              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${b1Pct}%` }}></div>
                              <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400" style={{ width: `${b2Pct}%` }}></div>
                            </div>
                          </div>

                          <div className="w-1/3 text-right min-w-0">
                            <div className="text-[14px] font-semibold text-rose-600 dark:text-rose-400 truncate mb-1">
                              {b2Name}
                            </div>
                            <div className="text-[14px] font-semibold text-slate-900 dark:text-white leading-none">
                              <span className="text-[11px] text-slate-600 dark:text-slate-500 font-semibold mr-1">({p.batter2?.balls || 0})</span> {b2Runs}
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
          <div className="py-40 text-center bg-[#0f172a] rounded-2xl shadow-sm border border-white/5">
            <div className="w-16 h-16 bg-white/[0.05] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl text-slate-500">🏟️</span>
            </div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.4em]">Innings Not Started Yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
