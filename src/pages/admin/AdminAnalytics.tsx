/**
 * Analytics & Insights Page
 * Match statistics, player performance, trends
 */

export default function AdminAnalytics() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Analytics & Insights</h1>
        <p className="text-gray-600 mt-1">Match statistics and performance analytics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Scoring Activity</h3>
          <div className="h-64 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <p>Chart integration coming soon</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h3>
          <div className="h-64 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">🏆</div>
              <p>Player stats coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

