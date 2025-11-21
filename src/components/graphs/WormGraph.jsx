import React, { useMemo } from 'react'

/**
 * Scoring Comparison Graph - Live Broadcast Style
 * Shows cumulative runs comparison between two teams
 */
const WormGraph = ({ 
  ballEvents = [], 
  maxOvers = 20, 
  className = '',
  teamABallEvents = [],
  teamBBallEvents = [],
  teamAName = 'A',
  teamBName = 'B',
  teamAScore = { runs: 0, wickets: 0, overs: '0.0' },
  teamBScore = { runs: 0, wickets: 0, overs: '0.0' },
  chase = null
}) => {
  // Calculate cumulative data for Team A
  const teamAData = useMemo(() => {
    const data = []
    let cumulativeRuns = 0
    
    // Initialize all overs
    for (let i = 0; i <= maxOvers; i++) {
      data.push({ over: i, runs: 0 })
    }
    
    // Process ball events chronologically
    const sortedEvents = [...teamABallEvents]
      .filter(e => e.countsBall !== false)
      .sort((a, b) => {
        const aOver = a.overNumber || Math.floor(parseFloat(a.over || '0'))
        const bOver = b.overNumber || Math.floor(parseFloat(b.over || '0'))
        if (aOver !== bOver) return aOver - bOver
        return (a.ball || 0) - (b.ball || 0)
      })
    
    sortedEvents.forEach((event) => {
      cumulativeRuns += event.runs || 0
      const overNum = event.overNumber || Math.floor(parseFloat(event.over || '0'))
      if (overNum <= maxOvers) {
        data[overNum].runs = cumulativeRuns
        // Fill intermediate overs
        for (let i = overNum + 1; i <= maxOvers && data[i].runs === 0; i++) {
          data[i].runs = cumulativeRuns
        }
      }
    })
    
    // Fill remaining overs with last value
    const lastValue = data.find(d => d.runs > 0)?.runs || 0
    for (let i = 0; i <= maxOvers; i++) {
      if (data[i].runs === 0 && i > 0) {
        data[i].runs = data[i - 1].runs || lastValue
      }
    }
    
    return data
  }, [teamABallEvents, maxOvers])
  
  // Calculate cumulative data for Team B
  const teamBData = useMemo(() => {
    const data = []
    let cumulativeRuns = 0
    
    // Initialize all overs
    for (let i = 0; i <= maxOvers; i++) {
      data.push({ over: i, runs: 0 })
    }
    
    // Process ball events chronologically
    const sortedEvents = [...teamBBallEvents]
      .filter(e => e.countsBall !== false)
      .sort((a, b) => {
        const aOver = a.overNumber || Math.floor(parseFloat(a.over || '0'))
        const bOver = b.overNumber || Math.floor(parseFloat(b.over || '0'))
        if (aOver !== bOver) return aOver - bOver
        return (a.ball || 0) - (b.ball || 0)
      })
    
    sortedEvents.forEach((event) => {
      cumulativeRuns += event.runs || 0
      const overNum = event.overNumber || Math.floor(parseFloat(event.over || '0'))
      if (overNum <= maxOvers) {
        data[overNum].runs = cumulativeRuns
        // Fill intermediate overs
        for (let i = overNum + 1; i <= maxOvers && data[i].runs === 0; i++) {
          data[i].runs = cumulativeRuns
        }
      }
    })
    
    // Fill remaining overs with last value
    const lastValue = data.find(d => d.runs > 0)?.runs || 0
    for (let i = 0; i <= maxOvers; i++) {
      if (data[i].runs === 0 && i > 0) {
        data[i].runs = data[i - 1].runs || lastValue
      }
    }
    
    return data
  }, [teamBBallEvents, maxOvers])
  
  // Calculate max runs for Y-axis (round to nice numbers like 0, 22, 44, 66, 88, 110)
  const maxRunsA = Math.max(...teamAData.map(d => d.runs), 0)
  const maxRunsB = Math.max(...teamBData.map(d => d.runs), 0)
  const maxRuns = Math.max(maxRunsA, maxRunsB, 22)
  // Round to multiples of 22 for scale: 0, 22, 44, 66, 88, 110, etc.
  const yAxisMax = Math.ceil(maxRuns / 22) * 22
  const yAxisSteps = 5 // 0, 22, 44, 66, 88, 110
  const yStepValue = 22 // Fixed step of 22
  
  const graphHeight = 280
  const graphWidth = 100
  
  // Generate SVG paths
  const teamAPath = teamAData
    .map((point, index) => {
      const x = (index / maxOvers) * graphWidth
      const y = graphHeight - (point.runs / yAxisMax) * graphHeight
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
  
  const teamBPath = teamBData
    .map((point, index) => {
      const x = (index / maxOvers) * graphWidth
      const y = graphHeight - (point.runs / yAxisMax) * graphHeight
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
  
  // Get current over for Team B
  const teamBCurrentOver = Math.floor(parseFloat(teamBScore.overs || '0'))
  
  return (
    <div className={`bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg shadow-xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-600 flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">SCORING COMPARISON</h3>
        <div className="flex items-center gap-2">
          <button className="bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded hover:bg-blue-600 transition-colors">
            {teamAName}
          </button>
          <button className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded hover:bg-orange-600 transition-colors">
            {teamBName}
          </button>
        </div>
      </div>
      
      {/* Graph Container */}
      <div className="p-4 bg-slate-700/30">
        <div className="relative" style={{ height: `${graphHeight + 60}px` }}>
          <svg
            viewBox={`0 0 ${graphWidth} ${graphHeight + 20}`}
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            {/* Grid lines - Horizontal */}
            {Array.from({ length: yAxisSteps + 1 }, (_, i) => {
              const y = (i / yAxisSteps) * graphHeight
              return (
                <line
                  key={`h-${i}`}
                  x1="0"
                  y1={y}
                  x2={graphWidth}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="0.5"
                />
              )
            })}
            
            {/* Grid lines - Vertical */}
            {[0, 10, 20, 30, 40, 50].filter(o => o <= maxOvers).map((over) => {
              const x = (over / maxOvers) * graphWidth
              return (
                <line
                  key={`v-${over}`}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2={graphHeight}
                  stroke="rgba(255, 255, 255, 0.1)"
                  strokeWidth="0.5"
                />
              )
            })}
            
            {/* Team A Line (Blue) */}
            <path
              d={teamAPath}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Team B Line (Orange-Red) */}
            <path
              d={teamBPath}
              fill="none"
              stroke="#f97316"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Team A Data Points (Circular Markers) */}
            {teamAData.map((point, index) => {
              if (index % 5 !== 0 && index !== teamAData.length - 1) return null
              const x = (index / maxOvers) * graphWidth
              const y = graphHeight - (point.runs / yAxisMax) * graphHeight
              return (
                <circle
                  key={`a-${index}`}
                  cx={x}
                  cy={y}
                  r="3"
                  fill="#3b82f6"
                  stroke="white"
                  strokeWidth="1"
                />
              )
            })}
            
            {/* Team B Data Points (Circular Markers) */}
            {teamBData.map((point, index) => {
              if (index % 5 !== 0 && index !== teamBData.length - 1) return null
              if (index > teamBCurrentOver) return null
              const x = (index / maxOvers) * graphWidth
              const y = graphHeight - (point.runs / yAxisMax) * graphHeight
              return (
                <circle
                  key={`b-${index}`}
                  cx={x}
                  cy={y}
                  r="3"
                  fill="#f97316"
                  stroke="white"
                  strokeWidth="1"
                />
              )
            })}
          </svg>
          
          {/* Y-axis Labels */}
          <div className="absolute left-0 top-0 bottom-16 w-8 flex flex-col justify-between items-end pr-2">
            <div className="text-xs font-bold text-white uppercase">RUNS</div>
            {Array.from({ length: yAxisSteps + 1 }, (_, i) => {
              const value = yAxisMax - (i * yStepValue)
              return (
                <div key={i} className="text-xs text-white/80 font-medium">
                  {Math.round(value)}
                </div>
              )
            })}
          </div>
          
          {/* X-axis with Slider */}
          <div className="absolute bottom-0 left-8 right-0 h-16">
            {/* X-axis Label */}
            <div className="absolute bottom-12 left-0 text-xs font-bold text-white uppercase">OVERS</div>
            
            {/* Orange Slider Line */}
            <div className="absolute bottom-4 left-0 right-4 h-1 bg-orange-500 rounded-full relative">
              {/* Slider Track - Highlighted portion (full range for now) */}
              <div 
                className="absolute h-full bg-orange-400 rounded-full"
                style={{ 
                  left: '0%', 
                  width: '100%'
                }}
              />
              
              {/* Left Handle at 0 */}
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-1/2 z-10">
                <div className="w-4 h-4 bg-white rounded-full border-2 border-orange-500 shadow-md cursor-pointer hover:scale-110 transition-transform"></div>
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-white font-medium whitespace-nowrap">0</div>
              </div>
              
              {/* Right Handle at maxOvers (or 10 if maxOvers > 10) */}
              <div 
                className="absolute top-1/2 transform -translate-y-1/2 translate-x-1/2 z-10 cursor-pointer"
                style={{ left: '100%' }}
              >
                <div className="w-4 h-4 bg-white rounded-full border-2 border-orange-500 shadow-md hover:scale-110 transition-transform"></div>
                <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-white font-medium whitespace-nowrap">
                  {maxOvers}
                </div>
              </div>
              
              {/* Triangle markers at ends - pointing outward */}
              <div className="absolute left-0 top-1/2 transform -translate-y-1/2 -translate-x-full">
                <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-white"></div>
              </div>
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-full">
                <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-white"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Chase Information Box */}
      {chase && chase.runsNeeded > 0 && (
        <div className="px-4 py-3 bg-white/95 border-t border-slate-600">
          <div className="text-xs font-semibold text-gray-800">
            ({teamBName}) TEAM NEED {chase.runsNeeded} MORE TO WIN FROM {Math.floor(chase.ballsRemaining / 6)} OVERS AT {chase.requiredRunRate?.toFixed(2) || '0.00'} RPO
          </div>
        </div>
      )}
    </div>
  )
}

export default WormGraph

