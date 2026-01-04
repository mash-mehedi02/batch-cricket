/**
 * Session Info Component
 * Shows session information and overs remaining
 */
const SessionInfo = ({ matchData, currentScore, oversLimit }) => {
  const oversLimitBalls = oversLimit ? oversLimit * 6 : null
  const ballsRemaining = oversLimitBalls && currentScore.balls
    ? Math.max(oversLimitBalls - currentScore.balls, 0)
    : null
  const oversRemaining = ballsRemaining ? `${Math.floor(ballsRemaining / 6)}.${ballsRemaining % 6}` : '—'

  return (
    <div className="bg-white rounded-xl shadow-md p-4 mb-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="font-semibold text-gray-700">Live</span>
        </div>
        <div className="text-gray-600">
          Overs left in inning: <span className="font-semibold text-gray-900">{oversRemaining}</span>
        </div>
      </div>
      
      {ballsRemaining !== null && (
        <div className="mt-2 text-xs text-gray-500">
          Balls remaining: {ballsRemaining}
        </div>
      )}
    </div>
  )
}

export default SessionInfo

