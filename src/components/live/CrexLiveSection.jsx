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
import { useTranslation } from '../../hooks/useTranslation'

import cricketBatIcon from '../../assets/cricket-bat.png'

const getBallColorClass = (result) => {
  const r = String(result || '').toUpperCase();
  if (r === 'W' || r.includes('OUT')) return 'bg-rose-600 text-white border-rose-500 shadow-sm';
  if (r.includes('6')) return 'bg-emerald-600 text-white border-emerald-500 shadow-sm';
  if (r.includes('4')) return 'bg-blue-600 text-white border-blue-500 shadow-sm';

  return 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 shadow-sm';
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
  playersMap,
}) => {
  const { t } = useTranslation();
  const isFinishedMatch = matchStatus === 'Finished' || matchStatus === 'Completed';
  const isInningsBreak = matchStatus === 'InningsBreak';

  // Helper: find a player's career stats by name from the playersMap
  const findPlayerByName = (name) => {
    if (!playersMap || !name) return null;
    let found = null;
    playersMap.forEach((p) => {
      if (p?.name === name || p?.displayName === name) found = p;
    });
    return found;
  };

  // Calculate Win Probability
  const winProb = React.useMemo(() => {
    if (isFinishedMatch || matchPhase === 'Tied') return { teamAWinProb: 50, teamBWinProb: 50 };

    const [ov, b] = (currentOvers || '0.0').toString().split('.');
    const legalBalls = (Number(ov) * 6) + Number(b || 0);

    // Robust batting side detection
    const battingInningId = currentInnings?.inningId || (match && match.currentBatting) || 'teamA';
    const battingTeamSide = battingInningId.includes('teamB') ? 'teamB' : 'teamA';

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

    const prob = calculateWinProbability({
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

    return prob;
  }, [currentRuns, currentInnings?.totalWickets, currentInnings?.inningId, currentOvers, target, oversLimit, isFinishedMatch, recentOvers, matchStatus, matchPhase, match?.currentBatting]);

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
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                        OVER {over.overNumber}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {ballsToShow.map((b, bIdx) => {
                          let val = String(b?.value || b?.label || b?.runsOffBat || b?.runs || '').trim() || '0'
                          if (val === '·') val = '0'
                          const isBoundary = val === '4' || val === '6';
                          const isWicket = b?.type === 'wicket' || val === 'W' || val.toUpperCase().includes('OUT') || String(val).includes('W');

                          let dotStyle = "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 shadow-sm"

                          if (isBoundary) dotStyle = val === '4'
                            ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                            : "bg-emerald-600 text-white border-emerald-500 shadow-sm";

                          if (isWicket) dotStyle = "bg-rose-600 text-white border-rose-500 shadow-sm";

                          return (
                            <div key={bIdx}
                              className={`${dotStyle} h-7 w-7 rounded-full flex items-center justify-center font-bold shrink-0 border transition-all whitespace-nowrap text-[11px]`}
                              style={{
                                minWidth: '1.75rem',
                                width: 'auto',
                                padding: val.length > 1 ? '0 6px' : '0'
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
                      <div className="flex items-center gap-1.5 ml-1.5 cursor-default">
                        <span className="text-xs font-medium text-slate-400">=</span>
                        <span className="text-base font-medium text-slate-900 dark:text-slate-100">{overTotal}</span>
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
          <div className="bg-white dark:bg-[#0f172a] px-5 py-2 border-b border-slate-100 dark:border-white/5 space-y-2">
            {/* Single Row: Team Name Left - Label Center - Team Name Right */}
            <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 dark:text-slate-400 uppercase tracking-tight">
              <span className="shrink-0 w-[30%] text-left truncate">
                {(() => {
                  const curBatId = currentInnings?.inningId || (match && match.currentBatting) || '';
                  return formatShortTeamName(curBatId.includes('teamB') ? teamBName : teamAName);
                })()}
              </span>

              <div className="flex items-center justify-center gap-1 flex-1">
                <Zap size={10} className="text-amber-500 fill-amber-500 shrink-0" />
                <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 tracking-widest whitespace-nowrap">Real Time Win %</span>
              </div>

              <span className="shrink-0 w-[30%] text-right truncate">
                {(() => {
                  const curBatId = currentInnings?.inningId || (match && match.currentBatting) || '';
                  return formatShortTeamName(curBatId.includes('teamB') ? teamAName : teamBName);
                })()}
              </span>
            </div>

            {/* Bottom Row: Odds Bar */}
            {(() => {
              const curBatId = currentInnings?.inningId || (match && match.currentBatting) || '';
              const isTeamABatting = curBatId.includes('teamA');
              const leftProb = isTeamABatting ? teamAProb : teamBProb;
              const rightProb = isTeamABatting ? teamBProb : teamAProb;

              return (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums w-8">{leftProb}%</span>
                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full flex overflow-hidden ring-2 ring-slate-50 dark:ring-white/[0.01]">
                    {/* Batting team color (Left) and Bowling team color (Right) */}
                    <div className="h-full bg-blue-600 transition-all duration-1000 shadow-[1px_0_4px_rgba(37,99,235,0.3)] relative z-10" style={{ width: `${leftProb}%` }}></div>
                    <div className="h-full bg-rose-600 transition-all duration-1000" style={{ width: `${rightProb}%` }}></div>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white tabular-nums w-8 text-right">{rightProb}%</span>
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
                          <Link to={`/players/${p.id || p.playerId || p.batsmanId}`} className={`text-sm font-medium transition-colors ${p.isOut ? 'text-slate-600 line-through decoration-red-500/70' : 'text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400'}`}>
                            {p.name}
                          </Link>
                        ) : (
                          <span className={`text-sm font-medium ${p.isOut ? 'text-slate-600' : 'text-slate-800 dark:text-slate-200'}`}>{p.name}</span>
                        )}
                        {p.id === striker?.id && !p.isOut && <img src={cricketBatIcon} className="w-4 h-4 opacity-40 ml-1" alt="" />}
                      </div>
                      <div className={`flex gap-6 pr-1 text-sm items-baseline ${p.isOut ? 'text-slate-600' : 'text-slate-800 dark:text-slate-200'}`}>
                        <div className="w-10 text-right flex items-baseline justify-end gap-1">
                          <span className={`text-base font-bold ${p.isOut ? 'text-slate-700' : 'text-slate-900 dark:text-white'}`}>{p.runs || 0}</span>
                          <span className="text-[10px] opacity-80 font-medium">({p.balls || 0})</span>
                        </div>
                        <span className="w-6 text-center opacity-80 font-semibold">{p.fours || 0}</span>
                        <span className="w-6 text-center opacity-80 font-semibold">{p.sixes || 0}</span>
                        <span className="w-10 text-right opacity-60 font-semibold text-[11px]">{(p.strikeRate || (p.balls > 0 ? (p.runs / p.balls * 100) : 0)).toFixed(1)}</span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">P'SHIP:</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{formatPartnership()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">LAST WKT:</span>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{formatLastWicket() || '—'}</span>
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
                      <Link to={`/players/${currentBowler?.bowlerId || currentBowler?.id}`} className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                        {currentBowler?.bowlerName || currentBowler?.name || 'Bowler'}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{currentBowler?.bowlerName || currentBowler?.name || 'Bowler'}</span>
                    )}
                  </div>
                  <div className="flex gap-6 pr-1 text-sm text-slate-800 dark:text-slate-200 items-center">
                    <span className="w-10 text-right font-bold text-slate-900 dark:text-white">{currentBowler.wickets || 0}-{currentBowler.runsConceded || 0}</span>
                    <span className="text-[10px] w-10 text-center text-slate-500 dark:text-slate-400 font-semibold">({currentBowler.overs || 0})</span>
                    <span className="w-10 text-right text-slate-500 dark:text-slate-400 font-semibold text-[11px]">{(currentBowler.economy || 0).toFixed(1)}</span>
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
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Projected Score</h3>
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
                <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] bg-slate-100/50 dark:bg-slate-800/40 p-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider items-center">
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
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">At this stage</h3>
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
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-base font-bold uppercase">
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
                            <span className="text-lg font-bold text-slate-400 dark:text-slate-300">{name[0]}</span>
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
                    <span className="text-[10px] font-bold text-slate-900 dark:text-white">VS</span>
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
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-500 to-pink-600 text-white text-base font-bold uppercase">
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
                            <span className="text-lg font-bold text-slate-400 dark:text-slate-500">{defendingName[0]}</span>
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
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.2em] whitespace-nowrap">End of Over {item.overNum}</span>
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
                                    className={`h-7 rounded-full flex items-center justify-center font-bold shrink-0 border transition-all whitespace-nowrap text-[11px] ${getBallColorClass(resLabel)}`}
                                    style={{
                                      minWidth: '1.75rem',
                                      width: 'auto',
                                      padding: resLabel.length > 1 ? '0 6px' : '0'
                                    }}
                                  >
                                    {resLabel === '·' ? '0' : resLabel}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 ml-1.5 cursor-default">
                              <span className="text-xs font-medium text-slate-400">=</span>
                              <span className="text-base font-medium text-slate-900 dark:text-slate-100">{item.totalRuns}</span>
                              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors ml-1.5" />
                            </div>
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
                let partnershipRuns = 0;
                let partnershipBalls = 0;

                const playerTracker = {};
                const bowlerTracker = {};

                const pushInningsSummary = (finalRuns, finalWickets, finalOvers, innId, batters, bowlers) => {
                  // Function disabled to remove summary cards from commentary
                };

                let prevInningId = null;
                let lastTotalRuns = 0;
                let lastTotalWickets = 0;
                let lastOvers = '0.0';
                let lastBatters = {};
                let lastBowlers = {};

                let batterCount = 0;

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
                    batterCount = 0;
                    currentBatchInningId = item.inningId;
                    Object.keys(playerTracker).forEach(k => delete playerTracker[k]);
                    Object.keys(bowlerTracker).forEach(k => delete bowlerTracker[k]);
                    playerTracker._overBalls = [];
                  }

                  // Initialize trackers
                  if (item.batsman && !playerTracker[item.batsman]) {
                    batterCount++;
                    playerTracker[item.batsman] = { runs: 0, balls: 0, fours: 0, sixes: 0, pos: batterCount };
                  }
                  if (item.bowler && !bowlerTracker[item.bowler]) bowlerTracker[item.bowler] = { runs: 0, wickets: 0, balls: 0 };

                  const runsPerBall = Number(item.runs || 0);
                  runningTotalRuns += runsPerBall;
                  overRuns += runsPerBall;
                  partnershipRuns += runsPerBall;

                  if (item.isWicket) {
                    runningTotalWickets += 1;
                    overWickets += 1;
                  }

                  const upperText = String(item.text || '').toUpperCase();
                  const isWide = item.ballType === 'wide' || upperText.includes('WIDE');
                  const isNoBall = item.ballType === 'no-ball' || upperText.includes('NO BALL') || upperText.includes('NO-BALL');

                  // Track Batter
                  if (item.batsman) {
                    if (!isWide) {
                      playerTracker[item.batsman].runs += runsPerBall;
                      playerTracker[item.batsman].balls += 1;
                      if (item.isFour || item.runs === 4) playerTracker[item.batsman].fours += 1;
                      if (item.isSix || item.runs === 6) playerTracker[item.batsman].sixes += 1;
                      partnershipBalls += 1;
                    } else {
                      // Wide adds to partnership runs but not balls
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
                    if (item.type === 'entry') {
                      const pos = playerTracker[item.batsman]?.pos || '...';
                      const stats = playerTracker[item.batsman] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
                      groupedCommentary.push({ type: 'entry', text: item.text, player: item.batsman, position: pos, stats });
                    } else if (item.type === 'bowler_entry') {
                      const stats = bowlerTracker[item.bowler] || { runs: 0, wickets: 0, balls: 0 };
                      groupedCommentary.push({ type: 'bowler_entry', text: item.text, player: item.bowler, stats });
                    } else {
                      groupedCommentary.push({ type: 'announcement', ...item });
                    }
                  } else if (item.text?.toLowerCase().includes('is in at')) {
                    const pos = playerTracker[item.batsman]?.pos || '...';
                    const stats = playerTracker[item.batsman] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
                    groupedCommentary.push({ type: 'entry', text: item.text, player: item.batsman, position: pos, stats });
                  } else {
                    groupedCommentary.push({ type: 'ball', ...item });
                  }

                  if (item.isWicket && !item.manual) {
                    const stats = playerTracker[item.batsman] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
                    groupedCommentary.push({
                      type: 'wicket-card',
                      ...item,
                      wickets: runningTotalWickets,
                      batterRuns: stats.runs,
                      batterBalls: stats.balls,
                      fours: stats.fours,
                      sixes: stats.sixes,
                      matchScore: `${runningTotalRuns}/${runningTotalWickets}`,
                      overStr: item.over,
                      partnership: { runs: partnershipRuns, balls: partnershipBalls }
                    });
                    // Reset partnership after a wicket
                    partnershipRuns = 0;
                    partnershipBalls = 0;
                  }

                  if ((item.milestone === '50' || item.milestone === '100') && !item.manual) {
                    const stats = playerTracker[item.batsman] || { runs: 0, balls: 0 };
                    groupedCommentary.push({
                      type: 'milestone-card',
                      ...item,
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
                          <div key={`ov-${idx}`} className="mx-4 my-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
                            {/* Card Header: Ov, Runs, Total Score */}
                            <div className="px-4 py-2 bg-slate-50/80 dark:bg-white/[0.02] flex items-center justify-between border-b border-slate-100 dark:border-white/5">
                              <div className="flex items-center gap-4">
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-tight">OV {node.overNum}</span>
                                <span className="text-[10px] font-bold text-slate-900 dark:text-white tracking-tight">{node.overRuns} Runs</span>
                              </div>
                              <div className="text-[10px] font-bold text-slate-900 dark:text-white tracking-tight uppercase">
                                {node.inningLabel} {node.totalScore}
                              </div>
                            </div>

                            {/* Card Body: 3-Column Layout */}
                            <div className="p-4 grid grid-cols-3 gap-3">
                              {/* Left Batter */}
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[12px] font-bold text-blue-600 dark:text-blue-400 truncate tracking-tight">{node.striker}</span>
                                <span className="text-[13px] font-bold text-slate-900 dark:text-white tabular-nums">{node.strikerStats || '0(0)'}</span>
                              </div>

                              {/* Right Batter */}
                              <div className="flex flex-col gap-0.5 items-center">
                                <span className="text-[12px] font-bold text-blue-600 dark:text-blue-400 truncate tracking-tight">{node.nonStriker}</span>
                                <span className="text-[13px] font-bold text-slate-900 dark:text-white tabular-nums">{node.nonStrikerStats || '0(0)'}</span>
                              </div>

                              {/* Bowler */}
                              <div className="flex flex-col gap-0.5 items-end">
                                <span className="text-[12px] font-bold text-blue-600 dark:text-blue-400 truncate tracking-tight">{node.bowler}</span>
                                <span className="text-[13px] font-bold text-slate-900 dark:text-white tabular-nums">{node.bowlerFigure}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (node.type === 'entry') {
                        const playerData = findPlayerByName(node.player);
                        const career = playerData?.stats?.batting;
                        const careerInnings = career?.innings || 0;
                        const careerRuns = career?.runs || 0;
                        const careerSR = career?.strikeRate ? career.strikeRate.toFixed(1) : '0.0';

                        return (
                          <div key={`entry-${idx}`} className="mx-4 my-4 space-y-3">
                            {/* Career Stats / Player Info Card */}
                            <div className="bg-[#1a1a1a] rounded-2xl p-4 text-white shadow-xl border border-white/5 relative overflow-hidden">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                  Batting at #{node.position !== '...' ? node.position : ''} Position
                                </span>
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                  Career Stats
                                </span>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                                  {playerData?.photoUrl ? (
                                    <img src={playerData.photoUrl} className="w-full h-full object-cover" alt="" />
                                  ) : (
                                    <div className="text-2xl opacity-40">👤</div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-lg font-bold tracking-tight truncate leading-tight uppercase italic">{node.player}</h3>
                                  <span className="text-[11px] font-medium text-white/50 block">Batter</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-center shrink-0">
                                  <div>
                                    <span className="text-[9px] font-bold text-white/30 uppercase block">Inns</span>
                                    <span className="text-sm font-bold tabular-nums">{careerInnings}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-bold text-white/30 uppercase block">Runs</span>
                                    <span className="text-sm font-bold tabular-nums">{careerRuns}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-bold text-white/30 uppercase block">SR</span>
                                    <span className="text-sm font-bold tabular-nums text-amber-400">{careerSR}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Entry Announcement Text */}
                            <div className="text-[14px] font-bold text-slate-800 dark:text-slate-200 pl-1 italic">
                              <span className="text-blue-600 dark:text-blue-400 font-black mr-2">NEW BATTER:</span>
                              {node.text}
                            </div>
                          </div>
                        );
                      }

                      if (node.type === 'bowler_entry') {
                        const playerData = findPlayerByName(node.player);
                        const career = playerData?.stats?.bowling;
                        const careerInnings = career?.innings || 0;
                        const careerWickets = career?.wickets || 0;
                        const careerEco = career?.economy ? career.economy.toFixed(2) : '0.00';

                        return (
                          <div key={`entry-${idx}`} className="mx-4 my-4 space-y-3">
                            <div className="bg-[#1a1a1a] rounded-2xl p-4 text-white shadow-xl border border-white/5 relative overflow-hidden">
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                  New Bowler
                                </span>
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                  Career Stats
                                </span>
                              </div>

                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                                  {playerData?.photoUrl ? (
                                    <img src={playerData.photoUrl} className="w-full h-full object-cover" alt="" />
                                  ) : (
                                    <div className="text-2xl opacity-40">🏏</div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="text-lg font-bold tracking-tight truncate leading-tight uppercase italic">{node.player}</h3>
                                  <span className="text-[11px] font-medium text-white/50 block">Bowler</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-center shrink-0">
                                  <div>
                                    <span className="text-[9px] font-bold text-white/30 uppercase block">Inns</span>
                                    <span className="text-sm font-bold tabular-nums">{careerInnings}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-bold text-white/30 uppercase block">Wkts</span>
                                    <span className="text-sm font-bold tabular-nums text-amber-500">{careerWickets}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] font-bold text-white/30 uppercase block">Eco</span>
                                    <span className="text-sm font-bold tabular-nums">{careerEco}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="text-[14px] font-bold text-slate-800 dark:text-slate-200 pl-1 italic">
                              <span className="text-emerald-600 dark:text-emerald-400 font-black mr-2">BOWLER CHANGE:</span>
                              {node.text}
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
                              <div className="text-[14px] font-semibold text-blue-600 dark:text-blue-400 leading-relaxed italic">
                                {node.text}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (node.type === 'milestone-card') {
                        const isHundred = node.milestone === '100';
                        const themeColor = isHundred ? '#8b5cf6' : '#f59e0b';
                        const gradient = isHundred
                          ? "from-[#2e1065] via-[#4c1d95] to-[#7c3aed]"
                          : "from-[#451a03] via-[#92400e] to-[#d97706]";

                        return (
                          <div key={`ms-${idx}`} className="mx-4 my-3">
                            <div className={`bg-gradient-to-br ${gradient} rounded-xl p-3.5 text-white shadow-xl relative overflow-hidden border-l-4`} style={{ borderLeftColor: themeColor }}>
                              <div className="flex items-center gap-3.5 relative z-10">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex flex-col">
                                      <span style={{ color: themeColor }} className="text-[8px] font-black uppercase tracking-[0.2em] mb-0.5">MILESTONE</span>
                                      <h3 className="text-xl font-black italic tracking-tight uppercase leading-none">{node.batsman}</h3>
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span className="text-3xl font-black italic leading-none" style={{ color: themeColor }}>{node.milestone}</span>
                                      <span className="text-[7px] font-bold opacity-60 uppercase">RUNS</span>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-2.5">
                                    <div>
                                      <span className="text-[7px] font-black text-white/40 uppercase block">Performance</span>
                                      <span className="text-[11px] font-black">{node.batterRuns} <span className="text-[9px] font-medium opacity-60">({node.batterBalls})</span></span>
                                    </div>
                                    <div>
                                      <span className="text-[7px] font-black text-white/40 uppercase block">SR</span>
                                      <span className="text-[11px] font-black">{node.batterBalls > 0 ? (node.batterRuns / node.batterBalls * 100).toFixed(1) : '0.0'}</span>
                                    </div>
                                    <div className="text-right">
                                      <span className="text-[7px] font-black text-white/40 uppercase block">Match Score</span>
                                      <span className="text-[11px] font-black">{node.matchScore}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-2.5 bg-black/20 rounded p-2 text-[11px] font-medium border border-white/5 italic">
                                <span style={{ color: themeColor }} className="font-bold mr-1.5 uppercase text-[9px]">Achievement:</span>
                                {node.text}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (node.type === 'wicket-card') {
                        const dismissalDetails = (() => {
                          let type = (node.wicketType || 'out').toLowerCase().replace(/\s+/g, '');
                          const text = (node.text || '').toLowerCase();
                          const b = node.bowler || 'Bowler';
                          let f = node.fielder || '';

                          // Try to extract fielder from text if missing (e.g. "c Ravindra b Pillips")
                          if (!f && (text.includes(' c ') || text.includes(' caught '))) {
                            const cMatch = text.match(/caught\s+([A-Za-z\s]+)\b/) || text.match(/\bc\s+([A-Za-z\s]+)\b/);
                            if (cMatch && cMatch[1]) {
                              const potentialFielder = cMatch[1].split(' b ')[0].trim();
                              if (potentialFielder && potentialFielder.length < 25) f = potentialFielder;
                            }
                          }

                          // If type is still generic "out", try to guess from text
                          if (type === 'out' || type === 'wicket') {
                            if (text.includes('caught') || text.includes(' c ')) type = 'caught';
                            else if (text.includes('bowled') || text.includes(' b ')) type = 'bowled';
                            else if (text.includes('lbw')) type = 'lbw';
                            else if (text.includes('run out')) type = 'runout';
                            else if (text.includes('stumped')) type = 'stumped';
                          }

                          // Normalize special types
                          if (type.includes('caught&bowled') || type === 'c&b' || type === 'candb') type = 'caught&bowled';

                          const bowlerSpan = <span className="font-bold">{b}</span>;
                          const fielderSpan = <span className="font-bold">{f}</span>;

                          if (type === 'bowled') return <span>b {bowlerSpan}</span>;
                          if (type === 'caught') {
                            if (!f || f.toLowerCase() === b.toLowerCase()) return <span>c & b {bowlerSpan}</span>;
                            return <span>c {fielderSpan} b {bowlerSpan}</span>;
                          }
                          if (type === 'caught&bowled') return <span>c & b {bowlerSpan}</span>;
                          if (type === 'lbw') return <span>lbw b {bowlerSpan}</span>;
                          if (type === 'runout' || type === 'run out') return f ? <span>run out ({fielderSpan})</span> : <span>run out</span>;
                          if (type === 'stumped') return f ? <span>stumped {fielderSpan} b {bowlerSpan}</span> : <span>stumped b {bowlerSpan}</span>;

                          // Fallback
                          if (f && type !== 'out') return <span>{type} {fielderSpan} b {bowlerSpan}</span>;
                          if (type !== 'out') return <span>{type} b {bowlerSpan}</span>;
                          return <span>b {bowlerSpan}</span>;
                        })();

                        const strikeRate = node.batterBalls > 0 ? ((node.batterRuns / node.batterBalls) * 100).toFixed(1) : '0.0';

                        return (
                          <div key={`wkt-${idx}`} className="mx-4 my-3">
                            <div className="bg-gradient-to-br from-[#8b1e1e] via-[#741616] to-[#5a0f0f] rounded-2xl p-4 text-white shadow-xl relative overflow-hidden border border-white/10">
                              {/* Background Decorative Element */}
                              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>

                              <div className="flex items-center gap-4 relative z-10">
                                {/* Left: Player Image & Out Badge */}
                                <div className="relative shrink-0">
                                  <div className="w-16 h-16 rounded-full bg-black/30 border-2 border-white/20 overflow-hidden flex items-center justify-center">
                                    <div className="text-2xl opacity-50">👤</div>
                                  </div>
                                  <div className="absolute -bottom-1 -right-1 bg-red-600 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-white/40 shadow-sm">
                                    OUT
                                  </div>
                                </div>

                                {/* Center: Name, Score, Dismissal */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-base font-bold tracking-tight truncate">{node.batsman}</h3>
                                    <span className="text-base font-bold text-amber-400 tabular-nums">
                                      {node.batterRuns} <span className="text-[12px] font-medium text-white/70">({node.batterBalls})</span>
                                    </span>
                                    <div className="ml-2 bg-white/10 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider text-white/80 border border-white/5 whitespace-nowrap">
                                      Wkt #{node.wickets}
                                    </div>
                                  </div>
                                  <div className="text-[12px] font-medium text-white/80 italic leading-none flex items-center gap-1">
                                    {dismissalDetails}
                                  </div>
                                </div>

                                {/* Right: 4s/6s & SR */}
                                <div className="text-right shrink-0 pl-2">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-tighter">4s/6s</span>
                                    <span className="text-[13px] font-extrabold tabular-nums">
                                      {node.fours || 0}/{node.sixes || 0}
                                    </span>
                                  </div>
                                  <div className="flex flex-col mt-1">
                                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-tighter">SR</span>
                                    <span className="text-[13px] font-extrabold tabular-nums text-amber-400">{strikeRate}</span>
                                  </div>
                                </div>
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
                      const resLabel = getBallResultLabel(item);

                      return (
                        <div
                          key={`ball-${idx}`}
                          className="px-5 py-6 flex gap-6 bg-white dark:bg-[#0f172a] border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors"
                        >
                          <div className="flex flex-col items-center shrink-0 pt-1 w-10">
                            <span className="text-[11px] font-semibold text-slate-400 tabular-nums text-center mb-1.5">{item.over}</span>
                            <div className={`h-8 rounded-full flex items-center justify-center font-semibold shrink-0 shadow-sm whitespace-nowrap ${getBallColorClass(resLabel)}`}
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
                            <div className="text-[14px] font-semibold text-slate-900 dark:text-white leading-tight">
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
                          className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold uppercase tracking-[0.2em] rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2 mx-auto"
                        >
                          See All Commentary
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()
              }
            </div>
          </div >
        </div >
        {/* Team Form Section */}
        {
          teamFormAndH2H && (
            <div className="px-4 py-6 space-y-6">
              {/* Team Form and Head to Head sections removed as requested */}

              {/* Points Table Context */}
              {hasGroup && tournamentId && (
                <div className="space-y-4">
                  <h3 className="text-[14px] font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wide px-1">Points Table</h3>
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
          )
        }

      </div >
    </div >
  )
}

export default CrexLiveSection
