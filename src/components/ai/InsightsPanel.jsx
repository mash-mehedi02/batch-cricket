/**
 * AI Insights & Smart Recommendations Panel
 * 
 * Displays comprehensive match insights including:
 * - Win probability
 * - Best bowler recommendation
 * - Partnership strength
 * - Match recommendations
 * 
 * @component
 */

import { getMatchInsights } from '../../services/ai/aiInsights'

const InsightsPanel = ({
  matchContext = {},
  availableBowlers = [],
  partnershipRuns = 0,
  partnershipBalls = 0,
  showAll = true,
}) => {
  if (!matchContext || Object.keys(matchContext).length === 0) {
    return (
      <div className="insights-panel bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Match insights will appear when match data is available
        </p>
      </div>
    )
  }

  // Ensure availableBowlers is an array
  const bowlersArray = Array.isArray(availableBowlers) ? availableBowlers : []
  
  const insights = getMatchInsights(
    matchContext,
    bowlersArray,
    partnershipRuns,
    partnershipBalls
  )

  const { winProbability, bowlerRecommendation, partnershipInsight } = insights

  return (
    <div className="insights-panel bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          AI Insights
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Real-time Analysis
        </span>
      </div>

      <div className="space-y-4">
        {/* Win Probability */}
        {winProbability && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-800 dark:text-white">
                Win Probability
              </h4>
              <div className="text-right">
                <div
                  className={`text-3xl font-bold ${
                    winProbability.winProbability >= 70
                      ? 'text-green-600 dark:text-green-400'
                      : winProbability.winProbability >= 50
                      ? 'text-blue-600 dark:text-blue-400'
                      : winProbability.winProbability >= 30
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {winProbability.winProbability}%
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              {winProbability.recommendation}
            </p>
            {showAll && (
              <div className="grid grid-cols-2 gap-2 text-xs mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Current RR:</span>
                  <span className="font-semibold text-gray-800 dark:text-white ml-1">
                    {winProbability.factors.currentRR}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Required RR:</span>
                  <span className="font-semibold text-gray-800 dark:text-white ml-1">
                    {winProbability.factors.requiredRR}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Wickets Left:</span>
                  <span className="font-semibold text-gray-800 dark:text-white ml-1">
                    {winProbability.factors.wicketsRemaining}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Overs Left:</span>
                  <span className="font-semibold text-gray-800 dark:text-white ml-1">
                    {winProbability.factors.oversRemaining}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bowler Recommendation */}
        {bowlerRecommendation && showAll && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-700">
            <h4 className="font-semibold text-gray-800 dark:text-white mb-2">
              💡 Recommended Bowler
            </h4>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800 dark:text-white">
                  {bowlerRecommendation.playerName}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {bowlerRecommendation.reason}
                </p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {Math.round(bowlerRecommendation.score)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Score
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Partnership Insight */}
        {partnershipInsight && showAll && (
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-gray-800 dark:text-white">
                Partnership Strength
              </h4>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {partnershipInsight.rating}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {partnershipInsight.strength.toUpperCase()}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs mb-2">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Runs:</span>
                <span className="font-semibold text-gray-800 dark:text-white ml-1">
                  {partnershipInsight.partnershipRuns}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Balls:</span>
                <span className="font-semibold text-gray-800 dark:text-white ml-1">
                  {partnershipInsight.partnershipBalls}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Overs:</span>
                <span className="font-semibold text-gray-800 dark:text-white ml-1">
                  {partnershipInsight.partnershipOvers}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {partnershipInsight.recommendation}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default InsightsPanel

