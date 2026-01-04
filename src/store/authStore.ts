/**
 * Authentication Store (Zustand)
 * Manages user authentication state
 */

import { create } from 'zustand'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/config/firebase'
import { User, UserRole } from '@/types'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  initialize: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  login: async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      try {
        // Check admin collection first (Firestore rules check this)
        const adminRef = doc(db, 'admin', userCredential.user.uid)
        let adminDoc = await getDoc(adminRef)
        let isAdmin = adminDoc.exists()

        // Dev QoL: auto-bootstrap admin doc (prevents "permission-denied" surprises during tournaments)
        // You can disable by setting VITE_AUTO_ADMIN_BOOTSTRAP='false'
        const autoBootstrap = import.meta.env.DEV && import.meta.env.VITE_AUTO_ADMIN_BOOTSTRAP !== 'false'
        if (!isAdmin && autoBootstrap) {
          await setDoc(adminRef, {
            uid: userCredential.user.uid,
            email: userCredential.user.email || '',
            createdAt: new Date().toISOString(),
          }, { merge: true })
          // Refresh token so rules/claims changes apply immediately
          await userCredential.user.getIdToken(true)
          adminDoc = await getDoc(adminRef)
          isAdmin = adminDoc.exists()
        }
        
        // Also check users collection for additional data
        let userData: any = {}
        try {
          const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid))
          if (userDoc.exists()) {
            userData = userDoc.data()
          }
        } catch (err) {
          // Users collection might not be accessible, that's okay
          console.warn('Could not fetch user document:', err)
        }
        
        set({
          user: {
            uid: userCredential.user.uid,
            email: userCredential.user.email!,
            displayName: userCredential.user.displayName || userData.displayName,
            role: isAdmin ? 'admin' : ((userData.role as UserRole) || 'viewer'),
            createdAt: userData.createdAt,
            lastLogin: userData.lastLogin,
          },
          loading: false,
        })
      } catch (error: any) {
        // If admin doc fetch fails, assume not admin
        console.warn('Error fetching admin/user document:', error)
        set({
          user: {
            uid: userCredential.user.uid,
            email: userCredential.user.email!,
            displayName: userCredential.user.displayName,
            role: 'viewer' as UserRole,
          },
          loading: false,
        })
      }
    } catch (error: any) {
      // Re-throw authentication errors
      throw error
    }
  },

  logout: async () => {
    await signOut(auth)
    set({ user: null })
  },

  initialize: () => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Check admin collection first (Firestore rules check this)
          const adminRef = doc(db, 'admin', firebaseUser.uid)
          let adminDoc = await getDoc(adminRef)
          let isAdmin = adminDoc.exists()

          // Dev QoL: auto-bootstrap admin doc (prevents "permission-denied" surprises during tournaments)
          // You can disable by setting VITE_AUTO_ADMIN_BOOTSTRAP='false'
          const autoBootstrap = import.meta.env.DEV && import.meta.env.VITE_AUTO_ADMIN_BOOTSTRAP !== 'false'
          if (!isAdmin && autoBootstrap) {
            await setDoc(adminRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              createdAt: new Date().toISOString(),
            }, { merge: true })
            await firebaseUser.getIdToken(true)
            adminDoc = await getDoc(adminRef)
            isAdmin = adminDoc.exists()
          }
          
          // Also check users collection for additional data
          let userData: any = {}
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
            if (userDoc.exists()) {
              userData = userDoc.data()
            }
          } catch (err) {
            // Users collection might not be accessible, that's okay
            console.warn('Could not fetch user document:', err)
          }
          
          set({
            user: {
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: firebaseUser.displayName || userData.displayName,
              role: isAdmin ? 'admin' : ((userData.role as UserRole) || 'viewer'),
              createdAt: userData.createdAt,
              lastLogin: userData.lastLogin,
            },
            loading: false,
          })
        } catch (error: any) {
          // Handle permission errors gracefully
          if (error.code === 'permission-denied') {
            console.warn('Permission denied accessing admin/user document - using basic user info')
            set({
              user: {
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                displayName: firebaseUser.displayName,
                role: 'viewer' as UserRole,
              },
              loading: false,
            })
          } else {
            console.error('Error loading user data:', error)
            set({ user: null, loading: false })
          }
        }
      } else {
        set({ user: null, loading: false })
      }
    })
  },
}))

