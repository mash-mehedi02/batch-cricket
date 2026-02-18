/**
 * CREX-style Match Card
 * Professional layout with live scores, results, and toss updates
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Match, Squad, InningsStats } from '@/types'
import { matchService } from '@/services/firestore/matches'
import { coerceToDate, formatTimeHMTo12h } from '@/utils/date'
import { formatShortTeamName } from '@/utils/teamName'
import { NotificationBell } from '@/components/notifications/NotificationBell'

interface MatchCardProps {
    match: Match
    squadsMap: Record<string, Squad>
    tournamentName?: string
}

import { useTranslation } from '@/hooks/useTranslation'

const MatchCard: React.FC<MatchCardProps> = ({ match, squadsMap, tournamentName }) => {
    const { t, language } = useTranslation() // Hook used here

    // OPTIMIZATION: Initialize with data from match object if available (Instant Load)
    const [teamAInnings, setTeamAInnings] = useState<InningsStats | null>(() => {
        if (match.score?.teamA) {
            return {
                totalRuns: match.score.teamA.runs,
                totalWickets: match.score.teamA.wickets,
                overs: match.score.teamA.overs,
            } as InningsStats
        }
        return null
    })

    const [teamBInnings, setTeamBInnings] = useState<InningsStats | null>(() => {
        if (match.score?.teamB) {
            return {
                totalRuns: match.score.teamB.runs,
                totalWickets: match.score.teamB.wickets,
                overs: match.score.teamB.overs,
            } as InningsStats
        }
        return null
    })

    const [teamASuperInnings, setTeamASuperInnings] = useState<InningsStats | null>(null)
    const [teamBSuperInnings, setTeamBSuperInnings] = useState<InningsStats | null>(null)

    const [timeLeft, setTimeLeft] = useState<string>('')

    const statusLower = String(match.status || '').toLowerCase().trim()
    const isLive = ['live', 'inningsbreak', 'innings break'].includes(statusLower)
    const isFinished = ['finished', 'completed', 'result'].includes(statusLower)
    const isInningsBreak = statusLower === 'inningsbreak' || statusLower === 'innings break'
    const isUpcoming = !isLive && !isFinished && !isInningsBreak

    useEffect(() => {
        // OPTIMIZATION: Only subscribe to live matches. 
        if (isLive) {
            const unsubA = matchService.subscribeToInnings(match.id, 'teamA', (data) => setTeamAInnings(data))
            const unsubB = matchService.subscribeToInnings(match.id, 'teamB', (data) => setTeamBInnings(data))
            const unsubASO = matchService.subscribeToInnings(match.id, 'teamA_super', (data) => setTeamASuperInnings(data))
            const unsubBSO = matchService.subscribeToInnings(match.id, 'teamB_super', (data) => setTeamBSuperInnings(data))

            return () => {
                unsubA(); unsubB(); unsubASO(); unsubBSO();
            }
        } else if (isFinished) {
            // Fetch once for finished matches to ensure we have SO data if needed
            matchService.getInnings(match.id, 'teamA').then(setTeamAInnings)
            matchService.getInnings(match.id, 'teamB').then(setTeamBInnings)
            matchService.getInnings(match.id, 'teamA_super').then(setTeamASuperInnings)
            matchService.getInnings(match.id, 'teamB_super').then(setTeamBSuperInnings)
        }
    }, [match.id, isLive, isFinished])

    // Countdown effect for upcoming matches
    useEffect(() => {
        if (!isUpcoming) return

        const updateCountdown = () => {
            const matchDate = coerceToDate(match.date)
            if (!matchDate) return

            const timeParts = String(match.time || '00:00').split(':')
            const targetDate = new Date(matchDate)
            targetDate.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0)

            const now = new Date()
            const diff = targetDate.getTime() - now.getTime()

            if (diff <= 0) {
                setTimeLeft('Starts soon')
                return
            }

            const totalSecs = Math.floor(diff / 1000)
            const days = Math.floor(totalSecs / (24 * 3600))
            const hours = Math.floor((totalSecs % (24 * 3600)) / 3600)
            const mins = Math.floor((totalSecs % 3600) / 60)
            const secs = totalSecs % 60

            let parts = []
            if (days > 0) parts.push(`${days}d`)
            if (hours > 0 || days > 0) parts.push(`${hours}h`)
            parts.push(`${mins}m`)
            parts.push(`${secs}s`)

            setTimeLeft(parts.join(' '))
        }

        updateCountdown()
        const timer = setInterval(updateCountdown, 1000)
        return () => clearInterval(timer)
    }, [match.date, match.time, isUpcoming])

    const teamA = squadsMap[match.teamAId || (match as any).teamASquadId]
    const teamB = squadsMap[match.teamBId || (match as any).teamBSquadId]

    const teamAName = teamA ? formatShortTeamName(teamA.name, teamA.batch) : formatShortTeamName(match.teamAName || 'Team A')
    const teamBName = teamB ? formatShortTeamName(teamB.name, teamB.batch) : formatShortTeamName(match.teamBName || 'Team B')
    const teamALogo = teamA?.logoUrl || (match as any).teamALogoUrl || null
    const teamBLogo = teamB?.logoUrl || (match as any).teamBLogoUrl || null

    const getTossText = () => {
        if (!match.tossWinner || !match.electedTo) return null
        const winnerName = match.tossWinner === 'teamA' ? teamAName : teamBName
        const decision = match.electedTo === 'bat' ? t('bat') : t('bowl')
        return `${winnerName} ${t('won_toss')} ${decision}`
    }

    const getResultText = () => {
        if (!isFinished) return null
        if ((match as any).resultSummary) return (match as any).resultSummary

        if (teamAInnings && teamBInnings) {
            const aRuns = teamAInnings.totalRuns || 0
            const bRuns = teamBInnings.totalRuns || 0

            // --- Super Over Result Logic ---
            if (aRuns === bRuns && (teamASuperInnings || teamBSuperInnings)) {
                const soA = teamASuperInnings?.totalRuns || 0
                const soB = teamBSuperInnings?.totalRuns || 0

                if (soA === 0 && soB === 0) return t('match_tied')
                if (soA === soB) return `${t('match_tied')} (Super Over)`

                const winnerName = soA > soB ? teamAName : teamBName
                const diff = Math.abs(soA - soB)
                return `${winnerName} won Super Over by ${diff} run${diff !== 1 ? 's' : ''}`
            }

            // Normal Result Logic
            // Determine who batted first
            let firstBat: 'teamA' | 'teamB' = 'teamA'
            if (match.tossWinner === 'teamA' && match.electedTo === 'bowl') firstBat = 'teamB'
            if (match.tossWinner === 'teamB' && match.electedTo === 'bat') firstBat = 'teamB'

            const firstInnings = firstBat === 'teamA' ? teamAInnings : teamBInnings
            const secondInnings = firstBat === 'teamA' ? teamBInnings : teamAInnings
            const firstTeamName = firstBat === 'teamA' ? teamAName : teamBName
            const secondTeamName = firstBat === 'teamA' ? teamBName : teamAName

            if (firstInnings.totalRuns > secondInnings.totalRuns) {
                const diff = firstInnings.totalRuns - secondInnings.totalRuns
                if (language === 'bn') {
                    return `${firstTeamName} ${diff} ${t('by_runs')} ${t('won_by')}`
                }
                return `${firstTeamName} ${t('won_by')} ${diff} ${t('by_runs')}`
            } else if (secondInnings.totalRuns > firstInnings.totalRuns) {
                const diff = 10 - secondInnings.totalWickets
                if (language === 'bn') {
                    return `${secondTeamName} ${diff} ${t('by_wickets')} ${t('won_by')}`
                }
                return `${secondTeamName} ${t('won_by')} ${diff} ${t('by_wickets')}`
            }
            return t('match_tied')
        }
        return t('completed')
    }

    const getStatusText = () => {
        if (isInningsBreak) return 'Innings Break' // I need a key, default to English literal if missing or I'll add 'Innings Break'
        if (isLive) return t('live')
        if (isFinished) return getResultText() || t('completed')
        const d = coerceToDate(match.date)
        if (d) {
            const dateStr = d.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
            const timeStr = match.time ? formatTimeHMTo12h(match.time) : ''
            return `${dateStr}, ${timeStr}`
        }
        return t('upcoming')
    }

    const getRunsNeeded = () => {
        if (!isLive || match.matchPhase !== 'SecondInnings') return null

        // Determine which team batted first to identify the chasing team
        const battedFirst = match.tossWinner === 'teamA'
            ? (match.electedTo === 'bat' ? 'teamA' : 'teamB')
            : (match.electedTo === 'bat' ? 'teamB' : 'teamA')

        // The chasing team is the opposite of the team that batted first
        const chasingTeam = battedFirst === 'teamA' ? 'teamB' : 'teamA'

        const battingInnings = chasingTeam === 'teamA' ? teamAInnings : teamBInnings
        const bowlingInnings = chasingTeam === 'teamA' ? teamBInnings : teamAInnings

        if (!bowlingInnings || !battingInnings) return null

        const target = bowlingInnings.totalRuns + 1
        const runsNeeded = target - battingInnings.totalRuns
        const totalBalls = (match.oversLimit || 20) * 6
        const [oInt, balls] = (battingInnings.overs || '0.0').split('.').map(Number)
        const ballsPlayed = (oInt || 0) * 6 + (balls || 0)
        const ballsRemaining = totalBalls - ballsPlayed

        if (runsNeeded <= 0) return null

        const teamName = chasingTeam === 'teamA' ? teamAName : teamBName
        // En: Team A need 10 runs in 5 balls
        // Bn: Team A ৫ বলে ১০ রান প্রয়োজন
        if (language === 'bn') {
            return `${teamName} ${ballsRemaining} বলে ${runsNeeded} রান প্রয়োজন`
        }
        return `${teamName} need ${runsNeeded} runs in ${ballsRemaining} balls`
    }

    const runsNeededText = getRunsNeeded()
    const resultText = getResultText()
    const tossText = getTossText()

    const parsedResult = (() => {
        if (!isFinished || !resultText) return null
        const lowerRes = resultText.toLowerCase()

        // Handle Super Over split
        if (lowerRes.includes('won super over by')) {
            const splitWord = ' won super over by '
            const idx = lowerRes.indexOf(splitWord)
            if (idx !== -1) {
                return {
                    main: resultText.substring(0, idx).trim() + ' WON',
                    sub: 'S.O. by ' + resultText.substring(idx + splitWord.length).trim()
                }
            }
        }

        // Normal split
        const wonIdx = lowerRes.indexOf(' won by ')
        if (wonIdx === -1) return { main: resultText.toUpperCase(), sub: '' }

        const teamWon = resultText.substring(0, wonIdx).trim() + ' WON'
        const byStats = 'by ' + resultText.substring(wonIdx + 8).trim()

        return {
            main: teamWon.toUpperCase(),
            sub: byStats
        }
    })()

    const isFirstInningsFinished = (() => {
        if (!isLive || !match.tossWinner || !match.electedTo) return false
        const battedFirst = match.tossWinner === 'teamA'
            ? (match.electedTo === 'bat' ? 'teamA' : 'teamB')
            : (match.electedTo === 'bat' ? 'teamB' : 'teamA')
        const stats = battedFirst === 'teamA' ? teamAInnings : teamBInnings
        if (!stats) return false
        return stats.totalWickets >= 10 || parseFloat(stats.overs) >= match.oversLimit
    })()

    const getTeamColor = (teamId: 'teamA' | 'teamB') => {
        if (isUpcoming || isFinished) return 'text-black font-bold'
        if (isLive) {
            if (isInningsBreak || !match.currentBatting) return 'text-black font-bold'
            // Unmuted: using shadow or border instead of graying out name
            return match.currentBatting === teamId ? 'text-black font-black' : 'text-black font-bold opacity-90'
        }
        return 'text-black font-bold'
    }

    const displayOrder = (() => {
        if (!match.tossWinner || !match.electedTo) return ['teamA', 'teamB'] as const
        const tossWinner = match.tossWinner === 'teamA' ? 'teamA' : 'teamB'
        const decision = match.electedTo === 'bat' ? 'bat' : 'bowl'
        const battedFirst = decision === 'bat' ? tossWinner : (tossWinner === 'teamA' ? 'teamB' : 'teamA')
        return battedFirst === 'teamA' ? (['teamA', 'teamB'] as const) : (['teamB', 'teamA'] as const)
    })()

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden hover:shadow-md transition-all group relative">
            {/* Header Info - NOT part of the Link to prevent interaction conflict */}
            <div className="px-4 py-2 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center bg-slate-50/20 dark:bg-slate-800/20 relative z-20">
                <Link to={`/match/${match.id}`} className="text-[10px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider truncate max-w-[70%] hover:text-blue-600 transition-colors">
                    {tournamentName || 'SMA Tournament'}
                </Link>
                <div className="flex items-center gap-2">
                    {/* Countdown for upcoming matches */}
                    {isUpcoming && timeLeft && (
                        <div className="bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight shadow-sm border border-amber-100 dark:border-amber-900/50 flex items-center gap-1">
                            <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></span>
                            {timeLeft}
                        </div>
                    )}
                    {/* Bell Icon - Hide for finished matches */}
                    {!isFinished && (
                        <NotificationBell
                            matchId={match.id}
                            adminId={match.adminId || ''}
                            matchTitle={`${teamAName} vs ${teamBName}`}
                            tournamentId={match.tournamentId}
                            color="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                        />
                    )}
                </div>
            </div>

            {/* Main Clickable Area - Just the scores and status */}
            <Link to={`/match/${match.id}`} className="block relative z-10 cursor-pointer overflow-hidden transition-all group-active:scale-[0.98]">
                <div className="p-3.5 flex gap-3">
                    {/* Teams and Scores */}
                    <div className="flex-1 space-y-2.5">
                        {displayOrder.map((side) => {
                            const name = side === 'teamA' ? teamAName : teamBName
                            const logo = side === 'teamA' ? teamALogo : teamBLogo
                            const inn = side === 'teamA' ? teamAInnings : teamBInnings
                            const isBatting = isLive && (match as any).currentInningsSide === side

                            return (
                                <div key={side} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-white dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm relative group-hover:scale-110 transition-transform">
                                            {logo ? (
                                                <img src={logo} alt={name} className="w-full h-full object-contain p-1" />
                                            ) : (
                                                <div className={`w-full h-full flex items-center justify-center text-white text-[11px] font-black uppercase ${side === 'teamA' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-rose-500 to-pink-600'}`}>
                                                    {name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className={`text-[15px] font-black truncate max-w-[120px] transition-all tracking-tight leading-none ${isBatting ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-200'}`}>
                                                {name}
                                                {isBatting && <span className="ml-1 text-[8px] animate-pulse text-blue-500">●</span>}
                                            </span>
                                            {isBatting && <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest mt-0.5">Batting</span>}
                                        </div>
                                    </div>
                                    {(isLive || isFinished || isInningsBreak) && (
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-baseline gap-1.5 tabular-nums">
                                                <span className="text-[9px] font-bold text-slate-400">
                                                    ({inn?.overs || '0.0'})
                                                </span>
                                                <span className="text-[17px] font-black text-slate-900 dark:text-white tracking-tighter">
                                                    {inn?.totalRuns || 0}-{inn?.totalWickets || 0}
                                                </span>
                                            </div>
                                            {(() => {
                                                const soInn = side === 'teamA' ? teamASuperInnings : teamBSuperInnings
                                                if (soInn && (Number(soInn.totalRuns || 0) > 0 || Number(soInn.totalWickets || 0) > 0)) {
                                                    return (
                                                        <div className="text-[9px] font-black text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-1 rounded-sm border border-amber-100 dark:border-amber-900/50 -mt-0.5">
                                                            S.O: {soInn.totalRuns}/{soInn.totalWickets} ({soInn.overs})
                                                        </div>
                                                    )
                                                }
                                                return null
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Status Divider - Compact */}
                    <div className="w-[1px] bg-gradient-to-b from-transparent via-slate-100 dark:via-slate-800 to-transparent self-stretch my-1"></div>

                    <div className="w-[90px] flex flex-col items-center justify-center text-center px-0.5">
                        {isLive ? (
                            <div className="flex flex-col items-center gap-1.5">
                                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${isInningsBreak ? 'bg-amber-100 dark:bg-amber-950/30' : 'bg-red-500 shadow-[0_2px_8px_rgba(239,68,68,0.3)]'} animate-pulse`}>
                                    {!isInningsBreak && <span className="w-1 h-1 bg-white rounded-full"></span>}
                                    <span className={`text-[8px] font-black uppercase tracking-[0.1em] ${isInningsBreak ? 'text-amber-600' : 'text-white'}`}>
                                        {isInningsBreak ? 'Break' : 'Live'}
                                    </span>
                                </span>
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                    {isLive && isFirstInningsFinished ? '2nd Innings' : 'Ongoing'}
                                </span>
                            </div>
                        ) : isFinished && parsedResult ? (
                            <div className="flex flex-col items-center bg-amber-500/[0.08] dark:bg-amber-500/[0.05] p-2 rounded-xl border border-amber-500/20 w-full min-h-[48px] justify-center shadow-[0_2px_10px_-4px_rgba(245,158,11,0.2)]">
                                <span className="text-[9px] font-black text-amber-600 dark:text-amber-500 leading-none uppercase tracking-tighter text-center mb-1">
                                    {parsedResult.main}
                                </span>
                                {parsedResult.sub && (
                                    <span className="text-[7.5px] font-black text-amber-500/80 uppercase tracking-[0.05em] whitespace-nowrap opacity-80">
                                        {parsedResult.sub}
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 opacity-70">
                                    Starts At
                                </span>
                                <div className="text-[11px] font-black leading-tight uppercase text-slate-900 dark:text-white tracking-widest bg-slate-50 dark:bg-slate-800/50 px-2 py-1 rounded-full border border-slate-100 dark:border-slate-800">
                                    {match.time || '11:00 AM'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Strip - Minimal & Clean */}
                <div className={`px-4 py-2 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between min-h-[32px] ${isLive ? 'bg-blue-50/20 dark:bg-blue-900/10' : 'bg-transparent'}`}>
                    <div className="text-[9px] font-black uppercase tracking-tight flex-1 truncate pr-2">
                        {runsNeededText ? (
                            <span className="text-blue-600 dark:text-blue-400">{runsNeededText}</span>
                        ) : (isLive && isFirstInningsFinished && match.matchPhase === 'FirstInnings') ? (
                            <span className="text-amber-500">
                                {(() => {
                                    const battedFirst = match.tossWinner === 'teamA'
                                        ? (match.electedTo === 'bat' ? 'teamA' : 'teamB')
                                        : (match.electedTo === 'bat' ? 'teamB' : 'teamA')
                                    const stats = battedFirst === 'teamA' ? teamAInnings : teamBInnings
                                    const chasing = battedFirst === 'teamA' ? teamBName : teamAName
                                    return `${chasing} NEED ${(stats?.totalRuns || 0) + 1} RUNS`
                                })()}
                            </span>
                        ) : (
                            <span className="text-slate-400 dark:text-slate-500 truncate block">
                                {tossText && <span className="opacity-90 underline underline-offset-2 decoration-slate-200 dark:decoration-slate-700">{tossText}</span>}
                                {!tossText && <span className="opacity-60">{isFinished ? 'Match Finished' : 'Match Preview'}</span>}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 tabular-nums">
                        <span className="text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">
                            {coerceToDate(match.date)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </span>
                    </div>
                </div>
            </Link>
        </div>
    )
}

export default MatchCard
