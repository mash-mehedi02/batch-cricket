import { useState, useMemo } from 'react';
import { Tournament, Match, Squad } from '@/types';
import {
    CheckCircle2,
    AlertCircle,
    ShieldCheck,
    Trophy,
    Lock,
    RefreshCcw,
    Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import { computeGroupStandings, TournamentConfig, MatchResult } from '@/engine/tournament';

interface QualificationCenterProps {
    tournament: Tournament;
    matches: Match[];
    squads: Squad[];
    inningsMap: Map<string, { teamA: any, teamB: any }>;
    onUpdate: (data: Partial<Tournament>) => Promise<void>;
}

interface GroupStanding {
    id: string;
    name: string;
    targetCount: number;
    confirmed: string[];
    pool: {
        squad: Squad;
        points: number;
        nrr: number;
        rank: number;
        played: number;
    }[];
}

export default function QualificationCenter({ tournament, squads, matches, inningsMap, onUpdate }: QualificationCenterProps) {
    const [confirming, setConfirming] = useState<string | null>(null);

    const groupStandings = useMemo<GroupStanding[]>(() => {
        const config = (tournament as any).config as TournamentConfig;
        if (!config || config.version !== 1) return [];

        const results: MatchResult[] = [];
        const groupIdByTeam = new Map<string, string>();
        config.groups.forEach((g) => (g.squadIds || []).forEach((sid) => groupIdByTeam.set(sid, g.id)));

        matches.forEach((m: any) => {
            const inn = inningsMap.get(m.id);
            if (!inn?.teamA || !inn?.teamB) return;

            const aId = m.teamAId || m.teamASquadId || m.teamA;
            const bId = m.teamBId || m.teamBSquadId || m.teamB;
            if (!aId || !bId) return;

            const aRuns = Number(inn.teamA.totalRuns || 0);
            const bRuns = Number(inn.teamB.totalRuns || 0);
            const aBalls = Number(inn.teamA.legalBalls || 0);
            const bBalls = Number(inn.teamB.legalBalls || 0);

            results.push({
                matchId: m.id,
                tournamentId: tournament.id,
                teamA: aId,
                teamB: bId,
                groupA: groupIdByTeam.get(aId) || '',
                groupB: groupIdByTeam.get(bId) || '',
                result: aRuns > bRuns ? 'win' : aRuns < bRuns ? 'loss' : 'tie',
                teamARunsFor: aRuns,
                teamABallsFaced: aBalls,
                teamARunsAgainst: bRuns,
                teamABallsBowled: bBalls,
            });
        });

        const standings = computeGroupStandings(config, results);

        return config.groups.map((g: any) => {
            const groupStat = standings.find(s => s.groupId === g.id);
            const confirmed = tournament.confirmedQualifiers?.[g.id] || [];

            const pool = (g.squadIds || []).map((sid: string) => {
                const squad = squads.find(s => s.id === sid);
                const row = groupStat?.rows.find(r => r.squadId === sid);
                return {
                    squad: squad!,
                    points: row?.points || 0,
                    nrr: row?.nrr || 0,
                    rank: 0, // Assigned later
                    played: row?.played || 0
                };
            }).sort((a, b) => (b.points - a.points) || (b.nrr - a.nrr));

            // Assign ranks
            pool.forEach((item, idx) => item.rank = idx + 1);

            return {
                id: g.id,
                name: g.name,
                targetCount: g.qualification?.qualifyCount || (tournament as any).qualificationPerGroup || 0,
                confirmed,
                pool
            };
        });
    }, [tournament, squads, matches, inningsMap]);

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

    const autoSync = (group: GroupStanding) => {
        const topTeams = group.pool.slice(0, group.targetCount).map(p => p.squad.id);
        confirmQualifiers(group.id, topTeams);
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-medium text-slate-900 tracking-tight">Qualify Center</h2>
                    <p className="text-sm text-slate-400 mt-1">Confirm teams advancing to the knockout stage based on points table.</p>
                </div>
                <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center gap-3">
                    <Zap size={16} className="text-indigo-600 animate-pulse" />
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Auto-Ranking Enabled</span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
                {groupStandings.map((g) => {
                    const isFullyConfirmed = g.confirmed.length >= g.targetCount && g.targetCount > 0;

                    return (
                        <div key={g.id} className={`bg-white rounded-[2.5rem] border p-8 transition-all duration-500 ${isFullyConfirmed ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-100 shadow-sm'
                            }`}>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                                <div className="flex items-center gap-6">
                                    <div className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center shadow-sm border transition-all duration-300 ${isFullyConfirmed ? 'bg-emerald-500 text-white border-emerald-400 rotate-6' : 'bg-slate-50 text-slate-400 border-slate-100'
                                        }`}>
                                        {isFullyConfirmed ? <Trophy size={28} /> : <ShieldCheck size={28} />}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">{g.name}</h3>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Requires {g.targetCount} Qualifiers</span>
                                            {isFullyConfirmed && (
                                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                            )}
                                            {isFullyConfirmed && (
                                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Decision Locked</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => autoSync(g)}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
                                    >
                                        <RefreshCcw size={14} className={confirming === g.id ? 'animate-spin' : ''} />
                                        Sync with Standings
                                    </button>
                                    {isFullyConfirmed ? (
                                        <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-200">
                                            <CheckCircle2 size={14} />
                                            Confirmed
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-100 text-amber-700 rounded-2xl text-xs font-black uppercase tracking-widest border border-amber-200">
                                            <AlertCircle size={14} />
                                            Pending
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {g.pool.map(({ squad, points, nrr, rank, played }) => {
                                    const isConfirmed = g.confirmed.includes(squad.id);
                                    const inQualifyingZone = rank <= g.targetCount;

                                    return (
                                        <button
                                            key={squad.id}
                                            onClick={() => {
                                                const current = g.confirmed.includes(squad.id);
                                                if (!current && g.targetCount > 0 && g.confirmed.length >= g.targetCount) {
                                                    toast.error(`Limit reached! Only ${g.targetCount} teams allowed.`);
                                                    return;
                                                }
                                                const next = current
                                                    ? g.confirmed.filter((id) => id !== squad.id)
                                                    : [...g.confirmed, squad.id];
                                                confirmQualifiers(g.id, next);
                                            }}
                                            className={`group relative p-5 rounded-[2rem] border transition-all duration-300 text-left overflow-hidden ${isConfirmed
                                                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-xl shadow-indigo-100'
                                                    : inQualifyingZone
                                                        ? 'bg-white border-indigo-100 shadow-sm border-dashed'
                                                        : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black border ${isConfirmed ? 'bg-white/20 border-white/20 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'
                                                    }`}>
                                                    #{rank}
                                                </div>
                                                {inQualifyingZone && !isConfirmed && (
                                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[8px] font-black uppercase tracking-tighter animate-bounce">
                                                        Auto-Selected
                                                    </div>
                                                )}
                                            </div>

                                            <div className="font-bold text-sm truncate mb-1 pr-6">{squad.name}</div>
                                            <div className={`text-[10px] font-bold uppercase tracking-widest ${isConfirmed ? 'text-white/60' : 'text-slate-400'}`}>
                                                {played} Played • {points} Pts
                                            </div>

                                            <div className={`mt-3 pt-3 border-t text-[9px] font-black uppercase tracking-[0.1em] flex justify-between ${isConfirmed ? 'border-white/10 text-white/40' : 'border-slate-50 text-slate-300'
                                                }`}>
                                                <span>NRR: {nrr.toFixed(3)}</span>
                                                {isConfirmed && <CheckCircle2 size={12} className="text-white" />}
                                            </div>

                                            {/* Selection Overlay */}
                                            {isConfirmed && (
                                                <div className="absolute top-0 right-0 p-3">
                                                    <div className="bg-white text-indigo-600 rounded-full p-1 shadow-md">
                                                        <ShieldCheck size={12} />
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {!isFullyConfirmed && g.targetCount > 0 && (
                                <div className="mt-8 p-6 bg-slate-50/50 rounded-[2rem] border border-slate-100/50 flex items-start gap-4 text-[11px] text-slate-500 leading-relaxed italic">
                                    <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                                    <p>
                                        The ranking is automatically updated from recent match results.
                                        Click <strong>Sync with Standings</strong> to automatically confirm the top teams,
                                        or manually click individual teams to override the selection.
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
