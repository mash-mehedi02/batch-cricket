import React, { useState } from 'react';
import { Tournament, TournamentStageInfo, TournamentStageStatus } from '@/types';
import { Plus, Trash2, GripVertical, CheckCircle2, Circle, PlayCircle, PauseCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface StructureBuilderProps {
    tournament: Tournament;
    onUpdate: (data: Partial<Tournament>) => Promise<void>;
    isLocked?: boolean;
}

export default function StructureBuilder({ tournament, onUpdate, isLocked }: StructureBuilderProps) {
    const stages = tournament.stages || [];

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
                                                    <button onClick={() => updateStage(stage.id, { status: 'active' })} className="p-2 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors" title="Activate Stage">
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
        </div>
    );
}
