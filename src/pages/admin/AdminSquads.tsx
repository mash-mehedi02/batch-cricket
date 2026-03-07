/**
 * Squad Management Page
 * List, Create, Edit squads with player assignment
 */

import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Search, User, Users, Edit2, Trophy, Check, AlertTriangle, Trash2 } from 'lucide-react'
import { squadService } from '@/services/firestore/squads'
import { playerService } from '@/services/firestore/players'
import { adminService } from '@/services/firestore/admins'
import { Squad, Player } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { Timestamp } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { SkeletonCard } from '@/components/skeletons/SkeletonCard'
import { uploadImage } from '@/services/cloudinary/uploader'
import DeleteConfirmationModal from '@/components/admin/DeleteConfirmationModal'

interface AdminSquadsProps {
  mode?: 'list' | 'create' | 'edit'
}

export default function AdminSquads({ mode = 'list' }: AdminSquadsProps) {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [squads, setSquads] = useState<Squad[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [allAdmins, setAllAdmins] = useState<any[]>([])
  const [selectedAdminFilter, setSelectedAdminFilter] = useState<string>('')
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
    bannerUrl: '',
    school: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Deletion state
  const [itemToDelete, setItemToDelete] = useState<Squad | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (mode === 'list') {
      loadSquads()
      if (user?.role === 'super_admin') {
        loadAdmins()
      }
    } else {
      loadPlayers()
      if (mode === 'edit' && id) {
        loadSquad(id)
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

  const loadSquads = async () => {
    if (!user) return
    try {
      const isSuperAdmin = user.role === 'super_admin'
      const data = await squadService.getByAdmin(user.uid, isSuperAdmin)
      setSquads(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading squads:', error)
      toast.error('Failed to load squads')
      setLoading(false)
    }
  }

  const loadPlayers = async () => {
    if (!user) return
    try {
      const isSuperAdmin = user.role === 'super_admin'
      const data = await playerService.getByAdmin(user.uid, isSuperAdmin)
      setPlayers(data)
    } catch (error) {
      console.error('Error loading players:', error)
    }
  }

  const loadSquad = async (squadId: string) => {
    try {
      const data = await squadService.getById(squadId)
      if (data) {
        // Check ownership - only allow editing own squads (unless super admin)
        const isSuperAdmin = user?.role === 'super_admin'
        const isOwner = (data as any).adminId === user?.uid || (data as any).createdBy === user?.uid

        if (!isSuperAdmin && !isOwner) {
          toast.error('You can only edit squads you created')
          navigate('/admin/squads')
          return
        }

        setFormData({
          name: data.name,
          batch: (data as any).batch || String(data.year || ''),
          year: data.year,
          playerIds: data.playerIds || [],
          captainId: data.captainId || '',
          wicketKeeperId: data.wicketKeeperId || '',
          logoUrl: (data as any).logoUrl || '',
          bannerUrl: (data as any).bannerUrl || '',
          school: data.school || '',
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

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const uploadToast = toast.loading('Uploading cover...')

    try {
      const url = await uploadImage(file, (progress) => {
        console.log(`Upload progress: ${progress}%`)
      })
      setFormData({ ...formData, bannerUrl: url })
      toast.success('Cover uploaded successfully!', { id: uploadToast })
    } catch (error: any) {
      console.error('Upload error:', error)
      toast.error(error.message || 'Failed to upload cover', { id: uploadToast })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[AdminSquads] Submit triggered', { mode, id, user, formData })
    const isSuperAdmin = (user?.role as string) === 'super_admin'
    const isAdmin = (user?.role as string) === 'admin'
    if (!user || (!isAdmin && !isSuperAdmin)) {
      console.warn('[AdminSquads] User not authorized', { user })
      toast.error('Administrative privileges required')
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
          adminId: user?.uid || '',
          adminEmail: user?.email || '',
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

        // Filter to only sync players that exist in our loaded list
        // This prevents "No document to update" errors for stale/deleted IDs
        const existingPlayerIds = players.map(p => p.id)
        const validPlayerIdsToSync = validatedFormData.playerIds.filter(pid =>
          existingPlayerIds.includes(pid)
        )

        if (validPlayerIdsToSync.length !== validatedFormData.playerIds.length) {
          console.warn('[AdminSquads] Some player IDs were filtered out as they do not exist in the current player list.')
        }

        // 1. Set squadId for all valid selected players
        const addPromises = validPlayerIdsToSync.map(pid =>
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

  // Delete Handlers
  const handleDeleteClick = (squad: Squad) => {
    // Check ownership - only allow deleting own squads (unless super admin)
    const isSuperAdmin = user?.role === 'super_admin'
    const isOwner = (squad as any).adminId === user?.uid || (squad as any).createdBy === user?.uid

    if (!isSuperAdmin && !isOwner) {
      toast.error('You can only delete squads you created')
      return
    }

    setItemToDelete(squad)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return

    setIsDeleting(true)
    try {
      await squadService.delete(itemToDelete.id)

      // Unassign players for this squad
      try {
        const squadPlayers = await playerService.getBySquad(itemToDelete.id)
        if (squadPlayers.length > 0) {
          await Promise.all(squadPlayers.map(p =>
            playerService.update(p.id, { squadId: '' })
          ))
        }
      } catch (err) {
        console.error("Error removing players from deleted squad:", err)
      }

      setSquads(prev => prev.filter(s => s.id !== itemToDelete.id))
      toast.success('Squad deleted and players unassigned')
      setDeleteModalOpen(false)
      setItemToDelete(null)
    } catch (error) {
      console.error('Error deleting squad:', error)
      toast.error('Failed to delete squad')
    } finally {
      setIsDeleting(false)
    }
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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">School Name</label>
              <input
                type="text"
                value={formData.school}
                onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="e.g., Ideal School & College"
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Squad Cover</label>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={formData.bannerUrl}
                  onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="https://example.com/cover.png"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  disabled={uploading}
                  className="hidden"
                  id="banner-upload"
                />
                <label
                  htmlFor="banner-upload"
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg cursor-pointer hover:bg-slate-200 transition text-sm font-medium flex items-center"
                >
                  {uploading ? 'Uploading...' : 'Upload File'}
                </label>
              </div>
              {formData.bannerUrl && (
                <div className="mt-2 flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100 w-full max-w-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500 uppercase font-bold pr-2">Preview</span>
                  </div>
                  <img src={formData.bannerUrl} alt="Cover Preview" className="w-full h-32 object-cover rounded-lg shadow-sm bg-white" />
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

      <div className="bg-white rounded-xl shadow-md p-4 mb-6 border border-gray-200 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search squads by name or batch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition-all outline-none"
          />
        </div>

        {user?.role === 'super_admin' && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <User size={18} className="text-gray-400" />
            <select
              value={selectedAdminFilter}
              onChange={(e) => setSelectedAdminFilter(e.target.value)}
              className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 transition-all outline-none min-w-[200px] text-sm"
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(() => {
          const filteredSquads = squads.filter(s => {
            const matchesSearch = (s.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
              String((s as any).batch || s.year || '').toLowerCase().includes((searchTerm || '').toLowerCase());

            // Admin Filter Logic
            let matchesAdmin = true;
            if (user?.role === 'super_admin' && selectedAdminFilter) {
              matchesAdmin = (s as any).adminId === selectedAdminFilter || (s as any).createdBy === selectedAdminFilter;
            }

            return matchesSearch && matchesAdmin;
          });

          if (filteredSquads.length === 0) {
            return (
              <div className="col-span-full bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-white/5 p-20 text-center">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-slate-300">
                  <Users size={40} strokeWidth={1} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  {searchTerm || selectedAdminFilter ? 'No matches found' : 'No squads found'}
                </h3>
                <p className="text-slate-500 text-sm">
                  {searchTerm || selectedAdminFilter ? 'Try adjusting your filters or search term.' : 'Start by creating your first squad!'}
                </p>
              </div>
            );
          }

          return filteredSquads.map((squad) => (
            <div
              key={squad.id}
              className="group bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-white/5 p-6 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-100 dark:hover:border-indigo-500/20 transition-all duration-500 flex flex-col"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xl shadow-inner group-hover:scale-110 transition-transform duration-500">
                    {squad.logoUrl ? (
                      <img src={squad.logoUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      squad.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{squad.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[9px] font-black uppercase tracking-widest">
                        Batch {(squad as any).batch || squad.year}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <Link
                    to={`/admin/squads/${squad.id}/edit`}
                    className="p-2.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                    title="Edit Squad"
                  >
                    <Edit2 size={18} />
                  </Link>
                  <button
                    onClick={() => handleDeleteClick(squad)}
                    className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                    title="Delete Squad"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-50 dark:border-white/5">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                    <Users size={12} /> Players
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white tabular-nums">{squad.playerIds?.length || 0}</div>
                </div>
                <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-50 dark:border-white/5">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                    <Trophy size={12} /> Status
                  </div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 h-[28px]">
                    {squad.captainId ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">
                        <Check size={10} strokeWidth={3} /> Ready
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">
                        <AlertTriangle size={10} /> No Cpt
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {user?.role === 'super_admin' && (
                <div className="mt-auto pt-4 border-t border-slate-50 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[8px] font-black text-slate-400 uppercase">
                      {((squad as any).adminEmail || (squad as any).createdBy || 'S').charAt(0)}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      {((squad as any).adminEmail || (squad as any).createdBy || 'System').split('@')[0]}
                    </span>
                  </div>
                  <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Creator</div>
                </div>
              )}
            </div>
          ));
        })()}
      </div>

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Squad"
        message="This action cannot be undone. This will permanently delete the squad and unassign all players from it."
        verificationText={itemToDelete?.name || ''}
        itemType="Squad"
        isDeleting={isDeleting}
      />
    </div >
  )
}

