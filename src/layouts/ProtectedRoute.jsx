import React from 'react'
import { Navigate } from 'react-router-dom'
import { useFirebase } from '../contexts/FirebaseContext'

/**
 * Protected Route Component
 * Uses FirebaseContext to match AdminPanel's authentication
 */
const ProtectedRoute = ({ children, requiredRole = 'viewer', redirectTo = '/' }) => {
  const { currentAdmin, loading } = useFirebase()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4 animate-pulse">🏏</div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (!currentAdmin) {
    return <Navigate to={redirectTo} replace />
  }

  const roleHierarchy = {
    viewer: 1,
    scorer: 2,
    admin: 3,
  }

  const userRoleLevel = roleHierarchy[currentAdmin.role] || 0
  const requiredRoleLevel = roleHierarchy[requiredRole] || 0

  if (userRoleLevel < requiredRoleLevel) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute

