/**
 * CREX-Style Ball Timeline Component
 * Groups balls by over with color-coded display
 * Uses recentOvers from innings document
 */

import React from 'react'
import { getBallColor, CREX_COLORS } from '../../config/crex-design'

interface RecentOver {
  overNumber: number
  balls: Array<{
    value: string
    type: string
    runsOffBat?: number
  }>
  extras?: Array<{
    badge: string
    runs: number
  }>
  totalRuns: number
  isLocked: boolean
}

interface CrexBallTimelineProps {
  recentOvers: RecentOver[]
  currentOverBalls?: Array<{
    value: string
    type: string
    runsOffBat?: number
  }>
}

export default function CrexBallTimeline({
  recentOvers,
  currentOverBalls = [],
}: CrexBallTimelineProps) {
  const allOvers = [...recentOvers]
  
  // Add current over if not complete
  if (currentOverBalls.length > 0) {
    const lastOverNum = recentOvers.length > 0 
      ? recentOvers[recentOvers.length - 1].overNumber + 1 
      : 1
    
    allOvers.push({
      overNumber: lastOverNum,
      balls: currentOverBalls,
      totalRuns: currentOverBalls.reduce((sum, b) => sum + (b.runsOffBat || 0), 0),
      isLocked: false,
    })
  }

  const BallBadge = ({ ball }: { ball: { value: string; type: string; runsOffBat?: number } }) => {
    const color = getBallColor({
      value: ball.value,
      type: ball.type,
      runsOffBat: ball.runsOffBat,
    })

    return (
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md transition-transform hover:scale-110"
        style={{ backgroundColor: color }}
        title={ball.value}
      >
        {ball.value}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-crex-gray-200">
      <h3 className="text-lg font-semibold text-crex-gray-900 mb-4">Ball Timeline</h3>
      
      {allOvers.length === 0 ? (
        <div className="text-center py-12 text-crex-gray-500">
          <p>No balls bowled yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {allOvers.map((over, idx) => (
            <div
              key={over.overNumber}
              className={`pb-4 ${idx < allOvers.length - 1 ? 'border-b border-crex-gray-200' : ''}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-crex-gray-700">
                    Over {over.overNumber}
                  </span>
                  {!over.isLocked && (
                    <span className="text-xs text-crex-teal bg-crex-teal/10 px-2 py-1 rounded">
                      In Progress
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium text-crex-gray-900">
                  {over.totalRuns} run{over.totalRuns !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Legal balls (6 slots) */}
                {Array.from({ length: 6 }).map((_, ballIdx) => {
                  const ball = over.balls[ballIdx]
                  return (
                    <div key={ballIdx} className="relative">
                      {ball ? (
                        <BallBadge ball={ball} />
                      ) : (
                        <div className="w-10 h-10 rounded-full border-2 border-dashed border-crex-gray-300 flex items-center justify-center">
                          <span className="text-crex-gray-400 text-xs">·</span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Extras display */}
                {over.extras && over.extras.length > 0 && (
                  <div className="ml-2 flex gap-1">
                    {over.extras.map((extra, extraIdx) => (
                      <div
                        key={extraIdx}
                        className="px-2 py-1 rounded text-xs font-medium bg-crex-wide/20 text-crex-gray-700"
                      >
                        {extra.badge} ({extra.runs})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
