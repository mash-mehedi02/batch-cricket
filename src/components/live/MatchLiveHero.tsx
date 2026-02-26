import React, { useEffect, useRef, useMemo } from 'react'
import { Match, InningsStats } from '@/types'
import fourIcon from '../../assets/four.png'
import sixIcon from '../../assets/six.png'
import batIcon from '../../assets/cricket-bat.png'
import ballIcon from '../../assets/cricket-ball.png'
import { Link } from 'react-router-dom'
import { useTranslation } from '@/hooks/useTranslation'
import { formatShortTeamName } from '@/utils/teamName'
import gsap from 'gsap'

interface MatchLiveHeroProps {
    match: Match
    teamAName: string
    teamBName: string
    teamASquad?: any
    teamBSquad?: any
    currentInnings: InningsStats | null
    teamAInnings: InningsStats | null
    teamBInnings: InningsStats | null
    teamASuperInnings?: InningsStats | null
    teamBSuperInnings?: InningsStats | null
    isFinishedMatch: boolean
    resultSummary?: string
    centerEventText: string
    lastBall: any
    showBoundaryAnim?: boolean
    showAnimation?: boolean
    hideChaseBar?: boolean
    hideMainScorecard?: boolean
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
    teamASuperInnings,
    teamBSuperInnings,
    isFinishedMatch,
    resultSummary,
    centerEventText,
    showBoundaryAnim,
    showAnimation = false,
    hideChaseBar = false,
    hideMainScorecard = false,
}) => {
    const { t } = useTranslation()

    const eventTextRef = useRef<HTMLSpanElement>(null);
    const cricketBallRef = useRef<HTMLDivElement>(null);

    const inn = currentInnings as any
    const runs = Number(inn?.totalRuns || 0)
    const wkts = Number(inn?.totalWickets || 0)
    const overs = String(inn?.overs || '0.0')
    const crr = typeof inn?.currentRunRate === 'number' ? inn.currentRunRate : Number(inn?.currentRunRate || 0)

    const isSuperOver = match.isSuperOver || String(match.currentBatting || '').includes('super')
    const baseBatting = String(match.currentBatting || 'teamA').replace('_super', '').replace('_super2', '') as 'teamA' | 'teamB'
    const currentTeamName = baseBatting === 'teamB' ? teamBName : teamAName
    const currentSquad = baseBatting === 'teamB' ? teamBSquad : teamASquad
    const logoUrl = currentSquad?.logoUrl || (match as any)[baseBatting === 'teamB' ? 'teamBLogoUrl' : 'teamALogoUrl']

    const currentTeamAbbr = formatShortTeamName(currentTeamName, currentSquad?.batch)
    const opponentTeamAbbr = formatShortTeamName(baseBatting === 'teamA' ? teamBName : teamAName, baseBatting === 'teamA' ? teamBSquad?.batch : teamASquad?.batch)

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

    const tossWinnerDecision = (m.electedTo || m.tossDecision || '').toLowerCase();
    const tossText = tossWinnerName ? `${formatShortTeamName(tossWinnerName)} opt to ${tossWinnerDecision === 'bowl' ? 'bowl' : 'bat'}` : '';

    const isInningsBreak = match.status === 'InningsBreak';
    const isTied = (match as any).matchPhase === 'Tied';

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
        (match.matchPhase === 'InningsBreak' && (match.currentBatting === battedFirst || isSuperOver)) ||
        (isSuperOver && Number(match.target || (currentInnings as any)?.target || 0) > 0) ||
        match.status === 'finished';

    const matchOvers = isSuperOver ? 1 : Number(match.oversLimit || 20);
    const maxBalls = matchOvers * 6;
    const ballsBowled = totalLegals;
    const remainingBallsFirstInnings = maxBalls - ballsBowled;
    const shouldShowBallsLeftFirstInnings = !isSecondInnings && !isFinishedMatch && !isInningsBreak && remainingBallsFirstInnings <= 12 && remainingBallsFirstInnings > 0;

    let targetScore = 0;
    if (isSecondInnings) {
        // For Super Over, specifically derive the target from the 1st SO innings
        if (isSuperOver) {
            // Find who batted first in SO (it's the reverse of main match)
            const mainBattedFirst = battedFirst; // teamA or teamB
            const soBattedFirst = mainBattedFirst === 'teamA' ? 'teamB' : 'teamA';
            const soFirstInn = soBattedFirst === 'teamA' ? teamASuperInnings : teamBSuperInnings;

            if (soFirstInn && Number(soFirstInn.totalRuns || 0) > 0) {
                targetScore = Number(soFirstInn.totalRuns) + 1;
            } else {
                targetScore = Number(match?.target || (currentInnings as any)?.target || 0);
            }
        } else {
            targetScore = Number(match?.target || (currentInnings as any)?.target || 0);
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
    }

    // --- Event Label Logic ---
    const isPlayerEntering = !isFinishedMatch && !isInningsBreak && targetScore > 0 && totalLegals === 0
    // Special Case: 1st Inning Start (show Toss Info)
    const isFirstInningStart = !isFinishedMatch && totalLegals === 0 && targetScore === 0 && tossWinnerName && !isSuperOver;

    let displayEvent = isFinishedMatch
        ? (resultSummary || t('match_completed').toUpperCase())
        : (isTied ? t('match_tied').toUpperCase() : (isSuperOver && totalLegals === 0 ? t('waiting_super_over').toUpperCase() : (isInningsBreak ? t('innings_break').toUpperCase() : (isFirstInningStart ? tossText : (centerEventText || '—')))))

    // Special Case: 2nd Innings Start (Player Entering) - Also applies to Super Over 2nd Inn
    if (isPlayerEntering) {
        displayEvent = t('player_entering').toUpperCase();
    }

    const isWicket = !isFinishedMatch && !isInningsBreak && (displayEvent.toLowerCase().includes('out') || displayEvent.toLowerCase().includes('wick') || displayEvent === 'W' || displayEvent === 'WICKET')

    // Determine if the event is a boundary, wicket, or other type for styling
    const isRun = !isFinishedMatch && !isInningsBreak && ['0', '1', '2', '3', '4', '5', '6'].includes(displayEvent);

    // Result split logic for finished matches
    const { resultMain, resultSub } = useMemo(() => {
        if (!isFinishedMatch) return { resultMain: displayEvent, resultSub: '' };

        const lowerRes = displayEvent.toLowerCase();
        const wonIdx = lowerRes.indexOf(' won');
        // Split before " won" so team name is on main and "won by..." is on sub
        if (wonIdx !== -1) {
            return {
                resultMain: displayEvent.substring(0, wonIdx).trim(),
                resultSub: displayEvent.substring(wonIdx).trim()
            };
        }

        return { resultMain: displayEvent, resultSub: '' };
    }, [isFinishedMatch, displayEvent]);

    // GSAP Animation for Ball Update Sequence (BALL -> Result)
    useEffect(() => {
        if (!eventTextRef.current) return;

        const el = eventTextRef.current;
        const ball = cricketBallRef.current;
        gsap.killTweensOf(el);
        if (ball) gsap.killTweensOf(ball);

        if (resultMain && resultMain !== '—' && resultMain !== 'BALL') {
            // Actual result animation - Impactful pop style
            gsap.fromTo(el,
                { scale: 2.5, opacity: 0, filter: 'blur(20px)', rotationX: -90 },
                {
                    scale: 1,
                    opacity: 1,
                    filter: 'blur(0px)',
                    rotationX: 0,
                    duration: 0.6,
                    ease: 'back.out(2)',
                    clearProps: 'filter,rotationX'
                }
            );
        }
    }, [resultMain]);

    const isFour = !isInningsBreak && displayEvent === '4'
    const isSix = !isInningsBreak && displayEvent === '6'

    // Determine the color class based on event type
    let eventColorClass = 'text-amber-400'; // Default to Deep Golden for almost everything
    if (isWicket && displayEvent !== 'WICKET') {
        eventColorClass = 'text-red-500 [text-shadow:0_0_10px_rgba(239,68,68,0.5)]';
    } else if (isFinishedMatch || isInningsBreak || isPlayerEntering) {
        eventColorClass = 'text-amber-400 text-center px-4 leading-tight';
    } else if (displayEvent === 'BALL') {
        eventColorClass = 'text-amber-400 font-semibold italic tracking-widest';
    } else if (isSix) {
        eventColorClass = 'text-amber-400';
    }

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
    const remainingBalls = Math.max(0, (matchOvers * 6) - totalLegals);

    const liveReqRunRate = (remainingBalls > 0 && targetScore > 0)
        ? (runsNeeded / remainingBalls) * 6
        : 0;

    const displayRRR = isInningsBreak ? (targetScore / matchOvers) : liveReqRunRate;



    return (
        <div className="relative">
            <div className={`text-white overflow-hidden shadow-sm transition-all duration-300 ${scorecardAnimationClass}`}>
                {/* 1. Main Score Header - 60/40 Split - Enlarged for better visibility */}
                {!hideMainScorecard && (
                    <div className="flex items-stretch min-h-[110px] md:min-h-[130px] border-b border-white/5 bg-gradient-to-r from-transparent to-black/5 relative">
                        {/* Slanted Divider with Lighting Effect - Adjusted for better responsiveness */}
                        <div className="absolute top-0 bottom-0 left-[62%] sm:left-[60%] w-[1.5px] bg-gradient-to-b from-transparent via-white/20 to-transparent -skew-x-[12deg] z-20 shadow-[0_0_12px_rgba(148,225,212,0.3)]" />

                        {/* LEFT: Team Score (62%) - Reduced padding on mobile */}
                        <div className="w-[62%] sm:w-[60%] p-2 xs:p-3 sm:p-5 flex items-center gap-3 sm:gap-6 relative min-w-0">
                            {/* Team Logo with sophisticated shadow */}
                            {(() => {
                                const squadId = currentSquad?.id || (currentSquad as any)?.squadId;
                                const isValidSquadId = squadId && typeof squadId === 'string' && squadId !== 'undefined' && squadId !== 'null' && squadId.trim() !== '';

                                const LogoContent = (
                                    <div className="w-14 h-14 min-[400px]:w-16 min-[400px]:h-16 sm:w-20 sm:h-20 rounded-full bg-[#1a2333] border border-white/10 flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-500 relative ring-4 ring-white/5 shrink-0">
                                        {logoUrl ? (
                                            <img src={logoUrl} className="w-full h-full object-contain p-1.5" alt="" loading="eager" {...({ fetchpriority: "high" } as any)} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xl sm:text-2xl font-semibold uppercase">
                                                {currentTeamName.charAt(0)}
                                            </div>
                                        )}
                                    </div>
                                );

                                return isValidSquadId ? (
                                    <Link to={`/squads/${squadId}`} className="block shrink-0">{LogoContent}</Link>
                                ) : (
                                    <div className="shrink-0">{LogoContent}</div>
                                );
                            })()}

                            <div className="min-w-0 flex flex-col justify-center gap-1">
                                <div className="flex items-center gap-2.5">
                                    <div className="text-[14px] sm:text-[16px] font-semibold text-white/90 uppercase tracking-tighter leading-none">
                                        {currentTeamAbbr}
                                    </div>
                                    {isSuperOver && (
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                                            <div className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                            <span className="text-[9px] font-semibold text-amber-500 uppercase tracking-widest">Super Over</span>
                                        </div>
                                    )}

                                </div>
                                <div className="flex items-baseline gap-1.5 sm:gap-2.5 overflow-hidden">
                                    <span className={`text-[25px] min-[400px]:text-3xl sm:text-4xl md:text-5xl font-medium tabular-nums tracking-tighter leading-none transition-all duration-500 ${textGlowClass} truncate`}>
                                        {runs}-{wkts}
                                    </span>
                                    <span className="text-[13px] min-[400px]:text-base sm:text-xl font-semibold text-slate-500/80 tabular-nums uppercase shrink-0">
                                        {(isChasing && wkts >= 10) || isFinishedMatch ? 'Final' : `${overs}`}
                                    </span>
                                </div>

                            </div>
                        </div>

                        {/* RIGHT: Event Badge (38%) */}
                        <div className="w-[38%] sm:w-[40%] p-2 sm:p-3 flex items-center justify-center bg-black/20 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-40 pointer-events-none" />

                            {showBoundaryAnim && isFour ? (
                                <div className="flex flex-col items-center animate-in zoom-in duration-300 z-10 w-full justify-center">
                                    <img src={fourIcon} className="h-24 w-auto object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]" alt="4" />
                                </div>
                            ) : showBoundaryAnim && isSix ? (
                                <div className="flex flex-col items-center animate-in zoom-in duration-300 z-10 w-full justify-center">
                                    <img src={sixIcon} className="h-24 w-auto object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]" alt="6" />
                                </div>
                            ) : isFirstInningStart ? (
                                <div className="flex flex-col items-center justify-center gap-2 z-10 w-full animate-in fade-in zoom-in duration-500">
                                    <span className="text-[14px] sm:text-lg font-semibold text-amber-300 uppercase tracking-tight text-center leading-tight drop-shadow-md">
                                        {tossWinnerName} <br />
                                        <span className="text-white">opt to {tossWinnerDecision === 'bowl' ? 'bowl' : 'bat'}</span>
                                    </span>
                                    <img
                                        src={tossWinnerDecision === 'bowl' ? ballIcon : batIcon}
                                        className="h-6 sm:h-8 w-auto object-contain drop-shadow-lg"
                                        alt="toss-icon"
                                    />
                                </div>
                            ) : (
                                <div className={`relative z-10 text-center flex items-center justify-center w-full px-2 ${eventColorClass}`}>


                                    <div className="flex flex-col items-center justify-center gap-1.5">
                                        <span
                                            ref={eventTextRef}
                                            className={`font-bold tracking-tight uppercase drop-shadow-md
                                        ${isFinishedMatch || !isRun
                                                    ? (resultMain.length > 15 ? 'text-[13px] sm:text-[15px] leading-[1.1]' : 'text-[16px] sm:text-[20px] leading-tight')
                                                    : 'text-4xl sm:text-5xl leading-none'
                                                }`}>
                                            {resultMain === '—' || resultMain === 'BALL' ? '' : resultMain}
                                        </span>
                                        {resultSub && (
                                            <div className="mt-0.5">
                                                <span className="text-[10px] sm:text-[12px] font-bold text-amber-500 uppercase tracking-widest leading-none">
                                                    {resultSub}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* 2. Stats Row - CRR / RRR / Target */}
                {!isFinishedMatch && !hideMainScorecard && (
                    <div className="px-5 py-2 bg-black/20 border-t border-white/5 flex items-center justify-between text-[11px] sm:text-xs">
                        {/* LEFT SIDE Stats */}
                        <div className="flex items-center gap-5">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-400 uppercase tracking-widest text-xs">{t('run_rate')}:</span>
                                <span className="font-medium text-slate-100 text-xs">{crr.toFixed(2)}</span>
                            </div>
                            {targetScore > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-400 uppercase tracking-widest text-xs">{t('req_rate')}:</span>
                                    <span className="font-medium text-slate-100 text-xs">{displayRRR.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        {/* RIGHT SIDE Info */}
                        <div className="flex items-center gap-4">
                            {targetScore > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-slate-400 uppercase tracking-widest leading-none">{t('target')}:</span>
                                    <span className="text-xs font-medium text-slate-100 leading-none">{targetScore}</span>
                                </div>
                            )}

                            {(!targetScore || targetScore === 0) && !isInningsBreak && (
                                <div className={`flex items-center gap-2 ${targetScore > 0 ? 'pl-4 border-l border-white/10' : ''}`}>
                                    {shouldShowBallsLeftFirstInnings ? (
                                        <>
                                            <span className="text-xs font-medium text-slate-400 uppercase tracking-widest leading-none">Balls Left:</span>
                                            <span className="text-xs font-semibold text-amber-500 leading-none animate-pulse">
                                                {remainingBallsFirstInnings}
                                            </span>
                                        </>

                                    ) : (
                                        <>
                                            <span className="text-xs font-medium text-slate-400 uppercase tracking-widest leading-none">{t('toss')}:</span>
                                            <span className="text-xs font-medium text-slate-200 uppercase leading-none">
                                                {tossWinnerName ? formatShortTeamName(tossWinnerName) : (twid ? formatShortTeamName(twid) : '-')}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Chase Detail Sub-header - Visible in Innings Break too */}
            {targetScore > 0 && !isFinishedMatch && !hideChaseBar && (
                <div className="bg-amber-50 dark:bg-[#1e1b0b] py-1.5 border-t border-amber-100/50 dark:border-white/5 text-center shadow-lg relative z-0">
                    <div className="overflow-x-auto whitespace-nowrap px-4 scrollbar-hide">
                        <span className="text-[11px] sm:text-xs font-semibold text-amber-700 dark:text-amber-500 tracking-wider inline-block">
                            {isSuperOver ? '⚡ ' : ''}
                            {isInningsBreak ? (
                                `${opponentTeamAbbr} ${t('need_runs_in_balls').replace('${runs}', String(targetScore)).replace('${balls}', String(matchOvers * 6))}`
                            ) : (
                                `${currentTeamAbbr} ${t('need_runs_in_balls').replace('${runs}', String(runsNeeded)).replace('${balls}', String(remainingBalls))}`
                            )}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MatchLiveHero
