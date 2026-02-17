
import { useNavigate, Link } from 'react-router-dom';
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
    AlertCircle,
    ShieldCheck,
    Handshake,
    UserPlus,
    LayoutDashboard
} from 'lucide-react';
import { useLanguageStore } from '@/store/languageStore';
import schoolConfig from '@/config/school';
import { useTranslation } from '@/hooks/useTranslation';

export default function MenuPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { isDarkMode, toggleDarkMode } = useThemeStore();
    const { language, setLanguage } = useLanguageStore();
    const { t } = useTranslation();

    const handleProfileClick = () => {
        navigate('/account');
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
                    className={`w-full flex items-center justify-between px-5 py-4 border-b transition-colors ${isDarkMode ? 'border-slate-800 hover:bg-[#1e293b]' : 'border-slate-100 hover:bg-slate-50'}`}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-white text-xl font-bold overflow-hidden shrink-0">
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
                            ) : (
                                <div className="bg-teal-500 w-full h-full flex items-center justify-center">
                                    {user?.displayName?.charAt(0).toUpperCase() || <UserIcon size={24} />}
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <h3 className={`text-lg font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                {user?.displayName || 'Cricket Fan'}
                            </h3>
                            <p className={`text-sm truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {user?.email || t('menu_profile_login')}
                            </p>
                        </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-400 shrink-0" />
                </button>

                {/* 2. Premium + Main Navigation Links */}
                <div className={`border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    {/* Premium Badge */}
                    <button
                        onClick={handlePremiumClick}
                        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'hover:bg-[#1e293b]' : 'hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                                <img src={schoolConfig.batchLogo} alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <div className="flex items-center gap-3">
                                <span className={`font-bold text-[15px] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{schoolConfig.appName}</span>
                                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/10 text-[10px] font-black text-amber-600 dark:text-amber-500 rounded uppercase tracking-tight border border-amber-200 dark:border-amber-500/20">
                                    {t('menu_go_premium')}
                                </span>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-400" />
                    </button>

                    {/* Rankings */}
                    <Link
                        to="/players"
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
                                <Trophy size={22} />
                            </div>
                            <span className="font-semibold text-[15px]">{t('nav_series')}</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-400" />
                    </Link>

                    {/* Admin Dashboard (Conditional) */}
                    {user && (user.role === 'admin' || user.role === 'super_admin') && (
                        <Link
                            to="/admin"
                            className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 flex items-center justify-center text-rose-500">
                                    <LayoutDashboard size={22} />
                                </div>
                                <span className="font-semibold text-[15px]">Admin Dashboard</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest px-2 py-0.5 bg-rose-50 dark:bg-rose-900/20 rounded">Panel</span>
                                <ChevronRight size={18} className="text-slate-400" />
                            </div>
                        </Link>
                    )}

                    {/* Player Registration (Conditional) */}
                    {user && !user.isRegisteredPlayer && user.role !== 'admin' && user.role !== 'super_admin' && (
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

                {/* 3. APP SETTINGS Section */}
                <div className={`mt-2 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t('menu_app_settings')}
                </div>

                <div className={`border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    {/* Match Settings */}
                    <button className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-slate-500">
                                <Settings size={22} />
                            </div>
                            <span className="font-semibold text-[15px]">{t('menu_match_settings')}</span>
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
                    <button className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-slate-500">
                                <Bell size={22} />
                            </div>
                            <span className="font-semibold text-[15px]">{t('menu_notifications')}</span>
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

                    {/* Report a Problem */}
                    <button className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-red-400">
                                <AlertCircle size={22} />
                            </div>
                            <span className="font-semibold text-[15px]">{t('menu_report_problem')}</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-400" />
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

                    {/* Partner with us */}
                    <button className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-purple-500">
                                <Handshake size={22} />
                            </div>
                            <span className="font-semibold text-[15px]">{t('menu_partner')}</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-400" />
                    </button>
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
