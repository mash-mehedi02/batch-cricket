/**
 * Login Page
 * User authentication page
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, login, loading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (user && !loading) {
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect');
      const from = redirect || (location.state as any)?.from?.pathname || '/admin';
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Logic: If user enters just a username (no @), append a default domain
      const finalEmail = email.includes('@') ? email : `${email.trim().toLowerCase()}@batchcrick.bd`;

      await login(finalEmail, password)
      toast.success('Login successful!')
      const params = new URLSearchParams(location.search);
      const redirect = params.get('redirect');
      const from = redirect || (location.state as any)?.from?.pathname || '/admin';
      navigate(from, { replace: true })
    } catch (error: any) {
      if (error?.code === 'auth/network-request-failed') {
        toast.error(
          'Network Error! দয়া করে ইন্টারনেট কানেকশন চেক করুন। Proxy বা VPN থাকলে বন্ধ করে চেষ্টা করুন।'
        )
      } else if (error?.code === 'auth/invalid-credential') {
        toast.error(
          <div>
            <p className="font-semibold text-red-600">❌ Incorrect Login Info</p>
            <p className="text-sm mt-1">আপনার Username অথবা Password সঠিক নয়। দয়া করে আবার চেক করুন।</p>
          </div>
        )
      } else if (error?.code === 'auth/too-many-requests') {
        toast.error(
          <div>
            <p className="font-semibold text-amber-600">⏳ Account Temporarily Locked</p>
            <p className="text-sm mt-1">অনেকবার ভুল চেষ্টা করার জন্য একাউন্ট ব্লক করা হয়েছে। দয়া করে ৫-১০ মিনিট পর চেষ্টা করুন।</p>
          </div>
        )
      } else if (error?.code === 'auth/user-not-found') {
        toast.error('User found না। দয়া করে সঠিক Username দিন।')
      } else if (error?.code === 'auth/wrong-password') {
        toast.error('Password ভুল। দয়া করে সঠিক পাসওয়ার্ড দিন।')
      } else {
        toast.error(error.message || 'Login failed. Please check your credentials.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 border border-gray-200">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-teal-600 to-teal-700 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">BC</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Login</h1>
          <p className="text-gray-600">Sign in to access the admin panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Username / Email
            </label>
            <input
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              placeholder="e.g. admin"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
              placeholder="Enter your password"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-teal-700 hover:to-emerald-700 transition-all shadow-lg shadow-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don't have an account?{' '}
            <a href="mailto:mehedihasan110571@gmail.com.com" className="text-teal-600 hover:text-teal-700 font-semibold">
              Contact Administrator
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

