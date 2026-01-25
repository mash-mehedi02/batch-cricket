import { Tournament, Squad } from '@/types';
import { Trophy, Star, ShieldCheck, History } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface ChampionCenterProps {
    tournament: Tournament;
    squads: Squad[];
    onUpdate: (data: Partial<Tournament>) => Promise<void>;
}

export default function ChampionCenter({ tournament, squads, onUpdate }: ChampionCenterProps) {
    const declareChampion = async (squadId: string) => {
        const squad = squads.find(s => s.id === squadId);
        if (!squad) return;

        if (!confirm(`Are you sure you want to declare ${squad.name} as the OFFICIAL CHAMPION of ${tournament.name}?`)) return;

        await onUpdate({
            status: 'completed',
            winnerSquadId: squadId,
            winnerSquadName: squad.name,
            updatedAt: Timestamp.now()
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center py-12 bg-white rounded-[3rem] border border-slate-100 shadow-sm px-8 overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-amber-500 to-indigo-500" />

                <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-amber-100 border-2 border-amber-100/50">
                    <Trophy size={48} />
                </div>

                <h2 className="text-3xl font-medium text-slate-900 tracking-tight">Champion Declaration</h2>
                <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto leading-relaxed">
                    Mark the pinnacle of the tournament. Selecting a champion will close the tournament and archive the standings into history.
                </p>

                {tournament.winnerSquadId ? (
                    <div className="mt-10 p-8 bg-emerald-50 rounded-[2rem] border border-emerald-100 inline-block">
                        <div className="flex items-center gap-4">
                            <Star className="text-amber-500 fill-amber-500" size={32} />
                            <div className="text-left">
                                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Reigning Champion</div>
                                <div className="text-2xl font-black text-slate-900">{tournament.winnerSquadName}</div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                        {squads.filter(s => tournament.participantSquadIds?.includes(s.id)).map(squad => (
                            <button
                                key={squad.id}
                                onClick={() => declareChampion(squad.id)}
                                className="p-6 bg-slate-50 hover:bg-white hover:shadow-xl hover:border-amber-200 border border-transparent rounded-[1.5rem] transition-all group"
                            >
                                <ShieldCheck size={20} className="text-slate-200 group-hover:text-amber-500 mb-2 transition-colors mx-auto" />
                                <div className="text-sm font-bold text-slate-900">{squad.name}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Select as Winner</div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden">
                <History className="absolute -bottom-10 -right-10 text-white/5 w-64 h-64" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div>
                        <h3 className="text-xl font-bold mb-2">Tournament Archiving</h3>
                        <p className="text-slate-400 text-sm max-w-md">Once completed, all match data and points remains accessible but no further edits are allowed to the structure.</p>
                    </div>
                    <button className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-sm font-black uppercase tracking-widest backdrop-blur-sm transition-all">
                        Export Data
                    </button>
                </div>
            </div>
        </div>
    );
}
