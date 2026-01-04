/**
 * CREX-Style Scorecard Page Component
 * Full scorecard layout matching CREX design exactly
 */

import React from 'react'
import BattingTable from './BattingTable'
import BowlingTable from './BowlingTable'
import ExtrasSection from './ExtrasSection'
import YetToBatGrid from './YetToBatGrid'
import FallOfWickets from './FallOfWickets'
import PartnershipSection from './PartnershipSection'
import BallTimeline from '../live/BallTimeline'
import ProjectedScoreTable from '../live/ProjectedScoreTable'
import WinProbability from '../live/WinProbability'

interface CrexScorecardPageProps {
  matchData: any
  inningsData: any
  teamAName: string
  teamBName: string
  currentInnings: 'teamA' | 'teamB'
  playersMap: Map<string, any>
}

const CrexScorecardPage: React.FC<CrexScorecardPageProps> = ({
  matchData,
  inningsData,
  teamAName,
  teamBName,
  currentInnings,
  playersMap,
}) => {
  if (!inningsData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading scorecard...</div>
      </div>
    )
  }

  const battingTeam = currentInnings === 'teamA' ? teamAName : teamBName
  const bowlingTeam = currentInnings === 'teamA' ? teamBName : teamAName

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Dark Blue Gradient (CREX Style) */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-sm text-gray-400 mb-1">{battingTeam} innings</div>
              <div className="text-2xl font-bold">
                {inningsData.totalRuns || 0}/{inningsData.totalWickets || 0} ({inningsData.overs || '0.0'})
              </div>
            </div>
            <div className="flex items-center gap-6">
              {inningsData.currentRunRate !== null && (
                <div className="text-right">
                  <div className="text-xs text-gray-400">CRR</div>
                  <div className="text-xl font-bold">{inningsData.currentRunRate.toFixed(2)}</div>
                </div>
              )}
              {inningsData.requiredRunRate !== null && (
                <div className="text-right">
                  <div className="text-xs text-gray-400">RRR</div>
                  <div className="text-xl font-bold text-yellow-400">{inningsData.requiredRunRate.toFixed(2)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Batting Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">Batting</h3>
              </div>
              <BattingTable
                batsmen={inningsData.batsmanStats || []}
                playersMap={playersMap}
              />
            </div>

            {/* Extras Section */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <ExtrasSection extras={inningsData.extras || {}} />
            </div>

            {/* Bowling Table */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">Bowling</h3>
              </div>
              <BowlingTable
                bowlers={inningsData.bowlerStats || []}
                playersMap={playersMap}
              />
            </div>

            {/* Fall of Wickets */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">Fall of Wickets</h3>
              </div>
              <FallOfWickets fallOfWickets={inningsData.fallOfWickets || []} />
            </div>

            {/* Partnership Section */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <PartnershipSection
                partnership={inningsData.partnership || { runs: 0, balls: 0 }}
                currentScore={inningsData.totalRuns || 0}
              />
            </div>

            {/* Ball Timeline */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Ball-by-Ball</h3>
              <BallTimeline
                balls={matchData.recentBalls || []}
                currentInnings={currentInnings}
              />
            </div>
          </div>

          {/* Right Column: Sidebar */}
          <div className="space-y-6">
            {/* Yet to Bat */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Yet to Bat</h3>
              <YetToBatGrid
                playingXI={currentInnings === 'teamA' ? matchData.teamAPlayingXI : matchData.teamBPlayingXI}
                batsmanStats={inningsData.batsmanStats || []}
                playersMap={playersMap}
              />
            </div>

            {/* Projected Score */}
            <ProjectedScoreTable
              currentRuns={inningsData.totalRuns || 0}
              currentOvers={inningsData.overs || '0.0'}
              currentRunRate={inningsData.currentRunRate || 0}
              oversLimit={matchData.oversLimit || 20}
            />

            {/* Win Probability */}
            {matchData.matchPhase === 'SecondInnings' && (
              <WinProbability
                currentRuns={inningsData.totalRuns || 0}
                wickets={inningsData.totalWickets || 0}
                balls={inningsData.legalBalls || 0}
                target={inningsData.target}
                oversLimit={matchData.oversLimit || 20}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CrexScorecardPage

