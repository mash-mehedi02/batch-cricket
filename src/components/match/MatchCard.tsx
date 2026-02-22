/**
 * CREX-style Match Card
 * Professional layout with live scores, results, and toss updates
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Match, Squad, InningsStats } from '@/types'
import { matchService } from '@/services/firestore/matches'
import { tournamentService } from '@/services/firestore/tournaments'
import { coerceToDate } from '@/utils/date'
import { formatShortTeamName } from '@/utils/teamName'
import { Trophy } from 'lucide-react'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useTranslation } from '@/hooks/useTranslation'

interface MatchCardProps {
    match: Match
    squadsMap: Record<string, Squad>
    tournamentName?: string
}

const MatchCard: React.FC<MatchCardProps> = ({ match, squadsMap, tournamentName }) => {
    const { t, language } = useTranslation()

    const [fetchedTournamentName, setFetchedTournamentName] = useState<string>('')

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
        if (!tournamentName && match.tournamentId) {
            tournamentService.getById(match.tournamentId).then(t => {
                if (t) setFetchedTournamentName(t.name)
            }).catch(console.error)
        }
    }, [match.tournamentId, tournamentName])

    useEffect(() => {
        if (isLive) {
            const unsubA = matchService.subscribeToInnings(match.id, 'teamA', (data) => setTeamAInnings(data))
            const unsubB = matchService.subscribeToInnings(match.id, 'teamB', (data) => setTeamBInnings(data))
            const unsubASO = matchService.subscribeToInnings(match.id, 'teamA_super', (data) => setTeamASuperInnings(data))
            const unsubBSO = matchService.subscribeToInnings(match.id, 'teamB_super', (data) => setTeamBSuperInnings(data))

            return () => {
                unsubA(); unsubB(); unsubASO(); unsubBSO();
            }
        } else if (isFinished) {
            matchService.getInnings(match.id, 'teamA').then(setTeamAInnings)
            matchService.getInnings(match.id, 'teamB').then(setTeamBInnings)
            matchService.getInnings(match.id, 'teamA_super').then(setTeamASuperInnings)
            matchService.getInnings(match.id, 'teamB_super').then(setTeamBSuperInnings)
        }
    }, [match.id, isLive, isFinished])

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
                setTimeLeft('WAITING FOR GAME')
                return
            }

            const totalSecs = Math.floor(diff / 1000)
            const days = Math.floor(totalSecs / (24 * 3600))
            const hours = Math.floor((totalSecs % (24 * 3600)) / 3600)
            const mins = Math.floor((totalSecs % 3600) / 60)
            const secs = totalSecs % 60

            const pad = (n: number) => String(n).padStart(2, '0')

            let timeStr = `${pad(hours)}h:${pad(mins)}m:${pad(secs)}s`
            if (days > 0) {
                timeStr = `${days}d ${timeStr}`
            }

            setTimeLeft(timeStr)
        }

        updateCountdown()
        const timer = setInterval(updateCountdown, 1000)
        return () => clearInterval(timer)
    }, [match.date, match.time, isUpcoming])

    const teamA = squadsMap[match.teamAId]
    const teamB = squadsMap[match.teamBId]
    const teamAName = teamA ? formatShortTeamName(teamA.name, teamA.batch) : formatShortTeamName(match.teamAName || 'Team A')
    const teamBName = teamB ? formatShortTeamName(teamB.name, teamB.batch) : formatShortTeamName(match.teamBName || 'Team B')
    const teamALogo = teamA?.logoUrl || (match as any).teamALogoUrl || null
    const teamBLogo = teamB?.logoUrl || (match as any).teamBLogoUrl || null

    const isSuperOverMatch = (teamASuperInnings && (Number(teamASuperInnings.totalRuns || 0) > 0 || Number(teamASuperInnings.totalWickets || 0) > 0)) ||
        (teamBSuperInnings && (Number(teamBSuperInnings.totalRuns || 0) > 0 || Number(teamBSuperInnings.totalWickets || 0) > 0))

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

            if (aRuns === bRuns && (teamASuperInnings || teamBSuperInnings)) {
                const soA = teamASuperInnings?.totalRuns || 0
                const soB = teamBSuperInnings?.totalRuns || 0
                if (soA === 0 && soB === 0) return t('match_tied')
                if (soA === soB) return `${t('match_tied')} (Super Over)`
                const winnerName = soA > soB ? teamAName : teamBName
                const diff = Math.abs(soA - soB)
                return `${winnerName} won Super Over by ${diff} run${diff !== 1 ? 's' : ''}`
            }

            let firstBat: 'teamA' | 'teamB' = 'teamA'
            if (match.tossWinner === 'teamA' && match.electedTo === 'bowl') firstBat = 'teamB'
            if (match.tossWinner === 'teamB' && match.electedTo === 'bat') firstBat = 'teamB'

            const firstInnings = firstBat === 'teamA' ? teamAInnings : teamBInnings
            const secondInnings = firstBat === 'teamA' ? teamBInnings : teamAInnings
            const firstTeamName = firstBat === 'teamA' ? teamAName : teamBName
            const secondTeamName = firstBat === 'teamA' ? teamBName : teamAName

            if (firstInnings.totalRuns > secondInnings.totalRuns) {
                const diff = firstInnings.totalRuns - secondInnings.totalRuns
                return language === 'bn' ? `${firstTeamName} ${diff} ${t('by_runs')} ${t('won_by')}` : `${firstTeamName} ${t('won_by')} ${diff} ${t('by_runs')}`
            } else if (secondInnings.totalRuns > firstInnings.totalRuns) {
                const diff = 10 - (secondInnings.totalWickets || 0)
                return language === 'bn' ? `${secondTeamName} ${diff} ${t('by_wickets')} ${t('won_by')}` : `${secondTeamName} ${t('won_by')} ${diff} ${t('by_wickets')}`
            }
            return t('match_tied')
        }
        return t('completed')
    }

    const tossText = getTossText()
    const resultText = getResultText()

    const parsedResult = (() => {
        if (!isFinished || !resultText) return null
        const lowerRes = resultText.toLowerCase()
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
        const wonIdx = lowerRes.indexOf(' won by ')
        if (wonIdx === -1) return { main: resultText.toUpperCase(), sub: '' }
        const teamWon = resultText.substring(0, wonIdx).trim() + ' WON'
        const byStats = 'by ' + resultText.substring(wonIdx + 8).trim()
        return { main: teamWon.toUpperCase(), sub: byStats }
    })()

    const runsNeededText = (() => {
        if (!isLive || (match as any).matchPhase !== 'SecondInnings') return null
        const battedFirst = match.tossWinner === 'teamA' ? (match.electedTo === 'bat' ? 'teamA' : 'teamB') : (match.electedTo === 'bat' ? 'teamB' : 'teamA')
        const chasingTeam = battedFirst === 'teamA' ? 'teamB' : 'teamA'
        const battingInnings = chasingTeam === 'teamA' ? teamAInnings : teamBInnings
        const bowlingInnings = chasingTeam === 'teamA' ? teamBInnings : teamAInnings
        if (!bowlingInnings || !battingInnings) return null
        const target = (bowlingInnings.totalRuns || 0) + 1
        const runsNeeded = target - (battingInnings.totalRuns || 0)
        const totalBalls = (match.oversLimit || 20) * 6
        const [oInt, balls] = (battingInnings.overs || '0.0').split('.').map(Number)
        const ballsPlayed = (oInt || 0) * 6 + (balls || 0)
        const ballsRemaining = totalBalls - ballsPlayed
        if (runsNeeded <= 0) return null
        const teamName = chasingTeam === 'teamA' ? teamAName : teamBName
        return language === 'bn' ? `${teamName} ${ballsRemaining} বলে ${runsNeeded} রান প্রয়োজন` : `${teamName} need ${runsNeeded} runs in ${ballsRemaining} balls`
    })()

    const displayOrder = (() => {
        if (!match.tossWinner || !match.electedTo) return ['teamA', 'teamB'] as const
        const tossWinner = match.tossWinner === 'teamA' ? 'teamA' : 'teamB'
        const decision = match.electedTo === 'bat' ? 'bat' : 'bowl'
        const battedFirst = decision === 'bat' ? tossWinner : (tossWinner === 'teamA' ? 'teamB' : 'teamA')
        return battedFirst === 'teamA' ? (['teamA', 'teamB'] as const) : (['teamB', 'teamA'] as const)
    })()

    if (isUpcoming) {
        const matchDate = coerceToDate(match.date)
        const dateStr = matchDate ? matchDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) : 'TBD'

        return (
            <Link to={`/match/${match.id}`} className="block group relative">
                <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden transition-all hover:shadow-md h-full flex flex-col relative">
                    {/* Notification Bell - Nudged Up & Right */}
                    <div className="absolute top-1 right-1 z-30">
                        <NotificationBell
                            matchId={match.id}
                            adminId={(match as any).adminId || 'default'}
                            tournamentId={match.tournamentId}
                        />
                    </div>

                    {/* Top Section - Slim & Professional */}
                    <div className="pt-3 px-4 text-center">
                        <h3 className="text-[14px] sm:text-[16px] font-black text-slate-800 dark:text-slate-100 tracking-tight leading-tight mb-0.5 pr-6">
                            {tournamentName || fetchedTournamentName || 'Tournament Series'}
                        </h3>
                        <div className="h-[0.5px] border-t border-dashed border-slate-300 dark:border-white/10 w-[80%] mx-auto my-1.5" />
                        <p className="text-[8px] sm:text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            {match.oversLimit ? `${match.oversLimit === 50 ? 'ODI' : 'T' + match.oversLimit} . ` : ''}{dateStr} - {match.time || 'TBD'}
                        </p>
                    </div>

                    {/* Team Showdown - Exact Compact Logo Pods */}
                    <div className="flex-1 flex items-center justify-between w-full relative overflow-hidden py-3">
                        {/* Team A - Left Slim Pod */}
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                            <div className="h-10 sm:h-12 w-16 sm:w-20 bg-gradient-to-r from-slate-300 via-slate-200 to-transparent dark:from-slate-800 dark:to-transparent rounded-r-full flex items-center justify-start shrink-0">
                                <div className="ml-0.5 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600 relative z-10 translate-x-1 sm:translate-x-2">
                                    {teamALogo ? (
                                        <img src={teamALogo} alt={teamAName} className="w-full h-full object-contain p-1" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-black bg-indigo-600">
                                            {teamAName.charAt(0)}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <span className="text-[13px] sm:text-[15px] font-black text-slate-900 dark:text-white truncate uppercase tracking-tighter">
                                {teamAName}
                            </span>
                        </div>

                        {/* VS Center Badge - Ultra Compact */}
                        <div className="shrink-0 px-1 z-20">
                            <div className="bg-slate-200/80 dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-300 dark:border-white/10 italic text-center">
                                <span className="text-[12px] sm:text-[14px] font-black text-slate-600 dark:text-slate-500 italic">VS</span>
                            </div>
                        </div>

                        {/* Team B - Right Slim Pod */}
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 justify-end">
                            <span className="text-[13px] sm:text-[15px] font-black text-slate-900 dark:text-white truncate uppercase tracking-tighter text-right">
                                {teamBName}
                            </span>
                            <div className="h-10 sm:h-12 w-16 sm:w-20 bg-gradient-to-l from-slate-300 via-slate-200 to-transparent dark:from-slate-800 dark:to-transparent rounded-l-full flex items-center justify-end shrink-0">
                                <div className="mr-0.5 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center overflow-hidden border border-slate-200 dark:border-slate-600 relative z-10 -translate-x-1 sm:-translate-x-2">
                                    {teamBLogo ? (
                                        <img src={teamBLogo} alt={teamBName} className="w-full h-full object-contain p-1" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-black bg-rose-500">
                                            {teamBName.charAt(0)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Venue - Minimal */}
                    <div className="px-4 pb-2 text-center">
                        <p className="text-[8px] sm:text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                            {match.venue || 'Venue TBD'}
                        </p>
                    </div>

                    {/* Slim Countdown Footer */}
                    <div className="bg-[#fefce8] dark:bg-amber-950/20 py-1.5 text-center border-t border-amber-100 dark:border-white/5">
                        <p className="text-[11px] sm:text-[13px] font-black text-slate-800 dark:text-amber-500 uppercase flex items-center justify-center gap-2">
                            Starts In: <span className="tabular-nums font-black">{timeLeft}</span>
                        </p>
                    </div>
                </div>
            </Link>
        )
    }

    return (
        <div className="bg-white dark:bg-[#0f172a] rounded-xl shadow-sm border border-slate-100 dark:border-white/5 overflow-hidden hover:shadow-md transition-all group relative">
            <div className="px-4 py-2 flex justify-between items-center bg-slate-50/20 dark:bg-white/[0.02] border-b border-slate-50 dark:border-white/5">
                <div className="flex items-center gap-2 max-w-[60%]">
                    <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Trophy size={11} className="text-amber-500 fill-amber-500/20" />
                    </div>
                    <span className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest truncate">
                        {tournamentName || fetchedTournamentName || 'Tournament Series'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {isUpcoming && timeLeft && (
                        <div className="flex items-center gap-1.5 whitespace-nowrap mr-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[9px] font-black text-amber-600 dark:text-amber-500 uppercase tracking-tighter">{timeLeft}</span>
                        </div>
                    )}
                    {!isFinished && (
                        <NotificationBell
                            matchId={match.id}
                            adminId={(match as any).adminId || 'default'}
                            tournamentId={match.tournamentId}
                            color="text-slate-400 dark:text-slate-500"
                        />
                    )}
                </div>
            </div>

            <Link to={`/match/${match.id}`} className="block">
                <div className="p-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1 space-y-4">
                            {displayOrder.map((side) => {
                                const name = side === 'teamA' ? teamAName : teamBName
                                const logo = side === 'teamA' ? teamALogo : teamBLogo
                                const inn = side === 'teamA' ? teamAInnings : teamBInnings
                                const soInn = side === 'teamA' ? teamASuperInnings : teamBSuperInnings
                                const isBatting = isLive && (match as any).currentInningsSide === side

                                return (
                                    <div key={side} className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                                            {logo ? (
                                                <img src={logo} alt={name} className="w-full h-full object-contain p-1" />
                                            ) : (
                                                <div className={`w-full h-full flex items-center justify-center text-white text-[11px] font-black ${side === 'teamA' ? 'bg-indigo-600' : 'bg-rose-500'}`}>
                                                    {name.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-baseline justify-between flex-1">
                                            <span className={`text-[15px] font-black tracking-tight ${isBatting ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-slate-100'}`}>
                                                {name}
                                            </span>
                                            {(isLive || isFinished || isInningsBreak) && inn && (
                                                <div className="flex items-baseline gap-1.5 tabular-nums">
                                                    <span className="text-[16px] font-medium text-slate-900 dark:text-white leading-none">
                                                        {inn.totalRuns}-{inn.totalWickets}
                                                    </span>
                                                    {soInn && (Number(soInn.totalRuns || 0) > 0 || Number(soInn.totalWickets || 0) > 0) && (
                                                        <span className="text-[11px] font-black text-amber-500">
                                                            & {soInn.totalRuns}-{soInn.totalWickets}
                                                        </span>
                                                    )}
                                                    {!isSuperOverMatch && (
                                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                                            {inn.overs}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="w-[1.2px] h-12 bg-slate-100 dark:bg-white/5 shrink-0 opacity-80" />

                        <div className="w-[100px] flex flex-col items-center justify-center text-center">
                            {isFinished && parsedResult ? (
                                <div className="space-y-0.5">
                                    <h3 className={`text-[15px] font-black tracking-tighter leading-tight ${parsedResult.sub.toLowerCase().includes('super over') ? 'text-emerald-600' : 'text-blue-800 dark:text-blue-400'}`}>
                                        {parsedResult.main}
                                    </h3>
                                    <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest opacity-80">
                                        {parsedResult.sub}
                                    </p>
                                </div>
                            ) : isLive ? (
                                <div className="bg-red-500/90 text-white px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg shadow-red-500/20 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                    Live
                                </div>
                            ) : (
                                <div className="space-y-0.5">
                                    <div className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                        {match.time || '11:00 AM'}
                                    </div>
                                    <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Starts At</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="px-4 py-2 border-t border-slate-50 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex justify-between items-center">
                    <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 uppercase tracking-tight truncate">
                        {runsNeededText || tossText || (coerceToDate(match.date)?.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) || 'Match Date TBD')}
                    </span>
                </div>
            </Link>
        </div>
    )
}

export default MatchCard
