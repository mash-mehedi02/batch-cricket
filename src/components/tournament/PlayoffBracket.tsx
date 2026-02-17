import { useMemo } from 'react';
import { Tournament, Squad, Match } from '@/types';
import { Trophy, Medal, Star } from 'lucide-react';
import { computeGroupStandings } from '@/engine/tournament/standings';
import type { MatchResult } from '@/engine/tournament/types';

interface PlayoffBracketProps {
    tournament: Tournament;
    squads: Squad[];
    matches: Match[];
}

export default function PlayoffBracket({ tournament, squads, matches }: PlayoffBracketProps) {
    const config = (tournament as any).config || {};
    const knockout = config.knockout || { custom: { matches: [] } };
    const bracketMatches = knockout.custom?.matches || [];

    // Simplified: Only use tournament logic for bracket

    if (bracketMatches.length === 0) {
        return (
            <div className="py-20 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Trophy size={40} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Bracket Not Generated</h3>
                <p className="text-sm text-slate-500 mt-2">The knockout stage schedule is not yet available for this tournament.</p>
            </div>
        );
    }

    const getSquad = (id: string) => squads.find(s => s.id === id);

    const resolveWinner = (sourceId: string, slotId: string): { name: string, logo?: string, id?: string, isWinner?: boolean, score?: string } => {
        // 1. Check if the slot itself has a completed match
        const slotMatch = matches.find(m => m.matchNo?.toLowerCase() === slotId.toLowerCase());

        if (slotMatch && slotMatch.status === 'finished' && slotMatch.winnerId) {
            const winner = getSquad(slotMatch.winnerId);
            const scoreA = slotMatch.score?.teamA ? `${slotMatch.score.teamA.runs}/${slotMatch.score.teamA.wickets}` : '';
            const scoreB = slotMatch.score?.teamB ? `${slotMatch.score.teamB.runs}/${slotMatch.score.teamB.wickets}` : '';
            return {
                name: winner?.name || 'Unknown',
                logo: winner?.logoUrl,
                id: winner?.id,
                isWinner: true,
                score: slotMatch.winnerId === slotMatch.teamAId ? scoreA : scoreB
            };
        }

        // 2. Resolve placeholder if it's a winner ref (e.g. winner:s1)
        if (sourceId?.startsWith('winner:')) {
            const parentSlotId = sourceId.split(':')[1];
            const parentMatch = matches.find(m => m.matchNo?.toLowerCase() === parentSlotId.toLowerCase());
            if (parentMatch && parentMatch.status === 'finished' && parentMatch.winnerId) {
                const winner = getSquad(parentMatch.winnerId);
                return {
                    name: winner?.name || 'Unknown',
                    logo: winner?.logoUrl,
                    id: winner?.id
                };
            }
            return { name: `Winner of ${parentSlotId.toUpperCase()}` };
        }

        // 3. Resolve group-rank mapping (e.g. group-a:1)
        if (sourceId?.includes(':')) {
            const [gid, rankStr] = sourceId.split(':');
            const rank = parseInt(rankStr);
            const groupConfig = config.groups?.find((g: any) => g.id === gid);

            // PRIORITY 1: Check admin-confirmed qualifiers
            const confirmedGroup = tournament.confirmedQualifiers?.[gid] || [];
            if (confirmedGroup[rank - 1]) {
                const winner = getSquad(confirmedGroup[rank - 1]);
                if (winner) return { name: winner.name, logo: winner.logoUrl, id: winner.id };
            }

            // Fallback to pretty label if not yet resolved
            const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
            return {
                name: groupConfig ? `${rank}${suffix} in ${groupConfig.name}` : sourceId
            };
        }

        // 4. Direct squad ID or generic TBD
        if (sourceId && sourceId !== 'TBD') {
            const squad = getSquad(sourceId);
            return {
                name: squad?.name || sourceId,
                logo: squad?.logoUrl,
                id: squad?.id
            };
        }

        return { name: 'TBD' };
    };

    const renderMatchCard = (slotId: string, label: string) => {
        const m = bracketMatches.find((bm: any) => bm.id === slotId) || { id: slotId, a: '', b: '' };
        const teamA = resolveWinner(m.a, slotId);
        const teamB = resolveWinner(m.b, slotId);

        // Find match for this slot to show scores if ongoing or finished
        const slotMatch = matches.find(m => m.matchNo?.toLowerCase() === slotId.toLowerCase());

        return (
            <div key={slotId} className="w-full max-w-[200px] bg-white dark:bg-[#0A101E] border border-slate-100 dark:border-white/5 rounded-2xl p-3 shadow-sm relative group overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-blue-600 opacity-50 group-hover:opacity-100 transition-opacity" />

                <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[7.5px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                    {slotMatch?.status === 'live' && (
                        <div className="flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Live</span>
                        </div>
                    )}
                </div>

                <div className="space-y-2.5">
                    {/* Team A */}
                    <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {teamA.logo ? (
                                    <img src={teamA.logo} alt="" className="w-full h-full object-contain p-1" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-[10px] font-bold text-slate-400 uppercase">
                                        ?
                                    </div>
                                )}
                            </div>
                            <span className={`text-xs font-bold truncate ${teamA.name === 'TBD' ? 'text-slate-400' : 'text-slate-900 dark:text-white'} ${slotMatch?.winnerId === m.a ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                {teamA.name}
                            </span>
                        </div>
                        {slotMatch?.status === 'finished' && slotMatch.winnerId === m.a && (
                            <Trophy size={12} className="text-amber-500 flex-shrink-0" />
                        )}
                        {slotMatch?.score?.teamA && (
                            <span className="text-[10px] font-black text-slate-400 tabular-nums">
                                {slotMatch.score.teamA.runs}/{slotMatch.score.teamA.wickets}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="h-px flex-1 bg-slate-100 dark:bg-white/5" />
                        <span className="text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-tighter">VS</span>
                        <div className="h-px flex-1 bg-slate-100 dark:bg-white/5" />
                    </div>

                    {/* Team B */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {teamB.logo ? (
                                    <img src={teamB.logo} alt="" className="w-full h-full object-contain p-1" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-[9px] font-bold text-slate-400 uppercase">
                                        ?
                                    </div>
                                )}
                            </div>
                            <span className={`text-[11px] font-bold truncate ${teamB.name === 'TBD' ? 'text-slate-400' : 'text-slate-900 dark:text-white'} ${slotMatch?.winnerId === m.b ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                {teamB.name}
                            </span>
                        </div>
                        {slotMatch?.status === 'finished' && slotMatch.winnerId === m.b && (
                            <Trophy size={12} className="text-amber-500 flex-shrink-0" />
                        )}
                        {slotMatch?.score?.teamB && (
                            <span className="text-[10px] font-black text-slate-400 tabular-nums">
                                {slotMatch.score.teamB.runs}/{slotMatch.score.teamB.wickets}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Group matches by round for dynamic rendering
    const rounds = useMemo(() => {
        const groups: { [key: string]: any[] } = {
            'quarter_final': [],
            'semi_final': [],
            'final': []
        };

        bracketMatches.forEach((m: any) => {
            if (groups[m.round]) {
                groups[m.round].push(m);
            }
        });

        // Only keep rounds that have at least one match with something configured
        return Object.entries(groups).filter(([round, matches]) => {
            return matches.some(m => (m.a && m.a !== 'TBD') || (m.b && m.b !== 'TBD'));
        }).map(([id, matches]) => ({
            id,
            label: id === 'quarter_final' ? 'Quarter Finals' : id === 'semi_final' ? 'Semi Finals' : 'Grand Final',
            matches
        }));
    }, [bracketMatches]);

    if (rounds.length === 0) {
        return (
            <div className="py-20 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Trophy size={40} className="text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Bracket Pending</h3>
                <p className="text-sm text-slate-500 mt-2">Knockout pairings are being finalized by the administrators.</p>
            </div>
        );
    }

    return (
        <div className="py-8 bg-slate-50/30 dark:bg-transparent rounded-[2rem]">
            <div className="flex flex-row gap-0 overflow-x-auto no-scrollbar pb-10 min-w-full items-stretch px-0 h-[700px]">
                {rounds.map((round, rIdx) => (
                    <div key={round.id} className="flex flex-row items-stretch">
                        {/* Round Column */}
                        <div className="flex flex-col min-w-[210px] h-full">
                            <div className="flex items-center justify-center gap-2 mb-8 h-10">
                                <div className={`p-1 rounded-xl ${round.id === 'final' ? 'bg-amber-500/10' : 'bg-slate-100 dark:bg-white/5'}`}>
                                    {round.id === 'quarter_final' ? <Medal size={14} className="text-slate-400" /> :
                                        round.id === 'semi_final' ? <Trophy size={14} className="text-blue-500" /> :
                                            <Star size={14} className="text-amber-500 fill-amber-500" />}
                                </div>
                                <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${round.id === 'final' ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {round.label}
                                </h3>
                            </div>

                            <div className="flex-1 relative flex flex-col items-center">
                                <div className="flex-1 flex flex-col justify-around w-full py-4">
                                    {round.matches.map((m: any) => (
                                        <div key={m.id} className="relative flex justify-center">
                                            {round.id === 'final' && (
                                                <div className="absolute -inset-10 bg-amber-500/10 rounded-[50%] blur-[80px] animate-pulse" />
                                            )}
                                            {renderMatchCard(m.id, round.id === 'final' ? 'Grand Final' : m.id.toUpperCase())}
                                        </div>
                                    ))}
                                </div>

                                {round.id === 'final' && (
                                    <div className="absolute bottom-4 self-center w-full max-w-[240px] text-center p-5 bg-gradient-to-br from-slate-900 to-black rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl group-hover:bg-amber-500/20 transition-colors" />
                                        <div className="relative">
                                            <Trophy className="mx-auto text-amber-500 mb-2 drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]" size={32} />
                                            <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.25em] mb-0.5">Champions Trophy</div>
                                            <div className="text-[11px] font-black text-white uppercase tracking-tight">Tournament Glory</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Connector Column */}
                        {rIdx < rounds.length - 1 && (
                            <div className="w-14 flex-shrink-0 relative pointer-events-none">
                                <svg className="absolute inset-0 w-full h-full overflow-visible">
                                    <defs>
                                        <linearGradient id={`grad-${rIdx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.5" />
                                        </linearGradient>
                                    </defs>
                                    {round.matches.map((m, mIdx) => {
                                        const nextMatchIdx = Math.floor(mIdx / 2);
                                        const isTop = mIdx % 2 === 0;

                                        // Total height of the container is 700px - 40px (header)
                                        const usableHeight = 700 - 40;
                                        const currentRoundMatches = round.matches.length;
                                        const nextRoundMatches = rounds[rIdx + 1].matches.length;

                                        // Calculate start and end Y positions based on flex distribution
                                        const startY = 40 + (usableHeight / currentRoundMatches) * (mIdx + 0.5);
                                        const endY = 40 + (usableHeight / nextRoundMatches) * (nextMatchIdx + 0.5);

                                        return (
                                            <path
                                                key={m.id}
                                                d={`M 0 ${startY} L 15 ${startY} L 15 ${endY} L 30 ${endY}`}
                                                fill="none"
                                                stroke={`url(#grad-${rIdx})`}
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                className="transition-all duration-700 opacity-60 dark:opacity-40"
                                            />
                                        );
                                    })}
                                </svg>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
