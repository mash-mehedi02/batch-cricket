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
    Shield,
    Clock,
    Eye,
    EyeOff,
    Key,
    Activity,
    Smartphone,
    MapPin,
    Globe,
    History,
    ExternalLink
} from 'lucide-react'
import { adminService, AdminUser } from '@/services/firestore/admins'
import { playerService } from '@/services/firestore/players'
import { User, Squad } from '@/types'
import { useAuthStore } from '@/store/authStore'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import toast from 'react-hot-toast'
import { userService } from '@/services/firestore/users'
import { squadService } from '@/services/firestore/squads'
import { doc, setDoc, serverTimestamp, query, collection, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS } from '@/services/firestore/collections'
import { PlayerRegistrationRequest } from '@/services/firestore/playerRequests'

export default function AdminUsers() {
    const navigate = useNavigate()
    const { user: currentUser, loading: authLoading } = useAuthStore()
    const isSuperAdmin = currentUser?.role === 'super_admin'

    const [activeTab, setActiveTab] = useState<'admins' | 'users' | 'requests'>('admins')
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [showSquadModal, setShowSquadModal] = useState(false)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [selectedSquadId, setSelectedSquadId] = useState('')

    const [inviteName, setInviteName] = useState('')
    const [inviteEmail, setInviteEmail] = useState('')
    const [invitePassword, setInvitePassword] = useState('')
    const [invitePhone, setInvitePhone] = useState('')
    const [inviteRole, setInviteRole] = useState<'admin' | 'super_admin'>('admin')
    const [isInviting, setIsInviting] = useState(false)
    const [isSquadLinking, setIsSquadLinking] = useState(false)

    const [admins, setAdmins] = useState<AdminUser[]>([])
    const [allUsers, setAllUsers] = useState<User[]>([])
    const [squads, setSquads] = useState<Squad[]>([])
    const [players, setPlayers] = useState<any[]>([]) // Add players state
    const [pendingRequests, setPendingRequests] = useState<PlayerRegistrationRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

    // Email Availability Check
    const [emailError, setEmailError] = useState<string | null>(null)
    const [isCheckingEmail, setIsCheckingEmail] = useState(false)

    // Password Editing
    const [showPassEditModal, setShowPassEditModal] = useState(false)
    const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null)
    const [newAdminPass, setNewAdminPass] = useState('')
    const [isUpdatingPass, setIsUpdatingPass] = useState(false)

    // Delete Confirmation
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [adminToDelete, setAdminToDelete] = useState<AdminUser | null>(null)
    const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    // Details View State
    const [selectedDetailUser, setSelectedDetailUser] = useState<User | null>(null)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [loginLogs, setLoginLogs] = useState<any[]>([])
    const [nameChangeLogs, setNameChangeLogs] = useState<any[]>([])
    const [isLoadingDetails, setIsLoadingDetails] = useState(false)

    const togglePasswordVisibility = (uid: string) => {
        setShowPasswords(prev => ({ ...prev, [uid]: !prev[uid] }))
    }

    // Debounced Email Check
    useEffect(() => {
        if (!inviteEmail || !showInviteModal) {
            setEmailError(null)
            return
        }

        const timer = setTimeout(async () => {
            const normalized = inviteEmail.trim().toLowerCase()
            if (!normalized || !normalized.includes('@')) return

            setIsCheckingEmail(true)
            try {
                const result = await adminService.checkEmailExists(normalized)
                if (result.exists) {
                    setEmailError(`This email is already registered as a${result.type === 'admin' ? 'n Admin' : ' Player/User'}. You cannot reuse it for a new Admin account.`)
                } else {
                    setEmailError(null)
                }
            } catch (err) {
                console.error("Email check failed:", err)
            } finally {
                setIsCheckingEmail(false)
            }
        }, 600)

        return () => clearTimeout(timer)
    }, [inviteEmail, showInviteModal])

    const handleUpdatePassword = async (e: React.FormEvent | null, forceReset: boolean = false) => {
        if (e) e.preventDefault()
        if (!editingAdmin) return

        const isManualReset = !!editingAdmin.pwd && !forceReset
        const tid = toast.loading(isManualReset ? `Updating security for ${editingAdmin.email}...` : `Sending reset link to ${editingAdmin.email}...`)
        setIsUpdatingPass(true)
        try {
            if (isManualReset) {
                await adminService.changePassword(editingAdmin.email, editingAdmin.pwd!, newAdminPass)
                toast.success('Password updated successfully!', { id: tid })
            } else {
                await useAuthStore.getState().resetPassword(editingAdmin.email)
                toast.success('Password reset email sent!', { id: tid })
            }
            setShowPassEditModal(false)
            setNewAdminPass('')
            loadData()
        } catch (error: any) {
            console.error('Pass update error:', error)
            toast.error(error.message || (isManualReset ? 'Update failed' : 'Failed to send email'), { id: tid })
        } finally {
            setIsUpdatingPass(false)
        }
    }

    useEffect(() => {
        if (!authLoading) {
            if (!isSuperAdmin) {
                toast.error('Access Denied: Super Admin privileges required.')
                navigate('/admin')
            } else {
                // Real-time Synchronized Data Fetching
                const unsubscribes: (() => void)[] = []

                setLoading(true)

                // 1. Listen for Admins
                const adminsUnsub = onSnapshot(collection(db, COLLECTIONS.ADMINS), (snap) => {
                    const list = snap.docs.map(d => ({ uid: d.id, ...d.data() } as AdminUser))
                    setAdmins(list)
                }, (err) => console.error("Admins listener failed:", err))
                unsubscribes.push(adminsUnsub)

                // 2. Listen for Users
                const usersUnsub = onSnapshot(query(collection(db, COLLECTIONS.USERS), orderBy('lastLogin', 'desc')), (snap) => {
                    const list = snap.docs.map(d => ({ uid: d.id, ...d.data() } as User))
                    setAllUsers(list)
                    setLoading(false)
                }, (err) => {
                    console.warn("Users listener with order failed, falling back:", err)
                    const usersFallback = onSnapshot(collection(db, COLLECTIONS.USERS), (s) => {
                        setAllUsers(s.docs.map(d => ({ uid: d.id, ...d.data() } as User)))
                        setLoading(false)
                    })
                    unsubscribes.push(usersFallback)
                })
                unsubscribes.push(usersUnsub)

                // 3. Listen for Pending Requests
                const requestsQ = isSuperAdmin
                    ? query(collection(db, 'player_requests'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'))
                    : query(collection(db, 'player_requests'), where('status', '==', 'pending'), where('adminId', '==', currentUser?.uid))

                const requestsUnsub = onSnapshot(requestsQ, (snap) => {
                    setPendingRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as PlayerRegistrationRequest)))
                }, (err) => {
                    console.warn("Requests listener with order failed, falling back:", err)
                    const requestsFallback = onSnapshot(query(collection(db, 'player_requests'), where('status', '==', 'pending')), (s) => {
                        setPendingRequests(s.docs.map(d => ({ id: d.id, ...d.data() } as PlayerRegistrationRequest)))
                    })
                    unsubscribes.push(requestsFallback)
                })
                unsubscribes.push(requestsUnsub)

                // 4. Static Load for Squads & Players (Less frequent change)
                loadStaticData()

                return () => unsubscribes.forEach(u => u())
            }
        }
    }, [isSuperAdmin, authLoading, navigate, currentUser?.uid])

    const loadStaticData = async () => {
        try {
            const squadList = await squadService.getAll()
            setSquads(squadList)
            const playerList = await playerService.getAll()
            setPlayers(playerList)
        } catch (error) {
            console.error('Error loading static data:', error)
        }
    }

    const handleViewDetails = async (user: User) => {
        setSelectedDetailUser(user)
        setShowDetailModal(true)
        setIsLoadingDetails(true)
        setLoginLogs([])
        setNameChangeLogs([])

        try {
            // 1. Fetch Login Logs (Last 10)
            const loginQ = query(
                collection(db, 'login_logs'),
                where('uid', '==', user.uid),
                orderBy('timestamp', 'desc'),
                limit(10)
            )
            const loginSnap = await getDocs(loginQ)
            setLoginLogs(loginSnap.docs.map(d => ({ id: d.id, ...d.data() })))

            // 2. Fetch Name Change Logs
            const nameQ = query(
                collection(db, 'name_changes'),
                where('uid', '==', user.uid),
                orderBy('timestamp', 'desc')
            )
            const nameSnap = await getDocs(nameQ)
            setNameChangeLogs(nameSnap.docs.map(d => ({ id: d.id, ...d.data() })))
        } catch (error) {
            console.error('Failed to load user details:', error)
            toast.error('Failed to load activity logs')
        } finally {
            setIsLoadingDetails(false)
        }
    }

    const loadData = async () => {
        // Redundant but keeping signature for potential manual refresh triggers
        loadStaticData()
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
        if (!inviteEmail || !invitePassword || !inviteName || !invitePhone) {
            toast.error('All fields including phone number are required')
            return
        }

        const loadingToast = toast.loading('Creating administrative account...')
        setIsInviting(true)
        try {
            const result = await adminService.createAdminAccount({
                name: inviteName,
                email: inviteEmail,
                password: invitePassword,
                phone: invitePhone,
                role: inviteRole
            })

            const message = (result as any).promoted
                ? `User ${inviteEmail} promoted! Note: They should use their PREVIOUS login method (Google/Old Password) to access the Admin Panel.`
                : `Account created for ${inviteEmail}! They can login with their new password immediately.`;

            toast.success(message, { id: loadingToast })
            setShowInviteModal(false)
            setInviteName('')
            setInviteEmail('')
            setInvitePassword('')
            setInvitePhone('')
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

    const handleDeleteAdmin = (admin: AdminUser) => {
        if (!isSuperAdmin) return
        if (admin.uid === currentUser?.uid) {
            toast.error("You cannot delete your own account.")
            return
        }

        setAdminToDelete(admin)
        setDeleteConfirmEmail('')
        setShowDeleteModal(true)
    }

    const executeDeleteAdmin = async () => {
        if (!adminToDelete || deleteConfirmEmail.trim().toLowerCase() !== adminToDelete.email.toLowerCase()) {
            toast.error('Email mismatch! Please type the correct email.')
            return
        }

        const tid = toast.loading(`Permanently removing ${adminToDelete.name}...`)
        setIsDeleting(true)
        try {
            await adminService.delete(adminToDelete.uid)
            setAdmins(prev => prev.filter(a => a.uid !== adminToDelete.uid))
            toast.success('Administrator permanently removed', { id: tid })
            setShowDeleteModal(false)
            setAdminToDelete(null)
        } catch (error) {
            console.error('Delete failed:', error)
            toast.error('Deletion failed: Check network connectivity', { id: tid })
        } finally {
            setIsDeleting(false)
        }
    }

    const filteredAdmins = admins.filter(a =>
        a.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.uid.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredUsers = allUsers.filter(u => {
        // Only show users who are NOT admins and ARE verified players
        const isAdmin = admins.some(a => a.uid === u.uid);
        if (isAdmin) return false;

        const isVerifiedPlayer = (u.role === 'player') || (u.linkedPlayerId || u.playerId) || players.some(p => p.ownerUid === u.uid || p.id === u.uid);
        if (!isVerifiedPlayer) return false;

        return u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.uid.toLowerCase().includes(searchTerm.toLowerCase())
    })

    const filteredPendingRequests = pendingRequests.filter(r =>
        r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.uid.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.squadName?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredGuests = allUsers.filter(u => {
        // Exclude anyone who is an admin
        if (admins.some(a => a.uid === u.uid)) return false;

        // GUESTS are those who are NOT verified players
        const isVerifiedPlayer = (u.role === 'player') || (u.linkedPlayerId || u.playerId) || players.some(p => p.ownerUid === u.uid || p.id === u.uid);
        if (isVerifiedPlayer) return false;

        return u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.uid.toLowerCase().includes(searchTerm.toLowerCase())
    })

    return (
        <div className="space-y-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase italic underline decoration-blue-500 decoration-4 underline-offset-8">Access Control & Users</h1>
                    <p className="text-slate-500 mt-4 font-bold text-[10px] sm:text-xs uppercase tracking-widest">Manage administrators and oversee registered users.</p>
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

                    <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-2xl border border-slate-200 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setActiveTab('admins')}
                            className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'admins'
                                ? 'bg-white text-blue-600 shadow-lg'
                                : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Admins
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'users'
                                ? 'bg-white text-blue-600 shadow-lg'
                                : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Users
                        </button>

                        <button
                            onClick={() => setActiveTab('requests')}
                            className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all relative whitespace-nowrap ${activeTab === 'requests'
                                ? 'bg-white text-blue-600 shadow-lg'
                                : 'text-slate-500 hover:text-slate-900'
                                }`}
                        >
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Requests
                            {(pendingRequests.length + filteredGuests.length) > 0 && (
                                <span className={`absolute -top-1 -right-1 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-lg animate-pulse ${pendingRequests.length > 0 ? 'bg-rose-500' : 'bg-amber-500'}`}>
                                    {pendingRequests.length + filteredGuests.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-3 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-blue-50 text-blue-600 rounded-2xl"><Shield className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    <div>
                        <div className="text-xl sm:text-2xl font-black text-slate-900">{admins.length}</div>
                        <div className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Total Admins</div>
                    </div>
                </div>
                <div className="bg-white p-3 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><UserCheck className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    <div>
                        <div className="text-xl sm:text-2xl font-black text-slate-900">{allUsers.length}</div>
                        <div className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Registered Users</div>
                    </div>
                </div>
                <div className="bg-white p-3 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Lock className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    <div>
                        <div className="text-xl sm:text-2xl font-black text-slate-900">{admins.filter(a => a.role === 'super_admin').length}</div>
                        <div className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Super Admins</div>
                    </div>
                </div>
                <div className="bg-white p-3 sm:p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-amber-50 text-amber-600 rounded-2xl"><CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    <div>
                        <div className="text-xl sm:text-2xl font-black text-slate-900">{admins.filter(a => a.isActive).length}</div>
                        <div className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">Active Seats</div>
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

                                                        <button
                                                            onClick={() => {
                                                                setEditingAdmin(admin);
                                                                setShowPassEditModal(true);
                                                            }}
                                                            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 text-left transition-colors"
                                                        >
                                                            <Lock size={16} className="text-blue-500" />
                                                            Manage Password
                                                        </button>

                                                        <div className="h-px bg-slate-100 my-1 mx-2" />

                                                        <button
                                                            onClick={() => handleDeleteAdmin(admin)}
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
                                                    <Smartphone className="w-4 h-4 mt-0.5" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Phone Number</span>
                                                        <span className="text-xs font-bold text-slate-700">{admin.phone || 'Not Provided'}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-start gap-3 text-slate-600">
                                                    <Lock className="w-4 h-4 mt-0.5" />
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Admin ID</span>
                                                        <span className="text-[10px] font-mono text-slate-500 truncate w-40">{admin.uid}</span>
                                                    </div>
                                                </div>

                                                {isSuperAdmin && admin.pwd && (
                                                    <div className="flex items-start gap-3 text-slate-600">
                                                        <Key className="w-4 h-4 mt-0.5" />
                                                        <div className="flex-1 flex flex-col">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Password</span>
                                                                <button
                                                                    onClick={() => togglePasswordVisibility(admin.uid)}
                                                                    className="text-blue-500 hover:text-blue-700"
                                                                >
                                                                    {showPasswords[admin.uid] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                                </button>
                                                            </div>
                                                            <span className="text-xs font-mono font-bold text-slate-700">
                                                                {showPasswords[admin.uid] ? admin.pwd : '••••••••'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
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
                    ) : activeTab === 'users' ? (
                        <>
                            <div className="hidden lg:block overflow-x-auto">
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
                                                            {(user.playerProfile?.isRegisteredPlayer || user.isRegisteredPlayer) ? (
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
                                                        {(user.linkedPlayerId || user.playerId) ? (
                                                            <div className="p-2.5 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center gap-3">
                                                                <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                                                                    <UserCheck className="w-3.5 h-3.5" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[9px] font-black text-blue-900 uppercase tracking-tighter">Active Player</span>
                                                                    <span className="text-[10px] font-bold text-blue-600 truncate max-w-[120px]">
                                                                        {squads.find(s => s.playerIds?.includes((user.linkedPlayerId || user.playerId)!))?.name || 'In Squad'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-black text-slate-300 uppercase italic">Not in Squad</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-6 text-right">
                                                        {(user.linkedPlayerId || user.playerId) ? (
                                                            <button
                                                                onClick={() => navigate(`/admin/players/${user.linkedPlayerId || user.playerId}/edit`)}
                                                                className="px-4 py-2 bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                                                            >
                                                                Edit Profile
                                                            </button>
                                                        ) : pendingRequests.some(r => r.uid === user.uid) ? (
                                                            <button
                                                                onClick={() => setActiveTab('requests')}
                                                                className="px-5 py-2.5 bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 active:scale-95 flex items-center gap-2 ml-auto"
                                                            >
                                                                <Clock size={14} />
                                                                Review Request
                                                            </button>
                                                        ) : (
                                                            <div className="flex items-center justify-end gap-3">
                                                                <button
                                                                    onClick={() => handleViewDetails(user)}
                                                                    className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 flex items-center gap-2"
                                                                >
                                                                    <Activity size={14} className="text-blue-500" />
                                                                    Details
                                                                </button>

                                                                <button
                                                                    disabled={!(user.playerProfile?.isRegisteredPlayer || user.isRegisteredPlayer)}
                                                                    onClick={() => {
                                                                        setSelectedUser(user);
                                                                        setShowSquadModal(true);
                                                                    }}
                                                                    className="px-5 py-2.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 disabled:opacity-30 disabled:shadow-none"
                                                                >
                                                                    Invite to Squad
                                                                </button>
                                                            </div>
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

                        </>
                    ) : (
                        <div className="p-2 sm:p-6">
                            <div className="space-y-10">
                                {/* Section 1: Formal Requests */}
                                {(filteredPendingRequests.length > 0 || searchTerm === '') && (
                                    <div>
                                        <div className="flex items-center justify-between mb-6 px-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                                                <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase italic">Registration Requests</h2>
                                            </div>
                                            <div className="bg-rose-50 dark:bg-rose-900/20 px-3 py-1 rounded-full border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] font-black uppercase tracking-widest">
                                                {filteredPendingRequests.length} Immediate
                                            </div>
                                        </div>

                                        {filteredPendingRequests.length === 0 ? (
                                            <div className="py-12 flex flex-col items-center justify-center text-center bg-slate-50/50 dark:bg-slate-800/20 rounded-[2rem] border border-dashed border-slate-200 dark:border-white/5 opacity-50">
                                                <CheckCircle2 size={32} className="text-slate-300 mb-4" />
                                                <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">No formal requests pending</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {filteredPendingRequests.map(request => (
                                                    <div key={request.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-white/5 p-6 shadow-sm hover:shadow-xl transition-all group flex flex-col gap-4">
                                                        <div className="flex gap-5">
                                                            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 shadow-inner border border-slate-100 dark:border-white/10">
                                                                {request.photoUrl ? (
                                                                    <img src={request.photoUrl} alt="" className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-slate-300"><UserCheck size={24} /></div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="text-base font-black text-slate-900 dark:text-white uppercase truncate">{request.name}</h4>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <p className="text-[10px] font-bold text-slate-400">{request.email}</p>
                                                                    <span className="text-[10px] text-slate-300">•</span>
                                                                    <p className="text-[10px] font-bold text-blue-500 flex items-center gap-1">
                                                                        <Smartphone size={10} />
                                                                        {request.phone || 'No Phone'}
                                                                    </p>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2 mt-2">
                                                                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[9px] font-black uppercase rounded">{request.role}</span>
                                                                    <span className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[9px] font-black uppercase rounded">{request.batch}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl space-y-2 border border-slate-100/50 dark:border-white/5">
                                                            <div className="flex items-center justify-between text-[10px]">
                                                                <span className="font-black text-slate-400 uppercase tracking-tighter">Requesting Squad</span>
                                                                <span className="font-bold text-slate-700 dark:text-slate-300">{request.squadName}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[10px]">
                                                                <span className="font-black text-slate-400 uppercase tracking-tighter">School</span>
                                                                <span className="font-bold text-slate-700 dark:text-slate-300">{request.school}</span>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-3 pt-2">
                                                            <button
                                                                onClick={() => {
                                                                    const user = allUsers.find(u => u.uid === request.uid);
                                                                    if (user) {
                                                                        handleViewDetails(user);
                                                                    } else {
                                                                        toast.error('User profile not found');
                                                                    }
                                                                }}
                                                                className="px-4 py-3 bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                                                            >
                                                                <Activity size={14} className="text-blue-500" />
                                                                Activity
                                                            </button>
                                                            <button
                                                                onClick={() => navigate('/admin/player-approvals')}
                                                                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 hover:bg-blue-700 transition-all font-inter"
                                                            >
                                                                Review & Approve
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Section 2: New Members Awaiting Setup */}
                                {(filteredGuests.length > 0 || searchTerm === '') && (
                                    <div>
                                        <div className="flex items-center justify-between mb-6 px-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                                <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase italic">Awaiting Setup (New Guests)</h2>
                                            </div>
                                            <div className="bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest">
                                                {filteredGuests.length} Waiting
                                            </div>
                                        </div>

                                        {filteredGuests.length === 0 ? (
                                            <div className="py-12 flex flex-col items-center justify-center text-center bg-slate-50/50 dark:bg-slate-800/20 rounded-[2rem] border border-dashed border-slate-200 dark:border-white/5 opacity-50">
                                                <CheckCircle2 size={32} className="text-slate-300 mb-4" />
                                                <p className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">No new joiners needing setup</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {filteredGuests.map(guest => (
                                                    <div key={guest.uid} className="bg-white dark:bg-slate-900 p-5 rounded-[1.5rem] border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between group">
                                                        <div className="flex items-center gap-4 mb-4">
                                                            <PlayerAvatar
                                                                photoUrl={guest.photoURL}
                                                                name={guest.displayName || guest.email}
                                                                size="lg"
                                                                className="shadow-sm ring-2 ring-slate-50"
                                                            />
                                                            <div className="min-w-0">
                                                                <h4 className="font-black text-slate-900 dark:text-white truncate uppercase tracking-tight text-sm">{guest.displayName || guest.email.split('@')[0]}</h4>
                                                                <p className="text-[10px] font-bold text-slate-400 truncate">{guest.email}</p>
                                                                <div className="flex items-center gap-1.5 text-[8px] font-black text-amber-500 uppercase mt-1">
                                                                    <Clock size={10} />
                                                                    Joined {guest.lastLogin?.seconds ? new Date(guest.lastLogin.seconds * 1000).toLocaleDateString() : 'Now'}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleViewDetails(guest)}
                                                                className="flex-1 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-95"
                                                            >
                                                                Details
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedUser(guest);
                                                                    setShowSquadModal(true);
                                                                }}
                                                                className="flex-[2] py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
                                                            >
                                                                Invite to Squad
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Invite Modal (Admin Creation) remains as is logic wise but I'll ensure it stays */}
            {
                showInviteModal && (
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
                                        <div className="relative">
                                            <input
                                                type="email"
                                                required
                                                value={inviteEmail}
                                                onChange={(e) => setInviteEmail(e.target.value)}
                                                className={`w-full px-5 py-4 bg-slate-50 border rounded-2xl outline-none focus:ring-4 transition-all font-bold ${emailError ? 'border-rose-500 focus:ring-rose-100' : 'border-slate-200 focus:ring-blue-100'}`}
                                            />
                                            {isCheckingEmail && (
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                                </div>
                                            )}
                                        </div>
                                        {emailError && (
                                            <p className="text-[10px] text-rose-500 font-bold mt-2 px-1 leading-tight">{emailError}</p>
                                        )}
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
                                <button
                                    type="submit"
                                    disabled={isInviting || !!emailError || isCheckingEmail}
                                    className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-bold uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isInviting ? 'Initializing...' : 'Confirm Account Creation'}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* Squad Assignment Modal */}
            {
                showSquadModal && selectedUser && (
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
                )
            }

            {/* Password Edit Modal */}
            {
                showPassEditModal && editingAdmin && (
                    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><Key className="w-6 h-6" /></div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 leading-tight">
                                            {editingAdmin.pwd ? 'Update Password' : 'Reset Account'}
                                        </h3>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{editingAdmin.email}</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowPassEditModal(false)} className="p-2.5 hover:bg-slate-100 rounded-full transition-all">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <form onSubmit={handleUpdatePassword} className="space-y-6">
                                {editingAdmin.pwd ? (
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-1">New Password</label>
                                        <input
                                            type="text"
                                            required
                                            minLength={6}
                                            value={newAdminPass}
                                            onChange={(e) => setNewAdminPass(e.target.value)}
                                            placeholder="Enter minimum 6 characters"
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold"
                                        />
                                    </div>
                                ) : (
                                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 text-center space-y-3">
                                        <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
                                        <p className="text-sm font-bold text-slate-700">Legacy Account Detected</p>
                                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                                            This account was created before password tracking. To regain access, we must send a reset link to their email address.
                                        </p>
                                    </div>
                                )}

                                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-[10px] text-blue-700 font-medium leading-relaxed">
                                    {editingAdmin.pwd
                                        ? <span><b>Note:</b> This will update both the login account and our internal copy. They must use the new password next time.</span>
                                        : <span><b>Security Note:</b> Once they click the link in their email, they can choose a new password and log in.</span>
                                    }
                                </div>

                                <button
                                    type="submit"
                                    disabled={isUpdatingPass}
                                    className={`w-full py-5 text-white rounded-[1.5rem] font-bold uppercase tracking-widest shadow-xl transition-all active:scale-95 disabled:opacity-50 ${editingAdmin.pwd ? 'bg-slate-900 hover:bg-slate-800' : 'bg-blue-600 hover:bg-blue-700'}`}
                                >
                                    {isUpdatingPass
                                        ? 'Processing Security...'
                                        : editingAdmin.pwd ? 'Update Security Now' : 'Send Reset Link Now'
                                    }
                                </button>

                                {editingAdmin.pwd && (
                                    <button
                                        type="button"
                                        onClick={() => handleUpdatePassword(null as any, true)}
                                        className="w-full text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 transition-colors"
                                    >
                                        Login issue? Send Password Reset Link instead
                                    </button>
                                )}
                            </form>
                        </div>
                    </div>
                )
            }
            {/* Delete Confirmation Modal */}
            {
                showDeleteModal && adminToDelete && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[70] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in zoom-in-95 duration-300">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mb-6 shadow-inner">
                                    <ShieldAlert size={40} />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 mb-2">Security Check</h3>
                                <p className="text-slate-500 text-sm font-medium mb-8">
                                    You are about to permanently delete <b>{adminToDelete.name}</b>.
                                    This action is irreversible and will revoke all access immediately.
                                </p>
                            </div>

                            <div className="space-y-6">
                                <div className="p-5 bg-rose-50 rounded-2xl border border-rose-100 italic">
                                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest text-center mb-1">Confirmation Required</p>
                                    <p className="text-xs text-rose-500 text-center font-bold">
                                        Type <span className="text-rose-700 select-all">{adminToDelete.email}</span> to confirm.
                                    </p>
                                </div>

                                <input
                                    type="email"
                                    value={deleteConfirmEmail}
                                    onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                                    placeholder="Enter admin email address"
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-rose-100 focus:border-rose-300 transition-all text-center"
                                />

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowDeleteModal(false)}
                                        className="flex-1 py-4 bg-slate-100 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={executeDeleteAdmin}
                                        disabled={deleteConfirmEmail.trim().toLowerCase() !== adminToDelete.email.toLowerCase() || isDeleting}
                                        className="flex-[2] py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all disabled:opacity-30 disabled:shadow-none animate-pulse"
                                    >
                                        {isDeleting ? 'Removing...' : 'Permanently Delete'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* User Details Modal */}
            {
                showDetailModal && selectedDetailUser && (
                    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-[80] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
                            {/* Modal Header */}
                            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-5">
                                    <PlayerAvatar
                                        photoUrl={selectedDetailUser.photoURL || selectedDetailUser.playerProfile?.photoUrl}
                                        name={selectedDetailUser.displayName || selectedDetailUser.email}
                                        size="xl"
                                        className="ring-4 ring-white shadow-xl"
                                    />
                                    <div>
                                        <h3 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight truncate max-w-[150px] sm:max-w-none">
                                            {selectedDetailUser.displayName || 'Unnamed User'}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 truncate max-w-[100px] sm:max-w-none">{selectedDetailUser.email}</span>
                                            <span className={`text-[8px] sm:text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${selectedDetailUser.role === 'super_admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {selectedDetailUser.role}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setShowDetailModal(false)} className="p-2 sm:p-3 hover:bg-slate-200 rounded-full transition-all active:scale-90 shrink-0">
                                    <X size={20} className="sm:w-6 sm:h-6 text-slate-500" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-8 sm:space-y-10 custom-scrollbar">
                                {isLoadingDetails ? (
                                    <div className="py-20 flex flex-col items-center justify-center gap-4">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Activity...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Login History */}
                                        <div>
                                            <div className="flex items-center gap-3 mb-5 sm:mb-6">
                                                <div className="p-2 sm:p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><ShieldCheck size={18} className="sm:w-5 sm:h-5" /></div>
                                                <h4 className="text-base sm:text-lg font-black text-slate-900 italic uppercase">Device & Access</h4>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                                                    <div className="p-2 bg-white rounded-xl shadow-sm"><Globe size={18} className="text-blue-500" /></div>
                                                    <div>
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Last IP / Location</div>
                                                        <div className="text-xs font-bold text-slate-800">{selectedDetailUser.ip || 'Unknown'}</div>
                                                        <div className="text-[10px] text-slate-500 font-medium">{selectedDetailUser.location || 'Unknown Location'}</div>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
                                                    <div className="p-2 bg-white rounded-xl shadow-sm"><Smartphone size={18} className="text-indigo-500" /></div>
                                                    <div>
                                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Device / Platform</div>
                                                        <div className="text-xs font-bold text-slate-800">{selectedDetailUser.deviceInfo?.platform || 'Unknown'}</div>
                                                        <div className="text-[10px] text-slate-500 font-medium truncate max-w-[150px]" title={selectedDetailUser.deviceInfo?.userAgent}>
                                                            {selectedDetailUser.deviceInfo?.userAgent?.split(')')[1]?.trim() || 'Generic Browser'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center gap-4 sm:col-span-2">
                                                    <div className="p-2 bg-white rounded-xl shadow-sm"><Clock size={18} className="text-blue-600" /></div>
                                                    <div>
                                                        <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Last Active Date & Time</div>
                                                        <div className="text-sm font-black text-blue-900">
                                                            {selectedDetailUser.lastLogin?.seconds
                                                                ? new Date(selectedDetailUser.lastLogin.seconds * 1000).toLocaleString(undefined, {
                                                                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                                })
                                                                : 'No login record recorded'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 mb-5 sm:mb-6">
                                                <div className="p-2 sm:p-2.5 bg-blue-50 text-blue-600 rounded-xl"><History size={18} className="sm:w-5 sm:h-5" /></div>
                                                <h4 className="text-base sm:text-lg font-black text-slate-900 italic uppercase">Recent Activity</h4>
                                            </div>
                                            <div className="space-y-3 sm:space-y-4">
                                                {loginLogs.length > 0 ? loginLogs.map((log) => (
                                                    <div key={log.id} className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:shadow-lg transition-all">
                                                        <div className="flex items-center gap-3 sm:gap-4">
                                                            <div className="p-2 sm:p-2.5 bg-white rounded-xl shadow-sm"><Globe size={16} className="text-slate-400 sm:w-[18px] sm:h-[18px]" /></div>
                                                            <div>
                                                                <div className="text-xs sm:text-sm font-bold text-slate-800">{log.ip}</div>
                                                                <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase mt-1">
                                                                    <MapPin size={10} className="text-rose-400" />
                                                                    {log.location}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <div className="text-[10px] sm:text-xs font-black text-slate-900">
                                                                {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleString(undefined, {
                                                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                                }) : 'Recently'}
                                                            </div>
                                                            <div className="text-[8px] sm:text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tighter truncate max-w-[80px] sm:max-w-[150px]">
                                                                {log.userAgent?.split(')')[1]?.trim() || 'Mobile'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="py-8 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No logs found</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Name Change History */}
                                        <div>
                                            <div className="flex items-center gap-3 mb-5 sm:mb-6">
                                                <div className="p-2 sm:p-2.5 bg-amber-50 text-amber-600 rounded-xl"><History size={18} className="sm:w-5 sm:h-5" /></div>
                                                <h4 className="text-base sm:text-lg font-black text-slate-900 italic uppercase">Name Changes</h4>
                                            </div>
                                            <div className="space-y-3 sm:space-y-4">
                                                {nameChangeLogs.length > 0 ? nameChangeLogs.map((log) => (
                                                    <div key={log.id} className="p-4 sm:p-5 bg-amber-50/30 rounded-2xl border border-amber-100/50 flex items-center justify-between">
                                                        <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                                                            <div className="w-1 h-8 sm:w-1.5 sm:h-10 bg-amber-200 rounded-full shrink-0" />
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                                                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 line-through truncate max-w-[80px]">{log.oldName}</span>
                                                                    <span className="text-[11px] sm:text-sm font-black text-slate-900 truncate max-w-[100px]">→ {log.newName}</span>
                                                                </div>
                                                                <div className="text-[9px] sm:text-[10px] text-amber-600 font-bold uppercase mt-1">
                                                                    {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleDateString() : 'N/A'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="hidden sm:block px-3 py-1 bg-white rounded-lg text-[9px] font-black text-slate-400 uppercase border border-amber-100 shadow-sm shrink-0">
                                                            Logged
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="py-8 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No history</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="p-5 sm:p-8 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:gap-4">
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="w-full sm:flex-1 py-3.5 sm:py-4 bg-white border border-slate-200 text-slate-900 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-white hover:shadow-xl transition-all"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDetailModal(false);
                                        if (selectedDetailUser.linkedPlayerId || selectedDetailUser.playerId) {
                                            navigate(`/admin/players/${selectedDetailUser.linkedPlayerId || selectedDetailUser.playerId}/edit`);
                                        } else {
                                            toast.error("Not linked to player");
                                        }
                                    }}
                                    className="w-full sm:flex-1 py-3.5 sm:py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <ExternalLink size={14} />
                                    Manage
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    )
}
