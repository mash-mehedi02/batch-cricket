import { useState, useMemo } from 'react';
import { Tournament, Match, Squad } from '@/types';
import { CheckCircle2, AlertCircle, ShieldCheck, Trophy, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

interface QualificationCenterProps {
    tournament: Tournament;
    matches: Match[];
    squads: Squad[];
    onUpdate: (data: Partial<Tournament>) => Promise<void>;
}

interface GroupStanding {
    id: string;
    name: string;
    targetCount: number;
    confirmed: string[];
    pool: Squad[];
}

export default function QualificationCenter({ tournament, squads, onUpdate }: QualificationCenterProps) {
    const [confirming, setConfirming] = useState<string | null>(null);

    const groupStandings = useMemo<GroupStanding[]>(() => {
        const groups = (tournament as any).config?.groups || [];
        return groups.map((g: any) => ({
            id: g.id,
            name: g.name,
            targetCount: g.qualification?.qualifyCount || 0,
            confirmed: tournament.confirmedQualifiers?.[g.id] || [],
            pool: squads.filter(s => g.squadIds.includes(s.id))
        }));
    }, [tournament, squads]);

    const confirmQualifiers = async (groupId: string, squadIds: string[]) => {
        setConfirming(groupId);
        try {
            const currentConfirmed = { ...(tournament.confirmedQualifiers || {}) };
            currentConfirmed[groupId] = squadIds;

            await onUpdate({
                confirmedQualifiers: currentConfirmed
            });
            toast.success(`Qualification decision updated`);
        } finally {
            setConfirming(null);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-medium text-slate-900 tracking-tight">Stage Progression Center</h2>
                <p className="text-sm text-slate-400 mt-1">Manual confirmation of teams moving to next stages. NO automatic logic.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {groupStandings.map((g) => {
                    const isFullyConfirmed = g.confirmed.length >= g.targetCount && g.targetCount > 0;

                    return (
                        <div key={g.id} className={`bg-white rounded-[2rem] border p-8 transition-all duration-300 ${isFullyConfirmed ? 'border-emerald-100 shadow-sm' : 'border-slate-100'
                            }`}>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border ${confirming === g.id ? 'animate-pulse bg-slate-50' :
                                        isFullyConfirmed ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'
                                        }`}>
                                        {isFullyConfirmed ? <ShieldCheck size={24} /> : <Lock size={24} />}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">{g.name}</h3>
                                        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mt-0.5">
                                            Requires {g.targetCount} Qualifiers
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {isFullyConfirmed ? (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-black uppercase tracking-widest">
                                            <CheckCircle2 size={14} />
                                            Confirmed
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-black uppercase tracking-widest">
                                            <AlertCircle size={14} />
                                            Pending Decision
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {g.pool.map(squad => {
                                    const isConfirmed = g.confirmed.includes(squad.id);
                                    return (
                                        <button
                                            key={squad.id}
                                            onClick={() => {
                                                const isConfirmed = g.confirmed.includes(squad.id);
                                                if (!isConfirmed && g.targetCount > 0 && g.confirmed.length >= g.targetCount) {
                                                    toast.error(`Limit reached! You can only select ${g.targetCount} teams for ${g.name}.`);
                                                    return;
                                                }
                                                const next = isConfirmed
                                                    ? g.confirmed.filter((id: string) => id !== squad.id)
                                                    : [...g.confirmed, squad.id];
                                                confirmQualifiers(g.id, next);
                                            }}
                                            className={`p-4 rounded-2xl border transition-all text-left ${isConfirmed
                                                ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg'
                                                : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                                                }`}
                                        >
                                            <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">
                                                {isConfirmed ? 'Selected Qualifier' : 'Available Squad'}
                                            </div>
                                            <div className="font-bold text-sm truncate">{squad.name}</div>
                                        </button>
                                    );
                                })}
                            </div>

                            {!isFullyConfirmed && g.targetCount > 0 && (
                                <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                                    <Trophy size={16} className="text-amber-500 flex-shrink-0" />
                                    <p>Select the top {g.targetCount} teams after reviewing the points table. Only these confirmed teams will appear in the knockout bracket builder.</p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
