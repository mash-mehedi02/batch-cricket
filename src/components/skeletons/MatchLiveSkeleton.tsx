/**
 * Match Live Page Skeleton
 * Skeleton for the live match page layout
 */

export default function MatchLiveSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060b16] animate-pulse">
      {/* Tabs Skeleton */}
      <div className="bg-[#0f172a] border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-24 bg-white/5 rounded-t-lg"></div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero Scoreboard Skeleton */}
        <div className="bg-gradient-to-br from-blue-950 to-blue-900 rounded-xl shadow-2xl p-8 border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div className="h-6 bg-white/5 rounded w-40"></div>
            <div className="h-4 bg-white/5 rounded w-24"></div>
          </div>
          <div className="flex items-baseline gap-4 mb-4">
            <div className="h-16 bg-white/5 rounded w-32"></div>
            <div className="h-12 bg-white/5 rounded w-20"></div>
          </div>
          <div className="h-8 bg-white/5 rounded w-24"></div>
        </div>

        {/* Current Over Skeleton */}
        <div className="bg-white dark:bg-[#0f172a] rounded-lg shadow-md p-6 border border-slate-100 dark:border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="h-5 bg-slate-100 dark:bg-white/5 rounded w-24"></div>
            <div className="h-5 bg-slate-100 dark:bg-white/5 rounded w-16"></div>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-full"></div>
            ))}
          </div>
        </div>

        {/* Win Probability Skeleton */}
        <div className="bg-white dark:bg-[#0f172a] rounded-lg shadow-md p-6 border border-slate-100 dark:border-white/5">
          <div className="h-5 bg-slate-100 dark:bg-white/5 rounded w-32 mb-4"></div>
          <div className="h-8 bg-slate-100 dark:bg-white/5 rounded-full mb-4"></div>
          <div className="flex justify-between">
            <div className="h-4 bg-slate-100 dark:bg-white/5 rounded w-20"></div>
            <div className="h-4 bg-slate-100 dark:bg-white/5 rounded w-20"></div>
            <div className="h-4 bg-slate-100 dark:bg-white/5 rounded w-20"></div>
          </div>
        </div>

        {/* Batting Table Skeleton */}
        <div className="bg-white dark:bg-[#0f172a] rounded-lg shadow-md overflow-hidden border border-slate-100 dark:border-white/5">
          <div className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 px-6 py-3">
            <div className="grid grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-slate-100 dark:bg-white/5 rounded"></div>
              ))}
            </div>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {[1, 2].map((i) => (
              <div key={i} className="grid grid-cols-5 gap-4 px-6 py-4">
                <div className="h-4 bg-slate-100 dark:bg-white/5 rounded w-32"></div>
                <div className="h-4 bg-slate-100 dark:bg-white/5 rounded w-16"></div>
                <div className="h-4 bg-slate-100 dark:bg-white/5 rounded w-8"></div>
                <div className="h-4 bg-slate-100 dark:bg-white/5 rounded w-8"></div>
                <div className="h-4 bg-slate-100 dark:bg-white/5 rounded w-12"></div>
              </div>
            ))}
          </div>
        </div>

        {/* Bowling Table Skeleton */}
        <div className="bg-[#0f172a] rounded-lg shadow-md overflow-hidden border border-white/5">
          <div className="bg-white/5 border-b border-white/5 px-6 py-3">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 bg-white/5 rounded"></div>
              ))}
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="h-4 bg-white/5 rounded w-32"></div>
              <div className="h-4 bg-white/5 rounded w-16"></div>
              <div className="h-4 bg-white/5 rounded w-12"></div>
              <div className="h-4 bg-white/5 rounded w-12"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

