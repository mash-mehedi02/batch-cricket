/**
 * Professional Live Section Component
 * User-friendly, responsive design with better UX
 */
import React from 'react'
import { Link } from 'react-router-dom'
import ProjectedScoreTable from './ProjectedScoreTable'
import { ChevronRight, ChevronDown, MapPin, Info, Users, Hash, Trophy, Zap } from 'lucide-react'
import { calculateWinProbability } from '../../services/ai/winProbabilityEngine'
import TournamentPointsTable from '../../pages/TournamentPointsTable'
import { formatShortTeamName } from '../../utils/teamName'
import MatchVoting from './MatchVoting'

import cricketBatIcon from '../../assets/cricket-bat.png'

const getBallColorClass = (result) => {
  const r = String(result || '').toUpperCase();
  if (r === 'W') return 'bg-[#b31a1a] text-white shadow-sm'; // Wicket: Rich Red
  if (r.includes('6')) return 'bg-[#1a803e] text-white shadow-sm'; // Six: Vibrant Green
  if (r.includes('4')) return 'bg-[#146abb] text-white shadow-sm'; // Four: Broadcast Blue

  // Extras (wd, nb, lb, b) and regular runs (0, 1, 2, 3) get white background
  return 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 shadow-sm';
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
  if (isWd) return r > 1 ? `wd+${r - 1}` : 'wd';
  if (isNb) return r > 1 ? `nb+${r - 1}` : 'nb';
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

    // Comparison logic for "At this stage"
    const parseOversToBalls = (ovStr) => {
      const [ovParts, bParts] = (ovStr || '0.0').toString().split('.');
      return (Number(ovParts) * 6) + Number(bParts || 0);
    };
    const cBalls = parseOversToBalls(currentOvers);
    const defInn = battingTeamSide === 'teamA' ? teamBInnings : teamAInnings;
    const stageScore = defInn?.oversProgress?.slice().reverse().find(p => (p.balls || parseOversToBalls(p.over)) <= cBalls);

    return calculateWinProbability({
      currentRuns: Number(currentRuns || 0),
      wickets: Number(currentInnings?.totalWickets || 0),
      legalBalls,
      target: target ? Number(target) : null,
      oversLimit: Number(oversLimit || 20),
      battingTeamSide,
      lastBallEvent,
      isFinishedMatch,
      partnershipRuns: partnership?.runs || 0,
      partnershipBalls: partnership?.balls || 0,
      recentOvers: recentOvers || [],
      firstInningsStageScore: stageScore ? { runs: stageScore.runs, wickets: stageScore.wickets } : undefined
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
      <div className="max-w-4xl mx-auto px-0 sm:px-4 py-1 space-y-0.5">

        {/* 1. Timeline Strip - Reduced spacing */}
        {!onlyCommentary && recentOvers && (
          <div className="px-4 py-0.5 overflow-hidden">
            <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-hide py-0.5" ref={scrollRef}>
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
                          const isWicket = b?.type === 'wicket' || val === 'W' || val.toUpperCase().includes('OUT') || String(val).includes('W');

                          let dotStyle = "bg-white dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 shadow-sm"

                          if (isBoundary) dotStyle = val === '4'
                            ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-blue-500 shadow-sm"
                            : "bg-gradient-to-br from-emerald-500 to-green-600 text-white border-emerald-500 shadow-sm";

                          if (isWicket) dotStyle = "bg-rose-600 text-white border-rose-500 shadow-sm";

                          return (
                            <div key={bIdx}
                              className={`${dotStyle} h-7 rounded-full flex items-center justify-center font-black shrink-0 border transition-all whitespace-nowrap`}
                              style={{
                                minWidth: '1.75rem',
                                width: 'auto',
                                padding: val.length > 1 ? '0 5px' : '0',
                                fontSize: val.length > 2 ? '8px' : '10px'
                              }}
                            >
                              {val}
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

        {/* 2. Win Probability - Slim & Professional */}
        {!isFinishedMatch && !onlyCommentary && (
          <div className="bg-white dark:bg-[#0f172a] px-5 py-2 border-b border-slate-100 dark:border-white/5 space-y-1.5">
            {/* Middle Row: Team Names - Batting team always on Left */}
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
              <span className="shrink-0">
                {formatShortTeamName((currentInnings?.inningId || (match && match.currentBatting)) === 'teamB' ? teamBName : teamAName)}
              </span>
              <span className="shrink-0">
                {formatShortTeamName((currentInnings?.inningId || (match && match.currentBatting)) === 'teamB' ? teamAName : teamBName)}
              </span>
            </div>

            {/* Bottom Row: Odds Bar */}
            {(() => {
              const isTeamABatting = (currentInnings?.inningId || (match && match.currentBatting)) === 'teamA';
              const leftProb = isTeamABatting ? teamAProb : teamBProb;
              const rightProb = isTeamABatting ? teamBProb : teamAProb;

              return (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums w-8">{leftProb}%</span>
                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden ring-2 ring-slate-50 dark:ring-white/[0.01]">
                    {/* Batting team color (Left) and Bowling team color (Right) */}
                    <div className="h-full bg-blue-600 transition-all duration-1000 shadow-[1px_0_4px_rgba(37,99,235,0.3)] relative z-10" style={{ width: `${leftProb}%` }}></div>
                    <div className="h-full bg-rose-600 transition-all duration-1000" style={{ width: `${rightProb}%` }}></div>
                  </div>
                  <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums w-8 text-right">{rightProb}%</span>
                </div>
              );
            })()}
          </div>
        )}

        {!onlyCommentary && (
          <div className="bg-white dark:bg-[#0f172a] border-y border-slate-100 dark:border-white/5 divide-y divide-slate-50 dark:divide-white/5">
            <div className="p-4 space-y-4 pb-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight bg-slate-50 dark:bg-white/[0.03] px-4 py-2 -mx-4 -mt-4 mb-2">
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
                    <div key={`${p.id || p.playerId || 'p'}-${i}`} className={`flex items-center justify-between transition-all duration-500 ${p.isOut ? 'opacity-75 grayscale-[0.2]' : ''}`}>
                      <div className="flex items-center gap-2">
                        {(p.id || p.playerId || p.batsmanId) && String(p.id || p.playerId || p.batsmanId) !== 'undefined' ? (
                          <Link to={`/players/${p.id || p.playerId || p.batsmanId}`} className={`text-sm font-bold transition-colors ${p.isOut ? 'text-slate-600 line-through decoration-red-500/70' : 'text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400'}`}>
                            {p.name}
                          </Link>
                        ) : (
                          <span className={`text-sm font-bold ${p.isOut ? 'text-slate-600' : 'text-slate-800 dark:text-slate-200'}`}>{p.name}</span>
                        )}
                        {p.id === striker?.id && !p.isOut && <img src={cricketBatIcon} className="w-4 h-4 opacity-40 ml-1" alt="" />}
                      </div>
                      <div className={`flex gap-6 pr-1 text-sm font-bold items-baseline ${p.isOut ? 'text-slate-600' : 'text-slate-800 dark:text-slate-200'}`}>
                        <div className="w-10 text-right flex items-baseline justify-end gap-1">
                          <span className={`text-base font-black ${p.isOut ? 'text-slate-700' : 'text-slate-900 dark:text-white'}`}>{p.runs || 0}</span>
                          <span className="text-[10px] opacity-80">({p.balls || 0})</span>
                        </div>
                        <span className="w-6 text-center opacity-80 font-bold">{p.fours || 0}</span>
                        <span className="w-6 text-center opacity-80 font-bold">{p.sixes || 0}</span>
                        <span className="w-10 text-right opacity-60 font-bold text-[11px]">{(p.strikeRate || (p.balls > 0 ? (p.runs / p.balls * 100) : 0)).toFixed(1)}</span>
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
            <div className="p-0 space-y-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight bg-slate-50 dark:bg-white/[0.03] px-4 py-2 border-y border-slate-100 dark:border-white/5">
                <span>BOWLER</span>
                <div className="flex gap-6 pr-1">
                  <span className="w-10 text-right">W-R</span>
                  <span className="w-10 text-center">Overs</span>
                  <span className="w-10 text-right">ECO</span>
                </div>
              </div>
              {currentBowler && (
                <div className="flex items-center justify-between px-4 pb-4">
                  <div className="flex items-center gap-2">
                    {(currentBowler?.bowlerId || currentBowler?.id) && String(currentBowler?.bowlerId || currentBowler?.id) !== 'undefined' ? (
                      <Link to={`/players/${currentBowler?.bowlerId || currentBowler?.id}`} className="text-sm font-bold text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        {currentBowler?.bowlerName || currentBowler?.name || 'Bowler'}
                      </Link>
                    ) : (
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{currentBowler?.bowlerName || currentBowler?.name || 'Bowler'}</span>
                    )}
                  </div>
                  <div className="flex gap-6 pr-1 text-sm font-bold text-slate-800 dark:text-slate-200 items-center">
                    <span className="w-10 text-right font-black text-slate-900 dark:text-white">{currentBowler.wickets || 0}-{currentBowler.runsConceded || 0}</span>
                    <span className="w-10 text-center text-slate-500 dark:text-slate-400 font-bold">{currentBowler.overs || 0}</span>
                    <span className="w-10 text-right text-slate-500 dark:text-slate-400 font-bold text-[11px]">{(currentBowler.economy || 0).toFixed(1)}</span>
                  </div>
                </div>
              )}
            </div>
            {match?.id && match.status !== 'finished' && (
              <MatchVoting
                matchId={match.id}
                teamAName={match.teamAName || 'Team A'}
                teamBName={match.teamBName || 'Team B'}
                teamABatch={teamASquad?.batch}
                teamBBatch={teamBSquad?.batch}
              />
            )}
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

          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#060b16] no-scrollbar">
            <div className="max-w-4xl mx-auto py-2">
              {activeCommentaryFilter === 'overs' ? (
                <div className="space-y-0 bg-white dark:bg-[#0f172a]">
                  {oversGrouped.map((item, idx) => {
                    if (item.type === 'break') {
                      return (
                        <div key={`break-${idx}`} className="py-6 flex items-center gap-4 px-8 bg-slate-50 dark:bg-[#060b16]">
                          <div className="h-px flex-1 bg-slate-900/10 dark:bg-white/10" />
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">End of Over {item.overNum}</span>
                          <div className="h-px flex-1 bg-slate-900/10 dark:bg-white/10" />
                        </div>
                      );
                    }

                    return (
                      <div key={`over-${idx}`} className="border-b border-slate-100 dark:border-white/5 overflow-hidden">
                        <div className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors bg-white dark:bg-[#0f172a] cursor-pointer group">
                          <div className="flex items-center gap-6 flex-1 min-w-0">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 w-10">Ov {item.overNum}</span>
                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                              {item.balls.map((b, bi) => {
                                const resLabel = getBallResultLabel(b);
                                return (
                                  <div key={bi}
                                    className={`h-7 rounded-full flex items-center justify-center font-black shrink-0 shadow-sm whitespace-nowrap ${getBallColorClass(resLabel)}`}
                                    style={{
                                      minWidth: '1.75rem',
                                      width: 'auto',
                                      padding: resLabel.length > 1 ? '0 6px' : '0',
                                      fontSize: resLabel.length > 2 ? '8px' : '10px'
                                    }}
                                  >
                                    {resLabel}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-slate-700 dark:text-slate-200 tabular-nums">= {item.totalRuns}</span>
                            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors" />
                          </div>
                        </div>
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

                const pushInningsSummary = (finalRuns, finalWickets, finalOvers, innId, batters, bowlers) => {
                  const sortedBatters = Object.entries(batters)
                    .filter(([name]) => !name.startsWith('_'))
                    .map(([name, stats]) => ({ name, ...stats }))
                    .sort((a, b) => b.runs - a.runs)
                    .slice(0, 3);

                  const sortedBowlers = Object.entries(bowlers)
                    .map(([name, stats]) => {
                      const ovs = `${Math.floor(stats.balls / 6)}.${stats.balls % 6}`;
                      return { name, ...stats, overs: ovs };
                    })
                    .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
                    .slice(0, 3);

                  const label = formatShortTeamName(innId === 'teamA' ? teamAName : teamBName);

                  groupedCommentary.push({
                    type: 'innings-summary',
                    inningId: innId,
                    totalScore: `${finalRuns}/${finalWickets}`,
                    overs: finalOvers,
                    label: label,
                    topBatters: sortedBatters,
                    topBowlers: sortedBowlers
                  });
                };

                let prevInningId = null;
                let lastTotalRuns = 0;
                let lastTotalWickets = 0;
                let lastOvers = '0.0';
                let lastBatters = {};
                let lastBowlers = {};

                chronologicalCommentary.forEach((item, idx) => {
                  const overStr = String(item.over || '0.0');
                  const [ov, b] = overStr.split('.');
                  const overNum = parseInt(ov);
                  const ballNum = parseInt(b);

                  if (item.inningId !== currentBatchInningId) {
                    // Before we reset, if we had a previous innings, push its summary
                    if (currentBatchInningId && lastTotalRuns > 0) {
                      pushInningsSummary(runningTotalRuns, runningTotalWickets, lastOvers, currentBatchInningId, { ...playerTracker }, { ...bowlerTracker });
                    }

                    runningTotalRuns = 0;
                    runningTotalWickets = 0;
                    overRuns = 0;
                    overWickets = 0;
                    currentBatchInningId = item.inningId;
                    Object.keys(playerTracker).forEach(k => delete playerTracker[k]);
                    Object.keys(bowlerTracker).forEach(k => delete bowlerTracker[k]);
                    playerTracker._overBalls = [];
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

                  // Keep track of who is currently at the crease (last seen pair)
                  if (item.batsman) {
                    playerTracker._currentStriker = item.batsman;
                  }
                  if (item.nonStriker && item.nonStriker !== item.batsman) {
                    playerTracker._currentNonStriker = item.nonStriker;
                  } else if (item.batsman && playerTracker._currentStriker && playerTracker._lastStriker && playerTracker._lastStriker !== item.batsman) {
                    playerTracker._currentNonStriker = playerTracker._lastStriker;
                  }
                  playerTracker._lastStriker = item.batsman;

                  // Update last known state for finish detection
                  lastTotalRuns = runningTotalRuns;
                  lastTotalWickets = runningTotalWickets;
                  lastOvers = overStr;

                  // Collect ball for timeline
                  if (!playerTracker._overBalls) playerTracker._overBalls = [];
                  playerTracker._overBalls.push(item);

                  // 1. Push Ball/Wicket/Entry FIRST
                  if (item.manual) {
                    groupedCommentary.push({ type: 'announcement', ...item });
                  } else if (item.text?.toLowerCase().includes('is in at')) {
                    groupedCommentary.push({ type: 'entry', text: item.text, player: item.batsman });
                  } else {
                    groupedCommentary.push({ type: 'ball', ...item });
                  }

                  if (item.isWicket && !item.manual) {
                    const stats = playerTracker[item.batsman] || { runs: 0, balls: 0 };
                    groupedCommentary.push({
                      type: 'wicket-card',
                      ...item,
                      wickets: runningTotalWickets,
                      batterRuns: stats.runs,
                      batterBalls: stats.balls,
                      matchScore: `${runningTotalRuns}/${runningTotalWickets}`,
                      overStr: item.over
                    });
                  }

                  // 2. Detect Over boundaries AFTER pushing the ball
                  const isLastOfOver = !item.manual && !isWide && !isNoBall && (ballNum === 0 && overNum > 0);

                  if (isLastOfOver) {
                    const bStats = bowlerTracker[item.bowler] || { runs: 0, wickets: 0, balls: 0 };
                    const bowlerOvers = `${Math.floor(bStats.balls / 6)}.${bStats.balls % 6}`;

                    const sName = playerTracker._currentStriker;
                    const nsName = playerTracker._currentNonStriker;
                    const sStats = sName ? playerTracker[sName] : null;
                    const nsStats = nsName ? playerTracker[nsName] : null;

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
                      striker: sName,
                      strikerStats: sStats ? `${sStats.runs}(${sStats.balls})` : null,
                      nonStriker: nsName,
                      nonStrikerStats: nsStats ? `${nsStats.runs}(${nsStats.balls})` : null,
                      overRuns: overRuns,
                      inningLabel: formatShortTeamName(item.inningId === 'teamA' ? teamAName : teamBName),
                      overBalls: [...playerTracker._overBalls]
                    });

                    overRuns = 0;
                    overWickets = 0;
                    playerTracker._overBalls = [];
                  }
                });

                // FINAL SUMMARY: After the loop, push the last innings summary
                if (currentBatchInningId && lastTotalRuns > 0) {
                  pushInningsSummary(lastTotalRuns, lastTotalWickets, lastOvers, currentBatchInningId, playerTracker, bowlerTracker);
                }

                if (groupedCommentary.length === 0) {
                  return (
                    <div className="py-20 text-center">
                      <div className="text-4xl mb-4 opacity-30">🎤</div>
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.2em]">Waiting for match action...</div>
                    </div>
                  );
                }

                const allGrouped = groupedCommentary.reverse();
                const limitedGrouped = (onlyCommentary || activeCommentaryFilter !== 'all') ? allGrouped : allGrouped.slice(0, 10);
                const hasMore = allGrouped.length > 10 && !onlyCommentary && activeCommentaryFilter === 'all';

                return (
                  <div className="divide-y divide-slate-100 dark:divide-white/5 bg-slate-50 dark:bg-[#060b16]">
                    {limitedGrouped.map((node, idx) => {
                      if (node.type === 'over-summary') {
                        return (
                          <div key={`ov-${idx}`} className="mx-4 my-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                            <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/50 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-4">
                                <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">OV {node.overNum}</span>
                                <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{node.overRuns} Runs</span>
                              </div>
                              <div className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                {node.inningLabel} {node.totalScore}
                              </div>
                            </div>

                            <div className="p-4 grid grid-cols-[1fr_auto] gap-10">
                              <div className="space-y-3">
                                {node.striker && (
                                  <div className="flex items-center justify-between min-w-[140px]">
                                    <span className="text-[13px] font-bold text-blue-600 dark:text-blue-400 pr-4">{node.striker}</span>
                                    <span className="text-[13px] font-black text-slate-900 dark:text-white tabular-nums">{node.strikerStats || '0(0)'}</span>
                                  </div>
                                )}
                                {node.nonStriker && (
                                  <div className="flex items-center justify-between min-w-[140px]">
                                    <span className="text-[13px] font-bold text-blue-600 dark:text-blue-400 pr-4">{node.nonStriker}</span>
                                    <span className="text-[13px] font-black text-slate-900 dark:text-white tabular-nums">{node.nonStrikerStats || '0(0)'}</span>
                                  </div>
                                )}
                              </div>

                              <div className="border-l border-slate-100 dark:border-slate-800 pl-8 flex flex-col justify-center text-right">
                                <span className="text-[13px] font-bold text-blue-600 dark:text-blue-400">{node.bowler}</span>
                                <span className="text-[13px] font-black text-slate-900 dark:text-white tabular-nums">{node.bowlerFigure}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (node.type === 'entry') {
                        return (
                          <div key={`entry-${idx}`} className="mx-4 my-2">
                            <div className="bg-[#1e1e1e] rounded-2xl p-5 text-white shadow-xl relative overflow-hidden">
                              <div className="flex justify-between items-start mb-6">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New Batter In</span>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CAREER SUMMARY</span>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                                  <span className="text-2xl font-black text-slate-600">{node.player?.[0]}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-xl font-black truncate">{node.player}</div>
                                  <div className="text-[11px] font-bold text-slate-400 mt-0.5">Rank #— (Batter)</div>
                                </div>
                                <div className="flex gap-4 text-right">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-500 uppercase">Mts</span>
                                    <span className="text-sm font-black text-white">—</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-500 uppercase">Inns</span>
                                    <span className="text-sm font-black text-white">—</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-500 uppercase">Avg</span>
                                    <span className="text-sm font-black text-white">—</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-500 uppercase">SR</span>
                                    <span className="text-sm font-black text-white">—</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="px-5 py-3 text-[13px] font-bold text-slate-900 dark:text-white leading-relaxed">
                              {node.player} is in at the crease.
                            </div>
                          </div>
                        );
                      }

                      if (node.type === 'announcement') {
                        return (
                          <div key={`ann-${idx}`} className="px-5 py-4 flex gap-6 bg-slate-100/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors">
                            <div className="flex flex-col items-center shrink-0 pt-1 w-10">
                              <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                                <span className="text-sm">📢</span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 flex items-center">
                              <div className="text-[14px] font-black text-blue-600 dark:text-blue-400 leading-relaxed italic">
                                {node.text}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (node.type === 'innings-summary') {
                        return (
                          <div key={`inn-sum-${idx}`} className="mx-4 my-8">
                            <div className="bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-[2.5rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden relative">
                              {/* Background Glow */}
                              <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-[80px]"></div>
                              <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-[80px]"></div>

                              {/* Header Area */}
                              <div className="px-7 pt-7 pb-5 border-b border-white/5 relative">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
                                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em]">Match Analysis</span>
                                  </div>
                                  <span className="px-3 py-1 bg-white/5 rounded-full text-[9px] font-black text-white/40 uppercase tracking-widest border border-white/5">Auto Generated</span>
                                </div>
                                <div className="flex items-end justify-between">
                                  <div>
                                    <h2 className="text-[28px] font-black text-white italic tracking-tighter uppercase leading-none">
                                      {node.label} <span className="text-white/40 not-italic font-medium lowercase">inns</span>
                                    </h2>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-4xl font-black text-white leading-none tabular-nums tracking-tighter">{node.totalScore}</div>
                                    <div className="text-[11px] font-bold text-white/30 uppercase tracking-[0.2em] mt-2 italic">{node.overs} OVERS</div>
                                  </div>
                                </div>
                              </div>

                              {/* Summary Grid */}
                              <div className="p-7 grid grid-cols-2 gap-10 relative">
                                {/* Batting Performance */}
                                <div className="space-y-5">
                                  <div className="flex items-center gap-2.5">
                                    <Trophy size={14} className="text-blue-400" />
                                    <span className="text-[11px] font-black text-blue-400 uppercase tracking-[0.15em]">Leading Batters</span>
                                  </div>
                                  <div className="space-y-4">
                                    {node.topBatters.length > 0 ? node.topBatters.map((b, bi) => (
                                      <div key={bi} className="flex items-center justify-between group">
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-[13px] font-black text-white/90 group-hover:text-white transition-colors truncate">{b.name}</span>
                                          <span className="text-[9px] font-bold text-white/30 truncate">S/R: {(b.runs / (b.balls || 1) * 100).toFixed(1)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 pl-3">
                                          <span className="text-lg font-black text-white tracking-tighter">{b.runs}</span>
                                          <span className="text-[11px] font-bold text-white/20 tabular-nums">({b.balls})</span>
                                        </div>
                                      </div>
                                    )) : (
                                      <div className="py-4 text-[11px] font-bold text-white/20 uppercase tracking-widest text-center border border-dashed border-white/5 rounded-xl">No Data</div>
                                    )}
                                  </div>
                                </div>

                                {/* Bowling Performance */}
                                <div className="space-y-5 border-l border-white/5 pl-10">
                                  <div className="flex items-center gap-2.5">
                                    <Zap size={14} className="text-emerald-400" />
                                    <span className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.15em]">Top Bowlers</span>
                                  </div>
                                  <div className="space-y-4">
                                    {node.topBowlers.length > 0 ? node.topBowlers.map((bw, bwi) => (
                                      <div key={bwi} className="flex items-center justify-between group">
                                        <div className="flex flex-col min-w-0">
                                          <span className="text-[13px] font-black text-white/90 group-hover:text-white transition-colors truncate">{bw.name}</span>
                                          <span className="text-[9px] font-bold text-white/30 truncate">Eco: {(bw.runs / (bw.balls / 6 || 1)).toFixed(1)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 pl-3">
                                          <span className="text-lg font-black text-white tracking-tighter">{bw.wickets}-{bw.runs}</span>
                                          <span className="text-[11px] font-bold text-white/20 tabular-nums">({bw.overs})</span>
                                        </div>
                                      </div>
                                    )) : (
                                      <div className="py-4 text-[11px] font-bold text-white/20 uppercase tracking-widest text-center border border-dashed border-white/5 rounded-xl">No Data</div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Footer Action */}
                              <div className="px-7 py-4 bg-white/[0.03] border-t border-white/5 flex items-center justify-center">
                                <span className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">End of {node.label} Innings</span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (node.type === 'wicket-card') {
                        return (
                          <div key={`wkt-${idx}`} className="mx-4 my-3">
                            <div className="bg-[#8b1c1c] rounded-2xl p-5 text-white shadow-xl relative overflow-hidden flex items-center gap-5">
                              <div className="w-16 h-16 rounded-full bg-white/10 flex flex-col items-center justify-center border-2 border-white/20 shrink-0">
                                <span className="text-[10px] font-black uppercase tracking-tighter mb-0.5 text-white/60">OUT</span>
                                <span className="text-2xl font-black italic">!</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="text-xl font-black truncate">{node.batsman}</div>
                                  <div className="bg-black/20 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-white/90">Wkt #{node.wickets || '—'}</div>
                                </div>

                                <div className="text-[11px] font-bold text-white/60 uppercase tracking-widest mb-4 flex items-center gap-2">
                                  <span>{node.matchScore}</span>
                                  <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                  <span>Over {node.overStr}</span>
                                </div>

                                <div className="flex gap-6">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-white/40 uppercase tracking-tighter">Runs(Balls)</span>
                                    <span className="text-base font-black text-white tabular-nums">{node.batterRuns}({node.batterBalls})</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-white/40 uppercase tracking-tighter">SR</span>
                                    <span className="text-base font-black text-white tabular-nums">{node.batterBalls > 0 ? (node.batterRuns / node.batterBalls * 100).toFixed(1) : '0.0'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="px-5 py-4 text-[13px] font-medium text-slate-700 dark:text-slate-300 leading-relaxed italic border-b border-slate-100 dark:border-white/5">
                              {node.text}
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
                          className="px-5 py-6 flex gap-6 bg-white dark:bg-[#0f172a] border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors"
                        >
                          <div className="flex flex-col items-center shrink-0 pt-1 w-10">
                            <span className="text-[11px] font-black text-slate-400 tabular-nums text-center mb-1.5">{item.over}</span>
                            <div className={`h-8 rounded-full flex items-center justify-center font-black shrink-0 shadow-sm whitespace-nowrap ${getBallColorClass(resLabel)}`}
                              style={{
                                minWidth: '2rem',
                                width: 'auto',
                                padding: resLabel.length > 1 ? '0 5px' : '0',
                                fontSize: resLabel.length > 2 ? '8px' : '10px'
                              }}
                            >
                              {resLabel}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="text-[14px] font-black text-slate-900 dark:text-white leading-tight">
                              {item.bowler && item.batsman ? (
                                <span>{item.bowler} to {item.batsman}, </span>
                              ) : null}
                              <span className="font-medium text-slate-700 dark:text-slate-300">{item.text}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {hasMore && (
                      <div className="p-6 text-center bg-white dark:bg-[#0f172a] border-t border-slate-100 dark:border-white/5">
                        <button
                          onClick={() => {
                            if (typeof window !== 'undefined' && window.setActiveTab) {
                              window.setActiveTab('commentary');
                            }
                          }}
                          className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2 mx-auto"
                        >
                          See All Commentary
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
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
