import React from 'react'
import Card from './Card'

/**
 * Premium Stat Card Component
 * For displaying statistics in a beautiful card format
 */
const StatCard = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'blue',
  className = '',
  ...props
}) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
  }

  return (
    <Card className={`overflow-hidden ${className}`} {...props}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center mt-2 text-sm ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              <span>{trend > 0 ? '↑' : '↓'}</span>
              <span className="ml-1">{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={`${colorClasses[color]} rounded-full p-4 text-white`}>
            <span className="text-2xl">{icon}</span>
          </div>
        )}
      </div>
    </Card>
  )
}

export default StatCard

