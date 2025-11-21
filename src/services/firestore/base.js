/**
 * Base Firestore Service
 * Centralized CRUD operations for all collections
 */

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
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../../config/firebase'

/**
 * Generic get document by ID
 */
export const getDocument = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      }
    }
    return null
  } catch (error) {
    console.error(`Error getting document from ${collectionName}:`, error)
    throw error
  }
}

/**
 * Generic get all documents
 */
export const getAllDocuments = async (collectionName, orderByField = null, orderDirection = 'asc') => {
  try {
    const collectionRef = collection(db, collectionName)
    let q = collectionRef
    
    if (orderByField) {
      q = query(collectionRef, orderBy(orderByField, orderDirection))
    }
    
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error(`Error getting documents from ${collectionName}:`, error)
    throw error
  }
}

/**
 * Generic query documents
 */
export const queryDocuments = async (
  collectionName,
  conditions = [],
  orderByField = null,
  orderDirection = 'asc',
  limitCount = null
) => {
  try {
    const collectionRef = collection(db, collectionName)
    let q = collectionRef
    
    // Apply where conditions
    conditions.forEach((condition) => {
      q = query(q, where(condition.field, condition.operator, condition.value))
    })
    
    // Apply orderBy
    if (orderByField) {
      q = query(q, orderBy(orderByField, orderDirection))
    }
    
    // Apply limit
    if (limitCount) {
      q = query(q, limit(limitCount))
    }
    
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error(`Error querying documents from ${collectionName}:`, error)
    throw error
  }
}

/**
 * Generic create document
 * Uses serverTimestamp for accurate timestamps
 */
export const createDocument = async (collectionName, data) => {
  try {
    const collectionRef = collection(db, collectionName)
    const docRef = await addDoc(collectionRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return docRef.id
  } catch (error) {
    console.error(`Error creating document in ${collectionName}:`, error)
    throw error
  }
}

/**
 * Generic update document
 * Uses serverTimestamp for accurate timestamps
 */
export const updateDocument = async (collectionName, docId, data) => {
  try {
    const docRef = doc(db, collectionName, docId)
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })
  } catch (error) {
    console.error(`Error updating document in ${collectionName}:`, error)
    throw error
  }
}

/**
 * Generic delete document
 */
export const deleteDocument = async (collectionName, docId) => {
  try {
    const docRef = doc(db, collectionName, docId)
    await deleteDoc(docRef)
  } catch (error) {
    console.error(`Error deleting document from ${collectionName}:`, error)
    throw error
  }
}

/**
 * Subscribe to document changes (real-time)
 */
export const subscribeToDocument = (collectionName, docId, callback) => {
  try {
    const docRef = doc(db, collectionName, docId)
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback({
            id: docSnap.id,
            ...docSnap.data(),
          })
        } else {
          callback(null)
        }
      },
      (error) => {
        console.error(`Error in document subscription for ${collectionName}:`, error)
        callback(null, error)
      }
    )
  } catch (error) {
    console.error(`Error subscribing to document in ${collectionName}:`, error)
    return () => {}
  }
}

/**
 * Subscribe to collection changes (real-time)
 */
export const subscribeToCollection = (
  collectionName,
  callback,
  conditions = [],
  orderByField = null,
  orderDirection = 'asc',
  limitCount = null
) => {
  try {
    const collectionRef = collection(db, collectionName)
    let q = collectionRef
    
    // Apply where conditions
    conditions.forEach((condition) => {
      q = query(q, where(condition.field, condition.operator, condition.value))
    })
    
    // Apply orderBy
    if (orderByField) {
      q = query(q, orderBy(orderByField, orderDirection))
    }
    
    // Apply limit
    if (limitCount) {
      q = query(q, limit(limitCount))
    }
    
    return onSnapshot(
      q,
      (querySnapshot) => {
        const docs = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        callback(docs)
      },
      (error) => {
        console.error(`Error in collection subscription for ${collectionName}:`, error)
        callback([], error)
      }
    )
  } catch (error) {
    console.error(`Error subscribing to collection ${collectionName}:`, error)
    return () => {}
  }
}

/**
 * Batch write operations
 * Uses serverTimestamp for accurate timestamps
 */
export const batchWrite = async (operations) => {
  try {
    const batch = writeBatch(db)
    
    operations.forEach((op) => {
      const docRef = doc(db, op.collection, op.id)
      if (op.type === 'create') {
        batch.set(docRef, {
          ...op.data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } else if (op.type === 'update') {
        batch.update(docRef, {
          ...op.data,
          updatedAt: serverTimestamp(),
        })
      } else if (op.type === 'delete') {
        batch.delete(docRef)
      }
    })
    
    await batch.commit()
  } catch (error) {
    console.error('Error in batch write:', error)
    throw error
  }
}

