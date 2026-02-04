/**
 * Professional Tournament Manager
 * Comprehensive admin panel for managing tournaments with all features
 */

import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { tournamentService } from '@/services/firestore/tournaments';
import { squadService } from '@/services/firestore/squads';
import { matchService } from '@/services/firestore/matches';
import { Tournament, Squad, Match, MatchStatus } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Calendar } from 'lucide-react';
import { formatDateLabel } from '@/utils/date';
import { generateGroupFixtures } from '@/engine/tournament/fixtures';
import { generateKnockoutFixtures } from '@/engine/tournament/knockout';
import { generateMatchNumber } from '@/utils/matchNumber';
import WheelDatePicker from '@/components/common/WheelDatePicker';

interface ProfessionalTournamentManagerProps {
  mode?: 'dashboard' | 'create' | 'edit' | 'groups' | 'fixtures' | 'knockout' | 'standings' | 'settings';
}

export default function ProfessionalTournamentManager({ mode = 'dashboard' }: ProfessionalTournamentManagerProps) {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(mode);
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
    groupBySquadId: {} as Record<string, string>,
    groupMeta: {} as Record<
      string,
      { name: string; type: 'normal' | 'priority'; roundFormat: 'round_robin' | 'single_match' | 'custom'; qualifyCount: number; winnerPriority: boolean }
    >,
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  useEffect(() => {
    setActiveTab(mode);
    if (mode === 'dashboard') {
      loadTournaments();
    } else if (mode === 'create') {
      loadSquads();
    } else if (id) {
      loadTournament(id);
      loadSquads();
      loadMatches(id);
    }
  }, [mode, id]);

  const loadTournaments = async () => {
    try {
      const data = await tournamentService.getAll();
      setTournaments(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading tournaments:', error);
      toast.error('Failed to load tournaments');
      setLoading(false);
    }
  };

  const loadSquads = async () => {
    try {
      const data = await squadService.getAll();
      setSquads(data);
    } catch (e) {
      console.error('Error loading squads:', e);
      setSquads([]);
    }
  };

  const loadMatches = async (tournamentId: string) => {
    try {
      const data = await matchService.getByTournament(tournamentId);
      setMatches(data);
    } catch (e) {
      console.error('Error loading matches:', e);
      setMatches([]);
    }
  };

  const loadTournament = async (tournamentId: string) => {
    try {
      const data = await tournamentService.getById(tournamentId);
      if (data) {
        const groups = (data as any).groups || [];
        const groupBySquadId: Record<string, string> = {};
        groups.forEach((g: any) => {
          (g.squadIds || []).forEach((sid: string) => {
            groupBySquadId[sid] = g.id;
          });
        });
        const groupMeta: Record<string, any> = {};
        groups.forEach((g: any, idx: number) => {
          groupMeta[g.id] = {
            name: g.name || groupLabel(idx),
            type: g.type || 'normal',
            roundFormat: g.roundFormat || 'round_robin',
            qualifyCount: (g.qualification?.qualifyCount ?? (data as any)?.qualification?.perGroup ?? 2) as number,
            winnerPriority: Boolean(g.qualification?.winnerPriority),
          };
        });
        const meta = (data as any).participantSquadMeta || {};
        const metaIds = Object.keys(meta || {});
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
          oversLimit: (data as any).oversLimit ?? 20,
          pointsForWin: (data as any).pointsForWin ?? 2,
          pointsForLoss: (data as any).pointsForLoss ?? 0,
          pointsForTie: (data as any).pointsForTie ?? 1,
          pointsForNoResult: (data as any).pointsForNoResult ?? 1,
          groupBySquadId,
          groupMeta,
        });
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading tournament:', error);
      toast.error('Failed to load tournament');
      setLoading(false);
    }
  };

  const groupIds = (count: number) => Array.from({ length: Math.max(1, count) }).map((_, i) => `group-${i + 1}`);
  const groupLabel = (idx: number) => `Group ${String.fromCharCode(65 + idx)}`;

  const ensureGroupAssignments = (ids: string[], count: number, current: Record<string, string>) => {
    const gids = groupIds(count);
    const next: Record<string, string> = { ...current };
    let cursor = 0;
    ids.forEach((sid) => {
      if (!next[sid] || !gids.includes(next[sid])) {
        next[sid] = gids[cursor % gids.length];
        cursor += 1;
      }
    });
    // Remove stale keys
    Object.keys(next).forEach((sid) => {
      if (!ids.includes(sid)) delete next[sid];
    });
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const selectedIds = Array.from(new Set(formData.participantSquadIds || [])).filter(Boolean);
      if (selectedIds.length < 2) {
        toast.error('Select at least 2 squads');
        setSaving(false);
        return;
      }
      const groupBySquadId = ensureGroupAssignments(selectedIds, formData.groupCount, formData.groupBySquadId);
      const gids = groupIds(formData.groupCount);
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
      }));

      // Persist participant display names for reliable points table rendering
      const participantSquadMeta: Record<string, { name: string; batch?: string }> = {};
      selectedIds.forEach((sid) => {
        const s = squads.find((x: any) => x.id === sid);
        const name = String((s?.name || '')).trim() || sid;
        const batch = String((s?.batch || '')).trim() || undefined;
        participantSquadMeta[sid] = { name, ...(batch ? { batch } : {}) };
      });

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
      };

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
      };

      if (mode === 'create') {
        await tournamentService.create({
          ...(persistPayload as any),
          adminId: user?.uid || '',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: user?.uid || '',
        } as any);
        toast.success('Tournament created successfully!');
        navigate('/admin/tournaments');
      } else if (mode === 'edit' && id) {
        await tournamentService.update(id, {
          ...(persistPayload as any),
          updatedAt: Timestamp.now(),
        } as any);
        toast.success('Tournament updated successfully!');
        navigate('/admin/tournaments');
      }
    } catch (error) {
      console.error('Error saving tournament:', error);
      toast.error(String((error as any)?.message || (error as any)?.code || 'Failed to save tournament'));
    } finally {
      setSaving(false);
    }
  };

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
          oversLimit: formData.oversLimit,
          status: 'upcoming' as MatchStatus,
          ballType: 'white' as any,
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
          createdBy: user?.uid || '',
          adminId: user?.uid || '',
          // Extra props for UI / future needs
          stage: 'group',
          stageLabel: 'Group',
        };

        // Generate and add match number
        (matchData as any).matchNo = await generateMatchNumber(id, tournament.name);

        await matchService.create(matchData as any);
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
      loadMatches(id); // Reload matches to show newly generated fixtures
    } catch (error) {
      console.error('Error generating knockout fixtures:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate knockout fixtures');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (tournamentId: string) => {
    if (!confirm('Are you sure you want to delete this tournament? This will also delete all associated matches.')) return;

    try {
      await tournamentService.delete(tournamentId);
      toast.success('Tournament deleted');
      loadTournaments();
    } catch (error) {
      console.error('Error deleting tournament:', error);
      toast.error('Failed to delete tournament');
    }
  };

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
            <div className="space-y-2 max-h-96 overflow-y-auto">
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
                      <div className="font-semibold text-gray-900 truncate">{squad.name}</div>
                      <div className="text-xs text-gray-500">Batch: {squad.batch || squad.year}</div>
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

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Start Date
                </label>
                <div
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 cursor-pointer bg-white flex items-center justify-between"
                  onClick={() => setShowStartDatePicker(!showStartDatePicker)}
                >
                  <span className={formData.startDate ? "text-slate-900" : "text-slate-400"}>
                    {formData.startDate ? formatDateLabel(formData.startDate) : 'Select Start Date'}
                  </span>
                  <Calendar size={18} className="text-slate-400" />
                </div>

                {showStartDatePicker && (
                  <div className="absolute z-[100] mt-2 left-0 right-0 sm:right-auto sm:w-[320px]">
                    <div className="fixed inset-0 z-0" onClick={() => setShowStartDatePicker(false)}></div>
                    <div className="relative z-10 bg-white rounded-2xl shadow-xl border border-slate-200 p-2">
                      <WheelDatePicker
                        value={formData.startDate || new Date().toISOString().split('T')[0]}
                        onChange={(val) => setFormData({ ...formData, startDate: val })}
                      />
                      <button
                        type="button"
                        className="w-full mt-2 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm"
                        onClick={() => setShowStartDatePicker(false)}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  End Date
                </label>
                <div
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 cursor-pointer bg-white flex items-center justify-between"
                  onClick={() => setShowEndDatePicker(!showEndDatePicker)}
                >
                  <span className={formData.endDate ? "text-slate-900" : "text-slate-400"}>
                    {formData.endDate ? formatDateLabel(formData.endDate) : 'Select End Date'}
                  </span>
                  <Calendar size={18} className="text-slate-400" />
                </div>

                {showEndDatePicker && (
                  <div className="absolute z-[100] mt-2 left-0 right-0 sm:right-auto sm:w-[320px]">
                    <div className="fixed inset-0 z-0" onClick={() => setShowEndDatePicker(false)}></div>
                    <div className="relative z-10 bg-white rounded-2xl shadow-xl border border-slate-200 p-2">
                      <WheelDatePicker
                        value={formData.endDate || new Date().toISOString().split('T')[0]}
                        onChange={(val) => setFormData({ ...formData, endDate: val })}
                      />
                      <button
                        type="button"
                        className="w-full mt-2 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm"
                        onClick={() => setShowEndDatePicker(false)}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
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
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
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
                  Teams
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Matches
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tournaments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
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
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${tournament.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : tournament.status === 'ongoing'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                          }`}
                      >
                        {tournament.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {(() => {
                        const squadIds = (tournament as any).participantSquadIds || [];
                        return squadIds.length;
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700">
                      {(() => {
                        const tournamentMatches = matches.filter(m => m.tournamentId === tournament.id);
                        return tournamentMatches.length;
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/admin/tournaments/${tournament.id}/dashboard`}
                          className="text-teal-600 hover:text-teal-700 text-sm"
                        >
                          Manage
                        </Link>
                        <Link
                          to={`/admin/tournaments/${tournament.id}/edit`}
                          className="text-blue-600 hover:text-blue-700 text-sm"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(tournament.id)}
                          className="text-red-600 hover:text-red-700 text-sm"
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
  );
}