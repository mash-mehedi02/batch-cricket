/**
 * Main Layout Component
 * Wrapper for all pages with navigation
 */

import React, { ReactNode } from 'react'
import BottomNav from './common/BottomNav'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import schoolConfig from '@/config/school'
import schoolLogo from '@/assets/logo-final.png'
import { Search, Command } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import GlobalLoginSheet from './common/GlobalLoginSheet'
import TournamentCountdownPopup from './common/TournamentCountdownPopup'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  // Layout logic

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
  const isMenuPage = location.pathname === '/menu' || location.pathname === '/account'
  const isHome = location.pathname === '/'

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDetailPage ? 'bg-[#060b16]' : 'bg-slate-50 dark:bg-[#060b16]'}`}>
      <Toaster position="bottom-center" toastOptions={{ duration: 3000 }} />
      <GlobalLoginSheet />
      <TournamentCountdownPopup />
      {/* Navigation - Professional Header - Hidden on Detail Pages & Menu Page */}
      {!isDetailPage && !isMenuPage && (
        <nav className={`z-50 backdrop-blur-xl border-b sticky top-0 transition-colors duration-300 ${isHome
          ? 'bg-[#0f172a]/95 text-white border-white/5'
          : 'bg-white/90 dark:bg-[#060b16]/90 text-slate-900 dark:text-white border-slate-100 dark:border-white/5'
          }`}>
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 pt-[var(--status-bar-height)]">
            <div className="flex justify-between items-center h-14">
              <div className="flex items-center gap-4 md:gap-10 min-w-0 flex-1">
                <Link to="/" className="flex items-center gap-1 group shrink-0 min-w-0">
                  <img src={schoolLogo} alt="Logo" className="h-8 sm:h-10 w-auto object-contain shrink-0 transition-transform group-hover:scale-105" />
                  <span className="text-sm sm:text-xl md:text-2xl font-black bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent truncate tracking-tight">
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
                      <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-black border ${isHome ? 'bg-black/20 border-white/10 text-slate-400' : 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-500 border-slate-300 dark:border-white/5'}`}>
                        <Command className="w-2.5 h-2.5" />
                        <span>K</span>
                      </div>
                    </div>
                  </div>
                </div>



                {/* Mobile Menu Button */}
                <Link
                  to="/menu"
                  className={`md:hidden p-2 rounded-lg transition-colors ${isHome ? 'text-slate-300 hover:text-white hover:bg-white/10' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

        </nav>
      )}

      {/* Main Content */}
      <main className="min-h-[calc(100vh-8rem)] pb-16 md:pb-0">{children}</main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Footer - Professional - Only on Homepage */}
      {
        isActive('/') && (
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
        )
      }
    </div >
  )
}
