import { useState, useMemo } from 'react';
import { Plus, Search, Calendar, Clock, Trophy, MoreVertical, Share2, Filter, Users, AlertTriangle, Save, Mic, Lock, Check, X, Calendar as CalendarIcon, MapPin, ExternalLink, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { matchService } from '@/services/firestore/matches';
import { squadService } from '@/services/firestore/squads';
import { Tournament, Squad, Match, MatchStatus } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import MatchSetupModal from './MatchSetupModal';
import { formatDateLabel } from '@/utils/date';
import WheelDatePicker from '@/components/common/WheelDatePicker';

interface MatchManagerProps {
    tournament: Tournament;
    matches: Match[];
    squads: Squad[];
}

export default function MatchManager({ tournament, matches, squads }: MatchManagerProps) {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [search, setSearch] = useState('');
    const [stageFilter, setStageFilter] = useState('all');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Setup Modal State
    const [setupMatch, setSetupMatch] = useState<Match | null>(null);
    const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);

    // Create Form State
    const [activeFormTab, setActiveFormTab] = useState<'basic' | 'setup'>('basic');
    const [formData, setFormData] = useState({
        groupId: '',
        teamA: '',
        teamB: '',
        date: new Date().toISOString().split('T')[0],
        time: '14:00',
        venue: tournament.location || '',
        oversLimit: (tournament as any).oversLimit || 20,
        stage: 'group' as 'group' | 'knockout' | 'semi_final' | 'final',
        tossWinner: '',
        tossDecision: 'bat' as 'bat' | 'bowl',
        teamAPlayingXI: [] as string[],
        teamBPlayingXI: [] as string[]
    });

    const formatMatchDate = (date: any) => {
        if (!date) return 'TBD';
        if (typeof date === 'string') return date;
        if (date.toDate) return date.toDate().toLocaleDateString();
        if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString();
        return String(date);
    };

    const filteredMatches = matches.filter(m => {
        const term = search.toLowerCase();
        const matchName = `${m.teamAName} vs ${m.teamBName}`.toLowerCase();
        const matchesSearch = matchName.includes(term) || m.id.toLowerCase().includes(term) || (m as any).matchNo?.toLowerCase().includes(term);
        const matchesStage = stageFilter === 'all' || (m as any).stage === stageFilter;
        return matchesSearch && matchesStage;
    });

    // --- Helpers for Form ---
    const groups = useMemo(() => {
        const raw = ((tournament as any).config?.groups || (tournament as any).groups || []) as any[];
        return raw.map((g: any) => ({
            id: g.id,
            name: g.name,
            squadIds: g.squadIds || []
        }));
    }, [tournament]);

    // Squads available for selection
    const availableSquads = useMemo(() => {
        let baseSquads = squads;

        // Restriction: Sub-Admins only see/use their own squads
        if (user?.role === 'admin') {
            baseSquads = squads.filter(s => (s as any).adminId === user.uid || (s as any).ownerId === user.uid);
        }

        // If groups exist and a group is selected, filter by that group
        if (groups.length > 0 && formData.groupId) {
            const group = groups.find((g: any) => g.id === formData.groupId);
            if (group) {
                return baseSquads.filter(s => group.squadIds?.includes(s.id));
            }
        }

        // Otherwise, filter by tournament participants if defined
        const participants = tournament.participantSquadIds || [];
        if (participants.length > 0) {
            return baseSquads.filter(s => participants.includes(s.id));
        }

        return baseSquads;
    }, [squads, groups, formData.groupId, tournament.participantSquadIds, user]);

    const handleCreateMatch = async () => {
        if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
            toast.error('Permission denied');
            return;
        }
        if (!formData.teamA || !formData.teamB) {
            toast.error('Select both teams');
            return;
        }
        if (formData.teamA === formData.teamB) {
            toast.error('Teams must be different');
            return;
        }

        setCreating(true);
        try {
            const teamA = squads.find(s => s.id === formData.teamA);
            const teamB = squads.find(s => s.id === formData.teamB);
            const group = groups.find((g: any) => g.id === formData.groupId);

            // Generate Match No / ID (e.g. A1, B1, KO1)
            let matchNo = '';
            if (formData.stage === 'group' && group) {
                // Count matches in this group
                const groupMatches = matches.filter(m => (m as any).groupId === group.id);
                // Simple logic: Group Name first letter + count
                const letter = group.name.charAt(group.name.length - 1); // Group A -> A
                matchNo = `${letter}${groupMatches.length + 1}`;
            } else {
                const koMatches = matches.filter(m => (m as any).stage !== 'group');
                matchNo = `KO${koMatches.length + 1}`;
            }

            // Combine date + time
            const dateTime = new Date(`${formData.date}T${formData.time}`);

            const payload = {
                tournamentId: tournament.id,
                groupId: formData.groupId,
                groupName: group?.name || '',
                stage: formData.stage,
                matchNo, // Custom ID used for display
                teamAId: teamA?.id,
                teamBId: teamB?.id,
                teamASquadId: teamA?.id,
                teamBSquadId: teamB?.id,
                teamAName: teamA?.name || 'Team A',
                teamBName: teamB?.name || 'Team B',
                venue: formData.venue,
                date: Timestamp.fromDate(dateTime),
                time: formData.time,
                oversLimit: Number(formData.oversLimit),
                status: 'upcoming',

                // Pre-match Setup
                tossWinner: formData.tossWinner,
                tossDecision: formData.tossDecision,
                electedTo: formData.tossDecision, // Sync
                teamAPlayingXI: formData.teamAPlayingXI,
                teamBPlayingXI: formData.teamBPlayingXI,

                createdBy: user.uid,
                adminId: user.uid,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            await matchService.create(payload as any);
            toast.success(`Match ${matchNo} created successfully`);
            setIsCreateModalOpen(false);

            // Reset form partly
            setFormData(prev => ({
                ...prev,
                teamA: '',
                teamB: '',
                tossWinner: '',
                teamAPlayingXI: [],
                teamBPlayingXI: []
            }));
            setActiveFormTab('basic');
        } catch (error) {
            console.error(error);
            toast.error('Failed to create match');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-medium text-slate-900 tracking-tight">Match Center</h2>
                    <p className="text-sm text-slate-400 mt-1">Manage fixture schedules, venues, and status.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-medium hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
                    >
                        <Plus size={18} />
                        <span>Create Match</span>
                    </button>
                </div>
            </div>

            {/* Search and Filters */}
            <div className="bg-white rounded-[1.5rem] border border-slate-100 p-4 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input
                        type="text"
                        placeholder="Search by team name or match ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={18} className="text-slate-400 ml-2" />
                    <select
                        value={stageFilter}
                        onChange={(e) => setStageFilter(e.target.value)}
                        className="bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500"
                    >
                        <option value="all">All Stages</option>
                        <option value="group">Group Stage</option>
                        <option value="knockout">Knockout</option>
                        <option value="semi_final">Semi Final</option>
                        <option value="final">Final</option>
                    </select>
                </div>
            </div>

            {/* Match List */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-50">
                                <th className="text-left py-6 px-8">Match Info</th>
                                <th className="text-left py-6 px-6">Teams</th>
                                <th className="text-left py-6 px-6">Schedule</th>
                                <th className="text-center py-6 px-6">Status</th>
                                <th className="text-right py-6 px-8">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredMatches.map((match) => (
                                <tr key={match.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="py-6 px-8">
                                        <div className="flex items-center gap-2 mb-1">
                                            {(match as any).matchNo && (
                                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-white text-[10px] font-bold">
                                                    {(match as any).matchNo}
                                                </span>
                                            )}
                                            <span className="text-xs font-black text-indigo-600">#{match.id.substring(0, 6).toUpperCase()}</span>
                                        </div>
                                        <div className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-widest w-fit">
                                            {(match as any).stage === 'knockout'
                                                ? `Knockout (${String((match as any).round || '').replace('_', ' ')})`
                                                : (match as any).matchNo ? `Match ${(match as any).matchNo}` : (match as any).stageLabel || (match as any).stage || 'Match'}
                                        </div>
                                    </td>
                                    <td className="py-6 px-6">
                                        <div className="flex flex-col gap-1">
                                            <div className="text-sm font-bold text-slate-900">{match.teamAName}</div>
                                            <div className="text-[10px] font-bold text-slate-300 font-black uppercase">vs</div>
                                            <div className="text-sm font-bold text-slate-900">{match.teamBName}</div>
                                        </div>
                                    </td>
                                    <td className="py-6 px-6">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                                <Calendar size={14} className="text-slate-300" />
                                                {formatMatchDate(match.date)}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                                <MapPin size={14} className="text-slate-300" />
                                                <span>{match.venue || 'No Venue Set'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-6 px-6 text-center">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${match.status === 'live' ? 'bg-rose-50 text-rose-600 animate-pulse' :
                                            match.status === 'finished' ? 'bg-emerald-50 text-emerald-600' :
                                                'bg-slate-50 text-slate-400'
                                            }`}>
                                            {match.status}
                                        </span>
                                    </td>
                                    <td className="py-6 px-8 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => {
                                                    setSetupMatch(match);
                                                    setIsSetupModalOpen(true);
                                                }}
                                                className="px-4 py-2 bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-100 transition-all font-bold"
                                            >
                                                Setup
                                            </button>

                                            <button
                                                onClick={() => navigate(`/admin/live/${match.id}`)}
                                                className={`p-3 rounded-2xl transition-all shadow-sm ${match.status === 'live' || match.status === 'finished'
                                                    ? 'bg-slate-900 text-white hover:bg-indigo-600'
                                                    : 'bg-white border border-slate-100 text-slate-400 hover:text-indigo-600 hover:border-indigo-100'
                                                    }`}
                                                title="Match Control"
                                            >
                                                <ExternalLink size={16} />
                                            </button>

                                            <button
                                                onClick={async () => {
                                                    if (!user || (user.role !== 'admin' && user.role !== 'super_admin')) {
                                                        toast.error('Permission denied');
                                                        return;
                                                    }
                                                    if (window.confirm('Are you sure you want to delete this match? This action cannot be undone.')) {
                                                        try {
                                                            await matchService.delete(match.id);
                                                            toast.success('Match deleted successfully');
                                                            // Usually we should trigger a reload or update parent state
                                                            // Since this is a component, let's hope the parent is listening to matches changes
                                                            // If not, we might need a callback.
                                                            // Given the current structure, a full reload might be needed if they don't have real-time sync.
                                                        } catch (err) {
                                                            console.error(err);
                                                            toast.error('Failed to delete match');
                                                        }
                                                    }
                                                }}
                                                className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-rose-600 hover:border-rose-100 rounded-2xl transition-all shadow-sm"
                                                title="Delete Match"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredMatches.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center text-slate-400 font-medium italic">
                                        No matches found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Match Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <Plus className="text-indigo-600" size={24} /> Create New Match
                                </h2>
                                <p className="text-xs text-slate-400 mt-1">Configure schedule, teams, and playing conditions</p>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                            >
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="px-6 border-b border-slate-100 flex gap-6">
                            <button
                                onClick={() => setActiveFormTab('basic')}
                                className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeFormTab === 'basic' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                1. Basic Info
                            </button>
                            <button
                                onClick={() => setActiveFormTab('setup')}
                                disabled={!formData.teamA || !formData.teamB}
                                className={`py-4 text-sm font-bold border-b-2 transition-colors ${activeFormTab === 'setup' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'
                                    } ${!formData.teamA || !formData.teamB ? 'opacity-50 cursor-not-allowed' : 'hover:text-slate-600'}`}
                            >
                                2. Players & Toss (Optional)
                            </button>
                        </div>

                        <div className="p-8">
                            {activeFormTab === 'basic' ? (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Match Stage</label>
                                            <select
                                                value={formData.stage}
                                                onChange={(e) => setFormData({ ...formData, stage: e.target.value as any })}
                                                className="w-full bg-slate-50 border-transparent rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="group">Group Stage</option>
                                                <option value="knockout">Knockout</option>
                                                <option value="semi_final">Semi Final</option>
                                                <option value="final">Final</option>
                                            </select>
                                        </div>

                                        {formData.stage === 'group' && groups.length > 0 && (
                                            <div>
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Group</label>
                                                <select
                                                    value={formData.groupId}
                                                    onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                                                    className="w-full bg-slate-50 border-transparent rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500"
                                                >
                                                    <option value="">Select Group...</option>
                                                    {groups.map((g: any) => (
                                                        <option key={g.id} value={g.id}>{g.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Home Team</label>
                                                <select
                                                    value={formData.teamA}
                                                    onChange={(e) => setFormData({ ...formData, teamA: e.target.value })}
                                                    className="w-full bg-white border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 h-12"
                                                >
                                                    <option value="">Select Team A</option>
                                                    {availableSquads.map(s => (
                                                        <option key={s.id} value={s.id} disabled={s.id === formData.teamB}>
                                                            {s.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="pt-6">
                                                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center font-black text-slate-400 text-xs">VS</div>
                                            </div>
                                            <div className="flex-1">
                                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Away Team</label>
                                                <select
                                                    value={formData.teamB}
                                                    onChange={(e) => setFormData({ ...formData, teamB: e.target.value })}
                                                    className="w-full bg-white border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 h-12"
                                                >
                                                    <option value="">Select Team B</option>
                                                    {availableSquads.map(s => (
                                                        <option key={s.id} value={s.id} disabled={s.id === formData.teamA}>
                                                            {s.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        {/* Quick Toss Setup (Optional) - Shown only if teams are selected */}
                                        {formData.teamA && formData.teamB && (
                                            <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Toss Winner (Optional)</label>
                                                    <select
                                                        value={formData.tossWinner}
                                                        onChange={(e) => setFormData({ ...formData, tossWinner: e.target.value })}
                                                        className="w-full bg-white border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500"
                                                    >
                                                        <option value="">Decide Later</option>
                                                        <option value={formData.teamA}>{squads.find(s => s.id === formData.teamA)?.name}</option>
                                                        <option value={formData.teamB}>{squads.find(s => s.id === formData.teamB)?.name}</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Elected To</label>
                                                    <div className="flex bg-white rounded-xl border border-slate-200 p-1">
                                                        <button
                                                            onClick={() => setFormData({ ...formData, tossDecision: 'bat' })}
                                                            className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${formData.tossDecision === 'bat' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            Bat
                                                        </button>
                                                        <button
                                                            onClick={() => setFormData({ ...formData, tossDecision: 'bowl' })}
                                                            className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition-all ${formData.tossDecision === 'bowl' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                                                                }`}
                                                        >
                                                            Bowl
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="relative">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                                <Calendar size={14} /> Date
                                            </label>
                                            <div
                                                onClick={() => setShowDatePicker(!showDatePicker)}
                                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 transition-all flex items-center justify-between"
                                            >
                                                <span>{formatDateLabel(formData.date)}</span>
                                                <Calendar size={18} className="text-slate-300" />
                                            </div>

                                            {showDatePicker && (
                                                <div className="absolute z-[110] mt-2 left-0 right-0 animate-in fade-in slide-in-from-top-2">
                                                    <div className="fixed inset-0 bg-transparent" onClick={() => setShowDatePicker(false)}></div>
                                                    <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2">
                                                        <WheelDatePicker
                                                            value={formData.date}
                                                            onChange={(val) => setFormData({ ...formData, date: val })}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowDatePicker(false)}
                                                            className="w-full mt-2 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                                                        >
                                                            Done
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                                <Clock size={14} /> Time
                                            </label>
                                            <input
                                                type="time"
                                                value={formData.time}
                                                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                                className="w-full bg-slate-50 border-transparent rounded-xl font-bold text-slate-700"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                                <MapPin size={14} /> Venue
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.venue}
                                                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                                                placeholder="Enter stadium/ground name"
                                                className="w-full bg-slate-50 border-transparent rounded-xl font-bold text-slate-700"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                                <Trophy size={14} /> Overs Limit
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.oversLimit}
                                                onChange={(e) => setFormData({ ...formData, oversLimit: Number(e.target.value) })}
                                                className="w-full bg-slate-50 border-transparent rounded-xl font-bold text-slate-700"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                                        <Trophy className="text-amber-500 shrink-0 mt-0.5" size={18} />
                                        <div>
                                            <h4 className="font-bold text-amber-900 text-sm">Pre-Match Setup (Optional)</h4>
                                            <p className="text-xs text-amber-700 mt-1">You can configure the toss and playing XI now, or do it later in the Match Dashboard. This is useful for starting a match immediately.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Toss Winner</label>
                                            <select
                                                value={formData.tossWinner}
                                                onChange={(e) => setFormData({ ...formData, tossWinner: e.target.value })}
                                                className="w-full bg-slate-50 border-transparent rounded-xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="">Select Winner...</option>
                                                {formData.teamA && <option value={formData.teamA}>{squads.find(s => s.id === formData.teamA)?.name}</option>}
                                                {formData.teamB && <option value={formData.teamB}>{squads.find(s => s.id === formData.teamB)?.name}</option>}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Decision</label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setFormData({ ...formData, tossDecision: 'bat' })}
                                                    className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${formData.tossDecision === 'bat' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                                                        }`}
                                                >
                                                    Bat
                                                </button>
                                                <button
                                                    onClick={() => setFormData({ ...formData, tossDecision: 'bowl' })}
                                                    className={`flex-1 py-2 rounded-xl font-bold text-sm transition-all ${formData.tossDecision === 'bowl' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                                                        }`}
                                                >
                                                    Bowl
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-center text-sm text-slate-400 italic">
                                        * Player selection not enabled in Quick Create. Please use the Match Dashboard for full Playing XI management.
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-100 flex justify-between bg-slate-50/50 rounded-b-[2rem]">
                            {activeFormTab === 'setup' ? (
                                <button
                                    onClick={() => setActiveFormTab('basic')}
                                    className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all"
                                >
                                    Back
                                </button>
                            ) : (
                                <div />
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>

                                {activeFormTab === 'basic' && formData.teamA && formData.teamB ? (
                                    <button
                                        onClick={() => setActiveFormTab('setup')}
                                        className="px-8 py-3 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300 transition-all"
                                    >
                                        Next: Setup
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleCreateMatch}
                                        disabled={creating || (activeFormTab === 'basic' && (!formData.teamA || !formData.teamB))}
                                        className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {creating ? 'Creating...' : 'Create Match'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Setup Modal */}
            {isSetupModalOpen && setupMatch && (
                <MatchSetupModal
                    match={setupMatch}
                    onClose={() => setIsSetupModalOpen(false)}
                    onUpdate={async () => {
                        // Refetch the match data to get the updated lock state
                        const updatedMatch = await matchService.getById(setupMatch.id);
                        if (updatedMatch) {
                            setSetupMatch(updatedMatch as Match);
                        }
                    }}
                />
            )}
        </div>
    );
}
