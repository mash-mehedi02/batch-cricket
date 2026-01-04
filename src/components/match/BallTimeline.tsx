/**
 * Ball Timeline Component
 * Shows recent overs with color-coded balls
 */

import { RecentOver } from '@/types'
import { getBallColor } from '@/utils/ballFormatters'

function getBallColorFromType(type: string): string {
  return getBallColor(type)
}

interface BallTimelineProps {
  recentOvers: RecentOver[]
}

export default function BallTimeline({ recentOvers }: BallTimelineProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Overs</h3>
      
      {recentOvers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No balls bowled yet
        </div>
      ) : (
        <div className="space-y-4">
          {recentOvers.map((over) => (
            <div key={over.overNumber} className="pb-4 border-b border-gray-200 last:border-0">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-700">
                  Over {over.overNumber}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {over.totalRuns} run{over.totalRuns !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {Array.from({ length: 6 }).map((_, idx) => {
                  const ball = over.balls[idx]
                  return (
                    <div key={idx}>
                      {ball ? (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
                          style={{ backgroundColor: getBallColorFromType(ball.type || 'normal') }}
                        >
                          {ball.value}
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                          <span className="text-gray-400 text-xs">·</span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Extras display (wide/no-ball) */}
                {over.extras && over.extras.length > 0 && (
                  <div className="ml-2 flex gap-1 flex-wrap">
                    {over.extras.map((extra, extraIdx) => (
                      <div
                        key={extraIdx}
                        className="px-2 py-1 rounded text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700"
                        title="Extra delivery"
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

