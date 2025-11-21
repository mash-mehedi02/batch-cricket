import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../config/firebase'

const PLAYERS_COLLECTION = 'players'

// Get all players
export const getAllPlayers = async () => {
  try {
    const playersRef = collection(db, PLAYERS_COLLECTION)
    const q = query(playersRef, orderBy('name', 'asc'))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error('Error getting players:', error)
    throw error
  }
}

// Get players by batch
export const getPlayersByBatch = async (batch) => {
  try {
    const playersRef = collection(db, PLAYERS_COLLECTION)
    const q = query(
      playersRef,
      where('batch', '==', batch),
      orderBy('name', 'asc')
    )
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error('Error getting players by batch:', error)
    throw error
  }
}

// Get player by ID
export const getPlayerById = async (playerId) => {
  try {
    const playerRef = doc(db, PLAYERS_COLLECTION, playerId)
    const playerSnap = await getDoc(playerRef)
    if (playerSnap.exists()) {
      return {
        id: playerSnap.id,
        ...playerSnap.data(),
      }
    } else {
      throw new Error('Player not found')
    }
  } catch (error) {
    console.error('Error getting player:', error)
    throw error
  }
}

// Subscribe to player updates (real-time)
export const subscribeToPlayer = (playerId, callback) => {
  const playerRef = doc(db, PLAYERS_COLLECTION, playerId)
  return onSnapshot(playerRef, (doc) => {
    if (doc.exists()) {
      callback({
        id: doc.id,
        ...doc.data(),
      })
    } else {
      callback(null)
    }
  })
}

// Create a new player
export const createPlayer = async (playerData) => {
  try {
    const playersRef = collection(db, PLAYERS_COLLECTION)
    const docRef = await addDoc(playersRef, {
      ...playerData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    console.error('Error creating player:', error)
    throw error
  }
}

// Update player stats
export const updatePlayerStats = async (playerId, statsData) => {
  try {
    const playerRef = doc(db, PLAYERS_COLLECTION, playerId)
    await updateDoc(playerRef, {
      stats: statsData,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error('Error updating player stats:', error)
    throw error
  }
}

// Add match performance to player
export const addPlayerMatchPerformance = async (playerId, matchPerformance) => {
  try {
    const playerRef = doc(db, PLAYERS_COLLECTION, playerId)
    const playerSnap = await getDoc(playerRef)
    
    if (playerSnap.exists()) {
      const playerData = playerSnap.data()
      const pastMatches = playerData.pastMatches || []
      
      await updateDoc(playerRef, {
        pastMatches: [...pastMatches, {
          ...matchPerformance,
          timestamp: Timestamp.now(),
        }],
        updatedAt: Timestamp.now(),
      })
    }
  } catch (error) {
    console.error('Error adding player match performance:', error)
    throw error
  }
}

// Update player profile
export const updatePlayerProfile = async (playerId, profileData) => {
  try {
    const playerRef = doc(db, PLAYERS_COLLECTION, playerId)
    await updateDoc(playerRef, {
      ...profileData,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error('Error updating player profile:', error)
    throw error
  }
}

// Delete player
export const deletePlayer = async (playerId) => {
  try {
    const playerRef = doc(db, PLAYERS_COLLECTION, playerId)
    await deleteDoc(playerRef)
  } catch (error) {
    console.error('Error deleting player:', error)
    throw error
  }
}

