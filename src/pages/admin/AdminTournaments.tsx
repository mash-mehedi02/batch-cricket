/**
 * Professional Tournament Management Page
 * Comprehensive admin panel for managing tournaments with all features
 */

import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { squadService } from '@/services/firestore/squads'
import { matchService } from '@/services/firestore/matches'
import { Tournament, Squad, Match } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { generateMatchNumber } from '@/utils/matchNumber'

import toast from 'react-hot-toast'
import { Timestamp } from 'firebase/firestore'
import { generateGroupFixtures } from '@/engine/tournament/fixtures'
import { generateKnockoutBracket, generateKnockoutFixtures } from '@/engine/tournament/knockout'
import TableSkeleton from '@/components/skeletons/TableSkeleton'
import { Settings, Edit2, CheckCircle, Search, Trash2, Plus, Filter, MoreHorizontal, Trophy, Calendar } from 'lucide-react'
import WheelDatePicker from '@/components/common/WheelDatePicker'

interface AdminTournamentsProps {
  mode?: 'dashboard' | 'list' | 'create' | 'edit' | 'groups' | 'fixtures' | 'knockout' | 'standings' | 'settings';
}

export default function AdminTournaments({ mode = 'list' }: AdminTournamentsProps) {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(mode)
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
    oversLimit: 20,
    pointsForWin: 2,
    pointsForLoss: 0,
    pointsForTie: 1,
    pointsForNoResult: 1,
    logoUrl: '',
    bannerUrl: '',
    location: '',
    groupBySquadId: {} as Record<string, string>,
    groupMeta: {} as Record<
      string,
      { name: string; type: 'normal' | 'priority'; roundFormat: 'round_robin' | 'single_match' | 'custom'; qualifyCount: number; winnerPriority: boolean }
    >,
  })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    setActiveTab(mode);
    if (mode === 'list' || mode === 'dashboard') {
      loadTournaments()
      loadSquads() // Load squads for dashboard mode too
    } else if (mode === 'create') {
      loadSquads()
    } else if (id) {
      loadTournament(id)
      loadSquads()
      loadMatches(id)
    }
  }, [mode, id])

  // Auto-populate squads from matches if missing in tournament config
  useEffect(() => {
    if (!loading && matches.length > 0 && formData.participantSquadIds.length === 0) {
      const matchSquadIds = new Set<string>()
      matches.forEach(m => {
        if (m.teamAId) matchSquadIds.add(m.teamAId)
        if (m.teamBId) matchSquadIds.add(m.teamBId)
      })
      const ids = Array.from(matchSquadIds)
      if (ids.length > 0) {
        console.log('Auto-detected participating squads from matches:', ids)
        setFormData(prev => ({
          ...prev,
          participantSquadIds: ids,
          groupBySquadId: ensureGroupAssignments(ids, prev.groupCount, prev.groupBySquadId)
        }))
      }
    }
  }, [loading, matches.length]) // Only dependency on length to avoid loops

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
      console.log('[AdminTournaments] Loaded squads:', data.map(s => ({ id: s.id, name: s.name })))
      setSquads(data)
    } catch (e) {
      console.error('Error loading squads:', e)
      setSquads([])
    }
  }

  const loadMatches = async (tournamentId: string) => {
    try {
      const data = await matchService.getByTournament(tournamentId)
      setMatches(data)
    } catch (e) {
      console.error('Error loading matches:', e)
      setMatches([])
    }
  }

  const loadTournament = async (tournamentId: string) => {
    console.log('[AdminTournaments] Loading tournament:', tournamentId);
    try {
      const data = await tournamentService.getById(tournamentId)
      console.log('[AdminTournaments] Tournament data received:', data);
      if (data) {
        const groups = (data as any).groups || []
        const groupBySquadId: Record<string, string> = {}
        groups.forEach((g: any) => {
          ; (g.squadIds || []).forEach((sid: string) => {
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

        // Ensure all fields are present in the form data
        setFormData(prev => ({
          ...prev, // Spread the default values first
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
          oversLimit: (data as any).oversLimit ?? prev.oversLimit,
          pointsForWin: (data as any).pointsForWin ?? prev.pointsForWin,
          pointsForLoss: (data as any).pointsForLoss ?? prev.pointsForLoss,
          pointsForTie: (data as any).pointsForTie ?? prev.pointsForTie,
          pointsForNoResult: (data as any).pointsForNoResult ?? prev.pointsForNoResult,
          logoUrl: (data as any).logoUrl || '',
          bannerUrl: (data as any).bannerUrl || '',
          location: (data as any).location || '',
          groupBySquadId,
          groupMeta,
        }))
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
        const s = squads.find((x: any) => x.id === sid)
        // Use available fields from the Squad type - fallback to id if name is not available
        const name = String((s?.name || s?.id || '')).trim() || sid
        const batch = String((s?.batch || '')).trim() || undefined
        participantSquadMeta[sid] = { name, ...(batch ? { batch } : {}) }
      })

      const config: any = {
        version: 1,
        kind: formData.tournamentType,
        year: formData.year,
        stage: 'group',
        points: {
          win: formData.pointsForWin,
          loss: formData.pointsForLoss,
          tie: formData.pointsForTie,
          noResult: formData.pointsForNoResult
        },
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
        oversLimit: formData.oversLimit,
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
        oversLimit: formData.oversLimit,
        pointsForWin: formData.pointsForWin,
        pointsForLoss: formData.pointsForLoss,
        pointsForTie: formData.pointsForTie,
        pointsForNoResult: formData.pointsForNoResult,
        logoUrl: formData.logoUrl,
        bannerUrl: formData.bannerUrl,
        location: formData.location,
      }

      if (mode === 'create') {
        await tournamentService.create({
          ...(persistPayload as any),
          stages: [
            { id: 'group-stage', name: 'Group Stage', type: 'group', order: 0, status: 'active' },
            { id: 'final-stage', name: 'Final', type: 'knockout', order: 1, status: 'pending' }
          ],
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

  const handleGenerateFixtures = async () => {
    if (!id) return;

    setGenerating(true);
    try {
      // Generate fixtures based on tournament configuration
      const tournament = await tournamentService.getById(id);
      if (!tournament) throw new Error('Tournament not found');

      // Get the tournament config and generate group fixtures
      const config = (tournament as any).config;
      const fixturePlan = generateGroupFixtures(config);

      // Create match records for each fixture
      for (const fixture of fixturePlan.matches) {
        // Find the group for this match
        const group = config.groups.find((g: any) => g.id === fixture.groupId);

        // Create a match record
        const matchData = {
          tournamentId: id,
          groupId: fixture.groupId,
          groupName: group?.name || `Group ${fixture.groupId}`,
          teamAId: fixture.home,
          teamBId: fixture.away,
          // Find team names from squads
          teamAName: squads.find((s: any) => s.id === fixture.home)?.name || `Team ${fixture.home.substring(0, 8)}`,
          teamBName: squads.find((s: any) => s.id === fixture.away)?.name || `Team ${fixture.away.substring(0, 8)}`,
          venue: '',
          date: '',
          time: '',
          year: formData.year,
          startTime: Timestamp.now(),
          oversLimit: formData.oversLimit,
          ballType: 'white' as const,
          status: 'upcoming' as const,
          matchPhase: 'FirstInnings' as const,
          teamAPlayingXI: [],
          teamBPlayingXI: [],
          teamACaptainId: '',
          teamAKeeperId: '',
          teamBCaptainId: '',
          teamBKeeperId: '',
          currentBatting: 'teamA' as const,
          currentStrikerId: '',
          currentNonStrikerId: '',
          currentBowlerId: '',
          lastOverBowlerId: '',
          freeHit: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: user?.uid || '',
        };

        // Generate and add match number
        matchData.matchNo = await generateMatchNumber(id, tournament.name);

        await matchService.create(matchData);
      }

      toast.success(`${fixturePlan.matches.length} fixtures generated successfully!`);
      // Reload matches to show the new fixtures
      loadMatches(id);
    } catch (error) {
      console.error('Error generating fixtures:', error);
      toast.error('Failed to generate fixtures');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateKnockout = async () => {
    if (!id) return;

    setGenerating(true);
    try {
      // Validate that tournament exists and has proper configuration
      const tournament = await tournamentService.getById(id);
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      // Check if group stage is enabled and completed matches exist
      const groupMatches = matches.filter(m => (m as any).stage === 'group' || !(m as any).stage);
      const completedGroupMatches = groupMatches.filter(m => m.status === 'finished' || m.status === 'abandoned');

      if (groupMatches.length > 0 && completedGroupMatches.length === 0) {
        toast.error('Group stage matches must be completed before generating knockout fixtures');
        setGenerating(false);
        return;
      }

      // Generate knockout stage fixtures based on group results
      await generateKnockoutFixtures(id);

      toast.success('Knockout fixtures generated successfully!');
      // Reload matches to show newly generated fixtures
      if (id) {
        loadMatches(id);
      }
    } catch (error) {
      console.error('Error generating knockout fixtures:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate knockout fixtures');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (tournamentId: string) => {
    if (!confirm('Are you sure you want to delete this tournament? This will also delete all associated matches.')) return

    try {
      await tournamentService.delete(tournamentId)
      toast.success('Tournament deleted')
      loadTournaments()
    } catch (error) {
      console.error('Error deleting tournament:', error)
      toast.error('Failed to delete tournament')
    }
  }

  // Navigation tabs for the tournament manager
  const renderNavigation = () => (
    <div className="mb-6">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          <button
            onClick={() => navigate(`/admin/tournaments/${id}/dashboard`)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'dashboard'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => navigate(`/admin/tournaments/${id}/groups`)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'groups'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Groups
          </button>
          <button
            onClick={() => navigate(`/admin/tournaments/${id}/fixtures`)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'fixtures'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Fixtures
          </button>
          <button
            onClick={() => navigate(`/admin/tournaments/${id}/knockout`)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'knockout'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Knockout
          </button>
          <button
            onClick={() => navigate(`/admin/tournaments/${id}/standings`)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'standings'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Standings
          </button>
          <button
            onClick={() => navigate(`/admin/tournaments/${id}/settings`)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'settings'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Settings
          </button>
        </nav>
      </div>
    </div>
  );

  // Dashboard view
  const renderDashboard = () => (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="text-sm font-semibold text-gray-500">Total Teams</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {formData.participantSquadIds.length}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="text-sm font-semibold text-gray-500">Total Groups</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {formData.groupCount}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="text-sm font-semibold text-gray-500">Total Matches</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {matches.length}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="text-sm font-semibold text-gray-500">Status</div>
          <div className="text-3xl font-bold text-gray-900 mt-2 capitalize">
            {formData.status}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
          </div>
          <div className="space-y-3">
            <button
              onClick={handleGenerateFixtures}
              disabled={generating}
              className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50 transition"
            >
              {generating ? 'Generating...' : 'Generate Fixtures'}
            </button>
            <button
              onClick={handleGenerateKnockout}
              disabled={generating}
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {generating ? 'Generating...' : 'Generate Knockout'}
            </button>
            <Link
              to={`/admin/tournaments/${id}/edit`}
              className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition block text-center"
            >
              Edit Tournament
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Tournament Info</h3>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-500">Name</div>
              <div className="font-semibold">{formData.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Format</div>
              <div className="font-semibold">{formData.format}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Dates</div>
              <div className="font-semibold">{formData.startDate} to {formData.endDate}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <div className="font-semibold capitalize">{formData.status}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Groups management view
  const renderGroups = () => {
    const selectedIds = Array.from(new Set(formData.participantSquadIds || [])).filter(Boolean);
    const unknownIds = selectedIds.filter(id => !squads.find((s: any) => s.id === id));
    const safeGroupBy = ensureGroupAssignments(selectedIds, formData.groupCount, formData.groupBySquadId);
    const gids = groupIds(formData.groupCount);
    const groupsPreview = gids.map((gid, idx) => ({
      id: gid,
      name: formData.groupMeta?.[gid]?.name || groupLabel(idx),
      squadIds: selectedIds.filter((sid) => safeGroupBy[sid] === gid),
    }));

    return (
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Manage Groups</h2>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setFormData(prev => ({
                  ...prev,
                  groupCount: Math.min(8, prev.groupCount + 1)
                }));
              }}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition"
            >
              + Add Group
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Number of Groups
          </label>
          <input
            type="number"
            min={1}
            max={8}
            value={formData.groupCount}
            onChange={(e) => {
              const next = Math.max(1, Math.min(8, Number(e.target.value || 1)));
              setFormData((p) => ({
                ...p,
                groupCount: next,
                groupBySquadId: ensureGroupAssignments(selectedIds, next, p.groupBySquadId),
              }));
            }}
            className="w-24 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">Teams</h3>

            {/* Warning for unknown teams */}
            {unknownIds.length > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">Unrecognized Teams (from matches)</h4>
                <div className="space-y-1">
                  {unknownIds.map(id => (
                    <div key={id} className="flex items-center gap-2 text-sm text-amber-900 bg-white/50 px-2 py-1 rounded">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="font-mono text-xs overflow-hidden text-ellipsis w-32">{id}</span>
                      <select
                        value={safeGroupBy[id] || gids[0]}
                        onChange={(e) => setFormData((p) => ({
                          ...p,
                          groupBySquadId: { ...safeGroupBy, [id]: e.target.value }
                        }))}
                        className="ml-auto px-2 py-0.5 border border-amber-300 rounded text-xs bg-white"
                      >
                        {gids.map((gid, idx) => (
                          <option key={gid} value={gid}>
                            {formData.groupMeta?.[gid]?.name || groupLabel(idx)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {squads.length === 0 && (
                <div className="p-6 text-center bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                  <p className="text-sm text-slate-500 font-medium">No squads found in library.</p>
                </div>
              )}
              {squads.map((squad: any) => {
                const checked = selectedIds.includes(squad.id);
                return (
                  <label
                    key={squad.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${checked ? 'bg-teal-50 border-teal-200' : 'border-gray-200 hover:bg-gray-50'
                      } cursor-pointer`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const nextIds = checked
                          ? selectedIds.filter((id) => id !== squad.id)
                          : [...selectedIds, squad.id];
                        setFormData((p) => ({
                          ...p,
                          participantSquadIds: nextIds,
                          groupBySquadId: ensureGroupAssignments(nextIds, p.groupCount, p.groupBySquadId),
                        }));
                      }}
                      className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{squad.name || squad.id}</div>
                      <div className="text-xs text-gray-500">Batch: {squad.batch || 'N/A'}</div>
                    </div>
                    {checked && (
                      <select
                        value={safeGroupBy[squad.id] || gids[0]}
                        onChange={(e) => setFormData((p) => ({
                          ...p,
                          groupBySquadId: { ...safeGroupBy, [squad.id]: e.target.value }
                        }))}
                        className="px-2 py-1 border border-gray-300 rounded-md text-xs font-bold"
                      >
                        {gids.map((gid, idx) => (
                          <option key={gid} value={gid}>
                            {formData.groupMeta?.[gid]?.name || groupLabel(idx)}
                          </option>
                        ))}
                      </select>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">Groups Configuration</h3>
            <div className="space-y-4">
              {groupsPreview.map((g) => (
                <div key={g.id} className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="text"
                      value={formData.groupMeta?.[g.id]?.name || g.name}
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-semibold text-gray-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="text-xs font-bold text-gray-500 mb-1">Type</div>
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
                        className="w-full px-2 py-1 border border-gray-300 rounded-md text-xs font-bold"
                      >
                        <option value="normal">Normal</option>
                        <option value="priority">Priority</option>
                      </select>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-gray-500 mb-1">Round Format</div>
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
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="text-xs font-bold text-gray-500 mb-1">Qualify Count</div>
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

                    <div className="flex items-center">
                      <label className="flex items-center gap-2 text-xs font-bold text-gray-700">
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
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-bold text-gray-700 mb-1">Teams in Group:</div>
                    {g.squadIds.length === 0 ? (
                      <div className="text-xs text-gray-500 italic">No teams assigned</div>
                    ) : (
                      g.squadIds.map((sid) => (
                        <div key={sid} className="text-xs font-semibold text-gray-700">
                          {squads.find((x: any) => x.id === sid)?.name || 'Team'}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-xs font-bold text-gray-700 mb-1">Qualification Summary</div>
              <div className="text-xs text-gray-500">
                Total qualified teams = ({formData.groupCount} × {formData.qualificationPerGroup}) + {formData.wildcardQualifiers} wildcards = {
                  (formData.groupCount * formData.qualificationPerGroup) + formData.wildcardQualifiers
                }
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Fixtures management view
  const renderFixtures = () => {
    console.log('[renderFixtures] Squads data:', squads);
    console.log('[renderFixtures] Matches data:', matches.filter(m => m.tournamentId === id));

    // Get all matches for this tournament
    const tournamentMatches = matches.filter(m => m.tournamentId === id);

    // Group matches by group
    const groupedMatches: Record<string, Match[]> = {};
    tournamentMatches.forEach(match => {
      const groupId = (match as any).groupId || 'ungrouped';
      if (!groupedMatches[groupId]) {
        groupedMatches[groupId] = [];
      }
      groupedMatches[groupId].push(match);
    });

    return (
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Manage Fixtures</h2>
          <div className="flex gap-3">
            <button
              onClick={handleGenerateFixtures}
              disabled={generating}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50 transition"
            >
              {generating ? 'Generating...' : 'Generate Fixtures'}
            </button>
            <Link
              to={`/admin/matches/new?tournament=${id}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              + Add Match
            </Link>
          </div>
        </div>

        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-bold text-blue-800 mb-2">Quick Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className="text-2xl font-bold text-gray-900">{tournamentMatches.length}</div>
              <div className="text-sm text-gray-600">Total Matches</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className="text-2xl font-bold text-gray-900">{tournamentMatches.filter(m => m.status === 'upcoming').length}</div>
              <div className="text-sm text-gray-600">Scheduled</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className="text-2xl font-bold text-gray-900">{tournamentMatches.filter(m => m.status === 'finished').length}</div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg border">
              <div className="text-2xl font-bold text-gray-900">{tournamentMatches.filter(m => m.status === 'live').length}</div>
              <div className="text-sm text-gray-600">Live Now</div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {Object.entries(groupedMatches).map(([groupId, groupMatches]) => {
            const groupName = (formData as any).groups?.find((g: any) => g.id === groupId)?.name || groupId;
            return (
              <div key={groupId} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="font-bold text-gray-800">{groupName} Matches</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {groupMatches.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      No matches scheduled for this group.
                    </div>
                  ) : (
                    groupMatches.map((match: any) => {
                      const teamA = squads.find((s: any) => s.id === match.teamAId)?.name || match.teamAName || 'Team A';
                      const teamB = squads.find((s: any) => s.id === match.teamBId)?.name || match.teamBName || 'Team B';

                      return (
                        <div key={match.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <div className="font-semibold text-gray-900 truncate">{teamA} vs {teamB}</div>
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${match.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                match.status === 'live' ? 'bg-red-100 text-red-800' :
                                  match.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                {match.status}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {match.date && `${new Date(match.date.seconds * 1000).toLocaleDateString()} `}
                              {match.time && `at ${match.time}`}
                              {match.venue && ` • ${match.venue}`}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Link
                              to={`/admin/matches/edit/${match.id}`}
                              className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                            >
                              Edit
                            </Link>
                            <Link
                              to={`/matches/${match.id}`}
                              className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                            >
                              View
                            </Link>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          {Object.keys(groupedMatches).length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No matches created yet. Generate fixtures or add matches manually.
            </div>
          )}
        </div>
      </div>
    );
  };

  // Knockout stage management view
  const renderKnockout = () => {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Knockout Stage</h2>
          <button
            onClick={handleGenerateKnockout}
            disabled={generating}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 transition"
          >
            {generating ? 'Generating...' : 'Generate Knockout'}
          </button>
        </div>

        <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <h3 className="text-lg font-bold text-purple-800 mb-2">Knockout Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-white rounded-lg border">
              <div className="text-sm font-semibold text-gray-700">Format</div>
              <div className="text-lg font-bold text-gray-900">{formData.tournamentType === 'custom' ? 'Custom' : 'Standard'}</div>
            </div>
            <div className="p-3 bg-white rounded-lg border">
              <div className="text-sm font-semibold text-gray-700">Qualification</div>
              <div className="text-lg font-bold text-gray-900">
                Top {formData.qualificationPerGroup} from each group
                {formData.wildcardQualifiers > 0 && ` + ${formData.wildcardQualifiers} wildcards`}
              </div>
            </div>
            <div className="p-3 bg-white rounded-lg border">
              <div className="text-sm font-semibold text-gray-700">Status</div>
              <div className="text-lg font-bold text-gray-900 capitalize">{formData.status}</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 text-center">
          <div className="text-gray-500 mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Knockout Stage</h3>
          <p className="text-gray-500 mb-4">
            The knockout stage will be generated after the group stage is completed.
            Qualified teams will advance based on tournament configuration.
          </p>
          <div className="inline-flex flex-wrap gap-3">
            <button
              onClick={handleGenerateKnockout}
              disabled={generating || formData.status !== 'ongoing'}
              className={`px-4 py-2 rounded-lg font-semibold transition ${formData.status === 'ongoing'
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
            >
              Generate Bracket
            </button>
            <Link
              to={`/admin/matches/new?tournament=${id}&stage=knockout`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
            >
              Create Manually
            </Link>
          </div>
        </div>
      </div>
    );
  };

  // Standings view
  const renderStandings = () => {
    // Get all matches for this tournament
    const tournamentMatches = matches.filter(m => m.tournamentId === id);

    // Calculate standings for each group
    const calculateStandings = () => {
      const standingsMap: Record<string, any[]> = {};

      // Initialize standings for each group
      (tournaments.find(t => t.id === id) as any)?.groups?.forEach((group: any) => {
        const groupTeams = group.squadIds.map((squadId: string) => {
          const squad = squads.find((s: any) => s.id === squadId);
          return {
            id: squadId,
            name: squad?.name || squadId,
            played: 0,
            won: 0,
            lost: 0,
            tied: 0,
            noResult: 0,
            points: 0,
            netRunRate: 0,
            position: 0
          };
        });
        standingsMap[group.id] = groupTeams;
      });

      // Process matches to calculate results
      tournamentMatches.forEach(match => {
        if (match.status !== 'finished') return; // Only completed matches

        const groupId = (match as any).groupId;
        if (!groupId || !standingsMap[groupId]) return;

        // This is a simplified calculation - in a real app you'd have actual match results
        // For now, we'll just show the structure
      });

      // Sort each group by points and net run rate
      Object.keys(standingsMap).forEach(groupId => {
        standingsMap[groupId].sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return b.netRunRate - a.netRunRate; // Simplified NRR comparison
        });

        // Assign positions
        standingsMap[groupId].forEach((team, index) => {
          team.position = index + 1;
        });
      });

      return standingsMap;
    };

    const standings = calculateStandings();

    return (
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Standings & Results</h2>
          <div className="flex gap-3">
            <Link
              to={`/admin/tournaments/${id}/fixtures`}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
            >
              View Fixtures
            </Link>
            <Link
              to={`/tournaments/${id}/standings`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Public View
            </Link>
          </div>
        </div>

        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-lg font-bold text-blue-800 mb-2">Tournament Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-white rounded-lg border">
              <div className="text-sm font-semibold text-gray-700">Total Teams</div>
              <div className="text-xl font-bold text-gray-900">{formData.participantSquadIds.length}</div>
            </div>
            <div className="p-3 bg-white rounded-lg border">
              <div className="text-sm font-semibold text-gray-700">Total Groups</div>
              <div className="text-xl font-bold text-gray-900">{formData.groupCount}</div>
            </div>
            <div className="p-3 bg-white rounded-lg border">
              <div className="text-sm font-semibold text-gray-700">Matches Played</div>
              <div className="text-xl font-bold text-gray-900">{tournamentMatches.filter(m => m.status === 'finished').length}</div>
            </div>
            <div className="p-3 bg-white rounded-lg border">
              <div className="text-sm font-semibold text-gray-700">Matches Remaining</div>
              <div className="text-xl font-bold text-gray-900">{tournamentMatches.filter(m => m.status !== 'finished').length}</div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {Object.entries(standings).map(([groupId, groupStandings]) => {
            const tournamentData = tournaments.find(t => t.id === id);
            const groupName = (tournamentData as any)?.groups?.find((g: any) => g.id === groupId)?.name || groupId;
            return (
              <div key={groupId} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="font-bold text-gray-800">{groupName} Standings</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                          Pos
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Team
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                          P
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                          W
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                          L
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                          T
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                          Pts
                        </th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                          NRR
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {groupStandings.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                            No standings calculated yet.
                          </td>
                        </tr>
                      ) : (
                        groupStandings.map((team, index) => (
                          <tr key={team.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                              {team.position}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                              {team.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                              {team.played}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                              {team.won}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                              {team.lost}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                              {team.tied}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900">
                              {team.points}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">
                              {team.netRunRate.toFixed(3)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {Object.keys(standings).length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No standings available. Matches need to be completed to calculate results.
            </div>
          )}
        </div>
      </div>
    );
  };

  // Settings view
  const renderSettings = () => {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Tournament Settings</h2>

        <div className="space-y-6">
          <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Tournament Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-1">Tournament Name</div>
                <div className="text-gray-900">{formData.name}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-1">Year</div>
                <div className="text-gray-900">{formData.year}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-1">Format</div>
                <div className="text-gray-900">{formData.format}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-1">Status</div>
                <div className="text-gray-900 capitalize">{formData.status}</div>
              </div>
            </div>
          </div>

          <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Scoring System</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-green-600">{formData.pointsForWin}</div>
                <div className="text-sm text-gray-600">Win</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-red-600">{formData.pointsForLoss}</div>
                <div className="text-sm text-gray-600">Loss</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-yellow-600">{formData.pointsForTie}</div>
                <div className="text-sm text-gray-600">Tie</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-blue-600">{formData.pointsForNoResult}</div>
                <div className="text-sm text-gray-600">No Result</div>
              </div>
            </div>
          </div>

          <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Qualification Rules</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-1">Teams per Group to Qualify</div>
                <div className="text-gray-900">Top {formData.qualificationPerGroup}</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-1">Wildcard Teams</div>
                <div className="text-gray-900">{formData.wildcardQualifiers}</div>
              </div>
            </div>
          </div>

          <div className="p-5 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Actions</h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate(`/admin/tournaments/${id}/edit`)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Edit Tournament
              </button>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to reset all tournament data? This cannot be undone.')) {
                    // Reset tournament logic would go here
                    toast.success('Tournament reset functionality would go here');
                  }
                }}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 transition"
              >
                Reset Data
              </button>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this tournament? This will also delete all associated matches.')) {
                    handleDelete(id!);
                  }
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition"
              >
                Delete Tournament
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Create/Edit form view
  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="max-w-6xl mx-auto">
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
                  Overs Limit
                </label>
                <input
                  type="number"
                  min={5}
                  max={50}
                  value={formData.oversLimit}
                  onChange={(e) => setFormData({ ...formData, oversLimit: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Start Date
                </label>
                <WheelDatePicker
                  value={formData.startDate || new Date().toISOString().split('T')[0]}
                  onChange={(val) => setFormData({ ...formData, startDate: val })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  End Date
                </label>
                <WheelDatePicker
                  value={formData.endDate || new Date().toISOString().split('T')[0]}
                  onChange={(val) => setFormData({ ...formData, endDate: val })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Points for Win
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.pointsForWin}
                  onChange={(e) => setFormData({ ...formData, pointsForWin: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Points for Loss
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.pointsForLoss}
                  onChange={(e) => setFormData({ ...formData, pointsForLoss: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Points for Tie
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.pointsForTie}
                  onChange={(e) => setFormData({ ...formData, pointsForTie: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Points for No Result
                </label>
                <input
                  type="number"
                  min={0}
                  value={formData.pointsForNoResult}
                  onChange={(e) => setFormData({ ...formData, pointsForNoResult: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Select Participating Squads *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-4 bg-gray-50 rounded-xl border border-gray-100">
                {squads.map((squad) => {
                  const isSelected = formData.participantSquadIds.includes(squad.id);
                  return (
                    <button
                      key={squad.id}
                      type="button"
                      onClick={() => {
                        const next = isSelected
                          ? formData.participantSquadIds.filter(id => id !== squad.id)
                          : [...formData.participantSquadIds, squad.id];
                        setFormData({ ...formData, participantSquadIds: next });
                      }}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${isSelected
                        ? 'bg-teal-50 border-teal-200 text-teal-700 ring-2 ring-teal-500/20'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-teal-200 hover:bg-teal-50/30'
                        }`}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-teal-600 border-teal-600' : 'bg-gray-100 border-gray-300'
                        }`}>
                        {isSelected && <CheckCircle size={12} className="text-white" />}
                      </div>
                      <span className="text-sm font-semibold truncate">{squad.name}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500 font-medium tracking-tight">
                Selected: <span className="text-teal-600 font-black">{formData.participantSquadIds.length}</span> squads. Minimum 2 required.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Logo URL</label>
                <input
                  type="text"
                  value={formData.logoUrl}
                  onChange={(e) => setFormData(p => ({ ...p, logoUrl: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament Banner URL</label>
                <input
                  type="text"
                  value={formData.bannerUrl}
                  onChange={(e) => setFormData(p => ({ ...p, bannerUrl: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="https://..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData(p => ({ ...p, location: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  placeholder="e.g. Bangladesh"
                />
              </div>
            </div>

            <div className="mb-6">
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
    );
  }

  // Main dashboard view
  if (mode === 'dashboard' && id) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to="/admin/tournaments" className="text-teal-600 hover:underline mb-2 inline-block">
            ← Back to Tournaments
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mt-2">{formData.name}</h1>
              <p className="text-gray-600">Manage your tournament efficiently</p>
            </div>
            <div className="flex gap-3">
              <Link
                to={`/admin/tournaments/${id}/edit`}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition"
              >
                Edit Details
              </Link>
            </div>
          </div>
        </div>

        {renderNavigation()}
        {renderDashboard()}
      </div>
    );
  }

  // Groups view
  if (mode === 'groups' && id) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to="/admin/tournaments" className="text-teal-600 hover:underline mb-2 inline-block">
            ← Back to Tournaments
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mt-2">{formData.name}</h1>
              <p className="text-gray-600">Manage tournament groups and teams</p>
            </div>
          </div>
        </div>

        {renderNavigation()}
        {renderGroups()}
      </div>
    );
  }

  // Fixtures view
  if (mode === 'fixtures' && id) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to="/admin/tournaments" className="text-teal-600 hover:underline mb-2 inline-block">
            ← Back to Tournaments
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mt-2">{formData.name}</h1>
              <p className="text-gray-600">Manage tournament fixtures and schedule</p>
            </div>
          </div>
        </div>

        {renderNavigation()}
        {renderFixtures()}
      </div>
    );
  }

  // Knockout view
  if (mode === 'knockout' && id) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to="/admin/tournaments" className="text-teal-600 hover:underline mb-2 inline-block">
            ← Back to Tournaments
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mt-2">{formData.name}</h1>
              <p className="text-gray-600">Manage knockout stage and brackets</p>
            </div>
          </div>
        </div>

        {renderNavigation()}
        {renderKnockout()}
      </div>
    );
  }

  // Standings view
  if (mode === 'standings' && id) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to="/admin/tournaments" className="text-teal-600 hover:underline mb-2 inline-block">
            ← Back to Tournaments
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mt-2">{formData.name}</h1>
              <p className="text-gray-600">View standings and tournament results</p>
            </div>
          </div>
        </div>

        {renderNavigation()}
        {renderStandings()}
      </div>
    );
  }

  // Settings view
  if (mode === 'settings' && id) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link to="/admin/tournaments" className="text-teal-600 hover:underline mb-2 inline-block">
            ← Back to Tournaments
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mt-2">{formData.name}</h1>
              <p className="text-gray-600">Configure tournament settings</p>
            </div>
          </div>
        </div>

        {renderNavigation()}
        {renderSettings()}
      </div>
    );
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
        <TableSkeleton columns={7} rows={8} />
      </div>
    );
  }

  const filteredTournaments = tournaments.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.year && String(t.year).includes(searchTerm))
  )

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tournaments</h1>
          <p className="text-slate-500 text-sm mt-1">Manage seasons, formats, and tournament structures.</p>
        </div>
        <Link
          to="/admin/tournaments/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm"
        >
          <Plus size={18} />
          New Tournament
        </Link>
      </div>

      {/* Filters & Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search tournaments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all bg-white"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 w-[40%]">Tournament Name</th>
                <th className="px-6 py-4">Season</th>
                <th className="px-6 py-4">Format</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Teams</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTournaments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Trophy size={48} strokeWidth={1} className="mb-4 text-slate-200" />
                      <p className="text-lg font-medium text-slate-900">No tournaments found</p>
                      <p className="text-sm">Try adjusting your search or create a new one.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTournaments.map((tournament) => (
                  <tr key={tournament.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0 overflow-hidden">
                          {tournament.logoUrl ? <img src={tournament.logoUrl} className="w-full h-full object-cover" /> : <Trophy size={18} />}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 leading-tight">{tournament.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{tournament.school || 'Official Tournament'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {tournament.year}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {tournament.format}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={tournament.status} />
                    </td>
                    <td className="px-6 py-4 text-center text-slate-600 font-medium">
                      {(tournament as any).participantSquadIds?.length || 0}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Link
                          to={`/admin/tournaments/${tournament.id}/dashboard`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Manage"
                        >
                          <Settings size={18} />
                        </Link>
                        <Link
                          to={`/admin/tournaments/${tournament.id}/edit`}
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </Link>
                        <button
                          onClick={() => handleDelete(tournament.id)}
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
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    ongoing: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    upcoming: 'bg-blue-50 text-blue-600 border-blue-100',
    completed: 'bg-slate-100 text-slate-600 border-slate-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${styles[status] || styles.completed}`}>
      {status === 'ongoing' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse" />}
      {status}
    </span>
  )
}
