/**
 * Authentication Store (Zustand)
 * Manages user authentication state
 */

import { create } from 'zustand'
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, setDoc, Timestamp, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore'
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
    let userCredential;
    try {
      userCredential = await signInWithEmailAndPassword(auth, email, password)
    } catch (error: any) {
      console.error('Login error details:', error)
      throw error
    }

    try {
      // Multi-tier Role Determination
      let userRole: UserRole = 'viewer'
      const OWNER_EMAILS = ['batchcrick@gmail.com']
      const currentUserEmail = userCredential.user.email?.toLowerCase() || ''
      const isOwnerEmail = OWNER_EMAILS.includes(currentUserEmail)

      try {
        // 1. Check if they are already in the admins collection
        const adminsRef = doc(db, 'admins', userCredential.user.uid)
        const adminsDoc = await getDoc(adminsRef)
        const isActiveAdmin = adminsDoc.exists() && adminsDoc.data()?.isActive === true

        if (isActiveAdmin) {
          userRole = adminsDoc.data()?.role === 'super_admin' ? 'super_admin' : 'admin'
        } else if (isOwnerEmail) {
          // EMERGENCY BACKDOOR FOR OWNERS: Create the admin record if it doesn't exist
          console.log('👑 Owner detected during login! Initializing super admin access...')
          await setDoc(adminsRef, {
            uid: userCredential.user.uid,
            name: userCredential.user.displayName || 'Super Admin',
            email: currentUserEmail,
            role: 'super_admin',
            isActive: true,
            organizationName: 'BatchCrick',
            createdAt: serverTimestamp(),
          }, { merge: true })
          userRole = 'super_admin'
        }
      } catch (dbError) {
        console.warn('Admin check failed:', dbError)
        // Fallback for owner even if lookup fails
        if (isOwnerEmail) userRole = 'super_admin'
      }

      // Create user document if it doesn't exist (for profiling/last login)
      const userRef = doc(db, 'users', userCredential.user.uid)
      const userDoc = await getDoc(userRef)

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          email: userCredential.user.email || '',
          role: userRole,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        }, { merge: true })
      } else {
        await updateDoc(userRef, {
          lastLogin: serverTimestamp(),
          role: userRole // Sync role
        })
      }

      let userData = (await getDoc(userRef)).data() || {}

      set({
        user: {
          uid: userCredential.user.uid,
          email: userCredential.user.email!,
          displayName: userCredential.user.displayName || userData.displayName,
          role: userRole,
          createdAt: userData.createdAt,
          lastLogin: userData.lastLogin,
        },
        loading: false,
      })
    } catch (error: any) {
      console.warn('Error fetching admin/user document (using fallback):', error)
      const OWNER_EMAILS = ['batchcrick@gmail.com']
      const isOwner = userCredential.user.email && OWNER_EMAILS.includes(userCredential.user.email)
      set({
        user: {
          uid: userCredential.user.uid,
          email: userCredential.user.email!,
          displayName: userCredential.user.displayName ?? undefined,
          role: (isOwner ? 'super_admin' : 'viewer') as UserRole,
          createdAt: Timestamp.now(),
        },
        loading: false,
      })
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
          let userRole: UserRole = 'viewer'
          const OWNER_EMAILS = ['batchcrick@gmail.com']
          const currentUserEmail = firebaseUser.email?.toLowerCase() || ''
          const isOwnerEmail = OWNER_EMAILS.includes(currentUserEmail)

          try {
            const adminsRef = doc(db, 'admins', firebaseUser.uid)
            const adminsDoc = await getDoc(adminsRef)
            const isActiveAdmin = adminsDoc.exists() && adminsDoc.data()?.isActive === true

            if (isActiveAdmin) {
              userRole = adminsDoc.data()?.role === 'super_admin' ? 'super_admin' : 'admin'
            } else if (isOwnerEmail) {
              console.log('👑 Owner detected during init! Initializing super admin access...')
              await setDoc(adminsRef, {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'Super Admin',
                email: firebaseUser.email,
                role: 'super_admin',
                isActive: true,
                organizationName: 'BatchCrick',
                createdAt: serverTimestamp(),
              }, { merge: true })
              userRole = 'super_admin'
            }
          } catch (dbError) {
            console.warn('Admin init check failed:', dbError)
            if (isOwnerEmail) userRole = 'super_admin'
          }

          // Auto-sync with users collection
          const userRef = doc(db, 'users', firebaseUser.uid)
          const userDocCheck = await getDoc(userRef)
          if (!userDocCheck.exists()) {
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: userRole,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
            })
          } else {
            await updateDoc(userRef, {
              lastLogin: serverTimestamp(),
              role: userRole
            })
          }

          let userData = (await getDoc(userRef)).data() || {}

          set({
            user: {
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: firebaseUser.displayName || userData.displayName,
              role: userRole,
              createdAt: userData.createdAt,
              lastLogin: userData.lastLogin,
            },
            loading: false,
          })
        } catch (error: any) {
          // Handle permission errors gracefully
          const OWNER_EMAILS = ['batchcrick@gmail.com']
          const isOwner = firebaseUser.email && OWNER_EMAILS.includes(firebaseUser.email)

          if (error.code === 'permission-denied') {
            console.warn('Permission denied accessing admin/user document - using basic user info')
            set({
              user: {
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                displayName: firebaseUser.displayName ?? undefined,
                role: (isOwner ? 'super_admin' : 'viewer') as UserRole,
                createdAt: Timestamp.now(),
              },
              loading: false,
            })
          } else {
            console.error('Error loading user data:', error)
            set({
              user: isOwner ? {
                uid: firebaseUser.uid,
                email: firebaseUser.email!,
                displayName: firebaseUser.displayName ?? undefined,
                role: 'super_admin' as UserRole,
                createdAt: Timestamp.now(),
              } : null,
              loading: false
            })
          }
        }
      } else {
        set({ user: null, loading: false })
      }
    })
  },
}))

