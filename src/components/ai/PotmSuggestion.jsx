/**
 * Player of the Match Suggestion Component
 * 
 * Displays AI-calculated Player of the Match recommendation
 * with impact scores and reasoning.
 * 
 * @component
 */

import { calculatePlayerOfMatch, getTopPlayers } from '../../services/ai/aiPlayerOfMatch'

const PotmSuggestion = ({ 
  players = [], 
  showTopN = 3,
  onSelectPotm 
}) => {
  if (!players || players.length === 0) {
    return (
      <div className="potm-suggestion bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No player data available for POTM calculation
        </p>
      </div>
    )
  }

  // Calculate POTM
  const potm = calculatePlayerOfMatch(players)
  const topPlayers = getTopPlayers(players, showTopN)

  if (!potm) {
    return (
      <div className="potm-suggestion bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          Unable to calculate Player of the Match
        </p>
      </div>
    )
  }

  // Find max score for normalization
  const maxScore = Math.max(...topPlayers.map((p) => p.score), potm.score)

  return (
    <div className="potm-suggestion bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
          Player of the Match
        </h3>
        <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 text-xs font-semibold rounded">
          AI Suggested
        </span>
      </div>

      {/* POTM Winner */}
      <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border-2 border-yellow-400 dark:border-yellow-600">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xl font-bold text-gray-800 dark:text-white">
            🏆 {potm.playerName}
          </h4>
          <div className="text-right">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {Math.round((potm.score / maxScore) * 100)}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Impact Score
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          {potm.reason}
        </p>

        {/* Impact Breakdown */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-white/50 dark:bg-gray-800/50 rounded p-2 text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Batting
            </div>
            <div className="text-sm font-semibold text-gray-800 dark:text-white">
              {Math.round(potm.breakdown.battingImpact)}
            </div>
          </div>
          <div className="bg-white/50 dark:bg-gray-800/50 rounded p-2 text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Bowling
            </div>
            <div className="text-sm font-semibold text-gray-800 dark:text-white">
              {Math.round(potm.breakdown.bowlingImpact)}
            </div>
          </div>
          <div className="bg-white/50 dark:bg-gray-800/50 rounded p-2 text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Fielding
            </div>
            <div className="text-sm font-semibold text-gray-800 dark:text-white">
              {Math.round(potm.breakdown.fieldingImpact)}
            </div>
          </div>
        </div>

        {onSelectPotm && (
          <button
            onClick={() => onSelectPotm(potm.playerId)}
            className="mt-3 w-full px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold rounded transition-colors"
          >
            Select as POTM
          </button>
        )}
      </div>

      {/* Top Players List */}
      {showTopN > 1 && topPlayers.length > 1 && (
        <div>
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Top Performers
          </h5>
          <div className="space-y-2">
            {topPlayers.map((player, index) => (
              <div
                key={player.playerId}
                className={`p-3 rounded-lg border ${
                  index === 0
                    ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-300 dark:border-yellow-700'
                    : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-gray-400 dark:text-gray-500">
                      #{index + 1}
                    </span>
                    <span className="font-medium text-gray-800 dark:text-white">
                      {player.playerName}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      {Math.round((player.score / maxScore) * 100)}%
                    </div>
                    <div className="w-24 bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-1">
                      <div
                        className="bg-yellow-500 dark:bg-yellow-400 h-1.5 rounded-full"
                        style={{ width: `${(player.score / maxScore) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default PotmSuggestion

