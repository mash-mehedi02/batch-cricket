/**
 * Firebase Configuration
 * Initialize Firebase services
 */

import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'
// Analytics is optional - may be blocked by ad blockers

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string,
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize services
export const db = getFirestore(app)
export const auth = getAuth(app)

export const storage = getStorage(app)
export const functions = getFunctions(app)

// Handle Messaging with support check
let messaging: any = null;
if (typeof window !== "undefined") {
  try {
    import('firebase/messaging').then(async (module) => {
      const supported = await module.isSupported();
      if (supported) {
        messaging = module.getMessaging(app);
      } else {
        console.warn('[Firebase] Messaging not supported in this environment');
      }
    }).catch(() => {
      console.warn('[Firebase] Failed to load messaging module');
    });
  } catch (e) {
    messaging = null;
  }
}

export { messaging }
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
  setTimeout(() => {
    try {
      import('firebase/analytics')
        .then(async (module) => {
          try {
            const { getAnalytics, isSupported } = module
            const supported = await isSupported()
            if (supported && typeof window !== 'undefined') {
              analytics = getAnalytics(app)
              console.log('[Firebase] Analytics initialized')
            } else {
              console.warn('[Firebase] Analytics not supported in this environment')
            }
          } catch (initError) {
            analytics = null
          }
        })
        .catch(() => {
          analytics = null
        })
    } catch (error) {
      analytics = null
    }
  }, 100)
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

