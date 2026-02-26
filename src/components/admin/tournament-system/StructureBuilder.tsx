import React, { useState, useMemo } from 'react';
import { Tournament, TournamentStageInfo, Match } from '@/types';
import {
    Plus, Trash2, CheckCircle2, PlayCircle, ShieldCheck, X, Clock,
    Calendar, Trophy, ChevronRight, ChevronUp, ChevronDown, Zap,
    Circle, Loader2, Award, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { matchService } from '@/services/firestore/matches';
import { Timestamp } from 'firebase/firestore';
import WheelDatePicker from '@/components/common/WheelDatePicker';
import { formatDateLabel } from '@/utils/date';

interface StructureBuilderProps {
    tournament: Tournament;
    matches: Match[];
    onUpdate: (data: Partial<Tournament>) => Promise<void>;
    isLocked?: boolean;
}

export default function StructureBuilder({ tournament, matches, onUpdate, isLocked }: StructureBuilderProps) {
    const stages = tournament.stages || [];
    const [schedulingStage, setSchedulingStage] = useState<TournamentStageInfo | null>(null);
    const [schedules, setSchedules] = useState<Array<{ date: string, time: string }>>([
        { date: new Date().toISOString().split('T')[0], time: '14:00' },
        { date: new Date().toISOString().split('T')[0], time: '16:30' },
        { date: new Date().toISOString().split('T')[0], time: '14:00' },
        { date: new Date().toISOString().split('T')[0], time: '16:30' },
    ]);
    const [isCreatingMatches, setIsCreatingMatches] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState<number | null>(null);
    const [confirmDone, setConfirmDone] = useState<string | null>(null);

    // --- Match Stats per Stage ---
    const stageMatchStats = useMemo(() => {
        const stats: Record<string, { total: number; completed: number; live: number; upcoming: number }> = {};
        const sorted = [...stages].sort((a, b) => a.order - b.order);

        // Map stage names to match round values
        const nameToRound = (name: string): string | null => {
            const n = name.toLowerCase().trim();
            if (n.includes('quarter')) return 'quarter_final';
            if (n.includes('semi')) return 'semi_final';
            if (n === 'final' || n === 'the final' || n === 'grand final' || n === 'grande final' || (n.includes('final') && !n.includes('quarter') && !n.includes('semi'))) return 'final';
            return null;
        };

        sorted.forEach((stage) => {
            let stageMatches: Match[] = [];

            if (stage.type === 'group') {
                // Group stage: matches with stage='group' or no stage field
                stageMatches = matches.filter(m =>
                    (m as any).stage === 'group' || !(m as any).stage
                );
            } else if (stage.type === 'knockout') {
                // Knockout: match by round value
                const round = nameToRound(stage.name);
                if (round) {
                    stageMatches = matches.filter(m =>
                        (m as any).stage === 'knockout' && (m as any).round === round
                    );
                } else {
                    // Fallback: all knockout matches not claimed by other stages
                    stageMatches = matches.filter(m => (m as any).stage === 'knockout');
                }
            }

            const completed = stageMatches.filter(m => m.status === 'finished' || m.status === 'abandoned').length;
            const live = stageMatches.filter(m => m.status === 'live').length;
            const upcoming = stageMatches.filter(m => m.status === 'upcoming').length;

            stats[stage.id] = {
                total: stageMatches.length,
                completed,
                live,
                upcoming,
            };
        });

        return stats;
    }, [stages, matches]);

    const handleActivateClick = (stage: TournamentStageInfo) => {
        if (stage.type === 'knockout') {
            setSchedulingStage(stage);
        } else {
            updateStage(stage.id, { status: 'active', startedAt: Timestamp.now() });
        }
    };

    const handleDoneClick = (stage: TournamentStageInfo) => {
        const stats = stageMatchStats[stage.id];
        if (stats && stats.total > 0 && stats.completed < stats.total) {
            toast.error(`${stats.total - stats.completed} match(es) still remaining. Complete all matches first.`);
            return;
        }
        setConfirmDone(stage.id);
    };

    const confirmStageDone = async (stageId: string) => {
        await updateStage(stageId, { status: 'completed', completedAt: Timestamp.now() });
        setConfirmDone(null);
        toast.success('Stage completed!');
    };

    const confirmActivationWithSchedules = async () => {
        if (!schedulingStage) return;
        setIsCreatingMatches(true);
        try {
            const name = schedulingStage.name.toLowerCase();
            const isQuarter = name.includes('quarter');
            const isSemi = name.includes('semi');
            const isFinal = name.includes('final') && !isQuarter && !isSemi;

            const matchCount = isQuarter ? 4 : isSemi ? 2 : isFinal ? 1 : 0;
            const roundName = isQuarter ? 'quarter_final' : isSemi ? 'semi_final' : 'final';
            const prefix = isQuarter ? 'QF' : isSemi ? 'SF' : 'F';

            const confirmedQualifiers = tournament.confirmedQualifiers || {};
            const groups = (tournament as any).config?.groups || [];
            const groupIds = groups.length > 0 ? groups.map((g: any) => g.id) : Object.keys(confirmedQualifiers).sort();

            let pairings: Array<{ a: string, b: string }> = [];

            if (isQuarter) {
                if (groupIds.length === 4) {
                    const g = groupIds;
                    pairings = [
                        { a: `${g[0]}:1`, b: `${g[2]}:2` },
                        { a: `${g[1]}:1`, b: `${g[3]}:2` },
                        { a: `${g[2]}:1`, b: `${g[0]}:2` },
                        { a: `${g[3]}:1`, b: `${g[1]}:2` },
                    ];
                } else if (groupIds.length === 2 && (confirmedQualifiers[groupIds[0]]?.length >= 4)) {
                    const g = groupIds;
                    pairings = [
                        { a: `${g[0]}:1`, b: `${g[1]}:4` },
                        { a: `${g[0]}:2`, b: `${g[1]}:3` },
                        { a: `${g[0]}:3`, b: `${g[1]}:2` },
                        { a: `${g[0]}:4`, b: `${g[1]}:1` },
                    ];
                } else {
                    const all = Object.values(confirmedQualifiers).flat();
                    for (let i = 0; i < all.length && i < 8; i += 2) {
                        if (all[i + 1]) pairings.push({ a: all[i], b: all[i + 1] });
                    }
                }
            } else if (isSemi) {
                const qfMatches = matches.filter(m => m.round === 'quarter_final');
                const getWinnerId = (matchNo: string) => {
                    const match = qfMatches.find(m => m.matchNo === matchNo);
                    if (match?.status === 'finished' && match.winnerId) {
                        return match.winnerId;
                    }
                    return null;
                };
                pairings = [
                    { a: getWinnerId('QF1') || `TBD 1`, b: getWinnerId('QF2') || `TBD 2` },
                    { a: getWinnerId('QF3') || `TBD 3`, b: getWinnerId('QF4') || `TBD 4` }
                ];
            } else if (isFinal) {
                const sfMatches = matches.filter(m => m.round === 'semi_final');
                const getWinnerId = (matchNo: string) => {
                    const match = sfMatches.find(m => m.matchNo === matchNo);
                    if (match?.status === 'finished' && match.winnerId) {
                        return match.winnerId;
                    }
                    return null;
                };
                pairings = [
                    { a: getWinnerId('SF1') || `TBD 1`, b: getWinnerId('SF2') || `TBD 2` }
                ];
            }

            const matchPromises = Array.from({ length: matchCount }).map(async (_, idx) => {
                const schedule = schedules[idx] || schedules[0];
                const dateTime = new Date(`${schedule.date}T${schedule.time}`);
                const pair = pairings[idx] || { a: 'TBD 1', b: 'TBD 2' };

                const getResolvedSquadId = (seed: string) => {
                    if (seed.includes(':')) {
                        const [gid, rank] = seed.split(':');
                        return confirmedQualifiers[gid]?.[parseInt(rank) - 1];
                    }
                    return null; // Don't try to parse TBD or winner: IDs yet
                };

                const squadAId = getResolvedSquadId(pair.a);
                const squadBId = getResolvedSquadId(pair.b);
                const squadA = squadAId ? ((tournament as any).participantSquadMeta?.[squadAId] || { name: `Team A` }) : { name: `Team A` };
                const squadB = squadBId ? ((tournament as any).participantSquadMeta?.[squadBId] || { name: `Team B` }) : { name: `Team B` };

                return matchService.create({
                    tournamentId: tournament.id,
                    stage: 'knockout',
                    round: roundName,
                    matchNo: `${prefix}${idx + 1}`,
                    teamAId: squadAId || '',
                    teamBId: squadBId || '',
                    teamASquadId: squadAId || '',
                    teamBSquadId: squadBId || '',
                    teamAName: squadA.name,
                    teamBName: squadB.name,
                    venue: tournament.location || '',
                    date: Timestamp.fromDate(dateTime),
                    time: schedule.time,
                    oversLimit: (tournament as any).oversLimit || 20,
                    status: 'upcoming',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                } as any);
            });

            if (matchPromises.length > 0) {
                await Promise.all(matchPromises);
                toast.success(`${schedulingStage.name} matches created!`);
            }
            await updateStage(schedulingStage.id, { status: 'active', startedAt: Timestamp.now() });
            setSchedulingStage(null);
        } catch (err) {
            console.error(err);
            toast.error('Failed to activate stage and create matches');
        } finally {
            setIsCreatingMatches(false);
        }
    };

    const addStage = async () => {
        if (isLocked) { toast.error('Tournament structure is locked'); return; }
        const newStage: TournamentStageInfo = {
            id: `stage-${Date.now()}`,
            name: 'New Stage',
            type: 'group',
            order: stages.length,
            status: 'pending'
        };
        await onUpdate({ stages: [...stages, newStage] });
    };

    const removeStage = async (id: string) => {
        if (isLocked) { toast.error('Tournament structure is locked'); return; }
        if (stages.length <= 1) { toast.error('Tournament must have at least one stage'); return; }
        await onUpdate({ stages: stages.filter(s => s.id !== id) });
    };

    const updateStage = async (id: string, patch: Partial<TournamentStageInfo>) => {
        await onUpdate({
            stages: stages.map(s => s.id === id ? { ...s, ...patch } : s)
        });
    };

    const moveStage = async (id: string, direction: 'up' | 'down') => {
        if (isLocked) { toast.error('Tournament structure is locked'); return; }
        const idx = stages.findIndex(s => s.id === id);
        if (direction === 'up' && idx === 0) return;
        if (direction === 'down' && idx === stages.length - 1) return;
        const nextStages = [...stages];
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        [nextStages[idx], nextStages[targetIdx]] = [nextStages[targetIdx], nextStages[idx]];
        const normalized = nextStages.map((s, i) => ({ ...s, order: i }));
        await onUpdate({ stages: normalized });
    };

    const sorted = [...stages].sort((a, b) => a.order - b.order);

    // Compute display pairings for the scheduling modal
    const getModalPairings = () => {
        if (!schedulingStage) return [];
        const name = schedulingStage.name.toLowerCase();
        const isQuarter = name.includes('quarter');
        const isSemi = name.includes('semi');
        const isFinal = name.includes('final') && !isQuarter && !isSemi;
        const matchCount = isQuarter ? 4 : isSemi ? 2 : isFinal ? 1 : 0;

        let pairings: Array<{ a: string, b: string }> = [];
        if (isQuarter) {
            const confirmedQualifiers = tournament.confirmedQualifiers || {};
            const groups = (tournament as any).config?.groups || [];
            const groupIds = groups.length > 0 ? groups.map((g: any) => g.id) : Object.keys(confirmedQualifiers).sort();

            if (groupIds.length === 4) {
                const g = groupIds;
                pairings = [
                    { a: `${groups.find((gr: any) => gr.id === g[0])?.name || g[0]} 1st`, b: `${groups.find((gr: any) => gr.id === g[2])?.name || g[2]} 2nd` },
                    { a: `${groups.find((gr: any) => gr.id === g[1])?.name || g[1]} 1st`, b: `${groups.find((gr: any) => gr.id === g[3])?.name || g[3]} 2nd` },
                    { a: `${groups.find((gr: any) => gr.id === g[2])?.name || g[2]} 1st`, b: `${groups.find((gr: any) => gr.id === g[0])?.name || g[0]} 2nd` },
                    { a: `${groups.find((gr: any) => gr.id === g[3])?.name || g[3]} 1st`, b: `${groups.find((gr: any) => gr.id === g[1])?.name || g[1]} 2nd` },
                ];
            } else if (groupIds.length === 2) {
                const g = groupIds;
                pairings = [
                    { a: `${groups.find((gr: any) => gr.id === g[0])?.name || g[0]} 1st`, b: `${groups.find((gr: any) => gr.id === g[1])?.name || g[1]} 4th` },
                    { a: `${groups.find((gr: any) => gr.id === g[0])?.name || g[0]} 2nd`, b: `${groups.find((gr: any) => gr.id === g[1])?.name || g[1]} 3rd` },
                    { a: `${groups.find((gr: any) => gr.id === g[0])?.name || g[0]} 3rd`, b: `${groups.find((gr: any) => gr.id === g[1])?.name || g[1]} 2nd` },
                    { a: `${groups.find((gr: any) => gr.id === g[0])?.name || g[0]} 4th`, b: `${groups.find((gr: any) => gr.id === g[1])?.name || g[1]} 1st` },
                ];
            } else {
                for (let i = 0; i < 4; i++) pairings.push({ a: 'TBD', b: 'TBD' });
            }
        } else if (isSemi) {
            const qfMatches = matches.filter(m => m.round === 'quarter_final');
            const getWinnerName = (matchNo: string) => {
                const match = qfMatches.find(m => m.matchNo === matchNo);
                if (match?.status === 'finished') {
                    if (match.winnerId === match.teamAId) return match.teamAName || 'Team A';
                    if (match.winnerId === match.teamBId) return match.teamBName || 'Team B';
                    return `Winner ${matchNo}`; // fallback if winner ID not matched
                }
                return `Winner ${matchNo}`;
            };
            pairings = [
                { a: getWinnerName('QF1'), b: getWinnerName('QF2') },
                { a: getWinnerName('QF3'), b: getWinnerName('QF4') }
            ];
        } else if (isFinal) {
            const sfMatches = matches.filter(m => m.round === 'semi_final');
            const getWinnerName = (matchNo: string) => {
                const match = sfMatches.find(m => m.matchNo === matchNo);
                if (match?.status === 'finished') {
                    if (match.winnerId === match.teamAId) return match.teamAName || 'Team A';
                    if (match.winnerId === match.teamBId) return match.teamBName || 'Team B';
                    return `Winner ${matchNo}`;
                }
                return `Winner ${matchNo}`;
            };
            pairings = [
                { a: getWinnerName('SF1'), b: getWinnerName('SF2') }
            ];
        }

        return Array.from({ length: matchCount }).map((_, idx) => pairings[idx] || { a: 'TBD 1', b: 'TBD 2' });
    };

    const modalPairings = getModalPairings();

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Tournament Stages</h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">Manage the progression flow of your tournament</p>
                </div>
                <button
                    onClick={addStage}
                    disabled={isLocked}
                    className={`flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl font-semibold text-sm transition-all shadow-lg hover:shadow-xl active:scale-95 ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800'}`}
                >
                    <Plus size={16} />
                    <span>Add Stage</span>
                </button>
            </div>

            {isLocked && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start sm:items-center gap-3 text-xs text-amber-800 font-semibold">
                    <ShieldCheck size={18} className="text-amber-500 shrink-0 mt-0.5 sm:mt-0" />
                    <span>Tournament has started. Structure editing is restricted for data integrity.</span>
                </div>
            )}

            {/* Stage Timeline */}
            {stages.length === 0 ? (
                <div className="text-center py-16 bg-white border-2 border-dashed border-slate-200 rounded-2xl">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Zap size={24} className="text-slate-400" />
                    </div>
                    <p className="text-slate-500 text-sm font-medium">No stages defined yet.</p>
                    <p className="text-slate-400 text-xs mt-1">Click "Add Stage" to build your tournament flow.</p>
                </div>
            ) : (
                <div className="relative">
                    {/* Timeline connector line */}
                    {sorted.length > 1 && (
                        <div className="absolute left-[27px] top-8 bottom-8 w-0.5 bg-gradient-to-b from-indigo-200 via-slate-200 to-slate-100 hidden sm:block" />
                    )}

                    <div className="space-y-4">
                        {sorted.map((stage, idx) => {
                            const stats = stageMatchStats[stage.id] || { total: 0, completed: 0, live: 0, upcoming: 0 };
                            const allMatchesDone = stats.total > 0 && stats.completed === stats.total;
                            const canStart = stage.status === 'pending' || stage.status === 'completed' || (stage.status === 'active' && stats.total === 0);
                            const canDone = stage.status === 'active';
                            const progressPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

                            const statusConfig = {
                                pending: { bg: 'bg-slate-100', text: 'text-slate-500', label: 'Pending', icon: Circle },
                                active: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress', icon: Loader2 },
                                completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Completed', icon: CheckCircle2 },
                                paused: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Paused', icon: Clock },
                            };
                            const sc = statusConfig[stage.status] || statusConfig.pending;
                            const StatusIcon = sc.icon;

                            return (
                                <div
                                    key={stage.id}
                                    className={`relative bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${stage.status === 'active'
                                        ? 'border-blue-200 shadow-lg shadow-blue-100/50 ring-1 ring-blue-100'
                                        : stage.status === 'completed'
                                            ? 'border-emerald-200 shadow-sm'
                                            : 'border-slate-200 shadow-sm hover:shadow-md'
                                        }`}
                                >
                                    {/* Active stage glow bar */}
                                    {stage.status === 'active' && (
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                                    )}
                                    {stage.status === 'completed' && (
                                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-400" />
                                    )}

                                    <div className="p-4 sm:p-6">
                                        {/* Top row: Number + Name + Status */}
                                        <div className="flex items-start gap-3 sm:gap-4">
                                            {/* Stage number */}
                                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${stage.status === 'active' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' :
                                                stage.status === 'completed' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' :
                                                    'bg-slate-100 text-slate-400'
                                                }`}>
                                                {stage.status === 'completed' ? <CheckCircle2 size={20} /> : idx + 1}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                {/* Name + Type */}
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                                    <input
                                                        type="text"
                                                        value={stage.name}
                                                        readOnly={isLocked}
                                                        onChange={(e) => updateStage(stage.id, { name: e.target.value })}
                                                        className={`text-base sm:text-lg font-bold text-slate-900 bg-transparent border-none p-0 focus:ring-0 min-w-0 ${isLocked ? 'cursor-default' : ''}`}
                                                    />
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            value={stage.type}
                                                            disabled={isLocked}
                                                            onChange={(e) => updateStage(stage.id, { type: e.target.value as any })}
                                                            className={`text-xs font-bold px-3 py-1 rounded-full border-none focus:ring-0 ${stage.type === 'group' ? 'bg-violet-50 text-violet-600' : 'bg-orange-50 text-orange-600'
                                                                } ${isLocked ? 'cursor-default' : 'cursor-pointer'}`}
                                                        >
                                                            <option value="group">Group Stage</option>
                                                            <option value="knockout">Knockout</option>
                                                        </select>
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${sc.bg} ${sc.text}`}>
                                                            <StatusIcon size={12} className={stage.status === 'active' ? 'animate-spin' : ''} />
                                                            {sc.label}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Match Progress */}
                                                {stats.total > 0 && (
                                                    <div className="mt-3">
                                                        <div className="flex items-center justify-between text-xs mb-1.5">
                                                            <span className="text-slate-500 font-medium">
                                                                {stats.completed}/{stats.total} matches completed
                                                                {stats.live > 0 && <span className="text-red-500 font-bold ml-1">• {stats.live} LIVE</span>}
                                                            </span>
                                                            <span className={`font-bold ${allMatchesDone ? 'text-emerald-600' : 'text-slate-400'}`}>
                                                                {progressPct}%
                                                            </span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-700 ${allMatchesDone ? 'bg-emerald-500' :
                                                                    stats.live > 0 ? 'bg-red-500' : 'bg-blue-500'
                                                                    }`}
                                                                style={{ width: `${progressPct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Reorder + Delete */}
                                            <div className="flex flex-col items-center gap-1 shrink-0">
                                                {!isLocked && (
                                                    <>
                                                        <button
                                                            onClick={() => moveStage(stage.id, 'up')}
                                                            disabled={idx === 0}
                                                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 disabled:opacity-0 transition-all"
                                                        >
                                                            <ChevronUp size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => moveStage(stage.id, 'down')}
                                                            disabled={idx === sorted.length - 1}
                                                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 disabled:opacity-0 transition-all"
                                                        >
                                                            <ChevronDown size={14} />
                                                        </button>
                                                    </>
                                                )}
                                                {!isLocked && (
                                                    <button
                                                        onClick={() => removeStage(stage.id)}
                                                        className="p-1.5 hover:bg-rose-50 hover:text-rose-500 rounded-lg text-slate-300 transition-all mt-1"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {canStart && (
                                                <button
                                                    onClick={() => handleActivateClick(stage)}
                                                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-green-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                                                >
                                                    <PlayCircle size={16} />
                                                    <span>Start Stage</span>
                                                </button>
                                            )}
                                            {canDone && (
                                                <button
                                                    onClick={() => handleDoneClick(stage)}
                                                    disabled={!allMatchesDone}
                                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${allMatchesDone
                                                        ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]'
                                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                        }`}
                                                    title={!allMatchesDone ? `${stats.total - stats.completed} match(es) still remaining` : 'Mark stage as completed'}
                                                >
                                                    <CheckCircle2 size={16} />
                                                    <span>Mark Done</span>
                                                    {!allMatchesDone && stats.total > 0 && (
                                                        <span className="text-[10px] ml-1 opacity-70">({stats.total - stats.completed} left)</span>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stage connector arrow */}
                                    {idx < sorted.length - 1 && (
                                        <div className="flex justify-center -mb-2 pb-1">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stage.status === 'completed' ? 'bg-emerald-100 text-emerald-500' : 'bg-slate-100 text-slate-300'
                                                }`}>
                                                <ArrowRight size={14} className="rotate-90" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Confirm Done Modal */}
            {confirmDone && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Award size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">Complete This Stage?</h3>
                            <p className="text-sm text-slate-500">
                                All matches are finished. Mark this stage as completed to unlock the next stage.
                            </p>
                        </div>
                        <div className="flex border-t border-slate-100">
                            <button
                                onClick={() => setConfirmDone(null)}
                                className="flex-1 py-4 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => confirmStageDone(confirmDone)}
                                className="flex-1 py-4 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors border-l border-slate-100"
                            >
                                Confirm Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stage Activation Scheduling Modal (Quarter Finals) */}
            {schedulingStage && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                    <Trophy size={20} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">Schedule {schedulingStage.name}</h2>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                                        {schedulingStage.name.toLowerCase().includes('quarter') ? '4 Matches' :
                                            schedulingStage.name.toLowerCase().includes('semi') ? '2 Matches' : '1 Match'} • Auto-Paired
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setSchedulingStage(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                                <X size={18} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {modalPairings.map((pair, idx) => (
                                    <div key={idx} className="bg-slate-50 rounded-2xl p-5 border border-slate-100 hover:border-indigo-100 transition-all">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-md">
                                                Match {idx + 1}
                                            </span>
                                        </div>

                                        {/* Display the computed teams */}
                                        <div className="bg-white rounded-xl p-3 mb-4 border border-slate-100 shadow-sm flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-slate-700 truncate flex-1 text-center">{pair.a}</span>
                                            <span className="text-[10px] font-black text-slate-300 uppercase shrink-0">vs</span>
                                            <span className="text-xs font-bold text-slate-700 truncate flex-1 text-center">{pair.b}</span>
                                        </div>

                                        <div className="space-y-3">
                                            <div
                                                onClick={() => setShowDatePicker(idx)}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 cursor-pointer flex items-center gap-3 hover:shadow-md transition-all text-sm font-bold text-slate-700 shadow-sm"
                                            >
                                                <Calendar size={16} className="text-indigo-400" />
                                                {formatDateLabel(schedules[idx]?.date)}
                                            </div>
                                            {showDatePicker === idx && (
                                                <div className="relative z-10">
                                                    <div className="fixed inset-0" onClick={() => setShowDatePicker(null)} />
                                                    <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 mt-1 animate-in fade-in slide-in-from-top-2">
                                                        <WheelDatePicker
                                                            value={schedules[idx].date}
                                                            onChange={(val) => {
                                                                const next = [...schedules];
                                                                next[idx].date = val;
                                                                setSchedules(next);
                                                            }}
                                                        />
                                                        <button onClick={() => setShowDatePicker(null)} className="w-full mt-3 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs shadow-md">Set Date</button>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-all">
                                                <Clock size={16} className="text-indigo-400" />
                                                <input
                                                    type="time"
                                                    value={schedules[idx]?.time}
                                                    onChange={(e) => {
                                                        const next = [...schedules];
                                                        next[idx].time = e.target.value;
                                                        setSchedules(next);
                                                    }}
                                                    className="bg-transparent border-none p-0 text-sm font-bold text-slate-700 focus:ring-0 w-full"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <p className="text-[10px] text-slate-400 font-medium">Matches created as "Upcoming"</p>
                            <div className="flex gap-2">
                                <button onClick={() => setSchedulingStage(null)} className="px-4 py-2 text-slate-500 font-semibold text-sm hover:bg-white rounded-xl transition-all">
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmActivationWithSchedules}
                                    disabled={isCreatingMatches}
                                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {isCreatingMatches ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        <span>Confirm & Activate</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
