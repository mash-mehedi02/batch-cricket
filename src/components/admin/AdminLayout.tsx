import { useState, useEffect, useMemo } from 'react';
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
    Hexagon,
    Lock,
    Mail,
    ShieldAlert,
    Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { db } from '@/config/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

const AdminLayout = () => {
    const { user, loading, logout } = useAuthStore();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isUnlocked, setIsUnlocked] = useState(() => sessionStorage.getItem('admin_unlocked') === 'true');
    const [pin, setPin] = useState('');
    const location = useLocation();
    const navigate = useNavigate();
    const [verifyingRole, setVerifyingRole] = useState(true);
    const [isPlayerRestricted, setIsPlayerRestricted] = useState(false);
    const [isPromoting, setIsPromoting] = useState(false);

    // Cleanse Workspace Helper (Fresh Start for Admin)
    const cleanseAdminWorkspace = () => {
        console.log("[AdminLayout] Initiating Secure Session Reset...");
        const adminKeys = ['admin_unlocked', 'master_pin_attempts'];
        Object.keys(sessionStorage).forEach(key => {
            if (!adminKeys.includes(key)) sessionStorage.removeItem(key);
        });
    };

    // Helper to promote user and sync records
    const promoteUser = async (newUid: string, email: string, role: string, name: string, oldUid?: string) => {
        if (!user) return;
        console.log("[AdminLayout] Promoting User:", { email, role, newUid });

        // 1. Update Auth Store
        useAuthStore.setState({ user: { ...user, role: role as any } });

        // 2. Sync to 'users' collection
        const userRef = doc(db, 'users', newUid);
        await updateDoc(userRef, { role }).catch(() => { });

        // 3. Create/Move 'admins' record
        const newAdminRef = doc(db, 'admins', newUid);
        await setDoc(newAdminRef, {
            uid: newUid,
            email,
            name,
            role,
            isActive: true,
            organizationName: 'BatchCrick',
            updatedAt: new Date()
        }, { merge: true });

        if (oldUid && oldUid !== newUid) {
            console.log("[AdminLayout] Cleaning up old admin record:", oldUid);
            await deleteDoc(doc(db, 'admins', oldUid)).catch(() => { });
        }

        toast.success(`Admin access restored: ${role.replace('_', ' ')}`);
        setIsPlayerRestricted(false);
    };

    // Explicit Manual Promotion Check
    const handleAdminPromotion = async () => {
        if (!user || isPromoting) return;
        setIsPromoting(true);
        const email = user.email;
        if (!email) {
            toast.error("User email missing for verification.");
            setIsPromoting(false);
            return;
        }

        try {
            const emailLower = email.toLowerCase().trim();

            // 1. Direct Lookup in invited_admins
            const inviteRef = doc(db, 'invited_admins', emailLower);
            const inviteSnap = await getDoc(inviteRef);
            if (inviteSnap.exists()) {
                await promoteUser(user.uid, emailLower, inviteSnap.data().role || 'admin', user.displayName || inviteSnap.data().name);
                return;
            }

            // 2. Query in admins collection
            const adminsRef = collection(db, 'admins');
            const q = query(adminsRef, where('email', '==', emailLower), limit(1));
            const querySnap = await getDocs(q);
            if (!querySnap.empty && querySnap.docs[0].data().isActive) {
                const adminDoc = querySnap.docs[0];
                await promoteUser(user.uid, emailLower, adminDoc.data().role || 'admin', adminDoc.data().name, adminDoc.id);
                return;
            }

            toast.error("No Admin record found for this email.");
        } catch (err: any) {
            console.error("Manual promotion failed:", err);
            toast.error("Verification error: " + (err.message || "Permissions denied"));
        } finally {
            setIsPromoting(false);
        }
    };

    // Protection: Redirect to login if not authenticated or not an admin
    useEffect(() => {
        let inactivityTimer: any;

        const verifyRole = async () => {
            if (!user) return;
            try {
                const adminRef = doc(db, 'admins', user.uid);
                const snap = await getDoc(adminRef);

                if (!snap.exists() || !snap.data().isActive) {
                    toast.error('Account Disabled: Please contact super admin.');
                    await logout();
                    navigate('/login');
                    return;
                }
                const role = snap.data()?.role;
                if (role !== 'admin' && role !== 'super_admin') {
                    toast.error('Access Denied: Invalid Privileges.');
                    navigate('/');
                }
            } catch (error) {
                console.error('Role verification failed:', error);
            } finally {
                setVerifyingRole(false);
            }
        };

        const resetTimer = () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(async () => {
                const currentRole = user?.role as string;
                if (user && (currentRole === 'admin' || currentRole === 'super_admin')) {
                    toast('Session expired due to inactivity.', { icon: '⏳' });
                    await logout();
                    navigate('/login');
                }
            }, 900000);
        };

        const handleActivity = () => resetTimer();

        if (!loading) {
            if (!user) {
                navigate('/admin/auth?admin=true&redirect=' + encodeURIComponent(location.pathname));
            } else {
                const role = user.role as string;
                if (role === 'admin' || role === 'super_admin') {
                    cleanseAdminWorkspace();
                    verifyRole();
                    window.addEventListener('mousemove', handleActivity);
                    window.addEventListener('keydown', handleActivity);
                    window.addEventListener('scroll', handleActivity);
                    window.addEventListener('click', handleActivity);
                    resetTimer();
                } else {
                    setIsPlayerRestricted(true);
                    setVerifyingRole(false);
                }
            }
        }

        return () => {
            if (inactivityTimer) clearTimeout(inactivityTimer);
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('scroll', handleActivity);
            window.removeEventListener('click', handleActivity);
        };
    }, [user, loading, navigate, location.pathname, logout]);

    const handleUnlock = (e: React.FormEvent) => {
        e.preventDefault();
        if (pin === '2580') {
            setIsUnlocked(true);
            sessionStorage.setItem('admin_unlocked', 'true');
            toast.success('Admin Dashboard Unlocked', { icon: '🔓' });
        } else {
            toast.error('Incorrect Master PIN');
            setPin('');
        }
    };

    // Navigation configuration for the admin sidebar
    const navigation = useMemo(() => [
        { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
        { name: 'Live Matches', href: '/admin/live', icon: Radio },
        { name: 'Tournaments', href: '/admin/tournaments', icon: Trophy },
        { name: 'Matches', href: '/admin/matches', icon: Calendar },
        { name: 'Squads', href: '/admin/squads', icon: Users },
        { name: 'Players', href: '/admin/players', icon: UserPlus },
        { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
        ...(user?.role === 'super_admin' ? [
            { name: 'Users & Claims', href: '/admin/users', icon: ShieldCheck },
            { name: 'Email Broadcast', href: '/admin/broadcast', icon: Mail }
        ] : []),
        { name: 'Settings', href: '/admin/settings', icon: Settings },
    ], [user?.role]);

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

    if (loading || verifyingRole) {
        return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-white">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                <p className="text-slate-400 text-sm font-medium tracking-wide uppercase">Securing Workspace...</p>
            </div>
        );
    }

    if (!user) return null;

    if (isPlayerRestricted) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-950 px-4">
                <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] border border-white/5 shadow-2xl p-8 sm:p-12 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                    <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
                        <ShieldAlert className="w-10 h-10 text-rose-500" />
                    </div>

                    <h2 className="text-2xl font-black text-white mb-2 italic uppercase tracking-tighter">Access Isolated</h2>
                    <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                        You are logged in with a <span className="text-rose-400 font-bold">Player Identity</span>.
                        If you are an administrator, please use the <span className="text-blue-400 underline">Admin Email Portal</span> or click the verification button below.
                    </p>

                    <div className="space-y-4">
                        <button
                            onClick={async () => {
                                await logout();
                                navigate('/admin/auth?admin=true');
                            }}
                            className="w-full bg-white hover:bg-slate-200 text-slate-950 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            Sign in to Admin Console
                        </button>

                        <button
                            disabled={isPromoting}
                            onClick={handleAdminPromotion}
                            className="w-full bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 border border-white/5 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isPromoting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles size={16} />}
                            Verify Admin Status
                        </button>
                    </div>

                    <div className="mt-8 pt-8 border-t border-white/5">
                        <button
                            onClick={() => navigate('/')}
                            className="text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                        >
                            Return to Public App
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!isUnlocked) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-950 px-4">
                <div className="max-w-md w-full bg-slate-900 rounded-[2.5rem] border border-white/5 shadow-2xl p-8 sm:p-12 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                    <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-in zoom-in-50 duration-500">
                        <Lock className="w-10 h-10 text-blue-500" />
                    </div>

                    <h2 className="text-2xl font-black text-white mb-2 tracking-tighter">Workspace Locked</h2>
                    <p className="text-slate-400 text-sm font-medium mb-8 leading-relaxed">
                        This is a secure area. Please enter your <span className="text-blue-400 font-bold">Master PIN</span> to proceed.
                    </p>

                    <form onSubmit={handleUnlock} className="space-y-6">
                        <input
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            placeholder="Enter 4-digit PIN"
                            className="w-full bg-slate-800 border border-white/10 rounded-2xl px-6 py-4 text-center text-2xl font-black tracking-[0.5em] text-white focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-[10px] placeholder:tracking-widest placeholder:text-slate-600 placeholder:uppercase"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-blue-900/40"
                        >
                            Unlock Access
                        </button>
                    </form>

                    <button
                        onClick={() => logout()}
                        className="mt-8 text-slate-500 hover:text-red-400 text-xs font-bold uppercase tracking-widest transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-50 text-slate-900 font-inter overflow-hidden">
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <aside className={`
                fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-950 text-white transform transition-transform duration-300 ease-in-out border-r border-white/5
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="h-full flex flex-col">
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

                    <div className="p-4 border-t border-white/5 bg-slate-900/30">
                        <div className="flex items-center gap-3 mb-4 px-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold text-white uppercase">
                                {user?.email?.[0] || 'A'}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-white truncate w-32">{user?.email?.split('@')[0] || 'Admin'}</span>
                                <span className="text-xs text-slate-500 truncate capitalize">{user?.role?.replace('_', ' ') || 'Sub Admin'}</span>
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

            <div className="flex-1 flex flex-col h-full w-full">
                <header className="bg-white border-b border-slate-200 lg:hidden flex items-center justify-between pt-[var(--status-bar-height)] pb-3 px-4 sticky top-0 z-30">
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

                <main className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 lg:p-8 w-full">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
