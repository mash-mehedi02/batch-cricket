/**
 * Table Skeleton Component
 * Reusable skeleton for data tables
 */

interface TableSkeletonProps {
  columns?: number
  rows?: number
  showHeader?: boolean
}

export default function TableSkeleton({ columns = 5, rows = 5, showHeader = true }: TableSkeletonProps) {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 animate-pulse">
      {showHeader && (
        <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
          <div className={`grid grid-cols-${columns} gap-4`}>
            {Array.from({ length: columns }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      )}
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`grid grid-cols-${columns} gap-4 px-6 py-4`}>
            {Array.from({ length: columns }).map((_, j) => (
              <div
                key={j}
                className={`h-4 bg-gray-200 rounded ${
                  j === 0 ? 'w-32' : j === columns - 1 ? 'w-16' : 'w-24'
                }`}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

