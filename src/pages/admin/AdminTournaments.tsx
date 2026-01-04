/**
 * Tournament Management Page
 * List, Create, Edit, Delete tournaments
 */

import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { squadService } from '@/services/firestore/squads'
import { Tournament } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { Timestamp } from 'firebase/firestore'
import toast from 'react-hot-toast'
import TableSkeleton from '@/components/skeletons/TableSkeleton'
import type { TournamentConfig } from '@/engine/tournament'
import { validateTournamentConfig } from '@/engine/tournament'

interface AdminTournamentsProps {
  mode?: 'list' | 'create' | 'edit'
}

export default function AdminTournaments({ mode = 'list' }: AdminTournamentsProps) {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [squads, setSquads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    year: new Date().getFullYear(),
    tournamentType: 'standard' as 'standard' | 'custom',
    school: '',
    format: 'T20' as 'T20' | 'ODI' | 'Test',
    status: 'upcoming' as 'upcoming' | 'ongoing' | 'completed',
    startDate: '',
    endDate: '',
    description: '',
    participantSquadIds: [] as string[],
    groupCount: 2,
    qualificationPerGroup: 2,
    wildcardQualifiers: 0,
    groupBySquadId: {} as Record<string, string>, // squadId -> groupId
    groupMeta: {} as Record<
      string,
      { name: string; type: 'normal' | 'priority'; roundFormat: 'round_robin' | 'single_match' | 'custom'; qualifyCount: number; winnerPriority: boolean }
    >, // groupId -> meta
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mode === 'list') {
      loadTournaments()
    } else if (mode === 'edit' && id) {
      loadTournament(id)
      loadSquads()
    } else if (mode === 'create') {
      loadSquads()
    }
  }, [mode, id])

  const loadTournaments = async () => {
    try {
      const data = await tournamentService.getAll()
      setTournaments(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading tournaments:', error)
      toast.error('Failed to load tournaments')
      setLoading(false)
    }
  }

  const loadSquads = async () => {
    try {
      const data = await squadService.getAll()
      setSquads(data as any[])
    } catch (e) {
      console.error('Error loading squads:', e)
      setSquads([])
    }
  }

  const loadTournament = async (tournamentId: string) => {
    try {
      const data = await tournamentService.getById(tournamentId)
      if (data) {
        const groups = (data as any).groups || []
        const groupBySquadId: Record<string, string> = {}
        groups.forEach((g: any) => {
          ;(g.squadIds || []).forEach((sid: string) => {
            groupBySquadId[sid] = g.id
          })
        })
        const groupMeta: Record<string, any> = {}
        groups.forEach((g: any, idx: number) => {
          groupMeta[g.id] = {
            name: g.name || groupLabel(idx),
            type: g.type || 'normal',
            roundFormat: g.roundFormat || 'round_robin',
            qualifyCount: (g.qualification?.qualifyCount ?? (data as any)?.qualification?.perGroup ?? 2) as number,
            winnerPriority: Boolean(g.qualification?.winnerPriority),
          }
        })
        const meta = (data as any).participantSquadMeta || {}
        const metaIds = Object.keys(meta || {})
        setFormData({
          name: data.name,
          year: data.year,
          tournamentType: (data as any).tournamentType || (data as any).kind || 'standard',
          school: data.school || '',
          format: data.format,
          status: data.status,
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          description: data.description || '',
          participantSquadIds: (data as any).participantSquadIds || metaIds || [],
          groupCount: Math.max(1, groups.length || 2),
          qualificationPerGroup: (data as any)?.qualification?.perGroup ?? 2,
          wildcardQualifiers: (data as any)?.qualification?.wildcards ?? 0,
          groupBySquadId,
          groupMeta,
        })
      }
      setLoading(false)
    } catch (error) {
      console.error('Error loading tournament:', error)
      toast.error('Failed to load tournament')
      setLoading(false)
    }
  }

  const groupIds = (count: number) => Array.from({ length: Math.max(1, count) }).map((_, i) => `group-${i + 1}`)
  const groupLabel = (idx: number) => `Group ${String.fromCharCode(65 + idx)}`

  const ensureGroupAssignments = (ids: string[], count: number, current: Record<string, string>) => {
    const gids = groupIds(count)
    const next: Record<string, string> = { ...current }
    let cursor = 0
    ids.forEach((sid) => {
      if (!next[sid] || !gids.includes(next[sid])) {
        next[sid] = gids[cursor % gids.length]
        cursor += 1
      }
    })
    // Remove stale keys
    Object.keys(next).forEach((sid) => {
      if (!ids.includes(sid)) delete next[sid]
    })
    return next
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const selectedIds = Array.from(new Set(formData.participantSquadIds || [])).filter(Boolean)
      if (selectedIds.length < 2) {
        toast.error('Select at least 2 squads')
        setSaving(false)
        return
      }
      const groupBySquadId = ensureGroupAssignments(selectedIds, formData.groupCount, formData.groupBySquadId)
      const gids = groupIds(formData.groupCount)
      const groups = gids.map((gid, idx) => ({
        id: gid,
        name: formData.groupMeta?.[gid]?.name || groupLabel(idx),
        type: formData.groupMeta?.[gid]?.type || 'normal',
        roundFormat: formData.groupMeta?.[gid]?.roundFormat || 'round_robin',
        squadIds: selectedIds.filter((sid) => groupBySquadId[sid] === gid),
        qualification: {
          qualifyCount: Math.max(0, Number(formData.groupMeta?.[gid]?.qualifyCount ?? formData.qualificationPerGroup ?? 0)),
          winnerPriority: Boolean(formData.groupMeta?.[gid]?.winnerPriority),
        },
        teamCount: selectedIds.filter((sid) => groupBySquadId[sid] === gid).length,
      }))

      // Persist participant display names for reliable points table rendering
      const participantSquadMeta: Record<string, { name: string; batch?: string }> = {}
      selectedIds.forEach((sid) => {
        const s = squads.find((x) => x.id === sid)
        const name = String((s?.name || s?.teamName || s?.squadName || s?.title || '')).trim() || sid
        const batch = String((s?.batch || '')).trim() || undefined
        participantSquadMeta[sid] = { name, ...(batch ? { batch } : {}) }
      })

      const config: TournamentConfig = {
        version: 1,
        kind: formData.tournamentType,
        year: formData.year,
        stage: 'group',
        points: { win: 2, loss: 0, tie: 1, noResult: 1 },
        ranking: { order: ['points', 'nrr', 'head_to_head', 'wins'] },
        groups: groups.map((g: any) => ({
          id: g.id,
          name: g.name,
          type: g.type,
          teamCount: g.teamCount,
          roundFormat: g.roundFormat,
          squadIds: g.squadIds,
          qualification: {
            qualifyCount: g.qualification.qualifyCount,
            winnerPriority: g.qualification.winnerPriority,
          },
        })),
        wildcards: { count: Math.max(0, Number(formData.wildcardQualifiers || 0)), method: 'overall' },
        locks: { groupsLocked: false, fixturesLocked: false, knockoutLocked: false },
      }
      const v = validateTournamentConfig(config)
      if (!v.ok) {
        toast.error(v.errors[0]?.message || 'Invalid tournament configuration')
        setSaving(false)
        return
      }

      // IMPORTANT: Persist ONLY tournament fields. Avoid spreading full formData (contains UI-only fields
      // like groupCount/groupBySquadId/groupMeta) that can break security rules / schema assumptions.
      const persistPayload = {
        name: formData.name,
        year: formData.year,
        school: formData.school,
        format: formData.format,
        status: formData.status,
        startDate: formData.startDate,
        endDate: formData.endDate,
        description: formData.description,
        tournamentType: formData.tournamentType,
        config,
        participantSquadIds: selectedIds,
        participantSquadMeta,
        groups,
        qualification: {
          perGroup: Math.max(0, Number(formData.qualificationPerGroup || 0)),
          wildcards: Math.max(0, Number(formData.wildcardQualifiers || 0)),
          method: 'group',
        },
      }

      if (mode === 'create') {
        await tournamentService.create({
          ...(persistPayload as any),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: user?.uid || '',
        } as any)
        toast.success('Tournament created successfully!')
        navigate('/admin/tournaments')
      } else if (mode === 'edit' && id) {
        await tournamentService.update(id, {
          ...(persistPayload as any),
          updatedAt: Timestamp.now(),
        } as any)
        toast.success('Tournament updated successfully!')
        navigate('/admin/tournaments')
      }
    } catch (error) {
      console.error('Error saving tournament:', error)
      toast.error(String((error as any)?.message || (error as any)?.code || 'Failed to save tournament'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tournamentId: string) => {
    if (!confirm('Are you sure you want to delete this tournament?')) return

    try {
      await tournamentService.delete(tournamentId)
      toast.success('Tournament deleted')
      loadTournaments()
    } catch (error) {
      console.error('Error deleting tournament:', error)
      toast.error('Failed to delete tournament')
    }
  }

  if (mode === 'create' || mode === 'edit') {
    const selectedIds = Array.from(new Set(formData.participantSquadIds || [])).filter(Boolean)
    const safeGroupBy = ensureGroupAssignments(selectedIds, formData.groupCount, formData.groupBySquadId)
    const gids = groupIds(formData.groupCount)
    const groupsPreview = gids.map((gid, idx) => ({
      id: gid,
      name: groupLabel(idx),
      squadIds: selectedIds.filter((sid) => safeGroupBy[sid] === gid),
    }))

    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/admin/tournaments" className="text-teal-600 hover:underline mb-2 inline-block">
            ← Back to Tournaments
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            {mode === 'create' ? 'Create Tournament' : 'Edit Tournament'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tournament Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="e.g., SMA Cricket League 2024"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Year *
                </label>
                <input
                  type="number"
                  required
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tournament Type *
                </label>
                <select
                  required
                  value={formData.tournamentType}
                  onChange={(e) => setFormData({ ...formData, tournamentType: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="standard">Standard</option>
                  <option value="custom">Custom / Hybrid</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  School
                </label>
                <input
                  type="text"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  placeholder="e.g., SMA"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Format *
                </label>
                <select
                  required
                  value={formData.format}
                  onChange={(e) => setFormData({ ...formData, format: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="T20">T20</option>
                  <option value="ODI">ODI</option>
                  <option value="Test">Test</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                placeholder="Tournament description..."
              />
            </div>

            {/* Tournament Squads + Groups */}
            <div className="border-t border-gray-200 pt-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-extrabold text-gray-900">Tournament Squads</div>
                  <div className="text-xs text-gray-500">Select squads, then assign groups and qualification rules.</div>
                </div>
                <div className="text-xs font-bold text-gray-600">
                  Selected: {selectedIds.length}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Groups</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={formData.groupCount}
                    onChange={(e) => {
                      const next = Math.max(1, Math.min(8, Number(e.target.value || 1)))
                      setFormData((p) => ({
                        ...p,
                        groupCount: next,
                        groupBySquadId: ensureGroupAssignments(selectedIds, next, p.groupBySquadId),
                      }))
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Qualify / Group</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.qualificationPerGroup}
                      onChange={(e) => setFormData({ ...formData, qualificationPerGroup: Number(e.target.value || 0) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                    <div className="text-[11px] text-gray-500 mt-1">Used as default; can be overridden per group.</div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Wildcards</label>
                    <input
                      type="number"
                      min={0}
                      value={formData.wildcardQualifiers}
                      onChange={(e) => setFormData({ ...formData, wildcardQualifiers: Number(e.target.value || 0) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {squads.map((s) => {
                  const checked = selectedIds.includes(s.id)
                  return (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const nextIds = checked
                            ? selectedIds.filter((id) => id !== s.id)
                            : [...selectedIds, s.id]
                          setFormData((p) => ({
                            ...p,
                            participantSquadIds: nextIds,
                            groupBySquadId: ensureGroupAssignments(nextIds, p.groupCount, p.groupBySquadId),
                          }))
                        }}
                        className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{s.name}</div>
                        <div className="text-xs text-gray-500">Batch: {s.batch || s.year}</div>
                      </div>
                      {checked ? (
                        <select
                          value={safeGroupBy[s.id] || gids[0]}
                          onChange={(e) => setFormData((p) => ({ ...p, groupBySquadId: { ...safeGroupBy, [s.id]: e.target.value } }))}
                          className="px-2 py-1 border border-gray-300 rounded-md text-xs font-bold"
                        >
                          {gids.map((gid, idx) => (
                            <option key={gid} value={gid}>
                              {groupLabel(idx)}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </label>
                  )
                })}
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-bold text-gray-700 mb-2">Groups preview</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {groupsPreview.map((g) => (
                    <div key={g.id} className="rounded-lg border border-gray-200 bg-white p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={(formData.groupMeta?.[g.id]?.name) || g.name}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              groupMeta: {
                                ...(p.groupMeta || {}),
                                [g.id]: {
                                  name: e.target.value,
                                  type: (p.groupMeta?.[g.id]?.type || 'normal') as any,
                                  roundFormat: (p.groupMeta?.[g.id]?.roundFormat || 'round_robin') as any,
                                  qualifyCount: Number(p.groupMeta?.[g.id]?.qualifyCount ?? p.qualificationPerGroup ?? 2),
                                  winnerPriority: Boolean(p.groupMeta?.[g.id]?.winnerPriority),
                                },
                              },
                            }))
                          }
                          className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs font-extrabold text-gray-900"
                        />
                        <select
                          value={(formData.groupMeta?.[g.id]?.type) || 'normal'}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              groupMeta: {
                                ...(p.groupMeta || {}),
                                [g.id]: {
                                  name: (p.groupMeta?.[g.id]?.name || g.name) as string,
                                  type: e.target.value as any,
                                  roundFormat: (p.groupMeta?.[g.id]?.roundFormat || 'round_robin') as any,
                                  qualifyCount: Number(p.groupMeta?.[g.id]?.qualifyCount ?? p.qualificationPerGroup ?? 2),
                                  winnerPriority: Boolean(p.groupMeta?.[g.id]?.winnerPriority),
                                },
                              },
                            }))
                          }
                          className="px-2 py-1 border border-gray-300 rounded-md text-xs font-bold"
                        >
                          <option value="normal">Normal</option>
                          <option value="priority">Priority</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <div className="text-[10px] font-bold text-gray-500 mb-1">Round</div>
                          <select
                            value={(formData.groupMeta?.[g.id]?.roundFormat) || 'round_robin'}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                groupMeta: {
                                  ...(p.groupMeta || {}),
                                  [g.id]: {
                                    name: (p.groupMeta?.[g.id]?.name || g.name) as string,
                                    type: (p.groupMeta?.[g.id]?.type || 'normal') as any,
                                    roundFormat: e.target.value as any,
                                    qualifyCount: Number(p.groupMeta?.[g.id]?.qualifyCount ?? p.qualificationPerGroup ?? 2),
                                    winnerPriority: Boolean(p.groupMeta?.[g.id]?.winnerPriority),
                                  },
                                },
                              }))
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs font-bold"
                          >
                            <option value="round_robin">Round Robin</option>
                            <option value="single_match">Single match</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold text-gray-500 mb-1">Qualify</div>
                          <input
                            type="number"
                            min={0}
                            value={Number(formData.groupMeta?.[g.id]?.qualifyCount ?? formData.qualificationPerGroup ?? 2)}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                groupMeta: {
                                  ...(p.groupMeta || {}),
                                  [g.id]: {
                                    name: (p.groupMeta?.[g.id]?.name || g.name) as string,
                                    type: (p.groupMeta?.[g.id]?.type || 'normal') as any,
                                    roundFormat: (p.groupMeta?.[g.id]?.roundFormat || 'round_robin') as any,
                                    qualifyCount: Number(e.target.value || 0),
                                    winnerPriority: Boolean(p.groupMeta?.[g.id]?.winnerPriority),
                                  },
                                },
                              }))
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs font-bold"
                          />
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-2">
                        <input
                          type="checkbox"
                          checked={Boolean(formData.groupMeta?.[g.id]?.winnerPriority)}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              groupMeta: {
                                ...(p.groupMeta || {}),
                                [g.id]: {
                                  name: (p.groupMeta?.[g.id]?.name || g.name) as string,
                                  type: (p.groupMeta?.[g.id]?.type || 'normal') as any,
                                  roundFormat: (p.groupMeta?.[g.id]?.roundFormat || 'round_robin') as any,
                                  qualifyCount: Number(p.groupMeta?.[g.id]?.qualifyCount ?? p.qualificationPerGroup ?? 2),
                                  winnerPriority: e.target.checked,
                                },
                              },
                            }))
                          }
                        />
                        Winner priority
                      </label>
                      <div className="space-y-1">
                        {g.squadIds.length === 0 ? (
                          <div className="text-xs text-gray-500">No squads assigned</div>
                        ) : (
                          g.squadIds.map((sid) => (
                            <div key={sid} className="text-xs font-semibold text-gray-700">
                              {squads.find((x) => x.id === sid)?.name || 'Squad'}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-500 mt-3">
                  Qualified teams = Σ qualify/group + wildcards
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50 transition"
              >
                {saving ? 'Saving...' : mode === 'create' ? 'Create Tournament' : 'Update Tournament'}
              </button>
              <Link
                to="/admin/tournaments"
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Cancel
              </Link>
            </div>
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
        <TableSkeleton columns={5} rows={8} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tournaments</h1>
          <p className="text-gray-600 mt-1">Manage all tournaments</p>
        </div>
        <Link
          to="/admin/tournaments/new"
          className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition"
        >
          + New Tournament
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Format
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tournaments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No tournaments found. Create your first tournament!
                  </td>
                </tr>
              ) : (
                tournaments.map((tournament) => (
                  <tr key={tournament.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{tournament.name}</div>
                      {tournament.school && (
                        <div className="text-sm text-gray-500">{tournament.school}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">{tournament.year}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                        {tournament.format}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          tournament.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : tournament.status === 'ongoing'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {tournament.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <Link
                          to={`/admin/tournaments/${tournament.id}/edit`}
                          className="text-teal-600 hover:text-teal-700"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(tournament.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
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
    </div>
  )
}

