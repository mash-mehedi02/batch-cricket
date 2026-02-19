/**
 * Login & Profile Setup Page
 * Simplifies authentication with Google Sign-In for players,
 * and standard Email/Password login for Admins.
 */

import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import schoolConfig from '@/config/school'
import { User, Shield, ChevronRight, Lock, Mail, Camera, X, Upload } from 'lucide-react'
import Cropper from 'react-easy-crop'
import { getCroppedImg } from '@/utils/cropImage'
import { uploadImage } from '@/services/cloudinary/uploader'
import { squadService } from '@/services/firestore/squads'
import { playerRequestService } from '@/services/firestore/playerRequests'
import { Squad } from '@/types'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, googleLogin, login, signup, resetPassword, updatePlayerProfile, loading } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [showProfileSetup, setShowProfileSetup] = useState(false)
  const [isPendingApproval, setIsPendingApproval] = useState(false)
  const [squads, setSquads] = useState<Squad[]>([])

  const handlePasswordReset = async () => {
    if (!email) {
      toast.error("Enter your email first!");
      return;
    }
    try {
      await resetPassword(email);
      toast.success("Password reset email sent!");
    } catch (e: any) {
      toast.error(e.message);
    }
  }
  const [useEmail, setUseEmail] = useState(false) // Toggle for Email Form
  const [isSignUp, setIsSignUp] = useState(false) // Toggle for Login vs Signup

  // Check if we are logging in for Admin Context
  const params = new URLSearchParams(location.search);
  const redirectPath = params.get('redirect') || '';
  const isAdminLogin = redirectPath.includes('admin') || location.pathname.includes('admin') || params.get('admin') === 'true';

  // Input States
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Check login status and profile completeness
  useEffect(() => {
    if (user && !loading && !isLoading) {
      const isAdmin = user.role === 'admin' || user.role === 'super_admin';
      const forceSetup = params.get('setup') === 'true';
      const hasProfile = (user as any).playerProfile;

      if (hasProfile || isAdmin) {
        if (forceSetup) {
          // Editing existing profile
          console.log("[Login] Force Setup Mode: Pre-filling data...");
          const pp = (user as any).playerProfile || {};
          setName(user.displayName || pp.name || '');
          if (pp.role) setRole(pp.role);
          if (pp.battingStyle) setBattingStyle(pp.battingStyle);
          if (pp.bowlingStyle) setBowlingStyle(pp.bowlingStyle);
          if (pp.dateOfBirth) setDob(pp.dateOfBirth);
          if (pp.school) setSchool(pp.school);
          if (pp.address) setAddress(pp.address);
          if (pp.photoUrl || pp.photo) setPhotoUrl(pp.photoUrl || pp.photo);
          setShowProfileSetup(true);
        } else {
          // Regular login redirect
          const redirect = params.get('redirect')
          const from = redirect || (location.state as any)?.from?.pathname || (isAdmin ? '/admin' : '/')
          console.log("[Login] User ready. Redirecting to:", from);
          navigate(from, { replace: true })
        }
      } else {
        // Profile missing AND not an admin
        console.log("[Login] Profile missing or incomplete. Checking for pending request...");
        if (user.displayName) setName(user.displayName)

        // Check for existing pending request BEFORE showing setup form
        playerRequestService.getUserRequest(user.uid).then(req => {
          if (req && req.status === 'pending') {
            console.log("[Login] Found pending request. Showing pending UI.");
            setIsPendingApproval(true)
          } else {
            console.log("[Login] No pending request. Showing Setup.");
            toast("Please complete your profile details.", { icon: '📝', id: 'profile-hint' });
            setShowProfileSetup(true)
          }
        }).catch(() => {
          // If check fails, still show setup
          toast("Please complete your profile details.", { icon: '📝', id: 'profile-hint' });
          setShowProfileSetup(true)
        })

        const autoFill = (user as any).autoFillProfile;
        if (autoFill) {
          console.log("[Login] Auto-filling from linked profile:", autoFill.name);
          if (autoFill.name) setName(autoFill.name);
          if (autoFill.role) setRole(autoFill.role);
          if (autoFill.battingStyle) setBattingStyle(autoFill.battingStyle);
          if (autoFill.bowlingStyle) setBowlingStyle(autoFill.bowlingStyle);
          if (autoFill.dateOfBirth) setDob(autoFill.dateOfBirth);
          if (autoFill.school) setSchool(autoFill.school);
          if (autoFill.address) setAddress(autoFill.address);
          if (autoFill.photoUrl) setPhotoUrl(autoFill.photoUrl);
        }
      }
    }
  }, [user, loading, navigate, location, isLoading, params.get('setup')])

  // Fetch Squads for Registration
  useEffect(() => {
    if (showProfileSetup) {
      squadService.getAll().then(setSquads).catch(console.error)
    }
  }, [showProfileSetup])

  // Profile Form State
  const [name, setName] = useState('')
  const [role, setRole] = useState('All Rounder')
  const [battingStyle, setBattingStyle] = useState('Right Hand')
  const [bowlingStyle, setBowlingStyle] = useState('Right Arm Fast')
  const [dob, setDob] = useState('')
  const [school, setSchool] = useState('')
  const [batch, setBatch] = useState('')
  const [squadId, setSquadId] = useState('')
  const [address, setAddress] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')

  // Cropper State
  const [imageFile, setImageFile] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [isCropping, setIsCropping] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const onCropComplete = (_croppedArea: any, pixelCrop: any) => {
    setCroppedAreaPixels(pixelCrop)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setImageFile(reader.result as string)
        setIsCropping(true)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCropSave = async () => {
    if (!imageFile || !croppedAreaPixels) return
    setIsUploading(true)
    try {
      const croppedImageBlob = await getCroppedImg(imageFile, croppedAreaPixels)
      if (croppedImageBlob) {
        const file = new File([croppedImageBlob], 'profile.jpg', { type: 'image/jpeg' })
        const url = await uploadImage(file, (p) => console.log(`Upload: ${p}%`))
        setPhotoUrl(url)
        toast.success('Photo uploaded!')
      }
    } catch (err) {
      console.error('Crop save error:', err)
      toast.error('Failed to process image')
    } finally {
      setIsUploading(false)
      setIsCropping(false)
      setImageFile(null)
    }
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true)
    console.log("[Login] Starting Google Login...");

    // Safety timeout: Reset loading state if redirect is blocked or takes too long
    const timeout = setTimeout(() => {
      setIsLoading(false);
      console.warn("[Login] Google login timeout reached. User might be blocked by browser.");
    }, 5000);

    try {
      await googleLogin();
    } catch (error: any) {
      clearTimeout(timeout);
      toast.error('Google Sign-In failed: ' + (error.message || 'Unknown error'))
      console.error(error)
      setIsLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isSignUp) {
        // Register
        await signup(email, password, {
          name: name || email.split('@')[0],
          role: 'All Rounder', // Defaults, user will confirm in next step
          battingStyle: 'Right Hand',
          bowlingStyle: 'None'
        });
        toast.success("Account created! Please complete your profile.");
      } else {
        // Login
        await login(email, password);
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error("Account already exists! Please Login.", { duration: 5000 });
        toast("Tip: Use 'Forgot Password' if you signed up with Google.", { icon: '💡', duration: 6000 });
        setIsSignUp(false); // Switch to Login mode
        return;
      }
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        toast.error("Incorrect Password!");
        toast("Tip: Click 'Forgot Password?' to set a new one.", { icon: '🔑', duration: 6000 });
      } else {
        toast.error(`Authentication Failed: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      // Effect will handle redirect
    } catch (error: any) {
      toast.error('Admin Login failed: ' + (error.message || 'Check credentials'));
    } finally {
      setIsLoading(false);
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!squadId) {
      toast.error('Please select a squad!')
      return
    }

    setIsLoading(true)
    try {
      const selectedSquad = squads.find(s => s.id === squadId)

      // 1. Submit Player Request
      await playerRequestService.submitRequest({
        uid: user.uid,
        email: user.email || '',
        name: name,
        school: school,
        squadId: squadId,
        squadName: selectedSquad?.name || 'Unknown',
        batch: batch,
        role: role as any,
        battingStyle: battingStyle as any,
        bowlingStyle: bowlingStyle as any,
        photoUrl: photoUrl
      })

      // 2. We don't call updatePlayerProfile yet (which sets isRegisteredPlayer: true)
      // because we want the admin to approve it first.

      toast.success('Registration request submitted!')
      setIsPendingApproval(true)
    } catch (error: any) {
      console.error('[Login] Profile Update Error:', error);
      if (error.message && error.message.includes('already have a pending')) {
        toast('Request already pending.', { icon: '⏳' });
        setIsPendingApproval(true);
      } else {
        toast.error('Failed to submit: ' + error.message)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center px-4 py-8 sm:px-6 lg:px-8">

      {/* HEADER LOGO */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-10">
        <div className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-xl mb-6 transform rotate-3 hover:rotate-0 transition-transform duration-500`}>
          <img src={schoolConfig.batchLogo} alt="Logo" className="w-12 h-12 object-contain brightness-0 invert" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          {schoolConfig.appName}
        </h2>
        <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
          The correct place for cricket stats
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none sm:rounded-3xl border border-slate-100 dark:border-slate-800">

          {isPendingApproval ? (
            <div className="text-center py-8 space-y-6">
              <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto text-amber-600 animate-pulse">
                <Shield className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic">Request Pending</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                  Your player registration has been submitted to the admin for review.
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl text-sm text-slate-600 dark:text-slate-400 font-bold border border-slate-100 dark:border-slate-800">
                You can still use the app as a viewer while you wait.
              </div>
              <button
                onClick={() => navigate('/')}
                className="w-full py-4 bg-slate-900 dark:bg-slate-700 text-white font-black rounded-xl hover:bg-slate-800 transition-all uppercase tracking-widest text-sm"
              >
                Go to Home
              </button>
            </div>
          ) : !showProfileSetup ? (
            <>
              {isAdminLogin ? (
                /* ADMIN EMAIL LOGIN FORM */
                <form onSubmit={handleAdminLogin} className="space-y-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Sign In</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Enter your credentials to access your account.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Email Address</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 dark:text-white placeholder-slate-400"
                        placeholder="admin@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 dark:text-white placeholder-slate-400"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl shadow-lg border-transparent text-sm font-black uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    {isLoading ? 'Verifying...' : 'Sign In'}
                  </button>

                  {/* Fallback to Google for Admins who use it */}
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white dark:bg-slate-900 text-slate-500">Or continue with</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                    Google
                  </button>

                </form>
              ) : (
                /* PLAYER GOOGLE LOGIN (Existing) */
                <div className="space-y-6">
                  {/* Google Login Section */}
                  <div className="text-center">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Your Profile</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                      Join the league to track your stats.
                    </p>
                  </div>

                  <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                        <span>Continue with Google</span>
                      </>
                    )}
                  </button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <button
                        onClick={() => setUseEmail(!useEmail)}
                        className="px-2 bg-white dark:bg-slate-900 text-slate-500 hover:text-blue-600 transition-colors font-semibold"
                      >
                        {useEmail ? 'Back to Google' : 'Or use Email & Password'}
                      </button>
                    </div>
                  </div>

                  {useEmail && (
                    <form onSubmit={handleEmailAuth} className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                      {isSignUp && (
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5 float-left">Name</label>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-900 dark:text-white"
                            placeholder="Your Name"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5 float-left">Email</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-900 dark:text-white"
                          placeholder="you@example.com"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Password</label>
                          {!isSignUp && (
                            <button type="button" onClick={handlePasswordReset} className="text-xs font-bold text-teal-600 hover:text-teal-500">
                              Forgot Password?
                            </button>
                          )}
                        </div>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-900 dark:text-white"
                          placeholder="••••••••"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3.5 px-4 rounded-xl shadow-lg text-sm font-black uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 transition-all"
                      >
                        {isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                      </button>

                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => setIsSignUp(!isSignUp)}
                          className="text-xs font-bold text-teal-600 hover:text-teal-500"
                        >
                          {isSignUp ? 'Already have an account? Login' : 'Need an account? Register'}
                        </button>
                      </div>
                    </form>
                  )}

                  {!useEmail && (
                    <div className="text-center">
                      <p className="text-xs text-slate-400">
                        Terms of Service and Privacy Policy apply.
                      </p>
                    </div>
                  )}
                </div>

              )}
            </>
          ) : (
            /* STEP 2: PROFILE SETUP (Password-less, just details) */
            <form className="space-y-5" onSubmit={handleProfileSubmit}>
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto mb-3 text-teal-600 dark:text-teal-400">
                  <User size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Complete Your Profile</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  One last step! Tell us about your cricketing role.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                  placeholder="e.g. Shakib Al Hasan"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">School / Academy</label>
                <input
                  type="text"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                  placeholder="e.g. BatchCrick High"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Squad</label>
                  <div className="relative">
                    <select
                      required
                      value={squadId}
                      onChange={(e) => setSquadId(e.target.value)}
                      className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-900 dark:text-white appearance-none cursor-pointer"
                    >
                      <option value="">Select Squad</option>
                      {squads.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.batch})</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronRight size={16} className="rotate-90" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Batch</label>
                  <input
                    type="text"
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-900 dark:text-white placeholder-slate-400"
                    placeholder="e.g. 2006"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Role</label>
                  <div className="relative">
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-900 dark:text-white appearance-none cursor-pointer"
                    >
                      <option>Bits & Pieces</option>
                      <option>Batsman</option>
                      <option>Bowler</option>
                      <option>All Rounder</option>
                      <option>Wicket Keeper</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronRight size={16} className="rotate-90" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-900 dark:text-white placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Batting</label>
                  <div className="relative">
                    <select
                      value={battingStyle}
                      onChange={(e) => setBattingStyle(e.target.value)}
                      className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-900 dark:text-white appearance-none cursor-pointer"
                    >
                      <option>Right Hand</option>
                      <option>Left Hand</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronRight size={16} className="rotate-90" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Bowling</label>
                  <div className="relative">
                    <select
                      value={bowlingStyle}
                      onChange={(e) => setBowlingStyle(e.target.value)}
                      className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-900 dark:text-white appearance-none cursor-pointer"
                    >
                      <option>Right Arm Fast</option>
                      <option>Right Arm Medium</option>
                      <option>Right Arm Spin</option>
                      <option>Left Arm Fast</option>
                      <option>Left Arm Spin</option>
                      <option>None</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronRight size={16} className="rotate-90" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Residential Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="block w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-900 dark:text-white placeholder-slate-400 transition-all"
                  placeholder="e.g. Dhaka, Bangladesh"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Profile Photo</label>
                <div className="flex flex-col items-center gap-4 bg-slate-50 dark:bg-slate-800 p-6 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                  {photoUrl ? (
                    <div className="relative">
                      <img src={photoUrl} className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-slate-900 shadow-md" />
                      <button
                        type="button"
                        onClick={() => setPhotoUrl('')}
                        className="absolute -top-2 -right-2 p-1 bg-rose-500 text-white rounded-full shadow-lg"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-slate-300">
                      <Camera size={32} />
                    </div>
                  )}

                  <label className="cursor-pointer">
                    <span className="px-6 py-2 bg-slate-900 dark:bg-slate-700 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2">
                      <Upload size={14} />
                      {photoUrl ? 'Change Photo' : 'Upload Photo'}
                    </span>
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              {/* CROPER MODAL */}
              {isCropping && (
                <div className="fixed inset-0 z-[1000] bg-slate-900 flex flex-col items-center justify-center p-4">
                  <div className="relative w-full aspect-square max-w-sm bg-black rounded-3xl overflow-hidden shadow-2xl">
                    <Cropper
                      image={imageFile || ''}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onCropComplete={onCropComplete}
                      onZoomChange={setZoom}
                      cropShape="round"
                      showGrid={false}
                    />
                  </div>

                  <div className="mt-8 w-full max-w-sm space-y-6">
                    <div className="px-4">
                      <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        aria-labelledby="Zoom"
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>

                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setIsCropping(false)}
                        className="flex-1 py-4 bg-white/10 text-white font-bold rounded-2xl hover:bg-white/20 transition-all uppercase tracking-widest text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCropSave}
                        disabled={isUploading}
                        className="flex-[2] py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-500 transition-all uppercase tracking-widest text-xs shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                      >
                        {isUploading ? 'Uploading...' : 'Done & Save'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center py-4 px-4 rounded-xl shadow-lg border-transparent text-sm font-black uppercase tracking-wider text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 mt-4"
              >
                {isLoading ? 'Saving...' : 'Finish Setup'}
              </button>

              {params.get('setup') === 'true' && (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full py-2 text-center text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 mt-2 transition-colors uppercase tracking-widest"
                >
                  Cancel & Go Home
                </button>
              )}
            </form>
          )}

        </div>



      </div>
    </div>
  )
}
