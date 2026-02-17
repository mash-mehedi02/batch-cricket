import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    ShieldCheck,
    UserCheck,
    Search,
    Mail,
    Plus,
    X,
    ShieldAlert,
    CheckCircle2,
    MoreVertical,
    Trash2,
    Lock,
    Unlock,
    Shield
} from 'lucide-react'
import { adminService, AdminUser } from '@/services/firestore/admins'
import { playerService } from '@/services/firestore/players'
import { User, Squad } from '@/types'
import { useAuthStore } from '@/store/authStore'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import toast from 'react-hot-toast'
import { userService } from '@/services/firestore/users'
import { squadService } from '@/services/firestore/squads'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/services/firestore/collections'

export default function AdminUsers() {
    const navigate = useNavigate()
    const { user: currentUser, loading: authLoading } = useAuthStore()
    const isSuperAdmin = currentUser?.role === 'super_admin'

    const [activeTab, setActiveTab] = useState<'admins' | 'users'>('admins')
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [showSquadModal, setShowSquadModal] = useState(false)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [selectedSquadId, setSelectedSquadId] = useState('')

    const [inviteName, setInviteName] = useState('')
    const [inviteEmail, setInviteEmail] = useState('')
    const [invitePassword, setInvitePassword] = useState('')
    const [inviteRole, setInviteRole] = useState<'admin' | 'super_admin'>('admin')
    const [isInviting, setIsInviting] = useState(false)
    const [isSquadLinking, setIsSquadLinking] = useState(false)

    const [admins, setAdmins] = useState<AdminUser[]>([])
    const [allUsers, setAllUsers] = useState<User[]>([])
    const [squads, setSquads] = useState<Squad[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        if (!authLoading) {
            if (!isSuperAdmin) {
                toast.error('Access Denied: Super Admin privileges required.')
                navigate('/admin')
            } else {
                loadData()
            }
        }
    }, [isSuperAdmin, authLoading, navigate])

    const loadData = async () => {
        setLoading(true)
        try {
            // 1. Load Admins
            const adminList = await adminService.getAll()
            setAdmins(adminList)

            // 2. Load Registered Users
            const users = await userService.getAll()
            setAllUsers(users)

            // 3. Load Squads
            const squadList = await squadService.getAll()
            setSquads(squadList)
        } catch (error) {
            console.error('Error loading user data:', error)
            toast.error('Failed to load data lists')
        } finally {
            setLoading(false)
        }
    }

    const handleAddToSquad = async () => {
        if (!selectedUser || !selectedSquadId) {
            toast.error('Please select a squad')
            return
        }

        setIsSquadLinking(true)
        const tid = toast.loading(`Adding ${selectedUser.displayName} to squad...`)

        try {
            // 1. Find or Create Player Profile
            let playerId = selectedUser.uid; // Try using UID as Player ID for consistency
            const existingPlayer = await playerService.getById(playerId);

            const playerRoleMap: Record<string, any> = {
                'batsman': 'batsman',
                'bowler': 'bowler',
                'all rounder': 'all-rounder',
                'all-rounder': 'all-rounder',
                'wicket keeper': 'wicket-keeper',
                'wicket-keeper': 'wicket-keeper'
            };

            const profile = selectedUser.playerProfile;
            const normalizedRole = playerRoleMap[(profile?.role || '').toLowerCase()] || 'all-rounder';
            const normalizedBatting = (profile?.battingStyle || '').toLowerCase().includes('left') ? 'left-handed' : 'right-handed';

            let normalizedBowling = null;
            if (profile?.bowlingStyle && profile.bowlingStyle !== 'None') {
                normalizedBowling = profile.bowlingStyle.toLowerCase().replace(/ /g, '-');
            }

            const playerData: any = {
                name: selectedUser.displayName || selectedUser.email.split('@')[0],
                role: normalizedRole,
                battingStyle: normalizedBatting,
                bowlingStyle: normalizedBowling,
                dateOfBirth: profile?.dateOfBirth || '',
                email: selectedUser.email,
                claimed: true,
                ownerUid: selectedUser.uid,
                squadId: selectedSquadId,
                status: 'active',
                adminId: currentUser?.uid
            };

            if (existingPlayer) {
                await playerService.update(playerId, playerData);
            } else {
                // Ensure we use the User's UID as the player ID!

                await setDoc(doc(db, COLLECTIONS.PLAYERS, playerId), {
                    ...playerData,
                    id: playerId,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    createdBy: 'admin_link'
                });
            }

            // 2. Add Player ID to the Squad
            const targetSquad = squads.find(s => s.id === selectedSquadId);
            if (targetSquad) {
                const currentPlayers = targetSquad.playerIds || [];
                if (!currentPlayers.includes(playerId)) {
                    await squadService.update(selectedSquadId, {
                        playerIds: [...currentPlayers, playerId]
                    });
                }
            }

            // 3. Link User to Player in users collection
            await userService.linkToPlayer(selectedUser.uid, playerId);

            toast.success(`${selectedUser.displayName} is now active in the squad!`, { id: tid });
            setShowSquadModal(false);
            loadData();
        } catch (error: any) {
            console.error('Squad assignment failed:', error);
            toast.error(`Error: ${error.message}`, { id: tid });
        } finally {
            setIsSquadLinking(false);
        }
    }

    const handleCreateAdmin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!inviteEmail || !invitePassword || !inviteName) {
            toast.error('All fields are required')
            return
        }

        const loadingToast = toast.loading('Creating administrative account...')
        setIsInviting(true)
        try {
            await adminService.createAdminAccount({
                name: inviteName,
                email: inviteEmail,
                password: invitePassword,
                role: inviteRole
            })

            toast.success(`Account created for ${inviteEmail}! They can login immediately.`, { id: loadingToast })
            setShowInviteModal(false)
            setInviteName('')
            setInviteEmail('')
            setInvitePassword('')
            loadData() // Refresh the list
        } catch (error: any) {
            console.error('Account creation failed:', error)
            let msg = 'Failed to create account'
            if (error.code === 'auth/email-already-in-use') msg = 'This email is already registered'
            if (error.code === 'auth/weak-password') msg = 'Password should be at least 6 characters'
            toast.error(msg, { id: loadingToast })
        } finally {
            setIsInviting(false)
        }
    }

    const toggleAdminStatus = async (uid: string, currentStatus: boolean) => {
        if (!isSuperAdmin) {
            toast.error('Only Super Admins can manage admin status')
            return
        }

        if (uid === currentUser?.uid) {
            toast.error('You cannot deactivate your own account')
            return
        }

        const toastId = toast.loading('Updating status...')
        try {
            await adminService.updateStatus(uid, !currentStatus)
            setAdmins(prev => prev.map(a => a.uid === uid ? { ...a, isActive: !currentStatus } : a))
            toast.success(`Admin ${!currentStatus ? 'activated' : 'deactivated'}`, { id: toastId })
        } catch (error) {
            console.error('Update status failed:', error)
            toast.error('Failed to update admin status', { id: toastId })
        }
    }

    const changeAdminRole = async (uid: string, newRole: 'admin' | 'super_admin') => {
        if (!isSuperAdmin) {
            toast.error('Only Super Admins can manage roles')
            return
        }

        const toastId = toast.loading('Updating role...')
        try {
            await adminService.updateRole(uid, newRole)
            setAdmins(prev => prev.map(a => a.uid === uid ? { ...a, role: newRole } : a))
            toast.success(`Role updated to ${newRole}`, { id: toastId })
        } catch (error) {
            console.error('Update role failed:', error)
            toast.error('Failed to update role', { id: toastId })
        }
    }

    const handleDeleteAdmin = async (uid: string) => {
        if (!isSuperAdmin) return
        if (uid === currentUser?.uid) return

        if (!confirm('Are you sure you want to delete this admin? They will lose all access immediately.')) return

        try {
            await adminService.delete(uid)
            setAdmins(prev => prev.filter(a => a.uid !== uid))
            toast.success('Admin deleted')
        } catch (error) {
            console.error('Delete failed:', error)
            toast.error('Failed to delete admin')
        }
    }

    const filteredAdmins = admins.filter(a =>
        a.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.uid.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredUsers = allUsers.filter(u =>
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.uid.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Access Control & Users</h1>
                    <p className="text-slate-500 mt-2 font-medium">Manage administrators and oversee registered users.</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    {isSuperAdmin && (
                        <button
                            onClick={() => setShowInviteModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-200 flex items-center gap-2 active:scale-95"
                        >
                            <Plus className="w-5 h-5" />
                            Create Admin
                        </button>
                    )}

                    <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200">
                        <button
                            onClick={() => setActiveTab('admins')}
                            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'admins'
                                ? 'bg-white text-blue-600 shadow-xl'
                                : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            <Shield className="w-4 h-4" />
                            Admins
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'users'
                                ? 'bg-white text-blue-600 shadow-xl'
                                : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            <UserCheck className="w-4 h-4" />
                            All Users
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Shield className="w-6 h-6" /></div>
                    <div>
                        <div className="text-2xl font-black text-slate-900">{admins.length}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Admins</div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><UserCheck className="w-6 h-6" /></div>
                    <div>
                        <div className="text-2xl font-black text-slate-900">{allUsers.length}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Registered Users</div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Lock className="w-6 h-6" /></div>
                    <div>
                        <div className="text-2xl font-black text-slate-900">{admins.filter(a => a.role === 'super_admin').length}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Super Admins</div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><CheckCircle2 className="w-6 h-6" /></div>
                    <div>
                        <div className="text-2xl font-black text-slate-900">{admins.filter(a => a.isActive).length}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Seats</div>
                    </div>
                </div>
            </div>

            {/* Content Cards */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                {/* Search Header */}
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center bg-slate-50/30">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder={`Search ${activeTab === 'admins' ? 'administrators' : 'verified player users'} by name, email or ID...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-medium text-slate-700"
                        />
                    </div>
                    {loading && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full animate-pulse text-xs font-bold uppercase tracking-wider">
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping" />
                            Refreshing
                        </div>
                    )}
                </div>

                {/* Main Table/Grid */}
                <div className="p-6">
                    {loading && admins.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-32 space-y-4">
                            <div className="w-16 h-16 border-4 border-slate-50 border-t-blue-600 rounded-full animate-spin" />
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Fetching Records...</p>
                        </div>
                    ) : activeTab === 'admins' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredAdmins.map((admin) => (
                                <div key={admin.uid} className={`relative bg-white p-7 rounded-[1.5rem] border transition-all duration-300 group shadow-sm hover:shadow-xl ${!admin.isActive ? 'border-red-100 bg-red-50/5' : 'border-slate-100 hover:border-blue-200'}`}>
                                    {/* Action Menu (Super Admin Only) */}
                                    {isSuperAdmin && (
                                        <div className="absolute top-4 right-4">
                                            <div className="relative group/menu">
                                                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                                                    <MoreVertical className="w-5 h-5" />
                                                </button>
                                                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20 translate-y-2 group-hover/menu:translate-y-0">
                                                    <div className="p-2 space-y-1">
                                                        <button
                                                            onClick={() => toggleAdminStatus(admin.uid, admin.isActive)}
                                                            className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-bold text-left transition-colors ${admin.isActive ? 'text-red-600 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                                                        >
                                                            {admin.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                                            {admin.isActive ? 'Deactivate Admin' : 'Activate Admin'}
                                                        </button>

                                                        {admin.role === 'admin' ? (
                                                            <button
                                                                onClick={() => changeAdminRole(admin.uid, 'super_admin')}
                                                                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-700 hover:bg-blue-50 text-left transition-colors"
                                                            >
                                                                <ShieldCheck className="w-4 h-4 text-blue-600" />
                                                                Promote to Super
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => changeAdminRole(admin.uid, 'admin')}
                                                                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-700 hover:bg-amber-50 text-left transition-colors"
                                                            >
                                                                <ShieldAlert className="w-4 h-4 text-amber-600" />
                                                                Demote to Admin
                                                            </button>
                                                        )}

                                                        <div className="h-px bg-slate-100 my-1 mx-2" />

                                                        <button
                                                            onClick={() => handleDeleteAdmin(admin.uid)}
                                                            disabled={admin.uid === currentUser?.uid}
                                                            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 text-left transition-colors disabled:opacity-30"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                            Delete Account
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-col h-full">
                                        <div className="flex items-center gap-4 mb-6">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500 shadow-inner ${admin.role === 'super_admin' ? 'bg-indigo-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
                                                <Shield className={`${admin.role === 'super_admin' ? 'w-7 h-7' : 'w-6 h-6'}`} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-slate-900 font-black text-lg truncate max-w-[150px]">{admin.name || 'Admin User'}</h3>
                                                    {admin.uid === currentUser?.uid && (
                                                        <span className="bg-slate-900 text-[9px] text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">YOU</span>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${admin.role === 'super_admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {admin.role.replace('_', ' ')}
                                                    </span>
                                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${admin.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                        {admin.isActive ? 'Active' : 'Disabled'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-4 flex-1">
                                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                                <div className="flex items-center gap-3 text-slate-600">
                                                    <Mail className="w-4 h-4" />
                                                    <span className="text-xs font-bold truncate">{admin.email}</span>
                                                </div>
                                                <div className="flex items-start gap-3 text-slate-600">
                                                    <Lock className="w-4 h-4 mt-0.5" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Admin ID</span>
                                                        <span className="text-[10px] font-mono text-slate-500 truncate w-40">{admin.uid}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 px-1">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">Joined</span>
                                                    <span className="text-xs font-bold text-slate-700">
                                                        {admin.createdAt?.seconds ? new Date(admin.createdAt.seconds * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Join Date N/A'}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col items-end text-right">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase">Organization</span>
                                                    <span className="text-xs font-bold text-slate-700">{admin.organizationName || 'BatchCrick'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {filteredAdmins.length === 0 && (
                                <div className="col-span-full py-32 flex flex-col items-center justify-center text-center space-y-4">
                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center">
                                        <Search className="w-10 h-10 text-slate-300" />
                                    </div>
                                    <div>
                                        <h3 className="text-slate-900 font-bold text-xl">No admins found</h3>
                                        <p className="text-slate-400 font-medium">Try adjusting your search query.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">User / Profile</th>
                                        <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Onboarding Status</th>
                                        <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Squad Status</th>
                                        <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map((user) => (
                                            <tr key={user.uid} className="hover:bg-slate-50/30 transition-all group">
                                                <td className="px-6 py-6 font-inter">
                                                    <div className="flex items-center gap-4">
                                                        <PlayerAvatar
                                                            photoUrl={user.photoURL || user.playerProfile?.photoUrl}
                                                            name={user.displayName || user.email}
                                                            size="lg"
                                                            className="ring-4 ring-slate-50 shadow-inner group-hover:scale-105 transition-transform"
                                                        />
                                                        <div>
                                                            <div className="text-slate-900 font-black text-base transition-colors">
                                                                {user.displayName || user.email.split('@')[0]}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] font-bold text-slate-400 max-w-[150px] truncate">{user.email}</span>
                                                                {user.role === 'super_admin' && <Shield className="w-3 h-3 text-indigo-500" />}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6">
                                                    <div className="flex items-center gap-2">
                                                        {user.playerProfile?.isRegisteredPlayer ? (
                                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                <span className="text-[10px] font-black uppercase tracking-wider">Setup Complete</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
                                                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                                                <span className="text-[10px] font-black uppercase tracking-wider">Awaiting Setup</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6">
                                                    {user.linkedPlayerId ? (
                                                        <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-3">
                                                            <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                                                                <UserCheck className="w-3.5 h-3.5" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] font-black text-blue-900 uppercase tracking-tighter">Active Player</span>
                                                                <span className="text-[10px] font-bold text-blue-600 truncate max-w-[120px]">
                                                                    {squads.find(s => s.playerIds?.includes(user.linkedPlayerId!))?.name || 'In Squad'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-black text-slate-300 uppercase italic">Not in Squad</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-6 text-right">
                                                    {user.linkedPlayerId ? (
                                                        <button
                                                            onClick={() => navigate(`/admin/players/${user.linkedPlayerId}/edit`)}
                                                            className="px-4 py-2 bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                                                        >
                                                            Edit Profile
                                                        </button>
                                                    ) : (
                                                        <button
                                                            disabled={!user.playerProfile?.isRegisteredPlayer}
                                                            onClick={() => {
                                                                setSelectedUser(user);
                                                                setShowSquadModal(true);
                                                            }}
                                                            className="px-5 py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 disabled:opacity-30 disabled:shadow-none"
                                                        >
                                                            Invite to Squad
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="py-32 text-center">
                                                <Search className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                                                <h3 className="text-slate-900 font-bold text-xl">No users found</h3>
                                                <p className="text-slate-400 font-medium">Try adjusting your search filters.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Invite Modal (Admin Creation) remains as is logic wise but I'll ensure it stays */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    {/* ... Existing Modal Content ... */}
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><ShieldCheck className="w-6 h-6" /></div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Create Admin</h3>
                            </div>
                            <button onClick={() => setShowInviteModal(false)} className="p-2.5 hover:bg-slate-100 rounded-full transition-all active:rotate-90">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateAdmin} className="space-y-6">
                            {/* Form fields were in original code, I'll keep them consistent */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Display Name</label>
                                    <input type="text" required value={inviteName} onChange={(e) => setInviteName(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Email Address</label>
                                    <input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Initial Password</label>
                                <input type="password" required minLength={6} value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1">Access Level</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button type="button" onClick={() => setInviteRole('admin')} className={`p-4 rounded-2xl border-2 transition-all font-black text-xs ${inviteRole === 'admin' ? 'border-blue-600 bg-blue-50' : 'border-slate-100'}`}>Admin</button>
                                    <button type="button" onClick={() => setInviteRole('super_admin')} className={`p-4 rounded-2xl border-2 transition-all font-black text-xs ${inviteRole === 'super_admin' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100'}`}>Super Admin</button>
                                </div>
                            </div>
                            <button type="submit" disabled={isInviting} className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-bold uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50">
                                {isInviting ? 'Initializing...' : 'Confirm Account Creation'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Squad Assignment Modal */}
            {showSquadModal && selectedUser && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-2xl font-black text-slate-900">Add to Squad</h3>
                            <button onClick={() => setShowSquadModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <div className="mb-8 p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center">
                            <PlayerAvatar
                                photoUrl={selectedUser.playerProfile?.photoUrl}
                                name={selectedUser.displayName || selectedUser.email}
                                size="xl"
                                className="mx-auto mb-4 border-4 border-white shadow-xl"
                            />
                            <h4 className="text-xl font-black text-slate-900">{selectedUser.displayName}</h4>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Verification Required</p>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1 text-center">Select Destination Squad</label>
                                <select
                                    className="w-full px-6 py-4 bg-slate-100 border-none rounded-2xl font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                                    value={selectedSquadId}
                                    onChange={(e) => setSelectedSquadId(e.target.value)}
                                >
                                    <option value="">-- Choose a Squad --</option>
                                    {squads.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.year})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-[10px] text-blue-700 font-medium leading-relaxed">
                                <b>⚠️ Note:</b> This action will "activate" this user as a public player. Their stats and profile will become visible to all users in the system.
                            </div>

                            <button
                                onClick={handleAddToSquad}
                                disabled={isSquadLinking || !selectedSquadId}
                                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-30 disabled:shadow-none"
                            >
                                {isSquadLinking ? 'Assigning...' : 'Assign to Squad'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
