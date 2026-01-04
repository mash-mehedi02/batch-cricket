/**
 * Utility to create admin document in Firebase
 * Run this once after login to create your admin document
 */

import { doc, setDoc } from 'firebase/firestore'
import { db, auth } from '@/config/firebase'

/**
 * Create admin document for current user
 * Call this function once after login to grant admin permissions
 */
export async function createAdminDocument(): Promise<void> {
  const user = auth.currentUser
  
  if (!user) {
    throw new Error('You must be logged in to create an admin document')
  }

  try {
    console.log('🔧 Creating admin document...')
    console.log('User ID:', user.uid)
    console.log('Email:', user.email)
    
    // Create admin document in admin collection
    // Firestore rules allow: allow create: if request.auth != null && request.auth.uid == adminId
    const adminDocRef = doc(db, 'admin', user.uid)
    await setDoc(adminDocRef, {
      createdAt: new Date().toISOString(),
      email: user.email || '',
      uid: user.uid,
    }, { merge: true }) // Use merge to avoid overwriting if document exists
    
    console.log('✅ Admin document created successfully!')
    console.log('Document path: admin/' + user.uid)
    
    // Verify it was created
    const { getDoc } = await import('firebase/firestore')
    const verifyDoc = await getDoc(adminDocRef)
    if (!verifyDoc.exists()) {
      throw new Error('Admin document was not created. Check Firestore rules.')
    }
    
    console.log('✅ Verified: Admin document exists')
    return Promise.resolve()
  } catch (error: any) {
    console.error('❌ Error creating admin document:', error)
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    
    // Provide helpful error messages
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. You may need to create the admin document manually in Firebase Console. Collection: admin, Document ID: ' + user.uid)
    }
    
    throw error
  }
}

/**
 * Check if current user is admin
 */
export async function checkIfAdmin(): Promise<boolean> {
  const user = auth.currentUser
  
  if (!user) {
    return false
  }

  try {
    const { getDoc } = await import('firebase/firestore')
    const adminDoc = await getDoc(doc(db, 'admin', user.uid))
    return adminDoc.exists()
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

