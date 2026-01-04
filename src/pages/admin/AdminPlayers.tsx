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
  const [formData, setFormData] = useState({
    name: '',
    role: 'batsman' as 'batsman' | 'bowler' | 'all-rounder' | 'wicket-keeper',
    battingStyle: 'right-handed' as 'right-handed' | 'left-handed',
    bowlingStyle: 'right-arm-fast' as any,
    dateOfBirth: '',
    photoUrl: '',
    squadId: '',
  })
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
      const url = await uploadImage(file, (progress) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.squadId) {
      toast.error('Please select a squad')
      return
    }

    setSaving(true)
    try {
      if (mode === 'create') {
        await playerService.create({
          ...formData,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: user?.uid || '',
        } as any)
        toast.success('Player created successfully!')
        navigate('/admin/players')
      } else if (mode === 'edit' && id) {
        await playerService.update(id, {
          ...formData,
          updatedAt: Timestamp.now(),
        } as any)
        toast.success('Player updated successfully!')
        navigate('/admin/players')
      }
    } catch (error) {
      console.error('Error saving player:', error)
      toast.error('Failed to save player')
    } finally {
      setSaving(false)
    }
  }

  const filteredPlayers = players.filter((player) => {
    if (filterRole && player.role !== filterRole) return false
    if (filterSquad && player.squadId !== filterSquad) return false
    return true
  })

  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/admin/players" className="text-teal-600 hover:underline mb-2 inline-block">
            ← Back to Players
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            {mode === 'create' ? 'Create Player' : 'Edit Player'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 border border-gray-200 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="Player full name"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Role *</label>
              <select
                required
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="batsman">Batsman</option>
                <option value="bowler">Bowler</option>
                <option value="all-rounder">All-rounder</option>
                <option value="wicket-keeper">Wicket Keeper</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Squad *</label>
              <select
                required
                value={formData.squadId}
                onChange={(e) => setFormData({ ...formData, squadId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select Squad</option>
                {squads.map((squad) => (
                  <option key={squad.id} value={squad.id}>
                    {squad.name} ({squad.year})
                  </option>
                ))}
              </select>
            </div>

            {/* Role-based Styles */}
            {(formData.role === 'batsman' || formData.role === 'all-rounder' || formData.role === 'wicket-keeper') && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Batting Style</label>
                <select
                  value={formData.battingStyle}
                  onChange={(e) => setFormData({ ...formData, battingStyle: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Photo URL</label>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={formData.photoUrl}
                  onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="https://example.com/photo.jpg"
                />
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
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 transition text-sm font-medium flex items-center"
                >
                  Upload File
                </label>
              </div>
              {formData.photoUrl && (
                <div className="mt-2 flex items-center gap-4">
                  <img src={formData.photoUrl} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-teal-500" />
                  <span className="text-xs text-gray-500 uppercase font-bold">Preview</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : mode === 'create' ? 'Create Player' : 'Update Player'}
            </button>
            <Link
              to="/admin/players"
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
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
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded-lg w-32 animate-pulse"></div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <SkeletonCard key={i} showAvatar={true} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Players</h1>
          <p className="text-gray-600 mt-1">Manage all players</p>
        </div>
        <Link
          to="/admin/players/new"
          className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition"
        >
          + New Player
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Roles</option>
              <option value="batsman">Batsman</option>
              <option value="bowler">Bowler</option>
              <option value="all-rounder">All-rounder</option>
              <option value="wicket-keeper">Wicket Keeper</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Filter by Squad</label>
            <select
              value={filterSquad}
              onChange={(e) => setFilterSquad(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Squads</option>
              {squads.map((squad) => (
                <option key={squad.id} value={squad.id}>
                  {squad.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPlayers.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No players found
          </div>
        ) : (
          filteredPlayers.map((player) => (
            <div
              key={player.id}
              className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition"
            >
              <div className="flex items-start gap-4 mb-4">
                {player.photoUrl ? (
                  <img
                    src={player.photoUrl}
                    alt={player.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold text-xl">
                    {player.name[0]}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{player.name}</h3>
                  <p className="text-sm text-gray-600 capitalize">{player.role}</p>
                </div>
                <Link
                  to={`/admin/players/${player.id}/edit`}
                  className="text-teal-600 hover:text-teal-700 text-sm"
                >
                  Edit
                </Link>
              </div>
              <div className="text-sm text-gray-600">
                {player.battingStyle && <div>Bat: {player.battingStyle}</div>}
                {player.bowlingStyle && <div>Bowl: {player.bowlingStyle}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

