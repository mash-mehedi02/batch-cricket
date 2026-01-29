/**
 * Authentication Store (Zustand)
 * Manages user authentication state
 */

import { create } from 'zustand'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc, Timestamp, serverTimestamp, updateDoc } from 'firebase/firestore'
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

        // EMERGENCY BACKDOOR FOR OWNERS
        // This ensures you can always get back in if you get locked out
        const OWNER_EMAILS = ['batchcrick@gmail.com']
        if (!isAdmin && userCredential.user.email && OWNER_EMAILS.includes(userCredential.user.email)) {
          console.log('👑 Owner detected! Restoring admin access...')
          await setDoc(adminRef, {
            uid: userCredential.user.uid,
            email: userCredential.user.email,
            createdAt: new Date().toISOString(),
            role: 'super_admin'
          }, { merge: true })

          // Force refresh
          await userCredential.user.getIdToken(true)
          adminDoc = await getDoc(adminRef)
          isAdmin = adminDoc.exists()
        }

        if (!isAdmin) {
          try {
            const permitRef = doc(db, 'permitted_admins', (userCredential.user.email || 'unknown').toLowerCase())
            const permitDoc = await getDoc(permitRef)

            if (permitDoc.exists()) {
              console.log('User is in permitted_admins list. Granting admin access...')
              await setDoc(adminRef, {
                uid: userCredential.user.uid,
                email: userCredential.user.email || '',
                createdAt: new Date().toISOString(),
                grantedBy: permitDoc.data().addedBy || 'system'
              }, { merge: true })

              // Refresh token
              await userCredential.user.getIdToken(true)
              adminDoc = await getDoc(adminRef)
              isAdmin = adminDoc.exists()
            }
          } catch (err) {
            console.warn('Error checking permission list:', err)
          }
        }

        // Create user document if it doesn't exist (for normal players/users)
        const userRef = doc(db, 'users', userCredential.user.uid)
        const userDoc = await getDoc(userRef)

        if (!userDoc.exists()) {
          await setDoc(userRef, {
            uid: userCredential.user.uid,
            email: userCredential.user.email || '',
            role: 'viewer', // Default role for any new login
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp(),
          }, { merge: true })
        } else {
          await updateDoc(userRef, { lastLogin: serverTimestamp() })
        }

        let userData = (await getDoc(userRef)).data() || {}

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
            displayName: userCredential.user.displayName ?? undefined,
            role: 'viewer' as UserRole,
            createdAt: Timestamp.now(),
          },
          loading: false,
        })
      }
    } catch (error: any) {
      // Re-throw authentication errors
      console.error('Login error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      })
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

          if (!isAdmin) {
            try {
              const permitRef = doc(db, 'permitted_admins', (firebaseUser.email || 'unknown').toLowerCase())
              const permitDoc = await getDoc(permitRef)

              if (permitDoc.exists()) {
                console.log('User is in permitted_admins list. Granting admin access...')
                await setDoc(adminRef, {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || '',
                  createdAt: new Date().toISOString(),
                  grantedBy: permitDoc.data().addedBy || 'system'
                }, { merge: true })

                await firebaseUser.getIdToken(true)
                adminDoc = await getDoc(adminRef)
                isAdmin = adminDoc.exists()
              }
            } catch (err) {
              console.warn('Error checking permission list:', err)
            }
          }

          // Auto-sync with users collection
          const userRef = doc(db, 'users', firebaseUser.uid)
          const userDocCheck = await getDoc(userRef)
          if (!userDocCheck.exists()) {
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: 'viewer',
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
            })
          }

          let userData = (await getDoc(userRef)).data() || {}

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
                displayName: firebaseUser.displayName ?? undefined,
                role: 'viewer' as UserRole,
                createdAt: Timestamp.now(),
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

