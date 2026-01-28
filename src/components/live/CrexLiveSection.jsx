/**
 * Professional Live Section Component
 * User-friendly, responsive design with better UX
 */
import React from 'react'
import { Link } from 'react-router-dom'
import ProjectedScoreTable from './ProjectedScoreTable'
import { ChevronRight } from 'lucide-react'
import { calculateWinProbability } from '../../services/ai/winProbabilityEngine'

import cricketBatIcon from '../../assets/cricket-bat.png'

const CrexLiveSection = ({
  striker,
  nonStriker,
  currentBowler,
  partnership,
  lastWicket,
  recentOvers,
  commentary,
  activeCommentaryFilter,
  onCommentaryFilterChange,
  currentRunRate,
  requiredRunRate,
  currentRuns,
  currentOvers,
  oversLimit,
  target,
  runsNeeded,
  ballsRemaining,
  matchStatus,
  matchPhase,
  currentInnings,
  teamAInnings,
  teamBInnings,
  teamASquad,
  teamBSquad,
  resultSummary,
  teamAName,
  teamBName,
  onlyCommentary,
}) => {
  const isFinishedMatch = matchStatus === 'Finished' || matchStatus === 'Completed';
  const isInningsBreak = matchStatus === 'InningsBreak';

  // Calculate Win Probability
  const winProb = React.useMemo(() => {
    if (isFinishedMatch) return { teamAWinProb: 50, teamBWinProb: 50 };

    const [ov, b] = (currentOvers || '0.0').toString().split('.');
    const legalBalls = (Number(ov) * 6) + Number(b || 0);
    const battingTeamSide = currentInnings?.inningId || 'teamA';

    // Extract last ball event for micro-adjustments
    const lastOver = recentOvers?.[recentOvers.length - 1];
    const lastBall = lastOver?.balls?.[lastOver.balls.length - 1];
    const lastBallEvent = lastBall?.value || lastBall?.runsOffBat || lastBall?.runs;

    return calculateWinProbability({
      currentRuns: Number(currentRuns || 0),
      wickets: Number(currentInnings?.totalWickets || 0),
      legalBalls,
      target: target ? Number(target) : null,
      oversLimit: Number(oversLimit || 20),
      battingTeamSide,
      lastBallEvent,
      isFinishedMatch
    });
  }, [currentRuns, currentInnings?.totalWickets, currentInnings?.inningId, currentOvers, target, oversLimit, isFinishedMatch, recentOvers]);

  const teamAProb = winProb.teamAWinProb;
  const teamBProb = winProb.teamBWinProb;

  // Format partnership
  const formatPartnership = () => {
    if (!partnership) return '0(0)'
    return `${partnership.runs || 0}(${partnership.balls || 0})`
  }

  // Format last wicket
  const formatLastWicket = () => {
    if (!lastWicket) return null
    return `${lastWicket.batsmanName || 'Batsman'} ${lastWicket.runs || 0}(${lastWicket.balls || 0})`
  }

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'highlights', label: 'Highlights' },
    { id: 'overs', label: 'Overs' },
    { id: 'wickets', label: 'W' },
    { id: 'sixes', label: '6s' },
    { id: 'fours', label: '4s' },
    { id: 'milestone', label: 'Milestones' },
  ]

  const filteredCommentary = React.useMemo(() => {
    if (!commentary) return []
    if (!activeCommentaryFilter || activeCommentaryFilter === 'all') return commentary
    return commentary.filter(item => {
      const isWicket = item.isWicket || item.milestone === 'wicket'
      const isSix = item.runs === 6 || item.milestone === '6'
      const isFour = item.runs === 4 || item.milestone === '4'
      switch (activeCommentaryFilter) {
        case 'wickets': return isWicket
        case 'sixes': return isSix
        case 'fours': return isFour
        case 'highlights': return item.isHighlight || isWicket || isSix || isFour
        case 'milestone': return !!item.milestone
        default: return true
      }
    })
  }, [commentary, activeCommentaryFilter])

  const oversGrouped = React.useMemo(() => {
    if (!commentary || activeCommentaryFilter !== 'overs') return []

    const groups = []
    const map = {}

    // Commentary arrives in chronological order [oldest -> newest]
    commentary.forEach(item => {
      // Use explicit overNumber if available, otherwise fallback to parsing over string
      let overGroupNum = item.overNumber
      if (!overGroupNum) {
        const overStr = String(item.over || '0.0')
        const [oversPart, ballsPart] = overStr.split('.')
        const overInt = parseInt(oversPart || '0')
        const ballInt = parseInt(ballsPart || '0')
        overGroupNum = (ballInt === 0 && overInt > 0) ? overInt : overInt + 1
      }

      const inningId = item.inningId || 'teamA'
      const key = `${inningId}-${overGroupNum}`

      if (!map[key]) {
        map[key] = {
          inningId,
          overNum: overGroupNum,
          balls: [],
          totalRuns: 0,
          timestamp: item.timestamp?.toMillis ? item.timestamp.toMillis() : (item.timestamp?.seconds ? item.timestamp.seconds * 1000 : Date.now())
        }
        groups.push(map[key])
      }

      // Add ball in chronological order (left to right)
      map[key].balls.push(item)
      map[key].totalRuns += Number(item.runs || 0)
    })

    // Sort groups so newest over is at the top
    const sorted = groups.sort((a, b) => b.timestamp - a.timestamp)

    const finalResult = []
    sorted.forEach((group, idx) => {
      // Add inning break if innings change
      if (idx > 0 && sorted[idx - 1].inningId !== group.inningId) {
        finalResult.push({ type: 'break', label: 'Inning Break' })
      }
      finalResult.push(group)
    })

    return finalResult
  }, [commentary, activeCommentaryFilter])

  const scrollRef = React.useRef(null)

  // Auto-scroll timeline
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [recentOvers, striker, nonStriker])

  return (
    <div className="bg-[#f8fafc] dark:bg-slate-950 min-h-screen pb-8">
      <div className="max-w-4xl mx-auto px-0 sm:px-4 py-3 space-y-0.5">

        {/* 1. Timeline Strip - Reduced spacing */}
        {!onlyCommentary && recentOvers && (
          <div className="px-4 py-1.5 overflow-hidden">
            <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-hide py-1" ref={scrollRef}>
              {[...recentOvers].map((over, idx) => {
                const overTotal = over.totalRuns ?? over.total ?? 0
                const isCurrentOver = idx === recentOvers.length - 1 && !over.isLocked;
                const ballsToShow = isCurrentOver ? (over.balls || []) : over.balls || [];

                return (
                  <React.Fragment key={idx}>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        OVER {over.overNumber}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {ballsToShow.map((b, bIdx) => {
                          let val = String(b?.value || b?.label || b?.runsOffBat || b?.runs || '').trim() || '0'
                          if (val === '·') val = '0'
                          const isBoundary = val === '4' || val === '6';
                          const isWicket = b?.type === 'wicket' || val === 'W' || val.toUpperCase().includes('OUT');

                          const baseDot = `w-7 h-7 rounded-full flex items-center justify-center font-semibold shrink-0 border transition-all text-[10px]`
                          let dotStyle = "bg-white dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 shadow-sm"

                          if (isBoundary) dotStyle = val === '4'
                            ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-white border-yellow-400 shadow-sm"
                            : "bg-gradient-to-br from-orange-500 to-amber-500 text-white border-orange-400 shadow-sm";

                          if (isWicket) dotStyle = "bg-rose-600 text-white border-rose-500 shadow-sm";

                          return (
                            <div key={bIdx} className={`${baseDot} ${dotStyle}`}>
                              {val.toUpperCase().includes('WIDE') ? 'wd' : val.toUpperCase().includes('NO BALL') ? 'nb' : val}
                            </div>
                          )
                        })}
                        {/* Empty Circles for Remaining Balls */}
                        {isCurrentOver && (() => {
                          const legalBallsCount = ballsToShow.filter(b => {
                            const val = String(b?.value || b?.label || b?.runs || '').toUpperCase();
                            return !val.includes('WD') && !val.includes('NB') && !val.includes('WIDE') && !val.includes('NO BALL');
                          }).length;
                          const remaining = Math.max(0, 6 - legalBallsCount);
                          return Array.from({ length: remaining }).map((_, i) => (
                            <div key={`empty-${i}`} className="w-7 h-7 rounded-full border border-slate-200 dark:border-slate-800 bg-transparent shrink-0" />
                          ));
                        })()}
                      </div>
                      <div className="flex items-center gap-1 ml-0.5 cursor-default">
                        <span className="text-[9px] font-bold text-slate-400">=</span>
                        <span className="text-[9px] font-black text-slate-700 dark:text-slate-300">{overTotal}</span>
                      </div>
                    </div>
                    {idx < recentOvers.length - 1 && <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 shrink-0" />}
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        )}

        {/* 2. Win Probability - Reference Mockup Accurate */}
        {!isFinishedMatch && !onlyCommentary && (
          <div className="bg-white dark:bg-slate-900 px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 space-y-1.5">
            {/* Top Row: Names & Centered Label */}
            <div className="flex items-center justify-between text-[11px] font-normal text-slate-500 dark:text-slate-400 tracking-wide">
              <span className="shrink-0">{teamAName.substring(0, 3).toUpperCase()}</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-[7px] leading-none">i</span>
                <span className="uppercase text-[9px] font-bold text-slate-400">Realtime Win %</span>
              </div>
              <span className="shrink-0">{teamBName.substring(0, 3).toUpperCase()}</span>
            </div>

            {/* Bottom Row: Proportions & Bar */}
            <div className="flex items-center gap-4">
              <span className="text-base font-black text-slate-900 dark:text-white tabular-nums w-10">{teamAProb}%</span>
              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden">
                <div className="h-full bg-rose-600 transition-all duration-1000 shadow-[0_0_8px_rgba(225,29,72,0.3)]" style={{ width: `${teamAProb}%` }}></div>
                <div className="h-full bg-blue-600 transition-all duration-1000 shadow-[0_0_8px_rgba(37,99,235,0.3)]" style={{ width: `${teamBProb}%` }}></div>
              </div>
              <span className="text-base font-black text-slate-900 dark:text-white tabular-nums w-10 text-right">{teamBProb}%</span>
            </div>
          </div>
        )}

        {!onlyCommentary && (
          <div className="bg-white border-y border-slate-100 divide-y divide-slate-100">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 uppercase tracking-tight">
                <span>Batter</span>
                <div className="flex gap-6 pr-1">
                  <span className="w-10 text-right">R (B)</span>
                  <span className="w-6 text-center">4s</span>
                  <span className="w-6 text-center">6s</span>
                  <span className="w-10 text-right">SR</span>
                </div>
              </div>
              <div className="space-y-3">
                {(() => {
                  const battersList = [striker, nonStriker].filter(Boolean);
                  // Sort by ID to keep positions stable during strike rotation
                  const stableBatters = [...battersList].sort((a, b) =>
                    String(a.id || a.playerId || a.batsmanId || '').localeCompare(String(b.id || b.playerId || b.batsmanId || ''))
                  );

                  return stableBatters.map((p, i) => (
                    <div key={p.id || i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {(p.id || p.playerId || p.batsmanId) && String(p.id || p.playerId || p.batsmanId) !== 'undefined' ? (
                          <Link to={`/players/${p.id || p.playerId || p.batsmanId}`} className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors">
                            {p.name}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-slate-800">{p.name}</span>
                        )}
                        {p.id === striker?.id && <img src={cricketBatIcon} className="w-4 h-4 opacity-40 ml-1" alt="" />}
                      </div>
                      <div className="flex gap-6 pr-1 text-sm font-medium text-slate-800 items-baseline">
                        <div className="w-10 text-right flex items-baseline justify-end gap-1">
                          <span className="text-base">{p.runs || 0}</span>
                          <span className="text-[10px] text-slate-400">({p.balls || 0})</span>
                        </div>
                        <span className="w-6 text-center text-slate-700 font-medium">{p.fours || 0}</span>
                        <span className="w-6 text-center text-slate-700 font-medium">{p.sixes || 0}</span>
                        <span className="w-10 text-right text-slate-800 font-semibold text-xs">{(p.strikeRate || (p.balls > 0 ? (p.runs / p.balls * 100) : 0)).toFixed(1)}</span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">P'ship:</span>
                  <span className="text-xs font-bold text-slate-800">{formatPartnership()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Last wkt:</span>
                  <span className="text-xs font-bold text-slate-800">{formatLastWicket() || '—'}</span>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 uppercase tracking-tight">
                <span>Bowler</span>
                <div className="flex gap-6 pr-1">
                  <span className="w-10 text-right">W-R</span>
                  <span className="w-10 text-center">Overs</span>
                  <span className="w-10 text-right">ECO</span>
                </div>
              </div>
              {currentBowler && (
                <div className="flex items-center justify-between">
                  {(currentBowler.id || currentBowler.playerId || currentBowler.bowlerId) && String(currentBowler.id || currentBowler.playerId || currentBowler.bowlerId) !== 'undefined' ? (
                    <Link to={`/players/${currentBowler.id || currentBowler.playerId || currentBowler.bowlerId}`} className="text-sm font-medium text-slate-800 hover:text-blue-600 transition-colors">
                      {currentBowler.name}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-slate-800">{currentBowler.name}</span>
                  )}
                  <div className="flex gap-6 pr-1 text-sm font-medium text-slate-800">
                    <span className="w-10 text-right text-base">{currentBowler.wickets || 0}-{currentBowler.runsConceded || 0}</span>
                    <span className="w-10 text-center text-slate-700 font-medium">{currentBowler.overs || '0.0'}</span>
                    <span className="w-10 text-right text-slate-700 font-medium">{(currentBowler.economy || (currentBowler.overs > 0 ? (currentBowler.runsConceded / currentBowler.overs) : 0)).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* First Innings: Projected Score - Shown only when NO target is set */}
        {!isFinishedMatch && !onlyCommentary && !isInningsBreak && (!target || Number(target) === 0) && (
          <div className="px-4 py-2 space-y-3">
            <h3 className="text-base font-medium text-slate-800">Projected Score</h3>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-4 space-y-4">
              <div className="text-[12px] font-medium text-slate-400 uppercase tracking-tight flex items-center gap-2">
                Projected Score <span className="text-[10px] font-medium text-slate-300 normal-case">as per RR.</span>
              </div>
              <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] bg-slate-50/50 p-3 text-[11px] font-medium text-slate-800 tabular-nums items-center">
                  <span className="text-slate-500">Run Rate</span>
                  <span className="text-right text-sm">{currentRunRate?.toFixed(1)}*</span>
                  <span className="text-right text-slate-400">12</span>
                  <span className="text-right text-slate-400">13</span>
                  <span className="text-right text-slate-400">15</span>
                </div>
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] p-3 text-[11px] font-medium text-slate-800 tabular-nums items-center">
                  <span className="text-slate-500 whitespace-nowrap">{oversLimit} Overs</span>
                  <span className="text-right text-sm">{Math.round((currentRuns || 0) + (currentRunRate || 0) * ((oversLimit || 20) - (Number(currentOvers || 0))))}</span>
                  <span className="text-right text-slate-800">{Math.round((currentRuns || 0) + 12 * ((oversLimit || 20) - (Number(currentOvers || 0))))}</span>
                  <span className="text-right text-slate-800">{Math.round((currentRuns || 0) + 13 * ((oversLimit || 20) - (Number(currentOvers || 0))))}</span>
                  <span className="text-right text-slate-800">{Math.round((currentRuns || 0) + 15 * ((oversLimit || 20) - (Number(currentOvers || 0))))}</span>
                </div>
              </div>
              <div className="text-[10px] font-medium text-slate-400 italic">
                * Based on current run rate of <span className="font-medium text-slate-500">{currentRunRate?.toFixed(2)}</span> (Current: {currentRuns} runs in {currentOvers} overs)
              </div>
            </div>
          </div>
        )}

        {/* Second Innings: "At this stage" comparison - Shown only when target > 0 */}
        {!isFinishedMatch && !onlyCommentary && !isInningsBreak && (target && Number(target) > 0) && (
          <div className="px-4 py-2 space-y-3">
            <h3 className="text-base font-medium text-slate-800">At this stage</h3>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-4 relative">
              <div className="absolute inset-0 bg-gradient-to-b from-slate-50/10 to-transparent" />

              <div className="flex items-center justify-between relative z-10">
                {/* Chasing Team (Left) */}
                {(() => {
                  const isTeamA = currentInnings?.inningId === 'teamA';
                  const squad = isTeamA ? teamASquad : teamBSquad;
                  const name = isTeamA ? teamAName : teamBName;
                  const logo = squad?.logoUrl;

                  return (
                    <div className="flex flex-col items-center gap-2 flex-1">
                      {squad?.id ? (
                        <Link to={`/squads/${squad.id}`}>
                          <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center p-1 shadow-sm overflow-hidden hover:scale-105 transition-transform">
                            {logo ? (
                              <img src={logo} className="w-full h-full object-contain" alt="" />
                            ) : (
                              <span className="text-lg font-black text-slate-300">{name[0]}</span>
                            )}
                          </div>
                        </Link>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center p-1 shadow-sm overflow-hidden">
                          {logo ? (
                            <img src={logo} className="w-full h-full object-contain" alt="" />
                          ) : (
                            <span className="text-lg font-black text-slate-300">{name[0]}</span>
                          )}
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">
                          {name.substring(0, 3).toUpperCase()}*
                        </div>
                        <div className="text-xl font-bold text-slate-900 tabular-nums">
                          {currentRuns}-{currentInnings?.totalWickets || 0}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Over Mark (Center) */}
                <div className="flex flex-col items-center px-4">
                  <div className="px-3 py-1 bg-slate-900 rounded-full text-[8px] font-bold text-white uppercase tracking-widest mb-1.5 shadow-sm">
                    {currentOvers} Overs
                  </div>
                  <div className="flex items-center gap-1.5 opacity-20">
                    <div className="h-px w-6 bg-slate-900"></div>
                    <span className="text-[10px] font-black text-slate-900">VS</span>
                    <div className="h-px w-6 bg-slate-900"></div>
                  </div>
                </div>

                {/* Defending Team (Right) */}
                {(() => {
                  const isTeamA = currentInnings?.inningId === 'teamA';
                  const defendingInning = isTeamA ? teamBInnings : teamAInnings;
                  const defendingSquad = isTeamA ? teamBSquad : teamASquad;
                  const defendingName = isTeamA ? teamBName : teamAName;
                  const defendingLogo = defendingSquad?.logoUrl;

                  // Helper to parse "2.4" -> 16 balls
                  const parseOversToBalls = (ovStr) => {
                    const [ov, b] = (ovStr || '0.0').toString().split('.');
                    return (Number(ov) * 6) + Number(b || 0);
                  };

                  const currentLegalBalls = parseOversToBalls(currentOvers);

                  // Find score at exact same over stage in 1st innings
                  const defenderProgress = defendingInning?.oversProgress || [];

                  // Robust lookup: Find by 'balls' number first, fallback to string match
                  let stageSnapshot = defenderProgress.find(p => p.balls === currentLegalBalls);

                  if (!stageSnapshot) {
                    // Fallback to closest earlier snapshot if exact ball count not found
                    stageSnapshot = defenderProgress.slice().reverse().find(p => (p.balls || parseOversToBalls(p.over)) <= currentLegalBalls);
                  }

                  return (
                    <div className="flex flex-col items-center gap-2 flex-1">
                      {defendingSquad?.id ? (
                        <Link to={`/squads/${defendingSquad.id}`}>
                          <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center p-1 shadow-sm overflow-hidden hover:scale-105 transition-transform">
                            {defendingLogo ? (
                              <img src={defendingLogo} className="w-full h-full object-contain" alt="" />
                            ) : (
                              <span className="text-lg font-black text-slate-300">{defendingName[0]}</span>
                            )}
                          </div>
                        </Link>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center p-1 shadow-sm overflow-hidden">
                          {defendingLogo ? (
                            <img src={defendingLogo} className="w-full h-full object-contain" alt="" />
                          ) : (
                            <span className="text-lg font-black text-slate-300">{defendingName[0]}</span>
                          )}
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-1">
                          {defendingName.substring(0, 3).toUpperCase()}
                        </div>
                        <div className="text-xl font-bold text-slate-900 tabular-nums">
                          {stageSnapshot ? `${stageSnapshot.runs}-${stageSnapshot.wickets}` : (defenderProgress.length > 0 ? '—' : 'Sync...')}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>
          </div>
        )}

        <div className="bg-white border-t border-slate-100 flex flex-col min-h-[400px]">
          <div className="px-2 py-2 bg-slate-50 border-b border-slate-100 overflow-x-auto no-scrollbar flex items-center gap-1.5">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => onCommentaryFilterChange && onCommentaryFilterChange(f.id)}
                className={`flex-shrink-0 h-7 px-4 rounded-xl text-[9px] font-medium uppercase tracking-widest transition-all duration-300 ${activeCommentaryFilter === f.id
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-slate-100">
              {activeCommentaryFilter === 'overs' ? (
                oversGrouped.map((group, idx) => {
                  if (group.type === 'break') {
                    return (
                      <div key={idx} className="py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] bg-slate-50/50">
                        {group.label}
                      </div>
                    )
                  }
                  return (
                    <div key={idx} className="px-4 py-5 flex items-center justify-between hover:bg-slate-50/30 transition-all border-b border-slate-50 group">
                      <div className="flex items-center gap-6">
                        <span className="min-w-[40px] text-xs font-bold text-slate-500">Ov {group.overNum}</span>
                        <div className="flex items-center gap-2">
                          {group.balls.map((ball, bidx) => {
                            const isW = ball.isWicket || ball.milestone === 'wicket'
                            const r = Number(ball.runs || 0)
                            const is4 = r === 4 || ball.milestone === '4' || String(ball.milestone) === '4'
                            const is6 = r === 6 || ball.milestone === '6' || String(ball.milestone) === '6'
                            const upperText = String(ball.text || '').toUpperCase()
                            const isExtra = upperText.includes('WIDE') || upperText.includes('NO BALL')

                            return (
                              <div key={bidx}
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold shadow-sm transition-transform group-hover:scale-105 ${isW ? 'bg-rose-600 text-white' :
                                  is6 ? 'bg-emerald-600 text-white' :
                                    is4 ? 'bg-blue-600 text-white' :
                                      isExtra ? 'bg-white text-slate-700 border border-slate-200' :
                                        'bg-white text-slate-800 border border-slate-100'
                                  }`}>
                                {isW ? 'W' :
                                  isExtra ? (
                                    upperText.includes('WIDE')
                                      ? (r > 1 ? `wd+${r - 1}` : 'wd')
                                      : (r > 1 ? `nb+${r - 1}` : 'nb')
                                  ) :
                                    (r === 0 ? '0' : r)}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-800">= {group.totalRuns}</span>
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  )
                })
              ) : (
                filteredCommentary.length > 0 ? (
                  [...filteredCommentary].reverse().map((item, idx) => {
                    const runs = Number(item.runs || 0)
                    const isWicket = item.isWicket || item.milestone === 'wicket'
                    const isFour = runs === 4 || item.milestone === '4' || String(item.milestone) === '4'
                    const isSix = runs === 6 || item.milestone === '6' || String(item.milestone) === '6'
                    const isManual = !!item.manual
                    const ballLabel = item.over || (item.ball !== undefined ? `${Math.floor(idx / 6)}.${item.ball + 1}` : '—')

                    let displayVal = runs
                    let ballType = isWicket ? 'wicket' : 'run'
                    const isBoundary = item.isBoundary || isFour || isSix

                    if (!isBoundary && !isWicket) {
                      const upperText = String(item.text || '').toUpperCase()
                      const isWide = upperText.includes('WIDE') || upperText.includes(' WIDE ')
                      const isNoBall = upperText.includes('NO BALL') || upperText.includes('NO-BALL')

                      if (isWide) {
                        displayVal = runs > 1 ? `wd+${runs - 1}` : 'wd'
                        ballType = 'wide'
                      } else if (isNoBall) {
                        displayVal = runs > 1 ? `nb+${runs - 1}` : 'nb'
                        ballType = 'noball'
                      }
                    }

                    return (
                      <div key={idx} className={`px-4 py-4 flex gap-4 transition-all ${isWicket ? 'bg-rose-50/40' : item.isHighlight ? 'bg-amber-50/30' : 'hover:bg-slate-50/20'}`}>
                        <div className="flex flex-col items-center gap-2 min-w-[36px]">
                          <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">{ballLabel}</span>
                          {isManual ? (
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shadow-inner">
                              <span className="text-lg">📢</span>
                            </div>
                          ) : (
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-medium shadow-md transition-transform hover:scale-110 ${isWicket ? 'bg-rose-600 text-white shadow-rose-200' :
                              isSix ? 'bg-emerald-600 text-white shadow-emerald-200' :
                                isFour ? 'bg-blue-600 text-white shadow-blue-200' :
                                  (ballType === 'wide' || ballType === 'noball') ? 'bg-orange-500 text-white shadow-orange-200' :
                                    'bg-white text-slate-900 border border-slate-200 shadow-slate-100'
                              }`}>
                              {isWicket ? 'W' : (displayVal === 0 ? '·' : displayVal)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-1.5 pt-0.5">
                          <p className={`text-sm leading-relaxed ${item.isHighlight || isWicket || isBoundary ? 'font-medium text-slate-900' : 'text-slate-700 font-medium'}`}>
                            {item.text}
                          </p>
                          {(isWicket || isSix || isFour || isManual) && (
                            <div className="mt-1 flex gap-2">
                              <div className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[8px] font-medium uppercase tracking-widest shadow-sm ${isWicket ? 'bg-rose-100 text-rose-700' :
                                isSix ? 'bg-emerald-100 text-emerald-700' :
                                  isFour ? 'bg-blue-100 text-blue-700' :
                                    'bg-slate-100 text-slate-600'
                                }`}>
                                {isWicket ? 'Wicket' : isSix ? 'Maximum' : isFour ? 'Boundary' : 'Announcement'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="py-20 text-center">
                    <div className="text-3xl mb-3 opacity-20">🎤</div>
                    <div className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Waiting for commentary...</div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CrexLiveSection
