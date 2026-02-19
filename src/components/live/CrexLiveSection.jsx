/**
 * Professional Live Section Component
 * User-friendly, responsive design with better UX
 */
import React from 'react'
import { Link } from 'react-router-dom'
import ProjectedScoreTable from './ProjectedScoreTable'
import { ChevronRight, ChevronDown, MapPin, Info, Users, Hash } from 'lucide-react'
import { calculateWinProbability } from '../../services/ai/winProbabilityEngine'
import TournamentPointsTable from '../../pages/TournamentPointsTable'
import { formatShortTeamName } from '../../utils/teamName'

import cricketBatIcon from '../../assets/cricket-bat.png'

const getBallColorClass = (result) => {
  const r = String(result || '').toUpperCase();
  if (r.includes('W')) return 'bg-rose-600 text-white shadow-rose-500/20';
  if (r.includes('6')) return 'bg-emerald-600 text-white shadow-emerald-500/20 shadow-sm';
  if (r.includes('4')) return 'bg-blue-600 text-white shadow-blue-500/20 shadow-sm';
  if (r.includes('WD') || r.includes('NB')) return 'bg-amber-500 text-white shadow-amber-500/20 shadow-sm';
  if (r === '0' || r === 'DOT' || r === '·') return 'bg-slate-400 dark:bg-slate-600 text-white';
  return 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10';
};

const getBallResultLabel = (item) => {
  if (item.result) return item.result;
  if (item.value) return item.value;
  const r = Number(item.runs || 0);
  const isW = item.isWicket || item.milestone === 'wicket';
  const upperText = String(item.text || '').toUpperCase();
  const isWd = upperText.includes('WIDE');
  const isNb = upperText.includes('NO BALL') || upperText.includes('NO-BALL');

  if (isW) return 'W';
  if (isWd) return 'wd';
  if (isNb) return 'nb';
  return String(r);
};

const CrexLiveSection = ({
  match,
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
  teamFormAndH2H,
  hasGroup,
  tournamentId,
  resolveMatchSideRef,
}) => {
  const isFinishedMatch = matchStatus === 'Finished' || matchStatus === 'Completed';
  const isInningsBreak = matchStatus === 'InningsBreak';

  // Calculate Win Probability
  const winProb = React.useMemo(() => {
    if (isFinishedMatch) return { teamAWinProb: 50, teamBWinProb: 50 };

    const [ov, b] = (currentOvers || '0.0').toString().split('.');
    const legalBalls = (Number(ov) * 6) + Number(b || 0);

    // Robust batting side detection
    const battingTeamSide = currentInnings?.inningId || (match && match.currentBatting) || 'teamA';

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
    const bid = lastWicket.batsmanId || lastWicket.playerId || lastWicket.id;
    const name = lastWicket.batsmanName || lastWicket.name || 'Batsman';
    const stats = `${lastWicket.runs || 0}(${lastWicket.balls || 0})`;

    return (
      <span className="flex items-center gap-1">
        {bid ? (
          <Link to={`/players/${bid}`} className="hover:text-blue-600 transition-colors">
            {name}
          </Link>
        ) : (
          <span>{name}</span>
        )}
        <span className="text-slate-400 font-normal">{stats}</span>
      </span>
    )
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

    const ballsProcessed = new Set()

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

      // Deduplicate: If we have multiple entries for the same ball (e.g. ball + milestone), 
      // only count it once for circles and runs.
      const ballId = item.ballDocId || `${inningId}-${item.over}-${item.ball}`
      if (ballsProcessed.has(ballId)) return
      ballsProcessed.add(ballId)

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
    <div className="bg-slate-50 dark:bg-[#060b16] min-h-screen pb-8">
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
                            ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-blue-500 shadow-sm"
                            : "bg-gradient-to-br from-emerald-500 to-green-600 text-white border-emerald-500 shadow-sm";

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
                        <span className="text-[9px] font-black text-slate-500 dark:text-slate-300">{overTotal}</span>
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
          <div className="bg-white dark:bg-[#0f172a] px-5 py-2.5 border-b border-slate-100 dark:border-white/5 space-y-1.5">
            {/* Top Row: Names & Centered Label */}
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 tracking-wide">
              <span className="shrink-0">{formatShortTeamName(teamAName)}</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-200 dark:border-white/10 flex items-center justify-center text-[7px] leading-none">i</span>
                <span className="uppercase text-[9px] font-bold text-slate-500">Realtime Win %</span>
              </div>
              <span className="shrink-0">{formatShortTeamName(teamBName)}</span>
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
          <div className="bg-white dark:bg-[#0f172a] border-y border-slate-100 dark:border-white/5 divide-y divide-slate-50 dark:divide-white/5">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                <span>BATTER</span>
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
                  // Deduplicate by ID to prevent rendering same person multiple times if DB is glitched
                  const uniqueBatters = [];
                  const seenIds = new Set();
                  for (const b of battersList) {
                    const bid = b.id || b.playerId || b.batsmanId;
                    if (!seenIds.has(bid)) {
                      seenIds.add(bid);
                      uniqueBatters.push(b);
                    }
                  }

                  // Sort by ID to keep positions stable
                  const stableBatters = [...uniqueBatters].sort((a, b) =>
                    String(a.id || a.playerId || a.batsmanId || '').localeCompare(String(b.id || b.playerId || b.batsmanId || ''))
                  );

                  return stableBatters.map((p, i) => (
                    <div key={`${p.id || p.playerId || 'p'}-${i}`} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {(p.id || p.playerId || p.batsmanId) && String(p.id || p.playerId || p.batsmanId) !== 'undefined' ? (
                          <Link to={`/players/${p.id || p.playerId || p.batsmanId}`} className="text-sm font-bold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                            {p.name}
                          </Link>
                        ) : (
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                        )}
                        {p.id === striker?.id && <img src={cricketBatIcon} className="w-4 h-4 opacity-40 ml-1" alt="" />}
                      </div>
                      <div className="flex gap-6 pr-1 text-sm font-bold text-slate-800 dark:text-slate-200 items-baseline">
                        <div className="w-10 text-right flex items-baseline justify-end gap-1">
                          <span className="text-base font-black text-slate-900 dark:text-white">{p.runs || 0}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">({p.balls || 0})</span>
                        </div>
                        <span className="w-6 text-center text-slate-500 dark:text-slate-300 font-bold">{p.fours || 0}</span>
                        <span className="w-6 text-center text-slate-500 dark:text-slate-300 font-bold">{p.sixes || 0}</span>
                        <span className="w-10 text-right text-slate-400 dark:text-slate-400 font-bold text-[11px]">{(p.strikeRate || (p.balls > 0 ? (p.runs / p.balls * 100) : 0)).toFixed(1)}</span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">P'SHIP:</span>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">{formatPartnership()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">LAST WKT:</span>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">{formatLastWicket() || '—'}</span>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight border-t border-slate-100 dark:border-white/5 pt-4">
                <span>BOWLER</span>
                <div className="flex gap-6 pr-1">
                  <span className="w-10 text-right">W-R</span>
                  <span className="w-10 text-center">Overs</span>
                  <span className="w-10 text-right">ECO</span>
                </div>
              </div>
              {currentBowler && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {currentBowler?.bowlerId && String(currentBowler.bowlerId) !== 'undefined' ? (
                      <Link to={`/players/${currentBowler.bowlerId}`} className="text-sm font-bold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        {currentBowler.bowlerName || 'Bowler'}
                      </Link>
                    ) : (
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{currentBowler.bowlerName || 'Bowler'}</span>
                    )}
                  </div>
                  <div className="flex gap-6 pr-1 text-sm font-bold text-slate-800 dark:text-slate-200 items-center">
                    <span className="w-10 text-right font-black text-slate-900 dark:text-white">{currentBowler.wickets || 0}-{currentBowler.runsConceded || 0}</span>
                    <span className="w-10 text-center text-slate-500 dark:text-slate-400 font-bold">{currentBowler.overs || 0}</span>
                    <span className="text-slate-500 dark:text-slate-400 font-bold text-[11px]">{(currentBowler.economy || 0).toFixed(1)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* First Innings: Projected Score - Shown only when NO target is set */}
        {!isFinishedMatch && !onlyCommentary && !isInningsBreak && (!target || Number(target) === 0) && (
          <div className="px-4 py-2 space-y-3">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-200">Projected Score</h3>
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden p-4 space-y-4 shadow-sm">
              <div className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight flex items-center gap-2">
                Projected Score <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 normal-case">as per RR.</span>
              </div>
              <div className="rounded-xl overflow-hidden divide-y divide-slate-50 dark:divide-white/5 border border-slate-100 dark:border-white/5">
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] bg-slate-50/50 dark:bg-white/[0.02] p-3 text-[11px] font-bold text-slate-700 dark:text-slate-200 tabular-nums items-center">
                  <span className="text-slate-400 dark:text-slate-500">Run Rate</span>
                  <span className="text-right text-sm text-slate-900 dark:text-white">{currentRunRate?.toFixed(1)}*</span>
                  <span className="text-right text-slate-400">12</span>
                  <span className="text-right text-slate-400">13</span>
                  <span className="text-right text-slate-400">15</span>
                </div>
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] bg-slate-100/50 dark:bg-slate-800/40 p-3 text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider items-center">
                  <span className="text-slate-400 dark:text-slate-500 whitespace-nowrap">{oversLimit} Overs</span>
                  <span className="text-right text-sm text-slate-900 dark:text-white">{Math.round((currentRuns || 0) + (currentRunRate || 0) * ((oversLimit || 20) - (Number(currentOvers || 0))))}</span>
                  <span className="text-right text-slate-600 dark:text-slate-200">{Math.round((currentRuns || 0) + 12 * ((oversLimit || 20) - (Number(currentOvers || 0))))}</span>
                  <span className="text-right text-slate-600 dark:text-slate-200">{Math.round((currentRuns || 0) + 13 * ((oversLimit || 20) - (Number(currentOvers || 0))))}</span>
                  <span className="text-right text-slate-600 dark:text-slate-200">{Math.round((currentRuns || 0) + 15 * ((oversLimit || 20) - (Number(currentOvers || 0))))}</span>
                </div>
              </div>
              <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 italic">
                * Based on current run rate of <span className="font-bold text-slate-600 dark:text-slate-400">{currentRunRate?.toFixed(2)}</span> (Current: {currentRuns} runs in {currentOvers} overs)
              </div>
            </div>
          </div>
        )}

        {/* Second Innings: "At this stage" comparison - Shown only when target > 0 */}
        {!isFinishedMatch && !onlyCommentary && !isInningsBreak && (target && Number(target) > 0) && (
          <div className="px-4 py-2 space-y-3">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-200">At this stage</h3>
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden p-4 relative shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-b from-slate-500/5 dark:from-white/5 to-transparent" />

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
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-sm overflow-hidden hover:scale-105 transition-transform relative">
                            {logo ? (
                              <img src={logo} className="w-full h-full object-contain p-1" alt="" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-base font-black uppercase">
                                {name.charAt(0)}
                              </div>
                            )}
                          </div>
                        </Link>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center p-1 shadow-sm overflow-hidden">
                          {logo ? (
                            <img src={logo} className="w-full h-full object-contain" alt="" />
                          ) : (
                            <span className="text-lg font-black text-slate-400 dark:text-slate-300">{name[0]}</span>
                          )}
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                          {formatShortTeamName(name)}*
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                          {currentRuns}-{currentInnings?.totalWickets || 0}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Over Mark (Center) */}
                <div className="flex flex-col items-center px-4">
                  <div className="px-3 py-1 bg-blue-600/10 dark:bg-blue-600/20 border border-blue-500/20 dark:border-blue-500/30 rounded-full text-[8px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1.5 shadow-sm">
                    {currentOvers} Overs
                  </div>
                  <div className="flex items-center gap-1.5 opacity-20">
                    <div className="h-px w-6 bg-slate-900 dark:bg-white"></div>
                    <span className="text-[10px] font-black text-slate-900 dark:text-white">VS</span>
                    <div className="h-px w-6 bg-slate-900 dark:bg-white"></div>
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
                          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-sm overflow-hidden hover:scale-105 transition-transform relative">
                            {defendingLogo ? (
                              <img src={defendingLogo} className="w-full h-full object-contain p-1" alt="" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-500 to-pink-600 text-white text-base font-black uppercase">
                                {defendingName.charAt(0)}
                              </div>
                            )}
                          </div>
                        </Link>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center p-1 shadow-sm overflow-hidden">
                          {defendingLogo ? (
                            <img src={defendingLogo} className="w-full h-full object-contain" alt="" />
                          ) : (
                            <span className="text-lg font-black text-slate-400 dark:text-slate-500">{defendingName[0]}</span>
                          )}
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                          {formatShortTeamName(defendingName)}
                        </div>
                        <div className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">
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

        <div className="bg-white dark:bg-[#0f172a] border-t border-slate-100 dark:border-white/5 flex flex-col min-h-[500px]">
          {/* Commentary Filters - CREX Style */}
          <div className="px-3 py-3 bg-white dark:bg-[#0f172a] border-b border-slate-100 dark:border-white/5 overflow-x-auto no-scrollbar flex items-center gap-2">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => onCommentaryFilterChange && onCommentaryFilterChange(f.id)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all border ${activeCommentaryFilter === f.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-slate-50 dark:bg-white/[0.03] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                  }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#060b16]">
            <div className="max-w-4xl mx-auto py-2">
              {activeCommentaryFilter === 'overs' ? (
                <div className="space-y-0 bg-white dark:bg-[#0f172a]">
                  {oversGrouped.map((item, idx) => {
                    if (item.type === 'break') {
                      return (
                        <div key={`break-${idx}`} className="py-6 flex items-center gap-4 px-8 bg-slate-50 dark:bg-[#060b16]">
                          <div className="h-px flex-1 bg-slate-900/10 dark:bg-white/10" />
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">End of Over {item.overNo}</span>
                          <div className="h-px flex-1 bg-slate-900/10 dark:bg-white/10" />
                        </div>
                      );
                    }

                    return (
                      <div key={`over-${idx}`} className="px-5 py-4 flex items-center justify-between border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-6 flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 w-10">Ov {item.overNum}</span>
                          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                            {item.balls.map((b, bi) => {
                              const resLabel = getBallResultLabel(b);
                              return (
                                <div key={bi} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm ${getBallColorClass(resLabel)}`}>
                                  {resLabel}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-200 tabular-nums">= {item.totalRuns}</span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    );
                  })}
                </div>
              ) : (() => {
                // Group commentary by overs for better flow
                const groupedCommentary = [];
                // Ensure we iterate in perfect chronological order
                // Use the chronological order provided by the subscription (oldest -> newest)
                const chronologicalCommentary = [...filteredCommentary];

                let runningTotalRuns = 0;
                let runningTotalWickets = 0;
                let overRuns = 0;
                let overWickets = 0;
                let currentBatchInningId = null;

                const playerTracker = {};
                const bowlerTracker = {};

                chronologicalCommentary.forEach((item, idx) => {
                  if (item.inningId !== currentBatchInningId) {
                    runningTotalRuns = 0;
                    runningTotalWickets = 0;
                    overRuns = 0;
                    overWickets = 0;
                    currentBatchInningId = item.inningId;
                    Object.keys(playerTracker).forEach(k => delete playerTracker[k]);
                    Object.keys(bowlerTracker).forEach(k => delete bowlerTracker[k]);
                  }

                  // Initialize trackers
                  if (item.batsman && !playerTracker[item.batsman]) playerTracker[item.batsman] = { runs: 0, balls: 0 };
                  if (item.bowler && !bowlerTracker[item.bowler]) bowlerTracker[item.bowler] = { runs: 0, wickets: 0, balls: 0 };

                  const runsPerBall = Number(item.runs || 0);
                  runningTotalRuns += runsPerBall;
                  overRuns += runsPerBall;
                  if (item.isWicket) {
                    runningTotalWickets += 1;
                    overWickets += 1;
                  }

                  const upperText = String(item.text || '').toUpperCase();
                  const isWide = upperText.includes('WIDE');
                  const isNoBall = upperText.includes('NO BALL') || upperText.includes('NO-BALL');

                  // Track Batter
                  if (item.batsman) {
                    if (!isWide) {
                      playerTracker[item.batsman].runs += runsPerBall;
                      playerTracker[item.batsman].balls += 1;
                    }
                  }

                  // Track Bowler
                  if (item.bowler) {
                    bowlerTracker[item.bowler].runs += runsPerBall;
                    if (item.isWicket) bowlerTracker[item.bowler].wickets += 1;
                    if (!isWide && !isNoBall) bowlerTracker[item.bowler].balls += 1;
                  }

                  const overStr = String(item.over || '0.0');
                  const [ov, b] = overStr.split('.');
                  const overNum = parseInt(ov);
                  const ballNum = parseInt(b);

                  // 1. Push Ball/Wicket/Entry FIRST
                  if (item.text?.toLowerCase().includes('is in at')) {
                    groupedCommentary.push({ type: 'entry', text: item.text, player: item.batsman });
                  } else {
                    groupedCommentary.push({ type: 'ball', ...item });
                  }

                  if (item.isWicket) {
                    const stats = playerTracker[item.batsman] || { runs: 0, balls: 0 };
                    groupedCommentary.push({
                      type: 'wicket-card',
                      ...item,
                      batterRuns: stats.runs,
                      batterBalls: stats.balls
                    });
                  }

                  // 2. Detect Over boundaries AFTER pushing the ball
                  // Trigger summary on the actual completion ball (.6 or .0)
                  const isLastOfOver = ballNum === 6 || (ballNum === 0 && overNum > 0);

                  if (isLastOfOver) {
                    const bStats = bowlerTracker[item.bowler] || { runs: 0, wickets: 0, balls: 0 };
                    const bowlerOvers = `${Math.floor(bStats.balls / 6)}.${bStats.balls % 6}`;

                    groupedCommentary.push({
                      type: 'over-summary',
                      overNum: overNum,
                      displayOverNum: overNum,
                      runs: overRuns,
                      wickets: overWickets,
                      totalScore: `${runningTotalRuns}/${runningTotalWickets}`,
                      inningId: item.inningId,
                      bowler: item.bowler,
                      bowlerFigure: `${bStats.wickets}-${bStats.runs} (${bowlerOvers})`,
                      striker: item.batsman,
                      overRuns: overRuns,
                      inningLabel: formatShortTeamName(item.inningId === 'teamA' ? teamAName : teamBName),
                    });

                    // Reset accumulators
                    overRuns = 0;
                    overWickets = 0;
                  }
                });

                if (groupedCommentary.length === 0) {
                  return (
                    <div className="py-20 text-center">
                      <div className="text-4xl mb-4 opacity-30">🎤</div>
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em]">Waiting for match action...</div>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-slate-100 dark:divide-white/5 bg-slate-50 dark:bg-[#060b16]">
                    {groupedCommentary.reverse().map((node, idx) => {
                      if (node.type === 'over-summary') {
                        return (
                          <div key={`ov-${idx}`} className="mx-4 my-4 bg-white dark:bg-white/[0.04] rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-tighter">END OF OVER {node.overNum}</span>
                                <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />
                                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                  Score: <span className="text-slate-900 dark:text-white">{node.totalScore}</span>
                                </div>
                              </div>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/[0.03] rounded-xl p-3 flex items-center justify-between border border-slate-100 dark:border-white/5">
                              <div className="space-y-0.5">
                                <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Innings</div>
                                <div className="text-[10px] font-black text-slate-900 dark:text-slate-300 uppercase">
                                  {node.inningLabel || '—'}
                                </div>
                              </div>
                              <div className="text-right space-y-0.5">
                                <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Runs</div>
                                <div className="text-base font-black text-blue-600 dark:text-blue-400">
                                  {node.overRuns}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (node.type === 'entry') {
                        return (
                          <div key={`entry-${idx}`} className="mx-4 my-3 bg-white dark:bg-[#1C252E] border border-slate-100 dark:border-transparent rounded-2xl p-4 flex items-center gap-4 text-slate-900 dark:text-white shadow-lg overflow-hidden relative">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl -mr-16 -mt-16"></div>
                            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-white/10 flex items-center justify-center p-1 shrink-0">
                              <span className="text-lg font-black text-slate-300 dark:text-white/20">{node.player?.[0] || 'P'}</span>
                            </div>
                            <div className="min-w-0 z-10">
                              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">New Batter In</div>
                              <div className="text-lg font-black truncate text-slate-900 dark:text-white">{node.player || 'Player'}</div>
                              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-1">{node.text}</div>
                            </div>
                          </div>
                        );
                      }

                      if (node.type === 'wicket-card') {
                        return (
                          <div key={`wkt-${idx}`} className="mx-4 my-3 bg-rose-600 rounded-2xl p-4 flex items-center gap-4 text-white shadow-lg shadow-rose-200/50">
                            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                              <span className="text-xl font-black italic">OUT</span>
                            </div>
                            <div className="min-w-0">
                              <div className="text-lg font-black truncate">{node.batsman}</div>
                              <div className="text-[11px] font-bold text-rose-100 flex items-center gap-2">
                                <span>{node.batterRuns} Runs</span>
                                <span className="w-1 h-1 rounded-full bg-rose-300"></span>
                                <span>{node.batterBalls} Balls</span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      const item = node;
                      const runs = Number(item.runs || 0);
                      const isWicket = item.isWicket || item.milestone === 'wicket';
                      const isFour = runs === 4 || item.milestone === '4';
                      const isSix = runs === 6 || item.milestone === '6';
                      const ballLabel = item.over || '0.0';

                      const itemText = String(item.text || '').toUpperCase();
                      const isWide = itemText.includes('WIDE');
                      const isNoBall = itemText.includes('NO BALL') || itemText.includes('NO-BALL');

                      let badgeColor = "bg-slate-400 text-white border-slate-400"; // Dot ball
                      if (isWicket) badgeColor = "bg-rose-600 text-white border-rose-600";
                      else if (isSix) badgeColor = "bg-[#457920] text-white border-[#457920]";
                      else if (isFour) badgeColor = "bg-[#3B82F6] text-white border-[#3B82F6]";
                      else if (isWide || isNoBall) badgeColor = "bg-slate-500 text-white border-slate-500";
                      else if (runs > 0) badgeColor = "bg-amber-500 text-white border-amber-500";

                      const resLabel = getBallResultLabel(item);

                      return (
                        <div
                          key={`ball-${idx}`}
                          className="px-4 py-5 flex gap-4 bg-white dark:bg-[#0f172a] border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors"
                        >
                          <div className="flex flex-col items-center gap-2 shrink-0 pt-1">
                            <span className="text-[11px] font-bold text-slate-500 tabular-nums w-8 text-center">{item.overNum}</span>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm ${getBallColorClass(resLabel)}`}>
                              {resLabel}
                            </div>
                          </div>
                          <div className="flex-1 space-y-1.5 min-w-0">
                            <div className="text-[13px] font-bold leading-relaxed text-slate-900 dark:text-slate-100 pr-2">
                              {item.text || 'No commentary available for this ball.'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        {/* Team Form Section */}
        {teamFormAndH2H && (
          <div className="px-4 py-6 space-y-6">
            {/* Team Form and Head to Head sections removed as requested */}

            {/* Points Table Context */}
            {hasGroup && tournamentId && (
              <div className="space-y-4">
                <h3 className="text-[14px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide px-1">Points Table</h3>
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                  <TournamentPointsTable
                    embedded={true}
                    tournamentId={tournamentId}
                    hideQualification={true}
                    forcedDark={false}
                    filterSquadIds={[
                      String(resolveMatchSideRef ? resolveMatchSideRef({ teamAId: teamASquad?.id, teamBId: teamBSquad?.id }, 'A') : ''),
                      String(resolveMatchSideRef ? resolveMatchSideRef({ teamAId: teamASquad?.id, teamBId: teamBSquad?.id }, 'B') : '')
                    ].filter(Boolean)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default CrexLiveSection
