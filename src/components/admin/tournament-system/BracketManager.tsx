import { Tournament, Squad } from '@/types';
import { GitPullRequest, Trophy, Medal } from 'lucide-react';
import toast from 'react-hot-toast';

interface BracketManagerProps {
    tournament: Tournament;
    squads: Squad[];
    onUpdate: (data: Partial<Tournament>) => Promise<void>;
}

export default function BracketManager({ tournament, squads, onUpdate }: BracketManagerProps) {
    const config = (tournament as any).config || {};
    const knockout = config.knockout || { custom: { matches: [] } };
    const matches = knockout.custom?.matches || [];
    const confirmedQualifiers = tournament.confirmedQualifiers || {};
    const allQualifiers = Object.values(confirmedQualifiers).flat() as string[];

    const getSquadName = (id: string) => {
        if (!id) return 'Select Team';
        if (id.startsWith('winner:')) {
            const matchId = id.split(':')[1].toUpperCase();
            return `Winner of ${matchId}`;
        }
        return squads.find(s => s.id === id)?.name || id;
    };

    // Pre-defined match slots
    const slots = [
        { id: 'q1', round: 'quarter_final', label: 'Quarter Final 1' },
        { id: 'q2', round: 'quarter_final', label: 'Quarter Final 2' },
        { id: 'q3', round: 'quarter_final', label: 'Quarter Final 3' },
        { id: 'q4', round: 'quarter_final', label: 'Quarter Final 4' },
        { id: 's1', round: 'semi_final', label: 'Semi Final 1' },
        { id: 's2', round: 'semi_final', label: 'Semi Final 2' },
        { id: 'f1', round: 'final', label: 'The Grande Final' },
    ];

    const getMatch = (id: string) => matches.find((m: any) => m.id === id) || { id, a: '', b: '' };

    const isOptionTaken = (optionId: string, round: string, currentSlotId: string, currentSide: 'a' | 'b') => {
        if (!optionId || optionId === 'TBD' || optionId.startsWith('winner:')) {
            // For Semi/Final winner refs, we still want unique mapping (e.g. S1 can't play S1)
            if (optionId.startsWith('winner:')) {
                return matches.some((m: any) =>
                    m.round === round &&
                    (m.id !== currentSlotId || (currentSide === 'a' ? m.b === optionId : m.a === optionId)) &&
                    (m.a === optionId || m.b === optionId)
                );
            }
            return false;
        }

        return matches.some((m: any) => {
            if (m.round !== round) return false;
            if (m.id !== currentSlotId) {
                return m.a === optionId || m.b === optionId;
            }
            return currentSide === 'a' ? m.b === optionId : m.a === optionId;
        });
    };

    const updateMatchSlot = async (slotId: string, side: 'a' | 'b', value: string) => {
        // Enforce uniqueness for teams (excluding TBD and Winner refs)
        if (value && value !== 'TBD' && !value.startsWith('winner:')) {
            const isUsed = matches.some((m: any) =>
                (m.id !== slotId || (side === 'b' ? m.a !== value : m.b !== value)) &&
                (m.a === value || m.b === value) &&
                slots.find(s => s.id === m.id)?.round === slots.find(s => s.id === slotId)?.round
            );

            if (isUsed) {
                toast.error(`${getSquadName(value)} is already selected in another match in this round.`);
                return;
            }
        }

        const matchIdx = matches.findIndex((m: any) => m.id === slotId);
        let newMatches = [...matches];

        if (matchIdx > -1) {
            newMatches[matchIdx] = { ...newMatches[matchIdx], [side]: value };
        } else {
            const slot = slots.find(s => s.id === slotId);
            newMatches.push({ id: slotId, round: slot?.round, [side]: value, [side === 'a' ? 'b' : 'a']: '' });
        }

        // Auto-progression logic for Final
        if (slotId === 's1' || slotId === 's2') {
            const fIdx = newMatches.findIndex((m: any) => m.id === 'f1');
            const finalMatch = fIdx > -1 ? { ...newMatches[fIdx] } : { id: 'f1', round: 'final', a: 'winner:s1', b: 'winner:s2' };
            finalMatch.a = 'winner:s1';
            finalMatch.b = 'winner:s2';

            if (fIdx > -1) newMatches[fIdx] = finalMatch;
            else newMatches.push(finalMatch);
        }

        await onUpdate({
            config: {
                ...config,
                knockout: {
                    ...knockout,
                    custom: { matches: newMatches }
                }
            }
        });
    };

    const renderMatchSlot = (slot: typeof slots[0]) => {
        const match = getMatch(slot.id);
        const isFinal = slot.round === 'final';

        // Define options based on round
        let optionsA: { id: string, name: string }[] = [];
        let optionsB: { id: string, name: string }[] = [];

        if (slot.round === 'quarter_final') {
            optionsA = allQualifiers.map(id => ({ id, name: getSquadName(id) }));
            optionsB = [...optionsA];
        } else if (slot.round === 'semi_final') {
            optionsA = ['q1', 'q2', 'q3', 'q4'].map(id => ({ id: `winner:${id}`, name: `Winner of ${id.toUpperCase()}` }));
            optionsB = [...optionsA];
        } else {
            // Final is strictly S1 vs S2
            optionsA = [{ id: 'winner:s1', name: 'Winner of S1' }];
            optionsB = [{ id: 'winner:s2', name: 'Winner of S2' }];
        }

        return (
            <div key={slot.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 relative group border-t-4 border-t-indigo-500/20">
                <div className="absolute -top-3 left-6 px-3 py-1 bg-white border border-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest text-indigo-600 shadow-sm">
                    {slot.id.toUpperCase()}
                </div>

                <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-300">Team 1</label>
                        <select
                            disabled={isFinal}
                            value={match.a}
                            onChange={(e) => updateMatchSlot(slot.id, 'a', e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            <option value="">{isFinal ? 'Winner of S1' : 'Select Confirmed Team'}</option>
                            {optionsA.map(opt => {
                                const isTaken = isOptionTaken(opt.id, slot.round, slot.id, 'a');
                                return (
                                    <option key={opt.id} value={opt.id} disabled={isTaken}>
                                        {opt.name} {isTaken ? ' (Already Selected)' : ''}
                                    </option>
                                );
                            })}
                            <option value="TBD">TBD</option>
                        </select>
                    </div>

                    <div className="flex justify-center">
                        <div className="px-3 py-1 bg-slate-900 text-[10px] font-black text-white rounded-full">VS</div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-300">Team 2</label>
                        <select
                            disabled={isFinal}
                            value={match.b}
                            onChange={(e) => updateMatchSlot(slot.id, 'b', e.target.value)}
                            className="w-full bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            <option value="">{isFinal ? 'Winner of S2' : 'Select Confirmed Team'}</option>
                            {optionsB.map(opt => {
                                const isTaken = isOptionTaken(opt.id, slot.round, slot.id, 'b');
                                return (
                                    <option key={opt.id} value={opt.id} disabled={isTaken}>
                                        {opt.name} {isTaken ? ' (Already Selected)' : ''}
                                    </option>
                                );
                            })}
                            <option value="TBD">TBD</option>
                        </select>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div>
                <h2 className="text-2xl font-medium text-slate-900 tracking-tight">Knockout Bracket Builder</h2>
                <p className="text-sm text-slate-400 mt-1">Design the path to glory. Matches progress automatically based on your pairings.</p>
            </div>

            {allQualifiers.length === 0 ? (
                <div className="bg-amber-50 rounded-[2rem] border border-amber-100 p-12 text-center">
                    <GitPullRequest className="mx-auto text-amber-500 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-amber-900">No Confirmed Qualifiers</h3>
                    <p className="text-sm text-amber-600 mt-2 max-w-md mx-auto">Please confirm qualifiers in the Qualification Center before building the knockouts.</p>
                </div>
            ) : (
                <div className="space-y-16">
                    {/* Quarter Finals */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <Medal size={16} />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Quarter Finals</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {slots.filter(s => s.round === 'quarter_final').map(renderMatchSlot)}
                        </div>
                    </section>

                    {/* Semi Finals */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500">
                                <Trophy size={16} />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Semi Finals</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
                            {slots.filter(s => s.round === 'semi_final').map(renderMatchSlot)}
                        </div>
                    </section>

                    {/* Final */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shadow-xl shadow-amber-100 animate-pulse">
                                <Trophy size={24} />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-amber-500">Grand Final</h3>
                        </div>
                        <div className="max-w-md">
                            {slots.filter(s => s.round === 'final').map(renderMatchSlot)}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
