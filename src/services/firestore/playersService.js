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
   */
  getByTournament: async (tournamentId) => {
    return await queryDocuments(COLLECTION_NAME, [
      { field: 'tournamentId', operator: '==', value: tournamentId },
    ], 'name', 'asc')
  },

  /**
   * Get players by squad
   */
  getBySquad: async (squadId) => {
    return await queryDocuments(COLLECTION_NAME, [
      { field: 'squadId', operator: '==', value: squadId },
    ], 'name', 'asc')
  },

  /**
   * Get players by batch
   */
  getByBatch: async (batch) => {
    return await queryDocuments(COLLECTION_NAME, [
      { field: 'batch', operator: '==', value: batch },
    ], 'name', 'asc')
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

