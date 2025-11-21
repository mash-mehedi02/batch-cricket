/**
 * Performance Optimization Utilities
 * React.memo and useMemo helpers for better performance
 */

import { memo, useMemo } from 'react'

/**
 * Memoized component wrapper with custom comparison
 */
export const memoized = (Component, areEqual) => {
  return memo(Component, areEqual)
}

/**
 * Custom hook for expensive calculations
 */
export const useExpensiveCalculation = (calculation, dependencies) => {
  return useMemo(() => {
    return calculation()
  }, dependencies)
}

/**
 * Memoized list item component
 */
export const MemoizedListItem = memo(({ item, onClick }) => {
  return (
    <div onClick={onClick} className="p-2 hover:bg-gray-100 cursor-pointer">
      {item.name}
    </div>
  )
})

MemoizedListItem.displayName = 'MemoizedListItem'

