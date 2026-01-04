/**
 * Skeleton Card Component
 * Reusable skeleton card for loading states
 */

interface SkeletonCardProps {
  className?: string
  showImage?: boolean
  showAvatar?: boolean
}

export function SkeletonCard({ className = '', showImage = false, showAvatar = false }: SkeletonCardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-md p-6 border border-gray-200 animate-pulse ${className}`}>
      {showImage && (
        <div className="w-full h-48 bg-gray-200 rounded-lg mb-4"></div>
      )}
      
      <div className="flex items-start gap-4">
        {showAvatar && (
          <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0"></div>
        )}
        
        <div className="flex-1 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-3 bg-gray-200 rounded w-full"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    </div>
  )
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={`h-4 bg-gray-200 rounded ${
            i === lines - 1 ? 'w-5/6' : 'w-full'
          }`}
        ></div>
      ))}
    </div>
  )
}

export function SkeletonButton({ className = '' }: { className?: string }) {
  return (
    <div className={`h-10 bg-gray-200 rounded-lg animate-pulse ${className}`}></div>
  )
}

export function SkeletonBadge({ className = '' }: { className?: string }) {
  return (
    <div className={`h-6 w-20 bg-gray-200 rounded-full animate-pulse ${className}`}></div>
  )
}

export function SkeletonAvatar({ size = 12, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`bg-gray-200 rounded-full animate-pulse ${className}`}
      style={{ width: `${size * 0.25}rem`, height: `${size * 0.25}rem` }}
    ></div>
  )
}

