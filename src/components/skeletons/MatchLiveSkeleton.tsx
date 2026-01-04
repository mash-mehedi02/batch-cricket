/**
 * Match Live Page Skeleton
 * Skeleton for the live match page layout
 */

export default function MatchLiveSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Tabs Skeleton */}
      <div className="bg-white border-b-2 border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-24 bg-gray-200 rounded-t-lg"></div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero Scoreboard Skeleton */}
        <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl shadow-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="h-6 bg-blue-700 rounded w-40"></div>
            <div className="h-4 bg-blue-700 rounded w-24"></div>
          </div>
          <div className="flex items-baseline gap-4 mb-4">
            <div className="h-16 bg-blue-700 rounded w-32"></div>
            <div className="h-12 bg-blue-700 rounded w-20"></div>
          </div>
          <div className="h-8 bg-blue-700 rounded w-24"></div>
        </div>

        {/* Current Over Skeleton */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-5 bg-gray-200 rounded w-24"></div>
            <div className="h-5 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="w-12 h-12 bg-gray-200 rounded-full"></div>
            ))}
          </div>
        </div>

        {/* Win Probability Skeleton */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="h-5 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded-full mb-4"></div>
          <div className="flex justify-between">
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
          </div>
        </div>

        {/* Batting Table Skeleton */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
            <div className="grid grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {[1, 2].map((i) => (
              <div key={i} className="grid grid-cols-5 gap-4 px-6 py-4">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
                <div className="h-4 bg-gray-200 rounded w-8"></div>
                <div className="h-4 bg-gray-200 rounded w-8"></div>
                <div className="h-4 bg-gray-200 rounded w-12"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Bowling Table Skeleton */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="h-4 bg-gray-200 rounded w-32"></div>
              <div className="h-4 bg-gray-200 rounded w-16"></div>
              <div className="h-4 bg-gray-200 rounded w-12"></div>
              <div className="h-4 bg-gray-200 rounded w-12"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

