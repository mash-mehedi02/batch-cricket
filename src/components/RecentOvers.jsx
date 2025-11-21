import React, { useEffect, useRef } from 'react'

const BALL_COLOR_MAP = {
  '4': 'bg-blue-100 text-blue-700',
  '6': 'bg-green-100 text-green-700',
  w: 'bg-red-100 text-red-700',
  wd: 'bg-yellow-100 text-yellow-800',
  'wd': 'bg-yellow-100 text-yellow-800',
  'Wd': 'bg-yellow-100 text-yellow-800',
  'WD': 'bg-yellow-100 text-yellow-800',
  nb: 'bg-yellow-100 text-yellow-800',
  'nb': 'bg-yellow-100 text-yellow-800',
  'Nb': 'bg-yellow-100 text-yellow-800',
  'NB': 'bg-yellow-100 text-yellow-800',
}

const RecentOvers = ({
  overs = [],
  title = 'Recent Overs',
  maxPast = 4,
  currentScore = null,
}) => {
  const currentOverRef = useRef(null)
  const containerRef = useRef(null)
  
  const oversSorted = [...overs].sort((a, b) => (a.number ?? 0) - (b.number ?? 0))
  
  // Determine current over number
  // ICC Rule: Current over = Math.floor(balls / 6) + 1
  // Example: 0 balls = Over 1, 6 balls = Over 2, 12 balls = Over 3
  let currentOverNum = null
  if (currentScore) {
    const totalBalls = currentScore.balls || 0
    // Calculate current over: 0-5 balls = Over 1, 6-11 balls = Over 2, etc.
    currentOverNum = Math.floor(totalBalls / 6) + 1
    if (currentOverNum < 1) currentOverNum = 1
  } else if (oversSorted.length > 0) {
    // Fallback: use last over number + 1
    currentOverNum = (oversSorted[oversSorted.length - 1]?.number || 0) + 1
  }
  
  // Separate past overs and current over
  const pastOvers = currentOverNum
    ? oversSorted.filter((o) => o.number < currentOverNum).slice(-maxPast)
    : oversSorted.slice(0, -1).slice(-maxPast)
  const currentOver = currentOverNum
    ? oversSorted.find((o) => o.number === currentOverNum)
    : oversSorted[oversSorted.length - 1]

  // Auto-scroll to center current over
  useEffect(() => {
    if (currentOverRef.current && containerRef.current) {
      const container = containerRef.current
      const currentElement = currentOverRef.current
      
      const containerWidth = container.offsetWidth
      const elementLeft = currentElement.offsetLeft
      const elementWidth = currentElement.offsetWidth
      
      // Calculate scroll position to center the element
      const scrollPosition = elementLeft - (containerWidth / 2) + (elementWidth / 2)
      
      container.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      })
    }
  }, [currentOverNum, currentOver])

  const getBadgeClasses = (value) => {
    if (!value || value === '') {
      return 'bg-gray-50 border-2 border-dashed border-gray-300'
    }
    const strValue = String(value)
    const normalised = strValue.toLowerCase()
    
    // Check for wide/no-ball variations (Wd, Wd+1, Nb, Nb+4, etc.)
    if (strValue.startsWith('Wd') || strValue.startsWith('wd') || strValue.startsWith('WD')) {
      return 'bg-yellow-100 text-yellow-800'
    }
    if (strValue.startsWith('Nb') || strValue.startsWith('nb') || strValue.startsWith('NB')) {
      return 'bg-yellow-100 text-yellow-800'
    }
    
    if (BALL_COLOR_MAP[normalised] || BALL_COLOR_MAP[strValue]) {
      return BALL_COLOR_MAP[normalised] || BALL_COLOR_MAP[strValue]
    }
    return 'bg-gray-100 text-gray-600'
  }

  if (oversSorted.length === 0 && !currentOverNum) {
    return null
  }

  return (
    <section className="w-full">
      {title && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
          {title}
        </p>
      )}

      <div 
        ref={containerRef}
        className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm scrollbar-hide"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="flex items-center gap-6 px-5 py-4 flex-nowrap relative">
          {/* Left spacer to push content to center */}
          <div className="flex-1 flex justify-end">
            {/* Past overs on the left */}
            <div className="flex items-center gap-6">
              {pastOvers.map((over) => (
                <div key={`past-${over.number}`} className={`flex items-center gap-2 flex-shrink-0 ${over.isLocked ? 'opacity-75' : 'opacity-60'}`}>
                  <span className="text-sm font-semibold text-gray-500 whitespace-nowrap flex items-center gap-1">
                    Over {over.number}:
                    {over.isLocked && (
                      <span className="text-xs text-gray-400" title="Over completed and locked">🔒</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {/* Show all balls including blanks for past overs (blanks should be rare in completed overs) */}
                    {(over.balls || []).map((ball, ballIdx) => {
                      // Skip blank circles in past overs (they should have been replaced)
                      if (ball === '') return null
                      return (
                        <span
                          key={`past-${over.number}-${ballIdx}`}
                          className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${getBadgeClasses(
                            ball
                          )}`}
                        >
                          {ball}
                        </span>
                      )
                    })}
                  </div>
                  {over.totalRuns !== undefined && over.totalRuns > 0 && (
                    <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">
                      = {over.totalRuns}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Current over in center */}
          {currentOver && (
            <div ref={currentOverRef} className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-semibold text-gray-500 whitespace-nowrap">
                Over {currentOver.number}:
              </span>
              <div className="flex items-center gap-2">
                {(currentOver.balls || []).map((ball, ballIdx) => (
                  <span
                    key={`current-${currentOver.number}-${ballIdx}`}
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold ${getBadgeClasses(
                      ball
                    )}`}
                  >
                    {ball || ''}
                  </span>
                ))}
              </div>
              {currentOver.totalRuns !== undefined && currentOver.totalRuns > 0 && (
                <span className="text-sm font-semibold text-gray-600 whitespace-nowrap">
                  = {currentOver.totalRuns}
                </span>
              )}
            </div>
          )}

          {/* Right spacer for blank space */}
          <div className="flex-1"></div>
        </div>
      </div>
    </section>
  )
}

export default RecentOvers

