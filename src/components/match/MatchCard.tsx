import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Match, Squad, InningsStats } from '@/types'
import { matchService } from '@/services/firestore/matches'
import { tournamentService } from '@/services/firestore/tournaments'
import { coerceToDate, formatTimeHMTo12h } from '@/utils/date'
import { formatShortTeamName } from '@/utils/teamName'
import { formatKnockoutTitle } from '@/utils/matchFormatters'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { useTranslation } from '@/hooks/useTranslation'
import vsIcon from '@/assets/vs.png'

interface MatchCardProps {
    match: Match
    squadsMap: Record<string, Squad>
    tournamentName?: string
}



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
            const d = Math.floor(totalSecs / 86400)
            const h = Math.floor((totalSecs % 86400) / 3600)
            const m = Math.floor((totalSecs % 3600) / 60)
            const s = totalSecs % 60

            let timeStr = "";
            if (d > 0) timeStr += `${d}D : `;
            timeStr += `${String(h).padStart(2, '0')}H : ${String(m).padStart(2, '0')}M : ${String(s).padStart(2, '0')}S`;
            setTimeLeft(timeStr);
        }
        updateCountdown(); const timer = setInterval(updateCountdown, 1000)
        return () => clearInterval(timer)
    }, [match.date, match.time, isUpcoming])

    const teamA = squadsMap[match.teamAId]
    const teamB = squadsMap[match.teamBId]
    const teamAName = teamA ? formatShortTeamName(teamA.name) : formatShortTeamName(match.teamAName || 'Team A')
    const teamBName = teamB ? formatShortTeamName(teamB.name) : formatShortTeamName(match.teamBName || 'Team B')
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
        if ((match as any).resultSummary) return (match as any).resultSummary
        if (!teamAInnings || !teamBInnings) return t('completed')

        const aR = teamAInnings.totalRuns || 0, bR = teamBInnings.totalRuns || 0
        const aW = teamAInnings.totalWickets || 0, bW = teamBInnings.totalWickets || 0

        // Determine Main Match Batting Order
        const mainBattedFirst = match.tossWinner === 'teamA'
            ? (match.electedTo === 'bat' ? 'teamA' : 'teamB')
            : (match.electedTo === 'bat' ? 'teamB' : 'teamA');
        const mainBattedSecond = mainBattedFirst === 'teamA' ? 'teamB' : 'teamA';

        // Handle Super Over Result
        if (aR === bR && teamASuperInnings && teamBSuperInnings) {
            const soA = teamASuperInnings.totalRuns || 0
            const soB = teamBSuperInnings.totalRuns || 0
            const soAW = teamASuperInnings.totalWickets || 0
            const soBW = teamBSuperInnings.totalWickets || 0

            // In SO, the team that batted second in main match typically bats first
            const soBattedFirst = mainBattedSecond;

            if (soA === soB) return t('match_tied') + ' (Super Over)'

            const winnerSide = soA > soB ? 'teamA' : 'teamB';
            const winnerName = winnerSide === 'teamA' ? teamAName : teamBName;

            if (winnerSide === soBattedFirst) {
                // Team batting first in SO won -> Wins by RUNS
                const margin = Math.abs(soA - soB);
                return `${winnerName} ${t('won_by')} ${margin} ${t('by_runs')} (Super Over)`
            } else {
                // Team batting second in SO won -> Wins by WICKETS
                const winnerWickets = winnerSide === 'teamA' ? soAW : soBW;
                const margin = 2 - winnerWickets; // Super Over limit is usually 2 wickets
                return `${winnerName} ${t('won_by')} ${margin} ${t('by_wickets')} (Super Over)`
            }
        }

        if (aR === bR) return t('match_tied')

        const winnerSide = aR > bR ? 'teamA' : 'teamB';
        const winnerName = winnerSide === 'teamA' ? teamAName : teamBName;

        if (winnerSide === mainBattedFirst) {
            // Batting first won -> Wins by RUNS
            return `${winnerName} ${t('won_by')} ${Math.abs(aR - bR)} ${t('by_runs')}`
        } else {
            // Batting second won -> Wins by WICKETS
            const winnerWickets = winnerSide === 'teamA' ? aW : bW;
            return `${winnerName} ${t('won_by')} ${10 - winnerWickets} ${t('by_wickets')}`
        }
    }

    const resultText = getResultText()
    const matchDate = coerceToDate(match.date)
    const dateStr = matchDate ? matchDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' }) : 'TBD'
    const knockoutTitle = formatKnockoutTitle(match)
    const getDisplayHeader = () => {
        const tName = tournamentName || fetchedTournamentName
        if (knockoutTitle) return `${knockoutTitle} • ${tName || t('friendly_match')}`
        return tName || t('friendly_match')
    }
    const displayHeader = getDisplayHeader()

    return (
        <Link to={`/match/${match.id}`} className="block group relative h-full">
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-sm border border-slate-200/60 dark:border-white/[0.05] overflow-hidden transition-all duration-500 hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] hover:-translate-y-1 h-full flex flex-col relative">
                {/* Subtle Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                {/* Notifications & Top Actions */}
                {!isFinished && (
                    <div className="absolute top-2 right-2 z-30">
                        <NotificationBell matchId={match.id} tournamentId={match.tournamentId} />
                    </div>
                )}

                {/* Header: Tournament & Info */}
                <div className="pt-4 px-4 text-center">
                    <h3 className="text-[12px] sm:text-[14px] font-medium text-slate-800 dark:text-slate-100 tracking-tight leading-tight mb-2 pr-8 truncate">
                        {displayHeader}
                    </h3>

                    {/* Dashed Separator */}
                    <div className="border-t border-dashed border-slate-200 dark:border-white/10 my-2 w-[85%] mx-auto" />

                    <p className="text-[9px] font-normal text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center justify-center gap-1.5 mb-2">
                        {match.oversLimit ? <span>F{match.oversLimit}</span> : null}
                        <span>.</span>
                        <span>{dateStr}</span>
                        <span>-</span>
                        <span>{formatTimeHMTo12h(match.time)}</span>
                    </p>
                </div>

                {/* Main Content: Teams & Scores */}
                <div className="flex-1 flex items-center justify-between w-full px-4 py-4">
                    {/* Team A Pod */}
                    <div className="flex items-center gap-3 flex-1 min-w-0 relative">
                        {/* Decorative Tail Background (Team A) - Balanced Length */}
                        <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-14 h-14 bg-gradient-to-r from-indigo-500/20 via-purple-500/10 to-transparent dark:from-indigo-500/30 dark:via-purple-500/15 dark:to-transparent rounded-r-full border-y border-r border-indigo-200/50 dark:border-indigo-500/20 pointer-events-none shadow-[0_2px_8px_rgba(99,102,241,0.1)]" />

                        <div className="relative shrink-0 flex items-center z-10 -ml-3.5">
                            {/* Logo Wrapper (No Circle BG, just shadow for premium feel) */}
                            <div className="h-12 w-12 flex items-center justify-center shrink-0 transition-transform group-hover:scale-115 duration-500 drop-shadow-[0_4px_6px_rgba(0,0,0,0.15)]">
                                {teamALogo ? (
                                    <img src={teamALogo} alt={teamAName} className="w-full h-full object-contain" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-[10px] font-medium uppercase shadow-sm">
                                        {teamAName.charAt(0)}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col min-w-0 z-10">
                            <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200 uppercase truncate">
                                {teamAName}
                            </span>
                            {!isUpcoming && (
                                <div className="flex flex-col items-start gap-0.5">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-[18px] font-semibold text-emerald-600 dark:text-emerald-500 tabular-nums">
                                            {teamAInnings ? `${teamAInnings.totalRuns}/${teamAInnings.totalWickets}` : '0/0'}
                                        </span>
                                        {teamAInnings?.overs && (
                                            <span className="text-[9px] font-normal text-slate-400 tabular-nums lowercase">
                                                ({teamAInnings.overs})
                                            </span>
                                        )}
                                    </div>
                                    {teamASuperInnings && teamBSuperInnings && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 dark:bg-amber-500/20 rounded-md border border-amber-500/20">
                                            <span className="text-[8px] font-semibold text-amber-600 dark:text-amber-500 uppercase tracking-tighter">SO</span>
                                            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                                                {teamASuperInnings.totalRuns}/{teamASuperInnings.totalWickets}
                                            </span>
                                            <span className="text-[7px] font-normal text-slate-400 tabular-nums lowercase">({teamASuperInnings.overs})</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Center: VS or LIVE Badge */}
                    <div className="shrink-0 px-1">
                        {isLive ? (
                            <div className="bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-100 shadow-sm">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-[9px] font-semibold text-red-600 tracking-widest uppercase">Live</span>
                            </div>
                        ) : (
                            <div className="relative shrink-0 flex items-center justify-center w-10 h-5">
                                {/* Rounded Trapezoid Background - Dark Mode Refined */}
                                <svg viewBox="0 0 100 60" className="absolute inset-0 w-full h-full drop-shadow-[0_2px_6px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_0_8px_rgba(30,41,59,0.5)] transition-all overflow-visible">
                                    <path
                                        d="M 10 2 H 90 C 96 2 98 4 96 9 L 85 51 C 83 56 78 60 70 60 H 30 C 22 60 17 56 15 51 L 4 9 C 2 4 4 2 10 2 Z"
                                        className="fill-slate-200 dark:fill-[#1e293b] stroke-slate-300 dark:stroke-white/10 stroke-1 transition-colors"
                                    />
                                </svg>

                                {/* The VS Icon - Forced Deep Orange via SVG Filters */}
                                <img
                                    src={vsIcon}
                                    alt="VS"
                                    className="relative z-10 w-8 h-8 object-contain translate-y-[-0.5px] drop-shadow-[0_2px_8px_rgba(249,115,22,0.4)]"
                                    style={{
                                        filter: 'invert(53%) sepia(93%) saturate(2855%) hue-rotate(346deg) brightness(101%) contrast(106%)'
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Team B Pod */}
                    <div className="flex items-center gap-3 flex-1 min-w-0 justify-end text-right relative">
                        <div className="flex flex-col items-end min-w-0 z-10">
                            <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200 uppercase truncate">
                                {teamBName}
                            </span>
                            {!isUpcoming && (
                                <div className="flex flex-col items-end gap-0.5 min-w-0">
                                    <div className="flex items-baseline gap-1 justify-end">
                                        {teamBInnings?.overs && (
                                            <span className="text-[9px] font-normal text-slate-400 tabular-nums lowercase">
                                                ({teamBInnings.overs})
                                            </span>
                                        )}
                                        <span className="text-[18px] font-semibold text-emerald-600 dark:text-emerald-500 tabular-nums">
                                            {teamBInnings ? `${teamBInnings.totalRuns}/${teamBInnings.totalWickets}` : '0/0'}
                                        </span>
                                    </div>
                                    {teamASuperInnings && teamBSuperInnings && (
                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 dark:bg-amber-500/20 rounded-md border border-amber-500/20">
                                            <span className="text-[7px] font-normal text-slate-400 tabular-nums lowercase">({teamBSuperInnings.overs})</span>
                                            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                                                {teamBSuperInnings.totalRuns}/{teamBSuperInnings.totalWickets}
                                            </span>
                                            <span className="text-[8px] font-semibold text-amber-600 dark:text-amber-500 uppercase tracking-tighter">SO</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Decorative Tail Background (Team B) - Balanced Length */}
                        <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-14 h-14 bg-gradient-to-l from-indigo-500/20 via-purple-500/10 to-transparent dark:from-indigo-500/30 dark:via-purple-500/15 dark:to-transparent rounded-l-full border-y border-l border-indigo-200/50 dark:border-indigo-500/20 pointer-events-none shadow-[0_2px_8px_rgba(99,102,241,0.1)]" />

                        <div className="relative shrink-0 flex items-center z-10 -mr-3.5">
                            {/* Logo Wrapper (No Circle BG) */}
                            <div className="h-12 w-12 flex items-center justify-center shrink-0 transition-transform group-hover:scale-115 duration-500 drop-shadow-[0_4px_6px_rgba(0,0,0,0.15)]">
                                {teamBLogo ? (
                                    <img src={teamBLogo} alt={teamBName} className="w-full h-full object-contain" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 text-[10px] font-medium uppercase shadow-sm">
                                        {teamBName.charAt(0)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="text-center pb-2">
                    <p className="text-[9px] font-normal text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        {match.venue || 'SMA Home Ground'}
                    </p>
                </div>

                {/* Footer Status Bar - Compressed & Refined colors */}
                <div className={`mt-auto py-3 px-4 text-center border-t border-slate-100 dark:border-white/5 transition-colors ${isUpcoming ? 'bg-gradient-to-r from-blue-600/10 via-blue-500/5 to-blue-600/10 dark:from-blue-500/15 dark:via-blue-500/5 dark:to-blue-500/15 shadow-[inner_0_2px_8px_rgba(37,99,235,0.08)]' :
                    isLive ? 'bg-orange-50/40 dark:bg-orange-500/5' :
                        'bg-emerald-50/30 dark:bg-emerald-500/5'
                    }`}>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.1em] flex items-center justify-center gap-2.5 ${isUpcoming ? 'text-blue-700 dark:text-blue-400' :
                        isLive ? 'text-orange-600' :
                            'text-emerald-700'
                        }`}>
                        {isUpcoming ? (
                            <>
                                <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
                                {tossInfo ? `${tossInfo.winnerName} won the toss & chose to ${tossInfo.decision}` : (timeLeft || 'Waiting for start')}
                            </>
                        ) : isLive ? (
                            <>
                                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                                {runsNeededText || (match as any).matchPhase === 'Tied' ? 'Match Tied!' : tossInfo ? `${tossInfo.winnerName} won the toss & choose to ${tossInfo.decision}` : 'Live Action'}
                            </>
                        ) : (
                            <>
                                🏆 {resultText || 'Match Finished'}
                            </>
                        )}
                    </p>
                </div>
            </div>
        </Link>
    )
}

export default React.memo(MatchCard)
