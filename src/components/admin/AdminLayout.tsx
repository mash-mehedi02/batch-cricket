import React, { useState } from 'react';
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
    ShieldAlert
} from 'lucide-react';

const AdminLayout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    const navigation = [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Live Matches', href: '/admin/live', icon: Radio },
        { name: 'Tournaments', href: '/admin/tournaments', icon: Trophy },
        { name: 'Matches', href: '/admin/matches', icon: Calendar },
        { name: 'Squads', href: '/admin/squads', icon: Users },
        { name: 'Players', href: '/admin/players', icon: UserPlus },
        { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
        { name: 'Settings', href: '/admin/settings', icon: Settings },
    ];

    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const handleLogout = () => {
        // Implement logout logic here
        if (confirm('Are you sure you want to logout?')) {
            // clear auth token etc
            navigate('/');
        }
    }

    return (
        <div className="flex h-screen bg-slate-50 text-slate-900 font-inter">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#121926] text-white transform transition-transform duration-300 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="h-full flex flex-col">
                    {/* Brand */}
                    <div className="p-6 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                                <ShieldAlert size={20} className="text-white" />
                            </div>
                            <span className="text-lg font-black tracking-tight text-white">ADMIN<span className="text-blue-500">PANEL</span></span>
                        </div>
                        <button onClick={toggleSidebar} className="lg:hidden text-slate-400 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                        {navigation.map((item) => {
                            const isActive = location.pathname === item.href || (item.href !== '/admin' && location.pathname.startsWith(item.href));
                            return (
                                <Link
                                    key={item.name}
                                    to={item.href}
                                    onClick={() => setIsSidebarOpen(false)}
                                    className={`
                                        flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                                        ${isActive
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                        }
                                    `}
                                >
                                    <item.icon size={18} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-white'} />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Footer / Logout */}
                    <div className="p-4 border-t border-white/10">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                        >
                            <LogOut size={18} />
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden w-full">
                {/* Mobile Header */}
                <header className="bg-white border-b border-slate-200 lg:hidden flex items-center justify-between p-4">
                    <div className="font-black text-slate-800">BatchCrick BD</div>
                    <button onClick={toggleSidebar} className="p-2 text-slate-600 rounded-md hover:bg-slate-100">
                        <Menu size={24} />
                    </button>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
