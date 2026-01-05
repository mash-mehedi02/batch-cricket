/**
 * Main Layout Component
 * Wrapper for all pages with navigation
 */

import React, { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import schoolConfig from '@/config/school'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Navigation - Professional Header */}
      <nav className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white sticky top-0 z-50 backdrop-blur-lg bg-opacity-95">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4 md:gap-10 min-w-0 flex-1">
              <Link to="/" className="flex items-center gap-1.5 sm:gap-2 group min-w-0 flex-shrink">
                <img src={schoolConfig.batchLogo} alt="Logo" className="w-6 h-6 sm:w-8 sm:h-8 object-contain flex-shrink-0" />
                <span className="text-sm sm:text-lg md:text-xl font-extrabold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent truncate">
                  {schoolConfig.appName}
                </span>
              </Link>

              <div className="hidden md:flex gap-1">
                <Link
                  to="/"
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive('/')
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/30'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                >
                  Home
                </Link>
                <Link
                  to="/schedule"
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive('/schedule')
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/30'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                >
                  Schedule
                </Link>
                <Link
                  to="/tournaments"
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive('/tournaments')
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/30'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                >
                  Tournaments
                </Link>
                <Link
                  to="/squads"
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive('/squads')
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/30'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                >
                  Squads
                </Link>
                <Link
                  to="/players"
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive('/players')
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/30'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                >
                  Players
                </Link>
                <Link
                  to="/champions"
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${isActive('/champions')
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/30'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                >
                  Champions
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {user ? (
                <>
                  <div className="hidden sm:flex items-center gap-2 px-2 sm:px-3 py-1.5 bg-slate-700/50 rounded-lg">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-xs sm:text-sm text-slate-200 font-medium truncate max-w-[80px] sm:max-w-none">{user.email?.split('@')[0]}</span>
                  </div>
                  {user.role === 'admin' && (
                    <Link
                      to="/admin"
                      className="hidden md:block px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg text-sm font-semibold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg shadow-purple-500/30"
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={logout}
                    className="hidden md:block px-4 py-2 bg-red-600 rounded-lg text-sm font-semibold hover:bg-red-700 transition-all shadow-lg shadow-red-500/30"
                  >
                    Logout
                  </button>
                </>
              ) : null}

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                {isMobileMenuOpen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

      </nav>

      {/* Clean Modern Mobile Side-Drawer (Moved Outside Nav for Stacking Safety) */}
      <div
        className={`fixed inset-0 z-[100] md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-[4px]"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>

        {/* Side Drawer */}
        <div
          className={`absolute inset-y-0 left-0 w-[300px] bg-white transform transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col rounded-r-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.3)] ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          {/* Close Button (Floating) */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute top-8 right-8 p-2 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-100 transition-all z-20"
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* 1. BRANDING HEADER (Mockup Accurate) */}
          <div className="p-10 pb-8 flex flex-col items-start gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-slate-200 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
              <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-xl bg-slate-50 p-1.5 ring-1 ring-slate-100">
                <img
                  src={schoolConfig.logo}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            <div className="flex flex-col mt-2">
              <h3 className="text-2xl font-black text-slate-900 leading-none tracking-tight">BatchCrick BD</h3>
              <p className="text-sm font-semibold text-slate-500 mt-1 tracking-tight">{schoolConfig.name}</p>
            </div>
          </div>

          {/* Minimalist Divider */}
          <div className="px-10">
            <div className="h-px w-full bg-slate-100"></div>
          </div>

          {/* 2. NAVIGATION LINKS (Refined Spacing) */}
          <div className="flex-1 overflow-y-auto px-6 py-10 space-y-2">
            {[
              { p: '/', n: 'Home', i: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
              { p: '/schedule', n: 'Schedule', i: <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> },
              { p: '/tournaments', i: <path d="M8 21h8M12 17v4M7 4h10M7 4c0 0-1 0-1 1v3c0 1.105.895 2 2 2h8c1.105 0 2-.895 2-2V5c0-1-1-1-1-1H7zm0 0H6a3 3 0 00-3 3v1a3 3 0 003 3h1m10-7h1a3 3 0 013 3v1a3 3 0 01-3 3h-1" />, n: 'Tournaments' },
              { p: '/squads', i: <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />, n: 'Squads' },
              { p: '/players', i: <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />, n: 'Players' },
              { p: '/champions', i: <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" />, n: 'Champions' }
            ].map((link) => (
              <Link
                key={link.p}
                to={link.p}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`group flex items-center gap-5 px-6 py-4 rounded-[1.5rem] transition-all duration-300 ${isActive(link.p)
                  ? 'bg-slate-100 text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
              >
                <div className={`transition-colors ${isActive(link.p) ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-900'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive(link.p) ? 2 : 1.5}>
                    {link.i}
                  </svg>
                </div>
                <span className={`text-lg transition-all ${isActive(link.p) ? 'font-extrabold' : 'font-semibold'}`}>{link.n}</span>
              </Link>
            ))}
          </div>

          {/* 3. FOOTER SECTION: Mehedi Hasan & Info */}
          <div className="p-8 border-t border-slate-50 mt-auto rounded-r-[2.5rem]">
            {user && (
              <div className="flex items-center gap-4 mb-6 px-2">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600">
                  {user.email?.[0].toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{user.email?.split('@')[0]}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{user.role}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3">
              {user?.role === 'admin' && (
                <Link
                  to="/admin"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-purple-600 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-600/20 hover:scale-[1.02] transition-all"
                >
                  Admin Panel
                </Link>
              )}
              {user && (
                <button
                  onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-50 text-red-600 text-xs font-black uppercase tracking-widest border border-red-100 hover:bg-red-100 transition-all"
                >
                  Logout
                </button>
              )}

              {/* Developer/Branding Link in Footer */}
              <div className="pt-2 text-center">
                <a
                  href="https://www.facebook.com/mehedihasan110571"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex flex-col items-center gap-1 group"
                >
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] group-hover:text-teal-600 transition-colors">Developed By</span>
                  <span className="text-xs font-bold text-slate-400 group-hover:text-teal-600 transition-colors">Mehedi Hasan</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-8rem)]">{children}</main>

      {/* Footer - Professional */}
      <footer className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white mt-auto border-t border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <img src={schoolConfig.batchLogo} alt="Logo" className="w-6 h-6 object-contain" /> {schoolConfig.appName}
              </h3>
              <p className="text-slate-400 text-sm mb-2">
                {schoolConfig.footer.description}
              </p>
              <p className="text-slate-500 text-xs italic">
                {schoolConfig.footer.dedication}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 text-slate-300">Quick Links</h4>
              <div className="space-y-2">
                <Link to="/" className="block text-slate-400 hover:text-teal-400 text-sm transition">Home</Link>
                <Link to="/tournaments" className="block text-slate-400 hover:text-teal-400 text-sm transition">Tournaments</Link>
                <Link to="/players" className="block text-slate-400 hover:text-teal-400 text-sm transition">Players</Link>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 text-slate-300">Platform</h4>
              <div className="space-y-2">
                <Link to="/champions" className="block text-slate-400 hover:text-teal-400 text-sm transition">Champions</Link>
                <Link to="/squads" className="block text-slate-400 hover:text-teal-400 text-sm transition">Squads</Link>
                <Link to="/admin" className="block text-slate-400 hover:text-teal-400 text-sm transition">Admin</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-700 pt-6 text-center">
            <p className="text-slate-400 text-sm mb-1">
              © {new Date().getFullYear()} {schoolConfig.appFullName}. All rights reserved.
            </p>
            <p className="text-slate-500 text-xs">
              {schoolConfig.footer.tagline}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

