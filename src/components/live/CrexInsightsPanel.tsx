/**
 * CREX-Style Insights Panel
 * Win probability, projected scores, match summary
 */

import React, { useMemo } from 'react'

interface CrexInsightsPanelProps {
  matchData: any
  currentInningsData: any
  teamAInnings: any
  teamBInnings: any
  target: number | null
}

export default function CrexInsightsPanel({
  matchData,
  currentInningsData,
  teamAInnings,
  teamBInnings,
  target,
}: CrexInsightsPanelProps) {
  // Calculate win probability (simplified)
  const winProbability = useMemo(() => {
    if (!target || !currentInningsData) return null
    
    const runsNeeded = target - (currentInningsData.totalRuns || 0)
    const ballsRemaining = currentInningsData.remainingBalls || 0
    
    if (runsNeeded <= 0) return { teamA: 0, teamB: 100 }
    if (ballsRemaining === 0) return { teamA: 100, teamB: 0 }
    
    const requiredRunRate = (runsNeeded / ballsRemaining) * 6
    const currentRunRate = currentInningsData.currentRunRate || 0
    
    // Simple probability based on RRR vs CRR
    let probB = 50
    if (requiredRunRate > currentRunRate * 1.5) probB = 20
    else if (requiredRunRate > currentRunRate) probB = 40
    else if (requiredRunRate < currentRunRate * 0.8) probB = 70
    else if (requiredRunRate < currentRunRate) probB = 60
    
    return { teamA: 100 - probB, teamB: probB }
  }, [target, currentInningsData])

  const projectedScore = useMemo(() => {
    if (!currentInningsData) return null
    const currentRunRate = currentInningsData.currentRunRate || 0
    const oversLimit = matchData?.oversLimit || 20
    return Math.round((currentRunRate * oversLimit) / 6)
  }, [currentInningsData, matchData])

  return (
    <div className="space-y-4">
      {/* Win Probability */}
      {winProbability && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-crex-gray-200">
          <h3 className="text-lg font-semibold text-crex-gray-900 mb-4">Win Probability</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-crex-gray-600">Team A</span>
                <span className="font-semibold text-crex-gray-900">{winProbability.teamA}%</span>
              </div>
              <div className="w-full bg-crex-gray-200 rounded-full h-3">
                <div
                  className="bg-crex-teal h-3 rounded-full transition-all"
                  style={{ width: `${winProbability.teamA}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-crex-gray-600">Team B</span>
                <span className="font-semibold text-crex-gray-900">{winProbability.teamB}%</span>
              </div>
              <div className="w-full bg-crex-gray-200 rounded-full h-3">
                <div
                  className="bg-crex-sky h-3 rounded-full transition-all"
                  style={{ width: `${winProbability.teamB}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Projected Score */}
      {projectedScore && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-crex-gray-200">
          <h3 className="text-lg font-semibold text-crex-gray-900 mb-2">Projected Score</h3>
          <div className="text-3xl font-bold text-crex-teal">{projectedScore}</div>
          <p className="text-sm text-crex-gray-500 mt-1">Based on current run rate</p>
        </div>
      )}

      {/* Match Summary */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-crex-gray-200">
        <h3 className="text-lg font-semibold text-crex-gray-900 mb-4">Match Summary</h3>
        <div className="space-y-3 text-sm">
          {teamAInnings && (
            <div className="flex justify-between">
              <span className="text-crex-gray-600">Team A</span>
              <span className="font-semibold text-crex-gray-900">
                {teamAInnings.totalRuns}/{teamAInnings.totalWickets} ({teamAInnings.overs})
              </span>
            </div>
          )}
          {teamBInnings && teamBInnings.totalRuns > 0 && (
            <div className="flex justify-between">
              <span className="text-crex-gray-600">Team B</span>
              <span className="font-semibold text-crex-gray-900">
                {teamBInnings.totalRuns}/{teamBInnings.totalWickets} ({teamBInnings.overs})
              </span>
            </div>
          )}
          {matchData?.venue && (
            <div className="flex justify-between pt-2 border-t border-crex-gray-200">
              <span className="text-crex-gray-600">Venue</span>
              <span className="text-crex-gray-900">{matchData.venue}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

