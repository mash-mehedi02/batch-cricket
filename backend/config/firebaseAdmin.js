import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import dotenv from 'dotenv'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

let adminApp
let db
let adminAuth

try {
  // Try to load service account key
  const serviceAccountPath = join(__dirname, 'serviceAccountKey.json')
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'))

  adminApp = initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
  })

  db = getFirestore(adminApp)
  adminAuth = getAuth(adminApp)

  console.log('✅ Firebase Admin SDK initialized successfully')
} catch (error) {
  console.error('❌ Firebase Admin SDK initialization failed:', error.message)
  console.log('📝 Please download serviceAccountKey.json from Firebase Console')
  console.log('   Project Settings > Service Accounts > Generate New Private Key')
  process.exit(1)
}

export { db, adminAuth, adminApp }

