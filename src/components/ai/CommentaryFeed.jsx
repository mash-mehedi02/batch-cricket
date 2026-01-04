/**
 * Live AI Commentary Feed Component
 * 
 * Displays real-time AI-generated commentary for ball events.
 * Auto-scrolls to latest commentary, highlights important moments.
 * 
 * @component
 */

import { useEffect, useRef } from 'react'
import { generateCommentary } from '../../services/ai/aiCommentary'

const CommentaryFeed = ({ 
  ballEvents = [], 
  players = {}, 
  matchContext = {},
  toneControl = 'normal',
  maxItems = 50 
}) => {
  const feedEndRef = useRef(null)

  // Auto-scroll to bottom when new commentary arrives
  useEffect(() => {
    if (feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [ballEvents])

  // Generate commentary for each ball event
  const commentaryItems = ballEvents.slice(0, maxItems).map((event, index) => {
    const batsmanName = players[event.strikerId]?.name || event.batsman || 'Batter'
    const bowlerName = players[event.bowlerId]?.name || event.bowler || 'Bowler'
    
    const commentary = generateCommentary(
      {
        runs: event.runs || 0,
        ballType: event.extraType || 'normal',
        wicketType: event.wicketType || null,
        batsman: batsmanName,
        bowler: bowlerName,
        isBoundary: event.isBoundary || false,
        isFour: (event.batRuns || 0) === 4,
        isSix: (event.batRuns || 0) === 6,
        over: event.over,
        ball: event.ball,
        matchContext,
      },
      toneControl
    )

    return {
      ...commentary,
      over: event.over,
      ball: event.ball,
      timestamp: event.timestamp || new Date().toISOString(),
      isWicket: event.isWicket || false,
      isBoundary: event.isBoundary || false,
    }
  })

  return (
    <div className="commentary-feed bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          Live Commentary
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          AI Generated
        </span>
      </div>

      <div className="space-y-3">
        {commentaryItems.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p>No commentary yet. Commentary will appear as the match progresses.</p>
          </div>
        ) : (
          commentaryItems.map((item, index) => (
            <div
              key={index}
              className={`commentary-item p-3 rounded-lg border-l-4 ${
                item.isHighlight
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500'
                  : 'bg-gray-50 dark:bg-gray-700/50 border-gray-300 dark:border-gray-600'
              } ${
                item.isWicket
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-500'
                  : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                      {item.over || '0.0'}
                    </span>
                    {item.isWicket && (
                      <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs font-semibold rounded">
                        WICKET
                      </span>
                    )}
                    {item.isBoundary && (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded">
                        BOUNDARY
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                    {item.text}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div ref={feedEndRef} />
    </div>
  )
}

export default CommentaryFeed

