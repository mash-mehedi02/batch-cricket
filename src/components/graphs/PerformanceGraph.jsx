import React, { useMemo } from 'react'

/**
 * Performance Graph Component
 * Shows player's runs/wickets over matches (line chart)
 */
const PerformanceGraph = ({ matchPerformances = [], type = 'runs', className = '', stats = null }) => {
  const graphData = useMemo(() => {
    if (!matchPerformances || matchPerformances.length === 0) return []
    
    // Sort by date/timestamp (oldest first)
    const sorted = [...matchPerformances].sort((a, b) => {
      const aTime = a.timestamp || (a.date ? new Date(a.date).getTime() : 0)
      const bTime = b.timestamp || (b.date ? new Date(b.date).getTime() : 0)
      return aTime - bTime
    })
    
    // Calculate cumulative values
    let cumulative = 0
    return sorted.map((match, index) => {
      const value = type === 'runs' 
        ? (match.runs || 0)
        : (match.wickets || 0)
      
      cumulative += value
      
      return {
        matchNumber: index + 1,
        value,
        cumulative,
        matchName: match.opponent || `Match ${index + 1}`,
      }
    })
  }, [matchPerformances, type])
  
  if (graphData.length === 0) {
    return (
      <div className={`bg-white rounded-xl shadow-md p-6 ${className}`}>
        <h3 className="text-lg font-bold text-gray-800 mb-4">
          {type === 'runs' ? 'Runs Over Matches' : 'Wickets Over Matches'}
        </h3>
        <div className="h-64 flex items-center justify-center text-gray-400">
          <p>No match data available</p>
        </div>
      </div>
    )
  }
  
  const maxValue = Math.max(...graphData.map(d => d.cumulative), 1)
  const maxMatchValue = Math.max(...graphData.map(d => d.value), 1)
  const graphHeight = 200
  
  // Generate SVG path for cumulative line
  const cumulativePath = graphData
    .map((point, index) => {
      const x = (index / (graphData.length - 1 || 1)) * 100
      const y = graphHeight - (point.cumulative / maxValue) * graphHeight
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
  
  // Generate SVG path for match-by-match line
  const matchPath = graphData
    .map((point, index) => {
      const x = (index / (graphData.length - 1 || 1)) * 100
      const y = graphHeight - (point.value / maxMatchValue) * graphHeight
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
  
  return (
    <div className={`bg-white rounded-xl shadow-md p-6 ${className}`}>
      <h3 className="text-lg font-bold text-gray-800 mb-4">
        {type === 'runs' ? 'Runs Over Matches' : 'Wickets Over Matches'}
      </h3>
      <div className="relative" style={{ height: `${graphHeight + 40}px` }}>
        <svg
          viewBox={`0 0 100 ${graphHeight + 20}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((percent) => (
            <line
              key={percent}
              x1={percent}
              y1="0"
              x2={percent}
              y2={graphHeight}
              stroke="#e5e7eb"
              strokeWidth="0.5"
            />
          ))}
          {[0, 25, 50, 75, 100].map((percent) => {
            const value = (percent / 100) * maxValue
            const y = graphHeight - (percent / 100) * graphHeight
            return (
              <line
                key={percent}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="#e5e7eb"
                strokeWidth="0.5"
              />
            )
          })}
          
          {/* Area under cumulative curve */}
          <path
            d={`${cumulativePath} L 100 ${graphHeight} L 0 ${graphHeight} Z`}
            fill="url(#cumulativeGradient)"
            opacity="0.2"
          />
          
          {/* Cumulative line */}
          <path
            d={cumulativePath}
            fill="none"
            stroke="#0D8F61"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Match-by-match line */}
          <path
            d={matchPath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4,4"
            opacity="0.7"
          />
          
          {/* Data points */}
          {graphData.map((point, index) => {
            if (index % Math.ceil(graphData.length / 10) !== 0 && index !== graphData.length - 1) return null
            const x = (index / (graphData.length - 1 || 1)) * 100
            const y = graphHeight - (point.cumulative / maxValue) * graphHeight
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="2"
                fill="#0D8F61"
                className="hover:r-3 transition-all"
              />
            )
          })}
          
          <defs>
            <linearGradient id="cumulativeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0D8F61" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0D8F61" stopOpacity="0.1" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500">
          <span>{Math.round(maxValue)}</span>
          <span>{Math.round(maxValue * 0.75)}</span>
          <span>{Math.round(maxValue * 0.5)}</span>
          <span>{Math.round(maxValue * 0.25)}</span>
          <span>0</span>
        </div>
        
        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 px-2">
          <span>1</span>
          {graphData.length > 1 && (
            <>
              <span>{Math.round(graphData.length * 0.25)}</span>
              <span>{Math.round(graphData.length * 0.5)}</span>
              <span>{Math.round(graphData.length * 0.75)}</span>
              <span>{graphData.length}</span>
            </>
          )}
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-[#0D8F61]"></div>
          <span>Cumulative {type === 'runs' ? 'Runs' : 'Wickets'}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-[#3B82F6] border-dashed border-t-2"></div>
          <span>Per Match</span>
        </div>
      </div>
      
      {/* Stats Summary - Use same calculation as summary table */}
      {(() => {
        // Calculate stats using same logic as PlayerProfile summary
        const total = graphData[graphData.length - 1]?.cumulative || 0
        const best = Math.max(...graphData.map(d => d.value), 0)
        
        // Use stats from props if available (same as summary table), otherwise calculate
        let average = 0
        if (stats) {
          // Use the same average calculation as summary table
          if (type === 'runs') {
            const avg = stats.average
            average = typeof avg === 'number' && Number.isFinite(avg) ? Math.round(avg) : 0
          } else {
            // For bowling: use bowlingAverage from stats
            const avg = stats.bowlingAverage
            // Handle Infinity for bowling average (when wickets = 0 but runsConceded > 0)
            if (avg === Infinity || avg === -Infinity) {
              average = Infinity
            } else {
              average = typeof avg === 'number' && Number.isFinite(avg) ? Math.round(avg) : 0
            }
          }
        } else {
          // Fallback calculation if stats not provided
          if (type === 'runs') {
            const dismissals = matchPerformances.filter(m => m.notOut === false).length
            // ICC Rule: Innings count ONLY if player faced at least 1 ball (balls > 0) OR was dismissed (status === 'out')
            // If dismissed (e.g., run out on 0 balls), innings still count
            // IMPORTANT: Don't count if player didn't actually bat (runs = 0 AND balls = 0 AND notOut is not false)
            // Only count innings if player actually batted (ICC Rule)
            // Innings count ONLY if:
            // 1. Player faced at least 1 ball (balls > 0), OR
            // 2. Player was dismissed (notOut === false) - even if 0 balls (run out case)
            // Don't count if runs = 0 AND balls = 0 AND notOut is not false (didn't bat)
            const battingInnings = matchPerformances.filter(m => {
              const isDismissed = m.notOut === false
              return m.balls > 0 || isDismissed
            }).length
            
            if (dismissals > 0) {
              average = Math.round(total / dismissals)
            } else if (battingInnings > 0 && total > 0) {
              average = Math.round(total)
            }
          } else {
            const totalWickets = total
            const totalRunsConceded = matchPerformances.reduce((sum, m) => sum + (m.runsConceded || 0), 0)
            if (totalWickets > 0) {
              average = Math.round(totalRunsConceded / totalWickets)
            }
          }
        }
        
        return (
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500">Total</div>
              <div className="text-lg font-bold text-gray-900">{total}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Average</div>
              <div className="text-lg font-bold text-gray-900">
                {average === Infinity ? '∞' : average}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Best</div>
              <div className="text-lg font-bold text-gray-900">{best}</div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default PerformanceGraph

