
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import {
    ChevronRight,
    User as UserIcon,
    UserPlus,
    Edit,
    LogOut,
    ArrowLeft,
    LayoutDashboard,
    Shield
} from 'lucide-react';

export default function AccountPage() {
    const navigate = useNavigate();
    const { user, logout, loading } = useAuthStore();
    const { isDarkMode } = useThemeStore();

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    if (loading) {
        // Simple loading state matching the theme
        return <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-[#0F172A] text-white' : 'bg-[#F8FAFC] text-slate-900'}`}>Loading...</div>;
    }

    // If no user (and finished loading), return null to avoid flash before redirect
    if (!user) return null;

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleEditProfile = () => {
        navigate('/edit-profile');
    };

    return (
        <div className={`min-h-screen flex flex-col ${isDarkMode ? 'bg-[#0F172A]' : 'bg-[#F8FAFC]'}`}>
            {/* Header - Just back arrow */}
            <div className={`safe-area-pt flex items-center px-5 pt-4 pb-3 border-b ${isDarkMode ? 'border-slate-800 bg-[#1E293B]' : 'border-slate-100 bg-white'}`}>
                <button
                    onClick={() => navigate(-1)}
                    className={`p-2 -ml-2 rounded-full transition-all ${isDarkMode ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    <ArrowLeft size={24} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
                {/* Profile Section */}
                <div className={`px-5 py-5 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
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
                        <div className="min-w-0 flex-1">
                            <h3 className={`text-lg font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                {user?.displayName || 'Cricket Fan'}
                            </h3>
                            <p className={`text-sm truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                {user?.email || 'Login to access full features'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Following Section */}
                <div className={`px-5 py-5 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className="flex items-center justify-between mb-5">
                        <span className={`text-base font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Following</span>
                        <button className="text-sm font-bold text-blue-500">Manage</button>
                    </div>

                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                        {/* Add Button */}
                        <button
                            onClick={() => navigate('/tournaments')}
                            className="flex flex-col items-center gap-2 shrink-0"
                        >
                            <div className={`w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center transition-all ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-400'}`}>
                                <UserPlus size={24} strokeWidth={1.5} />
                            </div>
                            <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Add</span>
                        </button>
                    </div>
                </div>

                {/* Actions */}
                <div className={`border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                    {/* Edit Profile */}
                    <button
                        onClick={handleEditProfile}
                        className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-slate-400">
                                <Edit size={20} />
                            </div>
                            <span className="font-semibold text-[15px]">Edit Profile</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-400" />
                    </button>

                    {/* Admin Dashboard (Conditional) */}
                    {(user.role === 'admin' || user.role === 'super_admin') && (
                        <button
                            onClick={() => navigate('/admin')}
                            className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 flex items-center justify-center text-rose-500">
                                    <LayoutDashboard size={20} />
                                </div>
                                <span className="font-semibold text-[15px]">Admin Console</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest px-2 py-0.5 bg-rose-50 dark:bg-rose-900/20 rounded">Secure</span>
                                <ChevronRight size={18} className="text-slate-400" />
                            </div>
                        </button>
                    )}

                    {/* Register as Player */}
                    {!user.isRegisteredPlayer && user.role !== 'admin' && user.role !== 'super_admin' && (
                        <button
                            onClick={() => navigate('/register-player')}
                            className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 flex items-center justify-center text-blue-500">
                                    <UserPlus size={20} />
                                </div>
                                <span className="font-semibold text-[15px]">Register as Player</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">New</span>
                                <ChevronRight size={18} className="text-slate-400" />
                            </div>
                        </button>
                    )}

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className={`w-full flex items-center justify-between px-5 py-4 transition-colors ${isDarkMode ? 'text-slate-200 hover:bg-[#1e293b]' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 flex items-center justify-center text-slate-400">
                                <LogOut size={20} />
                            </div>
                            <span className="font-semibold text-[15px]">Logout</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-400" />
                    </button>
                </div>
            </div>
        </div>
    );
}
