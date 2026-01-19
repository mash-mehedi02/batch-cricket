/**
 * CREX-Style Hero Scoreboard Component
 * Top-of-page hero showing most important match information
 * Professional cricket scoreboard design
 */

import React from 'react'
import { getBallColor } from '@/utils/ballFormatters'

interface CrexHeroScoreboardProps {
  teamAName: string
  teamBName: string
  battingTeam: string
  bowlingTeam: string
  currentInnings: 'teamA' | 'teamB'
  inningsNumber: number
  score: {
    runs: number
    wickets: number
    overs: string
  }
  runRate: number | null
  requiredRunRate: number | null
  target: number | null
  runsNeeded: number | null
  remainingBalls: number | null
  matchStatus: string
  lastBall: any
  lastBallCommentary: string | null
  oversLimit: number
}

export default function CrexHeroScoreboard({
  teamAName,
  teamBName,
  battingTeam,
  bowlingTeam,
  currentInnings,
  inningsNumber,
  score,
  runRate,
  requiredRunRate,
  target,
  runsNeeded,
  remainingBalls,
  matchStatus,
  lastBall,
  lastBallCommentary,
  oversLimit,
}: CrexHeroScoreboardProps) {
  const isLive = matchStatus === 'Live'

  // Format last ball display
  const lastBallDisplay = lastBall
    ? {
        value: lastBall.value || String(lastBall.runsOffBat || 0),
        type: lastBall.type || (lastBall.runsOffBat === 4 ? 'four' : lastBall.runsOffBat === 6 ? 'six' : 'run'),
        color: getBallColor(lastBall),
      }
    : null

  // State for score animations
  const [runsChanged, setRunsChanged] = React.useState(false);
  const [wicketsChanged, setWicketsChanged] = React.useState(false);
  
  // Effect to detect score changes and trigger animations
  React.useEffect(() => {
    setRunsChanged(true);
    const timer1 = setTimeout(() => setRunsChanged(false), 1000);
    return () => clearTimeout(timer1);
  }, [score.runs]);
  
  React.useEffect(() => {
    setWicketsChanged(true);
    const timer2 = setTimeout(() => setWicketsChanged(false), 1000);
    return () => clearTimeout(timer2);
  }, [score.wickets]);

  return (
    <div className="crex-gradient-hero rounded-xl shadow-xl overflow-hidden border border-crex-navy-light">
      {/* Status Bar */}
      <div className="bg-black/30 px-6 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isLive && (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-red-300 uppercase tracking-wide">Live</span>
                </div>
                <span className="text-crex-gray-400">•</span>
              </>
            )}
            <span className="text-sm text-white/80">
              {battingTeam} {inningsNumber === 1 ? '1st' : '2nd'} Innings
            </span>
            <span className="text-crex-gray-400">•</span>
            <span className="text-sm text-white/70">vs {bowlingTeam}</span>
          </div>
          <div className="text-xs text-white/60">
            {oversLimit} overs match
          </div>
        </div>
      </div>

      {/* Main Score Display */}
      <div className="px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Team Names & Score */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">{battingTeam}</h2>
                <div className="flex items-baseline gap-3">
                  <span className={`text-7xl md:text-8xl font-black text-white bg-gradient-to-r from-yellow-300 via-orange-400 to-red-500 bg-clip-text text-transparent drop-shadow-lg transition-all duration-300 ${runsChanged ? 'scale-110 text-yellow-200' : ''}`}>
                    {score.runs}
                  </span>
                  <span className="text-4xl md:text-5xl font-black text-white/70">/</span>
                  <span className={`text-5xl md:text-6xl font-black text-white bg-gradient-to-r from-blue-300 via-indigo-400 to-purple-500 bg-clip-text text-transparent drop-shadow-lg transition-all duration-300 ${wicketsChanged ? 'scale-110 text-blue-200' : ''}`}>
                    {score.wickets}
                  </span>
                  <span className="text-2xl md:text-3xl text-white/80 ml-3 font-bold">
                    ({score.overs})
                  </span>
                </div>
              </div>

              {/* Last Ball Bubble */}
              {lastBallDisplay && (
                <div className="flex flex-col items-end">
                  <div
                    className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-white font-black text-3xl md:text-4xl shadow-xl mb-2 border-4 border-white/20"
                    style={{ backgroundColor: lastBallDisplay.color }}
                  >
                    {lastBallDisplay.value}
                  </div>
                  {lastBallCommentary && (
                    <p className="text-sm md:text-base text-white/80 text-right max-w-[140px] font-medium italic">
                      {lastBallCommentary}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stats Panel */}
          <div className="md:col-span-1 bg-white/10 rounded-xl p-5 backdrop-blur-sm border border-white/20">
            <div className="space-y-4">
              {runRate !== null && (
                <div className="pb-3 border-b border-white/10">
                  <div className="text-xs md:text-sm text-white/70 uppercase tracking-wide mb-1 font-bold">Current Run Rate</div>
                  <div className="text-3xl font-black text-white">
                    {runRate.toFixed(2)}
                  </div>
                </div>
              )}

              {requiredRunRate !== null && (
                <div className="pb-3 border-b border-white/10">
                  <div className="text-xs md:text-sm text-white/70 uppercase tracking-wide mb-1 font-bold">Required Run Rate</div>
                  <div className="text-3xl font-black text-crex-teal-light">
                    {requiredRunRate.toFixed(2)}
                  </div>
                </div>
              )}

              {target !== null && (
                <div className="pb-3 border-b border-white/10">
                  <div className="text-xs md:text-sm text-white/70 uppercase tracking-wide mb-1 font-bold">Target</div>
                  <div className="text-3xl font-black text-white">
                    {target}
                  </div>
                </div>
              )}

              {runsNeeded !== null && (
                <div className="pb-3 border-b border-white/10">
                  <div className="text-xs md:text-sm text-white/70 uppercase tracking-wide mb-1 font-bold">Runs Needed</div>
                  <div className="text-3xl font-black text-crex-sky-light">
                    {runsNeeded}
                  </div>
                </div>
              )}

              {remainingBalls !== null && (
                <div>
                  <div className="text-xs md:text-sm text-white/70 uppercase tracking-wide mb-1 font-bold">Balls Remaining</div>
                  <div className="text-xl md:text-2xl font-bold text-white/90">
                    {remainingBalls} balls
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
