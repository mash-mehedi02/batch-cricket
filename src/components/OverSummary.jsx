import React from 'react'

const BALL_STYLES = {
  '4': 'bg-blue-100 text-blue-700',
  '6': 'bg-green-100 text-green-700',
  w: 'bg-red-100 text-red-700',
  wd: 'bg-yellow-100 text-yellow-800',
}

const OverSummary = ({ overs = [], title = 'Recent Overs' }) => {
  const getBadgeClasses = (rawBall) => {
    const ball = String(rawBall || '').toLowerCase()
    if (BALL_STYLES[ball]) {
      return BALL_STYLES[ball]
    }
    return 'bg-gray-100 text-gray-600'
  }

  if (!overs || overs.length === 0) {
    return null
  }

  return (
    <section className="w-full">
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
            {title}
          </h3>
        </div>
      )}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex min-w-full items-center gap-4 px-5 py-4">
          {overs.map((over, index) => (
            <div key={over.number ?? over.over ?? Math.random()} className="flex items-center gap-2">
              {index > 0 && <span className="text-sm font-semibold text-gray-300">|</span>}
              <span className="text-sm font-semibold text-gray-700">
                Over {over.number ?? over.over ?? ''}:
              </span>
              <div className="flex items-center gap-2">
                {(over.balls || []).map((ball, idx) => (
                  <span
                    key={`${over.number ?? over.over}-${idx}`}
                    className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold ${getBadgeClasses(
                      ball
                    )}`}
                  >
                    {ball}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default OverSummary

