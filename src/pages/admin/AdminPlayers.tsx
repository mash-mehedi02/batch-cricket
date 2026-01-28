/**
 * Player Management Page
 * List, Create, Edit players with photo upload
 */

import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { Player, Squad } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { Timestamp } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { SkeletonCard } from '@/components/skeletons/SkeletonCard'
import { uploadImage } from '@/services/cloudinary/uploader'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import { Search } from 'lucide-react'

interface AdminPlayersProps {
  mode?: 'list' | 'create' | 'edit'
}

export default function AdminPlayers({ mode = 'list' }: AdminPlayersProps) {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [players, setPlayers] = useState<Player[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
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
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (mode === 'list') {
      loadPlayers()
      loadSquads()
    } else {
      loadSquads()
      if (mode === 'edit' && id) {
        loadPlayer(id)
      } else {
        setLoading(false)
      }
    }
  }, [mode, id])

  const loadPlayers = async () => {
    try {
      const data = await playerService.getAll()
      setPlayers(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading players:', error)
      toast.error('Failed to load players')
      setLoading(false)
    }
  }

  const loadSquads = async () => {
    try {
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
        setFormData({
          name: data.name,
          role: data.role,
          battingStyle: data.battingStyle || 'right-handed',
          bowlingStyle: data.bowlingStyle || 'right-arm-fast',
          dateOfBirth: data.dateOfBirth || '',
          photoUrl: data.photoUrl || '',
          squadId: data.squadId,
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

    if (formData.name.trim().length < 2) {
      newErrors.name = 'Player name must be at least 2 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      toast.error('Please fix the validation errors')
      return
    }

    setSaving(true)
    try {
      if (mode === 'create') {
        const newPlayerId = await playerService.create({
          ...formData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: user?.uid || '',
        } as any)

        // Sync with squad: Add player ID to the selected squad
        if (formData.squadId) {
          try {
            const squad = await squadService.getById(formData.squadId)
            if (squad) {
              const currentPlayerIds = squad.playerIds || []
              if (!currentPlayerIds.includes(newPlayerId)) {
                await squadService.update(formData.squadId, {
                  playerIds: [...currentPlayerIds, newPlayerId]
                })
              }
            }
          } catch (squadError) {
            console.error('Error syncing player to squad:', squadError)
            toast.error('Player created but failed to sync with squad')
          }
        }

        toast.success('Player created successfully!')
        navigate('/admin/players')
      } else if (mode === 'edit' && id) {
        // If squad changed, remove from old squad and add to new squad
        const oldPlayer = players.find(p => p.id === id)
        const oldSquadId = oldPlayer?.squadId

        await playerService.update(id, {
          ...formData,
          updatedAt: Timestamp.now(),
        } as any)

        // Handle squad sync on edit
        if (oldSquadId && oldSquadId !== formData.squadId) {
          try {
            // Remove from old squad
            const oldSquad = await squadService.getById(oldSquadId)
            if (oldSquad && oldSquad.playerIds) {
              await squadService.update(oldSquadId, {
                playerIds: oldSquad.playerIds.filter(pid => pid !== id)
              })
            }

            // Add to new squad
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
            console.error('Error syncing squad changes:', syncError)
          }
        } else if (formData.squadId) {
          // Ensure player is in current squad list (idempotent)
          try {
            const squad = await squadService.getById(formData.squadId)
            if (squad) {
              const currentIds = squad.playerIds || []
              if (!currentIds.includes(id)) {
                await squadService.update(formData.squadId, {
                  playerIds: [...currentIds, id]
                })
              }
            }
          } catch (err) {
            console.error('Error verifying squad sync:', err)
          }
        }

        toast.success('Player updated successfully!')
        navigate('/admin/players')
      }
    } catch (error: any) {
      console.error('Error saving player:', error)
      toast.error(error.message || 'Failed to save player')
    } finally {
      setSaving(false)
    }
  }

  const filteredPlayers = players.filter((player) => {
    if (filterRole && player.role !== filterRole) return false
    if (filterSquad && player.squadId !== filterSquad) return false
    if (searchTerm && !player.name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    return true
  })

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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                required
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
                value={formData.squadId}
                onChange={(e) => {
                  setFormData({ ...formData, squadId: e.target.value });
                  if (errors.squadId) setErrors(prev => ({ ...prev, squadId: '' }));
                }}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-teal-500 transition ${errors.squadId ? 'border-red-500' : 'border-gray-300'
                  }`}
              >
                <option value="">Select Squad</option>
                {squads.map((squad) => (
                  <option key={squad.id} value={squad.id}>
                    {squad.name} ({squad.year})
                  </option>
                ))}
              </select>
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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date of Birth</label>
              <input
                type="date"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 transition"
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
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Players Management</h1>
          <p className="text-gray-600 mt-1">Manage all cricket players in your system</p>
        </div>
        <Link
          to="/admin/players/new"
          className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white rounded-lg font-semibold hover:from-teal-700 hover:to-teal-800 transition-all shadow-sm hover:shadow-md flex items-center gap-2 justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span className="hidden xs:inline">Add New Player</span>
          <span className="xs:hidden">New Player</span>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="text-2xl font-bold text-teal-600">{players.length}</div>
          <div className="text-sm text-gray-600">Total Players</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="text-2xl font-bold text-blue-600">
            {players.filter(p => p.role === 'batsman').length}
          </div>
          <div className="text-sm text-gray-600">Batsmen</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {players.filter(p => p.role === 'bowler').length}
          </div>
          <div className="text-sm text-gray-600">Bowlers</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="text-2xl font-bold text-purple-600">
            {players.filter(p => p.role === 'all-rounder').length}
          </div>
          <div className="text-sm text-gray-600">All-rounders</div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filter Players
        </h3>
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search players by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition-all outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">By Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            >
              <option value="">All Roles</option>
              <option value="batsman">Batsman</option>
              <option value="bowler">Bowler</option>
              <option value="all-rounder">All-rounder</option>
              <option value="wicket-keeper">Wicket Keeper</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">By Squad</label>
            <select
              value={filterSquad}
              onChange={(e) => setFilterSquad(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            >
              <option value="">All Squads</option>
              {squads.map((squad) => (
                <option key={squad.id} value={squad.id}>
                  {squad.name} ({squad.year})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Batting Style</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition">
              <option>All Batting Styles</option>
              <option>Right-handed</option>
              <option>Left-handed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Bowling Style</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent transition">
              <option>All Bowling Styles</option>
              <option>Fast</option>
              <option>Medium</option>
              <option>Spin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredPlayers.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No players found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your filters or add a new player</p>
            <Link
              to="/admin/players/new"
              className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add First Player
            </Link>
          </div>
        ) : (
          filteredPlayers.map((player) => (
            <div
              key={player.id}
              className="bg-white rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-all duration-200 overflow-hidden group"
            >
              <div className="p-5">
                <div className="flex items-start gap-4 mb-4">
                  <PlayerAvatar
                    photoUrl={player.photoUrl}
                    name={player.name}
                    size="md"
                    className="w-16 h-16 ring-2 ring-white shadow-md"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate group-hover:text-teal-600 transition-colors">
                      {player.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-teal-100 text-teal-800">
                        {player.role.replace('-', ' ')}
                      </span>
                      {player.squadId && (
                        <span className="text-xs text-gray-500 truncate">
                          {squads.find(s => s.id === player.squadId)?.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  {player.battingStyle && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Batting: <span className="font-medium capitalize">{player.battingStyle}</span></span>
                    </div>
                  )}
                  {player.bowlingStyle && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
                      </svg>
                      <span>Bowling: <span className="font-medium capitalize">{player.bowlingStyle.replace('-', ' ')}</span></span>
                    </div>
                  )}
                  {player.dateOfBirth && (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>DOB: <span className="font-medium">{new Date(player.dateOfBirth).toLocaleDateString()}</span></span>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
                <Link
                  to={`/admin/players/${player.id}/edit`}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-teal-600 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

