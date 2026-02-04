import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tournamentService } from '@/services/firestore/tournaments';
import { squadService } from '@/services/firestore/squads';
import { matchService } from '@/services/firestore/matches';
import { Tournament, Squad, Match } from '@/types';
import {
    LayoutDashboard,
    Settings2,
    Users,
    Calendar,
    Trophy,
    ShieldCheck,
    GitPullRequest,
    BarChart3,
    ArrowLeft,
    Share2,
    Settings
} from 'lucide-react';
import toast from 'react-hot-toast';

// Sub-components
import StructureBuilder from './StructureBuilder';
import GroupManager from './GroupManager';
import QualificationCenter from './QualificationCenter';
import BracketManager from './BracketManager';
import MatchManager from './MatchManager';
import ChampionCenter from './ChampionCenter';
import TournamentPointsTable from '@/pages/TournamentPointsTable';

export default function TournamentDashboard() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [squads, setSquads] = useState<Squad[]>([]);
    const [matches, setMatches] = useState<Match[]>([]);
    const [inningsMap, setInningsMap] = useState<Map<string, { teamA: any, teamB: any }>>(new Map());
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'structure' | 'groups' | 'matches' | 'qualification' | 'knockout' | 'champions' | 'standings' | 'settings'>('overview');

    useEffect(() => {
        if (id) loadTournamentData(id);
    }, [id]);

    const loadTournamentData = async (tournamentId: string) => {
        try {
            const [t, s, m] = await Promise.all([
                tournamentService.getById(tournamentId),
                squadService.getAll(),
                matchService.getByTournament(tournamentId)
            ]);

            if (t) setTournament(t as any);
            setSquads(s as any);
            setMatches(m as any);

            // Fetch innings for standings
            const im = new Map<string, { teamA: any, teamB: any }>();
            await Promise.all(m.map(async (match) => {
                const [a, b] = await Promise.all([
                    matchService.getInnings(match.id, 'teamA'),
                    matchService.getInnings(match.id, 'teamB')
                ]);
                im.set(match.id, { teamA: a, teamB: b });
            }));
            setInningsMap(im);
        } catch (e) {
            console.error(e);
            toast.error('Failed to load tournament data');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (data: Partial<Tournament>) => {
        if (!id || !tournament) return;
        try {
            await tournamentService.update(id, data);
            setTournament({ ...tournament, ...data } as any);
            toast.success('Configuration saved');
        } catch (e) {
            toast.error('Failed to save changes');
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (!tournament) return <div>Tournament not found.</div>;

    const isLocked = tournament.status !== 'upcoming';

    const tabs = [
        { id: 'overview', name: 'Dashboard', icon: LayoutDashboard },
        { id: 'structure', name: 'Stages', icon: Settings2 },
        { id: 'groups', name: 'Groups & Teams', icon: Users },
        { id: 'matches', name: 'Match Center', icon: Calendar },
        { id: 'qualification', name: 'Qualify Center', icon: ShieldCheck },
        { id: 'knockout', name: 'Knockouts', icon: GitPullRequest },
        { id: 'champions', name: 'Winners', icon: Trophy },
        { id: 'standings', name: 'Live Standings', icon: BarChart3 },
        { id: 'settings', name: 'Configuration', icon: Settings },
    ] as const;

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-20">
            {/* Premium Header */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-50 shadow-sm shadow-slate-200/20">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <button
                                onClick={() => navigate('/admin/tournaments')}
                                className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-slate-900">{tournament.name}</h1>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${tournament.status === 'ongoing' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {tournament.status}
                                    </span>
                                </div>
                                <p className="text-[10px] sm:text-xs text-slate-400 font-medium uppercase tracking-[0.2em]">BatchCrick BD • Tournament Control Engine</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
                                <Share2 size={16} />
                                <span>Share Results</span>
                            </button>
                            <button className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all">
                                <Trophy size={16} className="text-amber-400" />
                                <span>Complete Tournament</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto px-4 sm:px-8 mt-10 grid grid-cols-1 xl:grid-cols-[280px,1fr] gap-10">
                {/* Modern Sidebar Navigation */}
                <aside className="space-y-2 max-xl:flex max-xl:overflow-x-auto max-xl:pb-4 max-xl:gap-2 no-scrollbar">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`group flex items-center gap-4 px-5 py-4 w-full rounded-2xl transition-all duration-300 ${isActive
                                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 translate-x-1'
                                    : 'bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-100/50'
                                    }`}
                            >
                                <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-white/20' : 'bg-slate-50 group-hover:bg-white'}`}>
                                    <Icon size={18} />
                                </div>
                                <span className={`text-sm font-bold whitespace-nowrap ${isActive ? 'text-white' : 'text-slate-600'}`}>{tab.name}</span>
                                {isActive && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                            </button>
                        );
                    })}
                </aside>

                {/* Content Area */}
                <main className="min-w-0">
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <StatCard label="Total Teams" value={tournament.participantSquadIds?.length || 0} color="indigo" />
                            <StatCard label="Matches Played" value={matches.filter(m => m.status === 'finished').length} total={matches.length} color="emerald" />
                            <StatCard label="Current Stage" value={tournament.stages?.find(s => s.status === 'active')?.name || 'None'} color="amber" />
                            <StatCard label="Days Remaining" value="12" color="rose" />

                            <div className="lg:col-span-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm p-12 text-center">
                                <div className="max-w-md mx-auto space-y-4">
                                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-sm">
                                        <ShieldCheck size={40} />
                                    </div>
                                    <h2 className="text-2xl font-medium text-slate-900 tracking-tight">Active Administration Required</h2>
                                    <p className="text-slate-500 text-sm leading-relaxed">
                                        Use the sidebar to configure stages, assign teams, and manually confirm qualifiers.
                                        Match records won't advance automatically to ensure full referee control.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'structure' && (
                        <StructureBuilder tournament={tournament} onUpdate={handleUpdate} isLocked={isLocked} />
                    )}

                    {activeTab === 'groups' && (
                        <GroupManager tournament={tournament} squads={squads} onUpdate={handleUpdate} isLocked={isLocked} />
                    )}

                    {activeTab === 'matches' && (
                        <MatchManager tournament={tournament} matches={matches} squads={squads} />
                    )}

                    {activeTab === 'qualification' && (
                        <QualificationCenter tournament={tournament} matches={matches} squads={squads} inningsMap={inningsMap} onUpdate={handleUpdate} />
                    )}

                    {activeTab === 'knockout' && (
                        <BracketManager tournament={tournament} squads={squads} onUpdate={handleUpdate} />
                    )}

                    {activeTab === 'champions' && (
                        <ChampionCenter tournament={tournament} squads={squads} onUpdate={handleUpdate} />
                    )}

                    {activeTab === 'standings' && (
                        <TournamentPointsTable embedded tournamentId={id} matches={matches} inningsMap={inningsMap} />
                    )}

                    {activeTab === 'settings' && (
                        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-lg font-bold text-slate-900 mb-6">Tournament Metadata</h3>
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Logo URL</label>
                                        <input
                                            type="text"
                                            value={tournament.logoUrl || ''}
                                            onChange={(e) => handleUpdate({ logoUrl: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Cloudinary URL"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Banner URL</label>
                                        <input
                                            type="text"
                                            value={tournament.bannerUrl || ''}
                                            onChange={(e) => handleUpdate({ bannerUrl: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500"
                                            placeholder="Cloudinary URL"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Location / Venue</label>
                                    <input
                                        type="text"
                                        value={tournament.location || ''}
                                        onChange={(e) => handleUpdate({ location: e.target.value })}
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500"
                                        placeholder="e.g. Cricket Ground"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

function StatCard({ label, value, total, color }: { label: string; value: string | number; total?: number; color: string }) {
    const colorClasses: Record<string, string> = {
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        rose: 'bg-rose-50 text-rose-600 border-rose-100',
    };

    return (
        <div className={`p-8 rounded-[2rem] border shadow-sm ${colorClasses[color]}`}>
            <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-3">{label}</div>
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-medium tracking-tight">{value}</span>
                {total && <span className="text-lg opacity-40 font-bold">/ {total}</span>}
            </div>
        </div>
    );
}
