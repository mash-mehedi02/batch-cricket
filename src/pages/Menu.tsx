import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import {
    ChevronRight,
    User as UserIcon,
    ArrowLeft,
    Languages,
    Trophy,
    BarChart3,
    Settings,
    Moon,
    Bell,
    ShieldCheck,
    UserPlus,
    Users,
    User,
} from 'lucide-react';
import { useLanguageStore } from '@/store/languageStore';
import schoolConfig from '@/config/school';
import { useTranslation } from '@/hooks/useTranslation';

const CricketIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 8v12" />
        <path d="M12 8v12" />
        <path d="M16 8v12" />
        <path d="M7 8h10" />
        <path d="M20 4l-9 14" />
        <circle cx="6" cy="18" r="1.5" fill="currentColor" />
    </svg>
);

export default function MenuPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { isDarkMode, toggleDarkMode } = useThemeStore();
    const { language, setLanguage } = useLanguageStore();
    const { t } = useTranslation();
    const [vibration, setVibration] = useState(() => localStorage.getItem('match_vibration') === 'true');
    const [sound, setSound] = useState(() => localStorage.getItem('match_sound') === 'true');

    const toggleVibration = () => {
        const newVal = !vibration;
        setVibration(newVal);
        localStorage.setItem('match_vibration', String(newVal));
        if (newVal && 'vibrate' in navigator) navigator.vibrate(50);
        toast.success(`Score Vibration: ${newVal ? 'Enabled' : 'Disabled'}`);
    };

    const toggleSound = () => {
        const newVal = !sound;
        setSound(newVal);
        localStorage.setItem('match_sound', String(newVal));
        toast.success(`Sound Feedback: ${newVal ? 'Enabled' : 'Disabled'}`);
    };

    const handleProfileClick = () => {
        if (!user) {
            navigate('?login=true');
        } else {
            navigate('/account');
        }
    };

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'bn' : 'en');
    };

    const handlePremiumClick = () => {
        toast(t('premium_coming_soon'), {
            icon: '👑',
            style: {
                borderRadius: '12px',
                background: isDarkMode ? '#1e293b' : '#fff',
                color: isDarkMode ? '#fff' : '#0f172a',
                border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
            },
            duration: 3000,
        });
    };

    return (
        <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-[#0F172A]' : 'bg-[#F8FAFC]'}`}>
            {/* Header */}
            <div className={`safe-area-pt flex items-center gap-4 px-5 pt-4 pb-4 border-b ${isDarkMode ? 'border-slate-800 bg-[#1E293B]' : 'border-slate-100 bg-white'}`}>
                <button
                    onClick={() => navigate(-1)}
                    className={`p-2 -ml-2 rounded-full transition-all ${isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    <ArrowLeft size={24} />
                </button>
                <h1 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {t('menu_title')}
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
                {/* 1. Profile Section - Clickable to Edit Profile */}
                <button
                    onClick={handleProfileClick}
                    className={`w-full flex items-center justify-between px-5 py-6 border-b transition-colors ${isDarkMode ? 'border-slate-800 hover:bg-[#1e293b]' : 'border-slate-100 hover:bg-slate-50'}`}
                >
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 overflow-hidden shrink-0 border border-slate-200 dark:border-white/5">
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                            ) : (
                                <UserIcon size={24} strokeWidth={1.5} />
                            )}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <h3 className={`text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                {user ? user.displayName : 'Login or Sign-up'}
                            </h3>
                            <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                {user ? user.email : 'Ads free & manage your profile'}
                            </p>
                        </div>
                    </div>
                    {!user && <ChevronRight size={20} className="text-slate-300 shrink-0" />}
                </button>

                {/* 2. Premium Section */}
                <div className="px-5 py-4 border-b dark:border-slate-800">
                    <button
                        onClick={handlePremiumClick}
                        className="w-full relative overflow-hidden bg-gradient-to-r from-[#1a1a1a] via-[#2d2419] to-[#1a1a1a] rounded-2xl p-3.5 shadow-xl border border-white/5 group"
                    >
                        {/* Sparkle Decorations */}
                        <div className="absolute top-2 right-10 w-1 h-1 bg-white/20 rounded-full animate-pulse" />
                        <div className="absolute bottom-4 right-20 w-1 h-1 bg-white/40 rounded-full animate-pulse delay-700" />
                        <div className="absolute top-6 left-1/2 w-1 h-1 bg-white/30 rounded-full animate-pulse delay-300" />

                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 flex items-center justify-center shrink-0">
                                    <img src={schoolConfig.batchLogo} alt="Logo" className="w-full h-full object-contain" />
                                </div>
                                <div className="text-left">
                                    <h4 className="text-base font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 uppercase">
                                        {schoolConfig.appName.toUpperCase()}
                                    </h4>
                                </div>
                            </div>

                            <div className="bg-gradient-to-b from-[#b4905d] to-[#8c6d44] hover:from-[#c5a36e] hover:to-[#a17e52] px-4 py-2 rounded-xl border border-[#d4af37]/30 shadow-lg text-white text-[11px] font-black uppercase tracking-wider transition-all transform group-active:scale-95">
                                {t('menu_go_premium')}
                            </div>
                        </div>
                    </button>
                </div>

                {/* Main Navigation */}
                <div className="py-2">
                    {/* Rankings */}
                    <Link
                        to="/rankings"
                        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-blue-500">
                                <BarChart3 size={22} />
                            </div>
                            <span className="font-semibold text-[15px]">{t('nav_rankings')}</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-400" />
                    </Link>

                    {/* All Series */}
                    <Link
                        to="/tournaments"
                        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-amber-500">
                                <CricketIcon size={22} />
                            </div>
                            <span className="font-semibold text-[15px]">{t('nav_series')}</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-400" />
                    </Link>

                    {/* Champions */}
                    <Link
                        to="/champions"
                        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-yellow-500">
                                <Trophy size={22} className="fill-yellow-500/20" />
                            </div>
                            <span className="font-semibold text-[15px]">{t('nav_champions')}</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-400" />
                    </Link>

                    {/* Squads */}
                    <Link
                        to="/squads"
                        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-indigo-500">
                                <Users size={22} />
                            </div>
                            <span className="font-semibold text-[15px]">{t('nav_squads')}</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-400" />
                    </Link>

                    {/* Players */}
                    <Link
                        to="/players"
                        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-emerald-500">
                                <User size={22} />
                            </div>
                            <span className="font-semibold text-[15px]">{t('nav_players')}</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-400" />
                    </Link>

                    {/* Player Registration (Conditional) */}
                    {user && user.role !== 'player' && user.role !== 'admin' && user.role !== 'super_admin' && (
                        <Link
                            to="/register-player"
                            className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 flex items-center justify-center text-emerald-500">
                                    <UserPlus size={22} />
                                </div>
                                <span className="font-semibold text-[15px]">Player Enrollment</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Join</span>
                                <ChevronRight size={18} className="text-slate-400" />
                            </div>
                        </Link>
                    )}
                </div>

                {/* APP SETTINGS Section */}
                <div className={`mt-2 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t('menu_app_settings')}
                </div>

                <div className={`border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    {/* Match Settings */}
                    <button
                        onClick={toggleVibration}
                        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-slate-500">
                                <Settings size={22} />
                            </div>
                            <div className="text-left">
                                <span className="font-semibold text-[15px] block">{t('menu_match_settings')}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Vibration: {vibration ? 'ON' : 'OFF'}</span>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-400" />
                    </button>

                    {/* App Theme */}
                    <button
                        onClick={toggleDarkMode}
                        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-slate-500">
                                <Moon size={22} />
                            </div>
                            <span className="font-semibold text-[15px]">{t('menu_app_theme')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold opacity-40 uppercase">{isDarkMode ? t('theme_dark') : t('theme_light')}</span>
                            <ChevronRight size={18} className="text-slate-400" />
                        </div>
                    </button>

                    {/* Notification Settings */}
                    <button
                        onClick={toggleSound}
                        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-slate-500">
                                <Bell size={22} />
                            </div>
                            <div className="text-left">
                                <span className="font-semibold text-[15px] block">{t('menu_notifications')}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Sound: {sound ? 'ON' : 'OFF'}</span>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-400" />
                    </button>

                    {/* Languages */}
                    <button
                        onClick={toggleLanguage}
                        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-slate-500">
                                <Languages size={22} />
                            </div>
                            <span className="font-semibold text-[15px]">{t('menu_languages')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold opacity-40 uppercase">
                                {language === 'en' ? 'English' : 'বাংলা'}
                            </span>
                            <ChevronRight size={18} className="text-slate-400" />
                        </div>
                    </button>


                    {/* Terms & Privacy Policy */}
                    <Link
                        to="/terms"
                        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-teal-500">
                                <ShieldCheck size={22} />
                            </div>
                            <span className="font-semibold text-[15px]">{t('menu_terms_privacy')}</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-400" />
                    </Link>

                </div>

                {/* Credits */}
                <div className="p-10 flex flex-col items-center gap-2 opacity-30 select-none">
                    <img src={schoolConfig.batchLogo} className="w-8 h-8 grayscale contrast-125 mb-1" alt="" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">{schoolConfig.appName}</span>
                    <span className="text-[9px] font-bold italic tracking-wider">v2.1.5-beta</span>
                </div>
            </div>

        </div>
    );
}
