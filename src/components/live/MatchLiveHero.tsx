
import React, { useEffect, useRef, useState, useMemo } from 'react'
import { Match, InningsStats } from '@/types'
import fourIcon from '../../assets/four.png'
import sixIcon from '../../assets/six.png'
import BallEventAnimations from './BallEventAnimations'

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
            return 'bg-gradient-to-r from-yellow-900/40 via-amber-800/40 to-yellow-900/40 animate-pulse border-amber-500/30'
        } else if (displayEvent === '6') {
            return 'bg-gradient-to-r from-orange-900/50 via-red-900/40 to-orange-900/50 animate-pulse border-orange-500/30 shadow-[0_0_30px_rgba(249,115,22,0.3)]'
        } else if (isWicket) {
            return 'bg-gradient-to-r from-red-950/60 via-red-900/50 to-red-950/60 animate-pulse border-red-500/30'
        }
        return 'bg-[#121926]';
    }, [displayEvent, isWicket, showAnimation, showBoundaryAnim, isFinishedMatch]);

    // Text glow effect for the main score
    const textGlowClass = useMemo(() => {
        if (displayEvent === '4') return 'drop-shadow-[0_0_10px_rgba(250,204,21,0.6)] text-yellow-100';
        if (displayEvent === '6') return 'drop-shadow-[0_0_10px_rgba(251,146,60,0.6)] text-orange-100';
        if (isWicket) return 'drop-shadow-[0_0_10px_rgba(248,113,113,0.5)] text-red-50';
        return 'text-[#00d1ff]';
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
                {/* 1. Main Score Header - 60/40 Split */}
                <div className="flex items-stretch min-h-[90px] border-b border-white/5">
                    {/* LEFT: Team Score (60%) */}
                    <div className="w-[60%] p-3 sm:p-4 flex items-center gap-3 sm:gap-4 border-r border-white/10 relative">
                        {/* Team Logo */}
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#1a2333] border border-white/5 p-1 flex items-center justify-center shadow-lg shrink-0 overflow-hidden">
                            {logoUrl ? (
                                <img src={logoUrl} className="w-full min-w-full min-h-full object-cover" alt="" />
                            ) : (
                                <span className="text-lg font-black uppercase">{currentTeamDisplay[0]}</span>
                            )}
                        </div>

                        {/* Team Name & Score */}
                        <div className="min-w-0 flex flex-col justify-center">
                            <div className="text-[12px] sm:text-[13px] font-medium text-slate-300 uppercase tracking-wide truncate mb-0.5 opacity-80">
                                {currentTeamDisplay}
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-4xl sm:text-5xl font-medium tabular-nums tracking-tighter leading-none transition-colors duration-300 ${textGlowClass}`}>
                                    {runs}-{wkts}
                                </span>
                                <span className="text-sm sm:text-base font-medium text-slate-500 tabular-nums">
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
                                <img src={fourIcon} className="h-16 w-auto object-contain drop-shadow-xl" alt="4" />
                            </div>
                        ) : showBoundaryAnim && isSix ? (
                            <div className="flex flex-col items-center animate-bounce z-10 w-full justify-center">
                                <img src={sixIcon} className="h-16 w-auto object-contain drop-shadow-xl" alt="6" />
                            </div>
                        ) : (
                            <div className={`relative z-10 text-center flex flex-col items-center justify-center ${eventColorClass}`}>
                                <span className={`font-medium tracking-tighter transition-all duration-300 scale-100 leading-none ${isFinishedMatch || !isRun ? 'text-xl sm:text-2xl uppercase px-2' : 'text-4xl sm:text-6xl'}`}>
                                    {displayEvent === '—' ? '' : displayEvent}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Stats Row - Dynamic based on Chase */}
                {!isFinishedMatch && (
                    <div className="px-5 py-2.5 bg-[#1a2332] border-t border-white/5 flex items-center justify-between text-[11px] sm:text-xs">
                        {/* LEFT SIDE Stats */}
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-500 uppercase tracking-widest">CRR:</span>
                                <span className="font-medium text-white text-sm">{crr.toFixed(2)}</span>
                            </div>
                            {isChasing && (
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-slate-500 uppercase tracking-widest">RRR:</span>
                                    <span className="font-medium text-amber-400 text-sm">{reqRunRate.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        {/* RIGHT SIDE Info */}
                        <div className="flex items-center gap-2">
                            {isChasing ? (
                                <span className="font-medium text-amber-400 uppercase tracking-wide">
                                    Need <span className="text-white font-medium">{runsNeeded}</span> off <span className="text-white font-medium">{remainingBalls}</span>
                                </span>
                            ) : (
                                <>
                                    <span className="font-medium text-slate-500 uppercase tracking-widest">{tossText.split(':')[0]}:</span>
                                    <span className="font-medium text-slate-200 uppercase">{tossText.split(':')[1]?.trim() || '—'}</span>
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. Timeline Strip - White background */}
                <div className="bg-white p-3 sm:p-4 overflow-hidden border-t border-slate-100">
                    <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto scrollbar-hide py-1" ref={scrollRef}>
                        {[...recentOvers].map((over, idx) => {
                            const overTotal = over.totalRuns ?? over.total ?? 0
                            const isCurrentOver = idx === recentOvers.length - 1 && !over.isLocked;
                            const ballsToShow = isCurrentOver ? currentOverBalls : over.balls || [];

                            return (
                                <React.Fragment key={idx}>
                                    <div className="flex items-center gap-3 shrink-0">
                                        {/* Over Number */}
                                        <div className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">
                                            OVER {over.overNumber}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {ballsToShow.map((b: any, bIdx: number) => {
                                                let val = String(b?.value || b?.label || b?.runsOffBat || b?.runs || '').trim() || '0'
                                                if (val === '·') val = '0'
                                                const isTextLabel = val.length > 1 && !['NB', 'WD', 'LB', 'B'].includes(val.toUpperCase())

                                                // Color logic
                                                const isBoundary = val === '4' || val === '6';
                                                const isWicket = b?.type === 'wicket' || val === 'W' || val.toUpperCase().includes('OUT');

                                                const baseDot = `w-8 h-8 rounded-full flex items-center justify-center font-medium shrink-0 border transition-all text-xs`
                                                let dotStyle = "bg-white text-slate-800 border-slate-200 shadow-sm"
                                                if (isBoundary) dotStyle = val === '4'
                                                    ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-white border-yellow-400 shadow-sm"
                                                    : "bg-gradient-to-br from-orange-500 to-amber-500 text-white border-orange-400 shadow-sm";
                                                if (isWicket) dotStyle = "bg-red-600 text-white border-red-500 shadow-md";

                                                // Format display text
                                                let displayValue = val;
                                                const upper = val.toUpperCase();
                                                if (upper.includes('WD')) displayValue = 'WD';
                                                else if (upper.includes('NB')) displayValue = 'NB';
                                                else if (upper.includes('LB')) displayValue = 'LB';
                                                else if (upper.includes('B')) displayValue = upper.length === 1 ? 'B' : upper;

                                                return (
                                                    <div key={bIdx} className={`${baseDot} ${dotStyle} ${isTextLabel ? 'rounded-lg uppercase tracking-tight' : 'rounded-full'}`}>
                                                        {displayValue}
                                                    </div>
                                                )
                                            })}

                                            {isCurrentOver && ballsToShow.length < 6 && (
                                                Array.from({ length: 6 - ballsToShow.length }).map((_, emptyIdx) => (
                                                    <div key={`empty-${emptyIdx}`} className="w-8 h-8 rounded-full border border-dashed border-slate-200" />
                                                ))
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 ml-1">
                                            <span className="text-xs font-medium text-slate-400">=</span>
                                            <span className="text-xs font-medium text-slate-700">{overTotal}</span>
                                        </div>
                                    </div>
                                    {idx < recentOvers.length - 1 && <div className="h-4 w-[1px] bg-slate-100 shrink-0" />}
                                </React.Fragment>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MatchLiveHero
