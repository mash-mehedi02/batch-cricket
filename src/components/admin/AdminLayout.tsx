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

  const isAdmin = user.role === 'admin'

  // If not admin, redirect to settings so they can self-fix permissions (Make Me Admin / token refresh)
  if (!isAdmin && location.pathname !== '/admin/settings') {
    return <Navigate to="/admin/settings" replace />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navbar */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 shadow-sm">
        <div className="flex items-center justify-between h-full px-4 lg:px-6">
          {/* Left: Logo + Menu Toggle */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link to="/admin" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-teal-600 to-teal-700 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">BC</span>
              </div>
              <span className="hidden sm:block text-xl font-bold text-gray-900">BatchCrick Admin</span>
            </Link>
          </div>

          {/* Center: Quick Actions */}
          <div className="hidden md:flex items-center gap-2">
            {isAdmin ? (
              <>
                <Link
                  to="/admin/tournaments/new"
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition"
                >
                  + Tournament
                </Link>
                <Link
                  to="/admin/matches/new"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
                >
                  + Match
                </Link>
              </>
            ) : null}
          </div>

          {/* Right: Profile + Notifications */}
          <div className="flex items-center gap-4">
            <button className="p-2 rounded-lg hover:bg-gray-100 relative">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            <div className="relative group">
              <button className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100">
                <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {user?.displayName?.[0] || user?.email?.[0] || 'A'}
                </div>
                <span className="hidden md:block text-sm font-medium text-gray-700">{user?.displayName || user?.email}</span>
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
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
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'w-64' : 'w-0 lg:w-20'
          } fixed left-0 top-16 bottom-0 bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden z-40`}
        >
          <nav className="h-full overflow-y-auto py-4">
            <div className="px-3 space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    isActive(item.path)
                      ? 'bg-teal-50 text-teal-700 font-semibold border-l-4 border-teal-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className={`${sidebarOpen ? 'block' : 'hidden lg:hidden'} whitespace-nowrap`}>
                    {item.label}
                  </span>
                </Link>
              ))}

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full mt-4"
              >
                <span className="text-xl">🚪</span>
                <span className={`${sidebarOpen ? 'block' : 'hidden lg:hidden'} whitespace-nowrap`}>
                  Logout
                </span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main
          className={`flex-1 transition-all duration-300 ${
            sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'
          }`}
        >
          <div className="p-4 lg:p-6">
            {children || <Outlet />}
          </div>
        </main>
      </div>
    </div>
  )
}

