/**
 * Admin Settings Page
 * Platform settings and configuration
 */

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { checkIfAdmin } from '@/utils/createAdmin'
import { debugAdminPermissions, forceRefreshAuthToken, printAdminDebugInfo } from '@/utils/debugAdmin'
import toast from 'react-hot-toast'
import { Shield, CheckCircle, RefreshCw, Terminal, AlertTriangle, Copy, Database } from 'lucide-react'

export default function AdminSettings() {
  const { user } = useAuthStore()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showDebug, setShowDebug] = useState(false)
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const handleRunDiagnostics = async () => {
    printAdminDebugInfo()
    const result = await debugAdminPermissions()
    setDebugJson(JSON.stringify(result, null, 2))
    toast.success('Diagnostics completed')
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <p>Please log in to view settings.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage admin preferences and system status</p>
      </div>

      {/* Admin Profile Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-3">
          <div className="h-10 w-10 bg-teal-100 rounded-full flex items-center justify-center">
            <Shield className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Admin Profile</h2>
            <p className="text-xs text-gray-500">Current Session Information</p>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-900 font-medium">{user.email}</span>
                {isAdmin && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-bold">Verified Admin</span>}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">User ID (UID)</label>
              <div className="flex items-center gap-2 mt-1 group">
                <code className="bg-gray-100 px-2 py-1 rounded text-sm text-gray-700 font-mono">{user.uid}</code>
                <button
                  onClick={() => copyToClipboard(user.uid || '', 'UID')}
                  className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy UID"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Database className="h-4 w-4" /> System Status
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Firestore Connection</span>
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <CheckCircle className="h-4 w-4" /> Active
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Admin Privileges</span>
                {checking ? (
                  <span className="text-gray-400">Checking...</span>
                ) : isAdmin ? (
                  <span className="text-green-600 font-medium">Granted</span>
                ) : (
                  <span className="text-amber-600 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Restricted
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced / Troubleshooting Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div
          className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setShowDebug(!showDebug)}
        >
          <div className="flex items-center gap-3">
            <Terminal className="h-5 w-5 text-gray-400" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Troubleshooting</h3>
              <p className="text-sm text-gray-500">Advanced diagnostic tools</p>
            </div>
          </div>
          <button className="text-sm text-teal-600 font-medium hover:underline">
            {showDebug ? 'Hide Tools' : 'Show Tools'}
          </button>
        </div>

        {showDebug && (
          <div className="p-6 border-t border-gray-200 bg-gray-50/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={async () => {
                  const ok = await forceRefreshAuthToken()
                  if (ok) toast.success('Token refreshed successfully. Try your action again.')
                  else toast.error('Token refresh failed (not logged in?)')
                }}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition shadow-sm"
              >
                <RefreshCw className="h-4 w-4" />
                Force Refresh Session
              </button>

              <button
                onClick={handleRunDiagnostics}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition shadow-sm"
              >
                <Terminal className="h-4 w-4" />
                Run Diagnostics
              </button>
            </div>

            {debugJson && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase">Diagnostic Output</label>
                  <button
                    onClick={() => copyToClipboard(debugJson, 'Diagnostics')}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                  >
                    Copy JSON
                  </button>
                </div>
                <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-x-auto max-h-64 shadow-inner">
                  {debugJson}
                </pre>
              </div>
            )}

            <div className="mt-4 p-4 bg-blue-50 text-blue-800 text-sm rounded-lg border border-blue-100 flex gap-3">
              <div className="shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold mb-1">Permission Issues?</p>
                <p className="opacity-90">
                  If you see "Permission Denied" errors, click <strong>"Force Refresh Session"</strong> above.
                  This often fixes issues where your admin status hasn't updated in your browser session yet.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

