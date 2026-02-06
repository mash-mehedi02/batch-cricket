/**
 * Main Layout Component
 * Wrapper for all pages with navigation
 */

import React, { ReactNode } from 'react'
import BottomNav from './common/BottomNav'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import schoolConfig from '@/config/school'
import { useThemeStore } from '@/store/themeStore'
import { Search, Command, Home, Calendar, Trophy, Users, User as UserIcon, Zap, Moon, Sun, X } from 'lucide-react'
import { Toaster } from 'react-hot-toast'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { isDarkMode, toggleDarkMode } = useThemeStore()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)

  // Handle keyboard shortcut for search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        navigate('/search')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  const isActive = (path: string) => location.pathname === path
  // Hide main navbar on detail pages where we show a custom PageHeader
  const isDetailPage = /^\/(match|squads|players|tournaments)\/.+/.test(location.pathname)
  const isHome = location.pathname === '/'

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDetailPage ? 'bg-[#050B18]' : 'bg-slate-50 dark:bg-slate-950'}`}>
      <Toaster position="bottom-center" toastOptions={{ duration: 3000 }} />
      {/* Navigation - Professional Header - Hidden on Detail Pages */}
      {!isDetailPage && (
        <nav className={`z-50 backdrop-blur-xl border-b sticky top-0 transition-colors duration-300 ${isHome
          ? 'bg-[#0f172a] text-white border-[#0f172a]'
          : 'bg-white/80 dark:bg-slate-950/80 text-slate-900 dark:text-white border-slate-100 dark:border-white/5'
          }`}>
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pt-[var(--status-bar-height)]">
            <div className="flex justify-between items-center h-14">
              <div className="flex items-center gap-4 md:gap-10 min-w-0 flex-1">
                <Link to="/" className="flex items-center gap-1.5 sm:gap-2 group shrink-0 min-w-0">
                  <img src={schoolConfig.batchLogo} alt="Logo" className="w-6 h-6 sm:w-8 sm:h-8 object-contain shrink-0" />
                  <span className="text-xs sm:text-lg md:text-xl font-extrabold bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent truncate">
                    {schoolConfig.appName}
                  </span>
                </Link>

                <div className="hidden md:flex gap-1">
                  <Link
                    to="/"
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 uppercase tracking-wider ${isActive('/')
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20'
                      : isHome ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    Home
                  </Link>
                  <Link
                    to="/schedule"
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 uppercase tracking-wider ${isActive('/schedule')
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20'
                      : isHome ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    Schedule
                  </Link>
                  <Link
                    to="/tournaments"
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 uppercase tracking-wider ${isActive('/tournaments')
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20'
                      : isHome ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    Tournaments
                  </Link>
                  <Link
                    to="/squads"
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 uppercase tracking-wider ${isActive('/squads')
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20'
                      : isHome ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    Squads
                  </Link>
                  <Link
                    to="/players"
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 uppercase tracking-wider ${isActive('/players')
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20'
                      : isHome ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    Players
                  </Link>
                  <Link
                    to="/champions"
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 uppercase tracking-wider ${isActive('/champions')
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/20'
                      : isHome ? 'text-slate-300 hover:bg-white/10 hover:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >
                    Champions
                  </Link>
                </div>

              </div>

              <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0 justify-end ml-auto">
                {/* Global Search Trigger - Navigates to dedicated Search Page */}
                <div className="relative flex items-center justify-end mx-2 md:mx-4 md:flex-shrink-0 w-10 md:w-auto md:min-w-[200px] lg:min-w-[300px]">
                  <div
                    onClick={() => navigate('/search')}
                    className="relative w-full group cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                  >
                    <div className={`hidden md:flex items-center w-full pl-12 pr-4 py-2 border rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-inner ${isHome
                      ? 'bg-white/10 border-white/10 text-slate-300 group-hover:bg-white/20 group-hover:border-white/20'
                      : 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-400 group-hover:border-teal-500/30'
                      }`}>
                      Search Teams, Players...
                    </div>
                    <div className={`absolute inset-y-0 left-0 flex items-center justify-center w-10 md:pl-4 transition-colors ${isHome ? 'text-slate-400 group-hover:text-white' : 'text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400'}`}>
                      <Search className="h-4 w-4 md:h-5 md:w-5" strokeWidth={3} />
                    </div>

                    {/* Shortcut Hint - Desktop Only */}
                    <div className="absolute inset-y-0 right-0 pr-3 hidden lg:flex items-center">
                      <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black border ${isHome ? 'bg-black/20 border-white/10 text-slate-400' : 'bg-slate-700/50 text-slate-400 border-slate-600/50'}`}>
                        <Command className="w-2.5 h-2.5" />
                        <span>K</span>
                      </div>
                    </div>
                  </div>
                </div>


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
      )}

      {/* Clean Modern Mobile Side-Drawer (Moved Outside Nav for Stacking Safety) */}
      <div
        className={`fixed inset-0 z-[100] md:hidden transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-[4px] transition-opacity duration-500"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>

        {/* Side Drawer */}
        <div
          className={`absolute inset-y-0 left-0 w-[300px] shadow-2xl transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col rounded-r-[2rem] overflow-hidden ${isDarkMode ? 'bg-slate-900 border-r border-slate-800' : 'bg-white'} ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          {/* Header Controls (Moon/Sun & Close) */}
          <div className="absolute top-7 right-6 flex items-center gap-3 z-30">
            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
            >
              <X size={24} />
            </button>
          </div>

          {/* 1. BRANDING (Top Section) */}
          <div className="pt-12 px-10 pb-8 flex flex-col items-center text-center sm:items-start sm:text-left h-fit shrink-0">
            <div className="relative mb-4">
              <div className={`w-24 h-24 rounded-full p-1.5 shadow-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-2 border-slate-50'}`}>
                <img src={schoolConfig.logo} alt="Logo" className="w-full h-full object-contain" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {schoolConfig.appName}
              </h3>
              <p className={`text-sm font-bold opacity-60 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {schoolConfig.name}
              </p>
            </div>
          </div>

          {/* 2. NAVIGATION (Scrollable Body) */}
          <div className="flex-1 overflow-y-auto px-6 py-4 no-scrollbar">
            <p className={`px-4 text-[10px] font-black uppercase tracking-[0.2em] mb-4 opacity-40 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Main Menu
            </p>

            <div className="space-y-1">
              {[
                { p: '/', n: 'Home', i: <Home size={20} /> },
                { p: '/schedule', n: 'Schedule', i: <Calendar size={20} /> },
                { p: '/tournaments', n: 'Tournaments', i: <Trophy size={20} /> },
                { p: '/squads', n: 'Squads', i: <Users size={20} /> },
                { p: '/players', n: 'Players', i: <UserIcon size={20} /> },
                { p: '/champions', n: 'Champions', i: <Zap size={20} /> }
              ].map((link) => (
                <Link
                  key={link.p}
                  to={link.p}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl font-bold transition-all duration-300 group ${isActive(link.p)
                    ? (isDarkMode ? 'bg-white text-slate-900' : 'bg-slate-900 text-white shadow-xl shadow-slate-200/50')
                    : (isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800/50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50')
                    }`}
                >
                  <span className={`${isActive(link.p) ? '' : 'opacity-50 group-hover:opacity-100 transition-opacity'}`}>
                    {link.i}
                  </span>
                  <span className="text-base tracking-tight">{link.n}</span>
                </Link>
              ))}
            </div>

          </div>

          {/* 3. FOOTER (Bottom Section) */}
          <div className="p-10 pt-6 mt-auto shrink-0 flex flex-col items-center">
            <div className="flex flex-col items-center gap-1 opacity-40 hover:opacity-100 transition-opacity group">
              <span className={`text-[9px] font-black uppercase tracking-[0.3em] ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>
                Developed By
              </span>
              <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Mehedi Hasan
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-8rem)] pb-16 md:pb-0">{children}</main>

      {/* Mobile Bottom Navigation */}
      <BottomNav onMenuClick={() => setIsMobileMenuOpen(true)} />

      {/* Footer - Professional - Only on Homepage */}
      {isActive('/') && (
        <footer className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white mt-auto border-t border-slate-700 pb-14 md:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-8">
              <div className="col-span-2 md:col-span-1">
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
              <div className="col-span-1">
                <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 text-slate-300">Quick Links</h4>
                <div className="space-y-2">
                  <Link to="/" className="block text-slate-400 hover:text-teal-400 text-sm transition">Home</Link>
                  <Link to="/tournaments" className="block text-slate-400 hover:text-teal-400 text-sm transition">Tournaments</Link>
                  <Link to="/players" className="block text-slate-400 hover:text-teal-400 text-sm transition">Players</Link>
                </div>
              </div>
              <div className="col-span-1">
                <h4 className="text-sm font-semibold uppercase tracking-wider mb-4 text-slate-300">Platform</h4>
                <div className="space-y-2">
                  <Link to="/champions" className="block text-slate-400 hover:text-teal-400 text-sm transition">Champions</Link>
                  <Link to="/squads" className="block text-slate-400 hover:text-teal-400 text-sm transition">Squads</Link>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-700 pt-6 text-center">
              <p className="text-slate-400 text-sm mb-1">
                © {new Date().getFullYear()} {schoolConfig.appFullName}. All rights reserved.
              </p>
              <div className="mt-2">
                <a
                  href="https://www.facebook.com/mehedihasan110571"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 text-xs hover:text-teal-500 transition-colors inline-flex items-center gap-1"
                >
                  Developed by <span className="font-bold text-slate-400">Mehedi Hasan</span>
                </a>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  )
}
