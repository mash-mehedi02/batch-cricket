/**
 * Ball Timeline Component
 * Shows current over with color-coded runs (ICC-compliant: only legal balls)
 */
import { useMemo } from 'react'

const BallTimeline = ({ recentBalls = [], currentOver = 0, legalBalls = 0 }) => {
  // Get current over balls (only legal balls from current over)
  const currentOverBalls = useMemo(() => {
    if (!recentBalls || recentBalls.length === 0) return []
    
    // Current over is 1-based, so currentOverNum is 0-based
    const currentOverNum = currentOver - 1
    const currentOverStartBall = currentOverNum * 6
    const currentOverEndBall = currentOverStartBall + 6
    
    // Count legal balls as we iterate through recentBalls
    let legalCount = 0
    const currentOverBallsList = []
    
    // Iterate through recentBalls in reverse (newest first)
    for (let i = recentBalls.length - 1; i >= 0; i--) {
      const ball = recentBalls[i]
      const isLegal = ball.countsBall !== false && 
                     ball.extraType !== 'wide' && 
                     ball.extraType !== 'no-ball' &&
                     ball.isLegal !== false
      
      if (isLegal) {
        // This is a legal ball
        if (legalCount >= currentOverStartBall && legalCount < currentOverEndBall) {
          // This ball belongs to current over
          currentOverBallsList.unshift({
            runs: ball.runs || 0,
            isWicket: ball.isWicket === true,
            isBoundary: ball.isBoundary === true || ball.runs === 4 || ball.runs === 6,
            extraType: ball.extraType,
          })
        }
        legalCount++
        
        // Stop if we've gone past the current over
        if (legalCount > currentOverEndBall) {
          break
        }
      }
    }
    
    // Return only the last 6 balls (current over)
    return currentOverBallsList.slice(-6)
  }, [recentBalls, currentOver, legalBalls])

  const getBallColor = (ball) => {
    if (ball.isWicket) return 'bg-red-500 text-white'
    if (ball.isBoundary) return 'bg-green-500 text-white'
    if (ball.runs === 0) return 'bg-gray-300 text-gray-700'
    if (ball.runs >= 1 && ball.runs <= 3) return 'bg-blue-400 text-white'
    if (ball.runs >= 4) return 'bg-green-400 text-white'
    return 'bg-gray-200 text-gray-600'
  }

  const getBallDisplay = (ball) => {
    if (ball.isWicket) return 'W'
    return ball.runs.toString()
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Current Over</h3>
        <div className="text-xs text-gray-500">Over {currentOver}</div>
      </div>
      
      <div className="flex items-center gap-2">
        {Array.from({ length: 6 }).map((_, idx) => {
          const ball = currentOverBalls[idx]
          if (ball) {
            return (
              <div
                key={idx}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${getBallColor(ball)} shadow-md`}
              >
                {getBallDisplay(ball)}
              </div>
            )
          }
          return (
            <div
              key={idx}
              className="w-10 h-10 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs"
            >
              {idx + 1}
            </div>
          )
        })}
        {currentOverBalls.length > 0 && (
          <div className="ml-2 text-sm font-semibold text-gray-700">
            = {currentOverBalls.reduce((sum, b) => sum + (b.runs || 0), 0)}
          </div>
        )}
      </div>
    </div>
  )
}

export default BallTimeline

