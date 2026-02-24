/**
 * Player Management Page
 * List, Create, Edit players with photo upload
 */

import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { adminService } from '@/services/firestore/admins'
import { createPlayerWithClaim, getPlayerSecretEmail, updatePlayerClaimEmail, isEmailRegistered, adminDeletePlayerSecure } from '@/services/firestore/playerClaim'

import { Player, Squad } from '@/types'
import toast from 'react-hot-toast'
import { SkeletonCard } from '@/components/skeletons/SkeletonCard'
import { uploadImage } from '@/services/cloudinary/uploader'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import { Trash2, Search, Plus, Edit2, Filter, User, Trophy, Medal, Zap, Calendar } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { formatDateLabel } from '@/utils/date'

import DeleteConfirmationModal from '@/components/admin/DeleteConfirmationModal'
import WheelDatePicker from '@/components/common/WheelDatePicker'

interface AdminPlayersProps {
  mode?: 'list' | 'create' | 'edit'
}

export default function AdminPlayers({ mode = 'list' }: AdminPlayersProps) {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [players, setPlayers] = useState<Player[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
  const [allAdmins, setAllAdmins] = useState<any[]>([])
  const [selectedAdminFilter, setSelectedAdminFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [filterRole, setFilterRole] = useState<string>('')
  const [filterSquad, setFilterSquad] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    role: 'batsman' as 'batsman' | 'bowler' | 'all-rounder' | 'wicket-keeper',
    battingStyle: 'right-handed' as 'right-handed' | 'left-handed',
    bowlingStyle: 'right-arm-fast' as any,
    dateOfBirth: '',
    photoUrl: '',
    squadId: '',
    email: '',
    school: 'BatchCrick High',
    address: '',
    claimed: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Deletion state
  const [itemToDelete, setItemToDelete] = useState<Player | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)


  useEffect(() => {
    if (mode === 'list') {
      loadPlayers()
      loadSquads()
      if (user?.role === 'super_admin') {
        loadAdmins()
      }
    } else {
      loadSquads()
      if (mode === 'edit' && id) {
        loadPlayer(id)
      } else {
        setLoading(false)
      }
    }
  }, [mode, id])

  const loadAdmins = async () => {
    try {
      const data = await adminService.getAll()
      setAllAdmins(data)
    } catch (error) {
      console.error('Error loading admins:', error)
    }
  }

  const loadPlayers = async () => {
    if (!user) return
    try {
      const isSuperAdmin = user.role === 'super_admin'
      const data = await playerService.getByAdmin(user.uid, isSuperAdmin)
      setPlayers(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading players:', error)
      toast.error('Failed to load players')
      setLoading(false)
    }
  }

  const loadSquads = async () => {
    if (!user) return
    try {
      // Load ALL squads from platform so players can be assigned to any squad
      const data = await squadService.getAll()
      setSquads(data)
    } catch (error) {
      console.error('Error loading squads:', error)
    }
  }

  const loadPlayer = async (playerId: string) => {
    try {
      const data = await playerService.getById(playerId)
      if (data) {
        // Check ownership - only allow editing own players (unless super admin)
        const isSuperAdmin = user?.role === 'super_admin'
        const isOwner = (data as any).adminId === user?.uid || (data as any).createdBy === user?.uid

        if (!isSuperAdmin && !isOwner) {
          toast.error('You can only edit players you created')
          navigate('/admin/players')
          return
        }

        // Fetch email from secrets if admin
        const secretEmail = await getPlayerSecretEmail(playerId)

        setFormData({
          name: data.name,
          role: data.role,
          battingStyle: data.battingStyle || 'right-handed',
          bowlingStyle: data.bowlingStyle || 'right-arm-fast',
          dateOfBirth: data.dateOfBirth || '',
          photoUrl: data.photoUrl || '',
          squadId: data.squadId,
          email: secretEmail || '',
          school: data.school || 'BatchCrick High',
          address: data.address || '',
          claimed: data.claimed || false,
        })
      }
      setLoading(false)
    } catch (error) {
      console.error('Error loading player:', error)
      toast.error('Failed to load player')
      setLoading(false)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const uploadToast = toast.loading('Uploading photo...')

    try {
      const url = await uploadImage(file, (progress: number) => {
        console.log(`Upload progress: ${progress}%`)
      })
      setFormData({ ...formData, photoUrl: url })
      toast.success('Photo uploaded successfully!', { id: uploadToast })
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || 'Failed to upload photo', { id: uploadToast })
    } finally {
      setUploading(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Player name is required'
    }

    if (!formData.squadId) {
      newErrors.squadId = 'Please select a squad'
    }

    // Email required for create mode or edit mode
    // Email optional but must be valid if provided
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format'
    }

    if (!formData.school) {
      newErrors.school = 'School name is required';
    }

    if (formData.name.trim().length < 2) {
      newErrors.name = 'Player name must be at least 2 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const isSuperAdmin = (user?.role as string) === 'super_admin'
    const isAdmin = (user?.role as string) === 'admin'
    if (!user || (!isAdmin && !isSuperAdmin)) {
      toast.error('Administrative privileges required')
      return
    }

    if (!validateForm()) {
      toast.error('Please fix the validation errors')
      return
    }

    // NEW: Check if email is already taken before proceeding
    if (formData.email) {
      setSaving(true)
      try {
        const isTaken = await isEmailRegistered(formData.email, mode === 'edit' ? id : undefined)
        if (isTaken) {
          toast.error('This email is already associated with another player profile.')
          setSaving(false)
          return
        }
      } catch (err) {
        console.error('Email check failed:', err)
      }
    }

    setSaving(true)
    try {
      if (mode === 'create') {
        const squad = squads.find(s => s.id === formData.squadId)
        if (!squad) {
          toast.error('Squad not found')
          return
        }

        await createPlayerWithClaim({
          ...formData,
          squadName: squad.name,
          email: formData.email,
          school: formData.school,
          adminId: user?.uid,
          adminEmail: user?.email,
        })

        toast.success(formData.email
          ? `Player created! They can now claim using Google (${formData.email})`
          : `Player created successfully!`)
        navigate('/admin/players')
      } else if (mode === 'edit' && id) {
        const oldPlayer = players.find(p => p.id === id)
        const oldSquadId = oldPlayer?.squadId

        await playerService.update(id, {
          name: formData.name,
          role: formData.role,
          squadId: formData.squadId,
          school: formData.school,
          address: formData.address,
          battingStyle: formData.battingStyle,
          bowlingStyle: formData.bowlingStyle,
          dateOfBirth: formData.dateOfBirth,
          photoUrl: formData.photoUrl,
        })

        const oldSecretEmail = await getPlayerSecretEmail(id)
        if (formData.email && formData.email.trim().toLowerCase() !== oldSecretEmail?.toLowerCase()) {
          await updatePlayerClaimEmail(id, formData.email)
          toast.success('Email updated. Profile claim has been reset.')
        } else {
          toast.success('Player updated successfully!')
        }

        if (oldSquadId && oldSquadId !== formData.squadId) {
          try {
            const oldSquad = await squadService.getById(oldSquadId)
            if (oldSquad && oldSquad.playerIds) {
              await squadService.update(oldSquadId, {
                playerIds: oldSquad.playerIds.filter(pid => pid !== id)
              })
            }
            if (formData.squadId) {
              const newSquad = await squadService.getById(formData.squadId)
              if (newSquad) {
                const currentIds = newSquad.playerIds || []
                if (!currentIds.includes(id)) {
                  await squadService.update(formData.squadId, {
                    playerIds: [...currentIds, id]
                  })
                }
              }
            }
          } catch (syncError) {
            console.error('Error syncing squad:', syncError)
          }
        }
        navigate('/admin/players')
      }
    } catch (error: any) {
      console.error('Error saving:', error)
      toast.error(error.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const filteredPlayers = players.filter((player) => {
    if (filterRole && player.role !== filterRole) return false
    if (filterSquad && player.squadId !== filterSquad) return false
    if (searchTerm && !player.name.toLowerCase().includes(searchTerm.toLowerCase())) return false

    // Admin Filter Logic
    if (user?.role === 'super_admin' && selectedAdminFilter) {
      const isAdminMatch = (player as any).adminId === selectedAdminFilter || (player as any).createdBy === selectedAdminFilter;
      if (!isAdminMatch) return false;
    }

    return true
  })

  // Delete Handlers
  const handleDeleteClick = (player: Player) => {
    setItemToDelete(player)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return

    setIsDeleting(true)
    try {
      // Use SECURE Cloud Function for deletion
      // This atomically: deletes player + secrets, removes from squad,
      // clears user ownership, and writes audit log
      await adminDeletePlayerSecure(itemToDelete.id)

      setPlayers(prev => prev.filter(p => p.id !== itemToDelete.id))
      toast.success('Player deleted securely. All ownership references cleared.')
      setDeleteModalOpen(false)
      setItemToDelete(null)
    } catch (error: any) {
      console.error('Error deleting player:', error)
      toast.error(error.message || 'Failed to delete player')
    } finally {
      setIsDeleting(false)
    }
  }

  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/admin/players" className="text-teal-600 hover:underline mb-2 inline-flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Players
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            {mode === 'create' ? 'Create New Player' : 'Edit Player'}
          </h1>
          <p className="text-gray-600 mt-1">
            {mode === 'create' ? 'Add a new player to your squad' : 'Update player information'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Player Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                }}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 transition ${errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                placeholder="Enter player full name"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            {/* Email Field - Admin Only, Mandatory on Create */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Player Email (Private)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                }}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 transition ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Enter player's personal email"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              {mode === 'edit' && formData.claimed && (
                <p className="text-xs text-amber-600 mt-1 font-bold">
                  ⚠️ Profile claimed. Changing this email will reset the claim and the player will need to re-claim.
                </p>
              )}
              {mode === 'edit' && !formData.claimed && (
                <p className="text-xs text-blue-600 mt-1">
                  ℹ️ Profile not yet claimed. This email will be used for verification.
                </p>
              )}
            </div>

            {/* School Field */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                School
              </label>
              <input
                type="text"
                value={formData.school}
                onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition"
                placeholder="e.g. Shakib Al Hasan"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition"
              >
                <option value="batsman">Batsman</option>
                <option value="bowler">Bowler</option>
                <option value="all-rounder">All-rounder</option>
                <option value="wicket-keeper">Wicket Keeper</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Squad <span className="text-red-500">*</span>
              </label>
              <select
                required
                disabled={mode === 'edit'}
                value={formData.squadId}
                onChange={(e) => {
                  setFormData({ ...formData, squadId: e.target.value });
                  if (errors.squadId) setErrors(prev => ({ ...prev, squadId: '' }));
                }}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 transition ${errors.squadId ? 'border-red-500' : 'border-gray-300'
                  } ${mode === 'edit' ? 'bg-gray-100 cursor-not-allowed opacity-75' : 'bg-white'}`}
              >
                <option value="">Select Squad</option>
                {squads.map((squad) => (
                  <option key={squad.id} value={squad.id}>
                    {squad.name} ({squad.year})
                  </option>
                ))}
              </select>
              {mode === 'edit' && (
                <p className="text-[10px] text-slate-500 mt-1 font-bold uppercase tracking-tight">
                  ℹ️ Squad selection is permanent after registration.
                </p>
              )}
              {errors.squadId && <p className="text-red-500 text-sm mt-1">{errors.squadId}</p>}
            </div>

            {/* Role-based Styles */}
            {(formData.role === 'batsman' || formData.role === 'all-rounder' || formData.role === 'wicket-keeper') && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Batting Style</label>
                <select
                  value={formData.battingStyle}
                  onChange={(e) => setFormData({ ...formData, battingStyle: e.target.value as any })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition"
                >
                  <option value="right-handed">Right-handed</option>
                  <option value="left-handed">Left-handed</option>
                </select>
              </div>
            )}

            {(formData.role === 'bowler' || formData.role === 'all-rounder') && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Bowling Style</label>
                <select
                  value={formData.bowlingStyle}
                  onChange={(e) => setFormData({ ...formData, bowlingStyle: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition"
                >
                  <option value="right-arm-fast">Right-arm Fast</option>
                  <option value="right-arm-medium">Right-arm Medium</option>
                  <option value="right-arm-spin">Right-arm Spin</option>
                  <option value="left-arm-fast">Left-arm Fast</option>
                  <option value="left-arm-medium">Left-arm Medium</option>
                  <option value="left-arm-spin">Left-arm Spin</option>
                </select>
              </div>
            )}

            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date of Birth</label>
              <div
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 cursor-pointer bg-white flex items-center justify-between"
                onClick={() => setShowDatePicker(!showDatePicker)}
              >
                <span className={formData.dateOfBirth ? "text-slate-900" : "text-slate-400"}>
                  {formData.dateOfBirth ? formatDateLabel(formData.dateOfBirth) : 'Select Date'}
                </span>
                <Calendar size={18} className="text-slate-400" />
              </div>

              {showDatePicker && (
                <div className="absolute z-[100] mt-2 left-0 right-0 sm:right-auto sm:w-[320px]">
                  {/* Click away layer */}
                  <div className="fixed inset-0 z-0" onClick={() => setShowDatePicker(false)}></div>
                  <div className="relative z-10 bg-white rounded-2xl shadow-xl border border-slate-200 p-2">
                    <WheelDatePicker
                      value={formData.dateOfBirth || '2000-01-01'}
                      onChange={(val) => {
                        setFormData({ ...formData, dateOfBirth: val })
                      }}
                      maxYear={new Date().getFullYear()}
                    />
                    <button
                      type="button"
                      className="w-full mt-2 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition"
                      onClick={() => setShowDatePicker(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition"
                placeholder="Residential Address"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Player Photo</label>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  value={formData.photoUrl}
                  onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition"
                  placeholder="Enter photo URL or upload a file"
                />
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={uploading}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 transition text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        Upload
                      </>
                    )}
                  </label>
                </div>
              </div>
              {formData.photoUrl && (
                <div className="mt-4 flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <img
                    src={formData.photoUrl}
                    alt="Preview"
                    className="w-16 h-16 rounded-full object-cover border-2 border-teal-500"
                    onError={(e) => {
                      e.currentTarget.src = 'https://placehold.co/100x100?text=No+Image';
                    }}
                  />
                  <div>
                    <span className="text-xs text-gray-500 uppercase font-bold">Photo Preview</span>
                    <p className="text-sm text-gray-600 mt-1">Click upload to change photo</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {mode === 'create' ? 'Create Player' : 'Update Player'}
                </>
              )}
            </button>
            <Link
              to="/admin/players"
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition text-center"
            >
              Cancel
            </Link>
          </div>
        </form>

      </div>
    )
  }

  // List View
  if (loading) {
    return (
      <div className="space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-3">
            <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded-lg w-32 animate-pulse"></div>
        </div>

        {/* Filters Skeleton */}
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>

        {/* Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <SkeletonCard key={i} showAvatar={true} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight uppercase italic">Players Database</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Manage player profiles, stats, and squad assignments.</p>
        </div>
        <Link
          to="/admin/players/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm"
        >
          <Plus size={18} />
          New Player
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl"><User size={24} /></div>
          <div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{players.length}</div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Players</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl"><Zap size={24} /></div>
          <div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{players.filter(p => p.role === 'batsman').length}</div>
            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Batsmen</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl"><Trophy size={24} /></div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{players.filter(p => p.role === 'bowler').length}</div>
            <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Bowlers</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl"><Medal size={24} /></div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">{players.filter(p => p.role === 'all-rounder').length}</div>
            <div className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">All Rounders</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-white/5 flex flex-col lg:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex w-full lg:w-auto items-center gap-2 overflow-x-auto flex-wrap sm:flex-nowrap">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg hover:border-blue-400 focus:outline-none cursor-pointer tracking-wider uppercase text-[10px]"
            >
              <option value="">All Roles</option>
              <option value="batsman">Batsman</option>
              <option value="bowler">Bowler</option>
              <option value="all-rounder">All-Rounder</option>
              <option value="wicket-keeper">Wicket Keeper</option>
            </select>
            <select
              value={filterSquad}
              onChange={(e) => setFilterSquad(e.target.value)}
              className="px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg hover:border-blue-400 focus:outline-none cursor-pointer max-w-[200px] tracking-wider uppercase text-[10px]"
            >
              <option value="">All Squads</option>
              {squads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>

            {/* Admin Filter for Super Admins */}
            {user?.role === 'super_admin' && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-white/10 ml-2">
                <User size={16} className="text-slate-400" />
                <select
                  value={selectedAdminFilter}
                  onChange={(e) => setSelectedAdminFilter(e.target.value)}
                  className="px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg hover:border-blue-400 focus:outline-none cursor-pointer min-w-[160px] tracking-wider uppercase text-[10px]"
                >
                  <option value="">All Admins</option>
                  {allAdmins.map(admin => (
                    <option key={admin.uid} value={admin.uid}>
                      {admin.name || admin.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest text-[10px] border-b border-slate-100 dark:border-white/5">
              <tr>
                <th className="px-6 py-4 w-[30%]">Player Name</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Squad</th>
                <th className="px-6 py-4 hidden md:table-cell">Batting</th>
                <th className="px-6 py-4 hidden md:table-cell">Bowling</th>
                {user?.role === 'super_admin' && <th className="px-6 py-4">Admin</th>}
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <User size={48} strokeWidth={1} className="mb-4 text-slate-200" />
                      <p className="text-lg font-medium text-slate-900">No players found</p>
                      <p className="text-sm">Try adjusting filters or add a new player.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <PlayerAvatar photoUrl={player.photoUrl} name={player.name} size="md" className="ring-1 ring-slate-200" />
                        <div>
                          <div className="font-bold text-slate-900">{player.name}</div>
                          <div className="text-xs text-slate-500">{player.school || 'BatchCrick High'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <RoleBadge role={player.role} />
                    </td>
                    <td className="px-6 py-4">
                      {player.squadId ? (
                        <span className="font-medium text-slate-700">{squads.find(s => s.id === player.squadId)?.name || 'Unknown Squad'}</span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell text-slate-600 capitalize">
                      {player.battingStyle || '-'}
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell text-slate-600 capitalize">
                      {player.bowlingStyle ? player.bowlingStyle.replace(/-/g, ' ') : '-'}
                    </td>
                    {user?.role === 'super_admin' && (
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        <span className="truncate block max-w-[80px]" title={(player as any).adminId || (player as any).createdBy || 'System'}>
                          {((player as any).adminEmail || (player as any).createdBy || 'System').split('@')[0]}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Link
                          to={`/admin/players/${player.id}/edit`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </Link>
                        <button
                          onClick={() => handleDeleteClick(player)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Player"
        message={`Are you sure you want to delete ${itemToDelete?.name}? This action cannot be undone.`}
        verificationText={itemToDelete?.name || ''}
        itemType="Player"
        isDeleting={isDeleting}
      />
    </div>
  )
}

function RoleBadge({ role }: { role: string }) {
  const styles: any = {
    'batsman': 'bg-blue-50 text-blue-700 border-blue-200',
    'bowler': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'all-rounder': 'bg-purple-50 text-purple-700 border-purple-200',
    'wicket-keeper': 'bg-orange-50 text-orange-700 border-orange-200',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${styles[role] || 'bg-gray-100'}`}>
      {role}
    </span>
  )
}

