/**
 * Matches Firestore Service
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
import { COLLECTIONS, MATCH_STATUS } from '../../types'

const COLLECTION_NAME = COLLECTIONS.MATCHES

export const matchesService = {
  /**
   * Get match by ID
   */
  getById: async (matchId) => {
    return await getDocument(COLLECTION_NAME, matchId)
  },

  /**
   * Get all matches
   */
  getAll: async () => {
    return await getAllDocuments(COLLECTION_NAME, 'date', 'desc')
  },

  /**
   * Get matches by tournament
   */
  getByTournament: async (tournamentId) => {
    return await queryDocuments(COLLECTION_NAME, [
      { field: 'tournamentId', operator: '==', value: tournamentId },
    ], 'date', 'desc')
  },

  /**
   * Get matches by status
   */
  getByStatus: async (status) => {
    return await queryDocuments(COLLECTION_NAME, [
      { field: 'status', operator: '==', value: status },
    ], 'date', 'desc')
  },

  /**
   * Get live matches
   */
  getLive: async () => {
    return await queryDocuments(COLLECTION_NAME, [
      { field: 'status', operator: '==', value: MATCH_STATUS.LIVE },
    ], 'date', 'desc')
  },

  /**
   * Get upcoming matches
   */
  getUpcoming: async () => {
    return await queryDocuments(COLLECTION_NAME, [
      { field: 'status', operator: '==', value: MATCH_STATUS.UPCOMING },
    ], 'date', 'asc')
  },

  /**
   * Get completed matches
   */
  getCompleted: async () => {
    return await queryDocuments(COLLECTION_NAME, [
      { field: 'status', operator: '==', value: MATCH_STATUS.FINISHED },
    ], 'date', 'desc')
  },

  /**
   * Create match
   */
  create: async (matchData) => {
    return await createDocument(COLLECTION_NAME, {
      ...matchData,
      status: matchData.status || MATCH_STATUS.UPCOMING,
    })
  },

  /**
   * Update match
   */
  update: async (matchId, matchData) => {
    return await updateDocument(COLLECTION_NAME, matchId, matchData)
  },

  /**
   * Delete match
   */
  delete: async (matchId) => {
    return await deleteDocument(COLLECTION_NAME, matchId)
  },

  /**
   * Subscribe to match
   */
  subscribe: (matchId, callback) => {
    return subscribeToDocument(COLLECTION_NAME, matchId, callback)
  },

  /**
   * Subscribe to live matches
   */
  subscribeLive: (callback) => {
    return subscribeToCollection(
      COLLECTION_NAME,
      callback,
      [{ field: 'status', operator: '==', value: MATCH_STATUS.LIVE }],
      'date',
      'desc'
    )
  },

  /**
   * Subscribe to matches by tournament
   */
  subscribeByTournament: (tournamentId, callback) => {
    return subscribeToCollection(
      COLLECTION_NAME,
      callback,
      [{ field: 'tournamentId', operator: '==', value: tournamentId }],
      'date',
      'desc'
    )
  },
}

