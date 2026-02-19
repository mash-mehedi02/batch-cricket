import React, { useState } from 'react';
import { Tournament, TournamentStageInfo, TournamentStageStatus } from '@/types';
import { Plus, Trash2, GripVertical, CheckCircle2, Circle, PlayCircle, PauseCircle, ShieldCheck, X, Clock, Calendar, Trophy, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { matchService } from '@/services/firestore/matches';
import { Timestamp } from 'firebase/firestore';
import WheelDatePicker from '@/components/common/WheelDatePicker';
import { formatDateLabel } from '@/utils/date';

interface StructureBuilderProps {
    tournament: Tournament;
    onUpdate: (data: Partial<Tournament>) => Promise<void>;
    isLocked?: boolean;
}

export default function StructureBuilder({ tournament, onUpdate, isLocked }: StructureBuilderProps) {
    const stages = tournament.stages || [];
    const [schedulingStage, setSchedulingStage] = useState<TournamentStageInfo | null>(null);
    const [schedules, setSchedules] = useState<Array<{ date: string, time: string }>>([
        { date: new Date().toISOString().split('T')[0], time: '14:00' },
        { date: new Date().toISOString().split('T')[0], time: '16:30' },
        { date: new Date().toISOString().split('T')[1]?.split('T')[0] || new Date().toISOString().split('T')[0], time: '14:00' },
        { date: new Date().toISOString().split('T')[1]?.split('T')[0] || new Date().toISOString().split('T')[0], time: '16:30' },
    ]);
    const [isCreatingMatches, setIsCreatingMatches] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState<number | null>(null);

    const handleActivateClick = (stage: TournamentStageInfo) => {
        if (stage.type === 'knockout' && stage.name.toLowerCase().includes('quarter')) {
            setSchedulingStage(stage);
        } else {
            updateStage(stage.id, { status: 'active' });
        }
    };

    const confirmActivationWithSchedules = async () => {
        if (!schedulingStage) return;

        setIsCreatingMatches(true);
        try {
            // 1. Calculate pairings (8 teams for Quarter Finals)
            const confirmedQualifiers = tournament.confirmedQualifiers || {};
            const groups = (tournament as any).config?.groups || [];
            const groupIds = groups.length > 0 ? groups.map((g: any) => g.id) : Object.keys(confirmedQualifiers).sort();

            let pairings: Array<{ a: string, b: string }> = [];

            if (groupIds.length === 4) {
                // Classic 4 groups: 1A vs 2C, 1B vs 2D, 1C vs 2A, 1D vs 2B
                const g = groupIds;
                pairings = [
                    { a: `${g[0]}:1`, b: `${g[2]}:2` },
                    { a: `${g[1]}:1`, b: `${g[3]}:2` },
                    { a: `${g[2]}:1`, b: `${g[0]}:2` },
                    { a: `${g[3]}:1`, b: `${g[1]}:2` },
                ];
            } else if (groupIds.length === 2 && (confirmedQualifiers[groupIds[0]]?.length >= 4)) {
                // 2 groups with 4 qualifiers each: 1A vs 4B, 2A vs 3B, 3A vs 2B, 4A vs 1B
                const g = groupIds;
                pairings = [
                    { a: `${g[0]}:1`, b: `${g[1]}:4` },
                    { a: `${g[0]}:2`, b: `${g[1]}:3` },
                    { a: `${g[0]}:3`, b: `${g[1]}:2` },
                    { a: `${g[0]}:4`, b: `${g[1]}:1` },
                ];
            } else {
                // Fallback: Just take all qualifiers and pair them sequentially
                const all = Object.values(confirmedQualifiers).flat();
                for (let i = 0; i < all.length && i < 8; i += 2) {
                    if (all[i + 1]) pairings.push({ a: all[i], b: all[i + 1] });
                }
            }

            // 2. Create the 4 matches
            const matchPromises = pairings.slice(0, 4).map(async (pair, idx) => {
                const schedule = schedules[idx] || schedules[0];
                const dateTime = new Date(`${schedule.date}T${schedule.time}`);

                const getResolvedSquadId = (seed: string) => {
                    if (seed.includes(':')) {
                        const [gid, rank] = seed.split(':');
                        return confirmedQualifiers[gid]?.[parseInt(rank) - 1];
                    }
                    return seed;
                };

                const squadAId = getResolvedSquadId(pair.a);
                const squadBId = getResolvedSquadId(pair.b);
                const squadA = (tournament as any).participantSquadMeta?.[squadAId] || { name: `Winner ${pair.a}` };
                const squadB = (tournament as any).participantSquadMeta?.[squadBId] || { name: `Winner ${pair.b}` };

                return matchService.create({
                    tournamentId: tournament.id,
                    stage: 'knockout',
                    round: 'quarter_final',
                    matchNo: `QF${idx + 1}`,
                    teamAId: squadAId || '',
                    teamBId: squadBId || '',
                    teamASquadId: squadAId || '',
                    teamBSquadId: squadBId || '',
                    teamAName: squadA.name || 'TBD',
                    teamBName: squadB.name || 'TBD',
                    venue: tournament.location || '',
                    date: Timestamp.fromDate(dateTime),
                    time: schedule.time,
                    oversLimit: (tournament as any).oversLimit || 20,
                    status: 'upcoming',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                } as any);
            });

            await Promise.all(matchPromises);

            // 3. Update stage status
            await updateStage(schedulingStage.id, { status: 'active' });

            toast.success('Quarter Final matches created and stage activated!');
            setSchedulingStage(null);
        } catch (err) {
            console.error(err);
            toast.error('Failed to activate stage and create matches');
        } finally {
            setIsCreatingMatches(false);
        }
    };

    const addStage = async () => {
        if (isLocked) {
            toast.error('Tournament structure is locked');
            return;
        }
        const newStage: TournamentStageInfo = {
            id: `stage-${Date.now()}`,
            name: 'New Stage',
            type: 'group',
            order: stages.length,
            status: 'pending'
        };

        await onUpdate({
            stages: [...stages, newStage]
        });
    };

    const removeStage = async (id: string) => {
        if (isLocked) {
            toast.error('Tournament structure is locked');
            return;
        }
        if (stages.length <= 1) {
            toast.error('Tournament must have at least one stage');
            return;
        }
        await onUpdate({
            stages: stages.filter(s => s.id !== id)
        });
    };

    const updateStage = async (id: string, patch: Partial<TournamentStageInfo>) => {
        if (isLocked) {
            toast.error('Tournament structure is locked');
            return;
        }
        await onUpdate({
            stages: stages.map(s => s.id === id ? { ...s, ...patch } : s)
        });
    };

    const moveStage = async (id: string, direction: 'up' | 'down') => {
        if (isLocked) {
            toast.error('Tournament structure is locked');
            return;
        }
        const idx = stages.findIndex(s => s.id === id);
        if (direction === 'up' && idx === 0) return;
        if (direction === 'down' && idx === stages.length - 1) return;

        const nextStages = [...stages];
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        [nextStages[idx], nextStages[targetIdx]] = [nextStages[targetIdx], nextStages[idx]];

        // Normalize order
        const normalized = nextStages.map((s, i) => ({ ...s, order: i }));
        await onUpdate({ stages: normalized });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-medium text-slate-900 tracking-tight">Tournament Flow</h2>
                        <p className="text-sm text-slate-400 mt-1">Define the chronological stages of your tournament.</p>
                    </div>
                    <button
                        onClick={addStage}
                        disabled={isLocked}
                        className={`flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-medium transition-all shadow-lg hover:shadow-xl active:scale-95 ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-800'}`}
                    >
                        <Plus size={18} />
                        <span>Add Stage</span>
                    </button>
                </div>

                {isLocked && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-center gap-4 text-xs text-amber-700 font-bold uppercase tracking-wider">
                        <ShieldCheck size={20} className="text-amber-500" />
                        Tournament has started. Structural changes are restricted to ensure data integrity.
                    </div>
                )}

                <div className="space-y-4">
                    {stages.length === 0 ? (
                        <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-400">
                            No stages defined. Click "Add Stage" to begin.
                        </div>
                    ) : (
                        [...stages].sort((a, b) => a.order - b.order).map((stage, idx) => (
                            <div
                                key={stage.id}
                                className={`group flex items-center gap-6 p-6 rounded-[1.5rem] border transition-all duration-300 ${stage.status === 'active' ? 'bg-indigo-50/50 border-indigo-100 ring-1 ring-indigo-200/50' : 'bg-white border-slate-100'
                                    }`}
                            >
                                <div className="flex flex-col gap-1">
                                    <button
                                        onClick={() => moveStage(stage.id, 'up')}
                                        className="p-1 hover:bg-slate-100 rounded-md text-slate-400 disabled:opacity-0"
                                        disabled={idx === 0}
                                    >
                                        <Plus size={14} className="rotate-45" />
                                    </button>
                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400">
                                        {idx + 1}
                                    </div>
                                    <button
                                        onClick={() => moveStage(stage.id, 'down')}
                                        className="p-1 hover:bg-slate-100 rounded-md text-slate-400 disabled:opacity-0"
                                        disabled={idx === stages.length - 1}
                                    >
                                        <Plus size={14} className="rotate-[225deg]" />
                                    </button>
                                </div>

                                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Stage Name</label>
                                        <input
                                            type="text"
                                            value={stage.name}
                                            readOnly={isLocked}
                                            onChange={(e) => updateStage(stage.id, { name: e.target.value })}
                                            placeholder="e.g. Group Stage"
                                            className={`w-full bg-transparent border-none p-0 text-slate-900 font-medium focus:ring-0 placeholder:text-slate-200 ${isLocked ? 'cursor-not-allowed' : ''}`}
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Type</label>
                                        <select
                                            value={stage.type}
                                            disabled={isLocked}
                                            onChange={(e) => updateStage(stage.id, { type: e.target.value as any })}
                                            className={`w-full bg-transparent border-none p-0 text-slate-900 font-medium focus:ring-0 appearance-none ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <option value="group">Group Stage</option>
                                            <option value="knockout">Knockout</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Status</label>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${stage.status === 'active' ? 'bg-indigo-100 text-indigo-700' :
                                                stage.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                    'bg-slate-100 text-slate-500'
                                                }`}>
                                                {stage.status}
                                            </span>
                                            <div className="flex gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                                                {stage.status !== 'active' && (
                                                    <button onClick={() => handleActivateClick(stage)} className="p-2 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors" title="Activate Stage">
                                                        <PlayCircle size={18} />
                                                    </button>
                                                )}
                                                {stage.status === 'active' && (
                                                    <button onClick={() => updateStage(stage.id, { status: 'completed' })} className="p-2 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-colors" title="Mark Completed">
                                                        <CheckCircle2 size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => removeStage(stage.id)}
                                    disabled={isLocked}
                                    className={`p-3 text-slate-300 transition-all ${isLocked ? 'cursor-not-allowed opacity-30' : 'hover:text-rose-500 hover:bg-rose-50 rounded-2xl'}`}
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Stage Activation Scheduling Modal */}
            {schedulingStage && (
                <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                                    <Trophy size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Schedule {schedulingStage.name}</h2>
                                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-black">4 Matches • 8 Teams Auto-Paired</p>
                                </div>
                            </div>
                            <button onClick={() => setSchedulingStage(null)} className="p-2 hover:bg-white rounded-xl transition-colors shadow-sm">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[1, 2, 3, 4].map((num, idx) => (
                                    <div key={idx} className="bg-slate-50 rounded-3xl p-6 border border-slate-100 hover:border-indigo-100 transition-all group">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Match {num}</span>
                                            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm">
                                                <ChevronRight size={12} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="relative">
                                                <div
                                                    onClick={() => setShowDatePicker(idx)}
                                                    className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-3 cursor-pointer flex items-center justify-between hover:shadow-md transition-all"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Calendar size={16} className="text-slate-400" />
                                                        <span className="text-sm font-bold text-slate-700">{formatDateLabel(schedules[idx].date)}</span>
                                                    </div>
                                                </div>

                                                {showDatePicker === idx && (
                                                    <div className="absolute z-[110] mt-2 left-0 right-0 animate-in fade-in slide-in-from-top-2">
                                                        <div className="fixed inset-0" onClick={() => setShowDatePicker(null)}></div>
                                                        <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2">
                                                            <WheelDatePicker
                                                                value={schedules[idx].date}
                                                                onChange={(val) => {
                                                                    const next = [...schedules];
                                                                    next[idx].date = val;
                                                                    setSchedules(next);
                                                                }}
                                                            />
                                                            <button
                                                                onClick={() => setShowDatePicker(null)}
                                                                className="w-full mt-2 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-xs"
                                                            >
                                                                Set Date
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-3 flex-1">
                                                <Clock size={16} className="text-slate-400" />
                                                <input
                                                    type="time"
                                                    value={schedules[idx].time}
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

                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                            <p className="text-[10px] font-bold text-slate-400 max-w-[200px] leading-relaxed uppercase tracking-widest">
                                Matches will be created in "Upcoming" status.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setSchedulingStage(null)}
                                    className="px-6 py-3 text-slate-500 font-bold text-sm hover:bg-white rounded-2xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmActivationWithSchedules}
                                    disabled={isCreatingMatches}
                                    className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-bold text-sm shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                >
                                    {isCreatingMatches ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Generating Matches...</span>
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
