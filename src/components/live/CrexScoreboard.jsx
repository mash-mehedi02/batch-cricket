/**
 * Professional Live Match Scoreboard Component
 * User-friendly, responsive design with School Cricket branding
 */

import { Link } from 'react-router-dom'

const CrexScoreboard = ({
  teamAName,
  teamBName,
  currentInnings,
  matchPhase,
  teamAScore,
  teamBScore,
  currentScore,
  runRate,
  requiredRunRate,
  target,
  matchStatus,
  tossInfo,
  tournamentName,
  matchFormat,
  venue,
  date,
  oversLimit,
  onTabChange,
  activeTab,
  resultSummary, // Add resultSummary prop
}) => {
  const battingTeam = currentInnings === 'teamA' ? teamAName : teamBName
  const battingScore = currentInnings === 'teamA' ? teamAScore : teamBScore
  
  // Determine status text
  let statusText = 'Live'
  let statusColor = 'text-yellow-300'
  let statusBg = 'bg-yellow-500/20'
  
  // CRITICAL: If match is finished, show resultSummary (winner side) instead of "Match Ended"
  if (matchStatus === 'Finished' || matchStatus === 'Completed') {
    if (resultSummary) {
      // resultSummary already contains winner side (e.g., "Team A won by X runs")
      statusText = resultSummary
      statusColor = 'text-yellow-200'
      statusBg = 'bg-yellow-500/30'
    } else {
      statusText = 'Match Ended'
      statusColor = 'text-green-300'
      statusBg = 'bg-green-500/20'
    }
  } else if (matchPhase === 'InningsBreak' || matchStatus === 'InningsBreak') {
    statusText = 'Innings Break'
    statusColor = 'text-yellow-300'
    statusBg = 'bg-yellow-500/20'
  } else if (matchStatus === 'Live') {
    statusText = 'Live'
    statusColor = 'text-yellow-300'
    statusBg = 'bg-yellow-500/20'
  }

  // Format match title
  const matchTitle = tournamentName 
    ? `${teamAName} VS ${teamBName}, ${matchFormat || 'ODI'}, ${tournamentName}`
    : `${teamAName} VS ${teamBName}`

  const tabs = [
    { id: 'info', label: 'Match info' },
    { id: 'live', label: 'Live' },
    { id: 'scoreboard', label: 'Scorecard' },
  ]

  return (
    <div className="bg-gradient-to-br from-[#015f44] via-[#0e8d6f] to-[#015f44] text-white shadow-xl">
      {/* Main Scoreboard */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Match Title */}
        <div className="text-sm sm:text-base text-white/90 mb-4 font-medium">
          {matchTitle}
          {matchStatus === 'Live' && (
            <span className="ml-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 rounded-full text-red-200 text-xs font-semibold">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></span>
              Live
            </span>
          )}
        </div>

        {/* Scoreboard Grid - Responsive - Beautiful Design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 items-center mb-6">
          {/* Left: Batting Team Score - Enhanced */}
          <div className="flex items-center gap-3 sm:gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-white/20 shadow-lg">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl sm:text-3xl font-bold border-2 border-white/40 shadow-xl">
              {battingTeam.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm sm:text-base font-semibold text-white/90 mb-1 truncate">{battingTeam}</div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl sm:text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
                  {currentScore.runs}-{currentScore.wickets}
                </span>
                <span className="text-lg sm:text-xl text-white/90 font-medium">
                  ({currentScore.overs})
                </span>
              </div>
            </div>
          </div>

          {/* Center: Status - Enhanced */}
          <div className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-white/20 shadow-lg">
            <div className={`inline-block px-5 py-3 rounded-xl ${statusBg} mb-3 shadow-md`}>
              <div className={`text-3xl sm:text-4xl md:text-5xl font-bold ${statusColor} drop-shadow-lg`}>
                {statusText}
              </div>
            </div>
            {matchPhase === 'SecondInnings' && target && (
              <div className="text-sm sm:text-base text-white font-semibold mt-2 bg-yellow-500/20 px-3 py-1.5 rounded-lg inline-block">
                Target: <span className="text-yellow-300 font-bold">{target}</span>
              </div>
            )}
          </div>

          {/* Right: CRR, RRR, Toss Info - Enhanced */}
          <div className="text-left sm:text-right space-y-3 bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-white/20 shadow-lg">
            <div>
              <div className="text-xs text-white/80 mb-1.5 font-medium uppercase tracking-wide">CRR</div>
              <div className="text-2xl sm:text-3xl font-bold text-white drop-shadow-md">
                {runRate ? parseFloat(runRate).toFixed(2) : '0.00'}
              </div>
            </div>
            {/* RRR - Only show if match is not finished */}
            {requiredRunRate && matchStatus === 'Live' && (() => {
              // Check if match is finished (runsNeeded <= 0 or ballsRemaining === 0)
              const runsNeeded = target ? Math.max(0, target - currentScore.runs) : null
              const ballsRemaining = oversLimit ? Math.max(0, Math.floor((oversLimit || 50) * 6 - (currentScore.balls || 0))) : null
              const isMatchFinished = (runsNeeded !== null && runsNeeded <= 0) || (ballsRemaining !== null && ballsRemaining === 0)
              
              // Don't show RRR if match is finished
              if (isMatchFinished) return null
              
              return (
                <div>
                  <div className="text-xs text-white/80 mb-1.5 font-medium uppercase tracking-wide">RRR</div>
                  <div className="text-2xl sm:text-3xl font-bold text-yellow-300 drop-shadow-md">
                    {typeof requiredRunRate === 'string' ? requiredRunRate : requiredRunRate.toFixed(2)}
                  </div>
                </div>
              )
            })()}
            {target && matchPhase === 'SecondInnings' && oversLimit && (() => {
              const runsNeeded = Math.max(0, target - currentScore.runs)
              const ballsRemaining = Math.max(0, Math.floor((oversLimit || 50) * 6 - (currentScore.balls || 0)))
              
              if (runsNeeded === 0 || ballsRemaining === 0) {
                return (
                  <div className={`text-xs text-white/90 mt-3 ${runsNeeded === 0 ? 'bg-green-500/30' : 'bg-red-500/30'} px-3 py-1.5 rounded-lg inline-block`}>
                    <span className="font-bold">
                      {runsNeeded === 0 ? '🏆 WON' : '❌ LOST'}
                    </span>
                  </div>
                )
              }
              
              return (
                <div className="text-xs text-white/90 mt-3 bg-orange-500/20 px-3 py-1.5 rounded-lg inline-block">
                  Need <span className="font-bold">{runsNeeded}</span> runs in <span className="font-bold">{ballsRemaining}</span> balls
                </div>
              )
            })()}
            {tossInfo && (
              <div className="text-xs text-white/80 mt-3 italic">
                {tossInfo}
              </div>
            )}
          </div>
        </div>

        {/* Tabs - Responsive */}
        <div className="flex gap-1 border-b-2 border-white/20 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange && onTabChange(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-yellow-400 -mb-[2px]'
                  : 'text-white/70 hover:text-white border-b-2 border-transparent hover:border-white/30'
              }`}
            >
              {tab.label}
              {tab.id === 'live' && matchStatus === 'Live' && (
                <span className="ml-1.5 w-1.5 h-1.5 bg-red-400 rounded-full inline-block animate-pulse"></span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CrexScoreboard
