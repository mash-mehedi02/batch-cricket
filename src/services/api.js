/**
 * API Service - Centralized API client for backend communication
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5050/api'

/**
 * Get auth token from Firebase Auth
 */
const getAuthToken = async () => {
  try {
    const { auth } = await import('../config/firebase.js')
    const { onAuthStateChanged } = await import('firebase/auth')
    
    return new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        if (user) {
          user.getIdToken().then(resolve).catch(() => resolve(null))
        } else {
          resolve(null)
        }
      })
    })
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

/**
 * Make API request with authentication
 */
const apiRequest = async (endpoint, options = {}) => {
  const token = await getAuthToken()
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const config = {
    ...options,
    headers,
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config)
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || `HTTP error! status: ${response.status}`)
    }

    return data
  } catch (error) {
    console.error('API request error:', error)
    throw error
  }
}

// Tournament API
export const tournamentsAPI = {
  getAll: () => apiRequest('/tournaments'),
  getById: (id) => apiRequest(`/tournaments/${id}`),
  create: (data) => apiRequest('/tournaments', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/tournaments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiRequest(`/tournaments/${id}`, { method: 'DELETE' }),
  seedKnockout: (id) => apiRequest(`/tournaments/${id}/seed-knockout`, { method: 'POST' }),
}

// Squad API
export const squadsAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return apiRequest(`/squads${queryString ? `?${queryString}` : ''}`)
  },
  getById: (id) => apiRequest(`/squads/${id}`),
  create: (data) => apiRequest('/squads', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/squads/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiRequest(`/squads/${id}`, { method: 'DELETE' }),
}

// Player API
export const playersAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return apiRequest(`/players${queryString ? `?${queryString}` : ''}`)
  },
  getById: (id) => apiRequest(`/players/${id}`),
  create: (data) => apiRequest('/players', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/players/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiRequest(`/players/${id}`, { method: 'DELETE' }),
}

// Match API
export const matchesAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return apiRequest(`/matches${queryString ? `?${queryString}` : ''}`)
  },
  getLive: () => apiRequest('/matches/live'),
  getById: (id) => apiRequest(`/matches/${id}`),
  create: (data) => apiRequest('/matches', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiRequest(`/matches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateStatus: (id, status) => apiRequest(`/matches/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  updateScore: (id, data) => apiRequest(`/matches/${id}/score`, { method: 'PUT', body: JSON.stringify(data) }),
  addCommentary: (id, data) => apiRequest(`/matches/${id}/commentary`, { method: 'POST', body: JSON.stringify(data) }),
  autoUpdateStatus: () => apiRequest('/matches/auto-update-status', { method: 'POST' }),
  delete: (id) => apiRequest(`/matches/${id}`, { method: 'DELETE' }),
}

export default {
  tournaments: tournamentsAPI,
  squads: squadsAPI,
  players: playersAPI,
  matches: matchesAPI,
}

