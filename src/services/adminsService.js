import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { db, auth } from '../config/firebase'

const ADMINS_COLLECTION = 'admin'

// Admin login
export const adminLogin = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const user = userCredential.user
    
    // Check if user is an admin
    const adminRef = doc(db, ADMINS_COLLECTION, user.uid)
    const adminSnap = await getDoc(adminRef)
    
    if (adminSnap.exists()) {
      return {
        uid: user.uid,
        email: user.email,
        ...adminSnap.data(),
      }
    } else {
      await signOut(auth)
      throw new Error('User is not an admin')
    }
  } catch (error) {
    console.error('Error logging in admin:', error)
    throw error
  }
}

// Admin signup
export const adminSignup = async (email, password, adminData) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)
    const user = userCredential.user
    
    // Create admin document
    const adminRef = doc(db, ADMINS_COLLECTION, user.uid)
    await setDoc(adminRef, {
      email,
      ...adminData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    })
    
    return {
      uid: user.uid,
      email: user.email,
      ...adminData,
    }
  } catch (error) {
    console.error('Error signing up admin:', error)
    throw error
  }
}

// Admin logout
export const adminLogout = async () => {
  try {
    await signOut(auth)
  } catch (error) {
    console.error('Error logging out admin:', error)
    throw error
  }
}

// Get current admin
export const getCurrentAdmin = () => {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        unsubscribe()
        if (user) {
          try {
            const adminRef = doc(db, ADMINS_COLLECTION, user.uid)
            const adminSnap = await getDoc(adminRef)
            if (adminSnap.exists()) {
              resolve({
                uid: user.uid,
                email: user.email,
                ...adminSnap.data(),
              })
            } else {
              resolve(null)
            }
          } catch (error) {
            reject(error)
          }
        } else {
          resolve(null)
        }
      },
      reject
    )
  })
}

// Subscribe to auth state changes
export const subscribeToAuthState = (callback) => {
  try {
    return onAuthStateChanged(
      auth,
      async (user) => {
        if (user) {
          try {
            const adminRef = doc(db, ADMINS_COLLECTION, user.uid)
            const adminSnap = await getDoc(adminRef)
            if (adminSnap.exists()) {
              callback({
                uid: user.uid,
                email: user.email,
                ...adminSnap.data(),
              })
            } else {
              callback(null)
            }
          } catch (error) {
            console.error('Error getting admin data:', error)
            callback(null)
          }
        } else {
          callback(null)
        }
      },
      (error) => {
        console.error('Auth state change error:', error)
        callback(null)
      }
    )
  } catch (error) {
    console.error('Error setting up auth state listener:', error)
    // Return a no-op unsubscribe function
    callback(null)
    return () => {}
  }
}

// Get all admins
export const getAllAdmins = async () => {
  try {
    const adminsRef = collection(db, ADMINS_COLLECTION)
    const querySnapshot = await getDocs(adminsRef)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error('Error getting admins:', error)
    throw error
  }
}

// Create admin (by super admin)
export const createAdmin = async (email, password, adminData) => {
  try {
    // This should be done server-side for security
    // For now, we'll use the signup function
    return await adminSignup(email, password, adminData)
  } catch (error) {
    console.error('Error creating admin:', error)
    throw error
  }
}

// Update admin
export const updateAdmin = async (adminId, adminData) => {
  try {
    const adminRef = doc(db, ADMINS_COLLECTION, adminId)
    await updateDoc(adminRef, {
      ...adminData,
      updatedAt: Timestamp.now(),
    })
  } catch (error) {
    console.error('Error updating admin:', error)
    throw error
  }
}

// Delete admin
export const deleteAdmin = async (adminId) => {
  try {
    const adminRef = doc(db, ADMINS_COLLECTION, adminId)
    await deleteDoc(adminRef)
  } catch (error) {
    console.error('Error deleting admin:', error)
    throw error
  }
}

