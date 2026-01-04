/**
 * AI Firestore Service
 * 
 * Handles Firestore operations for AI-generated data:
 * - Commentary storage
 * - Predictions storage
 * - POTM storage
 * - Anomaly logs
 * 
 * @module aiService
 */

import { db } from '../../config/firebase'
import { collection, doc, addDoc, setDoc, getDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore'

/**
 * Save AI commentary to Firestore
 */
export async function saveCommentary(matchId, commentaryData) {
  try {
    const commentaryRef = collection(db, 'matches', matchId, 'commentary')
    const docRef = await addDoc(commentaryRef, {
      ...commentaryData,
      aiGenerated: true,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    })
    return docRef.id
  } catch (error) {
    console.error('Error saving commentary:', error)
    throw error
  }
}

/**
 * Get recent commentary for a match
 */
export async function getCommentary(matchId, limitCount = 50) {
  try {
    const commentaryRef = collection(db, 'matches', matchId, 'commentary')
    const q = query(commentaryRef, orderBy('timestamp', 'desc'), limit(limitCount))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error('Error fetching commentary:', error)
    throw error
  }
}

/**
 * Save AI predictions to Firestore
 */
export async function savePredictions(matchId, predictions) {
  try {
    const aiRef = doc(db, 'matches', matchId, 'ai', 'predictions')
    await setDoc(aiRef, {
      ...predictions,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  } catch (error) {
    console.error('Error saving predictions:', error)
    throw error
  }
}

/**
 * Get AI predictions for a match
 */
export async function getPredictions(matchId) {
  try {
    const aiRef = doc(db, 'matches', matchId, 'ai', 'predictions')
    const snapshot = await getDoc(aiRef)
    if (snapshot.exists()) {
      return snapshot.data()
    }
    return null
  } catch (error) {
    console.error('Error fetching predictions:', error)
    throw error
  }
}

/**
 * Save Player of the Match to Firestore
 */
export async function savePotm(matchId, potmData) {
  try {
    const aiRef = doc(db, 'matches', matchId, 'ai', 'potm')
    await setDoc(aiRef, {
      ...potmData,
      calculatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error saving POTM:', error)
    throw error
  }
}

/**
 * Get Player of the Match for a match
 */
export async function getPotm(matchId) {
  try {
    const aiRef = doc(db, 'matches', matchId, 'ai', 'potm')
    const snapshot = await getDoc(aiRef)
    if (snapshot.exists()) {
      return snapshot.data()
    }
    return null
  } catch (error) {
    console.error('Error fetching POTM:', error)
    throw error
  }
}

/**
 * Save anomaly log (only for severe anomalies)
 */
export async function saveAnomaly(matchId, anomalyData) {
  try {
    // Only save high-severity anomalies
    if (anomalyData.severity === 'high') {
      const anomaliesRef = collection(db, 'matches', matchId, 'ai', 'anomalies')
      await addDoc(anomaliesRef, {
        ...anomalyData,
        loggedAt: serverTimestamp(),
      })
    }
  } catch (error) {
    console.error('Error saving anomaly:', error)
    // Don't throw - anomaly logging is non-critical
  }
}

/**
 * Get anomaly logs for a match
 */
export async function getAnomalies(matchId, limitCount = 20) {
  try {
    const anomaliesRef = collection(db, 'matches', matchId, 'ai', 'anomalies')
    const q = query(anomaliesRef, orderBy('loggedAt', 'desc'), limit(limitCount))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error('Error fetching anomalies:', error)
    throw error
  }
}

/**
 * Save match insights
 */
export async function saveInsights(matchId, insights) {
  try {
    const aiRef = doc(db, 'matches', matchId, 'ai', 'insights')
    await setDoc(aiRef, {
      ...insights,
      updatedAt: serverTimestamp(),
    }, { merge: true })
  } catch (error) {
    console.error('Error saving insights:', error)
    throw error
  }
}

/**
 * Get match insights
 */
export async function getInsights(matchId) {
  try {
    const aiRef = doc(db, 'matches', matchId, 'ai', 'insights')
    const snapshot = await getDoc(aiRef)
    if (snapshot.exists()) {
      return snapshot.data()
    }
    return null
  } catch (error) {
    console.error('Error fetching insights:', error)
    throw error
  }
}

