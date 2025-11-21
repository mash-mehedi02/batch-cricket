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

const MATCHES_COLLECTION = 'matches'
const COMMENTARY_COLLECTION = 'commentary'

const sortMatchesByDateDesc = (matches = []) =>
  matches.sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time || '00:00'}`)
    const dateB = new Date(`${b.date}T${b.time || '00:00'}`)
    return dateB - dateA
  })

const sortMatchesByDateAsc = (matches = []) =>
  matches.sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time || '00:00'}`)
    const dateB = new Date(`${b.date}T${b.time || '00:00'}`)
    return dateA - dateB
  })

// Get all matches
export const getAllMatches = async () => {
  try {
    const matchesRef = collection(db, MATCHES_COLLECTION)
    const q = query(matchesRef, orderBy('date', 'desc'))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error('Error getting matches:', error)
    throw error
  }
}

// Get live matches
export const getLiveMatches = async () => {
  try {
    const matchesRef = collection(db, MATCHES_COLLECTION)
    const q = query(matchesRef, where('status', '==', 'Live'))
    const querySnapshot = await getDocs(q)
    const matches = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    return sortMatchesByDateDesc(matches)
  } catch (error) {
    console.error('Error getting live matches:', error)
    throw error
  }
}

// Get upcoming matches
export const getUpcomingMatches = async () => {
  try {
    const matchesRef = collection(db, MATCHES_COLLECTION)
    const q = query(matchesRef, where('status', '==', 'Upcoming'))
    const querySnapshot = await getDocs(q)
    const matches = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    return sortMatchesByDateAsc(matches)
  } catch (error) {
    console.error('Error getting upcoming matches:', error)
    throw error
  }
}

// Get past matches
export const getPastMatches = async () => {
  try {
    const matchesRef = collection(db, MATCHES_COLLECTION)
    const q = query(matchesRef, where('status', 'in', ['Completed', 'Finished']))
    const querySnapshot = await getDocs(q)
    const matches = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    return sortMatchesByDateDesc(matches)
  } catch (error) {
    console.error('Error getting past matches:', error)
    throw error
  }
}

// Get match by ID
export const getMatchById = async (matchId) => {
  try {
    const matchRef = doc(db, MATCHES_COLLECTION, matchId)
    const matchSnap = await getDoc(matchRef)
    if (matchSnap.exists()) {
      return {
        id: matchSnap.id,
        ...matchSnap.data(),
      }
    } else {
      throw new Error('Match not found')
    }
  } catch (error) {
    console.error('Error getting match:', error)
    throw error
  }
}

// Subscribe to match updates (real-time)
export const subscribeToMatch = (matchId, callback) => {
  const matchRef = doc(db, MATCHES_COLLECTION, matchId)
  return onSnapshot(matchRef, (doc) => {
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

// Subscribe to live matches (real-time)
export const subscribeToLiveMatches = (callback) => {
  try {
    const matchesRef = collection(db, MATCHES_COLLECTION)
    const q = query(matchesRef, where('status', '==', 'Live'))
    return onSnapshot(
      q,
      (querySnapshot) => {
        const matches = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        callback(sortMatchesByDateDesc(matches))
      },
      (error) => {
        console.error('Error subscribing to live matches:', error)
        callback([])
      }
    )
  } catch (error) {
    console.error('Error setting up live matches subscription:', error)
    callback([])
    return () => {}
  }
}

// Create a new match
export const createMatch = async (matchData) => {
  try {
    const matchesRef = collection(db, MATCHES_COLLECTION)
    const docRef = await addDoc(matchesRef, {
      ...matchData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    return docRef.id
  } catch (error) {
    console.error('Error creating match:', error)
    throw error
  }
}

// Update match score
export const updateMatchScore = async (matchId, scoreData) => {
  try {
    const matchRef = doc(db, MATCHES_COLLECTION, matchId)
    await updateDoc(matchRef, {
      ...scoreData,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error('Error updating match score:', error)
    throw error
  }
}

// Add commentary to match
export const addCommentary = async (matchId, commentaryData) => {
  try {
    const commentaryRef = collection(db, MATCHES_COLLECTION, matchId, COMMENTARY_COLLECTION)
    await addDoc(commentaryRef, {
      ...commentaryData,
      timestamp: Timestamp.now(),
      createdAt: Timestamp.now(),
    })
  } catch (error) {
    console.error('Error adding commentary:', error)
    throw error
  }
}

// Subscribe to match commentary (real-time)
export const subscribeToCommentary = (matchId, callback) => {
  const commentaryRef = collection(db, MATCHES_COLLECTION, matchId, COMMENTARY_COLLECTION)
  const q = query(commentaryRef, orderBy('timestamp', 'desc'))
  return onSnapshot(q, (querySnapshot) => {
    const commentary = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    callback(commentary.reverse()) // Reverse to show oldest first
  })
}

// Update match status
export const updateMatchStatus = async (matchId, status) => {
  try {
    const matchRef = doc(db, MATCHES_COLLECTION, matchId)
    await updateDoc(matchRef, {
      status,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error('Error updating match status:', error)
    throw error
  }
}

// Delete match
export const deleteMatch = async (matchId) => {
  try {
    const matchRef = doc(db, MATCHES_COLLECTION, matchId)
    await deleteDoc(matchRef)
  } catch (error) {
    console.error('Error deleting match:', error)
    throw error
  }
}

