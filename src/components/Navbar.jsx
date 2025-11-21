import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useFirebase } from '../contexts/FirebaseContext'

const Navbar = () => {
  const location = useLocation()
  const { currentAdmin } = useFirebase()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  const isAdminPath = () => {
    return location.pathname.startsWith('/admin') || 
           location.pathname.startsWith('/tournaments') ||
           location.pathname.startsWith('/squads') ||
           location.pathname.startsWith('/players') ||
           location.pathname.startsWith('/matches')
  }

  // Public navigation links
  const publicNavLinks = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/schedule', label: 'Schedule', icon: '📅' },
    { path: '/squad', label: 'Squad', icon: '👥' },
    { path: '/champions', label: 'Champions', icon: '🏆' },
  ]

  // Admin navigation links (shown when logged in)
  const adminNavLinks = [
    { path: '/admin/dashboard', label: 'Dashboard', icon: '⚙️' },
    { path: '/admin', label: 'Live Score', icon: '⚡' },
  ]

  const allNavLinks = currentAdmin 
    ? [...publicNavLinks, ...adminNavLinks]
    : publicNavLinks

  return (
    <nav className={`${isAdminPath() ? 'bg-gray-800' : 'bg-teal-600'} text-white shadow-lg sticky top-0 z-50`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2 hover:opacity-90 transition-opacity">
            <div className="text-xl sm:text-2xl font-bold">🏏 School Cricket</div>
          </Link>
          
          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1">
            {publicNavLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(link.path)
                    ? isAdminPath() 
                      ? 'bg-gray-700 text-white' 
                      : 'bg-teal-500 text-white'
                    : 'hover:bg-opacity-80 hover:bg-white hover:bg-opacity-10'
                }`}
              >
                <span className="hidden xl:inline">{link.icon} </span>
                {link.label}
              </Link>
            ))}

            {/* Admin Links Separator */}
            {currentAdmin && (
              <>
                <div className="h-6 w-px bg-white bg-opacity-30 mx-2"></div>
                {adminNavLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(link.path)
                        ? 'bg-gray-700 text-white'
                        : 'hover:bg-opacity-80 hover:bg-white hover:bg-opacity-10'
                    }`}
                  >
                    <span className="hidden xl:inline">{link.icon} </span>
                    {link.label}
                  </Link>
                ))}
              </>
            )}

            {/* Admin Login Link */}
            {!currentAdmin && (
              <Link
                to="/admin"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive('/admin')
                    ? 'bg-white text-cricbuzz-green'
                    : 'hover:bg-opacity-80 hover:bg-white hover:bg-opacity-10'
                }`}
              >
                🔐 Admin
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white hover:text-gray-200 focus:outline-none p-2 -mr-2"
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white border-opacity-20">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {/* Public Links */}
              {publicNavLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    isActive(link.path)
                      ? isAdminPath()
                        ? 'bg-gray-700 text-white'
                        : 'bg-white text-cricbuzz-green'
                      : 'text-white hover:bg-opacity-10 hover:bg-white'
                  }`}
                >
                  <span className="mr-2">{link.icon}</span>
                  {link.label}
                </Link>
              ))}

              {/* Admin Links Separator */}
              {currentAdmin && (
                <>
                  <div className="h-px bg-white bg-opacity-20 my-2"></div>
                  <div className="px-3 py-2 text-xs font-semibold text-white text-opacity-70 uppercase">
                    Admin Panel
                  </div>
                  {adminNavLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                        isActive(link.path)
                          ? 'bg-gray-700 text-white'
                          : 'text-white hover:bg-opacity-10 hover:bg-white'
                      }`}
                    >
                      <span className="mr-2">{link.icon}</span>
                      {link.label}
                    </Link>
                  ))}
                </>
              )}

              {/* Admin Login Link */}
              {!currentAdmin && (
                <>
                  <div className="h-px bg-white bg-opacity-20 my-2"></div>
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                      isActive('/admin')
                        ? 'bg-white text-cricbuzz-green'
                        : 'text-white hover:bg-opacity-10 hover:bg-white'
                    }`}
                  >
                    <span className="mr-2">🔐</span>
                    Admin Login
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar
