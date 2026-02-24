import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import schoolConfig from '@/config/school';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useEffect, useState } from 'react';

export default function GlobalLoginSheet() {
    const { user, googleLogin } = useAuthStore();
    const { isDarkMode } = useThemeStore();
    const location = useLocation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);

    // Trigger open based on URL param or local state
    useEffect(() => {
        const params = new URLSearchParams(location.search);

        if (params.get('login') === 'true') {
            setIsOpen(true);

            // Clean up the URL
            const newParams = new URLSearchParams(location.search);
            newParams.delete('login');
            const search = newParams.toString();
            navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
        }
    }, [location.search, navigate, location.pathname]);

    // Close if user logged in
    useEffect(() => {
        if (user && isOpen) {
            setIsOpen(false);
        }
    }, [user, isOpen]);

    if (user) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Sheet Container for sizing */}
                    <div className="relative w-full max-w-lg">
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className={`${isDarkMode ? 'bg-[#1e293b]' : 'bg-white'} rounded-t-[2.5rem] p-8 pb-12 shadow-2xl flex flex-col items-center safe-area-pb`}
                        >
                            {/* Drag Handle */}
                            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mb-6 -mt-2 opacity-50" />

                            {/* Close Button */}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-6 right-8 p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-transform active:scale-90"
                            >
                                <X size={20} />
                            </button>

                            {/* Illustration Mockup */}
                            <div className="flex items-center justify-center gap-2 mb-8 mt-4 scale-110">
                                <div className="w-12 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-xl shadow-lg -rotate-6">🏏</div>
                                <div className="w-14 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-3xl shadow-xl z-10 border-2 border-white dark:border-slate-700">🏆</div>
                                <div className="w-12 h-14 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-xl shadow-lg rotate-6">🌟</div>
                            </div>

                            <h2 className={`text-2xl font-black text-center mb-3 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                Maximise your {schoolConfig.appName} experience
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-center text-sm font-medium leading-relaxed max-w-xs mb-10">
                                Log in with Google to personalise your {schoolConfig.appName} experience and stay updated on your favourite teams, series, and more.
                            </p>

                            {/* Google Button */}
                            <button
                                onClick={async () => {
                                    try {
                                        const isNewUser = await googleLogin();
                                        setIsOpen(false);
                                        toast.success('Signed in successfully!');

                                        if (isNewUser) {
                                            navigate('/edit-profile');
                                        }
                                        // If not new, we stay on the current page (e.g. /menu)
                                    } catch (err) {
                                        console.error(err);
                                        toast.error('Failed to sign in.');
                                    }
                                }}
                                className="w-full max-w-sm flex items-center justify-center gap-3 bg-black dark:bg-white text-white dark:text-black py-4 px-6 rounded-2xl font-bold transition-transform active:scale-95 shadow-xl"
                            >
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
                                <span>Continue with Google</span>
                            </button>

                            {/* Footer Links */}
                            <p className="mt-8 text-[11px] text-slate-400 dark:text-slate-500 text-center leading-relaxed max-w-sm">
                                By continuing, you agree to our <Link to="/terms" className="underline font-bold text-slate-500">Terms of Service</Link> and <Link to="/privacy" className="underline font-bold text-slate-500">Privacy Policy</Link>.
                            </p>
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}
