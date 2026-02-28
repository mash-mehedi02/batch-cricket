import React, { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PlayerLink from '../PlayerLink'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import { Match, InningsStats, Tournament } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { matchService } from '@/services/firestore/matches'
import { tournamentService } from '@/services/firestore/tournaments'
import { squadService } from '@/services/firestore/squads'
import { getMatchResultString } from '@/utils/matchWinner'
import { formatShortTeamName } from '@/utils/teamName'
import { formatDateLabel } from '@/utils/date'
import { formatKnockoutTitle } from '@/utils/matchFormatters'
import { Trophy, Edit3, Calendar, Users, MapPin, ChevronRight, Bell, Settings, BarChart2, Table } from 'lucide-react'
import vsIcon from '@/assets/vs.png'

interface MatchSummaryProps {
    match: Match
    teamAInnings: InningsStats | null
    teamBInnings: InningsStats | null
    playersMap: Map<string, any>
    teamAName: string
    teamBName: string
    teamALogo?: string
    teamBLogo?: string
    teamASuperInnings?: InningsStats | null
    teamBSuperInnings?: InningsStats | null
    onSwitchTab?: (tabId: string) => void
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
    teamASuperInnings,
    teamBSuperInnings,
    onSwitchTab,
}) => {
    const { user } = useAuthStore()
    const [isEditingPom, setIsEditingPom] = useState(false)
    const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([])
    const [tournament, setTournament] = useState<Tournament | null>(null)
    const [squadsMap, setSquadsMap] = useState<Map<string, any>>(new Map())

    useEffect(() => {
        if (match.tournamentId) {
            matchService.getByTournament(match.tournamentId).then(async matches => {
                const tA = match.teamAId;
                const tB = match.teamBId;

                const upcoming = matches
                    .filter(m =>
                        m.status === 'upcoming' &&
                        m.id !== match.id &&
                        (m.teamAId === tA || m.teamAId === tB || m.teamBId === tA || m.teamBId === tB)
                    )
                    .slice(0, 3)
                setUpcomingMatches(upcoming)

                // Fetch squad logos
                const squadIds = new Set<string>();
                upcoming.forEach(um => {
                    squadIds.add(um.teamAId);
                    squadIds.add(um.teamBId);
                });
                if (squadIds.size > 0) {
                    const loadedSquads = new Map();
                    await Promise.all(Array.from(squadIds).map(async sid => {
                        const sq = await squadService.getById(sid);
                        if (sq) loadedSquads.set(sid, sq);
                    }));
                    setSquadsMap(prev => {
                        const next = new Map(prev);
                        loadedSquads.forEach((v, k) => next.set(k, v));
                        return next;
                    });
                }
            })
            tournamentService.getById(match.tournamentId).then(setTournament)
        }
    }, [match.tournamentId, match.id, match.teamAId, match.teamBId])

    // --- Helpers ---
    const getPlayer = (id: string) => {
        const fromMap = playersMap.get(id);
        if (fromMap && fromMap.name && fromMap.name !== 'Unknown') return fromMap;

        // Try to find in innings stats
        const inA = teamAInnings?.batsmanStats?.find(b => b.batsmanId === id) || teamAInnings?.bowlerStats?.find(b => b.bowlerId === id);
        if (inA) return { name: (inA as any).batsmanName || (inA as any).bowlerName || 'Unknown', photoUrl: null };

        const inB = teamBInnings?.batsmanStats?.find(b => b.batsmanId === id) || teamBInnings?.bowlerStats?.find(b => b.bowlerId === id);
        if (inB) return { name: (inB as any).batsmanName || (inB as any).bowlerName || 'Unknown', photoUrl: null };

        return fromMap || { name: 'Unknown', photoUrl: null };
    }

    const getTeamLogo = (teamSide: 'A' | 'B') => {
        if (teamSide === 'A') return teamALogo || (match as any).teamALogoUrl
        return teamBLogo || (match as any).teamBLogoUrl
    }

    const getAbbr = (name: string) => formatShortTeamName(name)

    // --- Result Logic ---
    const resultText = useMemo(() => {
        const calc = getMatchResultString(
            teamAName,
            teamBName,
            teamAInnings,
            teamBInnings,
            match,
            teamASuperInnings,
            teamBSuperInnings
        )
        // Prefer calculated result if it contains "Won" or "Tie" (meaning we have data)
        if (calc && (calc.toLowerCase().includes(' won') || calc.includes('Tie'))) return calc

        return (match as any)?.resultSummary || ''
    }, [match, teamAInnings, teamBInnings, teamASuperInnings, teamBSuperInnings, teamAName, teamBName])

    const winnerSide = useMemo(() => {
        const winnerId = (match as any).winnerId;
        if (!winnerId) return null;
        if (winnerId === match.teamAId || winnerId === (match as any).teamASquadId || winnerId === (match as any).teamA) return 'A';
        return 'B';
    }, [match])

    // --- Player of the Match Calculation ---
    const calculatedPomId = useMemo(() => {
        if (match.playerOfTheMatch) return match.playerOfTheMatch;
        if ((match as any).playerOfMatchId) return (match as any).playerOfMatchId;

        let bestId = '';
        let maxPoints = -1;
        const playerPoints = new Map<string, number>();
        const addPoints = (id: string, pts: number) => {
            if (!id) return;
            const c = playerPoints.get(id) || 0;
            playerPoints.set(id, c + pts);
        }

        // Only calculate for the winning team if we know it
        // winnerSide is 'A' or 'B'
        if (winnerSide === 'A') {
            teamAInnings?.batsmanStats?.forEach(b => addPoints(b.batsmanId, (b.runs || 0) + (b.runs > 49 ? 20 : 0)));
            teamAInnings?.bowlerStats?.forEach(b => addPoints(b.bowlerId, (b.wickets * 20) + (b.wickets > 2 ? 10 : 0)));
        } else if (winnerSide === 'B') {
            teamBInnings?.batsmanStats?.forEach(b => addPoints(b.batsmanId, (b.runs || 0) + (b.runs > 49 ? 20 : 0)));
            teamBInnings?.bowlerStats?.forEach(b => addPoints(b.bowlerId, (b.wickets * 20) + (b.wickets > 2 ? 10 : 0)));
        } else {
            // Fallback: search both teams if winner is undetermined
            teamAInnings?.batsmanStats?.forEach(b => addPoints(b.batsmanId, (b.runs || 0) + (b.runs > 49 ? 20 : 0)));
            teamAInnings?.bowlerStats?.forEach(b => addPoints(b.bowlerId, (b.wickets * 20) + (b.wickets > 2 ? 10 : 0)));
            teamBInnings?.batsmanStats?.forEach(b => addPoints(b.batsmanId, (b.runs || 0) + (b.runs > 49 ? 20 : 0)));
            teamBInnings?.bowlerStats?.forEach(b => addPoints(b.bowlerId, (b.wickets * 20) + (b.wickets > 2 ? 10 : 0)));
        }

        playerPoints.forEach((pts, id) => {
            if (pts > maxPoints) { maxPoints = pts; bestId = id; }
        });
        return bestId;
    }, [match, teamAInnings, teamBInnings, winnerSide])

    const savePom = async (id: string) => {
        await matchService.update(match.id, { playerOfTheMatch: id } as any)
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
                <div className="px-6 py-2 flex items-center justify-between bg-white/[0.03] border-b border-white/5">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-[0.2em]">{label} — {teamName}</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {[...bats.map(b => ({ ...b, type: 'bat' })), ...bowls.map(b => ({ ...b, type: 'bowl' }))].map((p: any, idx) => {
                        const pid = p.type === 'bat' ? p.batsmanId : p.bowlerId
                        const player = getPlayer(pid)
                        return (
                            <div key={idx} className="flex items-center justify-between p-5 px-6 hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors group">
                                <div className="flex items-center gap-5">
                                    <div className="relative shrink-0">
                                        <PlayerAvatar
                                            photoUrl={player.photoUrl || (player as any).photo}
                                            name={player.name}
                                            size="sm"
                                            className="w-12 h-12 border-2 border-white/10 shadow-sm bg-slate-800"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <PlayerLink playerId={pid} playerName={p.batsmanName || p.bowlerName || player.name} className="text-[15px] font-semibold text-slate-900 dark:text-white truncate block leading-tight mb-0.5" />
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                                {p.type === 'bat' ? `SR: ${Number(p.strikeRate || 0).toFixed(1)}` : `ER: ${Number(p.economy || 0).toFixed(1)}`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-lg font-semibold text-slate-900 dark:text-white tabular-nums tracking-tighter">
                                        {p.type === 'bat' ? (
                                            <>
                                                {p.runs} <span className="text-slate-400 dark:text-slate-500 text-sm font-semibold">({p.balls})</span>
                                            </>
                                        ) : (
                                            <>
                                                {p.wickets}-{p.runsConceded} <span className="text-slate-400 dark:text-slate-500 text-[10px] font-semibold">({p.overs})</span>
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
        <div className="min-h-screen bg-slate-50 dark:bg-[#060b16] pb-20 font-sans">
            {/* Header - Screenshot Based Design */}
            <div className="bg-[#1C252E] text-white pt-4 pb-4 px-4">
                <div className="max-w-4xl mx-auto">
                    {/* Top Title & Match Type */}
                    <div className="text-center mb-4">
                        <h2 className="text-[13px] font-semibold text-white uppercase tracking-tight truncate px-8">
                            {match.teamAName} VS {match.teamBName}
                        </h2>
                        <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.2em] mt-1 opacity-80">
                            {(match as any).stage === 'knockout'
                                ? `${formatKnockoutTitle(match)?.toUpperCase()} • ${tournament?.name || 'FRIENDLY MATCH'}`
                                : (match as any).matchNo ? `MATCH ${(match as any).matchNo} • ${tournament?.name || 'FRIENDLY MATCH'}` : `${match.oversLimit || 20} OVERS • ${tournament?.name || 'FRIENDLY MATCH'}`}
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
                                    loading="eager"
                                    {...({ fetchpriority: "high" } as any)}
                                />
                                {winnerSide === firstBatSide && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center border border-[#1C252E]">
                                        <Trophy className="w-2.5 h-2.5 text-white" />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-tighter truncate">{getAbbr(leftName)}</div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-lg font-medium text-white leading-none tabular-nums">
                                        {leftInns?.totalRuns || '0'}-{leftInns?.totalWickets || '0'}
                                    </span>
                                    <span className="text-[9px] text-slate-500 font-semibold">({leftInns?.overs || '0.0'})</span>
                                </div>
                            </div>
                        </div>

                        {/* Mid Divider */}
                        <div className="px-3 md:px-5 lg:px-6 shrink-0 z-20">
                            <div className="relative" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>
                                <div className="bg-white dark:bg-slate-800 w-11 h-7 sm:w-[52px] sm:h-8 flex items-center justify-center overflow-hidden"
                                    style={{
                                        WebkitMaskImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6,0 L94,0 C97.3,0 100,2.7 100,6 L86,52 C84.8,56.7 80.6,60 75.8,60 L24.2,60 C19.4,60 15.2,56.7 14,52 L0,6 C0,2.7 2.7,0 6,0 Z' fill='black'/%3E%3C/svg%3E")`,
                                        WebkitMaskSize: '100% 100%',
                                        maskImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6,0 L94,0 C97.3,0 100,2.7 100,6 L86,52 C84.8,56.7 80.6,60 75.8,60 L24.2,60 C19.4,60 15.2,56.7 14,52 L0,6 C0,2.7 2.7,0 6,0 Z' fill='black'/%3E%3C/svg%3E")`,
                                        maskSize: '100% 100%'
                                    }}>
                                    <img
                                        src={vsIcon}
                                        alt="VS"
                                        className="w-[90%] h-[90%] object-contain"
                                        style={{ filter: 'brightness(0) saturate(100%) invert(50%) sepia(90%) saturate(4000%) hue-rotate(10deg) brightness(100%) contrast(110%)' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Team B */}
                        <div className="flex items-center gap-3 text-right">
                            <div className="min-w-0">
                                <div className="text-[9px] font-semibold text-slate-400 uppercase tracking-tighter truncate">
                                    {getAbbr(rightName)}
                                </div>
                                <div className="flex items-baseline justify-end gap-1">
                                    {rightInns && (
                                        <span className="text-[9px] text-slate-500 font-semibold">({rightInns?.overs || '0.0'})</span>
                                    )}
                                    <span className="text-lg font-medium text-white leading-none tabular-nums">
                                        {rightInns?.totalRuns || '0'}-{rightInns?.totalWickets || '0'}
                                    </span>
                                    {winnerSide === (firstBatSide === 'A' ? 'B' : 'A') && <Trophy className="w-2.5 h-2.5 text-amber-500 inline-block ml-0.5 mb-0.5" />}
                                </div>
                            </div>
                            <div className="relative shrink-0">
                                <img
                                    src={getTeamLogo(firstBatSide === 'A' ? 'B' : 'A')}
                                    className="w-10 h-10 rounded-lg object-cover bg-slate-800 border border-white/10"
                                    alt=""
                                    loading="eager"
                                    {...({ fetchpriority: "high" } as any)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Result Line */}
                    <div className="mt-4 text-center text-[11px] font-semibold text-amber-500 uppercase tracking-[0.15em]">
                        {resultText}
                    </div>
                </div>
            </div>

            {/* Over Highlights/Balls Timeline */}
            {/* Over Highlights/Balls Timeline - Live Tab Style */}
            <div className="bg-white dark:bg-[#0f172a] border-b border-slate-100 dark:border-white/5 py-2.5 px-4 overflow-x-auto scrollbar-hide">
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
                                            {idx > 0 && <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-1"></div>}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">OVER {over.overNumber}</span>
                                                <div className="flex items-center gap-1.5">
                                                    {(over.balls || []).map((ball: any, bi: number) => (
                                                        <div key={bi}
                                                            className={`h-7 rounded-full flex items-center justify-center font-bold border transition-all whitespace-nowrap text-[11px] ${String(ball.value).includes('W') ? 'bg-rose-600 text-white border-rose-500' :
                                                                ball.value === '6' ? 'bg-emerald-600 text-white border-emerald-600' :
                                                                    ball.value === '4' ? 'bg-blue-600 text-white border-blue-600' :
                                                                        'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 shadow-sm'
                                                                }`}
                                                            style={{
                                                                minWidth: '1.75rem',
                                                                width: 'auto',
                                                                padding: String(ball.value).length > 1 ? '0 6px' : '0'
                                                            }}>
                                                            {ball.value === '·' ? '0' : ball.value}
                                                        </div>
                                                    ))}
                                                    <div className="flex items-center gap-1.5 ml-0.5">
                                                        <span className="text-xs font-medium text-slate-400">=</span>
                                                        <span className="text-base font-medium text-slate-900 dark:text-slate-100">{over.totalRuns || 0}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Handle current partial over if exist */}
                                    {timelineInns.currentOverBalls && timelineInns.currentOverBalls.length > 0 && (
                                        <div className="flex items-center gap-3">
                                            <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-1"></div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">OV {Math.floor(parseFloat(timelineInns.overs || '0')) + 1}</span>
                                                <div className="flex items-center gap-1.5">
                                                    {timelineInns.currentOverBalls.map((ball: any, bi: number) => (
                                                        <div key={bi}
                                                            className={`h-7 rounded-full flex items-center justify-center font-bold border transition-all whitespace-nowrap text-[11px] ${String(ball.value).includes('W') ? 'bg-rose-600 text-white border-rose-500' :
                                                                ball.value === '6' ? 'bg-emerald-600 text-white border-emerald-600' :
                                                                    ball.value === '4' ? 'bg-blue-600 text-white border-blue-600' :
                                                                        String(ball.value).startsWith('P') ? 'bg-amber-500 text-white border-amber-500' :
                                                                            'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 shadow-sm'
                                                                }`}
                                                            style={{
                                                                minWidth: '1.75rem',
                                                                width: 'auto',
                                                                padding: String(ball.value).length > 1 ? '0 6px' : '0'
                                                            }}>
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
                {calculatedPomId && pomPlayer && (
                    <div className="relative animate-in zoom-in-95 duration-500">
                        {/* Golden accent border */}
                        <div className="rounded-[1.6rem] p-[1.5px] bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-400 shadow-lg shadow-amber-500/10">
                            <div className="bg-white dark:bg-[#0f172a] rounded-[1.5rem] p-4 flex items-center justify-between relative overflow-hidden h-[100px]">
                                {/* Subtle golden shimmer */}
                                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/[0.04] via-transparent to-amber-500/[0.04] pointer-events-none" />

                                <div className="flex items-center gap-5 relative z-10 min-w-0">
                                    <div className="relative">
                                        <PlayerAvatar
                                            photoUrl={pomPlayer.photoUrl || (pomPlayer as any).photo}
                                            name={pomPlayer.name}
                                            size="xl"
                                            className="w-16 h-16 md:w-20 md:h-20 border-2 border-amber-400/30 shadow-sm bg-slate-800"
                                        />
                                        {/* Trophy badge */}
                                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full flex items-center justify-center border-2 border-white dark:border-[#0f172a] shadow-sm">
                                            <Trophy className="w-3 h-3 text-white" />
                                        </div>
                                    </div>
                                    <div className="min-w-0">
                                        <Link to={`/players/${calculatedPomId}`} className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white truncate block leading-tight hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
                                            {pomStats?.bat?.batsmanName || pomStats?.bowl?.bowlerName || pomPlayer.name}
                                        </Link>
                                        <div className="text-[9px] font-semibold text-amber-600 dark:text-amber-500 mt-1 uppercase tracking-[0.15em]">Player of the Match</div>
                                    </div>
                                </div>

                                <div className="text-right flex flex-col items-end gap-0.5 relative z-10 shrink-0 ml-4">
                                    <div className="text-lg md:text-xl font-semibold text-slate-900 dark:text-white tabular-nums tracking-tighter">
                                        {pomStats?.bat && (pomStats.bat.runs > 0 || pomStats.bat.balls > 0) && (
                                            <span>{pomStats.bat.runs} ({pomStats.bat.balls})</span>
                                        )}
                                    </div>
                                    <div className="text-[12px] md:text-[13px] font-semibold text-slate-400 tabular-nums">
                                        {pomStats?.bowl && (pomStats.bowl.wickets > 0 || parseFloat(String(pomStats.bowl.overs || 0)) > 0) && (
                                            <span>{pomStats.bowl.wickets}-{pomStats.bowl.runsConceded} ({pomStats.bowl.overs})</span>
                                        )}
                                    </div>
                                </div>

                                {(user as any)?.isAdmin && (
                                    <button onClick={() => setIsEditingPom(true)} className="hide-in-screenshot absolute top-4 right-4 p-2 text-slate-400 hover:text-amber-500 transition-colors z-20">
                                        <Edit3 size={16} />
                                    </button>
                                )}

                                {isEditingPom && (
                                    <div className="absolute inset-0 bg-white/95 dark:bg-[#0f172a]/95 z-30 flex items-center justify-center p-4 rounded-[1.5rem] animate-in fade-in duration-300 backdrop-blur-sm">
                                        <div className="w-full">
                                            <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 uppercase tracking-tight text-center">Select Performer</h4>
                                            <select
                                                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white shadow-inner focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all outline-none"
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
                                            <div className="mt-3 flex justify-center">
                                                <button onClick={() => setIsEditingPom(false)} className="px-6 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 uppercase tracking-widest transition-colors">Cancel</button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Top Performers */}
                <div className="space-y-6 pt-2">
                    <div className="flex items-center gap-3 px-1">
                        <div className="h-5 w-1 bg-blue-500 rounded-full shadow-sm shadow-blue-500/50"></div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">Top Performers</h3>
                    </div>
                    {/* Top Performers Card */}
                    <div className="bg-white dark:bg-white/[0.03] rounded-[2rem] border border-slate-100 dark:border-white/5 overflow-hidden shadow-sm">
                        {renderPerformersList(leftInns, leftName, '1st Innings')}
                        <div className="h-px w-full bg-slate-100 dark:bg-white/5"></div>
                        {renderPerformersList(rightInns, rightName, '2nd Innings')}
                    </div>
                </div>

                {/* Next Matches */}
                {upcomingMatches.length > 0 && (
                    <div className="hide-in-screenshot space-y-4">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Next Matches</h3>
                            <Link to={`/tournaments/${match.tournamentId}`} className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                View All <ChevronRight size={14} />
                            </Link>
                        </div>
                        <div className="space-y-4">
                            {upcomingMatches.map(m => (
                                <Link key={m.id} to={`/matches/${m.id}`} className="bg-white dark:bg-white/[0.03] rounded-3xl border border-slate-100 dark:border-white/5 p-5 block hover:border-blue-500/20 transition-colors relative shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">{m.venue || 'TBA'}</div>
                                            <div className="text-[9px] font-semibold text-blue-600/60 dark:text-blue-400/60 uppercase tracking-tight">
                                                {m.date ? formatDateLabel(m.date) : 'Date TBA'}
                                            </div>
                                        </div>
                                        <Bell size={14} className="text-slate-400" />
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-3 flex-1">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                                                    {squadsMap.get(m.teamAId)?.logoUrl ? (
                                                        <img src={squadsMap.get(m.teamAId).logoUrl} className="w-full h-full object-contain" alt="" />
                                                    ) : (
                                                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-300">{getAbbr(m.teamAName)}</span>
                                                    )}
                                                </div>
                                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-none">{m.teamAName}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                                                    {squadsMap.get(m.teamBId)?.logoUrl ? (
                                                        <img src={squadsMap.get(m.teamBId).logoUrl} className="w-full h-full object-contain" alt="" />
                                                    ) : (
                                                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-300">{getAbbr(m.teamBName)}</span>
                                                    )}
                                                </div>
                                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-none">{m.teamBName}</span>
                                            </div>
                                        </div>
                                        <div className="pl-4 border-l border-white/10 text-right min-w-[80px]">
                                            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase mb-1">Upcoming</div>
                                            <div className="text-base font-semibold text-slate-900 dark:text-white">{String(m.time || 'TBA')}</div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tournament Navigation */}
                <div className="hide-in-screenshot py-2 text-center">
                    <Link to={`/tournaments/${match.tournamentId}`} className="text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 tracking-wider uppercase transition-colors">
                        All Matches from {tournament?.name || 'Tournament'}
                    </Link>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-3 px-1">
                        <div className="h-5 w-1 bg-rose-500 rounded-full shadow-sm shadow-rose-500/50"></div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">Teams & Venue</h3>
                    </div>
                    <div className="bg-white dark:bg-white/[0.03] rounded-[2rem] border border-slate-100 dark:border-white/5 overflow-hidden divide-y divide-slate-100 dark:divide-white/5 shadow-sm">
                        <div
                            className="flex items-center justify-between p-4 px-6 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group cursor-pointer"
                            onClick={() => onSwitchTab?.('playing-xi')}
                        >
                            <div className="flex items-center gap-4">
                                <Users size={18} className="text-rose-500 group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{teamAName}</span>
                            </div>
                            <ChevronRight size={16} className="text-slate-400" />
                        </div>
                        <div
                            className="flex items-center justify-between p-4 px-6 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group cursor-pointer"
                            onClick={() => onSwitchTab?.('playing-xi')}
                        >
                            <div className="flex items-center gap-4">
                                <Users size={18} className="text-rose-500 group-hover:scale-110 transition-transform" />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{teamBName}</span>
                            </div>
                            <ChevronRight size={16} className="text-slate-400" />
                        </div>
                        <div className="flex items-center gap-4 p-4 px-6">
                            <MapPin size={18} className="text-slate-400 dark:text-slate-500" />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{match.venue || 'Venue TBA'}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-3 px-1">
                        <div className="h-5 w-1 bg-blue-500 rounded-full shadow-sm shadow-blue-500/50"></div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">{tournament?.name || 'Tournament'}</h3>
                    </div>
                    <div className="bg-white dark:bg-white/[0.03] rounded-[2rem] border border-slate-100 dark:border-white/5 overflow-hidden divide-y divide-slate-100 dark:divide-white/5 shadow-sm">
                        <Link to={`/tournaments/${match.tournamentId}`} className="flex items-center gap-4 p-4 px-6 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group">
                            <Calendar size={18} className="text-blue-500 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Matches</span>
                        </Link>
                        <Link to={`/tournaments/${match.tournamentId}/stats`} className="flex items-center gap-4 p-4 px-6 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group">
                            <BarChart2 size={18} className="text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Player Stats (Most runs, wkts, 6s, 4s)</span>
                        </Link>
                        <Link to={`/tournaments/${match.tournamentId}/points`} className="flex items-center gap-4 p-4 px-6 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group">
                            <Table size={18} className="text-amber-500 dark:text-amber-400 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Points Table</span>
                        </Link>
                    </div>
                </div>

                <div className="hide-in-screenshot py-6 px-2">
                    <button
                        onClick={() => (window as any).openMatchSettings && (window as any).openMatchSettings()}
                        className="flex items-center gap-3 text-slate-500 hover:text-blue-400 transition-colors w-full text-left"
                    >
                        <Settings size={18} />
                        <span className="text-sm font-semibold">Match Settings</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default MatchSummary
