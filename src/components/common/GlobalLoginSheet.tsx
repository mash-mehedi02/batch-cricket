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
                    <div className="relative w-full max-w-sm">
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className={`${isDarkMode ? 'bg-[#1e293b]' : 'bg-white'} rounded-t-[2rem] p-6 pb-10 shadow-2xl flex flex-col items-center safe-area-pb`}
                        >
                            {/* Drag Handle */}
                            <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mb-5 -mt-2 opacity-50" />

                            {/* Close Button */}
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-5 right-6 p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-transform active:scale-90"
                            >
                                <X size={18} />
                            </button>

                            {/* Illustration Mockup */}
                            <div className="flex items-center justify-center gap-1.5 mb-6 mt-2 scale-90">
                                <div className="w-10 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-lg shadow-lg -rotate-6">🏏</div>
                                <div className="w-12 h-14 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-2xl shadow-xl z-10 border-2 border-white dark:border-slate-700">🏆</div>
                                <div className="w-10 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-lg shadow-lg rotate-6">🌟</div>
                            </div>

                            <h2 className={`text-xl font-black text-center mb-2 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                Maximise your {schoolConfig.appName}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-center text-[13px] font-medium leading-relaxed max-w-[280px] mb-8">
                                Log in to personalise your experience and stay updated on your teams.
                            </p>

                            {/* Google Button */}
                            <button
                                onClick={async () => {
                                    try {
                                        await googleLogin();
                                        setIsOpen(false);
                                        toast.success('Signed in successfully!');
                                    } catch (err) {

                                        console.error(err);
                                        toast.error('Failed to sign in.');
                                    }
                                }}
                                className="w-full max-w-[300px] flex items-center justify-center gap-3 bg-black dark:bg-white text-white dark:text-black py-3.5 px-6 rounded-xl font-bold transition-transform active:scale-95 shadow-xl"
                            >
                                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                                <span className="text-sm">Continue with Google</span>
                            </button>

                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    navigate('/admin/auth?admin=true');
                                }}
                                className="mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-500 transition-colors"
                            >
                                Administrative Login
                            </button>

                            {/* Footer Links */}
                            <p className="mt-6 text-[10px] text-slate-400 dark:text-slate-500 text-center leading-relaxed max-w-[250px]">
                                By continuing, you agree to our <Link to="/terms" className="underline font-bold text-slate-500">Terms</Link> & <Link to="/privacy" className="underline font-bold text-slate-500">Privacy</Link>.
                            </p>
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}
