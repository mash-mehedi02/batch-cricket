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
            className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-md ${
              ball.type === 'empty'
                ? 'border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400'
                : idx === deliveries.length - 1
                ? 'bg-yellow-500 text-white scale-110'
                : ball.type === 'wicket'
                ? 'bg-red-500 text-white'
                : ball.type === 'four'
                ? 'bg-blue-500 text-white'
                : ball.type === 'six'
                ? 'bg-green-500 text-white'
                : ball.type === 'wide'
                ? 'bg-yellow-600 text-white'
                : ball.type === 'noball'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-600 text-white'
            }`}
          >
            {ball.value || '0'}
          </div>
        ))}

        {/* Fill remaining legal slots to 6 (without affecting extras) */}
        {(() => {
          const legalCount = deliveries.filter((d) => d.isLegal).length
          const empties = Math.max(0, 6 - legalCount)
          return Array.from({ length: empties }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="w-12 h-12 rounded-full border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 flex items-center justify-center font-bold text-sm shadow-md"
            >
              ·
            </div>
          ))
        })()}

        <div className="text-gray-600 font-semibold ml-2">= {total}</div>
      </div>
    </div>
  )
}


