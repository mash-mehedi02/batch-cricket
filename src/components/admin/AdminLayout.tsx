/**
 * Admin Panel Layout
 * Professional sidebar + navbar layout for admin dashboard
 */

import { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface AdminLayoutProps {
  children?: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading, logout } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const menuItems = [
    { path: '/admin', label: 'Dashboard', icon: '📊' },
    { path: '/admin/tournaments', label: 'Tournaments', icon: '🏆' },
    { path: '/admin/squads', label: 'Squads & Teams', icon: '👥' },
    { path: '/admin/players', label: 'Players', icon: '🏏' },
    { path: '/admin/matches', label: 'Matches', icon: '⚽' },
    { path: '/admin/live', label: 'Live Matches', icon: '🔴' },
    { path: '/admin/analytics', label: 'Analytics & Insights', icon: '📈' },
    { path: '/admin/settings', label: 'Settings', icon: '⚙️' },
  ]

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    return location.pathname.startsWith(path)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-600">Loading...</div>
      </div>
    )
  }

  // Must be logged in to access admin
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Check admin status - allow access to settings page even if not admin yet
  // Also check if user exists in admin collection (more reliable than role)
  const isAdmin = user.role === 'admin'

  // Debug: Log admin status (only in dev)
  if (import.meta.env.DEV) {
    console.log('[AdminLayout] User:', { uid: user.uid, email: user.email, role: user.role, isAdmin, pathname: location.pathname })
  }

  // If not admin, only allow access to settings page (for self-fix)
  // Don't redirect if already on settings page to avoid redirect loops
  if (!isAdmin && location.pathname !== '/admin/settings') {
    console.warn('[AdminLayout] User is not admin, redirecting to settings. Current path:', location.pathname)
    // Redirect to settings, not home
    return <Navigate to="/admin/settings" replace />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navbar - Enhanced Responsive Design */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 shadow-md">
        <div className="flex items-center justify-between h-full px-4 sm:px-6">
          {/* Left: Logo + Menu Toggle */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link to="/admin" className="flex items-center gap-2 flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-600 to-teal-700 rounded-lg flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-lg">BC</span>
              </div>
              <span className="hidden xs:block text-lg sm:text-xl font-bold text-gray-900 whitespace-nowrap">
                BatchCrick Admin
              </span>
            </Link>
          </div>

          {/* Center: Quick Actions - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-3">
            {isAdmin && (
              <>
                <Link
                  to="/admin/tournaments/new"
                  className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg text-sm font-semibold hover:from-teal-700 hover:to-teal-800 transition-all shadow-sm hover:shadow-md"
                >
                  + New Tournament
                </Link>
                <Link
                  to="/admin/matches/new"
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow-md"
                >
                  + New Match
                </Link>
              </>
            )}
          </div>

          {/* Right: Profile + Notifications */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button className="p-2 rounded-lg hover:bg-gray-100 relative transition-colors" aria-label="Notifications">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            <div className="relative group hidden xs:block">
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'A'}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-gray-700 max-w-[120px] truncate">
                    {user?.displayName || user?.email}
                  </div>
                  <div className="text-xs text-gray-500">Administrator</div>
                </div>
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="py-2">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <div className="text-sm font-medium text-gray-900">
                      {user?.displayName || user?.email}
                    </div>
                    <div className="text-xs text-gray-500">Administrator</div>
                  </div>
                  <Link 
                    to="/admin/settings" 
                    className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.545-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.545-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.545.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.545.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
                    </div>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Profile Menu */}
            <div className="xs:hidden relative group">
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'A'}
                </div>
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="py-2">
                  <Link to="/admin/settings" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex pt-16">
        {/* Sidebar - Enhanced Responsive Design */}
        <aside
          className={`fixed left-0 top-16 bottom-0 bg-white border-r border-gray-200 transition-all duration-300 ease-in-out z-40 shadow-lg
            ${sidebarOpen 
              ? 'w-64 translate-x-0' 
              : 'w-0 -translate-x-full lg:w-20 lg:translate-x-0'
            }`}
        >
          <nav className="h-full overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <div className="px-3 space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group
                    ${isActive(item.path)
                      ? 'bg-gradient-to-r from-teal-50 to-teal-100 text-teal-700 font-semibold border-l-4 border-teal-600 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50 hover:shadow-sm'
                  }`}
                >
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <span className={`whitespace-nowrap transition-opacity duration-200
                    ${sidebarOpen ? 'opacity-100' : 'opacity-0 lg:opacity-100'}
                    ${!sidebarOpen && 'lg:absolute lg:left-20 lg:bg-white lg:px-4 lg:py-3 lg:rounded-lg lg:shadow-lg lg:border lg:border-gray-200 lg:group-hover:block lg:hidden'}`}
                  >
                    {item.label}
                  </span>
                </Link>
              ))}

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full mt-6 transition-all duration-200 group"
              >
                <span className="text-xl flex-shrink-0">🚪</span>
                <span className={`whitespace-nowrap transition-opacity duration-200
                  ${sidebarOpen ? 'opacity-100' : 'opacity-0 lg:opacity-100'}`}
                >
                  Logout
                </span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Main Content - Enhanced Responsive Padding */}
        <main
          className={`flex-1 transition-all duration-300 min-h-screen
            ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'}`}
        >
          <div className="p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12 max-w-7xl mx-auto">
            {/* Breadcrumb Navigation */}
            <div className="mb-6 hidden sm:block">
              <nav className="flex text-sm text-gray-500">
                <Link to="/admin" className="hover:text-teal-600 transition-colors">Admin</Link>
                <span className="mx-2">/</span>
                <span className="text-gray-900 font-medium capitalize">
                  {location.pathname.split('/')[2] || 'Dashboard'}
                </span>
              </nav>
            </div>
            
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  )
}

