import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
// Analytics is optional - we'll import it dynamically only if needed

// Firebase configuration
// Uses environment variables for production, falls back to default config for development
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBBspPU6lQyxbuU0Bt8L2UKEThGlmYHiYc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sma-cricket-league.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://sma-cricket-league-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sma-cricket-league",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sma-cricket-league.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "899272110972",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:899272110972:web:62fe0c9bddf2129f7e6af9",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-W2G5TD37XE"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

// Initialize Firestore
export const db = getFirestore(app)

// Initialize Auth
export const auth = getAuth(app)

// Initialize Analytics (only in browser environment, optional)
let analytics = null
if (typeof window !== 'undefined') {
  // Dynamically import analytics to prevent blocking if extensions block it
  import('firebase/analytics')
    .then((analyticsModule) => {
      try {
        if (!window.gtag) {
          analytics = analyticsModule.getAnalytics(app)
        }
      } catch (error) {
        console.warn('Analytics initialization failed (non-critical):', error.message)
      }
    })
    .catch((error) => {
      // Analytics blocked by extension or not available - that's okay
      console.warn('Analytics module blocked or unavailable (non-critical):', error.message)
    })
}
export { analytics }

export default app

