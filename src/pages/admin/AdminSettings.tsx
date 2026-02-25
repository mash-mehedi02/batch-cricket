/**
 * Admin Settings Page
 * Platform settings and configuration
 */

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { checkIfAdmin } from '@/utils/createAdmin'
import { debugAdminPermissions, forceRefreshAuthToken, printAdminDebugInfo } from '@/utils/debugAdmin'
import toast from 'react-hot-toast'
import { Shield, CheckCircle, RefreshCw, Terminal, AlertTriangle, Copy, Database, Lock, Key, Save, Timer, ToggleLeft, ToggleRight, Image, Calendar, Trophy } from 'lucide-react'
import { auth, db } from '@/config/firebase'
import { updatePassword, signOut } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { doc, getDoc, setDoc } from 'firebase/firestore'

export default function AdminSettings() {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showDebug, setShowDebug] = useState(false)
  const [debugJson, setDebugJson] = useState<string>('')
  const navigate = useNavigate()

  // Change Password State
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  // Countdown Popup State
  const [cpEnabled, setCpEnabled] = useState(false)
  const [cpName, setCpName] = useState('')
  const [cpSubtitle, setCpSubtitle] = useState('')
  const [cpLogo, setCpLogo] = useState('')
  const [cpDate, setCpDate] = useState('')
  const [cpSaving, setCpSaving] = useState(false)
  const [cpFetching, setCpFetching] = useState(true)

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

  // Fetch Countdown Popup Settings
  useEffect(() => {
    const fetchCP = async () => {
      if (!user) return
      try {
        const docRef = doc(db, 'settings', 'countdownPopup')
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          const data = snap.data()
          setCpEnabled(!!data.enabled)
          setCpName(data.tournamentName || '')
          setCpSubtitle(data.subtitle || '')
          setCpLogo(data.tournamentLogo || '')
          setCpDate(data.startDate || '')
        }
      } catch (err) {
        console.error('Failed to fetch countdown settings:', err)
      } finally {
        setCpFetching(false)
      }
    }
    fetchCP()
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || !confirmPassword) return
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    const currentAuthenticatedUser = auth.currentUser
    if (!currentAuthenticatedUser) {
      toast.error('Authentication session not found')
      return
    }

    setIsUpdating(true)
    const toastId = toast.loading('Updating password...')

    try {
      await updatePassword(currentAuthenticatedUser, newPassword)
      toast.success('Password updated successfully! Please login again.', { id: toastId })

      // Force logout after password change for security
      await signOut(auth)
      navigate('/login')
    } catch (error: any) {
      console.error('Password update failed:', error)
      if (error.code === 'auth/requires-recent-login') {
        toast.error('For security, please logout and login again before changing your password.', { id: toastId })
      } else {
        toast.error(error.message || 'Failed to update password', { id: toastId })
      }
    } finally {
      setIsUpdating(false)
    }
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

      {/* Change Password Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-3">
          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Lock className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Security</h2>
            <p className="text-xs text-gray-500">Update your administrative credentials</p>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 px-1">New Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 px-1">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isUpdating}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition-all text-sm shadow-md disabled:opacity-50 active:scale-95"
            >
              <Save className="h-4 w-4" />
              {isUpdating ? 'Updating...' : 'Update Password'}
            </button>

            <p className="text-[10px] text-gray-400 leading-relaxed italic mt-4">
              * For security, you will be automatically logged out after changing your password. If you haven't logged in recently, you may be asked to re-authenticate.
            </p>
          </form>
        </div>
      </div>

      {/* Countdown Popup Settings - Super Admin only */}
      {!isSuperAdmin ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col items-center justify-center text-center space-y-3">
          <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center">
            <Timer className="h-6 w-6 text-slate-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Restricted Setting</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-[280px]">Only Super Admins can manage the global tournament countdown popup.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-3">
            <div className="h-10 w-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Timer className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">Countdown Popup</h2>
              <p className="text-xs text-gray-500">Show a tournament countdown when users open the app</p>
            </div>
            {cpFetching ? (
              <div className="h-9 w-20 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <button
                onClick={async () => {
                  if (!cpEnabled) {
                    // Turning ON — validate
                    if (!cpName.trim() || !cpDate.trim()) {
                      toast.error('Fill tournament name & date before enabling')
                      return
                    }
                  }
                  const newVal = !cpEnabled
                  setCpEnabled(newVal)
                  try {
                    await setDoc(doc(db, 'settings', 'countdownPopup'), {
                      enabled: newVal,
                      tournamentName: cpName.trim(),
                      subtitle: cpSubtitle.trim(),
                      tournamentLogo: cpLogo.trim(),
                      startDate: cpDate,
                    })
                    toast.success(newVal ? 'Popup enabled' : 'Popup disabled')
                  } catch {
                    toast.error('Failed to update')
                    setCpEnabled(!newVal)
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all ${cpEnabled ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                {cpEnabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                {cpEnabled ? 'ON' : 'OFF'}
              </button>
            )}
          </div>

          {cpFetching ? (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
                    <div className="h-10 w-full bg-gray-50 border border-gray-100 rounded-lg animate-pulse" />
                  </div>
                ))}
              </div>
              <div className="h-10 w-32 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          ) : (
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 px-1">
                    <Trophy className="inline h-3 w-3 mr-1" />Tournament Name *
                  </label>
                  <input
                    type="text"
                    value={cpName}
                    onChange={(e) => setCpName(e.target.value)}
                    placeholder="SMA Batch Cricket 2026 (Season 2)"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 px-1">
                    Subtitle
                  </label>
                  <input
                    type="text"
                    value={cpSubtitle}
                    onChange={(e) => setCpSubtitle(e.target.value)}
                    placeholder="The Ultimate Cricket Showdown"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 px-1">
                    <Image className="inline h-3 w-3 mr-1" />Logo URL
                  </label>
                  <input
                    type="url"
                    value={cpLogo}
                    onChange={(e) => setCpLogo(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 px-1">
                    <Calendar className="inline h-3 w-3 mr-1" />Start Date *
                  </label>
                  <input
                    type="date"
                    value={cpDate}
                    onChange={(e) => setCpDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm font-medium"
                  />
                </div>
              </div>

              {cpLogo && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <img src={cpLogo} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  <span className="text-xs text-gray-500">Logo preview</span>
                </div>
              )}

              <button
                onClick={async () => {
                  if (!cpName.trim() || !cpDate.trim()) {
                    toast.error('Tournament name and date are required')
                    return
                  }
                  setCpSaving(true)
                  try {
                    await setDoc(doc(db, 'settings', 'countdownPopup'), {
                      enabled: cpEnabled,
                      tournamentName: cpName.trim(),
                      subtitle: cpSubtitle.trim(),
                      tournamentLogo: cpLogo.trim(),
                      startDate: cpDate,
                    })
                    toast.success('Countdown popup settings saved!')
                  } catch {
                    toast.error('Failed to save settings')
                  } finally {
                    setCpSaving(false)
                  }
                }}
                disabled={cpSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition-all text-sm shadow-md disabled:opacity-50 active:scale-95"
              >
                <Save className="h-4 w-4" />
                {cpSaving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          )}
        </div>
      )}

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
