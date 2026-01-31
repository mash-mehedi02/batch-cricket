/**
 * CREX-style Match Card
 * Professional layout with live scores, results, and toss updates
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Match, Squad, InningsStats } from '@/types'
import { matchService } from '@/services/firestore/matches'
import { coerceToDate, formatTimeHMTo12h } from '@/utils/date'
import { NotificationBell } from '@/components/notifications/NotificationBell'

interface MatchCardProps {
    match: Match
    squadsMap: Record<string, Squad>
}

const MatchCard: React.FC<MatchCardProps> = ({ match, squadsMap }) => {
    const [teamAInnings, setTeamAInnings] = useState<InningsStats | null>(null)
    const [teamBInnings, setTeamBInnings] = useState<InningsStats | null>(null)
    const [timeLeft, setTimeLeft] = useState<string>('')

    const isLive = String(match.status || '').toLowerCase() === 'live'
    const isFinished = ['finished', 'completed'].includes(String(match.status || '').toLowerCase())
    const isUpcoming = !isLive && !isFinished

    useEffect(() => {
        if (isLive || isFinished) {
            const unsubA = matchService.subscribeToInnings(match.id, 'teamA', (data) => {
                setTeamAInnings(data)
            })
            const unsubB = matchService.subscribeToInnings(match.id, 'teamB', (data) => {
                setTeamBInnings(data)
            })

            return () => {
                unsubA()
                unsubB()
            }
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

    const formatTeamName = (s: Squad | undefined, fallback: string) => {
        if (!s?.name) return fallback
        const parts = s.name.split(/[- ]+/).filter(Boolean)
        const label = (parts[0] || '').substring(0, 3).toUpperCase()
        const batch = s.batch || parts[parts.length - 1]?.match(/\d+/) ? parts[parts.length - 1] : ''
        return batch ? `${label}-${batch}` : label
    }

    const teamAName = formatTeamName(teamA, match.teamAName || 'Team A')
    const teamBName = formatTeamName(teamB, match.teamBName || 'Team B')
    const teamALogo = teamA?.logoUrl || (match as any).teamALogoUrl || null
    const teamBLogo = teamB?.logoUrl || (match as any).teamBLogoUrl || null

    const getTossText = () => {
        if (!match.tossWinner || !match.electedTo) return null
        const winnerName = match.tossWinner === 'teamA' ? teamAName : teamBName
        const decision = match.electedTo === 'bat' ? 'bat' : 'bowl'
        // Removed "Toss: " prefix
        return `${winnerName} won & elected to ${decision}`
    }

    const getResultText = () => {
        if (!isFinished) return null
        if ((match as any).resultSummary) return (match as any).resultSummary
        if (teamAInnings && teamBInnings) {
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
                return `${firstTeamName} won by ${diff} runs`
            } else if (secondInnings.totalRuns > firstInnings.totalRuns) {
                const diff = 10 - secondInnings.totalWickets
                return `${secondTeamName} won by ${diff} wickets`
            }
            return 'Match Tied'
        }
        return 'Match Finished'
    }

    const getStatusText = () => {
        if (isLive) return 'Live'
        if (isFinished) return getResultText() || 'Finished'
        const d = coerceToDate(match.date)
        if (d) {
            const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
            const timeStr = match.time ? formatTimeHMTo12h(match.time) : ''
            return `${dateStr}, ${timeStr}`
        }
        return 'Upcoming'
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
        return `${chasingTeam === 'teamA' ? teamAName : teamBName} need ${runsNeeded} runs in ${ballsRemaining} balls`
    }

    const runsNeededText = getRunsNeeded()
    const resultText = getResultText()
    const tossText = getTossText()

    const parsedResult = (() => {
        if (!isFinished || !resultText) return null
        // Find " won by "
        const lowerRes = resultText.toLowerCase()
        const wonIdx = lowerRes.indexOf(' won by ')

        if (wonIdx === -1) return { main: resultText, sub: '' }

        const teamWon = resultText.substring(0, wonIdx + 4) // "Team Won"
        const byStats = resultText.substring(wonIdx + 4).trim() // "by X runs"

        return {
            main: teamWon,
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
            const isBreak = match.matchPhase === 'FirstInnings' && isFirstInningsFinished
            if (isBreak || !match.currentBatting) return 'text-black font-bold'
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
                <Link to={`/match/${match.id}`} className="text-[10px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider truncate max-w-[50%] hover:text-blue-600 transition-colors">
                    {match.venue ? `${match.venue}` : 'SMA Ground'}
                </Link>
                <div className="flex items-center gap-2">
                    {/* Countdown for upcoming matches */}
                    {isUpcoming && timeLeft && (
                        <div className="bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight shadow-sm border border-amber-100 dark:border-amber-900/50 flex items-center gap-1">
                            <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></span>
                            {timeLeft}
                        </div>
                    )}
                    {/* Bell Icon - Interactive and separate */}
                    <NotificationBell
                        matchId={match.id}
                        matchTitle={`${teamAName} vs ${teamBName}`}
                        color="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
                    />
                </div>
            </div>

            {/* Main Clickable Area - Just the scores and status */}
            <Link to={`/match/${match.id}`} className="block relative z-10 cursor-pointer">
                <div className="p-4 flex gap-4">
                    {/* Teams and Scores */}
                    <div className="flex-1 space-y-4">
                        {displayOrder.map((side) => {
                            const name = side === 'teamA' ? teamAName : teamBName
                            const logo = side === 'teamA' ? teamALogo : teamBLogo
                            const inn = side === 'teamA' ? teamAInnings : teamBInnings
                            return (
                                <div key={side} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                                            {logo ? (
                                                <img src={logo} alt={name} className="w-full h-full object-contain" />
                                            ) : (
                                                <span className="text-[9px] font-bold text-slate-400">{name.substring(0, 2).toUpperCase()}</span>
                                            )}
                                        </div>
                                        <span className={`text-[12px] truncate max-w-[120px] transition-all dark:text-slate-200 ${getTeamColor(side)}`}>
                                            {name}
                                        </span>
                                    </div>
                                    {(isLive || isFinished) && inn && (
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-[10px] font-medium text-slate-400 font-mono">
                                                ({inn.overs})
                                            </span>
                                            <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                                                {inn.totalRuns}-{inn.totalWickets}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Status Divider */}
                    <div className="w-px bg-slate-100 dark:bg-slate-800 self-stretch my-1"></div>

                    <div className="w-24 flex flex-col items-center justify-center text-center px-1">
                        {isLive ? (
                            <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></span>
                                    <span className="text-[11px] font-black text-red-600 dark:text-red-500 uppercase tracking-widest">Live</span>
                                </div>
                            </div>
                        ) : isFinished && parsedResult ? (
                            <div className="flex flex-col items-center">
                                <span className="text-[11px] font-black text-amber-500 leading-none uppercase">
                                    {parsedResult.main}
                                </span>
                                <span className="text-[9px] font-bold text-amber-400 mt-1 lowercase whitespace-nowrap">
                                    {parsedResult.sub}
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">
                                    Starting
                                </span>
                                <div className="text-[10px] font-black leading-tight uppercase text-slate-900 dark:text-slate-100">
                                    {getStatusText().split(',')[1]?.trim() || getStatusText()}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Strip - Toss & Progress & Results */}
                <div className={`px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between min-h-[36px] ${isLive ? 'bg-red-50/40 dark:bg-red-950/20' : 'bg-slate-50/40 dark:bg-slate-800/40'}`}>
                    <div className="text-[10px] font-normal uppercase tracking-tight flex-1">
                        {runsNeededText ? (
                            <span className="text-blue-600 dark:text-blue-400 font-bold">{runsNeededText}</span>
                        ) : (isLive && isFirstInningsFinished && match.matchPhase === 'FirstInnings') ? (
                            <span className="text-amber-500 font-bold normal-case">
                                {(() => {
                                    const battedFirst = match.tossWinner === 'teamA'
                                        ? (match.electedTo === 'bat' ? 'teamA' : 'teamB')
                                        : (match.electedTo === 'bat' ? 'teamB' : 'teamA')
                                    const stats = battedFirst === 'teamA' ? teamAInnings : teamBInnings
                                    const chasing = battedFirst === 'teamA' ? teamBName : teamAName
                                    return `${chasing} need ${(stats?.totalRuns || 0) + 1} runs`
                                })()}
                            </span>
                        ) : (
                            <span className="text-slate-700 dark:text-slate-300 font-medium">
                                {isUpcoming ? getStatusText().split(',')[0].toUpperCase() : tossText || 'Match in progress...'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 ml-2">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full opacity-50"></div>
                        <span className="text-[7px] font-black lg:text-[9px] text-slate-400 uppercase tracking-widest">SMA</span>
                    </div>
                </div>
            </Link>
        </div>
    )
}

export default MatchCard
