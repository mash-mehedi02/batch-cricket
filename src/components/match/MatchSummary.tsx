import React, { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PlayerLink from '../PlayerLink'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import { Match, InningsStats, Tournament } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { matchService } from '@/services/firestore/matches'
import { tournamentService } from '@/services/firestore/tournaments'
import { getMatchResultString } from '@/utils/matchWinner'
import { Zap, Trophy, Edit3, Calendar, Users, MapPin, ChevronRight, Bell, Settings, BarChart2, Table } from 'lucide-react'

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
            <div className="py-0">
                <div className="px-6 py-2 flex items-center justify-between bg-[#F8FAFC] border-b border-slate-100">
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{getAbbr(teamName)} — {label}</span>
                </div>
                <div className="divide-y divide-slate-50">
                    {[...bats.map(b => ({ ...b, type: 'bat' })), ...bowls.map(b => ({ ...b, type: 'bowl' }))].map((p: any, idx) => {
                        const pid = p.type === 'bat' ? p.batsmanId : p.bowlerId
                        const player = getPlayer(pid)
                        return (
                            <div key={idx} className="flex items-center justify-between p-4 px-6 group">
                                <div className="flex items-center gap-5">
                                    <div className="relative shrink-0">
                                        <PlayerAvatar
                                            photoUrl={player.photoUrl || (player as any).photo}
                                            name={player.name}
                                            size="sm"
                                            className="w-12 h-12 border-2 border-white shadow-sm bg-slate-50"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <PlayerLink playerId={pid} playerName={player.name} className="text-[17px] font-black text-slate-900 truncate block leading-tight mb-0.5" />
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px] font-bold text-slate-400">
                                                {p.type === 'bat' ? `SR: ${Number(p.strikeRate || 0).toFixed(1)}` : `ER: ${Number(p.economy || 0).toFixed(1)}`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black text-slate-900 tabular-nums tracking-tighter">
                                        {p.type === 'bat' ? (
                                            <>
                                                {p.runs} <span className="text-slate-400 text-lg font-bold">({p.balls})</span>
                                            </>
                                        ) : (
                                            <>
                                                {p.wickets}-{p.runsConceded} <span className="text-slate-400 text-sm font-bold">({p.overs})</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F1F3F4] pb-20 font-sans">
            {/* Header - Screenshot Based Design */}
            <div className="bg-[#1C252E] text-white pt-4 pb-4 px-4">
                <div className="max-w-4xl mx-auto">
                    {/* Top Title & Match Type */}
                    <div className="text-center mb-4">
                        <h2 className="text-[14px] font-bold text-white uppercase tracking-tight truncate px-8">
                            {match.teamAName} VS {match.teamBName}
                        </h2>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">
                            MATCH • {tournament?.name || 'FRIENDLY MATCH'}
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 max-w-sm mx-auto">
                        {/* Team A */}
                        <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                                <img
                                    src={getTeamLogo(firstBatSide)}
                                    className="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-white/10"
                                    alt=""
                                />
                                {winnerSide === firstBatSide && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center border border-[#1C252E]">
                                        <Trophy className="w-2.5 h-2.5 text-white" />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate">{getAbbr(leftName)}</div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-xl font-black text-white leading-none tabular-nums">
                                        {leftInns?.totalRuns || '0'}-{leftInns?.totalWickets || '0'}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-black">({leftInns?.overs || '0.0'})</span>
                                </div>
                            </div>
                        </div>

                        {/* Mid Divider */}
                        <div className="px-3 opacity-20 shrink-0">
                            <Zap className="w-6 h-6 text-blue-400 fill-blue-400" />
                        </div>

                        {/* Team B */}
                        <div className="flex items-center gap-3 text-right">
                            <div className="min-w-0">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate">
                                    {getAbbr(rightName)}
                                </div>
                                <div className="flex items-baseline justify-end gap-1">
                                    {rightInns && (
                                        <span className="text-[10px] text-slate-500 font-black">({rightInns?.overs || '0.0'})</span>
                                    )}
                                    <span className="text-xl font-black text-white leading-none tabular-nums">
                                        {rightInns?.totalRuns || '0'}-{rightInns?.totalWickets || '0'}
                                    </span>
                                    {winnerSide === (firstBatSide === 'A' ? 'B' : 'A') && <Trophy className="w-3 h-3 text-amber-500 inline-block ml-0.5 mb-0.5" />}
                                </div>
                            </div>
                            <div className="relative shrink-0">
                                <img
                                    src={getTeamLogo(firstBatSide === 'A' ? 'B' : 'A')}
                                    className="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-white/10"
                                    alt=""
                                />
                            </div>
                        </div>
                    </div>

                    {/* Result Line */}
                    <div className="mt-4 text-center text-[12px] font-black text-amber-500 uppercase tracking-[0.15em]">
                        {resultText}
                    </div>
                </div>
            </div>

            {/* Over Highlights/Balls Timeline */}
            {/* Over Highlights/Balls Timeline - Live Tab Style */}
            <div className="bg-white border-b border-slate-200 py-2.5 px-4 overflow-x-auto scrollbar-hide">
                <div className="max-w-4xl mx-auto flex items-center min-w-max">
                    <div className="flex items-center gap-4">
                        {(() => {
                            const timelineInns = (rightInns?.recentOvers?.length || 0) > 0 ? rightInns : (leftInns || rightInns);
                            if (!timelineInns) return null;

                            const overs = timelineInns.recentOvers || [];
                            return (
                                <div className="flex items-center gap-4">
                                    {overs.map((over: any, idx: number) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            {idx > 0 && <div className="h-4 w-px bg-slate-200 mx-1"></div>}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-slate-400 tracking-tighter uppercase">OVER {over.overNumber}</span>
                                                <div className="flex items-center gap-1">
                                                    {(over.balls || []).map((ball: any, bi: number) => (
                                                        <div key={bi} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border ${String(ball.value).includes('W') ? 'bg-red-500 text-white border-red-500' :
                                                            ball.value === '6' ? 'bg-emerald-600 text-white border-emerald-600' :
                                                                ball.value === '4' ? 'bg-blue-600 text-white border-blue-600' :
                                                                    'bg-white text-slate-700 border-slate-200'
                                                            }`}>
                                                            {ball.value === '·' ? '0' : ball.value}
                                                        </div>
                                                    ))}
                                                    <div className="text-[10px] font-black text-slate-400 ml-1">= {over.totalRuns || 0}</div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Handle current partial over if exist */}
                                    {timelineInns.currentOverBalls && timelineInns.currentOverBalls.length > 0 && (
                                        <div className="flex items-center gap-3">
                                            <div className="h-4 w-px bg-slate-200 mx-1"></div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-slate-400 tracking-tighter uppercase">OV {Math.floor(parseFloat(timelineInns.overs || '0')) + 1}</span>
                                                <div className="flex items-center gap-1">
                                                    {timelineInns.currentOverBalls.map((ball: any, bi: number) => (
                                                        <div key={bi} className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border ${String(ball.value).includes('W') ? 'bg-red-500 text-white border-red-500' :
                                                            ball.value === '6' ? 'bg-emerald-600 text-white border-emerald-600' :
                                                                ball.value === '4' ? 'bg-blue-600 text-white border-blue-600' :
                                                                    'bg-white text-slate-700 border-slate-200'
                                                            }`}>
                                                            {ball.value === '·' ? '0' : ball.value}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
                {/* POM - Screenshot Style High Fidelity */}
                {pomPlayer && (
                    <div className="relative animate-in zoom-in-95 duration-500">
                        <div className="bg-white rounded-[1.5rem] p-4 flex items-center justify-between shadow-sm border border-slate-100/50 relative overflow-hidden h-[100px]">
                            <div className="flex items-center gap-5 relative z-10 min-w-0">
                                <PlayerAvatar
                                    photoUrl={pomPlayer.photoUrl || (pomPlayer as any).photo}
                                    name={pomPlayer.name}
                                    size="xl"
                                    className="w-16 h-16 md:w-20 md:h-20 border-4 border-slate-50 shadow-sm bg-white"
                                />
                                <div className="min-w-0">
                                    <Link to={`/players/${calculatedPomId}`} className="text-xl md:text-2xl font-black text-slate-900 truncate block leading-tight hover:text-blue-600 transition-colors">
                                        {pomPlayer.name}
                                    </Link>
                                    <div className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-[0.15em]">Player of the Match</div>
                                </div>
                            </div>

                            <div className="text-right flex flex-col items-end gap-1 relative z-10 shrink-0 ml-4">
                                <div className="text-xl md:text-2xl font-black text-slate-800 tabular-nums tracking-tighter">
                                    {pomStats?.bat && (pomStats.bat.runs > 0 || pomStats.bat.balls > 0) && (
                                        <span>{pomStats.bat.runs} ({pomStats.bat.balls})</span>
                                    )}
                                </div>
                                <div className="text-[13px] md:text-[15px] font-bold text-slate-400 tabular-nums">
                                    {pomStats?.bowl && (pomStats.bowl.wickets > 0 || parseFloat(String(pomStats.bowl.overs || 0)) > 0) && (
                                        <span>{pomStats.bowl.wickets}-{pomStats.bowl.runsConceded} ({pomStats.bowl.overs})</span>
                                    )}
                                </div>
                            </div>

                            {(user as any)?.isAdmin && (
                                <button onClick={() => setIsEditingPom(true)} className="absolute top-4 right-4 p-2 text-slate-200 hover:text-blue-500 transition-colors">
                                    <Edit3 size={16} />
                                </button>
                            )}

                            {isEditingPom && (
                                <div className="absolute inset-0 bg-white/95 z-30 flex items-center justify-center p-6 rounded-[2rem] animate-in fade-in duration-300 backdrop-blur-sm">
                                    <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-2xl border border-slate-100">
                                        <h4 className="text-lg font-black text-slate-800 mb-4 uppercase tracking-tight">Select Performer</h4>
                                        <select
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-black text-slate-800 shadow-inner focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
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
                                        <div className="mt-6 flex justify-end">
                                            <button onClick={() => setIsEditingPom(false)} className="px-6 py-2 text-sm font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors">Cancel</button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Top Performers */}
                <div className="space-y-6 pt-2">
                    <div className="flex items-center gap-3 px-1">
                        <div className="h-6 w-1 bg-blue-600 rounded-full shadow-sm shadow-blue-500/50"></div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">Top Performers</h3>
                    </div>
                    <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
                        {renderPerformersList(leftInns, leftName, '1st Innings')}
                        <div className="h-px w-full bg-slate-50"></div>
                        {renderPerformersList(rightInns, rightName, '2nd Innings')}
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
                        <Link to={`/tournaments/${match.tournamentId}`} className="flex items-center gap-4 p-4 px-6 hover:bg-slate-50 transition-colors group">
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
                    </div>
                </div>

                <div className="py-6 px-2">
                    <button
                        onClick={() => (window as any).openMatchSettings && (window as any).openMatchSettings()}
                        className="flex items-center gap-3 text-slate-400 hover:text-slate-600 transition-colors w-full text-left"
                    >
                        <Settings size={18} />
                        <span className="text-sm font-bold">Match Settings</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default MatchSummary
