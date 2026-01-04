/**
 * CREX-Style Hero Scoreboard Component
 * Top-of-page hero showing most important match information
 * Professional cricket scoreboard design
 */

import React from 'react'
import { getBallColor } from '../../config/crex-design'

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
                  <span className="text-5xl font-bold text-white">{score.runs}</span>
                  <span className="text-3xl font-semibold text-white/70">/</span>
                  <span className="text-4xl font-bold text-white">{score.wickets}</span>
                  <span className="text-xl text-white/60 ml-2">({score.overs})</span>
                </div>
              </div>

              {/* Last Ball Bubble */}
              {lastBallDisplay && (
                <div className="flex flex-col items-end">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg mb-2"
                    style={{ backgroundColor: lastBallDisplay.color }}
                  >
                    {lastBallDisplay.value}
                  </div>
                  {lastBallCommentary && (
                    <p className="text-xs text-white/70 text-right max-w-[120px]">
                      {lastBallCommentary}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stats Panel */}
          <div className="md:col-span-1 bg-white/10 rounded-lg p-4 backdrop-blur-sm">
            <div className="space-y-3">
              {runRate !== null && (
                <div>
                  <div className="text-xs text-white/60 uppercase tracking-wide mb-1">CRR</div>
                  <div className="text-2xl font-bold text-white">{runRate.toFixed(2)}</div>
                </div>
              )}

              {requiredRunRate !== null && (
                <div>
                  <div className="text-xs text-white/60 uppercase tracking-wide mb-1">RRR</div>
                  <div className="text-2xl font-bold text-crex-teal-light">
                    {requiredRunRate.toFixed(2)}
                  </div>
                </div>
              )}

              {target !== null && (
                <div>
                  <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Target</div>
                  <div className="text-2xl font-bold text-white">{target}</div>
                </div>
              )}

              {runsNeeded !== null && (
                <div>
                  <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Need</div>
                  <div className="text-2xl font-bold text-crex-sky-light">{runsNeeded}</div>
                </div>
              )}

              {remainingBalls !== null && (
                <div>
                  <div className="text-xs text-white/60 uppercase tracking-wide mb-1">Remaining</div>
                  <div className="text-lg font-semibold text-white/90">
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
