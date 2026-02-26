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
                <div className="flex items-center gap-1.5 ml-1.5 cursor-default">
                  <span className="text-xs font-medium text-slate-400">=</span>
                  <span className="text-base font-medium text-slate-900 dark:text-slate-100">{over.totalRuns}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {Array.from({ length: 6 }).map((_, idx) => {
                  const ball = over.balls[idx]
                  return (
                    <div key={idx}>
                      {ball ? (
                        <div
                          className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-[11px] shadow-sm border ${ball.type === 'wicket' || ball.value === 'W' ? 'bg-rose-600 text-white border-rose-500' :
                              ball.value === '6' ? 'bg-emerald-600 text-white border-emerald-600' :
                                ball.value === '4' ? 'bg-blue-600 text-white border-blue-600' :
                                  'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800'
                            }`}
                          style={{ width: 'auto', minWidth: '1.75rem', padding: (ball.value || '').length > 1 ? '0 6px' : '0' }}
                        >
                          {ball.value === '·' ? '0' : ball.value}
                        </div>
                      ) : (
                        <div className="h-7 w-7 rounded-full border border-slate-200 dark:border-slate-800 bg-transparent shrink-0 flex items-center justify-center">
                          <span className="text-slate-300 dark:text-slate-700 text-[10px]">·</span>
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

