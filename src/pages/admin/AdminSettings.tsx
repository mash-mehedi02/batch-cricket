/**
 * Admin Settings Page
 * Platform settings and configuration
 */

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { createAdminDocument, checkIfAdmin } from '@/utils/createAdmin'
import { debugAdminPermissions, forceRefreshAuthToken, printAdminDebugInfo } from '@/utils/debugAdmin'
import toast from 'react-hot-toast'

export default function AdminSettings() {
  const { user } = useAuthStore()
  const [isCreating, setIsCreating] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [debugJson, setDebugJson] = useState<string>('')

  // Check if user is admin on load
  useEffect(() => {
    const check = async () => {
      if (!user) {
        setChecking(false)
        return
      }
      try {
        const admin = await checkIfAdmin()
        setIsAdmin(admin)
      } catch (error) {
        console.error('Error checking admin status:', error)
      } finally {
        setChecking(false)
      }
    }
    if (user) {
      check()
    } else {
      setChecking(false)
    }
  }, [user])

  const handleCreateAdmin = async () => {
    if (!user) {
      toast.error('Please login first')
      return
    }

    setIsCreating(true)
    try {
      await createAdminDocument()
      toast.success('Admin document created successfully! You now have admin permissions.')
      setIsAdmin(true)
      
      // Wait a moment then check again
      setTimeout(async () => {
        const adminCheck = await checkIfAdmin()
        setIsAdmin(adminCheck)
        if (adminCheck) {
          toast.success('Admin permissions verified! You can now delete matches.')
          // Refresh auth store to update role
          window.location.reload()
        }
      }, 500)
    } catch (error: any) {
      console.error('Error creating admin document:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
      })
      
      if (error.code === 'permission-denied') {
        toast.error(
          <div>
            <p className="font-semibold">Permission denied!</p>
            <p className="text-sm mt-1">Please create admin document manually in Firebase Console.</p>
            <p className="text-xs mt-1">Collection: admin | Document ID: {user.uid}</p>
          </div>,
          { duration: 5000 }
        )
      } else {
        toast.error(error.message || 'Failed to create admin document. Check console for details.')
      }
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Platform configuration and preferences</p>
      </div>

      {/* Admin Setup */}
      {user && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Permissions</h3>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700 mb-2">
                <strong>Current User:</strong> {user.email}
              </p>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Current Role:</strong> <span className="font-semibold">{user.role || 'viewer'}</span>
              </p>
              {checking ? (
                <p className="text-sm text-gray-600">Checking admin status...</p>
              ) : isAdmin ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <p className="text-sm text-green-700 font-semibold">✓ Admin document exists</p>
                  </div>
                  <div className="mt-4 p-3 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                    <p className="text-sm font-bold text-yellow-800 mb-3">⚠️ Still seeing “Permission denied”?</p>
                    <p className="text-xs text-yellow-800 mb-3">
                      This usually means one of the following: <strong>wrong Firebase project</strong>, <strong>wrong UID</strong>,
                      <strong>auth token not refreshed</strong>, or <strong>emulators enabled</strong>. Click Debug to see the exact values.
                    </p>
                    <div className="bg-white p-3 rounded border border-red-200 mb-3">
                      <p className="text-xs font-semibold text-gray-800 mb-2">📋 Quick steps:</p>
                      <ol className="text-xs text-gray-700 space-y-1.5 ml-4 list-decimal">
                        <li>Click <strong>Force refresh token</strong></li>
                        <li>Do <strong>Logout → Login</strong></li>
                        <li>Click <strong>Debug</strong> and compare <code className="bg-gray-100 px-1 rounded">projectId</code> and <code className="bg-gray-100 px-1 rounded">userId</code> with Firebase Console</li>
                      </ol>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href="https://console.firebase.google.com/project/sma-cricket-league/firestore/rules"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-slate-700 text-white text-xs rounded hover:bg-slate-800 transition font-semibold"
                      >
                        🔗 Firestore Rules
                      </a>
                      <button
                        onClick={async () => {
                          const ok = await forceRefreshAuthToken()
                          if (ok) toast.success('Token refreshed. Please try delete again.')
                          else toast.error('Token refresh failed (not logged in?)')
                        }}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition"
                      >
                        🔄 Force refresh token
                      </button>
                      <button
                        onClick={async () => {
                          printAdminDebugInfo()
                          const result = await debugAdminPermissions()
                          const json = JSON.stringify(result, null, 2)
                          setDebugJson(json)
                          console.log('Full Debug Result:', result)
                          toast.success('Debug info generated (you can copy it below)')
                        }}
                        className="px-3 py-1.5 bg-gray-600 text-white text-xs rounded hover:bg-gray-700 transition"
                      >
                        🔍 Debug
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(debugJson || '')
                            toast.success('Copied debug JSON')
                          } catch {
                            toast.error('Copy failed (browser permissions)')
                          }
                        }}
                        disabled={!debugJson}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 transition disabled:opacity-50"
                      >
                        📋 Copy
                      </button>
                    </div>
                    {debugJson ? (
                      <pre className="mt-3 text-[11px] leading-4 bg-black text-green-200 p-3 rounded overflow-x-auto border border-black/20">
                        {debugJson}
                      </pre>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="text-sm text-gray-700 mb-4">
                    You don't have admin permissions yet. Click the button below to create your admin document.
                  </p>
                  <button
                    onClick={handleCreateAdmin}
                    disabled={isCreating}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition disabled:opacity-50"
                  >
                    {isCreating ? 'Creating...' : 'Make Me Admin'}
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    This will create an admin document in Firebase. After creation, refresh the page.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Instructions - Always show for reference */}
      {user && (
        <div className="bg-blue-50 rounded-xl shadow-md p-6 border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">📝 How to Create Admin Document</h3>
          <div className="space-y-4 text-sm text-blue-800">
            <div>
              <p className="font-semibold mb-2">Method 1: Firebase Console (Recommended)</p>
              <ol className="list-decimal list-inside space-y-2 ml-2">
                <li>Open <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Firebase Console</a></li>
                <li>Select your project: <strong>sma-cricket-league</strong></li>
                <li>Go to <strong>Firestore Database</strong></li>
                <li>Click <strong>"Start collection"</strong> or select existing <code className="bg-blue-100 px-2 py-1 rounded text-xs">admin</code> collection</li>
                <li>Create a document:
                  <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                    <li>Document ID: <code className="bg-blue-100 px-2 py-1 rounded text-xs font-mono">{user?.uid}</code></li>
                    <li>Add field (optional): <code className="bg-blue-100 px-2 py-1 rounded text-xs">email</code> = <code className="bg-blue-100 px-2 py-1 rounded text-xs">{user?.email}</code></li>
                  </ul>
                </li>
                <li>Click <strong>Save</strong></li>
                <li>Refresh this page</li>
              </ol>
            </div>
            
            <div className="mt-4 p-3 bg-blue-100 rounded-lg">
              <p className="font-semibold mb-2">Your User ID (copy this):</p>
              <code className="text-xs font-mono break-all bg-white px-2 py-1 rounded block">{user?.uid}</code>
            </div>

            <div className="mt-4">
              <p className="font-semibold mb-2">Method 2: Browser Console</p>
              <p className="text-xs bg-blue-100 p-3 rounded font-mono break-all mb-2">
                {`// Open browser console (F12) and run:
const { createAdminDocument } = await import('/src/utils/createAdmin.ts')
await createAdminDocument()`}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">General Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Platform Name</label>
            <input
              type="text"
              defaultValue="BatchCrick BD"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Default Overs Limit</label>
            <input
              type="number"
              defaultValue="20"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

