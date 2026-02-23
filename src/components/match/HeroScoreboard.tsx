/**
 * Hero Scoreboard Component
 * CREX-style top hero section with live score
 */

import { Match, InningsStats } from '@/types'

interface HeroScoreboardProps {
  match: Match
  innings: InningsStats | null
}

export default function HeroScoreboard({ match, innings }: HeroScoreboardProps) {
  const isLive = match.status === 'live'
  const teamAName = match.teamAName
  const teamBName = match.teamBName
  const battingTeam = match.currentBatting === 'teamA' ? teamAName : teamBName

  // Ensure innings data exists
  if (!innings) {
    return (
      <div className="bg-gradient-to-br from-batchcrick-navy-dark via-batchcrick-navy to-batchcrick-navy-light rounded-xl shadow-xl overflow-hidden border border-batchcrick-navy-light p-8">
        <div className="text-center text-white/80">
          <p className="text-lg">Waiting for innings data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 rounded-xl shadow-2xl overflow-hidden border border-blue-700">
      {/* Status Bar - Dark Blue Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 px-6 py-4 border-b border-blue-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xl">🏴</span>
            <span className="text-base font-semibold text-white">{battingTeam} 2nd Inn</span>
            {isLive && (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-xs font-bold text-red-300 uppercase tracking-wider">LIVE</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Score Display - Large Numbers */}
      <div className="px-8 py-8 bg-gradient-to-br from-blue-800/80 to-blue-900/80">
        <div className="flex items-baseline gap-4 mb-4">
          <span className="text-7xl font-extrabold text-white tracking-tight">
            {innings?.totalRuns || 0}
          </span>
          <span className="text-5xl font-bold text-white/70">-</span>
          <span className="text-6xl font-extrabold text-white tracking-tight">
            {innings?.totalWickets || 0}
          </span>
          <span className="text-3xl font-semibold text-white/80 ml-4">
            ({innings?.overs || '0.0'})
          </span>
        </div>

        {/* CRR and Last Ball */}
        <div className="flex items-center gap-6">
          {innings?.currentRunRate !== undefined && innings.currentRunRate !== null && (
            <div>
              <div className="text-xs text-white/70 uppercase tracking-wide mb-1">CRR</div>
              <div className="text-2xl font-bold text-white">
                {typeof innings.currentRunRate === 'number'
                  ? innings.currentRunRate.toFixed(2)
                  : parseFloat(String(innings.currentRunRate || 0)).toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

