/**
 * Match Card Skeleton
 * Skeleton for match cards on home page
 */

export default function MatchCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-24"></div>
            <div className="h-3 bg-gray-200 rounded w-16"></div>
          </div>
        </div>
        <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
      </div>

      {/* Score */}
      <div className="mb-4">
        <div className="h-8 bg-gray-200 rounded w-32 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-24"></div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full mb-4"></div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <div className="h-3 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-12"></div>
        </div>
        <div className="space-y-1">
          <div className="h-3 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-12"></div>
        </div>
        <div className="space-y-1">
          <div className="h-3 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-12"></div>
        </div>
      </div>
    </div>
  )
}

