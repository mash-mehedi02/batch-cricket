/**
 * Live Match Header Component
 * Professional scoreboard header with team info, score, CRR, RR, Target
 */
const LiveHeader = ({ matchData, currentScore, runRate, chase, teamName }) => {
  const formatOvers = (overs) => {
    if (typeof overs === 'string') return overs
    if (typeof overs === 'number') {
      const overPart = Math.floor(overs)
      const ballPart = Math.round((overs - overPart) * 10)
      return `${overPart}.${ballPart}`
    }
    return '0.0'
  }

  const formatRunRate = (rr) => {
    if (rr === null || rr === undefined) return '0.00'
    if (typeof rr === 'number') {
      return Number.isFinite(rr) ? rr.toFixed(2) : '0.00'
    }
    return rr
  }

  return (
    <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 text-white rounded-b-2xl shadow-xl overflow-hidden">
      <div className="px-4 py-5 md:px-6 md:py-6">
        {/* Team Name and Innings */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg font-bold border-2 border-white/30">
            {teamName?.charAt(0) || 'T'}
          </div>
          <div>
            <div className="text-sm md:text-base font-medium text-blue-100">
              {teamName || 'Team'} {matchData?.matchPhase === 'SecondInnings' ? '2nd Inn' : '1st Inn'}
            </div>
          </div>
        </div>

        {/* Score */}
        <div className="flex items-baseline gap-3 mb-4">
          <div className="text-4xl md:text-5xl font-bold">
            {currentScore.runs}-{currentScore.wickets}
          </div>
          <div className="text-xl md:text-2xl text-blue-100">
            ({formatOvers(currentScore.overs)})
          </div>
        </div>

        {/* Last Ball */}
        <div className="flex items-center gap-2 mb-4">
          <div className="text-sm text-blue-100">Last Ball:</div>
          <div className="w-10 h-10 rounded-full bg-yellow-400 text-gray-900 flex items-center justify-center text-lg font-bold shadow-lg animate-pulse">
            0
          </div>
          <div className="text-blue-100">🔊</div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-blue-200 text-xs mb-1">CRR</div>
            <div className="font-semibold text-lg">{formatRunRate(runRate)}</div>
          </div>
          {chase && (
            <>
              <div>
                <div className="text-blue-200 text-xs mb-1">Target</div>
                <div className="font-semibold text-lg">{chase.target}</div>
              </div>
              <div>
                <div className="text-blue-200 text-xs mb-1">RRR</div>
                <div className="font-semibold text-lg">
                  {chase.requiredRunRate ? formatRunRate(chase.requiredRunRate) : '—'}
                </div>
              </div>
              <div>
                <div className="text-blue-200 text-xs mb-1">Need</div>
                <div className="font-semibold text-lg">{chase.runsNeeded} runs</div>
              </div>
            </>
          )}
        </div>

        {/* Lead/Trail */}
        {chase && chase.runsNeeded > 0 && (
          <div className="mt-4 px-4 py-2 bg-orange-500/30 backdrop-blur-sm rounded-lg border border-orange-400/50">
            <div className="text-sm font-semibold">
              Need {chase.runsNeeded} runs in {Math.floor(chase.ballsRemaining / 6)}.{chase.ballsRemaining % 6} overs
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LiveHeader

