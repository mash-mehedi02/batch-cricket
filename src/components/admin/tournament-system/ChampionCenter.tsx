import { Tournament, Squad, Match } from '@/types';
import { Trophy, Star, ShieldCheck, History } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface ChampionCenterProps {
    tournament: Tournament;
    squads: Squad[];
    matches: Match[];
    onUpdate: (data: Partial<Tournament>) => Promise<void>;
}

export default function ChampionCenter({ tournament, squads, matches, onUpdate }: ChampionCenterProps) {
    // Detect the final match
    const finalMatch = matches.find(m =>
        m.round === 'final' ||
        m.matchNo?.toLowerCase() === 'f1' ||
        (m.stage === 'knockout' && m.matchNo?.toLowerCase().includes('final') && !m.matchNo?.toLowerCase().includes('semi') && !m.matchNo?.toLowerCase().includes('quarter'))
    );

    const winnerId = finalMatch?.winnerId;
    const winnerSquad = winnerId ? squads.find(s => s.id === winnerId) : null;
    const isFinalFinished = finalMatch?.status === 'finished';

    const declareChampion = async () => {
        if (!winnerSquad) return;

        if (!confirm(`The final match is complete. Are you sure you want to declare ${winnerSquad.name} as the OFFICIAL CHAMPION of ${tournament.name}?`)) return;

        await onUpdate({
            status: 'completed',
            winnerSquadId: winnerSquad.id,
            winnerSquadName: winnerSquad.name,
            updatedAt: Timestamp.now()
        });
    };

    const undoDeclaration = async () => {
        if (!confirm(`Are you sure you want to UNDO the champion declaration? This will set the tournament status back to 'ongoing'.`)) return;

        await onUpdate({
            status: 'ongoing',
            winnerSquadId: '',
            winnerSquadName: '',
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
                    The champion is automatically determined from the final match result. Declaring a champion will complete the tournament.
                </p>

                {tournament.winnerSquadId ? (
                    <div className="mt-10 flex flex-col items-center gap-6">
                        <div className="p-8 bg-emerald-50 rounded-[2rem] border border-emerald-100 inline-block">
                            <div className="flex items-center gap-4">
                                <Star className="text-amber-500 fill-amber-500" size={32} />
                                <div className="text-left">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Official Champion</div>
                                    <div className="text-2xl font-black text-slate-900 line-clamp-1">{tournament.winnerSquadName}</div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={undoDeclaration}
                            className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-500 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                        >
                            <History size={14} />
                            <span>Undo Declaration</span>
                        </button>
                    </div>
                ) : (
                    <div className="mt-10 max-w-xl mx-auto">
                        {!finalMatch ? (
                            <div className="p-10 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                                <History size={32} className="text-slate-300 mx-auto mb-4" />
                                <div className="text-slate-600 font-bold">Final Match Not Scheduled</div>
                                <p className="text-xs text-slate-400 mt-1">Please schedule the "Final" match in the Knockouts section first.</p>
                            </div>
                        ) : !isFinalFinished ? (
                            <div className="p-10 bg-indigo-50 rounded-[2rem] border border-indigo-100">
                                <div className="text-indigo-600 font-bold uppercase tracking-widest text-[10px] mb-3">Awaiting Results</div>
                                <div className="text-slate-900 font-black text-lg">Final: {finalMatch.teamAName} vs {finalMatch.teamBName}</div>
                                <p className="text-xs text-slate-500 mt-2">The champion can be declared once this match is finished.</p>
                            </div>
                        ) : winnerSquad ? (
                            <div className="space-y-6">
                                <div className="p-8 bg-amber-50 rounded-[2rem] border-2 border-amber-200 shadow-xl shadow-amber-100/50 relative overflow-hidden group">
                                    <Trophy size={100} className="absolute -right-4 -bottom-4 text-amber-200/40 rotate-12 group-hover:rotate-0 transition-transform duration-700" />
                                    <div className="relative z-10">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-700 mb-2">Detected Winner</div>
                                        <div className="text-3xl font-black text-slate-900 mb-1">{winnerSquad.name}</div>
                                        <div className="text-xs text-slate-500 font-medium">Won the Grand Final</div>
                                    </div>
                                </div>

                                <button
                                    onClick={declareChampion}
                                    className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black uppercase tracking-widest hover:bg-black hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3"
                                >
                                    <ShieldCheck size={20} className="text-amber-400" />
                                    <span>Declare Official Champion</span>
                                </button>
                            </div>
                        ) : (
                            <div className="p-10 bg-rose-50 rounded-[2rem] border border-rose-100">
                                <div className="text-rose-600 font-bold">No Winner Recorded</div>
                                <p className="text-xs text-slate-500 mt-1">The final match finished but no winner was set. Please check the match results.</p>
                            </div>
                        )}
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
