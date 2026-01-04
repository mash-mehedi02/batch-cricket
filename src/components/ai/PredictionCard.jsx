/**
 * AI Match Prediction Card Component
 * 
 * Displays AI-generated predictions for player performance and match outcomes.
 * Shows predicted runs, strike rate, wickets, and form ratings.
 * 
 * @component
 */

import { predictPlayerPerformance, calculateOpponentStrength } from '../../services/ai/aiPrediction'

const PredictionCard = ({ 
  player, 
  opponentPlayers = [], 
  playerHistory = [],
  showDetails = false 
}) => {
  if (!player) {
    return (
      <div className="prediction-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Select a player to see predictions
        </p>
      </div>
    )
  }

  // Calculate opponent strength
  const opponentStrength = calculateOpponentStrength(
    opponentPlayers,
    player.role === 'Batsman' ? 'bowling' : 'batting'
  )

  // Generate prediction
  const prediction = predictPlayerPerformance(
    playerHistory,
    opponentStrength,
    player.role
  )

  // Format confidence level
  const getConfidenceLevel = (confidence) => {
    if (confidence >= 80) return { text: 'High', color: 'green' }
    if (confidence >= 50) return { text: 'Medium', color: 'yellow' }
    return { text: 'Low', color: 'red' }
  }

  const confidenceLevel = getConfidenceLevel(prediction.confidence)

  return (
    <div className="prediction-card bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          AI Prediction
        </h3>
        <span
          className={`px-2 py-1 text-xs font-semibold rounded ${
            confidenceLevel.color === 'green'
              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
              : confidenceLevel.color === 'yellow'
              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
              : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
          }`}
        >
          {confidenceLevel.text} Confidence
        </span>
      </div>

      <div className="space-y-4">
        {/* Player Info */}
        <div>
          <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
            {player.name || 'Player'}
          </h4>
          {player.role && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {player.role}
            </span>
          )}
        </div>

        {/* Predictions Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Predicted Runs
            </div>
            <div className="text-2xl font-bold text-gray-800 dark:text-white">
              {prediction.predictedRuns}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Predicted Strike Rate
            </div>
            <div className="text-2xl font-bold text-gray-800 dark:text-white">
              {prediction.predictedStrikeRate.toFixed(1)}
            </div>
          </div>

          {(player.role === 'Bowler' || player.role === 'All-rounder') && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Predicted Wickets
              </div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {prediction.predictedWickets}
              </div>
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Form Rating
            </div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {prediction.formRating}
              </div>
              <div className="flex-1">
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      prediction.formRating >= 70
                        ? 'bg-green-500'
                        : prediction.formRating >= 50
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${prediction.formRating}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Factors (if showDetails) */}
        {showDetails && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Prediction Factors
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Recent Form
                </span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {prediction.factors.recentForm}/100
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Opponent Strength
                </span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {prediction.factors.opponentStrength}/100
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Historical Average
                </span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {prediction.factors.historicalAverage.toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PredictionCard

