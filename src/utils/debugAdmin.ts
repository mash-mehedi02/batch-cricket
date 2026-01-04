/**
 * Admin Permission Debugging Utility
 * Helps diagnose permission issues
 */

import { auth, db, firebaseProjectInfo, isUsingEmulators } from '@/config/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { useAuthStore } from '@/store/authStore'

/**
 * Comprehensive admin permission check
 */
export async function debugAdminPermissions() {
  const user = auth.currentUser
  
  if (!user) {
    console.error('❌ No user logged in')
    return {
      userLoggedIn: false,
      hasAdminDoc: false,
      adminDocPath: null,
      projectId: firebaseProjectInfo.projectId,
      authDomain: firebaseProjectInfo.authDomain,
      isUsingEmulators,
      error: 'No user logged in',
    }
  }

  console.log('🔍 Debugging Admin Permissions...')
  console.log('User ID:', user.uid)
  console.log('User Email:', user.email)
  console.log('Firebase Project:', firebaseProjectInfo)
  console.log('Using Emulators:', isUsingEmulators)

  const adminDocPath = `admin/${user.uid}`
  const adminDocRef = doc(db, 'admin', user.uid)

  try {
    // Check if admin document exists
    const adminDoc = await getDoc(adminDocRef)
    const exists = adminDoc.exists()

    console.log('📄 Admin Document Path:', adminDocPath)
    console.log('✅ Admin Document Exists:', exists)

    if (exists) {
      const data = adminDoc.data()
      console.log('📋 Admin Document Data:', data)
    } else {
      console.warn('⚠️ Admin document does NOT exist!')
      console.warn('📝 Create it at:', adminDocPath)
    }

    // Check auth store state
    const { user: storeUser } = useAuthStore.getState()
    console.log('🔐 Auth Store Role:', storeUser?.role)
    console.log('🔐 Auth Store UID:', storeUser?.uid)

    return {
      userLoggedIn: true,
      userId: user.uid,
      userEmail: user.email,
      projectId: firebaseProjectInfo.projectId,
      authDomain: firebaseProjectInfo.authDomain,
      isUsingEmulators,
      hasAdminDoc: exists,
      adminDocPath,
      adminDocData: exists ? adminDoc.data() : null,
      authStoreRole: storeUser?.role,
      authStoreUID: storeUser?.uid,
    }
  } catch (error: any) {
    console.error('❌ Error checking admin permissions:', error)
    console.error('Error Code:', error.code)
    console.error('Error Message:', error.message)

    return {
      userLoggedIn: true,
      userId: user.uid,
      userEmail: user.email,
      hasAdminDoc: false,
      adminDocPath,
      projectId: firebaseProjectInfo.projectId,
      authDomain: firebaseProjectInfo.authDomain,
      isUsingEmulators,
      error: error.message,
      errorCode: error.code,
    }
  }
}

/**
 * Force refresh Firebase Auth ID token (useful after rule changes)
 */
export async function forceRefreshAuthToken(): Promise<boolean> {
  const user = auth.currentUser
  if (!user) return false
  try {
    await user.getIdToken(true)
    return true
  } catch (e) {
    console.error('Failed to force refresh token:', e)
    return false
  }
}

/**
 * Test if user can perform admin operations
 */
export async function testAdminPermission() {
  const user = auth.currentUser
  if (!user) {
    throw new Error('User not logged in')
  }

  try {
    // Try to read admin document (this should work per rules)
    const adminDocRef = doc(db, 'admin', user.uid)
    const adminDoc = await getDoc(adminDocRef)
    
    if (!adminDoc.exists()) {
      throw new Error('Admin document does not exist')
    }

    return {
      success: true,
      message: 'Admin permissions verified',
      adminDocData: adminDoc.data(),
    }
  } catch (error: any) {
    console.error('Permission test failed:', error)
    throw error
  }
}

/**
 * Print debug info to console
 */
export function printAdminDebugInfo() {
  const user = auth.currentUser
  const { user: storeUser } = useAuthStore.getState()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔍 ADMIN PERMISSION DEBUG INFO')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Firebase Auth User:', {
    uid: user?.uid,
    email: user?.email,
    exists: !!user,
  })
  console.log('Auth Store User:', {
    uid: storeUser?.uid,
    email: storeUser?.email,
    role: storeUser?.role,
    exists: !!storeUser,
  })
  console.log('Expected Admin Doc Path:', user ? `admin/${user.uid}` : 'N/A')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Run async check
  debugAdminPermissions().then((result) => {
    console.log('Debug Result:', result)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  })
}

