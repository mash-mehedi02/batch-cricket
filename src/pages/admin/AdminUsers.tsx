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
    XCircle,
    MoreVertical,
    Trash2,
    Lock,
    Unlock,
    Shield
} from 'lucide-react'
import { adminService, AdminUser } from '@/services/firestore/admins'
import { playerService } from '@/services/firestore/players'
import { Player } from '@/types'
import { useAuthStore } from '@/store/authStore'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import PlayerLink from '@/components/PlayerLink'
import toast from 'react-hot-toast'

export default function AdminUsers() {
    const navigate = useNavigate()
    const { user: currentUser, loading: authLoading } = useAuthStore()
    const isSuperAdmin = currentUser?.role === 'super_admin'

    const [activeTab, setActiveTab] = useState<'admins' | 'claims'>('admins')
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [inviteName, setInviteName] = useState('')
    const [inviteEmail, setInviteEmail] = useState('')
    const [invitePassword, setInvitePassword] = useState('')
    const [inviteRole, setInviteRole] = useState<'admin' | 'super_admin'>('admin')
    const [isInviting, setIsInviting] = useState(false)

    const [admins, setAdmins] = useState<AdminUser[]>([])
    const [claimedPlayers, setClaimedPlayers] = useState<Player[]>([])
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

            // 2. Load Claimed Players
            const allPlayers = await playerService.getAll()
            const claimed = allPlayers.filter(p => p.claimed)
            setClaimedPlayers(claimed)
        } catch (error) {
            console.error('Error loading user data:', error)
            toast.error('Failed to load access lists')
        } finally {
            setLoading(false)
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

    const filteredClaims = claimedPlayers.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Access Control & Claims</h1>
                    <p className="text-slate-500 mt-2 font-medium">Manage administrative privileges and player profile ownership.</p>
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
                            onClick={() => setActiveTab('claims')}
                            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'claims'
                                ? 'bg-white text-blue-600 shadow-xl'
                                : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            <UserCheck className="w-4 h-4" />
                            Player Users
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
                        <div className="text-2xl font-black text-slate-900">{claimedPlayers.length}</div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verified Players</div>
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
                                        <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Player Profile</th>
                                        <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Verification Status</th>
                                        <th className="px-6 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Manage</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredClaims.length > 0 ? (
                                        filteredClaims.map((player) => (
                                            <tr key={player.id} className="hover:bg-slate-50/30 transition-all group">
                                                <td className="px-6 py-6 font-inter">
                                                    <div className="flex items-center gap-4">
                                                        <PlayerAvatar
                                                            photoUrl={player.photoUrl}
                                                            name={player.name}
                                                            size="lg"
                                                            className="ring-4 ring-slate-50 shadow-inner group-hover:scale-105 transition-transform"
                                                        />
                                                        <div>
                                                            <PlayerLink
                                                                playerId={player.id}
                                                                playerName={player.name}
                                                                className="text-slate-900 font-black text-base hover:text-blue-600 transition-colors"
                                                            />
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{player.batch}</span>
                                                                <span className="text-xs font-medium text-slate-400">{player.school}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6">
                                                    <div className="p-3 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 shadow-sm">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Verified Identity</span>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-slate-400 font-mono">{player.ownerUid}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-right">
                                                    <button
                                                        onClick={() => navigate(`/admin/players/${player.id}/edit`)}
                                                        className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                                                    >
                                                        Edit Profile
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={3} className="py-32 text-center">
                                                <UserCheck className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                                                <h3 className="text-slate-900 font-bold text-xl">No active claims</h3>
                                                <p className="text-slate-400 font-medium">When players claim profiles, they will appear here.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-300 border border-white/20">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Create Admin</h3>
                            </div>
                            <button onClick={() => setShowInviteModal(false)} className="p-2.5 hover:bg-slate-100 rounded-full transition-all active:rotate-90">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
                            Register a new administrative account directly. The admin will be able to login immediately and change their password later.
                        </p>

                        <form onSubmit={handleCreateAdmin} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Display Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={inviteName}
                                        onChange={(e) => setInviteName(e.target.value)}
                                        placeholder="Full Name"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="admin@batchcrick.bd"
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-1">Temporary Password</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={invitePassword}
                                    onChange={(e) => setInvitePassword(e.target.value)}
                                    placeholder="Enter at least 6 characters"
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-700"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-4 px-1">Select Access Role</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setInviteRole('admin')}
                                        className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${inviteRole === 'admin'
                                            ? 'border-blue-600 bg-blue-50/50 shadow-lg'
                                            : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                                    >
                                        <Shield className={`w-6 h-6 ${inviteRole === 'admin' ? 'text-blue-600' : 'text-slate-400'}`} />
                                        <div className="text-center">
                                            <div className={`text-xs font-black uppercase tracking-wider ${inviteRole === 'admin' ? 'text-blue-900' : 'text-slate-600'}`}>Admin</div>
                                            <div className="text-[9px] font-bold text-slate-400 mt-0.5">Basic Management</div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setInviteRole('super_admin')}
                                        className={`p-5 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${inviteRole === 'super_admin'
                                            ? 'border-indigo-600 bg-indigo-50/50 shadow-lg'
                                            : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                                    >
                                        <ShieldCheck className={`w-6 h-6 ${inviteRole === 'super_admin' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                        <div className="text-center">
                                            <div className={`text-xs font-black uppercase tracking-wider ${inviteRole === 'super_admin' ? 'text-indigo-900' : 'text-slate-600'}`}>Super Admin</div>
                                            <div className="text-[9px] font-bold text-slate-400 mt-0.5">Full System Access</div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowInviteModal(false)}
                                    className="flex-1 px-4 py-4 bg-slate-50 text-slate-600 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-100 transition-all text-xs"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isInviting}
                                    className="flex-1 px-4 py-4 bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-xl active:scale-95 disabled:opacity-50 text-xs"
                                >
                                    {isInviting ? 'Creating Account...' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
