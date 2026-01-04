/**
 * Recent Form Component
 * Shows last 5 innings with runs, balls, opponent
 */
const RecentForm = ({ matchPerformances = [] }) => {
  // Get last 5 batting performances
  const recentForm = matchPerformances
    .filter((match) => match.batted && (match.runs !== undefined || match.balls !== undefined))
    .slice(0, 5)
    .map((match) => ({
      runs: match.runs || 0,
      balls: match.balls || 0,
      opponent: match.opponent || match.opponentName || 'Opponent',
      date: match.date || match.timestamp,
      notOut: match.notOut === true,
      matchType: match.matchType || 'Match',
    }))

  if (recentForm.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Recent Form</h3>
        <p className="text-gray-500 text-sm">No recent matches available</p>
      </div>
    )
  }

  const lastPlayedDate = recentForm[0]?.date
    ? new Date(recentForm[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">
          Recent Form
          {lastPlayedDate && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              (last played on {lastPlayedDate})
            </span>
          )}
        </h3>
        <button className="text-blue-600 text-sm font-medium hover:text-blue-700">
          See More &gt;
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {recentForm.map((form, idx) => (
          <div
            key={idx}
            className="flex-shrink-0 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 min-w-[120px] border border-gray-200 shadow-sm"
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {form.runs}
                {form.notOut && <span className="text-green-600 text-lg">*</span>}
              </div>
              <div className="text-xs text-gray-600 mb-2">({form.balls})</div>
              <div className="text-xs font-semibold text-gray-700">vs {form.opponent}</div>
              <div className="text-xs text-gray-500 mt-1">{form.matchType}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default RecentForm

