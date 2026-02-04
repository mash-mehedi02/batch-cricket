
import { Link, useLocation } from 'react-router-dom';
import { Home, Calendar, Trophy, Users, Menu } from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';

interface BottomNavProps {
    onMenuClick: () => void;
}

export default function BottomNav({ onMenuClick }: BottomNavProps) {
    const location = useLocation();
    const { isDarkMode } = useThemeStore();
    const isActive = (path: string) => location.pathname === path;

    // Paths to hide bottom nav
    const hideOnPaths = ['/match', '/login', '/admin'];
    if (hideOnPaths.some(p => location.pathname.startsWith(p))) return null;

    const navItems = [
        { path: '/', label: 'Home', icon: <Home size={20} /> },
        { path: '/schedule', label: 'Matches', icon: <Calendar size={20} /> },
        { path: '/tournaments', label: 'Series', icon: <Trophy size={20} /> },
        { path: '/players', label: 'Stats', icon: <Users size={20} /> },
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

                <button
                    onClick={onMenuClick}
                    className="flex flex-col items-center justify-center gap-1 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
                >
                    <Menu size={20} />
                    <span className="text-[10px] font-black uppercase tracking-tighter">More</span>
                </button>
            </div>
        </div>
    );
}
