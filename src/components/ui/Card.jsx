import React from 'react'

/**
 * Reusable Card Component
 */
const Card = ({ children, className = '', hover = false, onClick, ...props }) => {
  const baseClasses = 'bg-white rounded-lg shadow-md p-6'
  const hoverClasses = hover ? 'transition-all duration-200 hover:shadow-lg cursor-pointer' : ''
  const clickClasses = onClick ? 'cursor-pointer' : ''
  
  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${clickClasses} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  )
}

export default Card

