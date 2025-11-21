import { adminAuth } from '../config/firebaseAdmin.js'

/**
 * Middleware to verify Firebase ID token
 * Extracts token from Authorization header: "Bearer <token>"
 */
export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided. Please include Authorization header with Bearer token.',
      })
    }

    const token = authHeader.split('Bearer ')[1]

    // Verify the token with Firebase Admin
    const decodedToken = await adminAuth.verifyIdToken(token)

    // Check if user is admin
    const db = (await import('../config/firebaseAdmin.js')).db
    const adminDoc = await db.collection('admin').doc(decodedToken.uid).get()

    if (!adminDoc.exists) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin privileges required.',
      })
    }

    // Attach user info to request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      adminData: adminDoc.data(),
    }

    next()
  } catch (error) {
    console.error('Token verification error:', error)
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token.',
    })
  }
}

/**
 * Optional middleware - verify token but don't require admin
 */
export const verifyTokenOptional = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1]
      const decodedToken = await adminAuth.verifyIdToken(token)
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
      }
    }

    next()
  } catch (error) {
    // If token is invalid, continue without user (public access)
    next()
  }
}

