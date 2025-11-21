import React from 'react'

/**
 * Premium Loading Spinner Component
 */
const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }

  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div className="animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
    </div>
  )
}

export default LoadingSpinner

