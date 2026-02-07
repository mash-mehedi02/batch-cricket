import React, { useEffect, useRef, useMemo } from 'react'
import { Match, InningsStats } from '@/types'
import fourIcon from '../../assets/four.png'
import sixIcon from '../../assets/six.png'
import { Link } from 'react-router-dom'

interface MatchLiveHeroProps {
    match: Match
    teamAName: string
    teamBName: string
    teamASquad?: any
    teamBSquad?: any
    currentInnings: InningsStats | null
    teamAInnings: InningsStats | null
    teamBInnings: InningsStats | null
    isFinishedMatch: boolean
    resultSummary?: string
    centerEventText: string
    ballAnimating: boolean
    ballEventType: '4' | '6' | 'wicket' | 'normal'
    lastBall: any
    recentOvers: any[]
    showBoundaryAnim?: boolean
    showAnimation?: boolean
}

const MatchLiveHero: React.FC<MatchLiveHeroProps> = ({
    match,
    teamAName,
    teamBName,
    teamASquad,
    teamBSquad,
    currentInnings,
    teamAInnings,
    teamBInnings,
    isFinishedMatch,
    resultSummary,
    centerEventText,
    recentOvers,
    showBoundaryAnim,
    showAnimation = false,
}) => {
    const scrollRef = useRef<HTMLDivElement>(null)

    // Auto-scroll timeline
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
        }
    }, [recentOvers])

    const inn = currentInnings as any
    const runs = Number(inn?.totalRuns || 0)
    const wkts = Number(inn?.totalWickets || 0)
    const overs = String(inn?.overs || '0.0')
    const crr = typeof inn?.currentRunRate === 'number' ? inn.currentRunRate : Number(inn?.currentRunRate || 0)

    const currentTeamName = match.currentBatting === 'teamB' ? teamBName : teamAName
    const currentSquad = match.currentBatting === 'teamB' ? teamBSquad : teamASquad
    const logoUrl = currentSquad?.logoUrl || (match as any)[match.currentBatting === 'teamB' ? 'teamBLogoUrl' : 'teamALogoUrl']

    // --- Improved Team Abbreviation Helper ---
    // Rule: "first 3 latter ba each word er first latter - integer"
    const getAbbreviation = (name: string) => {
        if (!name) return '';
        const nameStr = name.trim();

        // Pattern: [Team Name] [Optional Divider] [Integer]
        // Example: "RANGERS - 19", "NIGHT OWLS-22", "SMA 2024"
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

    const currentTeamAbbr = getAbbreviation(currentTeamName);
    const opponentTeamAbbr = getAbbreviation(match.currentBatting === 'teamA' ? teamBName : teamAName);

    // --- Toss Logic ---
    const m = match as any;
    const tossWinnerId = m?.tossWinner;

    // Robust Team Detection - Multi-field Matcher
    const aId = String(m.teamAId || m.teamASquadId || m.teamA || '').trim().toLowerCase();
    const bId = String(m.teamBId || m.teamBSquadId || m.teamB || '').trim().toLowerCase();
    const aName = teamAName.trim().toLowerCase();
    const bName = teamBName.trim().toLowerCase();
    const twid = String(tossWinnerId || '').trim().toLowerCase();

    let tossWinnerName = '';
    if (twid) {
        if (twid === 'teama' || (aId && twid === aId) || aName === twid || (aName.includes(twid) && twid.length > 3)) {
            tossWinnerName = teamAName;
        } else if (twid === 'teamb' || (bId && twid === bId) || bName === twid || (bName.includes(twid) && twid.length > 3)) {
            tossWinnerName = teamBName;
        }
    }

    const tossAbbr = getAbbreviation(tossWinnerName);
    const tossText = tossAbbr ? tossAbbr : '';

    const isInningsBreak = match.status === 'InningsBreak';

    // --- Advanced Scoring Logic (Target / RRR) ---
    const totalLegals = (() => {
        if (typeof inn?.legalBalls === 'number') return inn.legalBalls;
        const [o, b] = (inn?.overs || '0.0').toString().split('.').map(Number);
        return (o * 6) + (b || 0);
    })();

    // Determine who batted first to know if we should show a target
    const battedFirst = (match as any).tossWinner && (match as any).electedTo === 'bat'
        ? (match as any).tossWinner
        : ((match as any).tossWinner && (match as any).electedTo === 'bowl'
            ? ((match as any).tossWinner === 'teamA' ? 'teamB' : 'teamA')
            : 'teamA'); // Default teamA bats first if no toss info

    const isSecondInnings = match.matchPhase === 'SecondInnings' ||
        (match.matchPhase === 'InningsBreak' && match.currentBatting === battedFirst) ||
        match.status === 'finished';

    let targetScore = 0;
    if (isSecondInnings) {
        targetScore = Number(match?.target || inn?.target || 0);
        if (!targetScore) {
            const i1Score = Number((match as any).innings1Score || 0);
            if (i1Score > 0) {
                targetScore = i1Score + 1;
            } else if (match.currentBatting === 'teamB' && teamAInnings && Number(teamAInnings.totalRuns || 0) > 0) {
                targetScore = Number(teamAInnings.totalRuns) + 1;
            } else if (match.currentBatting === 'teamA' && teamBInnings && Number(teamBInnings.totalRuns || 0) > 0) {
                targetScore = Number(teamBInnings.totalRuns) + 1;
            }
        }
    }

    // --- Event Label Logic ---
    let displayEvent = isFinishedMatch ? (resultSummary || 'MATCH COMPLETED') : (isInningsBreak ? 'INNINGS BREAK' : (centerEventText || '—'))

    // Special Case: 2nd Innings Start (Player Entering)
    if (!isFinishedMatch && !isInningsBreak && targetScore > 0 && totalLegals === 0) {
        displayEvent = 'PLAYER ENTERING';
    }

    const isWicket = !isFinishedMatch && !isInningsBreak && (displayEvent.toLowerCase().includes('out') || displayEvent.toLowerCase().includes('wick') || displayEvent === 'W' || displayEvent === 'WICKET')

    // Determine if the event is a boundary, wicket, or other type for styling
    const isRun = !isFinishedMatch && !isInningsBreak && ['0', '1', '2', '3', '4', '5', '6'].includes(displayEvent);
    const isWideOrNoBall = !isFinishedMatch && !isInningsBreak && (displayEvent.toLowerCase().includes('wide') || displayEvent.toLowerCase().includes('no ball') || displayEvent.toLowerCase().includes('free hit'));
    const isBye = !isFinishedMatch && !isInningsBreak && displayEvent.toLowerCase().includes('bye');
    const isBoundary = !isFinishedMatch && !isInningsBreak && (displayEvent === '4' || displayEvent === '6');

    // Determine the color class based on event type
    let eventColorClass = 'text-slate-200'; // Default color
    if (isFinishedMatch || isInningsBreak || displayEvent === 'PLAYER ENTERING') {
        eventColorClass = 'text-amber-400 text-center px-4 leading-tight';
    } else if (isRun || isWideOrNoBall || isBye) {
        eventColorClass = 'text-amber-400';
    } else if (isWicket) {
        eventColorClass = displayEvent === 'WICKET' ? 'text-amber-400' : 'text-red-500';
    } else if (isBoundary) {
        eventColorClass = displayEvent === '4' ? 'text-amber-400' : 'text-orange-400';
    }
    const isFour = !isInningsBreak && displayEvent === '4'
    const isSix = !isInningsBreak && displayEvent === '6'

    // Determine animation class for scorecard based on event type
    const scorecardAnimationClass = useMemo(() => {
        if (isFinishedMatch || isInningsBreak) return 'bg-[#0f172a]';
        // Only apply special background if animation is active
        if (!showAnimation && !showBoundaryAnim) return 'bg-[#0f172a]';

        if (displayEvent === '4') {
            return 'bg-[#034177] animate-pulse border-blue-400/30'
        } else if (displayEvent === '6') {
            return 'bg-[#0d3d2c] animate-pulse border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
        } else if (isWicket) {
            return 'bg-[#64101e] animate-pulse border-red-500/30'
        }
        return 'bg-[#0f172a]';
    }, [displayEvent, isWicket, showAnimation, showBoundaryAnim, isFinishedMatch, isInningsBreak]);

    // Text glow effect for the main score - Exact Color Calibration
    const textGlowClass = useMemo(() => {
        const baseColor = 'text-[#94e1d4]'; // Precise teal from screenshot
        if (isInningsBreak) return 'text-amber-400';
        if (displayEvent === '4') return `drop-shadow-[0_0_15px_rgba(59,130,246,0.6)] ${baseColor}`;
        if (displayEvent === '6') return `drop-shadow-[0_0_15px_rgba(16,185,129,0.6)] ${baseColor}`;
        if (isWicket) return `drop-shadow-[0_0_15px_rgba(239,68,68,0.6)] ${baseColor}`;
        return baseColor;
    }, [displayEvent, isWicket, isInningsBreak]);



    const isChasing = targetScore > 0;
    const runsNeeded = isChasing ? Math.max(0, targetScore - runs) : (targetScore > 0 ? targetScore : 0);
    const matchOvers = match.oversLimit || 20;
    const remainingBalls = Math.max(0, (matchOvers * 6) - totalLegals);

    const liveReqRunRate = (remainingBalls > 0 && targetScore > 0)
        ? (runsNeeded / remainingBalls) * 6
        : 0;

    const displayRRR = isInningsBreak ? (targetScore / matchOvers) : liveReqRunRate;



    return (
        <div className="relative">
            <div className={`text-white overflow-hidden shadow-sm transition-all duration-300 ${scorecardAnimationClass}`}>
                {/* 1. Main Score Header - 60/40 Split - Enlarged for better visibility */}
                <div className="flex items-stretch min-h-[105px] md:min-h-[120px] border-b border-white/5">
                    {/* LEFT: Team Score (60%) */}
                    <div className="w-[60%] p-3 sm:p-4 flex items-center gap-3 sm:gap-4 border-r border-white/10 relative">
                        {/* Team Logo */}
                        {(() => {
                            const squadId = currentSquad?.id || (currentSquad as any)?.squadId;
                            const isValidSquadId = squadId && typeof squadId === 'string' && squadId !== 'undefined' && squadId !== 'null' && squadId.trim() !== '';

                            if (isValidSquadId) {
                                return (
                                    <Link to={`/squads/${squadId}`} className="block shrink-0">
                                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#1a2333] border border-white/5 p-1 flex items-center justify-center shadow-lg overflow-hidden hover:scale-105 transition-transform">
                                            {logoUrl ? (
                                                <img src={logoUrl} className="w-full min-w-full min-h-full object-cover" alt="" />
                                            ) : (
                                                <span className="text-xl font-black uppercase">{currentTeamAbbr[0]}</span>
                                            )}
                                        </div>
                                    </Link>
                                );
                            }

                            return (
                                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#1a2333] border border-white/5 p-1 flex items-center justify-center shadow-lg shrink-0 overflow-hidden">
                                    {logoUrl ? (
                                        <img src={logoUrl} className="w-full min-w-full min-h-full object-cover" alt="" />
                                    ) : (
                                        <span className="text-xl font-black uppercase">{currentTeamAbbr[0]}</span>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="min-w-0 flex flex-col justify-center">
                            <div className="text-[13px] sm:text-[14px] font-semibold text-slate-200 uppercase tracking-wide truncate mb-1">
                                {currentTeamName}
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-5xl sm:text-6xl font-medium tabular-nums tracking-tighter leading-none transition-colors duration-300 ${textGlowClass}`}>
                                    {runs}-{wkts}
                                </span>
                                <span className="text-base sm:text-lg font-medium text-slate-500 tabular-nums">
                                    {(isChasing && wkts >= 10) || isFinishedMatch ? 'FINAL' : overs}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Event Badge (40%) */}
                    <div className="w-[40%] p-2 flex items-center justify-center bg-black/10 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50" />

                        {showBoundaryAnim && isFour ? (
                            <div className="flex flex-col items-center animate-bounce z-10 w-full justify-center">
                                <img src={fourIcon} className="h-20 w-auto object-contain drop-shadow-xl" alt="4" />
                            </div>
                        ) : showBoundaryAnim && isSix ? (
                            <div className="flex flex-col items-center animate-bounce z-10 w-full justify-center">
                                <img src={sixIcon} className="h-20 w-auto object-contain drop-shadow-xl" alt="6" />
                            </div>
                        ) : (
                            <div className={`relative z-10 text-center flex flex-col items-center justify-center ${eventColorClass}`}>
                                <span className={`font-medium tracking-tighter transition-all duration-300 scale-100 leading-none ${isFinishedMatch || !isRun ? 'text-2xl sm:text-3xl uppercase px-2' : 'text-5xl sm:text-7xl'}`}>
                                    {displayEvent === '—' ? '' : displayEvent}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Stats Row - CRR / RRR / Target */}
                {!isFinishedMatch && (
                    <div className="px-5 py-2 bg-black/20 border-t border-white/5 flex items-center justify-between text-[11px] sm:text-xs">
                        {/* LEFT SIDE Stats */}
                        <div className="flex items-center gap-5">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-400 uppercase tracking-widest text-xs">CRR:</span>
                                <span className="font-medium text-slate-100 text-xs">{crr.toFixed(2)}</span>
                            </div>
                            {targetScore > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-400 uppercase tracking-widest text-xs">RRR:</span>
                                    <span className="font-medium text-slate-100 text-xs">{displayRRR.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        {/* RIGHT SIDE Info */}
                        <div className="flex items-center gap-4">
                            {targetScore > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-slate-400 uppercase tracking-widest leading-none">Target:</span>
                                    <span className="text-xs font-medium text-slate-100 leading-none">{targetScore}</span>
                                </div>
                            )}

                            {(!targetScore || targetScore === 0) && !isInningsBreak && (
                                <div className={`flex items-center gap-2 ${targetScore > 0 ? 'pl-4 border-l border-white/10' : ''}`}>
                                    <span className="text-xs font-medium text-slate-400 uppercase tracking-widest leading-none">Toss:</span>
                                    <span className="text-xs font-medium text-slate-200 uppercase leading-none">
                                        {tossText || (twid ? (twid === 'teama' ? 'T-A' : (twid === 'teamb' ? 'T-B' : twid.toUpperCase().substring(0, 6))) : '-')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Chase Detail Sub-header - Visible in Innings Break too */}
            {targetScore > 0 && !isFinishedMatch && (
                <div className="bg-[#0f172a] py-2 border-t border-white/5 text-center shadow-lg relative z-0">
                    <span className="text-[11px] sm:text-xs font-bold text-amber-500 tracking-wider">
                        {isInningsBreak ? (
                            `${opponentTeamAbbr} need ${targetScore} runs in ${matchOvers * 6} balls`
                        ) : (
                            `${currentTeamAbbr} need ${runsNeeded} runs in ${remainingBalls} balls`
                        )}
                    </span>
                </div>
            )}
        </div>
    );
}

export default MatchLiveHero
