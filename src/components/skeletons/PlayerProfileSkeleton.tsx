/**
 * Player Profile Skeleton
 * Skeleton for player profile page
 */

export default function PlayerProfileSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-gradient-to-r from-green-700 to-green-600 text-white h-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="w-8 h-8 bg-green-600 rounded"></div>
            <div className="flex gap-3">
              <div className="h-8 bg-green-600 rounded-lg w-20"></div>
              <div className="w-8 h-8 bg-green-600 rounded"></div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex-1 space-y-3">
              <div className="h-4 bg-green-600 rounded w-24"></div>
              <div className="h-10 bg-green-600 rounded w-48"></div>
              <div className="h-4 bg-green-600 rounded w-32"></div>
            </div>
            <div className="w-32 h-32 bg-green-600 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 w-24 bg-gray-200 rounded-t-lg"></div>
            ))}
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Player Details */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-gray-200 rounded"></div>
            <div className="h-5 bg-gray-200 rounded w-48"></div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-gray-200 rounded-full w-32"></div>
            ))}
          </div>
        </div>

        {/* Recent Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-gray-200 rounded w-48"></div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
          </div>
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 bg-gray-50 rounded-lg p-4">
                <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Career Stats */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="h-6 bg-gray-200 rounded w-40 mb-4"></div>
          <div className="flex gap-2 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 bg-gray-200 rounded-lg w-16"></div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-4">
                <div className="h-8 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

