
import React, { useEffect, useRef, useState, useMemo } from 'react'
import { Match, InningsStats } from '@/types'
import fourIcon from '../../assets/four.png'
import sixIcon from '../../assets/six.png'
import BallEventAnimations from './BallEventAnimations'
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
    currentOverBalls?: Array<{
        value: string
        type: string
        runsOffBat?: number
    }>
    showBoundaryAnim?: boolean
    animationEvent?: string
    showAnimation?: boolean
    onAnimationClose?: () => void
    setBallAnimating: (v: boolean) => void
    setBallEventType: (v: '4' | '6' | 'wicket' | 'normal') => void
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
    currentOverBalls = [],
    showBoundaryAnim,
    animationEvent = '',
    showAnimation = false,
    onAnimationClose = () => { },
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
    const rrr = typeof inn?.requiredRunRate === 'number' ? inn.requiredRunRate : Number(inn?.requiredRunRate || 0)

    const currentTeamName = match.currentBatting === 'teamB' ? teamBName : teamAName
    const currentSquad = match.currentBatting === 'teamB' ? teamBSquad : teamASquad
    const logoUrl = currentSquad?.logoUrl || (match as any)[match.currentBatting === 'teamB' ? 'teamBLogoUrl' : 'teamALogoUrl']

    // --- Format Team Name Logic ---
    const formatTeamName = (name: string) => {
        const parts = name.split('-')
        const mainName = parts[0].trim()
        const shortMain = mainName.substring(0, 3).toUpperCase()
        if (parts.length > 1) {
            const suffix = parts.slice(1).join('-').trim()
            return `${shortMain} - ${suffix}`
        }
        return shortMain
    }

    const currentTeamDisplay = formatTeamName(currentTeamName)
    const teamAShort = formatTeamName(teamAName)
    const teamBShort = formatTeamName(teamBName)

    // --- Toss Text ---
    const tossWinner = String((match as any)?.tossWinner || '').trim()
    const getWinnerShort = (winnerName: string) => {
        const parts = winnerName.split(' ')
        return parts.map(p => p[0]).join('').toUpperCase().slice(0, 3)
    }
    // Logic to try and match toss winner to teamA/B for short code
    let tossWinnerShort = ''
    if (tossWinner === 'teamA' || tossWinner === (match as any).teamAId) tossWinnerShort = teamAShort.split(' -')[0]
    else if (tossWinner === 'teamB' || tossWinner === (match as any).teamBId) tossWinnerShort = teamBShort.split(' -')[0]
    else tossWinnerShort = getWinnerShort(tossWinner)

    const tossText = tossWinner ? `Toss: ${tossWinnerShort}` : ''

    // --- Event Label Logic ---
    const displayEvent = isFinishedMatch ? (resultSummary || 'MATCH COMPLETED') : (centerEventText || '—')
    const isWicket = !isFinishedMatch && (displayEvent.toLowerCase().includes('out') || displayEvent.toLowerCase().includes('wick') || displayEvent === 'W' || displayEvent === 'WICKET')

    // Determine if the event is a boundary, wicket, or other type for styling
    const isRun = !isFinishedMatch && ['0', '1', '2', '3', '4', '5', '6'].includes(displayEvent);
    const isWideOrNoBall = !isFinishedMatch && (displayEvent.toLowerCase().includes('wide') || displayEvent.toLowerCase().includes('no ball') || displayEvent.toLowerCase().includes('free hit'));
    const isBye = !isFinishedMatch && displayEvent.toLowerCase().includes('bye');
    const isBoundary = !isFinishedMatch && (displayEvent === '4' || displayEvent === '6');

    // Determine the color class based on event type
    let eventColorClass = 'text-slate-200'; // Default color
    if (isFinishedMatch) {
        eventColorClass = 'text-amber-400 text-center px-4 leading-tight';
    } else if (isRun || isWideOrNoBall || isBye) {
        eventColorClass = 'text-amber-400';
    } else if (isWicket) {
        eventColorClass = displayEvent === 'WICKET' ? 'text-amber-400' : 'text-red-500';
    } else if (isBoundary) {
        eventColorClass = displayEvent === '4' ? 'text-amber-400' : 'text-orange-400';
    }
    const isFour = displayEvent === '4'
    const isSix = displayEvent === '6'

    // Determine animation class for scorecard based on event type
    const scorecardAnimationClass = useMemo(() => {
        if (isFinishedMatch) return 'bg-[#121926]';
        // Only apply special background if animation is active
        if (!showAnimation && !showBoundaryAnim) return 'bg-[#121926]';

        if (displayEvent === '4') {
            return 'bg-[#034177] animate-pulse border-blue-400/30'
        } else if (displayEvent === '6') {
            return 'bg-[#0d3d2c] animate-pulse border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
        } else if (isWicket) {
            return 'bg-[#64101e] animate-pulse border-red-500/30'
        }
        return 'bg-[#121926]';
    }, [displayEvent, isWicket, showAnimation, showBoundaryAnim, isFinishedMatch]);

    // Text glow effect for the main score - Exact Color Calibration
    const textGlowClass = useMemo(() => {
        if (displayEvent === '4') return 'drop-shadow-[0_0_15px_rgba(59,130,246,0.8)] text-white';
        if (displayEvent === '6') return 'drop-shadow-[0_0_15px_rgba(16,185,129,0.8)] text-white';
        if (isWicket) return 'drop-shadow-[0_0_15px_rgba(239,68,68,0.8)] text-white';
        return 'text-[#94e1d4]'; // Precise teal from screenshot
    }, [displayEvent, isWicket]);

    // --- Advanced Scoring Logic (Target / RRR) ---
    const totalLegals = (() => {
        if (typeof inn?.legalBalls === 'number') return inn.legalBalls;
        const [o, b] = (inn?.overs || '0.0').toString().split('.').map(Number);
        return (o * 6) + (b || 0);
    })();

    let targetScore = Number(inn?.target || 0);
    if (!targetScore) {
        if (match.currentBatting === 'teamB' && teamAInnings && Number(teamAInnings.totalRuns || 0) > 0) {
            targetScore = Number(teamAInnings.totalRuns) + 1;
        } else if (match.currentBatting === 'teamA' && teamBInnings && Number(teamBInnings.totalRuns || 0) > 0) {
            targetScore = Number(teamBInnings.totalRuns) + 1;
        }
    }

    const isChasing = targetScore > 0;
    const runsNeeded = isChasing ? Math.max(0, targetScore - runs) : 0;
    const matchOvers = match.oversLimit || 20;
    const remainingBalls = Math.max(0, (matchOvers * 6) - totalLegals);

    const reqRunRate = (isChasing && remainingBalls > 0)
        ? (runsNeeded / (remainingBalls / 6))
        : 0;

    return (
        <div className="sticky top-0 z-50">
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
                                                <span className="text-xl font-black uppercase">{currentTeamDisplay[0]}</span>
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
                                        <span className="text-xl font-black uppercase">{currentTeamDisplay[0]}</span>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Team Name & Score */}
                        <div className="min-w-0 flex flex-col justify-center">
                            <div className="text-[13px] sm:text-[14px] font-semibold text-slate-200 uppercase tracking-wide truncate mb-1">
                                {currentTeamDisplay}
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
                    <div className="px-5 py-2 bg-[#1a2332] border-t border-white/5 flex items-center justify-between text-[11px] sm:text-xs">
                        {/* LEFT SIDE Stats */}
                        <div className="flex items-center gap-5">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-400 uppercase tracking-widest">CRR:</span>
                                <span className="font-bold text-slate-100 text-sm">{crr.toFixed(2)}</span>
                            </div>
                            {isChasing && (
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-400 uppercase tracking-widest">RRR:</span>
                                    <span className="font-bold text-slate-100 text-sm">{reqRunRate.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        {/* RIGHT SIDE Info */}
                        <div className="flex items-center gap-2">
                            {targetScore > 0 ? (
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-slate-400 tracking-wider">Target :</span>
                                    <span className="font-bold text-slate-100 text-sm">{targetScore}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none">Toss:</span>
                                    <span className="text-xs font-bold text-slate-200 uppercase leading-none">{tossWinnerShort || '-'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. Chase Detail Sub-header */}
                {isChasing && !isFinishedMatch && (
                    <div className="bg-amber-50/10 py-1.5 border-t border-white/5 text-center">
                        <span className="text-[11px] sm:text-xs font-bold text-amber-500/90 tracking-wide">
                            {currentTeamDisplay.split(' -')[0]} need {runsNeeded} runs in {remainingBalls} balls
                        </span>
                    </div>
                )}

            </div>
        </div>
    )
}

export default MatchLiveHero
