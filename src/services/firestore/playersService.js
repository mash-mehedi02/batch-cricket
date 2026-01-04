/**
 * Players Firestore Service
 */
import {
  getDocument,
  getAllDocuments,
  queryDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  subscribeToCollection,
  subscribeToDocument,
} from './base'
import { COLLECTIONS } from '../../types'

const COLLECTION_NAME = COLLECTIONS.PLAYERS

export const playersService = {
  /**
   * Get player by ID
   */
  getById: async (playerId) => {
    return await getDocument(COLLECTION_NAME, playerId)
  },

  /**
   * Get all players
   */
  getAll: async () => {
    return await getAllDocuments(COLLECTION_NAME, 'name', 'asc')
  },

  /**
   * Get players by tournament
   * Note: We query without orderBy to avoid requiring a composite index,
   * then sort in memory for better performance and flexibility
   */
  getByTournament: async (tournamentId) => {
    try {
      // Try with orderBy first (if index exists)
      const players = await queryDocuments(COLLECTION_NAME, [
        { field: 'tournamentId', operator: '==', value: tournamentId },
      ], 'name', 'asc')
      return players
    } catch (error) {
      // If index doesn't exist, query without orderBy and sort in memory
      // Check multiple error conditions: code, message, and error type
      const isIndexError = 
        error.code === 'failed-precondition' || 
        error.code === 'unavailable' ||
        (error.message && (
          error.message.includes('index') || 
          error.message.includes('requires an index') ||
          error.message.includes('The query requires an index')
        )) ||
        (error.name && error.name.includes('FirebaseError'))
      
      if (isIndexError) {
        console.warn('[playersService] Composite index not available, querying without orderBy and sorting in memory')
        try {
          const players = await queryDocuments(COLLECTION_NAME, [
            { field: 'tournamentId', operator: '==', value: tournamentId },
          ])
          // Sort in memory by name
          return players.sort((a, b) => {
            const nameA = (a.name || '').toLowerCase()
            const nameB = (b.name || '').toLowerCase()
            return nameA.localeCompare(nameB)
          })
        } catch (fallbackError) {
          console.error('[playersService] Error in fallback query:', fallbackError)
          // Return empty array instead of throwing to prevent UI errors
          return []
        }
      }
      // For other errors, log and return empty array to prevent UI errors
      console.error('[playersService] Error querying players by tournament:', error)
      return []
    }
  },

  /**
   * Get players by squad
   * Note: We query without orderBy to avoid requiring a composite index,
   * then sort in memory for better performance and flexibility
   */
  getBySquad: async (squadId) => {
    try {
      // Try with orderBy first (if index exists)
      const players = await queryDocuments(COLLECTION_NAME, [
        { field: 'squadId', operator: '==', value: squadId },
      ], 'name', 'asc')
      return players
    } catch (error) {
      // If index doesn't exist, query without orderBy and sort in memory
      // Check multiple error conditions: code, message, and error type
      const isIndexError = 
        error.code === 'failed-precondition' || 
        error.code === 'unavailable' ||
        (error.message && (
          error.message.includes('index') || 
          error.message.includes('requires an index') ||
          error.message.includes('The query requires an index')
        )) ||
        (error.name && error.name.includes('FirebaseError'))
      
      if (isIndexError) {
        console.warn('[playersService] Composite index not available, querying without orderBy and sorting in memory')
        try {
          const players = await queryDocuments(COLLECTION_NAME, [
            { field: 'squadId', operator: '==', value: squadId },
          ])
          // Sort in memory by name
          return players.sort((a, b) => {
            const nameA = (a.name || '').toLowerCase()
            const nameB = (b.name || '').toLowerCase()
            return nameA.localeCompare(nameB)
          })
        } catch (fallbackError) {
          console.error('[playersService] Error in fallback query:', fallbackError)
          // Return empty array instead of throwing to prevent UI errors
          return []
        }
      }
      // For other errors, log and return empty array to prevent UI errors
      console.error('[playersService] Error querying players by squad:', error)
      return []
    }
  },

  /**
   * Get players by batch
   * Note: We query without orderBy to avoid requiring a composite index,
   * then sort in memory for better performance and flexibility
   */
  getByBatch: async (batch) => {
    try {
      // Try with orderBy first (if index exists)
      const players = await queryDocuments(COLLECTION_NAME, [
        { field: 'batch', operator: '==', value: batch },
      ], 'name', 'asc')
      return players
    } catch (error) {
      // If index doesn't exist, query without orderBy and sort in memory
      // Check multiple error conditions: code, message, and error type
      const isIndexError = 
        error.code === 'failed-precondition' || 
        error.code === 'unavailable' ||
        (error.message && (
          error.message.includes('index') || 
          error.message.includes('requires an index') ||
          error.message.includes('The query requires an index')
        )) ||
        (error.name && error.name.includes('FirebaseError'))
      
      if (isIndexError) {
        console.warn('[playersService] Composite index not available, querying without orderBy and sorting in memory')
        try {
          const players = await queryDocuments(COLLECTION_NAME, [
            { field: 'batch', operator: '==', value: batch },
          ])
          // Sort in memory by name
          return players.sort((a, b) => {
            const nameA = (a.name || '').toLowerCase()
            const nameB = (b.name || '').toLowerCase()
            return nameA.localeCompare(nameB)
          })
        } catch (fallbackError) {
          console.error('[playersService] Error in fallback query:', fallbackError)
          // Return empty array instead of throwing to prevent UI errors
          return []
        }
      }
      // For other errors, log and return empty array to prevent UI errors
      console.error('[playersService] Error querying players by batch:', error)
      return []
    }
  },

  /**
   * Create player
   */
  create: async (playerData) => {
    return await createDocument(COLLECTION_NAME, {
      ...playerData,
      stats: {
        matches: 0,
        runs: 0,
        wickets: 0,
        catches: 0,
      },
    })
  },

  /**
   * Update player
   */
  update: async (playerId, playerData) => {
    return await updateDocument(COLLECTION_NAME, playerId, playerData)
  },

  /**
   * Delete player
   */
  delete: async (playerId) => {
    return await deleteDocument(COLLECTION_NAME, playerId)
  },

  /**
   * Subscribe to player
   */
  subscribe: (playerId, callback) => {
    return subscribeToDocument(COLLECTION_NAME, playerId, callback)
  },

  /**
   * Subscribe to players by tournament
   */
  subscribeByTournament: (tournamentId, callback) => {
    return subscribeToCollection(
      COLLECTION_NAME,
      callback,
      [{ field: 'tournamentId', operator: '==', value: tournamentId }],
      'name',
      'asc'
    )
  },
}

