import React from 'react'

/**
 * Table Skeleton Loader
 */
const TableSkeleton = ({ rows = 5, cols = 4, className = '' }) => {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      <div className="p-4 border-b">
        <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4 flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className="flex-1 h-4 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default TableSkeleton

