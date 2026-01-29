/**
 * Admin & Claims Management
 * Separate lists for administrative accounts and player profile claims
 */

import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { playerService } from '@/services/firestore/players'
import { Player } from '@/types'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import PlayerLink from '@/components/PlayerLink'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, UserCheck, Search, Mail, Calendar as CalendarIcon, Tag, Plus, X } from 'lucide-react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import toast from 'react-hot-toast'

interface AdminAccount {
    uid: string
    email: string
    createdAt?: string
    lastLogin?: string
}

export default function AdminUsers() {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<'admins' | 'claims'>('admins')
    const [showInviteModal, setShowInviteModal] = useState(false)
    const [inviteEmail, setInviteEmail] = useState('')
    const [isInviting, setIsInviting] = useState(false)
    const [admins, setAdmins] = useState<AdminAccount[]>([])
    const [claimedPlayers, setClaimedPlayers] = useState<Player[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            // 1. Load Admins
            const adminSnap = await getDocs(collection(db, 'admin'))
            const adminList = adminSnap.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            })) as AdminAccount[]
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

    const filteredAdmins = admins.filter(a =>
        a.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.uid.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const filteredClaims = claimedPlayers.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleInviteAdmin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!inviteEmail) return

        setIsInviting(true)
        try {
            const email = inviteEmail.trim().toLowerCase()
            // Create a doc with email as ID for O(1) lookups
            await setDoc(doc(db, 'permitted_admins', email), {
                email,
                addedBy: 'admin', // You can improve this to current user ID
                createdAt: serverTimestamp()
            })

            toast.success('Admin invited! They will get access upon login.')
            setShowInviteModal(false)
            setInviteEmail('')
        } catch (error) {
            console.error('Invite failed:', error)
            toast.error('Failed to invite admin')
        } finally {
            setIsInviting(false)
        }
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Access & Claims</h1>
                    <p className="text-slate-500 mt-1">Manage administrative accounts and player profile ownership</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowInviteModal(true)}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition shadow-sm flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Admin
                    </button>

                    <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                        <button
                            onClick={() => setActiveTab('admins')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'admins'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Admins
                        </button>
                        <button
                            onClick={() => setActiveTab('claims')}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'claims'
                                    ? 'bg-white text-blue-600 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            User Claims
                        </button>
                    </div>
                </div>
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-slate-900">Invite New Admin</h3>
                            <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        <p className="text-slate-500 text-sm mb-6">
                            Enter the email address of the new admin. Once added, they will automatically get admin access when they log in to the app.
                        </p>

                        <form onSubmit={handleInviteAdmin} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="new.admin@school.com"
                                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none transition"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowInviteModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isInviting}
                                    className="flex-1 px-4 py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition disabled:opacity-50"
                                >
                                    {isInviting ? 'Adding...' : 'Add Admin'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder={`Search ${activeTab === 'admins' ? 'admins' : 'claims'}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                />
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
                    <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-400 font-medium">Loading records...</p>
                </div>
            ) : activeTab === 'admins' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAdmins.length > 0 ? (
                        filteredAdmins.map((admin) => (
                            <div key={admin.uid} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                                        <ShieldCheck className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <div className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider rounded-full">
                                        Active Admin
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <h3 className="text-slate-900 font-bold truncate">{admin.email}</h3>
                                        <p className="text-slate-400 text-xs font-mono mt-1 truncate">{admin.uid}</p>
                                    </div>

                                    <div className="flex items-center gap-2 pt-2 text-slate-500 text-xs">
                                        <CalendarIcon className="w-3.5 h-3.5" />
                                        <span>Added: {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'Initial Setup'}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-slate-200 text-center">
                            <Mail className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="text-slate-400 font-medium">No admin accounts found</p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Player Profile</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Claimed By (UID)</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredClaims.length > 0 ? (
                                filteredClaims.map((player) => (
                                    <tr key={player.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <PlayerAvatar
                                                    photoUrl={player.photoUrl}
                                                    name={player.name}
                                                    size="md"
                                                />
                                                <div>
                                                    <PlayerLink
                                                        playerId={player.id}
                                                        playerName={player.name}
                                                        className="text-slate-900 font-bold hover:text-blue-600 transition-colors"
                                                    />
                                                    <p className="text-slate-400 text-xs">{player.batch} • {player.school}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-700 font-mono">{player.ownerUid}</span>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <UserCheck className="w-3 h-3 text-emerald-500" />
                                                    <span className="text-[10px] font-bold text-emerald-600 uppercase">Verified User</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => navigate(`/admin/players/${player.id}/edit`)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                            >
                                                <Tag className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={3} className="py-20 text-center">
                                        <UserCheck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                        <p className="text-slate-400 font-medium">No claimed profiles found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
