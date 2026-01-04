/**
 * Career Stats Component
 * Shows batting and bowling statistics with tabs
 */
import { useState } from 'react'

const CareerStats = ({ stats }) => {
  const [activeTab, setActiveTab] = useState('batting')

  if (!stats) {
    return null
  }

  const formatStat = (value, decimals = 0) => {
    if (value === null || value === undefined) return '—'
    if (typeof value === 'number') {
      return decimals > 0 ? value.toFixed(decimals) : value.toString()
    }
    return value
  }

  const formatHighestScore = (runs, notOut) => {
    if (!runs && runs !== 0) return '—'
    return `${runs}${notOut ? '*' : ''}`
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4">Career Statistics</h3>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('batting')}
          className={`px-4 py-2 font-semibold text-sm transition-colors ${
            activeTab === 'batting'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Batting
        </button>
        <button
          onClick={() => setActiveTab('bowling')}
          className={`px-4 py-2 font-semibold text-sm transition-colors ${
            activeTab === 'bowling'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Bowling
        </button>
      </div>

      {/* Batting Stats */}
      {activeTab === 'batting' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-600 mb-1">Matches</div>
            <div className="text-2xl font-bold text-gray-900">{formatStat(stats.matches)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-600 mb-1">Innings</div>
            <div className="text-2xl font-bold text-gray-900">{formatStat(stats.battingInnings)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-600 mb-1">Runs</div>
            <div className="text-2xl font-bold text-gray-900">{formatStat(stats.runs)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-600 mb-1">Strike Rate</div>
            <div className="text-2xl font-bold text-gray-900">{formatStat(stats.strikeRate, 1)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-600 mb-1">Average</div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.average !== null && stats.average !== undefined
                ? formatStat(stats.average, 1)
                : '—'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-600 mb-1">50s</div>
            <div className="text-2xl font-bold text-gray-900">{formatStat(stats.fifties)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-600 mb-1">100s</div>
            <div className="text-2xl font-bold text-gray-900">{formatStat(stats.hundreds)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-600 mb-1">Highest Score</div>
            <div className="text-2xl font-bold text-gray-900">
              {formatHighestScore(stats.highest, stats.highestNotOut)}
            </div>
          </div>
        </div>
      )}

      {/* Bowling Stats */}
      {activeTab === 'bowling' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-600 mb-1">Overs</div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.ballsBowled ? `${Math.floor(stats.ballsBowled / 6)}.${stats.ballsBowled % 6}` : '0.0'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-600 mb-1">Wickets</div>
            <div className="text-2xl font-bold text-gray-900">{formatStat(stats.wickets)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-600 mb-1">Economy</div>
            <div className="text-2xl font-bold text-gray-900">{formatStat(stats.economy, 2)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-600 mb-1">Strike Rate</div>
            <div className="text-2xl font-bold text-gray-900">{formatStat(stats.bowlingStrikeRate, 1)}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-600 mb-1">Average</div>
            <div className="text-2xl font-bold text-gray-900">
              {stats.bowlingAverage !== null && stats.bowlingAverage !== undefined
                ? formatStat(stats.bowlingAverage, 2)
                : '—'}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="text-xs text-gray-600 mb-1">Best Bowling</div>
            <div className="text-lg font-bold text-gray-900">{stats.bestBowling || '—'}</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CareerStats

