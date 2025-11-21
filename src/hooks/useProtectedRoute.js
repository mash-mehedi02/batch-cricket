import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'

/**
 * Hook to protect routes based on user role
 */
export const useProtectedRoute = (requiredRole = 'viewer', redirectTo = '/') => {
  const { admin, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading) {
      if (!admin) {
        navigate(redirectTo)
        return
      }

      const roleHierarchy = {
        viewer: 1,
        scorer: 2,
        admin: 3,
      }

      const userRoleLevel = roleHierarchy[admin.role] || 0
      const requiredRoleLevel = roleHierarchy[requiredRole] || 0

      if (userRoleLevel < requiredRoleLevel) {
        navigate(redirectTo)
      }
    }
  }, [admin, loading, requiredRole, navigate, redirectTo])

  return { admin, loading }
}

