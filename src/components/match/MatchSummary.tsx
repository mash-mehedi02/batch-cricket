import React, { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PlayerLink from '../PlayerLink'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import { Match, InningsStats, Tournament } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { matchService } from '@/services/firestore/matches'
import { tournamentService } from '@/services/firestore/tournaments'
import { getMatchResultString } from '@/utils/matchWinner'
import { Zap, Trophy, Edit3, Calendar, Users, MapPin, ChevronRight, Bell, Settings, BarChart2, Table, Newspaper } from 'lucide-react'

interface MatchSummaryProps {
    match: Match
    teamAInnings: InningsStats | null
    teamBInnings: InningsStats | null
    playersMap: Map<string, any>
    teamAName: string
    teamBName: string
    teamALogo?: string
    teamBLogo?: string
}

const MatchSummary: React.FC<MatchSummaryProps> = ({
    match,
    teamAInnings,
    teamBInnings,
    playersMap,
    teamAName,
    teamBName,
    teamALogo,
    teamBLogo,
}) => {
    const { user } = useAuthStore()
    const [isEditingPom, setIsEditingPom] = useState(false)
    const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([])
    const [tournament, setTournament] = useState<Tournament | null>(null)

    useEffect(() => {
        if (match.tournamentId) {
            matchService.getByTournament(match.tournamentId).then(matches => {
                const upcoming = matches
                    .filter(m => m.status === 'upcoming' && m.id !== match.id)
                    .slice(0, 3)
                setUpcomingMatches(upcoming)
            })
            tournamentService.getById(match.tournamentId).then(setTournament)
        }
    }, [match.tournamentId, match.id])

    // --- Helpers ---
    const getPlayer = (id: string) => playersMap.get(id) || { name: 'Unknown', photoUrl: null }

    const getTeamLogo = (teamSide: 'A' | 'B') => {
        if (teamSide === 'A') return teamALogo || (match as any).teamALogoUrl
        return teamBLogo || (match as any).teamBLogoUrl
    }

    // --- Abbreviation Helper ---
    const getAbbr = (name: string) => {
        if (!name) return '';
        const nameStr = name.trim();
        const bits = nameStr.split(/\s+-\s+|-\s+|\s+-|\s+/).filter(Boolean);
        if (bits.length === 0) return '';
        const lastBit = bits[bits.length - 1];
        const hasInteger = /^\d+$/.test(lastBit);
        let teamPartWords = hasInteger ? bits.slice(0, bits.length - 1) : bits;
        if (teamPartWords.length === 0 && hasInteger) teamPartWords = [lastBit];
        let abbr = '';
        if (teamPartWords.length > 1) {
            abbr = teamPartWords.map(w => w[0]).join('').toUpperCase();
        } else if (teamPartWords.length === 1) {
            const word = teamPartWords[0];
            abbr = word.length > 3 ? word.substring(0, 3).toUpperCase() : word.toUpperCase();
        }
        return hasInteger ? `${abbr}-${lastBit}` : abbr;
    }

    // --- Result Logic ---
    const resultText = useMemo(() => {
        if ((match as any).resultSummary) return (match as any).resultSummary
        return getMatchResultString(teamAName, teamBName, teamAInnings, teamBInnings, match)
    }, [match, teamAInnings, teamBInnings, teamAName, teamBName])

    const winnerSide = useMemo(() => {
        const winnerId = (match as any).winnerId;
        if (!winnerId) return null;
        if (winnerId === match.teamAId || winnerId === (match as any).teamASquadId || winnerId === (match as any).teamA) return 'A';
        return 'B';
    }, [match])

    // --- Auto Player of the Match Calculation ---
    const calculatedPomId = useMemo(() => {
        if ((match as any).playerOfMatchId) return (match as any).playerOfMatchId
        let bestId = '';
        let maxPoints = -1;
        const playerPoints = new Map<string, number>();
        const addPoints = (id: string, pts: number) => {
            if (!id) return;
            const c = playerPoints.get(id) || 0;
            playerPoints.set(id, c + pts);
        }
        teamAInnings?.batsmanStats?.forEach(b => addPoints(b.batsmanId, (b.runs || 0) + (b.runs > 49 ? 20 : 0)));
        teamAInnings?.bowlerStats?.forEach(b => addPoints(b.bowlerId, (b.wickets * 20) + (b.wickets > 2 ? 10 : 0)));
        teamBInnings?.batsmanStats?.forEach(b => addPoints(b.batsmanId, (b.runs || 0) + (b.runs > 49 ? 20 : 0)));
        teamBInnings?.bowlerStats?.forEach(b => addPoints(b.bowlerId, (b.wickets * 20) + (b.wickets > 2 ? 10 : 0)));
        playerPoints.forEach((pts, id) => {
            if (pts > maxPoints) { maxPoints = pts; bestId = id; }
        });
        return bestId;
    }, [match, teamAInnings, teamBInnings])

    const savePom = async (id: string) => {
        await matchService.update(match.id, { playerOfMatchId: id } as any)
        setIsEditingPom(false)
    }

    const pomPlayer = getPlayer(calculatedPomId)
    const pomStats = useMemo(() => {
        if (!calculatedPomId) return null
        const batA = teamAInnings?.batsmanStats?.find(b => b.batsmanId === calculatedPomId)
        const bowlA = teamAInnings?.bowlerStats?.find(b => b.bowlerId === calculatedPomId)
        const batB = teamBInnings?.batsmanStats?.find(b => b.batsmanId === calculatedPomId)
        const bowlB = teamBInnings?.bowlerStats?.find(b => b.bowlerId === calculatedPomId)
        const bat = batA || batB
        const bowl = bowlA || bowlB
        return { bat, bowl }
    }, [calculatedPomId, teamAInnings, teamBInnings])

    // --- Batting Order for Layout ---
    const firstBatSide = useMemo(() => {
        if (!match.tossWinner || !match.electedTo) return 'A'
        const tossSide = (match as any).tossWinner === 'teamA' ? 'A' : 'B'
        const decision = String((match as any).tossDecision || match.electedTo || '').toLowerCase()
        if (decision.includes('bat')) return tossSide
        return tossSide === 'A' ? 'B' : 'A'
    }, [match])

    const leftInns = firstBatSide === 'A' ? teamAInnings : teamBInnings
    const rightInns = firstBatSide === 'A' ? teamBInnings : teamAInnings
    const leftName = firstBatSide === 'A' ? teamAName : teamBName
    const rightName = firstBatSide === 'A' ? teamBName : teamAName

    const renderPerformersList = (innings: InningsStats | null, teamName: string, label: string) => {
        if (!innings) return null
        const bats = (innings.batsmanStats || []).sort((a, b) => b.runs - a.runs).slice(0, 2)
        const bowls = (innings.bowlerStats || []).sort((a, b) => b.wickets - a.wickets || a.economy - b.economy).filter(b => Number(b.overs) > 0).slice(0, 1)

        return (
            <div className="mb-6">
                <div className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 flex items-center gap-2">
                    <span className="w-1 h-3 bg-blue-500 rounded-full"></span>
                    {getAbbr(teamName)} - {label}
                </div>
                <div className="bg-white">
                    {[...bats.map(b => ({ ...b, type: 'bat' })), ...bowls.map(b => ({ ...b, type: 'bowl' }))].map((p: any, idx) => {
                        const pid = p.type === 'bat' ? p.batsmanId : p.bowlerId
                        const player = getPlayer(pid)
                        return (
                            <div key={idx} className="flex items-center justify-between p-4 px-5 border-b border-slate-100 last:border-0 group hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3.5">
                                    <div className="relative">
                                        <PlayerAvatar
                                            photoUrl={player.photoUrl || (player as any).photo}
                                            name={player.name}
                                            size="sm"
                                            className="w-12 h-12 border-2 border-slate-100 shadow-sm transition-transform group-hover:scale-105"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <PlayerLink playerId={pid} playerName={player.name} className="text-[15px] font-black text-slate-900 truncate block leading-tight mb-0.5" />
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            {p.type === 'bat' ? `SR: ${Number(p.strikeRate || 0).toFixed(2)}` : `ER: ${Number(p.economy || 0).toFixed(2)}`}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right whitespace-nowrap">
                                    <div className="text-[16px] font-black text-slate-900 tabular-nums">
                                        {p.type === 'bat' ? `${p.runs} (${p.balls})` : `${p.wickets}-${p.runsConceded}`}
                                    </div>
                                    {p.isNotOut && <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-0.5">Not Out</div>}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            {/* Header */}
            <div className="bg-[#0f172a] text-white pt-12 pb-6 px-6 md:px-12 border-b border-white/5">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between gap-6">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="relative shrink-0">
                                <img src={getTeamLogo(firstBatSide)} className="w-12 h-12 md:w-14 md:h-14 rounded-2xl object-cover bg-slate-800 border-2 border-white/5 p-1 shadow-2xl" alt="" />
                                {winnerSide === firstBatSide && <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border-2 border-[#0f172a]"><Trophy className="w-2.5 h-2.5 text-white" /></div>}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] md:text-xs font-black uppercase text-slate-500 tracking-widest mb-1">{getAbbr(leftName)}</div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl md:text-3xl font-black tracking-tighter text-slate-100">{leftInns?.totalRuns || '0'}-{leftInns?.totalWickets || '0'}</span>
                                    <span className="text-[11px] md:text-sm text-slate-600 font-black tabular-nums">({leftInns?.overs || '0.0'})</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center opacity-10">
                            <Zap className="w-8 h-8 text-slate-400 fill-slate-400" />
                        </div>

                        <div className="flex items-center gap-4 flex-1 justify-end text-right min-w-0">
                            <div className="min-w-0">
                                <div className="text-[10px] md:text-xs font-black uppercase text-slate-500 tracking-widest mb-1">{getAbbr(rightName)}</div>
                                <div className="flex items-baseline justify-end gap-2">
                                    <span className="text-[11px] md:text-sm text-slate-600 font-black tabular-nums">({rightInns?.overs || '0.0'})</span>
                                    <span className="text-2xl md:text-3xl font-black tracking-tighter text-slate-100">{rightInns?.totalRuns || '0'}-{rightInns?.totalWickets || '0'}</span>
                                </div>
                            </div>
                            <div className="relative shrink-0">
                                <img src={getTeamLogo(firstBatSide === 'A' ? 'B' : 'A')} className="w-12 h-12 md:w-14 md:h-14 rounded-2xl object-cover bg-slate-800 border-2 border-white/5 p-1 shadow-2xl" alt="" />
                                {winnerSide === (firstBatSide === 'A' ? 'B' : 'A') && <div className="absolute -top-1 -left-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border-2 border-[#0f172a]"><Trophy className="w-2.5 h-2.5 text-white" /></div>}
                            </div>
                        </div>
                    </div>

                    <div className="mt-10 text-center animate-in fade-in slide-in-from-top-2 duration-500">
                        <div className="px-6 py-2 bg-white/5 rounded-full inline-block border border-white/5 backdrop-blur-sm">
                            <span className="text-xs md:text-sm font-black text-amber-500 tracking-[0.2em] uppercase">
                                {resultText}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 md:px-0 py-8 space-y-8">
                {/* POM */}
                {pomPlayer && (
                    <div className="relative group animate-in zoom-in-95 duration-500">
                        <div className="bg-[#fff1f2] border border-rose-100 rounded-[2.5rem] p-5 md:p-8 flex items-center justify-between gap-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-200/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>

                            <div className="flex items-center gap-5 relative z-10">
                                <div className="relative">
                                    <PlayerAvatar
                                        photoUrl={pomPlayer.photoUrl || (pomPlayer as any).photo}
                                        name={pomPlayer.name}
                                        size="xl"
                                        className="w-20 h-20 md:w-28 md:h-28 border-4 border-white shadow-xl bg-white"
                                    />
                                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-rose-50">
                                        <Trophy className="w-5 h-5 text-amber-500 fill-amber-500" />
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <Link to={`/players/${calculatedPomId}`} className="text-xl md:text-3xl font-black text-slate-900 truncate block hover:text-rose-600 transition-colors leading-tight mb-2">
                                        {pomPlayer.name}
                                    </Link>
                                    <span className="text-[10px] md:text-xs font-black text-rose-500/60 uppercase tracking-[0.25em] mb-1">PLAYER OF THE MATCH</span>
                                </div>
                            </div>

                            <div className="text-right flex flex-col items-end gap-1 relative z-10">
                                <div className="text-[20px] md:text-[28px] font-black text-slate-800 tabular-nums tracking-tighter leading-none whitespace-nowrap">
                                    {pomStats?.bat && (pomStats.bat.runs > 0 || pomStats.bat.balls > 0) && (
                                        <span>{pomStats.bat.runs} ({pomStats.bat.balls})</span>
                                    )}
                                </div>
                                <div className="text-[14px] md:text-[18px] font-bold text-slate-400 tabular-nums tracking-tight">
                                    {pomStats?.bowl && (pomStats.bowl.wickets > 0 || parseFloat(String(pomStats.bowl.overs || 0)) > 0) && (
                                        <span>{pomStats.bowl.wickets}-{pomStats.bowl.runsConceded} ({pomStats.bowl.overs})</span>
                                    )}
                                </div>
                            </div>

                            {(user as any)?.isAdmin && (
                                <button onClick={() => setIsEditingPom(true)} className="absolute top-6 right-6 p-2 text-rose-200 hover:text-rose-500 bg-white/50 rounded-full transition-colors backdrop-blur-sm">
                                    <Edit3 size={16} />
                                </button>
                            )}

                            {isEditingPom && (
                                <div className="absolute inset-0 bg-white/98 z-30 flex items-center justify-center p-4 rounded-[2.5rem] animate-in fade-in duration-300">
                                    <select
                                        className="grow max-w-sm bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 text-sm font-black text-slate-800 shadow-inner"
                                        onChange={(e) => savePom(e.target.value)}
                                        value={calculatedPomId || ''}
                                    >
                                        <option value="">Auto Select Performer</option>
                                        {[...(teamAInnings?.batsmanStats || []), ...(teamAInnings?.bowlerStats || []),
                                        ...(teamBInnings?.batsmanStats || []), ...(teamBInnings?.bowlerStats || [])]
                                            .filter((v, i, a) => a.findIndex(t => ((t as any).batsmanId || (t as any).bowlerId) === ((v as any).batsmanId || (v as any).bowlerId)) === i)
                                            .map(p => {
                                                const id = (p as any).batsmanId || (p as any).bowlerId
                                                const pl = getPlayer(id)
                                                return <option key={id} value={id}>{pl.name}</option>
                                            })}
                                    </select>
                                    <button onClick={() => setIsEditingPom(false)} className="ml-4 px-5 py-2 text-sm font-black text-slate-400 hover:text-rose-500 uppercase tracking-widest">Cancel</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Top Performers */}
                <div className="space-y-4 pt-4">
                    <div className="flex items-center gap-3 px-2">
                        <div className="h-6 w-1.5 bg-slate-900 rounded-full"></div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Top Performers</h3>
                    </div>
                    <div className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
                        {renderPerformersList(leftInns, leftName, '1st Inns')}
                        {renderPerformersList(rightInns, rightName, '2nd Inns')}
                    </div>
                </div>

                {/* Next Matches */}
                {upcomingMatches.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-base font-black text-slate-800">Next Matches</h3>
                            <Link to={`/tournaments/${match.tournamentId}`} className="text-xs font-bold text-blue-600 flex items-center gap-1">
                                View All <ChevronRight size={14} />
                            </Link>
                        </div>
                        <div className="space-y-4">
                            {upcomingMatches.map(m => (
                                <Link key={m.id} to={`/matches/${m.id}`} className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm block hover:border-blue-100 transition-colors relative">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{m.venue || 'TBA'}</div>
                                        <Bell size={14} className="text-slate-300" />
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-3 flex-1">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0">
                                                    <span className="text-[10px] font-black">{getAbbr(m.teamAName)}</span>
                                                </div>
                                                <span className="text-sm font-bold text-slate-700">{m.teamAName}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 p-1 flex items-center justify-center shrink-0">
                                                    <span className="text-[10px] font-black">{getAbbr(m.teamBName)}</span>
                                                </div>
                                                <span className="text-sm font-bold text-slate-700">{m.teamBName}</span>
                                            </div>
                                        </div>
                                        <div className="pl-4 border-l border-slate-100 text-right min-w-[80px]">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Upcoming</div>
                                            <div className="text-base font-black text-slate-900">{String(m.time || 'TBA')}</div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tournament Navigation */}
                <div className="py-4 text-center">
                    <Link to={`/tournaments/${match.tournamentId}`} className="text-sm font-black text-blue-600 hover:text-blue-700 tracking-wide uppercase">
                        {tournament?.name || 'Tournament'} All Matches
                    </Link>
                </div>

                <div className="space-y-4">
                    <h3 className="text-base font-black text-slate-800 px-2">Teams & Venue</h3>
                    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm divide-y divide-slate-50">
                        <Link to={`/squads/${match.teamAId}`} className="flex items-center justify-between p-4 px-6 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <Users size={18} className="text-rose-500" />
                                <span className="text-sm font-bold text-slate-700">{teamAName}</span>
                            </div>
                            <ChevronRight size={16} className="text-slate-300" />
                        </Link>
                        <Link to={`/squads/${match.teamBId}`} className="flex items-center justify-between p-4 px-6 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-4">
                                <Users size={18} className="text-rose-500" />
                                <span className="text-sm font-bold text-slate-700">{teamBName}</span>
                            </div>
                            <ChevronRight size={16} className="text-slate-300" />
                        </Link>
                        <div className="flex items-center gap-4 p-4 px-6">
                            <MapPin size={18} className="text-slate-400" />
                            <span className="text-sm font-bold text-slate-700">{match.venue || 'Venue TBA'}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-base font-black text-slate-800 px-2">{tournament?.name || 'Tournament'}</h3>
                    <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm divide-y divide-slate-50">
                        <Link to={`/tournaments/${match.tournamentId}/matches`} className="flex items-center gap-4 p-4 px-6 hover:bg-slate-50 transition-colors group">
                            <Calendar size={18} className="text-blue-500" />
                            <span className="text-sm font-bold text-slate-700">Matches</span>
                        </Link>
                        <Link to={`/tournaments/${match.tournamentId}/stats`} className="flex items-center gap-4 p-4 px-6 hover:bg-slate-50 transition-colors group">
                            <BarChart2 size={18} className="text-emerald-500" />
                            <span className="text-sm font-bold text-slate-700">Player Stats (Most runs, wkts, 6s, 4s)</span>
                        </Link>
                        <Link to={`/tournaments/${match.tournamentId}/points`} className="flex items-center gap-4 p-4 px-6 hover:bg-slate-50 transition-colors group">
                            <Table size={18} className="text-amber-500" />
                            <span className="text-sm font-bold text-slate-700">Points Table</span>
                        </Link>
                        <Link to={`/tournaments/${match.tournamentId}/news`} className="flex items-center gap-4 p-4 px-6 hover:bg-slate-50 transition-colors group">
                            <Newspaper size={18} className="text-indigo-500" />
                            <span className="text-sm font-bold text-slate-700">News</span>
                        </Link>
                    </div>
                </div>

                <div className="py-6 px-2">
                    <Link to="/settings" className="flex items-center gap-3 text-slate-400 hover:text-slate-600 transition-colors">
                        <Settings size={18} />
                        <span className="text-sm font-bold">Match Settings</span>
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default MatchSummary
