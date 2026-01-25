/**
 * Professional Live Section Component
 * User-friendly, responsive design with better UX
 */
import React from 'react'
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
  resultSummary,
  teamAName,
  teamBName,
  onlyCommentary,
}) => {
  const isFinishedMatch = matchStatus === 'Finished' || matchStatus === 'Completed';

  // Calculate Win Probability
  const winProb = React.useMemo(() => {
    if (isFinishedMatch) return { teamAWinProb: 50, teamBWinProb: 50 };

    const [ov, b] = (currentOvers || '0.0').toString().split('.');
    const legalBalls = (Number(ov) * 6) + Number(b || 0);
    const battingTeamSide = currentInnings?.inningId || 'teamA';

    return calculateWinProbability({
      currentRuns: Number(currentRuns || 0),
      wickets: Number(currentInnings?.totalWickets || 0),
      legalBalls,
      target: target ? Number(target) : null,
      oversLimit: Number(oversLimit || 20),
      battingTeamSide
    });
  }, [currentRuns, currentInnings?.totalWickets, currentInnings?.inningId, currentOvers, target, oversLimit, isFinishedMatch]);

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
      // Robust over grouping logic
      const overStr = String(item.over || '0.0')
      const [oversPart, ballsPart] = overStr.split('.')
      const overInt = parseInt(oversPart || '0')
      const ballInt = parseInt(ballsPart || '0')

      // Cricket logic: 0.1 to 0.6 (1.0) is Over 1. 
      // 1.0 belongs to Over 1. 1.1 belongs to Over 2.
      const overGroupNum = (ballInt === 0 && overInt > 0) ? overInt : overInt + 1

      const inningId = item.inningId || 'teamA'
      const key = `${inningId}-${overGroupNum}`

      if (!map[key]) {
        map[key] = {
          inningId,
          overNum: overGroupNum,
          balls: [],
          totalRuns: 0,
          timestamp: item.timestamp?.toMillis ? item.timestamp.toMillis() : Date.now()
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

  return (
    <div className="bg-[#f8fafc] min-h-screen pb-8">
      <div className="max-w-4xl mx-auto px-0 sm:px-4 py-3 space-y-4">

        {!isFinishedMatch && !onlyCommentary && (
          <div className="bg-white p-4 border-b border-slate-100 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex flex-col">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter mb-0.5">{teamAName.substring(0, 3).toUpperCase()}</span>
                <span className="text-xl font-medium text-slate-900 leading-none">{teamAProb}%</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-300 uppercase tracking-widest italic">
                <span className="w-3 h-3 rounded-full border border-slate-200 flex items-center justify-center text-[6px]">i</span>
                WIN %
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter mb-0.5">{teamBName.substring(0, 3).toUpperCase()}</span>
                <span className="text-xl font-medium text-slate-900 leading-none">{teamBProb}%</span>
              </div>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#1e293b] flex overflow-hidden">
              <div className="h-full bg-[#911d33] transition-all duration-1000" style={{ width: `${teamAProb}%` }}></div>
              <div className="h-full bg-blue-900 transition-all duration-1000" style={{ width: `${teamBProb}%` }}></div>
            </div>
          </div>
        )}

        {!onlyCommentary && (
          <div className="bg-white border-y border-slate-100 divide-y divide-slate-100">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 uppercase tracking-tight">
                <span>Batter</span>
                <div className="flex gap-6 pr-1">
                  <span className="w-10 text-right">R (B)</span>
                  <span className="w-6 text-center">4s</span>
                  <span className="w-6 text-center">6s</span>
                  <span className="w-10 text-right">SR</span>
                </div>
              </div>
              <div className="space-y-3">
                {[striker, nonStriker].map((p, i) => p && (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{p.name}</span>
                      {i === 0 && <img src={cricketBatIcon} className="w-4 h-4 opacity-40 ml-1" alt="" />}
                    </div>
                    <div className="flex gap-6 pr-1 text-sm font-medium text-slate-800 items-baseline">
                      <div className="w-10 text-right flex items-baseline justify-end gap-1">
                        <span className="text-base">{p.runs || 0}</span>
                        <span className="text-[10px] text-slate-400">({p.balls || 0})</span>
                      </div>
                      <span className="w-6 text-center text-slate-500 font-medium">{p.fours || 0}</span>
                      <span className="w-6 text-center text-slate-500 font-medium">{p.sixes || 0}</span>
                      <span className="w-10 text-right text-slate-400 font-medium text-xs">{(p.strikeRate || (p.balls > 0 ? (p.runs / p.balls * 100) : 0)).toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">P'ship:</span>
                  <span className="text-xs font-medium text-slate-700">{formatPartnership()}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">Last wkt:</span>
                  <span className="text-xs font-medium text-slate-700">{formatLastWicket() || '—'}</span>
                </div>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 uppercase tracking-tight">
                <span>Bowler</span>
                <div className="flex gap-6 pr-1">
                  <span className="w-10 text-right">W-R</span>
                  <span className="w-10 text-center">Overs</span>
                  <span className="w-10 text-right">ECO</span>
                </div>
              </div>
              {currentBowler && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">{currentBowler.name}</span>
                  <div className="flex gap-6 pr-1 text-sm font-medium text-slate-800">
                    <span className="w-10 text-right text-base">{currentBowler.wickets || 0}-{currentBowler.runsConceded || 0}</span>
                    <span className="w-10 text-center text-slate-400 font-medium">{currentBowler.overs || '0.0'}</span>
                    <span className="w-10 text-right text-slate-400 font-medium">{(currentBowler.economy || (currentBowler.overs > 0 ? (currentBowler.runsConceded / currentBowler.overs) : 0)).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {!isFinishedMatch && !onlyCommentary && (
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
                                  isExtra ? (upperText.includes('WIDE') ? 'wd' : 'nb') :
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

                    let displayVal = item.runs
                    let ballType = isWicket ? 'wicket' : 'run'
                    const isBoundary = item.isBoundary || isFour || isSix

                    if (!isBoundary && !isWicket && displayVal === 0) {
                      const upperText = String(item.text || '').toUpperCase()
                      if (upperText.includes('WIDE') || upperText.includes(' WIDE ')) {
                        displayVal = 'wd'
                        ballType = 'wide'
                      } else if (upperText.includes('NO BALL') || upperText.includes('NO-BALL')) {
                        displayVal = 'nb'
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
