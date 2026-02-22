/**
 * Win Probability Component
 * Shows win probability bar for both teams using winProbabilityEngine
 */
import React from 'react'
import { calculateWinProbability } from '../../services/ai/winProbabilityEngine'

interface WinProbabilityProps {
    currentRuns?: number
    wickets?: number
    balls?: number
    target?: number | null
    oversLimit?: number
    teamAName?: string
    teamBName?: string
    batsmenForm?: Array<{ playerId: string; average: number; strikeRate: number }>
    remainingBowlers?: Array<{ playerId: string; economy: number; average: number }>
    partnership?: { runs: number; balls: number }
}

const WinProbability: React.FC<WinProbabilityProps> = ({
    currentRuns = 0,
    wickets = 0,
    balls = 0,
    target = null,
    oversLimit = 20,
    teamAName = 'Team A',
    teamBName = 'Team B',
    batsmenForm = [],
    remainingBowlers = [],
    partnership = { runs: 0, balls: 0 }
}) => {
    // Calculate win probability using engine
    const probability = calculateWinProbability({
        currentRuns,
        wickets,
        legalBalls: balls,
        target,
        oversLimit,
        partnershipRuns: partnership.runs,
        partnershipBalls: partnership.balls,
        battingTeamSide: 'teamA' // Default fallback
    });

    const normalizedA = probability.defendingTeamWinProb
    const normalizedB = probability.chasingTeamWinProb

    return (
        <div className="bg-white rounded-xl shadow-md p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Win Probability</h3>

            {/* Progress Bar */}
            <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden mb-3">
                <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out"
                    style={{ width: `${normalizedA}%` }}
                />
                <div
                    className="absolute right-0 top-0 h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500 ease-out"
                    style={{ width: `${normalizedB}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-xs font-semibold text-white drop-shadow-md">
                        {normalizedA.toFixed(0)}% - {normalizedB.toFixed(0)}%
                    </div>
                </div>
            </div>

            {/* Labels */}
            <div className="flex justify-between text-xs mb-2">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="font-semibold text-gray-700">{teamAName}: {normalizedA.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="font-semibold text-gray-700">{teamBName}: {normalizedB.toFixed(0)}%</span>
                </div>
            </div>

            {/* Explanation */}
            {probability.explanation && (
                <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                    {probability.explanation}
                </div>
            )}

            {/* Recommended Bowler */}
            {probability.recommendedBowler && (
                <div className="text-xs text-gray-600 mt-2">
                    <span className="font-semibold">Recommended:</span> {probability.recommendedBowler.reason}
                </div>
            )}
        </div>
    )
}

export default WinProbability
