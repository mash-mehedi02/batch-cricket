/**
 * Hero Scorecard Component
 * Top-of-page match overview with all essential match info
 * Professional Cricbuzz/CREX style design
 */

const HeroScorecard = ({
  teamAName,
  teamBName,
  currentInnings,
  inningsNumber,
  score,
  runRate,
  requiredRunRate,
  target,
  remainingBalls,
  matchStatus,
  lastBall,
}) => {
  const battingTeam = currentInnings === 'teamA' ? teamAName : teamBName
  const bowlingTeam = currentInnings === 'teamA' ? teamBName : teamAName
  
  // Calculate runs needed
  const runsNeeded = target && target > score.runs ? target - score.runs : null
  
  // Format overs
  const oversDisplay = score.overs || '0.0'
  
  return (
    <div className="bg-gradient-to-br from-black via-gray-900 to-black text-white rounded-2xl shadow-2xl overflow-hidden border border-gray-800">
      {/* Header Bar */}
      <div className="bg-black/50 px-6 py-3 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold text-red-400 uppercase tracking-wide">
                {matchStatus === 'Live' ? 'Live' : matchStatus === 'finished' ? 'End of Innings' : 'Scheduled'}
              </span>
            </div>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-sm text-gray-300">
              {battingTeam} {inningsNumber === 1 ? '1st' : '2nd'} Innings
            </span>
          </div>
          <div className="text-xs text-gray-400">
            vs {bowlingTeam}
          </div>
        </div>
      </div>

      {/* Main Score Display */}
      <div className="px-6 py-8">
        <div className="flex items-baseline gap-4 mb-6">
          <div className="flex-1">
            <div className="text-sm text-gray-400 mb-2 font-medium uppercase tracking-wide">
              {battingTeam}
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-6xl font-bold text-white">
                {score.runs}
              </span>
              <span className="text-4xl font-semibold text-gray-300">/</span>
              <span className="text-4xl font-semibold text-gray-300">
                {score.wickets}
              </span>
            </div>
            <div className="text-lg text-gray-400 mt-2">
              ({oversDisplay} overs)
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 flex-1">
            {/* Current Run Rate */}
            <div className="bg-black/50 rounded-lg p-3 border border-gray-800">
              <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">CRR</div>
              <div className="text-2xl font-bold text-white">
                {runRate !== null ? runRate.toFixed(2) : '—'}
              </div>
            </div>

            {/* Required Run Rate or Target */}
            {target ? (
              <div className="bg-black/50 rounded-lg p-3 border border-gray-800">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">RRR</div>
                <div className={`text-2xl font-bold ${
                  requiredRunRate && requiredRunRate > (runRate || 0) * 1.2 
                    ? 'text-orange-400' 
                    : 'text-white'
                }`}>
                  {requiredRunRate !== null ? requiredRunRate.toFixed(2) : '—'}
                </div>
              </div>
            ) : (
              <div className="bg-black/50 rounded-lg p-3 border border-gray-800">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Target</div>
                <div className="text-2xl font-bold text-white">
                  {target || '—'}
                </div>
              </div>
            )}

            {/* Runs Needed */}
            {runsNeeded !== null && (
              <div className="bg-black/50 rounded-lg p-3 border border-gray-800">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Need</div>
                <div className="text-2xl font-bold text-white">
                  {runsNeeded} run{runsNeeded !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            {/* Balls Remaining */}
            {remainingBalls !== null && (
              <div className="bg-black/50 rounded-lg p-3 border border-gray-800">
                <div className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Balls Left</div>
                <div className="text-2xl font-bold text-white">
                  {remainingBalls}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Last Ball Bubble */}
        {lastBall && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="flex items-start gap-3">
              <div className="bg-gray-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-700">
                Last Ball
              </div>
              <div className="flex-1">
                <div className="text-sm text-gray-200 font-medium">
                  {lastBall.text}
                </div>
                {lastBall.commentary && (
                  <div className="text-xs text-gray-400 mt-1 italic">
                    {lastBall.commentary}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default HeroScorecard

