import { useState, useEffect, useMemo } from 'react';
import { Tournament, Squad, Match } from '@/types';
import { GitPullRequest, Trophy, Medal } from 'lucide-react';
import { computeGroupStandings } from '@/engine/tournament/standings';
import toast from 'react-hot-toast';

interface BracketManagerProps {
    tournament: Tournament;
    squads: Squad[];
    matches: Match[];
    inningsMap: Map<string, any>;
    onUpdate: (data: Partial<Tournament>) => Promise<void>;
}

export default function BracketManager({ tournament, squads, matches, inningsMap, onUpdate }: BracketManagerProps) {
    const config = (tournament as any).config || {};
    const knockout = config.knockout || { custom: { matches: [] } };
    const koMatches = knockout.custom?.matches || [];
    const confirmedQualifiers = tournament.confirmedQualifiers || {};
    const allQualifiers = Object.values(confirmedQualifiers).flat() as string[];

    const getSquadName = (id: string) => {
        if (!id) return 'Select Team';
        if (id.startsWith('winner:')) {
            const matchId = id.split(':')[1].toUpperCase();
            return `Winner of ${matchId}`;
        }
        if (id.includes(':')) {
            const [gid, rankStr] = id.split(':');
            const rank = parseInt(rankStr);
            const group = config.groups?.find((g: any) => g.id === gid);

            // 1. Check confirmed
            const confirmedInGroup = confirmedQualifiers[gid] || [];
            if (confirmedInGroup[rank - 1]) {
                const squad = squads.find(s => s.id === confirmedInGroup[rank - 1]);
                if (squad) {
                    const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
                    return `${squad.name} (${rank}${suffix} in ${group?.name || gid})`;
                }
            }

            if (group) {
                const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
                return `${rank}${suffix} in ${group.name}`;
            }
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

    const getMatch = (id: string) => koMatches.find((m: any) => m.id === id) || { id, a: '', b: '' };

    const isOptionTaken = (optionId: string, round: string, currentSlotId: string, currentSide: 'a' | 'b') => {
        if (!optionId || optionId === 'TBD' || optionId.startsWith('winner:')) {
            // For Semi/Final winner refs, we still want unique mapping (e.g. S1 can't play S1)
            if (optionId.startsWith('winner:')) {
                return koMatches.some((m: any) =>
                    m.round === round &&
                    (m.id !== currentSlotId || (currentSide === 'a' ? m.b === optionId : m.a === optionId)) &&
                    (m.a === optionId || m.b === optionId)
                );
            }
            return false;
        }

        return koMatches.some((m: any) => {
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
            const isUsed = koMatches.some((m: any) =>
                (m.id !== slotId || (side === 'b' ? m.a !== value : m.b !== value)) &&
                (m.a === value || m.b === value) &&
                slots.find(s => s.id === m.id)?.round === slots.find(s => s.id === slotId)?.round
            );

            if (isUsed) {
                toast.error(`${getSquadName(value)} is already selected in another match in this round.`);
                return;
            }
        }

        const matchIdx = koMatches.findIndex((m: any) => m.id === slotId);
        let newMatches = [...koMatches];

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

    const autoMapSlots = async () => {
        const groups = config.groups || [];
        if (groups.length === 0) {
            toast.error("Set up groups first!");
            return;
        }

        let newMatches: any[] = [];
        if (groups.length === 2) {
            // Semi-finals: 1A vs 2B, 1B vs 2A
            newMatches = [
                { id: 's1', round: 'semi_final', a: `${groups[0].id}:1`, b: `${groups[1].id}:2` },
                { id: 's2', round: 'semi_final', a: `${groups[1].id}:1`, b: `${groups[0].id}:2` },
                { id: 'f1', round: 'final', a: 'winner:s1', b: 'winner:s2' }
            ];
        } else if (groups.length === 4) {
            // Quarter-finals: 1A vs 2C, 1B vs 2D, 1C vs 2A, 1D vs 2B (Classic cross)
            newMatches = [
                { id: 'q1', round: 'quarter_final', a: `${groups[0].id}:1`, b: `${groups[2].id}:2` },
                { id: 'q2', round: 'quarter_final', a: `${groups[1].id}:1`, b: `${groups[3].id}:2` },
                { id: 'q3', round: 'quarter_final', a: `${groups[2].id}:1`, b: `${groups[0].id}:2` },
                { id: 'q4', round: 'quarter_final', a: `${groups[3].id}:1`, b: `${groups[1].id}:2` },
                { id: 's1', round: 'semi_final', a: 'winner:q1', b: 'winner:q2' },
                { id: 's2', round: 'semi_final', a: 'winner:q3', b: 'winner:q4' },
                { id: 'f1', round: 'final', a: 'winner:s1', b: 'winner:s2' }
            ];
        } else {
            // General fallback: Just map sequentially if possible
            toast("Groups count unusual. Mapping sequentially.");
            for (let i = 0; i < groups.length; i++) {
                const qId = `q${i + 1}`;
                const oppIdx = (i + 1) % groups.length;
                newMatches.push({ id: qId, round: 'quarter_final', a: `${groups[i].id}:1`, b: `${groups[oppIdx].id}:2` });
            }
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
        toast.success("Standard pairings applied!");
    };

    const getResolvedSquad = (id: string) => {
        if (!id) return null;
        if (id.startsWith('winner:')) return null;
        if (id.includes(':')) {
            const [gid, rankStr] = id.split(':');
            const rank = parseInt(rankStr);
            const confirmedInGroup = confirmedQualifiers[gid] || [];

            // 1. Confirmed
            if (confirmedInGroup[rank - 1]) {
                return squads.find(s => s.id === confirmedInGroup[rank - 1]);
            }

            return null;
        }
        return squads.find(s => s.id === id);
    };

    // Auto-initialize if empty
    useEffect(() => {
        if (koMatches.length === 0 && (config.groups?.length === 2 || config.groups?.length === 4)) {
            autoMapSlots();
        }
    }, [config.groups?.length, koMatches.length]);

    const renderMatchSlot = (slot: typeof slots[0]) => {
        const match = getMatch(slot.id);
        const squadA = getResolvedSquad(match.a);
        const squadB = getResolvedSquad(match.b);
        const isFinal = slot.round === 'final';

        // Define options based on round
        let optionsA: { id: string, name: string }[] = [];
        let optionsB: { id: string, name: string }[] = [];

        if (slot.round === 'quarter_final') {
            // Add automatic group positions
            const groupOptions: any[] = [];
            (config.groups || []).forEach((g: any) => {
                const qualifyCount = g.qualification?.qualifyCount || 2;
                const confirmed = confirmedQualifiers[g.id] || [];
                for (let i = 1; i <= qualifyCount; i++) {
                    const suffix = i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th';
                    const squad = confirmed[i - 1] ? squads.find(s => s.id === confirmed[i - 1]) : null;
                    const label = squad ? `${squad.name} (${i}${suffix} in ${g.name})` : `${i}${suffix} in ${g.name}`;
                    groupOptions.push({ id: `${g.id}:${i}`, name: label });
                }
            });

            optionsA = [
                ...groupOptions,
                ...allQualifiers.map(id => ({ id, name: getSquadName(id) }))
            ];
            optionsB = [...optionsA];
        } else if (slot.round === 'semi_final') {
            optionsA = ['q1', 'q2', 'q3', 'q4'].map(id => ({ id: `winner:${id}`, name: `Winner of ${id.toUpperCase()}` }));
            optionsB = [...optionsA];
        } else {
            // Final is strictly S1 vs S2
            optionsA = [{ id: 'winner:s1', name: 'Winner of S1' }];
            optionsB = [{ id: 'winner:s2', name: 'Winner of S2' }];
        }

        const renderTeamSelector = (side: 'a' | 'b', currentId: string, resolvedSquad: Squad | null | undefined, options: any[]) => (
            <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                        {side === 'a' ? 'Team 1' : 'Team 2'}
                    </label>
                    {resolvedSquad && (
                        <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Matched</span>
                        </div>
                    )}
                </div>

                <div className="relative group/team">
                    {resolvedSquad && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none z-10">
                            <img src={resolvedSquad.logoUrl || '/img/default-squad.png'} className="w-5 h-5 rounded-md object-contain" alt="" />
                            <span className="text-sm font-bold text-slate-900 truncate max-w-[120px]">{resolvedSquad.name}</span>
                        </div>
                    )}

                    <select
                        disabled={isFinal}
                        value={currentId}
                        onChange={(e) => updateMatchSlot(slot.id, side, e.target.value)}
                        className={`w-full bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all ${resolvedSquad ? 'pl-24 pr-4 py-2.5 text-transparent' : 'px-4 py-2.5'}`}
                    >
                        <option value="">{isFinal ? `Winner of ${side === 'a' ? 'S1' : 'S2'}` : 'Select Team...'}</option>
                        {options.map(opt => {
                            const isTaken = isOptionTaken(opt.id, slot.round, slot.id, side);
                            return (
                                <option key={opt.id} value={opt.id} disabled={isTaken} className="text-slate-900">
                                    {opt.name} {isTaken ? ' (Already Selected)' : ''}
                                </option>
                            );
                        })}
                        <option value="TBD" className="text-slate-900">TBD</option>
                    </select>
                </div>
            </div>
        );

        return (
            <div key={slot.id} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 relative group border-t-4 border-t-indigo-500/20">
                <div className="absolute -top-3 left-6 px-3 py-1 bg-white border border-slate-100 rounded-full text-[9px] font-black uppercase tracking-widest text-indigo-600 shadow-sm">
                    {slot.id.toUpperCase()}
                </div>

                <div className="space-y-4 pt-2">
                    {renderTeamSelector('a', match.a, squadA, optionsA)}

                    <div className="flex justify-center relative py-1">
                        <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-50" />
                        <div className="relative px-3 py-1 bg-slate-900 text-[9px] font-black text-white rounded-full">VS</div>
                    </div>

                    {renderTeamSelector('b', match.b, squadB, optionsB)}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-medium text-slate-900 tracking-tight">Knockout Bracket Builder</h2>
                    <p className="text-sm text-slate-400 mt-1">Design the path to glory. Matches progress automatically based on your pairings.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={autoMapSlots}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all active:scale-95"
                    >
                        <GitPullRequest size={14} />
                        Auto-Map Slots
                    </button>
                </div>
            </div>

            {allQualifiers.length === 0 && (!config.groups || config.groups.length === 0) ? (
                <div className="bg-amber-50 rounded-[2rem] border border-amber-100 p-12 text-center">
                    <GitPullRequest className="mx-auto text-amber-500 mb-4" size={48} />
                    <h3 className="text-lg font-bold text-amber-900">No Groups or Qualifiers</h3>
                    <p className="text-sm text-amber-600 mt-2 max-w-md mx-auto">Please set up your tournament groups or confirm qualifiers before building the knockout bracket.</p>
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
