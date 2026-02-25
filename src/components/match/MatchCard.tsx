/**
 * CREX-style Match Card (Professional Redesign)
 * Side-by-side layout for all match states (Live, Finished, Upcoming)
 * Optimized for readability with large scores and small team names
 */

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Match, Squad, InningsStats } from '@/types'
import { matchService } from '@/services/firestore/matches'
import { tournamentService } from '@/services/firestore/tournaments'
import { coerceToDate, formatTimeHMTo12h } from '@/utils/date'
import { formatShortTeamName } from '@/utils/teamName'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useTranslation } from '@/hooks/useTranslation'

interface MatchCardProps {
    match: Match
    squadsMap: Record<string, Squad>
    tournamentName?: string
}

import vsIcon from '../../../assets/vs.png'

const MatchCard: React.FC<MatchCardProps> = ({ match, squadsMap, tournamentName }) => {
    const { t, language } = useTranslation()
    const [fetchedTournamentName, setFetchedTournamentName] = useState<string>('')
    const [teamAInnings, setTeamAInnings] = useState<InningsStats | null>(null)
    const [teamBInnings, setTeamBInnings] = useState<InningsStats | null>(null)
    const [teamASuperInnings, setTeamASuperInnings] = useState<InningsStats | null>(null)
    const [teamBSuperInnings, setTeamBSuperInnings] = useState<InningsStats | null>(null)
    const [timeLeft, setTimeLeft] = useState<string>('')

    const statusLower = String(match.status || '').toLowerCase().trim()
    const isLive = ['live', 'inningsbreak', 'innings break'].includes(statusLower)
    const isFinished = ['finished', 'completed', 'result'].includes(statusLower)
    const isUpcoming = !isLive && !isFinished

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
            const unsubAS = matchService.subscribeToInnings(match.id, 'teamA_super', (data) => setTeamASuperInnings(data))
            const unsubBS = matchService.subscribeToInnings(match.id, 'teamB_super', (data) => setTeamBSuperInnings(data))
            return () => { unsubA(); unsubB(); unsubAS(); unsubBS(); }
        } else if (isFinished || (match.score?.teamA || match.score?.teamB)) {
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
            const diff = targetDate.getTime() - Date.now()
            if (diff <= 0) { setTimeLeft('WAITING FOR START'); return }
            const totalSecs = Math.floor(diff / 1000)
            const h = Math.floor(totalSecs / 3600)
            const m = Math.floor((totalSecs % 3600) / 60)
            const s = totalSecs % 60
            setTimeLeft(`${String(h).padStart(2, '0')}h:${String(m).padStart(2, '0')}m:${String(s).padStart(2, '0')}s`)
        }
        updateCountdown(); const timer = setInterval(updateCountdown, 1000)
        return () => clearInterval(timer)
    }, [match.date, match.time, isUpcoming])

    const teamA = squadsMap[match.teamAId]
    const teamB = squadsMap[match.teamBId]
    const teamAName = teamA ? formatShortTeamName(teamA.name, teamA.batch) : formatShortTeamName(match.teamAName || 'Team A')
    const teamBName = teamB ? formatShortTeamName(teamB.name, teamB.batch) : formatShortTeamName(match.teamBName || 'Team B')
    const teamALogo = teamA?.logoUrl || (match as any).teamALogoUrl || null
    const teamBLogo = teamB?.logoUrl || (match as any).teamBLogoUrl || null

    const getTossInfo = () => {
        if (!match.tossWinner || !match.electedTo) return null
        const winnerName = match.tossWinner === 'teamA' ? teamAName : teamBName
        const decision = match.electedTo // 'bat' or 'bowl'
        return { winnerName, decision }
    }
    const tossInfo = getTossInfo()

    const runsNeededText = (() => {
        if (!isLive || (match as any).matchPhase !== 'SecondInnings') return null

        const isSO = (match as any).isSuperOver;
        const mainBattedFirst = match.tossWinner === 'teamA' ? (match.electedTo === 'bat' ? 'teamA' : 'teamB') : (match.electedTo === 'bat' ? 'teamB' : 'teamA')
        const chasingTeam = isSO ? mainBattedFirst : (mainBattedFirst === 'teamA' ? 'teamB' : 'teamA')

        const batInn = isSO
            ? (chasingTeam === 'teamA' ? teamASuperInnings : teamBSuperInnings)
            : (chasingTeam === 'teamA' ? teamAInnings : teamBInnings)

        const bowlInn = isSO
            ? (chasingTeam === 'teamA' ? teamBSuperInnings : teamASuperInnings)
            : (chasingTeam === 'teamA' ? teamBInnings : teamAInnings)

        if (!bowlInn || !batInn) return null

        const target = isSO ? (match.target || (bowlInn.totalRuns || 0) + 1) : (bowlInn.totalRuns || 0) + 1
        const needed = target - (batInn.totalRuns || 0)
        if (needed <= 0) return null

        const totalBalls = isSO ? 6 : (match.oversLimit || 20) * 6
        const [oInt, balls] = (batInn.overs || '0.0').split('.').map(Number)
        const rem = totalBalls - ((oInt || 0) * 6 + (balls || 0))

        const teamName = chasingTeam === 'teamA' ? teamAName : teamBName
        return language === 'bn'
            ? `${isSO ? '⚡ ' : ''}${teamName} ${rem} বলে ${needed} রান প্রয়োজন`
            : `${isSO ? '⚡ ' : ''}${teamName} need ${needed} runs in ${rem} balls`
    })()

    const getResultText = () => {
        if (!isFinished) return null
        if ((match as any).resultSummary) return (match as any).resultSummary
        if (!teamAInnings || !teamBInnings) return t('completed')

        const aR = teamAInnings.totalRuns || 0, bR = teamBInnings.totalRuns || 0
        const aW = teamAInnings.totalWickets || 0, bW = teamBInnings.totalWickets || 0

        if (aR === bR) return t('match_tied')

        // Determine who batted first
        const battedFirst = match.tossWinner === 'teamA'
            ? (match.electedTo === 'bat' ? 'teamA' : 'teamB')
            : (match.electedTo === 'bat' ? 'teamB' : 'teamA');

        if (aR > bR) {
            // Team A won
            if (battedFirst === 'teamA') {
                return `${teamAName} ${t('won_by')} ${aR - bR} ${t('by_runs')}`
            } else {
                return `${teamAName} ${t('won_by')} ${10 - aW} ${t('by_wickets')}`
            }
        } else {
            // Team B won
            if (battedFirst === 'teamB') {
                return `${teamBName} ${t('won_by')} ${bR - aR} ${t('by_runs')}`
            } else {
                return `${teamBName} ${t('won_by')} ${10 - bW} ${t('by_wickets')}`
            }
        }
    }

    const resultText = getResultText()
    const matchDate = coerceToDate(match.date)
    const dateStr = matchDate ? matchDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }) : 'TBD'

    if (isUpcoming) {
        return (
            <Link to={`/match/${match.id}`} className="block group relative">
                <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden transition-all hover:shadow-md h-full flex flex-col relative">
                    <div className="absolute top-1 right-1 z-30">
                        <NotificationBell
                            matchId={match.id}
                            adminId={(match as any).adminId || 'default'}
                            tournamentId={match.tournamentId}
                        />
                    </div>
                    <div className="pt-3 px-4 text-center">
                        <h3 className="text-[14px] sm:text-[16px] font-semibold text-slate-800 dark:text-slate-100 tracking-tight leading-tight mb-0.5 pr-6 truncate">
                            {tournamentName || fetchedTournamentName || 'Tournament Series'}
                        </h3>
                        <div className="h-[0.5px] border-t border-dashed border-slate-300 dark:border-white/10 w-[80%] mx-auto my-1.5" />
                        <p className="text-[8px] sm:text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                            {match.oversLimit ? `${match.oversLimit === 50 ? 'ODI' : 'F' + match.oversLimit} . ` : ''}{dateStr} - {formatTimeHMTo12h(match.time)}
                        </p>
                    </div>
                    <div className="flex-1 flex items-center justify-between w-full relative overflow-hidden py-3">
                        {/* Team A - Left Professional Pod */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <div className="h-12 sm:h-14 w-14 sm:w-18 bg-slate-200 dark:bg-slate-800/50 rounded-r-full flex items-center justify-center shrink-0 border-y border-r border-slate-300 dark:border-white/10 shadow-sm relative pr-1">
                                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-r-full pointer-events-none" />
                                {teamALogo ? (
                                    <img src={teamALogo} alt={teamAName} className="w-10 h-10 sm:w-12 sm:h-12 object-contain relative z-10 transition-transform group-hover:scale-110" />
                                ) : (
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-slate-400 flex items-center justify-center text-white text-[12px] font-black uppercase relative z-10">
                                        {teamAName.charAt(0)}
                                    </div>
                                )}
                            </div>
                            <span className="text-[13px] sm:text-[15px] font-black text-slate-800 dark:text-white truncate uppercase tracking-tighter">{teamAName}</span>
                        </div>

                        {/* VS Center Badge - Premium Gold Look */}
                        <div className="shrink-0 z-20">
                            <div className="bg-slate-100 dark:bg-slate-800 w-9 h-5 sm:w-10 sm:h-6
                                shadow-lg flex items-center justify-center overflow-hidden border border-slate-200 dark:border-white/10"
                                style={{ clipPath: 'polygon(8% 0%, 92% 0%, 97% 3%, 100% 10%, 92% 90%, 88% 97%, 85% 100%, 15% 100%, 12% 97%, 8% 90%, 0% 10%, 3% 3%)' }}>
                                <img
                                    src={vsIcon}
                                    alt="VS"
                                    className="w-full h-full object-cover scale-90"
                                    style={{ filter: 'brightness(0) saturate(100%) invert(45%) sepia(80%) saturate(2500%) hue-rotate(3deg) brightness(100%) contrast(105%)' }}
                                />
                            </div>
                        </div>

                        {/* Team B - Right Professional Pod */}
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 justify-end">
                            <span className="text-[13px] sm:text-[15px] font-black text-slate-800 dark:text-white truncate uppercase tracking-tighter text-right">{teamBName}</span>
                            <div className="h-12 sm:h-14 w-14 sm:w-18 bg-slate-200 dark:bg-slate-800/50 rounded-l-full flex items-center justify-center shrink-0 border-y border-l border-slate-300 dark:border-white/10 shadow-sm relative pl-1">
                                <div className="absolute inset-0 bg-gradient-to-l from-white/20 to-transparent rounded-l-full pointer-events-none" />
                                {teamBLogo ? (
                                    <img src={teamBLogo} alt={teamBName} className="w-10 h-10 sm:w-12 sm:h-12 object-contain relative z-10 transition-transform group-hover:scale-110" />
                                ) : (
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-slate-400 flex items-center justify-center text-white text-[12px] font-black uppercase relative z-10">
                                        {teamBName.charAt(0)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="px-4 pb-2 text-center">
                        <p className="text-[8px] sm:text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">{match.venue || 'Venue TBD'}</p>
                    </div>
                    <div className="bg-[#fefce8] dark:bg-amber-950/20 py-1.5 text-center border-t border-amber-100 dark:border-white/5">
                        <p className="text-[11px] sm:text-[13px] font-semibold text-slate-800 dark:text-amber-500 uppercase flex items-center justify-center gap-2">
                            {timeLeft === 'WAITING FOR START' ? (
                                <span className="animate-pulse">WAITING FOR START</span>
                            ) : (
                                <>Starts In: <span className="tabular-nums font-black">{timeLeft}</span></>
                            )}
                        </p>
                    </div>
                </div>
            </Link>
        )
    }

    return (
        <Link to={`/match/${match.id}`} className="block group relative">
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-sm border border-slate-200 dark:border-white/5 overflow-hidden transition-all hover:shadow-md h-full flex flex-col relative">

                {/* Notifications */}
                <div className="absolute top-1 right-1 z-30">
                    <NotificationBell
                        matchId={match.id}
                        adminId={(match as any).adminId || 'default'}
                        tournamentId={match.tournamentId}
                    />
                </div>

                {/* Header: Tournament Name */}
                <div className="pt-3 px-4 text-center relative">
                    <h3 className="text-[14px] sm:text-[16px] font-semibold text-slate-800 dark:text-slate-100 tracking-tight leading-tight mb-0.5 pr-6 truncate">
                        {tournamentName || fetchedTournamentName || 'Tournament Series'}
                    </h3>
                    <div className="h-[0.5px] border-t border-dashed border-slate-300 dark:border-white/10 w-[80%] mx-auto my-1.5" />
                    <p className="text-[8px] sm:text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        {match.oversLimit ? `${match.oversLimit === 50 ? 'ODI' : 'F' + match.oversLimit} . ` : ''}{dateStr} - {formatTimeHMTo12h(match.time)}
                    </p>
                </div>

                {/* Middle: Team Showdown with Scores */}
                <div className="flex-1 flex items-center justify-between w-full relative overflow-hidden py-4">
                    {/* Team A Pod */}
                    <div className="flex items-center gap-5 flex-1 min-w-0">
                        <div className="h-12 sm:h-14 w-12 sm:w-16 bg-slate-200 dark:bg-slate-800/50 rounded-r-full flex items-center justify-center shrink-0 border-y border-r border-slate-300 dark:border-white/10 shadow-sm relative pr-1">
                            {teamALogo ? (
                                <img src={teamALogo} alt={teamAName} className="w-10 h-10 sm:w-12 sm:h-12 object-contain relative z-10 transition-transform group-hover:scale-110" />
                            ) : (
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-slate-400 flex items-center justify-center text-white text-[12px] font-black uppercase relative z-10">
                                    {teamAName.charAt(0)}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] sm:text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase truncate leading-tight">
                                {teamAName}
                            </span>
                            <div className="flex flex-col items-baseline">
                                {(match as any).isSuperOver && (
                                    <div className="flex items-center gap-1 mb-0.5">
                                        <span className="text-[20px] sm:text-[22px] font-black text-amber-600 dark:text-amber-500 tabular-nums leading-none">
                                            {teamASuperInnings ? `${teamASuperInnings.totalRuns}/${teamASuperInnings.totalWickets}` : (match.score?.teamA_super ? `${match.score.teamA_super.runs}/${match.score.teamA_super.wickets}` : '0/0')}
                                        </span>
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter leading-none">SO</span>
                                            {teamASuperInnings?.overs && (
                                                <span className="text-[8px] font-bold text-amber-600/60 leading-none">({teamASuperInnings.overs})</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <span className={((match as any).isSuperOver)
                                    ? "text-[12px] sm:text-[13px] font-bold text-slate-400 tabular-nums leading-none"
                                    : "text-[18px] sm:text-[20px] font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums leading-none drop-shadow-[0_2px_8px_rgba(16,185,129,0.15)] dark:drop-shadow-[0_2px_12px_rgba(16,185,129,0.25)]"}>
                                    {teamAInnings ? `${teamAInnings.totalRuns}/${teamAInnings.totalWickets}` : '0/0'}
                                    {teamAInnings?.overs && !((match as any).isSuperOver) && (
                                        <span className="text-[9px] font-bold text-slate-400 ml-1">({teamAInnings.overs})</span>
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Center: LIVE Badge or VS */}
                    <div className="shrink-0 flex items-center justify-center px-1">
                        {isLive ? (
                            <div className="bg-red-500/10 px-3 py-1 rounded-full flex items-center gap-1.5 border border-red-500/20 shadow-sm">
                                <div className="w-1.5 h-1.5 bg-red-600 dark:bg-red-500 rounded-full animate-pulse" />
                                <span className="text-[11px] font-black text-red-600 dark:text-red-500 tracking-tighter">LIVE</span>
                            </div>
                        ) : (
                            <div className="bg-slate-100 dark:bg-slate-800 w-9 h-5 sm:w-10 sm:h-6
                                shadow-lg flex items-center justify-center overflow-hidden border border-slate-200 dark:border-white/10"
                                style={{ clipPath: 'polygon(8% 0%, 92% 0%, 97% 3%, 100% 10%, 92% 90%, 88% 97%, 85% 100%, 15% 100%, 12% 97%, 8% 90%, 0% 10%, 3% 3%)' }}>
                                <img
                                    src={vsIcon}
                                    alt="VS"
                                    className="w-full h-full object-cover scale-90"
                                    style={{ filter: 'brightness(0) saturate(100%) invert(45%) sepia(80%) saturate(2500%) hue-rotate(3deg) brightness(100%) contrast(105%)' }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Team B Pod */}
                    <div className="flex items-center gap-5 flex-1 min-w-0 justify-end">
                        <div className="flex flex-col items-end min-w-0 text-right">
                            <span className="text-[10px] sm:text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase truncate leading-tight">
                                {teamBName}
                            </span>
                            <div className="flex flex-col items-end">
                                {(match as any).isSuperOver && (
                                    <div className="flex items-center gap-1 mb-0.5">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter leading-none">SO</span>
                                            {teamBSuperInnings?.overs && (
                                                <span className="text-[8px] font-bold text-amber-600/60 leading-none">({teamBSuperInnings.overs})</span>
                                            )}
                                        </div>
                                        <span className="text-[20px] sm:text-[22px] font-black text-amber-600 dark:text-amber-500 tabular-nums leading-none">
                                            {teamBSuperInnings ? `${teamBSuperInnings.totalRuns}/${teamBSuperInnings.totalWickets}` : (match.score?.teamB_super ? `${match.score.teamB_super.runs}/${match.score.teamB_super.wickets}` : '0/0')}
                                        </span>
                                    </div>
                                )}
                                <span className={((match as any).isSuperOver)
                                    ? "text-[12px] sm:text-[13px] font-bold text-slate-400 tabular-nums leading-none"
                                    : "text-[18px] sm:text-[20px] font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums leading-none drop-shadow-[0_2px_8px_rgba(16,185,129,0.15)] dark:drop-shadow-[0_2px_12px_rgba(16,185,129,0.25)]"}>
                                    {teamBInnings?.overs && !((match as any).isSuperOver) && (
                                        <span className="text-[9px] font-bold text-slate-400 mr-1">({teamBInnings.overs})</span>
                                    )}
                                    {teamBInnings ? `${teamBInnings.totalRuns}/${teamBInnings.totalWickets}` : '0/0'}
                                </span>
                            </div>
                        </div>
                        <div className="h-12 sm:h-14 w-12 sm:w-16 bg-slate-200 dark:bg-slate-800/50 rounded-l-full flex items-center justify-center shrink-0 border-y border-l border-slate-300 dark:border-white/10 shadow-sm relative pl-1">
                            {teamBLogo ? (
                                <img src={teamBLogo} alt={teamBName} className="w-10 h-10 sm:w-12 sm:h-12 object-contain relative z-10 transition-transform group-hover:scale-110" />
                            ) : (
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-slate-400 flex items-center justify-center text-white text-[12px] font-black uppercase relative z-10">
                                    {teamBName.charAt(0)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Venue */}
                <div className="px-4 pb-2 text-center">
                    <p className="text-[8px] sm:text-[9px] font-black text-slate-500 dark:text-slate-500 uppercase tracking-widest">{match.venue || 'Venue TBD'}</p>
                </div>

                {/* Footer Section: Dynamic Status */}
                <div className={`py-1.5 text-center border-t ${isUpcoming ? 'bg-[#fefce8] dark:bg-amber-950/20 border-amber-100' :
                    'bg-amber-50/50 dark:bg-amber-900/10 border-amber-100/50'
                    } dark:border-white/5`}>
                    <p className={`text-[10px] sm:text-[11px] font-semibold uppercase px-4 truncate transition-colors ${isUpcoming ? 'text-slate-800 dark:text-amber-500' :
                        'text-amber-700 dark:text-amber-500'
                        }`}>
                        {isUpcoming ? (
                            timeLeft === 'WAITING FOR START' ? (
                                <span className="animate-pulse">WAITING FOR START</span>
                            ) : (
                                <>Starts In: <span className="tabular-nums font-black">{timeLeft}</span></>
                            )
                        ) : isLive ? (
                            <span className="font-black flex items-center justify-center gap-1">
                                {runsNeededText ? (
                                    runsNeededText
                                ) : (match as any).matchPhase === 'Tied' ? (
                                    <span className="animate-pulse">⚡ Match Tied!</span>
                                ) : (match as any).isSuperOver ? (
                                    <>⚡ SUPER OVER</>
                                ) : tossInfo ? (
                                    <>
                                        {tossInfo.winnerName} won the toss and choose to {tossInfo.decision === 'bat' ? 'bat' : 'bowl'}
                                    </>
                                ) : 'Innings Break'}
                            </span>
                        ) : (
                            <span className="font-black">{resultText || 'Match Finished'}</span>
                        )}
                    </p>
                </div>
            </div>
        </Link>
    )
}

export default MatchCard
