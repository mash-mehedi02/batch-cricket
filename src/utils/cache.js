/**
 * SessionStorage Cache Utility
 * For caching schedule, squads, tournaments data
 */

/**
 * Get cached data
 */
export const getCachedData = (key) => {
  try {
    const cached = sessionStorage.getItem(key)
    if (!cached) return null

    const { data, timestamp } = JSON.parse(cached)
    const now = Date.now()

    // Check if cache is expired (default 5 minutes)
    if (now - timestamp > 5 * 60 * 1000) {
      sessionStorage.removeItem(key)
      return null
    }

    return data
  } catch (error) {
    console.error('Error reading cache:', error)
    return null
  }
}

/**
 * Set cached data
 */
export const setCachedData = (key, data) => {
  try {
    const cache = {
      data,
      timestamp: Date.now(),
    }
    sessionStorage.setItem(key, JSON.stringify(cache))
  } catch (error) {
    console.error('Error setting cache:', error)
    // If storage is full, clear old cache
    try {
      sessionStorage.clear()
      sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }))
    } catch (e) {
      console.error('Failed to clear and reset cache:', e)
    }
  }
}

/**
 * Clear cached data
 */
export const clearCachedData = (key) => {
  try {
    sessionStorage.removeItem(key)
  } catch (error) {
    console.error('Error clearing cache:', error)
  }
}

/**
 * Clear all cache
 */
export const clearAllCache = () => {
  try {
    sessionStorage.clear()
  } catch (error) {
    console.error('Error clearing all cache:', error)
  }
}

