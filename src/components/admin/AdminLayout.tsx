import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Trophy,
    Calendar,
    Users,
    UserPlus,
    Settings,
    Menu,
    X,
    LogOut,
    Radio,
    BarChart3,
    ShieldCheck,
    Loader2,
    Hexagon
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const AdminLayout = () => {
    const { user, loading, logout } = useAuthStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    // Protection: Redirect to login if not authenticated
    useEffect(() => {
        if (!loading && !user) {
            navigate('/login?redirect=' + encodeURIComponent(location.pathname));
        }
    }, [user, loading, navigate, location.pathname]);

    const navigation = [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Live Matches', href: '/admin/live', icon: Radio },
        { name: 'Tournaments', href: '/admin/tournaments', icon: Trophy },
        { name: 'Matches', href: '/admin/matches', icon: Calendar },
        { name: 'Squads', href: '/admin/squads', icon: Users },
        { name: 'Players', href: '/admin/players', icon: UserPlus },
        { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
        { name: 'Users & Claims', href: '/admin/users', icon: ShieldCheck },
        { name: 'Settings', href: '/admin/settings', icon: Settings },
    ];

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const handleLogout = async () => {
        if (confirm('Are you sure you want to logout?')) {
            try {
                await logout();
                navigate('/');
            } catch (error) {
                console.error('Logout failed:', error);
            }
        }
    }

    if (loading) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-white">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">Initializing Workspace...</p>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="flex h-screen bg-slate-50 text-slate-900 font-inter overflow-hidden">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-950 text-white transform transition-transform duration-300 ease-in-out border-r border-white/5
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="h-full flex flex-col">
                    {/* Brand */}
                    <div className="p-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
                                <Hexagon size={20} className="text-white fill-blue-600" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-base font-bold tracking-tight text-white leading-none">BatchCrick</span>
                                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold mt-1">Admin Console</span>
                            </div>
                        </div>
                        <button onClick={toggleSidebar} className="lg:hidden text-slate-400 hover:text-white p-1">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                        <div className="px-3 mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Main Menu</div>
                        {navigation.map((item) => {
                            const isActive = location.pathname === item.href || (item.href !== '/admin' && location.pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    onClick={() => setIsSidebarOpen(false)}
                                    className={`
                                        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative
                                        ${isActive
                                            ? 'bg-blue-600/10 text-white'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                        }
                                    `}
                                >
                                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />}
                                    <item.icon size={18} className={`transition-colors ${isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Footer / User Profile */}
                    <div className="p-4 border-t border-white/5 bg-slate-900/30">
                        <div className="flex items-center gap-3 mb-4 px-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white uppercase">
                                {user.email?.[0] || 'A'}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-white truncate w-32">{user.email?.split('@')[0]}</span>
                                <span className="text-xs text-slate-500 truncate">Administrator</span>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-xs font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20"
                        >
                            <LogOut size={16} />
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full w-full">
                {/* Mobile Header */}
                <header className="bg-white border-b border-slate-200 lg:hidden flex items-center justify-between p-4 sticky top-0 z-30">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white">
                            <Hexagon size={14} fill="currentColor" />
                        </div>
                        Admin
                    </div>
                    <button onClick={toggleSidebar} className="p-2 text-slate-500 rounded-md hover:bg-slate-100">
                        <Menu size={24} />
                    </button>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 lg:p-8 w-full">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
