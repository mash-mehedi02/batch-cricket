/**
 * Match Graphs Page
 * Dynamic graphs based on actual overs played
 */

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { Ball, Match, InningsStats } from '@/types'
import MatchLiveSkeleton from '@/components/skeletons/MatchLiveSkeleton'

export default function MatchGraphs() {
  const { matchId } = useParams<{ matchId: string }>()
  const [match, setMatch] = useState<Match | null>(null)
  const [teamAInnings, setTeamAInnings] = useState<InningsStats | null>(null)
  const [teamBInnings, setTeamBInnings] = useState<InningsStats | null>(null)
  const [teamABalls, setTeamABalls] = useState<Ball[]>([])
  const [teamBBalls, setTeamBBalls] = useState<Ball[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!matchId) {
      setLoading(false)
      setMatch(null)
      return
    }

    const unsubscribe = matchService.subscribeToMatch(matchId, (matchData) => {
      setMatch(matchData)
      setLoading(false)
    })

    const unsubA = matchService.subscribeToInnings(matchId, 'teamA', (innings) => {
      setTeamAInnings(innings)
    })

    const unsubB = matchService.subscribeToInnings(matchId, 'teamB', (innings) => {
      setTeamBInnings(innings)
    })

    const unsubBallsA = matchService.subscribeToBalls(matchId, 'teamA', (balls) => {
      setTeamABalls(balls || [])
    })

    const unsubBallsB = matchService.subscribeToBalls(matchId, 'teamB', (balls) => {
      setTeamBBalls(balls || [])
    })

    return () => {
      unsubscribe()
      unsubA()
      unsubB()
      unsubBallsA()
      unsubBallsB()
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

  const buildManhattan = (balls: Ball[]) => {
    const byOver = new Map<number, { over: number; runs: number; wickets: number; legalBalls: number }>()
    for (const b of balls || []) {
      const over = Number(b.overNumber || 0)
      if (!over) continue
      const prev = byOver.get(over) || { over, runs: 0, wickets: 0, legalBalls: 0 }
      prev.runs += Number(b.totalRuns || 0)
      if (b.isLegal) prev.legalBalls += 1
      if (b.wicket && b.wicket.dismissedPlayerId) prev.wickets += 1
      byOver.set(over, prev)
    }
    return Array.from(byOver.values()).sort((a, b) => a.over - b.over)
  }

  const manhattanA = useMemo(() => buildManhattan(teamABalls), [teamABalls])
  const manhattanB = useMemo(() => buildManhattan(teamBBalls), [teamBBalls])
  const maxPlayedOver = useMemo(() => {
    const a = manhattanA.length ? manhattanA[manhattanA.length - 1].over : 0
    const b = manhattanB.length ? manhattanB[manhattanB.length - 1].over : 0
    return Math.max(a, b, 0)
  }, [manhattanA, manhattanB])

  const totalOversToShow = useMemo(() => {
    if (oversLimit > 0) return oversLimit
    return Math.max(1, maxPlayedOver)
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

  const cumulativeA = useMemo(() => {
    let sum = 0
    return manhattanA.map((o) => {
      sum += o.runs
      return sum
    })
  }, [manhattanA])

  const cumulativeB = useMemo(() => {
    let sum = 0
    return manhattanB.map((o) => {
      sum += o.runs
      return sum
    })
  }, [manhattanB])

  const maxOverRuns = useMemo(() => {
    const maxVal = Math.max(
      0,
      ...combinedByOver.map((x) => Math.max(x.aRuns, x.bRuns))
    )
    return Math.max(12, maxVal)
  }, [combinedByOver])

  const maxRuns = useMemo(() => Math.max(teamAInnings?.totalRuns || 0, teamBInnings?.totalRuns || 0, 50), [teamAInnings, teamBInnings])
  const maxOverCount = useMemo(() => Math.max(totalOversToShow, manhattanA.length, manhattanB.length, 1), [totalOversToShow, manhattanA.length, manhattanB.length])

  const yMax = useMemo(() => {
    // "Nice" y-axis: round up to next multiple of 2/4
    const raw = Math.max(0, maxOverRuns)
    const step = raw <= 12 ? 2 : raw <= 24 ? 4 : 6
    return Math.max(step, Math.ceil(raw / step) * step)
  }, [maxOverRuns])

  const yStep = useMemo(() => {
    if (yMax <= 12) return 2
    if (yMax <= 24) return 4
    return 6
  }, [yMax])

  if (loading) {
    return <MatchLiveSkeleton />
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <p>Match not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="min-w-0">
                <div className="text-xl font-extrabold truncate">{firstName}</div>
                <div className="text-sm text-slate-600">
                  {firstInns?.totalRuns || 0}-{firstInns?.totalWickets || 0}{' '}
                  <span className="text-slate-400">({firstInns?.overs || '0.0'})</span>
                </div>
              </div>
              <div className="text-slate-300 font-black">VS</div>
              <div className="min-w-0 text-right">
                <div className="text-xl font-extrabold truncate">{secondName}</div>
                <div className="text-sm text-slate-600">
                  {secondInns?.totalRuns || 0}-{secondInns?.totalWickets || 0}{' '}
                  <span className="text-slate-400">({secondInns?.overs || '0.0'})</span>
                </div>
              </div>
            </div>
            {oversLimit ? (
              <div className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 border border-slate-200 text-slate-700">
                {oversLimit} overs
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Manhattan Graph (Comparison) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <div className="text-lg font-extrabold text-slate-900">Manhattan Graph</div>
              <div className="text-sm text-slate-500">Runs per over (auto based on match overs)</div>
            </div>
          </div>

          {combinedByOver.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-slate-500">No ball data yet</div>
          ) : (
            (() => {
              // SVG layout tuned to resemble the provided screenshot closely.
              const plotH = 220
              const topPad = 18
              const bottomPad = 34
              const leftPad = 44
              const rightPad = 14

              const groupStep = totalOversToShow <= 6 ? 52 : totalOversToShow <= 10 ? 44 : 34
              const barW = totalOversToShow <= 6 ? 12 : totalOversToShow <= 10 ? 10 : 9
              const barGap = 4
              const svgW = leftPad + rightPad + totalOversToShow * groupStep
              const svgH = topPad + plotH + bottomPad
              const x0 = leftPad
              const y0 = topPad + plotH

              const yToPx = (runs: number) => {
                const r = Math.max(0, runs)
                const pct = yMax > 0 ? r / yMax : 0
                return pct * plotH
              }

              const ticks = Array.from({ length: Math.floor(yMax / yStep) + 1 }).map((_, i) => i * yStep)

              return (
                <div className="bg-white">
                  <div className="overflow-x-auto">
                    <svg width={svgW} height={svgH}>
                      {/* Axes */}
                      <line x1={x0} y1={topPad} x2={x0} y2={y0} stroke="#111827" strokeWidth="1" />
                      <line x1={x0} y1={y0} x2={svgW - rightPad} y2={y0} stroke="#111827" strokeWidth="1" />

                      {/* Y ticks + labels */}
                      {ticks.map((t) => {
                        const y = y0 - yToPx(t)
                        return (
                          <g key={t}>
                            <line x1={x0 - 4} y1={y} x2={x0} y2={y} stroke="#111827" strokeWidth="1" />
                            <text x={x0 - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#111827">
                              {t}
                            </text>
                          </g>
                        )
                      })}

                      {/* Axis labels */}
                      <text x={14} y={topPad + 10} fontSize="12" fill="#111827" transform={`rotate(-90 14 ${topPad + 10})`}>
                        Runs
                      </text>
                      <text x={(x0 + (svgW - rightPad)) / 2} y={svgH - 8} textAnchor="middle" fontSize="12" fill="#111827">
                        Over
                      </text>

                      {/* Bars + wicket markers */}
                      {combinedByOver.map((o) => {
                        const idx = o.over - 1
                        const gx = x0 + idx * groupStep
                        const aH = yToPx(o.aRuns)
                        const bH = yToPx(o.bRuns)
                        const aX = gx + (groupStep - (barW * 2 + barGap)) / 2
                        const bX = aX + barW + barGap
                        const aY = y0 - aH
                        const bY = y0 - bH

                        const wicketStroke = '#0284c7' // hollow blue circle like screenshot
                        const markerR = 6

                        return (
                          <g key={o.over}>
                            {/* Team A (blue) */}
                            <rect x={aX} y={aY} width={barW} height={aH} fill="#0ea5e9" />
                            {/* Team B (orange) */}
                            <rect x={bX} y={bY} width={barW} height={bH} fill="#f97316" />

                            {/* Wicket markers (hollow circles) */}
                            {o.aWkts > 0 ? (
                              <circle cx={aX + barW / 2} cy={Math.max(topPad + markerR, aY - 8)} r={markerR} fill="#ffffff" stroke={wicketStroke} strokeWidth="2" />
                            ) : null}
                            {o.bWkts > 0 ? (
                              <circle cx={bX + barW / 2} cy={Math.max(topPad + markerR, bY - 8)} r={markerR} fill="#ffffff" stroke={wicketStroke} strokeWidth="2" />
                            ) : null}

                            {/* X labels */}
                            <text x={gx + groupStep / 2} y={y0 + 16} textAnchor="middle" fontSize="11" fill="#111827">
                              {o.over}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>

                  {/* Legend (like screenshot: big blocks + bold names, stacked) */}
                  <div className="mt-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-10 ${firstSide === 'teamA' ? 'bg-[#0ea5e9]' : 'bg-[#f97316]'}`} />
                        <div className="text-2xl font-black tracking-wider">{firstName.toUpperCase()}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-10 ${secondSide === 'teamA' ? 'bg-[#0ea5e9]' : 'bg-[#f97316]'}`} />
                        <div className="text-2xl font-black tracking-wider">{secondName.toUpperCase()}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()
          )}

        </div>

        {/* Worm Graph (Cumulative Runs) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-lg font-extrabold mb-4">Worm Graph</h3>
          <div className="h-64 relative overflow-x-auto">
            <svg className="w-full h-full" viewBox={`0 0 ${maxOverCount * 20 + 40} 200`}>
              {/* Y-axis labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                <text
                  key={p}
                  x="5"
                  y={200 - p * 200}
                  className="text-xs fill-slate-400"
                  fontSize="10"
                >
                  {Math.round(p * maxRuns)}
                </text>
              ))}

              {/* SA line (green) */}
              {cumulativeA.length > 0 && (
                <polyline
                  points={cumulativeA.map((runs, idx) => `${idx * 20 + 30},${200 - (runs / maxRuns) * 200}`).join(' ')}
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="2"
                />
              )}

              {/* IND line (blue) */}
              {cumulativeB.length > 0 && (
                <polyline
                  points={cumulativeB.map((runs, idx) => `${idx * 20 + 30},${200 - (runs / maxRuns) * 200}`).join(' ')}
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="2"
                />
              )}

              {/* Dots for data points */}
              {cumulativeA.map((runs, idx) => (
                <circle
                  key={`sa-${idx}`}
                  cx={idx * 20 + 30}
                  cy={200 - (runs / maxRuns) * 200}
                  r="3"
                  fill="#0ea5e9"
                />
              ))}
              {cumulativeB.map((runs, idx) => (
                <circle
                  key={`ind-${idx}`}
                  cx={idx * 20 + 30}
                  cy={200 - (runs / maxRuns) * 200}
                  r="3"
                  fill="#f97316"
                />
              ))}
            </svg>
          </div>
          <div className="flex gap-6 mt-4 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 ${firstSide === 'teamA' ? 'bg-sky-500' : 'bg-orange-500'} rounded`} />
              <span className="font-semibold">{firstName}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 ${secondSide === 'teamA' ? 'bg-sky-500' : 'bg-orange-500'} rounded`} />
              <span className="font-semibold">{secondName}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}



