/**
 * Squads Firestore Service
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

const COLLECTION_NAME = COLLECTIONS.SQUADS

export const squadsService = {
  /**
   * Get squad by ID
   */
  getById: async (squadId) => {
    return await getDocument(COLLECTION_NAME, squadId)
  },

  /**
   * Get all squads
   */
  getAll: async () => {
    // Try ordering by teamName first, fallback to no ordering if field doesn't exist
    try {
      return await getAllDocuments(COLLECTION_NAME, 'teamName', 'asc')
    } catch (error) {
      // If teamName index doesn't exist, try without ordering
      console.warn('[squadsService] teamName index not available, loading without orderBy')
      return await getAllDocuments(COLLECTION_NAME, null, 'asc')
    }
  },

  /**
   * Get squads by tournament
   */
  getByTournament: async (tournamentId) => {
    return await queryDocuments(COLLECTION_NAME, [
      { field: 'tournamentId', operator: '==', value: tournamentId },
    ], 'name', 'asc')
  },

  /**
   * Create squad
   */
  create: async (squadData) => {
    return await createDocument(COLLECTION_NAME, {
      ...squadData,
      players: squadData.players || [],
    })
  },

  /**
   * Update squad
   */
  update: async (squadId, squadData) => {
    return await updateDocument(COLLECTION_NAME, squadId, squadData)
  },

  /**
   * Delete squad
   */
  delete: async (squadId) => {
    return await deleteDocument(COLLECTION_NAME, squadId)
  },

  /**
   * Add player to squad
   */
  addPlayer: async (squadId, playerId, playerData) => {
    const squad = await getDocument(COLLECTION_NAME, squadId)
    if (!squad) throw new Error('Squad not found')
    
    const players = squad.players || []
    if (players.find((p) => p.playerId === playerId)) {
      throw new Error('Player already in squad')
    }
    
    players.push({
      playerId,
      ...playerData,
      addedAt: new Date().toISOString(),
    })
    
    return await updateDocument(COLLECTION_NAME, squadId, { players })
  },

  /**
   * Remove player from squad
   */
  removePlayer: async (squadId, playerId) => {
    const squad = await getDocument(COLLECTION_NAME, squadId)
    if (!squad) throw new Error('Squad not found')
    
    const players = (squad.players || []).filter((p) => p.playerId !== playerId)
    return await updateDocument(COLLECTION_NAME, squadId, { players })
  },

  /**
   * Subscribe to squad
   */
  subscribe: (squadId, callback) => {
    return subscribeToDocument(COLLECTION_NAME, squadId, callback)
  },

  /**
   * Subscribe to squads by tournament
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

