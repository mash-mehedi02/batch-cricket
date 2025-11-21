import { createContext, useContext, useEffect, useState } from 'react'
import { subscribeToAuthState } from '../services/adminsService'

const FirebaseContext = createContext()

export const useFirebase = () => {
  const context = useContext(FirebaseContext)
  if (!context) {
    throw new Error('useFirebase must be used within FirebaseProvider')
  }
  return context
}

export const FirebaseProvider = ({ children }) => {
  const [currentAdmin, setCurrentAdmin] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const unsubscribe = subscribeToAuthState((admin) => {
        setCurrentAdmin(admin)
        setLoading(false)
      })

      return () => unsubscribe()
    } catch (error) {
      console.error('Firebase initialization error:', error)
      setLoading(false)
    }
  }, [])

  const value = {
    currentAdmin,
    loading,
  }

  // Don't block rendering if Firebase is still loading
  return (
    <FirebaseContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-400 text-6xl mb-4 animate-pulse">🏏</div>
            <p className="text-gray-500">Loading...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </FirebaseContext.Provider>
  )
}

