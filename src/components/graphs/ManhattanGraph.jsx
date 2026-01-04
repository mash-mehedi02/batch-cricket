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
    
    // Initialize all overs from 1 to maxOvers
    for (let i = 1; i <= maxOvers; i++) {
      oversMap.set(i, { runs: 0, balls: 0, wickets: 0 })
    }
    
    // Process ball events
    ballEvents.forEach((event) => {
      if (!event.countsBall) return // Skip extras that don't count
      
      const overNum = event.overNumber || Math.floor(parseFloat(event.over || '0'))
      if (overNum > 0 && overNum <= maxOvers) {
        const over = oversMap.get(overNum) || { runs: 0, balls: 0, wickets: 0 }
        over.runs += event.runs || 0
        over.balls += 1
        if (event.isWicket) {
          over.wickets += 1
        }
        oversMap.set(overNum, over)
      }
    })
    
    // Also count wickets from fallOfWickets
    fallOfWickets.forEach((fow) => {
      if (fow.team === currentInnings && fow.over) {
        const overNum = Math.floor(parseFloat(fow.over || '0'))
        if (overNum > 0 && overNum <= maxOvers) {
          const over = oversMap.get(overNum) || { runs: 0, balls: 0, wickets: 0 }
          over.wickets += 1
          oversMap.set(overNum, over)
        }
      }
    })
    
    // Return all overs from 1 to maxOvers
    const data = []
    for (let i = 1; i <= maxOvers; i++) {
      const over = oversMap.get(i) || { runs: 0, balls: 0, wickets: 0 }
      data.push({
        over: i,
        runs: over.runs,
        balls: over.balls,
        wickets: over.wickets,
      })
    }
    
    return data
  }, [ballEvents, maxOvers, fallOfWickets, currentInnings, currentScore])
  
  // Calculate max runs for Y-axis (round up to nearest even number for clean scale)
  const maxRunsInData = Math.max(...overData.map(d => d.runs), 0)
  // Fixed scale: 0-16 with increments of 2 (matches screenshot)
  const maxRuns = 16
  const yAxisSteps = 8 // 0, 2, 4, 6, 8, 10, 12, 14, 16
  
  return (
    <div className={`bg-gray-200 rounded-lg shadow-lg overflow-hidden ${className}`}>
      {/* Team Banner & Score Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-300">
        <div className="bg-pink-500 text-white font-bold text-sm px-4 py-2 rounded">
          {teamName ? `${teamName.toUpperCase()} BATTING` : 'BATTING'}
        </div>
        <div className="bg-blue-700 text-white font-bold text-sm px-4 py-2 rounded">
          {currentScore.runs} for {currentScore.wickets}
        </div>
      </div>
      
      {/* Chart Title */}
      <div className="bg-gray-200 px-4 py-3">
        <h3 className="text-base font-bold text-gray-800">CRICKET RUNS PER OVER CHART</h3>
      </div>
      
      {/* Graph Container with Axes */}
      <div className="bg-gray-200 p-4">
        <div className="relative bg-white rounded" style={{ height: '320px' }}>
          {/* Y-axis Labels */}
          <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between items-end pr-2">
            <div className="text-xs font-semibold text-gray-700">Runs</div>
            {Array.from({ length: yAxisSteps + 1 }, (_, i) => {
              const value = maxRuns - (i * 2)
              return (
                <div key={i} className="text-xs text-gray-700 font-medium">
                  {value}
                </div>
              )
            })}
          </div>
          
          {/* Chart Area */}
          <div className="ml-12 mr-2 relative" style={{ height: '100%' }}>
            {/* Grid Lines */}
            <div className="absolute inset-0 pointer-events-none">
              {Array.from({ length: yAxisSteps + 1 }, (_, i) => {
                const percent = (i / yAxisSteps) * 100
                return (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-gray-300"
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
                // Ensure minimum height for visibility
                const barHeight = data.runs > 0 ? Math.max(heightPercent, 2) : 0
                
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
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-1">
                          {Array.from({ length: data.wickets }, (_, i) => (
                            <div
                              key={i}
                              className="w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-red-700"
                            />
                          ))}
                        </div>
                      )}
                      
                      {/* Blue Bar */}
                      <div
                        className={`w-full rounded-t transition-all duration-300 bg-blue-600 ${
                          isHovered ? 'opacity-90 shadow-lg' : 'opacity-100'
                        }`}
                        style={{
                          height: `${barHeight}%`,
                          minHeight: data.runs > 0 ? '3px' : '0px',
                        }}
                        title={`Over ${data.over}: ${data.runs} runs${data.wickets > 0 ? `, ${data.wickets} wicket${data.wickets !== 1 ? 's' : ''}` : ''}`}
                      />
                    </div>
                    
                    {/* Over number at bottom */}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-xs font-semibold text-gray-700 mt-1">
                      {data.over}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          
          {/* X-axis Label */}
          <div className="absolute bottom-0 left-12 right-2 h-8 flex items-center justify-center">
            <div className="text-xs font-semibold text-gray-700">Overs</div>
          </div>
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="bg-gray-200 px-4 py-3 border-t border-gray-300 flex items-center justify-between">
        <div className="text-xs text-gray-600 font-medium bg-gray-300 px-3 py-1 rounded">Overs {maxOvers}</div>
        <div className="text-xs text-gray-500"></div>
      </div>
    </div>
  )
}

export default ManhattanGraph

