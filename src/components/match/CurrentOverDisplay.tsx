/**
 * Current Over Display Component
 * Shows balls in current over with last ball highlight
 */

interface CurrentOverDisplayProps {
  currentOverBalls: Array<{ value: string; type: string }>
  // Ordered deliveries (legal + extras) for correct positioning like: 0 wd 0 0 4 1 0
  currentOverDeliveries?: Array<{ value: string; type: string; isLegal?: boolean }>
  currentOverExtras?: Array<{ badge: string; runs: number }>
  overRuns?: number
  overNumber: number
  lastBall?: { value: string; type: string }
}

function getExtraTypeFromBadge(badge: string): 'wide' | 'noball' | 'extra' {
  const b = (badge || '').toLowerCase()
  if (b.startsWith('wd')) return 'wide'
  if (b.startsWith('nb')) return 'noball'
  return 'extra'
}

export default function CurrentOverDisplay({
  currentOverBalls = [],
  currentOverDeliveries = [],
  currentOverExtras = [],
  overRuns,
  overNumber,
  lastBall: _lastBall
}: CurrentOverDisplayProps) {
  // Fill remaining balls with empty slots
  const balls = [...currentOverBalls]
  while (balls.length < 6) {
    balls.push({ value: '', type: 'empty' })
  }

  const total = typeof overRuns === 'number'
    ? overRuns
    : 0

  // Prefer ordered deliveries (includes wides/no-balls in correct position)
  // Fallback to legal balls + extras appended if deliveries not provided (backward compatibility)
  const deliveries =
    currentOverDeliveries && currentOverDeliveries.length > 0
      ? currentOverDeliveries
      : [
        ...currentOverBalls.map((b) => ({ value: b.value, type: b.type, isLegal: true })),
        ...currentOverExtras.map((e) => ({ value: e.badge, type: getExtraTypeFromBadge(e.badge), isLegal: false })),
      ]

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold text-gray-700">Over {overNumber}</div>
        <div className="text-sm text-gray-600">
          {total} run{total !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Current Over Balls */}
      <div className="flex items-center gap-2 flex-wrap">
        {deliveries.map((ball, idx) => (
          <div
            key={idx}
            className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-[11px] shadow-sm border ${ball.type === 'empty'
              ? 'border border-slate-200 dark:border-slate-800 bg-transparent text-slate-300'
              : ball.type === 'wicket' || ball.value === 'W'
                ? 'bg-rose-600 text-white border-rose-500'
                : ball.type === 'penalty' || (ball.value || '').startsWith('P')
                  ? 'bg-amber-500 text-white border-amber-500'
                  : ball.value === '6'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : ball.value === '4'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800'
              }`}
            style={{ width: 'auto', minWidth: '1.75rem', padding: (ball.value || '').length > 1 ? '0 6px' : '0' }}
          >
            {ball.value === '·' || (ball.value === '' && ball.type !== 'empty') ? '0' : ball.value}
          </div>
        ))}

        {/* Fill remaining legal slots to 6 (without affecting extras) */}
        {(() => {
          const legalCount = deliveries.filter((d) => d.isLegal).length
          const empties = Math.max(0, 6 - legalCount)
          return Array.from({ length: empties }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="h-7 w-7 rounded-full border border-slate-200 dark:border-slate-800 bg-transparent shrink-0 flex items-center justify-center"
            >
              <span className="text-slate-300 dark:text-slate-700 text-[10px]">·</span>
            </div>
          ))
        })()}

        <div className="flex items-center gap-1.5 ml-1.5 cursor-default">
          <span className="text-xs font-medium text-slate-400">=</span>
          <span className="text-base font-medium text-slate-900 dark:text-slate-100">{total}</span>
        </div>
      </div>
    </div>
  )
}


