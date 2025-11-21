import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth } from '../config/firebase'
import { getDocument } from '../services/firestore/base'
import { COLLECTIONS } from '../types'

/**
 * Custom hook for authentication
 */
export const useAuth = () => {
  const [user, setUser] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        // Fetch admin data
        try {
          const adminData = await getDocument(COLLECTIONS.ADMINS, firebaseUser.uid)
          setAdmin(adminData)
        } catch (error) {
          console.error('Error fetching admin data:', error)
          setAdmin(null)
        }
      } else {
        setUser(null)
        setAdmin(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      return { success: true, user: userCredential.user }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const logout = async () => {
    try {
      await signOut(auth)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const isAdmin = admin?.role === 'admin'
  const isScorer = admin?.role === 'scorer' || isAdmin
  const isViewer = admin?.role === 'viewer' || isScorer

  return {
    user,
    admin,
    loading,
    login,
    logout,
    isAdmin,
    isScorer,
    isViewer,
  }
}

