
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Trophy, Menu } from 'lucide-react';
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

export default function BottomNav() {
    const location = useLocation();
    const { t } = useTranslation();
    const isActive = (path: string) => location.pathname === path;

    // Paths to hide bottom nav
    const hideOnPaths = ['/match', '/login', '/admin'];
    if (hideOnPaths.some(p => location.pathname.startsWith(p))) return null;

    const navItems = [
        { path: '/', label: t('nav_home'), icon: <Home size={20} /> },
        { path: '/schedule', label: t('nav_matches'), icon: <Calendar size={20} /> },
        { path: '/tournaments', label: t('nav_series'), icon: <CricketIcon size={20} /> },
        { path: '/champions', label: t('nav_champions'), icon: <Trophy size={20} className="fill-current/20" /> },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-t border-slate-200 dark:border-white/5 safe-area-pb">
            <div className="grid grid-cols-5 h-16">
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 ${isActive(item.path)
                            ? 'text-teal-600 dark:text-teal-400 scale-110'
                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'
                            }`}
                    >
                        <div className={`${isActive(item.path) ? 'animate-bounce-short' : ''}`}>
                            {item.icon}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tighter">{item.label}</span>
                    </Link>
                ))}

                <Link
                    to={isActive('/menu') ? '/' : '/menu'}
                    className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 ${isActive('/menu')
                        ? 'text-teal-600 dark:text-teal-400 scale-110'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                >
                    <div className={`${isActive('/menu') ? 'animate-bounce-short' : ''}`}>
                        <Menu size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-tighter">{t('nav_more')}</span>
                </Link>
            </div>
        </div>
    );
}
