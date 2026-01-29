/**
 * Match Graphs Page
 * Dynamic graphs based on actual overs played
 */

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { Ball, Match, InningsStats } from '@/types'
import MatchLiveSkeleton from '@/components/skeletons/MatchLiveSkeleton'

export default function MatchGraphs({ compact = false }: { compact?: boolean }) {
  const { matchId } = useParams<{ matchId: string }>()
  const [match, setMatch] = useState<Match | null>(null)
  const [teamAInnings, setTeamAInnings] = useState<InningsStats | null>(null)
  const [teamBInnings, setTeamBInnings] = useState<InningsStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!matchId) {
      setLoading(false)
      setMatch(null)
      return
    }

    const unsubscribe = matchService.subscribeToMatch(matchId, (matchData) => {
      setMatch(matchData)
      if (matchData) setLoading(false)
    })

    const unsubA = matchService.subscribeToInnings(matchId, 'teamA', (innings) => {
      setTeamAInnings(innings)
    })

    const unsubB = matchService.subscribeToInnings(matchId, 'teamB', (innings) => {
      setTeamBInnings(innings)
    })

    return () => {
      unsubscribe()
      unsubA()
      unsubB()
    }
  }, [matchId])

  // IMPORTANT: all hooks (useMemo/useEffect/etc.) must run before any conditional return.
  const teamAName = (match as any)?.teamAName || (match as any)?.teamA || 'Team A'
  const teamBName = (match as any)?.teamBName || (match as any)?.teamB || 'Team B'
  const oversLimit = Number((match as any)?.oversLimit || 0)

  // Batting Order logic
  const { firstSide, secondSide } = useMemo(() => {
    if (!match) return { firstSide: 'teamA' as const, secondSide: 'teamB' as const }
    const tw = String((match as any).tossWinner || '').trim()
    const decRaw = String((match as any).electedTo || (match as any).tossDecision || '').trim().toLowerCase()
    if (!tw || !decRaw) return { firstSide: 'teamA' as const, secondSide: 'teamB' as const }

    const tossSide = (tw === 'teamA' || tw === (match as any).teamAId || tw === (match as any).teamASquadId) ? 'teamA' : 'teamB'
    const battedFirst = decRaw.includes('bat') ? tossSide : (tossSide === 'teamA' ? 'teamB' : 'teamA')
    return {
      firstSide: battedFirst as 'teamA' | 'teamB',
      secondSide: (battedFirst === 'teamA' ? 'teamB' : 'teamA') as 'teamA' | 'teamB'
    }
  }, [match])

  const firstName = firstSide === 'teamA' ? teamAName : teamBName
  const secondName = secondSide === 'teamA' ? teamAName : teamBName
  const firstInns = firstSide === 'teamA' ? teamAInnings : teamBInnings
  const secondInns = secondSide === 'teamA' ? teamAInnings : teamBInnings

  // Data extraction from InningsStats
  const extractManhattan = (inns: InningsStats | null) => {
    if (!inns || !inns.recentOvers) return []
    return inns.recentOvers.map(o => ({
      over: o.overNumber,
      runs: o.totalRuns || 0,
      wickets: (o.balls || []).filter((b: any) => b.type === 'wicket').length
    })).sort((a, b) => a.over - b.over)
  }

  const manhattanA = useMemo(() => extractManhattan(teamAInnings), [teamAInnings])
  const manhattanB = useMemo(() => extractManhattan(teamBInnings), [teamBInnings])
  const maxPlayedOver = useMemo(() => {
    const a = manhattanA.length ? manhattanA[manhattanA.length - 1].over : 0
    const b = manhattanB.length ? manhattanB[manhattanB.length - 1].over : 0
    return Math.max(a, b, 0)
  }, [manhattanA, manhattanB])

  const totalOversToShow = useMemo(() => {
    const limit = oversLimit > 0 ? oversLimit : 20
    return Math.max(limit, maxPlayedOver)
  }, [oversLimit, maxPlayedOver])

  const combinedByOver = useMemo(() => {
    const mapA = new Map<number, { runs: number; wickets: number }>()
    const mapB = new Map<number, { runs: number; wickets: number }>()
    for (const o of manhattanA) mapA.set(o.over, { runs: o.runs, wickets: o.wickets })
    for (const o of manhattanB) mapB.set(o.over, { runs: o.runs, wickets: o.wickets })

    return Array.from({ length: totalOversToShow }).map((_, i) => {
      const over = i + 1
      const a = mapA.get(over) || { runs: 0, wickets: 0 }
      const b = mapB.get(over) || { runs: 0, wickets: 0 }
      return { over, aRuns: a.runs, aWkts: a.wickets, bRuns: b.runs, bWkts: b.wickets }
    })
  }, [manhattanA, manhattanB, totalOversToShow])

  const wormDataA = useMemo(() => {
    const data: { over: number; runs: number }[] = [{ over: 0, runs: 0 }]
    let sum = 0
    for (const o of manhattanA) {
      sum += o.runs
      data.push({ over: o.over, runs: sum })
    }
    return data
  }, [manhattanA])

  const wormDataB = useMemo(() => {
    const data: { over: number; runs: number }[] = [{ over: 0, runs: 0 }]
    let sum = 0
    for (const o of manhattanB) {
      sum += o.runs
      data.push({ over: o.over, runs: sum })
    }
    return data
  }, [manhattanB])

  const maxOverRuns = useMemo(() => {
    const maxVal = Math.max(0, ...combinedByOver.map((x) => Math.max(x.aRuns, x.bRuns)))
    return Math.max(12, maxVal)
  }, [combinedByOver])

  const maxTotalRuns = useMemo(() => {
    const a = wormDataA.length ? wormDataA[wormDataA.length - 1].runs : 0
    const b = wormDataB.length ? wormDataB[wormDataB.length - 1].runs : 0
    return Math.max(a, b, 50)
  }, [wormDataA, wormDataB])

  const yMax = useMemo(() => {
    const step = maxOverRuns <= 12 ? 2 : maxOverRuns <= 24 ? 4 : 6
    return Math.ceil(maxOverRuns / step) * step
  }, [maxOverRuns])

  if (loading) return <MatchLiveSkeleton />
  if (!match) return <div className="p-20 text-center">Match not found</div>

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-12 font-inter">
      {/* Mini Scorecard Header */}
      {!compact && (
        <div className="bg-[#0f172a] text-white p-4 sm:p-6 shadow-xl sticky top-0 z-50">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-black text-xs">{firstName[0]}</div>
                <div>
                  <div className="text-sm font-black uppercase tracking-tight">{firstName}</div>
                  <div className="text-xs text-slate-400 font-bold">{firstInns?.totalRuns || 0}-{firstInns?.totalWickets || 0} <span className="opacity-50">({firstInns?.overs || '0.0'})</span></div>
                </div>
              </div>
              <div className="hidden sm:block text-slate-700 font-black text-xs">VS</div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-black text-xs">{secondName[0]}</div>
                <div>
                  <div className="text-sm font-black uppercase tracking-tight">{secondName}</div>
                  <div className="text-xs text-slate-400 font-bold">{secondInns?.totalRuns || 0}-{secondInns?.totalWickets || 0} <span className="opacity-50">({secondInns?.overs || '0.0'})</span></div>
                </div>
              </div>
            </div>
            <div className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Match Graphs
            </div>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto p-4 space-y-6 mt-4">
        {/* Manhattan Chart */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-6 sm:p-8">
          <div className="mb-8 items-baseline flex gap-2">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Manhattan</h3>
            <span className="text-xs font-bold text-slate-400">Runs per over comparison</span>
          </div>

          <div className="overflow-x-auto no-scrollbar pb-4">
            {(() => {
              const height = 240
              const leftPad = 32
              const bottomPad = 32
              const overWidth = totalOversToShow <= 10 ? 60 : 40
              const barWidth = overWidth * 0.35
              const gap = 2
              const svgWidth = leftPad + totalOversToShow * overWidth + 20
              const svgHeight = height + bottomPad

              return (
                <svg width={svgWidth} height={svgHeight} className="overflow-visible">
                  {/* Y-Axis lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                    <g key={p}>
                      <line x1={leftPad} y1={height * (1 - p)} x2={svgWidth} y2={height * (1 - p)} stroke="#f1f5f9" strokeWidth="1" />
                      <text x={leftPad - 8} y={height * (1 - p) + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-bold">{Math.round(p * yMax)}</text>
                    </g>
                  ))}

                  {combinedByOver.map((o, i) => {
                    const xBase = leftPad + i * overWidth + overWidth / 2
                    const hA = (o.aRuns / yMax) * height
                    const hB = (o.bRuns / yMax) * height

                    return (
                      <g key={o.over}>
                        {/* Bars */}
                        <rect
                          x={xBase - barWidth - gap / 2}
                          y={height - hA}
                          width={barWidth}
                          height={hA}
                          fill={firstSide === 'teamA' ? '#0ea5e9' : '#f97316'}
                          rx="2"
                        />
                        <rect
                          x={xBase + gap / 2}
                          y={height - hB}
                          width={barWidth}
                          height={hB}
                          fill={secondSide === 'teamA' ? '#0ea5e9' : '#f97316'}
                          rx="2"
                        />

                        {/* Wickets */}
                        {o.aWkts > 0 && (
                          <circle cx={xBase - barWidth / 2 - gap / 2} cy={height - hA - 10} r="4" fill="white" stroke={firstSide === 'teamA' ? '#0ea5e9' : '#f97316'} strokeWidth="2" />
                        )}
                        {o.bWkts > 0 && (
                          <circle cx={xBase + barWidth / 2 + gap / 2} cy={height - hB - 10} r="4" fill="white" stroke={secondSide === 'teamA' ? '#0ea5e9' : '#f97316'} strokeWidth="2" />
                        )}

                        {/* X-Axis labels */}
                        <text x={xBase} y={height + 20} textAnchor="middle" className="text-[10px] fill-slate-500 font-black">{o.over}</text>
                      </g>
                    )
                  })}
                </svg>
              )
            })()}
          </div>

          {/* Legend */}
          <div className="mt-10 flex flex-wrap gap-6 pt-6 border-t border-slate-50">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${firstSide === 'teamA' ? 'bg-[#0ea5e9]' : 'bg-[#f97316]'}`} />
              <span className="text-xs font-black uppercase text-slate-700 tracking-wider">{firstName}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${secondSide === 'teamA' ? 'bg-[#0ea5e9]' : 'bg-[#f97316]'}`} />
              <span className="text-xs font-black uppercase text-slate-700 tracking-wider">{secondName}</span>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <div className="w-3 h-3 rounded-full border-2 border-slate-300" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Wicket</span>
            </div>
          </div>
        </div>

        {/* Worm Chart */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden p-6 sm:p-8">
          <div className="mb-8 items-baseline flex gap-2">
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Worm Graph</h3>
            <span className="text-xs font-bold text-slate-400">Cumulative score progression</span>
          </div>

          <div className="overflow-x-auto no-scrollbar pb-4">
            {(() => {
              const height = 240
              const leftPad = 32
              const bottomPad = 32
              const overWidth = totalOversToShow <= 10 ? 60 : 40
              const svgWidth = leftPad + totalOversToShow * overWidth + 20
              const svgHeight = height + bottomPad

              const getX = (over: number) => leftPad + over * overWidth
              const getY = (runs: number) => height - (runs / maxTotalRuns) * height

              const pointsA = wormDataA.map(d => `${getX(d.over)},${getY(d.runs)}`).join(' ')
              const pointsB = wormDataB.map(d => `${getX(d.over)},${getY(d.runs)}`).join(' ')

              return (
                <svg width={svgWidth} height={svgHeight} className="overflow-visible">
                  {/* Grids */}
                  {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                    <g key={p}>
                      <line x1={leftPad} y1={height * (1 - p)} x2={svgWidth} y2={height * (1 - p)} stroke="#f8fafc" strokeWidth="1" />
                      <text x={leftPad - 8} y={height * (1 - p) + 4} textAnchor="end" className="text-[10px] fill-slate-300 font-bold">{Math.round(p * maxTotalRuns)}</text>
                    </g>
                  ))}

                  <polyline points={pointsA} fill="none" stroke={firstSide === 'teamA' ? '#0ea5e9' : '#f97316'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points={pointsB} fill="none" stroke={secondSide === 'teamA' ? '#0ea5e9' : '#f97316'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                  {/* End Points */}
                  {wormDataA.length > 0 && (
                    <circle cx={getX(wormDataA[wormDataA.length - 1].over)} cy={getY(wormDataA[wormDataA.length - 1].runs)} r="4" fill={firstSide === 'teamA' ? '#0ea5e9' : '#f97316'} />
                  )}
                  {wormDataB.length > 0 && (
                    <circle cx={getX(wormDataB[wormDataB.length - 1].over)} cy={getY(wormDataB[wormDataB.length - 1].runs)} r="4" fill={secondSide === 'teamA' ? '#0ea5e9' : '#f97316'} />
                  )}

                  {/* X-Axis */}
                  {Array.from({ length: totalOversToShow + 1 }).map((_, i) => (
                    <text key={i} x={getX(i)} y={height + 20} textAnchor="middle" className="text-[10px] fill-slate-500 font-black">{i}</text>
                  ))}
                </svg>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}
