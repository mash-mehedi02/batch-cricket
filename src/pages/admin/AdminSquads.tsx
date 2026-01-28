/**
 * Squad Management Page
 * List, Create, Edit squads with player assignment
 */

import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { squadService } from '@/services/firestore/squads'
import { playerService } from '@/services/firestore/players'
import { Squad, Player } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { Timestamp } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { SkeletonCard } from '@/components/skeletons/SkeletonCard'
import { uploadImage } from '@/services/cloudinary/uploader'

interface AdminSquadsProps {
  mode?: 'list' | 'create' | 'edit'
}

export default function AdminSquads({ mode = 'list' }: AdminSquadsProps) {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [squads, setSquads] = useState<Squad[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    batch: '',
    // Legacy/compat field (kept for ordering/grouping). Auto-filled from batch or tournament year.
    year: new Date().getFullYear(),
    playerIds: [] as string[],
    captainId: '',
    wicketKeeperId: '',
    logoUrl: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (mode === 'list') {
      loadSquads()
    } else {
      loadPlayers()
      if (mode === 'edit' && id) {
        loadSquad(id)
      } else {
        setLoading(false)
      }
    }
  }, [mode, id])

  const loadSquads = async () => {
    try {
      const data = await squadService.getAll()
      setSquads(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading squads:', error)
      toast.error('Failed to load squads')
      setLoading(false)
    }
  }

  const loadPlayers = async () => {
    try {
      const data = await playerService.getAll()
      setPlayers(data)
    } catch (error) {
      console.error('Error loading players:', error)
    }
  }

  const loadSquad = async (squadId: string) => {
    try {
      const data = await squadService.getById(squadId)
      if (data) {
        setFormData({
          name: data.name,
          batch: (data as any).batch || String(data.year || ''),
          year: data.year,
          playerIds: data.playerIds || [],
          captainId: data.captainId || '',
          wicketKeeperId: data.wicketKeeperId || '',
          logoUrl: (data as any).logoUrl || '',
        })
      }
      setLoading(false)
    } catch (error) {
      console.error('Error loading squad:', error)
      toast.error('Failed to load squad')
      setLoading(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const uploadToast = toast.loading('Uploading logo...')

    try {
      const url = await uploadImage(file, (progress) => {
        console.log(`Upload progress: ${progress}%`)
      })
      setFormData({ ...formData, logoUrl: url })
      toast.success('Logo uploaded successfully!', { id: uploadToast })
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || 'Failed to upload logo', { id: uploadToast })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[AdminSquads] Submit triggered', { mode, id, user, formData })
    if (!user || (user as any).role !== 'admin') {
      console.warn('[AdminSquads] User not authorized', { user })
      toast.error('Admin role required to save squads. Check Settings → "Make Me Admin".')
      navigate('/admin/settings')
      setSaving(false)
      return
    }
    if (!String(formData.batch || '').trim()) {
      toast.error('Please enter batch')
      return
    }

    setSaving(true)
    console.log('[AdminSquads] Starting save process...')

    // Quick validation for captain/WK consistency
    const validatedFormData = { ...formData }
    if (validatedFormData.captainId && !validatedFormData.playerIds.includes(validatedFormData.captainId)) {
      console.warn('[AdminSquads] Captain not in player list, clearing...')
      validatedFormData.captainId = ''
    }
    if (validatedFormData.wicketKeeperId && !validatedFormData.playerIds.includes(validatedFormData.wicketKeeperId)) {
      console.warn('[AdminSquads] WK not in player list, clearing...')
      validatedFormData.wicketKeeperId = ''
    }

    try {
      const stripUndefined = (obj: Record<string, any>) => {
        const out: Record<string, any> = {}
        Object.entries(obj).forEach(([k, v]) => {
          if (v !== undefined) out[k] = v
        })
        return out
      }

      const parsedBatchYear = parseInt(String(formData.batch).trim(), 10)
      const computedYear = Number.isFinite(parsedBatchYear) && String(parsedBatchYear).length >= 2
        ? parsedBatchYear
        : (formData.year || new Date().getFullYear())

      let finalId = id || ''

      if (mode === 'create') {
        console.log('[AdminSquads] Creating new squad...')
        const newId = await squadService.create(stripUndefined({
          ...validatedFormData,
          year: computedYear,
          batch: String(formData.batch).trim(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: user?.uid || '',
        }) as any)
        finalId = newId
        console.log('[AdminSquads] Created successfully with ID:', newId)
      } else if (mode === 'edit' && id) {
        console.log('[AdminSquads] Updating squad with ID:', id)
        await squadService.update(id, stripUndefined({
          ...validatedFormData,
          year: computedYear,
          batch: String(formData.batch).trim(),
          updatedAt: Timestamp.now(),
        }) as any)
        console.log('[AdminSquads] Squad doc update successful')
      }

      // SYNC PLAYERS: This is crucial for consistency
      if (finalId) {
        console.log('[AdminSquads] Syncing player documents with squadId...')
        const batchTag = String(formData.batch).trim()

        // 1. Set squadId for all selected players
        const addPromises = validatedFormData.playerIds.map(pid =>
          playerService.update(pid, {
            squadId: finalId,
            batch: batchTag
          }).catch(e => console.error(`Failed to sync player ${pid}:`, e))
        )

        // 2. Clear squadId for players who were in this squad but are now removed
        // (Only if we know which players they were - we check the local 'players' state)
        const removedPlayers = players.filter(p =>
          p.squadId === finalId && !validatedFormData.playerIds.includes(p.id)
        )

        const removePromises = removedPlayers.map(p =>
          playerService.update(p.id, { squadId: '' })
            .catch(e => console.error(`Failed to clear player ${p.id}:`, e))
        )

        await Promise.all([...addPromises, ...removePromises])
        console.log('[AdminSquads] Player sync complete')
      }

      toast.success(mode === 'create' ? 'Squad created successfully!' : 'Squad updated successfully!')
      setTimeout(() => navigate('/admin/squads'), 500)
    } catch (err: any) {
      console.error('[AdminSquads] Submit error:', err)
      const errorMsg = err?.message || String(err)

      if (errorMsg.includes('permission-denied')) {
        toast.error('Firebase Permission Denied! Update your Admin rules.')
      } else if (errorMsg.includes('already in squad')) {
        toast.error(errorMsg)
      } else {
        toast.error('Failed: ' + errorMsg)
      }
    } finally {
      setSaving(false)
    }
  }

  const togglePlayer = (playerId: string) => {
    setFormData({
      ...formData,
      playerIds: formData.playerIds.includes(playerId)
        ? formData.playerIds.filter(id => id !== playerId)
        : [...formData.playerIds, playerId],
    })
  }

  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/admin/squads" className="text-teal-600 hover:underline mb-2 inline-block">
            ← Back to Squads
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            {mode === 'create' ? 'Create Squad' : 'Edit Squad'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 border border-gray-200 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Squad Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., Team Alpha"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Batch *</label>
              <input
                type="text"
                required
                value={formData.batch}
                onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., 2006 / Batch-17"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Squad Logo</label>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="https://example.com/logo.png"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                  className="hidden"
                  id="logo-upload"
                />
                <label
                  htmlFor="logo-upload"
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer hover:bg-slate-200 transition text-sm font-medium flex items-center"
                >
                  {uploading ? 'Uploading...' : 'Upload File'}
                </label>
              </div>
              {formData.logoUrl && (
                <div className="mt-2 flex items-center gap-4 p-2 bg-slate-50 rounded-lg border border-slate-100 w-fit">
                  <img src={formData.logoUrl} alt="Preview" className="w-12 h-12 rounded-full object-contain bg-white shadow-sm" />
                  <span className="text-xs text-slate-500 uppercase font-bold pr-2">Preview</span>
                </div>
              )}
            </div>

            <div className="md:col-span-2">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-sm font-semibold">
                Note: Squads are now independent. You’ll select squads while creating a tournament.
              </div>
            </div>
          </div>

          {/* Player Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Players ({formData.playerIds.length} selected)
            </label>
            <div className="border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {players.map((player) => (
                  <label
                    key={player.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-gray-200"
                  >
                    <input
                      type="checkbox"
                      checked={formData.playerIds.includes(player.id)}
                      onChange={() => togglePlayer(player.id)}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{player.name}</div>
                      <div className="text-sm text-gray-500">{player.role}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Captain & WK Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Captain</label>
              <select
                value={formData.captainId}
                onChange={(e) => setFormData({ ...formData, captainId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select Captain</option>
                {players
                  .filter((p) => formData.playerIds.includes(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Wicket Keeper</label>
              <select
                value={formData.wicketKeeperId}
                onChange={(e) => setFormData({ ...formData, wicketKeeperId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select Wicket Keeper</option>
                {players
                  .filter((p) => formData.playerIds.includes(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : mode === 'create' ? 'Create Squad' : 'Update Squad'}
            </button>
            <Link
              to="/admin/squads"
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} showAvatar={false} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Squads & Teams</h1>
          <p className="text-gray-600 mt-1">Manage all squads</p>
        </div>
        <Link
          to="/admin/squads/new"
          className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition"
        >
          + New Squad
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 mb-6 border border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search squads by name or batch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition-all outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(() => {
          const filteredSquads = squads.filter(s =>
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            String((s as any).batch || s.year || '').toLowerCase().includes(searchTerm.toLowerCase())
          );

          if (filteredSquads.length === 0) {
            return (
              <div className="col-span-full text-center py-12 text-gray-500">
                {searchTerm ? 'No matches found for your search.' : 'No squads found. Create your first squad!'}
              </div>
            );
          }

          return filteredSquads.map((squad) => (
            <div
              key={squad.id}
              className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{squad.name}</h3>
                  <p className="text-sm text-gray-500">Batch: {(squad as any).batch || squad.year}</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/admin/squads/${squad.id}/edit`}
                    className="text-teal-600 hover:text-teal-700 text-sm"
                  >
                    Edit
                  </Link>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <div>Players: {squad.playerIds?.length || 0}</div>
                {squad.captainId && <div>Captain: Assigned</div>}
                {squad.wicketKeeperId && <div>WK: Assigned</div>}
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  )
}

