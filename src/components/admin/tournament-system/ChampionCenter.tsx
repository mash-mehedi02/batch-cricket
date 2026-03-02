import { useState, useEffect } from 'react';
import { Tournament, Squad, Match } from '@/types';
import { Trophy, Star, ShieldCheck, History, Award, Save, Zap, Check } from 'lucide-react';
import { playerService } from '@/services/firestore/players';
import { matchService } from '@/services/firestore/matches';
import { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';



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

    const [manualChampionId, setManualChampionId] = useState(tournament.winnerSquadId || '');
    const [awards, setAwards] = useState({
        playerOfTheTournament: tournament.playerOfTheTournament || '',
        topRunScorer: tournament.topRunScorer || '',
        topWicketTaker: tournament.topWicketTaker || '',
        runnerUpSquadId: tournament.runnerUpSquadId || '',
    });
    const [topPotT, setTopPotT] = useState<any[]>([]);
    const [isSavingAwards, setIsSavingAwards] = useState(false);

    useEffect(() => {
        setAwards({
            playerOfTheTournament: tournament.playerOfTheTournament || '',
            topRunScorer: tournament.topRunScorer || '',
            topWicketTaker: tournament.topWicketTaker || '',
            runnerUpSquadId: tournament.runnerUpSquadId || '',
        });
        if (tournament.winnerSquadId && !manualChampionId) setManualChampionId(tournament.winnerSquadId);
    }, [tournament]);

    const declareChampion = async () => {
        if (!winnerSquad) return;

        if (!confirm(`The final match is complete. Are you sure you want to declare ${winnerSquad.name} as the OFFICIAL CHAMPION of ${tournament.name}?`)) return;

        await onUpdate({
            status: 'completed',
            winnerSquadId: winnerSquad.id,
            winnerSquadName: winnerSquad.name,
            updatedAt: Timestamp.now()
        });
        toast.success("Champion declared successfully!");
    };

    const declareManualChampion = async () => {
        if (!manualChampionId) return;
        const selected = squads.find(s => s.id === manualChampionId);
        if (!selected) return;

        if (!confirm(`Are you sure you want to manually declare ${selected.name} as the OFFICIAL CHAMPION?`)) return;

        await onUpdate({
            status: 'completed',
            winnerSquadId: selected.id,
            winnerSquadName: selected.name,
            updatedAt: Timestamp.now()
        });
        toast.success("Champion declared manually!");
    };

    const autoCalculateAwards = async () => {
        setIsSavingAwards(true);
        try {
            toast.loading("Calculating tournament statistics...", { id: 'calc' });

            // 1. Fetch all matches
            const allMatches = await matchService.getByTournament(tournament.id);
            if (allMatches.length === 0) {
                toast.error("No matches found to calculate stats.", { id: 'calc' });
                setIsSavingAwards(false);
                return;
            }

            // 2. Fetch all innings
            const matchInnings = await Promise.all(allMatches.map(async (m) => {
                const [a, b] = await Promise.all([
                    matchService.getInnings(m.id, 'teamA').catch(() => null),
                    matchService.getInnings(m.id, 'teamB').catch(() => null)
                ]);
                return { teamA: a, teamB: b };
            }));

            // 3. Aggregate Stats
            const runsMap: Record<string, { name: string, runs: number }> = {};
            const wktsMap: Record<string, { name: string, wkts: number }> = {};
            const playerIds = new Set<string>();

            matchInnings.forEach((mi: any) => {
                [mi.teamA, mi.teamB].filter(Boolean).forEach((inn: any) => {
                    (inn!.batsmanStats || []).forEach((b: any) => {
                        if (!b.batsmanId) return;
                        playerIds.add(b.batsmanId);
                        runsMap[b.batsmanId] = {
                            name: b.name || (b as any).playerName || runsMap[b.batsmanId]?.name || 'Unknown',
                            runs: (runsMap[b.batsmanId]?.runs || 0) + (Number(b.runs) || 0)
                        };
                    });
                    (inn!.bowlerStats || []).forEach((bw: any) => {
                        if (!bw.bowlerId) return;
                        playerIds.add(bw.bowlerId);
                        wktsMap[bw.bowlerId] = {
                            name: bw.name || (bw as any).playerName || wktsMap[bw.bowlerId]?.name || 'Unknown',
                            wkts: (wktsMap[bw.bowlerId]?.wkts || 0) + (Number(bw.wickets) || 0)
                        };
                    });
                });
            });

            // 4. Resolve "Unknown" names from DB
            const unknownIds = Array.from(playerIds).filter(id => {
                const rName = runsMap[id]?.name;
                const wName = wktsMap[id]?.name;
                return rName === 'Unknown' || wName === 'Unknown';
            });

            const allPlayers = await Promise.all(
                tournament.participantSquadIds?.map(sid => playerService.getBySquad(sid)) || []
            );
            const flattenedPlayers = allPlayers.flat();

            if (unknownIds.length > 0) {
                const nameMap: Record<string, string> = {};
                flattenedPlayers.forEach((p: any) => { if (p.id) nameMap[p.id] = p.name; });

                unknownIds.forEach(id => {
                    if (nameMap[id]) {
                        if (runsMap[id]) runsMap[id].name = nameMap[id];
                        if (wktsMap[id]) wktsMap[id].name = nameMap[id];
                    }
                });
            }

            const topRunners = Object.values(runsMap).sort((a, b) => b.runs - a.runs);
            const topWicketeers = Object.values(wktsMap).sort((a, b) => b.wkts - a.wkts);

            const bestBatter = topRunners[0];
            const bestBowler = topWicketeers[0];

            // 5. PotT Ranking with Finalist Bonus
            const finalistIds = new Set<string>();
            const rUpId = finalMatch?.winnerId === finalMatch?.teamAId ? finalMatch?.teamBId : finalMatch?.teamAId;
            const finalistSquadIds = [finalMatch?.winnerId, rUpId].filter(Boolean);

            // Get all player IDs belonging to finalist squads
            const finalistPlayers = flattenedPlayers.filter((p: any) => p.squadId && finalistSquadIds.includes(p.squadId));
            finalistPlayers.forEach((p: any) => finalistIds.add(p.id));

            const playerScores = Array.from(playerIds).map(id => {
                const runs = runsMap[id]?.runs || 0;
                const wkts = wktsMap[id]?.wkts || 0;
                const name = runsMap[id]?.name || 'Unknown';
                const score = (runs * 1) + (wkts * 15);

                const isFinalist = finalistIds.has(id);
                return { id, name, runs, wkts, score, isFinalist };
            })
                .filter(p => p.isFinalist) // Strict Filter: Only finalists eligible for PotT
                .sort((a, b) => b.score - a.score);

            const maxScore = playerScores[0]?.score || 1;
            const top5 = playerScores.slice(0, 5).map(p => ({
                ...p,
                percentage: Math.round((p.score / maxScore) * 100)
            }));

            setTopPotT(top5);

            const newAwards = {
                playerOfTheTournament: top5[0]?.name || '',
                topRunScorer: bestBatter ? `${bestBatter.name} (${bestBatter.runs} Runs)` : '',
                topWicketTaker: bestBowler ? `${bestBowler.name} (${bestBowler.wkts} Wkts)` : '',
                runnerUpSquadId: rUpId || ''
            };

            setAwards(prev => ({ ...prev, ...newAwards }));

            // Auto-save the calculated awards
            await onUpdate({
                ...newAwards,
                runnerUpSquadName: squads.find(s => s.id === rUpId)?.name || '',
                updatedAt: Timestamp.now()
            });

            toast.success("Magic! Awards calculated and saved.", { id: 'calc' });
        } catch (e) {
            console.error("Auto calculation error:", e);
            toast.error("Failed to auto-calculate stats.", { id: 'calc' });
        }
        setIsSavingAwards(false);
    };

    const saveAwards = async () => {
        setIsSavingAwards(true);
        try {
            const runnerUpSquad = squads.find(s => s.id === awards.runnerUpSquadId);
            await onUpdate({
                playerOfTheTournament: awards.playerOfTheTournament,
                topRunScorer: awards.topRunScorer,
                topWicketTaker: awards.topWicketTaker,
                runnerUpSquadId: awards.runnerUpSquadId,
                runnerUpSquadName: runnerUpSquad ? runnerUpSquad.name : '',
                updatedAt: Timestamp.now()
            });
            toast.success("Tournament awards updated!");
        } catch (e) {
            toast.error("Failed to update awards.");
        }
        setIsSavingAwards(false);
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
                                <div className="text-slate-600 font-bold">Automatic Detection Unavailable</div>
                                <p className="text-xs text-slate-400 mt-1 mb-6">You can either schedule the "Final" match in Knockouts, or manually declare the champion below.</p>

                                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-left">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Manual Champion Selection</label>
                                    <div className="flex gap-3">
                                        <select
                                            value={manualChampionId}
                                            onChange={e => setManualChampionId(e.target.value)}
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value="">-- Select Champion Squad --</option>
                                            {squads.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={declareManualChampion}
                                            disabled={!manualChampionId}
                                            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-colors whitespace-nowrap"
                                        >
                                            Declare Match
                                        </button>
                                    </div>
                                </div>
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
                                        {tournament.winnerSquadId === winnerSquad.id && (
                                            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                <ShieldCheck size={12} />
                                                <span>Saved as Champion</span>
                                            </div>
                                        )}
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
                                <p className="text-xs text-slate-500 mt-1 mb-6">The final match finished but no winner was set, or you can set it manually.</p>
                                <div className="bg-white p-6 rounded-2xl border border-rose-100 shadow-sm text-left">
                                    <label className="block text-xs font-bold text-rose-500 uppercase tracking-widest mb-2">Manual Champion Override</label>
                                    <div className="flex gap-3">
                                        <select
                                            value={manualChampionId}
                                            onChange={e => setManualChampionId(e.target.value)}
                                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value="">-- Select Champion Squad --</option>
                                            {squads.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={declareManualChampion}
                                            disabled={!manualChampionId}
                                            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-colors whitespace-nowrap"
                                        >
                                            Declare Champion
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Awards Section */}
            <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-100 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center">
                            <Award size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900">Tournament Awards</h3>
                            <p className="text-sm text-slate-500 font-medium tracking-tight">Recognize top performers and add them to the Elite List.</p>
                        </div>
                    </div>

                    <button
                        onClick={autoCalculateAwards}
                        disabled={isSavingAwards}
                        className="flex items-center gap-2.5 px-6 py-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-2xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                        <Zap size={16} fill="white" className="text-indigo-600" />
                        <span>Magic Auto-Calculate</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Player of the Series (Man of the Series)</label>
                            {tournament.playerOfTheTournament && (
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-1">
                                    <Check size={12} /> Saved: {tournament.playerOfTheTournament}
                                </span>
                            )}
                        </div>

                        <div className="relative group">
                            <input
                                type="text"
                                placeholder="e.g. Shakib Al Hasan"
                                value={awards.playerOfTheTournament}
                                onChange={e => setAwards({ ...awards, playerOfTheTournament: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:font-normal"
                            />
                        </div>

                        {topPotT.length > 0 && (
                            <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Top Candidates (%)</div>
                                <div className="space-y-2">
                                    {topPotT.map((p, idx) => (
                                        <button
                                            key={p.id}
                                            onClick={() => setAwards({ ...awards, playerOfTheTournament: p.name })}
                                            className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all border ${awards.playerOfTheTournament === p.name
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                                : 'bg-white border-slate-100 text-slate-600 hover:border-blue-200'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${awards.playerOfTheTournament === p.name ? 'bg-white/20' : 'bg-slate-100'
                                                    }`}>
                                                    {idx + 1}
                                                </span>
                                                <div className="text-left">
                                                    <div className="text-xs font-bold line-clamp-1">{p.name}</div>
                                                    <div className={`text-[9px] font-medium ${awards.playerOfTheTournament === p.name ? 'text-white/70' : 'text-slate-400'}`}>
                                                        {p.runs} R • {p.wkts} W
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {p.isFinalist && <Trophy size={14} className={awards.playerOfTheTournament === p.name ? 'text-white' : 'text-amber-500'} />}
                                                <span className="text-xs font-black">{p.percentage}%</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Runner Up Team</label>
                        <select
                            value={awards.runnerUpSquadId}
                            onChange={e => setAwards({ ...awards, runnerUpSquadId: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        >
                            <option value="">-- Select Runner Up --</option>
                            {squads.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Highest Run Scorer</label>
                        <input
                            type="text"
                            placeholder="e.g. Tamim Iqbal"
                            value={awards.topRunScorer}
                            onChange={e => setAwards({ ...awards, topRunScorer: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:font-normal"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">Highest Wicket Taker</label>
                        <input
                            type="text"
                            placeholder="e.g. Mustafizur Rahman"
                            value={awards.topWicketTaker}
                            onChange={e => setAwards({ ...awards, topWicketTaker: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:font-normal"
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-slate-100">
                    <button
                        onClick={saveAwards}
                        disabled={isSavingAwards}
                        className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-black uppercase tracking-widest rounded-xl transition-all shadow-md hover:shadow-lg"
                    >
                        <Save size={16} />
                        {isSavingAwards ? 'Saving...' : 'Save Awards Data'}
                    </button>
                </div>
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
