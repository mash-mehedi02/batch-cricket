/**
 * Firebase Configuration
 * Initialize Firebase services
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator, setPersistence, indexedDBLocalPersistence } from 'firebase/auth'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
import { getMessaging } from 'firebase/messaging'
// Analytics is optional - may be blocked by ad blockers

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBBspPU6lQyxbuU0Bt8L2UKEThGlmYHiYc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sma-cricket-league.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://sma-cricket-league-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sma-cricket-league",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sma-cricket-league.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "899272110972",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:899272110972:web:62fe0c9bddf2129f7e6af9",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-W2G5TD37XE",
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize services
export const db = getFirestore(app)
export const auth = getAuth(app)

// We set persistence in the authStore to ensure consistency during redirect results.
// No extra setup needed here.

export const storage = getStorage(app)
export const functions = getFunctions(app)
export const messaging = typeof window !== "undefined" ? getMessaging(app) : null
export { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCredential } from 'firebase/auth'

// Lightweight project info (safe to log for debugging)
export const firebaseProjectInfo = {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
}

// Initialize Analytics (optional - may be blocked by ad blockers)
// Analytics is completely optional and won't break the app if blocked
let analytics: any = null

// Only initialize analytics if explicitly enabled and in browser
// Skip if measurementId is not provided (indicates analytics not needed)
const shouldInitAnalytics =
  typeof window !== 'undefined' &&
  firebaseConfig.measurementId &&
  import.meta.env.VITE_ENABLE_ANALYTICS !== 'false'

if (shouldInitAnalytics) {
  // Use setTimeout to defer initialization and avoid blocking
  // This prevents ad blockers from breaking the app
  setTimeout(() => {
    try {
      // Dynamic import to avoid bundling if blocked
      // Catch all errors silently - analytics is completely optional
      import('firebase/analytics')
        .then((module) => {
          try {
            const { getAnalytics } = module
            if (getAnalytics && typeof window !== 'undefined') {
              analytics = getAnalytics(app)
              console.log('[Firebase] Analytics initialized')
            }
          } catch (initError) {
            // Initialization failed - silently ignore
            analytics = null
          }
        })
        .catch(() => {
          // Import failed (likely blocked by ad blocker) - silently ignore
          analytics = null
        })
    } catch (error) {
      // Any other error - silently ignore
      analytics = null
    }
  }, 100) // Increased delay to avoid blocking
}

export { analytics }

// Connect to emulators in development
export const isUsingEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true'

if (isUsingEmulators) {
  connectFirestoreEmulator(db, 'localhost', 8080)
  connectAuthEmulator(auth, 'http://localhost:9099')
  connectStorageEmulator(storage, 'localhost', 9199)
  connectFunctionsEmulator(functions, 'localhost', 5001)
}

export default app

