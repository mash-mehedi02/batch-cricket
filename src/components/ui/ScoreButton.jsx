import React from 'react'

/**
 * Premium Score Button Component
 * Large, responsive button for quick scoring
 */
const ScoreButton = ({
  label,
  value,
  onClick,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  active = false,
  className = '',
  ...props
}) => {
  const baseClasses = 'font-bold rounded-xl transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95'
  
  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-lg hover:shadow-xl',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 shadow-lg hover:shadow-xl',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 shadow-lg hover:shadow-xl',
    warning: 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-500 shadow-lg hover:shadow-xl',
    outline: 'border-3 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500 bg-white',
    ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 bg-transparent',
  }
  
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-xl',
    xl: 'px-10 py-5 text-2xl',
  }
  
  const activeClasses = active ? 'ring-4 ring-offset-2 ring-blue-400' : ''
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${activeClasses} ${className}`}
      {...props}
    >
      <div className="flex flex-col items-center">
        <span className="text-2xl font-black mb-1">{value}</span>
        <span className="text-xs uppercase tracking-wide opacity-90">{label}</span>
      </div>
    </button>
  )
}

export default ScoreButton

