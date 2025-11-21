import React, { useMemo, useState } from 'react'

/**
 * Manhattan Graph Component - Live Broadcast Style
 * Shows runs per over (bar chart style) with premium TV broadcast aesthetics
 */
const ManhattanGraph = ({ 
  ballEvents = [], 
  maxOvers = 20, 
  className = '',
  teamName = '',
  currentScore = { runs: 0, wickets: 0 },
  fallOfWickets = [],
  currentInnings = 'teamA'
}) => {
  const [hoveredOver, setHoveredOver] = useState(null)
  
  const overData = useMemo(() => {
    const oversMap = new Map()
    
    ballEvents.forEach((event) => {
      if (!event.countsBall) return // Skip extras that don't count
      
      const overNum = event.overNumber || Math.floor(parseFloat(event.over || '0'))
      if (!oversMap.has(overNum)) {
        oversMap.set(overNum, { runs: 0, balls: 0, wickets: 0 })
      }
      const over = oversMap.get(overNum)
      over.runs += event.runs || 0
      over.balls += 1
      if (event.isWicket) {
        over.wickets += 1
      }
    })
    
    // Also count wickets from fallOfWickets
    fallOfWickets.forEach((fow) => {
      if (fow.team === currentInnings && fow.over) {
        const overNum = Math.floor(parseFloat(fow.over || '0'))
        if (overNum > 0) {
          if (!oversMap.has(overNum)) {
            oversMap.set(overNum, { runs: 0, balls: 0, wickets: 0 })
          }
          oversMap.get(overNum).wickets += 1
        }
      }
    })
    
    // Only show overs that have been played (have data)
    // Calculate current over from currentScore.balls
    const currentBalls = currentScore?.balls || 0
    let currentOverNum = Math.floor(currentBalls / 6) + 1
    
    // ICC Rule: Don't exceed match overs limit
    // Cap currentOverNum to maxOvers
    if (currentOverNum > maxOvers) {
      currentOverNum = maxOvers
    }
    
    // Get all overs that have data
    const playedOvers = Array.from(oversMap.keys()).filter(ov => ov <= maxOvers)
    const maxPlayedOver = playedOvers.length > 0 ? Math.max(...playedOvers) : 0
    
    // Show only overs that have been played (have data)
    // Don't show empty overs from the beginning
    // Don't show overs beyond maxOvers
    const data = []
    
    // Only iterate through overs that have data or are the current over
    // But never exceed maxOvers
    const maxOverToCheck = Math.min(Math.max(currentOverNum, maxPlayedOver, 1), maxOvers)
    
    for (let i = 1; i <= maxOverToCheck; i++) {
      const over = oversMap.get(i)
      
      // Only add over if it has actual data (runs, balls, or wickets)
      // Or if it's the current over (even if incomplete, for visual continuity)
      const hasData = over && (over.runs > 0 || over.balls > 0 || over.wickets > 0)
      const isCurrentOver = i === currentOverNum && currentBalls > 0
      
      if (hasData || isCurrentOver) {
        data.push({
          over: i,
          runs: over ? over.runs : 0,
          balls: over ? over.balls : 0,
          wickets: over ? over.wickets : 0,
        })
      }
    }
    
    return data
  }, [ballEvents, maxOvers, fallOfWickets, currentInnings, currentScore])
  
  // Calculate max runs for Y-axis (round up to nearest even number for clean scale)
  const maxRunsInData = Math.max(...overData.map(d => d.runs), 0)
  // Fixed scale: 0-16 with increments of 2 (matches screenshot)
  const maxRuns = 16
  const yAxisSteps = 8 // 0, 2, 4, 6, 8, 10, 12, 14, 16
  
  return (
    <div className={`bg-gray-100 rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Team Banner & Score Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <div className="bg-pink-500 text-white font-bold text-sm px-4 py-1.5 rounded">
          {teamName ? `${teamName.toUpperCase()} BATTING` : 'BATTING'}
        </div>
        <div className="bg-blue-600 text-white font-bold text-sm px-4 py-1.5 rounded-full">
          {currentScore.runs} for {currentScore.wickets}
        </div>
      </div>
      
      {/* Chart Title */}
      <div className="bg-white px-4 py-2 border-b border-gray-200">
        <h3 className="text-sm font-bold text-gray-800">CRICKET RUNS PER OVER CHART</h3>
      </div>
      
      {/* Graph Container with Axes */}
      <div className="bg-white p-4">
        <div className="relative" style={{ height: '320px' }}>
          {/* Y-axis Labels */}
          <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between items-end pr-2">
            <div className="text-xs font-semibold text-gray-700">Runs</div>
            {Array.from({ length: yAxisSteps + 1 }, (_, i) => {
              const value = maxRuns - (i * 2)
              return (
                <div key={i} className="text-xs text-gray-600 font-medium">
                  {value}
                </div>
              )
            })}
          </div>
          
          {/* Chart Area */}
          <div className="ml-10 mr-2 relative" style={{ height: '100%' }}>
            {/* Grid Lines */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: yAxisSteps + 1 }, (_, i) => {
                const percent = (i / yAxisSteps) * 100
                return (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-gray-200"
                    style={{ bottom: `${percent}%` }}
                  />
                )
              })}
            </div>
            
            {/* Bars */}
            <div className="flex items-end justify-between gap-0.5 h-full pb-8">
              {overData.map((data, index) => {
                const isHovered = hoveredOver === data.over
                // Calculate exact height percentage based on maxRuns (16)
                const heightPercent = maxRuns > 0 ? (data.runs / maxRuns) * 100 : 0
                // Ensure minimum height for visibility, but use exact calculation
                const barHeight = data.runs > 0 ? Math.max(heightPercent, 1) : 0.5
                
                return (
                  <div 
                    key={index} 
                    className="flex-1 flex flex-col items-center group relative h-full"
                    onMouseEnter={() => setHoveredOver(data.over)}
                    onMouseLeave={() => setHoveredOver(null)}
                  >
                    {/* Bar Container */}
                    <div className="w-full flex flex-col items-center justify-end relative h-full">
                      {/* Wicket Dots Above Bar */}
                      {data.wickets > 0 && (
                        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-0.5">
                          {Array.from({ length: Math.min(data.wickets, 3) }, (_, i) => (
                            <div
                              key={i}
                              className="w-2 h-2 bg-red-500 rounded-full border border-red-700"
                            />
                          ))}
                          {data.wickets > 3 && (
                            <div className="text-[8px] text-red-600 font-bold">+{data.wickets - 3}</div>
                          )}
                        </div>
                      )}
                      
                      {/* Blue Bar */}
                      <div
                        className={`w-full rounded-t transition-all duration-300 bg-gradient-to-t from-blue-500 to-blue-600 ${
                          isHovered ? 'opacity-90 shadow-lg' : 'opacity-100'
                        }`}
                        style={{
                          height: `${barHeight}%`,
                          minHeight: data.runs > 0 ? '4px' : '1px',
                        }}
                        title={`Over ${data.over}: ${data.runs} runs${data.wickets > 0 ? `, ${data.wickets} wicket${data.wickets !== 1 ? 's' : ''}` : ''}`}
                      >
                        {/* Runs label on bar */}
                        {data.runs > 0 && barHeight > 8 && (
                          <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                            <div className="text-xs font-bold text-gray-800 bg-white/90 px-1 rounded">
                              {data.runs}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Over number at bottom */}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-gray-600 mt-1">
                      {data.over}
                    </div>
                    
                    {/* Runs below (if bar is too small) */}
                    {data.runs > 0 && barHeight <= 8 && (
                      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 text-xs font-bold text-gray-800">
                        {data.runs}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          
          {/* X-axis Label */}
          <div className="absolute bottom-0 left-10 right-2 h-8 flex items-center justify-center">
            <div className="text-xs font-semibold text-gray-700">Overs</div>
          </div>
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between">
        <div className="text-xs text-gray-500 font-medium">Overs {maxOvers}</div>
        <div className="text-xs text-gray-400"></div>
      </div>
    </div>
  )
}

export default ManhattanGraph

