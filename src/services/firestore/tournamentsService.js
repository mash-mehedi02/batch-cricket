/**
 * Tournaments Firestore Service
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

const COLLECTION_NAME = COLLECTIONS.TOURNAMENTS

export const tournamentsService = {
  /**
   * Get tournament by ID
   */
  getById: async (tournamentId) => {
    return await getDocument(COLLECTION_NAME, tournamentId)
  },

  /**
   * Get all tournaments
   */
  getAll: async () => {
    return await getAllDocuments(COLLECTION_NAME, 'year', 'desc')
  },

  /**
   * Get tournaments by year
   */
  getByYear: async (year) => {
    return await queryDocuments(COLLECTION_NAME, [
      { field: 'year', operator: '==', value: year },
    ])
  },

  /**
   * Get active tournaments
   */
  getActive: async () => {
    return await queryDocuments(COLLECTION_NAME, [
      { field: 'status', operator: '==', value: 'active' },
    ], 'year', 'desc')
  },

  /**
   * Create tournament
   */
  create: async (tournamentData) => {
    return await createDocument(COLLECTION_NAME, {
      ...tournamentData,
      status: tournamentData.status || 'active',
      archived: false,
    })
  },

  /**
   * Update tournament
   */
  update: async (tournamentId, tournamentData) => {
    return await updateDocument(COLLECTION_NAME, tournamentId, tournamentData)
  },

  /**
   * Delete tournament
   */
  delete: async (tournamentId) => {
    return await deleteDocument(COLLECTION_NAME, tournamentId)
  },

  /**
   * Archive tournament (set archived flag)
   */
  archive: async (tournamentId) => {
    return await updateDocument(COLLECTION_NAME, tournamentId, {
      archived: true,
      status: 'completed',
    })
  },

  /**
   * Subscribe to tournament
   */
  subscribe: (tournamentId, callback) => {
    return subscribeToDocument(COLLECTION_NAME, tournamentId, callback)
  },

  /**
   * Subscribe to all tournaments
   */
  subscribeAll: (callback) => {
    return subscribeToCollection(COLLECTION_NAME, callback, [], 'year', 'desc')
  },
}

