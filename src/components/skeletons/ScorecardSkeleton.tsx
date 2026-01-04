/**
 * Scorecard Skeleton
 * Skeleton for match scorecard page
 */

export default function ScorecardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <div className="h-10 bg-gray-200 rounded w-48 mb-6"></div>
      </div>

      {/* Innings Tabs */}
      <div className="mb-8">
        <div className="flex gap-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded-lg w-32"></div>
          ))}
        </div>
      </div>

      {/* Batting Table Skeleton */}
      <div className="bg-white rounded-xl shadow-md mb-6 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
          <div className="grid grid-cols-8 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="grid grid-cols-8 gap-4 px-6 py-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((j) => (
                <div key={j} className="h-4 bg-gray-200 rounded w-12"></div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bowling Table Skeleton */}
      <div className="bg-white rounded-xl shadow-md mb-6 overflow-hidden">
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
          <div className="grid grid-cols-7 gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="grid grid-cols-7 gap-4 px-6 py-4">
              {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                <div key={j} className="h-4 bg-gray-200 rounded w-12"></div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Extras & Fall of Wickets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="h-6 bg-gray-200 rounded w-32 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

