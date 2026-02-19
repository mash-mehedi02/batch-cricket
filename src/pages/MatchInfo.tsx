/**
 * Match Info Page
 * Display comprehensive match information from Firebase
 */

import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { tournamentService } from '@/services/firestore/tournaments'
import { squadService } from '@/services/firestore/squads'
import { Match, Tournament } from '@/types'
import { formatShortTeamName } from '@/utils/teamName'
import { coerceToDate, formatTimeLabel, formatTimeHMTo12h } from '@/utils/date'
import { Calendar, MapPin, ChevronRight, ChevronDown, Info, Zap, Hash, X } from 'lucide-react'
import MatchPlayingXI from './MatchPlayingXI'

interface MatchInfoProps {
    compact?: boolean
    onSwitchTab?: (tab: string) => void
}

export default function MatchInfo({ compact = false, onSwitchTab }: MatchInfoProps) {
    const { matchId } = useParams<{ matchId: string }>()
    const navigate = useNavigate()
    const [match, setMatch] = useState<Match | null>(null)
    const [tournament, setTournament] = useState<Tournament | null>(null)
    const [teamASquad, setTeamASquad] = useState<any>(null)
    const [teamBSquad, setTeamBSquad] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [headToHead, setHeadToHead] = useState<{ total: number, teamA: number, teamB: number, tie: number, recentMatches: any[] }>({ total: 0, teamA: 0, teamB: 0, tie: 0, recentMatches: [] })
    const [teamAForm, setTeamAForm] = useState<any[]>([])
    const [teamBForm, setTeamBForm] = useState<any[]>([])
    const [expandedTeamIdx, setExpandedTeamIdx] = useState<number | null>(null)
    const [showPlayingXIModal, setShowPlayingXIModal] = useState(false)

    useEffect(() => {
        if (!matchId) return

        // Load match
        matchService.getById(matchId).then((matchData) => {
            if (matchData) {
                setMatch(matchData)
            } else {
                setLoading(false)
            }
        }).catch((error) => {
            console.error('Error loading match:', error)
            setLoading(false)
        })

        // Subscribe to match updates
        const unsubscribe = matchService.subscribeToMatch(matchId, (matchData) => {
            if (matchData) {
                setMatch(matchData)
                setLoading(false)
            }
        })

        return () => unsubscribe()
    }, [matchId])

    // Load tournament and squads
    useEffect(() => {
        if (!match) return

        const loadRelatedData = async () => {
            try {
                // 1. Load tournament
                if (match.tournamentId) {
                    const tournamentData = await tournamentService.getById(match.tournamentId)
                    if (tournamentData) setTournament(tournamentData)
                }

                // 2. Load all squads for name matching
                const allSquads = await squadService.getAll()
                const squadsMap = new Map<string, any>()
                allSquads.forEach(s => squadsMap.set(s.id, s))

                const normalize = (s: string) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')

                const teamANameRaw = (match.teamAName || (match as any).teamA || '').trim()
                const teamBNameRaw = (match.teamBName || (match as any).teamB || '').trim()
                const teamANameNorm = normalize(teamANameRaw)
                const teamBNameNorm = normalize(teamBNameRaw)

                const curSquadA = allSquads.find(s =>
                    s.id === (match.teamAId || (match as any).teamASquadId || (match as any).teamA) ||
                    normalize(s.name) === teamANameNorm
                )
                const curSquadB = allSquads.find(s =>
                    s.id === (match.teamBId || (match as any).teamBSquadId || (match as any).teamB) ||
                    normalize(s.name) === teamBNameNorm
                )

                if (curSquadA) setTeamASquad(curSquadA)
                if (curSquadB) setTeamBSquad(curSquadB)

                const squadIdA = curSquadA?.id
                const squadIdB = curSquadB?.id

                // 3. Fetch matches and filter robustly
                const allMatches = await matchService.getAll()
                const filteredMatches = allMatches.filter(m => m.id !== matchId)

                const involvesTeam = (m: Match, targetId?: string, targetNameNorm?: string) => {
                    if (targetId && (m.teamAId === targetId || m.teamBId === targetId || (m as any).teamASquadId === targetId || (m as any).teamBSquadId === targetId)) return true
                    if (targetNameNorm) {
                        const mA = normalize(m.teamAName || (m as any).teamA)
                        const mB = normalize(m.teamBName || (m as any).teamB)
                        if (mA === targetNameNorm || mB === targetNameNorm) return true
                    }
                    return false
                }

                const matchesInvolvingA = filteredMatches.filter(m => involvesTeam(m, squadIdA, teamANameNorm))
                const matchesInvolvingB = filteredMatches.filter(m => involvesTeam(m, squadIdB, teamBNameNorm))

                // 1. Head to Head
                const commonMatches = matchesInvolvingA.filter(m =>
                    (m.status?.toLowerCase() === 'finished' || m.status?.toLowerCase() === 'completed') &&
                    involvesTeam(m, squadIdB, teamBNameNorm)
                ).sort((a, b) => (coerceToDate((b as any).date)?.getTime() || 0) - (coerceToDate((a as any).date)?.getTime() || 0))

                const h2hCount = { teamA: 0, teamB: 0, tie: 0 }
                // Enrich items for H2H cards with result codes
                const enrichedH2H = await Promise.all(
                    commonMatches.slice(0, 5).map(async (m) => {
                        const [innA, innB, soA, soB] = await Promise.all([
                            matchService.getInnings(m.id, 'teamA').catch(() => null),
                            matchService.getInnings(m.id, 'teamB').catch(() => null),
                            matchService.getInnings(m.id, 'teamA_super').catch(() => null),
                            matchService.getInnings(m.id, 'teamB_super').catch(() => null)
                        ])

                        const m2 = m as any;
                        const winnerId = m2.winnerId || m2.winnerSquadId;
                        const winnerTextRaw = m2.winnerName || m2.winner || m2.winningTeam || m2.winnerSquadName || '';
                        const winnerNorm = normalize(winnerTextRaw);

                        const isTie = winnerNorm === 'tie' || winnerNorm === 'draw' || winnerId === 'Tie' || winnerId === 'Draw' ||
                            m2.status?.toLowerCase() === 'abandoned' || m2.resultSummary?.toLowerCase().includes('no result');

                        let res: 'W' | 'L' | 'T' = 'T'
                        if (isTie) {
                            h2hCount.tie++;
                            res = 'T'
                        } else {
                            // 1. Try to decide by explicit winnerId
                            const isWinA = (squadIdA && (winnerId === squadIdA || normalize(winnerId) === squadIdA.toLowerCase())) ||
                                (teamANameNorm && winnerNorm === teamANameNorm);
                            const isWinB = (squadIdB && (winnerId === squadIdB || normalize(winnerId) === squadIdB.toLowerCase())) ||
                                (teamBNameNorm && winnerNorm === teamBNameNorm);

                            if (isWinA) {
                                h2hCount.teamA++;
                                res = 'W';
                            } else if (isWinB) {
                                h2hCount.teamB++;
                                res = 'L';
                            } else if (innA && innB) {
                                // 2. Fallback to scores
                                const runsA = (innA as any).totalRuns || 0;
                                const runsB = (innB as any).totalRuns || 0;
                                const sRunsA = (soA as any)?.totalRuns || 0;
                                const sRunsB = (soB as any)?.totalRuns || 0;

                                const mAId = m.teamAId || (m as any).teamASquadId;
                                const mANorm = normalize(m.teamAName || (m as any).teamA);
                                const isTeamASideInMatch = (squadIdA && mAId === squadIdA) || (teamANameNorm && mANorm === teamANameNorm);

                                let teamAActuallyWon = false;
                                let isActuallyTieInMatch = false;

                                if (runsA > runsB) teamAActuallyWon = true;
                                else if (runsB > runsA) teamAActuallyWon = false;
                                else if (sRunsA > sRunsB) teamAActuallyWon = true;
                                else if (sRunsB > sRunsA) teamAActuallyWon = false;
                                else isActuallyTieInMatch = true;

                                if (isActuallyTieInMatch) {
                                    h2hCount.tie++;
                                    res = 'T';
                                } else {
                                    const winForTargetA = isTeamASideInMatch ? teamAActuallyWon : !teamAActuallyWon;
                                    if (winForTargetA) {
                                        h2hCount.teamA++;
                                        res = 'W';
                                    } else {
                                        h2hCount.teamB++;
                                        res = 'L';
                                    }
                                }
                            } else {
                                // Fallback: try matching name directly from squad objects if available
                                const winnerName = winnerTextRaw.toLowerCase();
                                if (curSquadA?.name && winnerName.includes(curSquadA.name.toLowerCase())) {
                                    h2hCount.teamA++;
                                    res = 'W';
                                } else if (curSquadB?.name && winnerName.includes(curSquadB.name.toLowerCase())) {
                                    h2hCount.teamB++;
                                    res = 'L';
                                } else {
                                    h2hCount.tie++; // Still can't decide? Treat as T
                                    res = 'T';
                                }
                            }
                        }

                        return { ...m, innA, innB, resCode: res }
                    })
                )

                setHeadToHead({
                    total: commonMatches.length,
                    teamA: h2hCount.teamA,
                    teamB: h2hCount.teamB,
                    tie: h2hCount.tie,
                    recentMatches: enrichedH2H
                })

                // 2. Form (Last 5)
                const enrichFormMatches = async (matches: any[], targetId?: string, targetNameNorm?: string) => {
                    const sorted = matches
                        .filter(m => m.status?.toLowerCase() === 'finished' || m.status?.toLowerCase() === 'completed' || m.status?.toLowerCase() === 'abandoned')
                        .sort((a, b) => (coerceToDate((b as any).date)?.getTime() || 0) - (coerceToDate((a as any).date)?.getTime() || 0))
                        .slice(0, 5)

                    return await Promise.all(sorted.map(async (m) => {
                        const [innA, innB, soA, soB] = await Promise.all([
                            matchService.getInnings(m.id, 'teamA').catch(() => null),
                            matchService.getInnings(m.id, 'teamB').catch(() => null),
                            matchService.getInnings(m.id, 'teamA_super').catch(() => null),
                            matchService.getInnings(m.id, 'teamB_super').catch(() => null)
                        ])

                        const m2 = m as any;
                        const winnerId = m2.winnerId || m2.winnerSquadId;
                        const winnerTextRaw = m2.winnerName || m2.winner || m2.winningTeam || m2.winnerSquadName || '';
                        const winnerNorm = normalize(winnerTextRaw);

                        const isTie = winnerNorm === 'tie' || winnerNorm === 'draw' || winnerId === 'Tie' || winnerId === 'Draw' ||
                            m2.status?.toLowerCase() === 'abandoned' || m2.resultSummary?.toLowerCase().includes('no result');

                        let res: 'W' | 'L' | 'T' = 'T'
                        if (!isTie) {
                            // 1. Check explicit winner fields
                            const isWinnerMe = (targetId && (winnerId === targetId || normalize(winnerId) === targetId.toLowerCase())) ||
                                (targetNameNorm && winnerNorm === targetNameNorm);

                            if (isWinnerMe) {
                                res = 'W';
                            } else if (winnerId || winnerNorm) {
                                // Some winner is set, but it's not me
                                if (normalize(winnerId) === 'tie' || winnerNorm === 'tie') res = 'T';
                                else res = 'L';
                            } else if (innA && innB) {
                                // 2. Fallback to scores
                                const runsA = innA.totalRuns || 0;
                                const runsB = innB.totalRuns || 0;
                                const soRunsA = (soA as any)?.totalRuns || 0;
                                const soRunsB = (soB as any)?.totalRuns || 0;

                                // Need to know if I am Team A or Team B in THIS match
                                const mAId = m.teamAId || (m as any).teamASquadId;
                                const mANorm = normalize(m.teamAName || (m as any).teamA);
                                const isTeamA = (targetId && mAId === targetId) || (targetNameNorm && mANorm === targetNameNorm);

                                let teamAActuallyWon = false;
                                let isActuallyTie = false;

                                if (runsA > runsB) teamAActuallyWon = true;
                                else if (runsB > runsA) teamAActuallyWon = false;
                                else if (soRunsA > soRunsB) teamAActuallyWon = true;
                                else if (soRunsB > soRunsA) teamAActuallyWon = false;
                                else isActuallyTie = true;

                                if (isActuallyTie) {
                                    res = 'T';
                                } else {
                                    const winForMe = isTeamA ? teamAActuallyWon : !teamAActuallyWon;
                                    res = winForMe ? 'W' : 'L';
                                }
                            }
                        }

                        return { ...m, innA, innB, formResult: res }
                    }))
                }

                const formA = await enrichFormMatches(matchesInvolvingA, squadIdA, teamANameNorm)
                const formB = await enrichFormMatches(matchesInvolvingB, squadIdB, teamBNameNorm)
                setTeamAForm(formA)
                setTeamBForm(formB)

            } catch (error) {
                console.error('Error loading related data:', error)
            }
        }

        loadRelatedData()
    }, [match, matchId])

    if (loading) {
        return (
            <div className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${compact ? 'py-4' : 'py-12'} animate-pulse`}>
                <div className="bg-white dark:bg-[#0f172a] rounded-2xl shadow-sm p-8 border border-slate-200 dark:border-white/5 space-y-6">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="bg-slate-50 dark:bg-white/5 rounded-xl p-6">
                            <div className="h-4 bg-slate-100 dark:bg-white/10 rounded w-24 mb-3"></div>
                            <div className="h-6 bg-slate-100 dark:bg-white/10 rounded w-48"></div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (!match) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-[#060b16] flex items-center justify-center">
                <div className="text-center">
                    <p className="text-slate-500 text-lg mb-4">Match not found</p>
                </div>
            </div>
        )
    }

    const teamAName = match.teamAName || teamASquad?.name || (match as any).teamA || 'Team A'
    const teamBName = match.teamBName || teamBSquad?.name || (match as any).teamB || 'Team B'

    // Handle date
    const matchDate = coerceToDate((match as any).date)
    const rawTime = String((match as any).time || '').trim()
    const timeText = rawTime
        ? (rawTime.match(/^\d{1,2}:\d{2}$/) ? formatTimeHMTo12h(rawTime) : rawTime)
        : (matchDate ? formatTimeLabel(matchDate) : '')

    const hasAnyXI = (match.teamAPlayingXI?.length || 0) > 0 || (match.teamBPlayingXI?.length || 0) > 0
    const xiTitle = hasAnyXI ? 'Playing XI' : 'Squad'



    const tossMessage = (match.tossWinner || (match as any).tossWinner) ? (() => {
        const m2 = match as any;
        const tw = m2.tossWinner;
        const tAId = String(m2.teamAId || m2.teamASquadId || m2.teamA || '').trim().toLowerCase();
        const tBId = String(m2.teamBId || m2.teamBSquadId || m2.teamB || '').trim().toLowerCase();
        const twid = String(tw || '').trim().toLowerCase();

        const winnerName = (twid === 'teama' || (tAId && twid === tAId)) ? teamAName : (twid === 'teamb' || (tBId && twid === tBId)) ? teamBName : (tw || 'Team');
        const decision = (match.electedTo || (match as any).tossDecision || 'bat').toLowerCase();
        return `${winnerName} won the toss and chose to ${decision}`;
    })() : null;

    return (
        <div className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${compact ? 'py-4' : 'py-12'} space-y-6 pb-24 bg-slate-50 dark:bg-[#060b16] text-slate-900 dark:text-white`}>

            {/* 1. Toss Message */}
            {tossMessage && (
                <div className="text-[#a66a00] text-[13px] font-black px-1 italic flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#a66a00] animate-pulse"></div>
                    {tossMessage}
                </div>
            )}

            {/* 2. Brand/Series Card */}
            <div
                className="bg-white dark:bg-[#0f172a] rounded-2xl p-4 border border-slate-200 dark:border-white/5 shadow-sm flex items-center justify-between group cursor-pointer hover:border-blue-500/30 transition-colors"
                onClick={() => navigate(tournament?.id ? `/tournaments/${tournament.id}` : '/tournaments')}
            >
                <div className="space-y-1">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.1em]">
                        {(match as any).stage === 'knockout'
                            ? `Knockout (${String((match as any).round || '').replace('_', ' ')})`
                            : (match as any).matchNo || 'T20 Match'}
                    </div>
                    <div className="text-[15px] font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {tournament?.name || 'Local Tournament'}
                        <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center p-2 shadow-inner">
                    {tournament?.logoUrl ? <img src={tournament.logoUrl} className="w-full h-full object-contain" /> : <Info className="w-6 h-6 text-slate-300 dark:text-white/10" />}
                </div>
            </div>

            {/* 3. Match Metadata */}
            <div className="bg-white dark:bg-[#0f172a] rounded-2xl p-4 border border-slate-200 dark:border-white/5 shadow-sm space-y-4">
                <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 font-semibold">
                    <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-white/[0.03] flex items-center justify-center border border-slate-200 dark:border-white/5">
                        <Calendar className="w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                    </div>
                    <span>{matchDate ? matchDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }) : 'TBA'} • {timeText}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-sm text-slate-600 dark:text-slate-400 font-semibold group cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-white/[0.03] flex items-center justify-center border border-slate-200 dark:border-white/5">
                            <MapPin className="w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                        </div>
                        <span className="text-blue-600 dark:text-blue-400 group-hover:underline">{match.venue || 'SMA Home Ground'}</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                </div>
                {/* Match Stage, Overs & Number */}
                <div className="flex items-center gap-6 pt-2 border-t border-slate-100 dark:border-white/5 overflow-x-auto no-scrollbar">
                    {/* Stage */}
                    <div className="flex items-center gap-3 text-sm font-semibold shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <Info className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stage</span>
                            <span className="text-blue-600 dark:text-blue-400 font-black text-[13px] tracking-tight uppercase whitespace-nowrap">
                                {(match as any).stage === 'knockout'
                                    ? String((match as any).round || '').replace('_', ' ')
                                    : (match as any).matchNo ? `Match ${(match as any).matchNo}` : (match as any).groupName ? `${(match as any).groupName} Group` : (match as any).stage || 'Match'}
                            </span>
                        </div>
                    </div>

                    {/* Overs */}
                    <div className="flex items-center gap-3 text-sm font-semibold pl-6 border-l border-slate-100 dark:border-white/5 shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                            <Zap className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Format</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-black text-base tracking-tight uppercase">
                                {match.oversLimit || 20} Overs
                            </span>
                        </div>
                    </div>

                    {/* Match No */}
                    {(match as any).matchNo && (
                        <div className="flex items-center gap-3 text-sm font-semibold pl-6 border-l border-slate-100 dark:border-white/5 shrink-0">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <Hash className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Match</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-black text-base tracking-tight uppercase">
                                    {(match as any).matchNo}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 4. Squad / Playing XI Section */}
            <div className="space-y-3">
                <h3 className="text-[13px] font-black text-slate-900 dark:text-slate-100 px-1 uppercase tracking-wide">{xiTitle}</h3>
                <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
                    <div className="flex items-center justify-between p-4 group cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors" onClick={() => setShowPlayingXIModal(true)}>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#060b16] border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden flex items-center justify-center p-1.5">
                                {teamASquad?.logoUrl ? <img src={teamASquad.logoUrl} className="w-full h-full object-contain" /> : <span className="text-sm font-black text-slate-400 dark:text-white/10">{teamAName[0]}</span>}
                            </div>
                            <span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{formatShortTeamName(teamAName)}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="flex items-center justify-between p-4 group cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors" onClick={() => setShowPlayingXIModal(true)}>
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#060b16] border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden flex items-center justify-center p-1.5">
                                {teamBSquad?.logoUrl ? <img src={teamBSquad.logoUrl} className="w-full h-full object-contain" /> : <span className="text-sm font-black text-slate-400 dark:text-white/10">{teamBName[0]}</span>}
                            </div>
                            <span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">{formatShortTeamName(teamBName)}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </div>

            {/* 6. Team Form */}
            <div className="space-y-3 pt-2">
                <h3 className="text-[13px] font-black text-slate-900 dark:text-slate-100 px-1 uppercase tracking-wide">Team form <span className="text-[11px] font-bold text-slate-500 normal-case">(Last 5 matches)</span></h3>
                <div className="bg-white dark:bg-[#0f172a] rounded-2xl p-2 sm:p-5 border border-slate-200 dark:border-white/5 shadow-sm space-y-2 sm:space-y-4">
                    {[
                        { name: teamAName, short: (match as any).teamAShort || formatShortTeamName(teamAName), squad: teamASquad, form: teamAForm },
                        { name: teamBName, short: (match as any).teamBShort || formatShortTeamName(teamBName), squad: teamBSquad, form: teamBForm }
                    ].map((row, idx) => {
                        const isExpanded = expandedTeamIdx === idx;

                        return (
                            <div key={idx} className="space-y-3">
                                <div
                                    className={`flex items-center justify-between gap-4 p-3 rounded-xl cursor-pointer transition-all ${isExpanded ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03] border border-transparent'}`}
                                    onClick={() => setExpandedTeamIdx(isExpanded ? null : idx)}
                                >
                                    {/* Logo */}
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#060b16] border border-slate-200 dark:border-white/5 flex items-center justify-center overflow-hidden p-1.5 shadow-sm shrink-0">
                                        {row.squad?.logoUrl ? <img src={row.squad.logoUrl} className="w-full h-full object-contain" /> : <span className="text-sm font-black text-slate-400 dark:text-white/10">{row.name[0]}</span>}
                                    </div>

                                    {/* Name */}
                                    <span className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase truncate tracking-tight flex-1 min-w-0">{formatShortTeamName(row.name)}</span>

                                    {/* Badges + Chevron */}
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-1">
                                            {(row.form.length ? row.form : Array.from({ length: 5 }).map(() => ({ formResult: '*' }))).slice(0, 5).map((r: any, i) => (
                                                <div key={i} className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-black shadow-sm transition-all
                                                      ${r.formResult === 'W' ? 'bg-[#10b981] text-white' :
                                                        r.formResult === 'L' ? 'bg-[#f43f5e] text-white' :
                                                            r.formResult === 'T' ? 'bg-[#94a3b8] text-white' :
                                                                'bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-white/10'}`}>
                                                    <span className="leading-none">{r.formResult === '*' ? '·' : r.formResult}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="w-8 h-8 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors shrink-0">
                                            <ChevronDown size={14} className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''}`} />
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded form matches */}
                                {isExpanded && row.form.length > 0 && (
                                    <div className="px-1 sm:px-2 space-y-3 pb-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="text-[11px] font-black text-slate-500 px-3 uppercase tracking-widest pb-1">Recent Matches</div>
                                        {row.form.map((m: any) => {
                                            const getInningsDisplay = (side: 'A' | 'B') => {
                                                const inn = side === 'A' ? m.innA : m.innB;
                                                if (!inn) return { score: '—', overs: '' };
                                                const r = inn.totalRuns || 0;
                                                const w = inn.totalWickets || 0;
                                                const o = typeof inn.overs === 'number' ? inn.overs.toFixed(1) : inn.overs || '';
                                                return { score: `${r}/${w}`, overs: o ? `${o}` : '' };
                                            }
                                            const scoreA = getInningsDisplay('A');
                                            const scoreB = getInningsDisplay('B');
                                            const result = m.formResult || 'T';

                                            return (
                                                <div key={m.id} className="bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all p-4 flex items-center justify-between gap-6 group">
                                                    <div className="flex-1 space-y-3">
                                                        <div className="flex items-center justify-between group-hover:translate-x-1 transition-transform duration-300">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#060b16] border border-slate-200 dark:border-white/5 flex items-center justify-center overflow-hidden p-0.5">
                                                                    <span className="text-[9px] font-black text-slate-400 dark:text-white/20">{m.teamAName?.[0]}</span>
                                                                </div>
                                                                <span className="text-[13px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-tight truncate max-w-[120px] sm:max-w-none">{m.teamAName}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[13px] font-black text-slate-200 tabular-nums">{scoreA.score}</span>
                                                                {scoreA.overs && <span className="text-[10px] font-bold text-slate-500 tabular-nums">({scoreA.overs})</span>}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between group-hover:translate-x-1 transition-transform duration-300 delay-75">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-6 h-6 rounded-full bg-[#060b16] border border-white/5 flex items-center justify-center overflow-hidden p-0.5">
                                                                    <span className="text-[9px] font-black text-white/20">{m.teamBName?.[0]}</span>
                                                                </div>
                                                                <span className="text-[13px] font-black text-slate-300 uppercase tracking-tight truncate max-w-[120px] sm:max-w-none">{m.teamBName}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[13px] font-black text-slate-200 tabular-nums">{scoreB.score}</span>
                                                                {scoreB.overs && <span className="text-[10px] font-bold text-slate-500 tabular-nums">({scoreB.overs})</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="w-px h-12 bg-white/5 hidden sm:block"></div>

                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shadow-sm transition-transform group-hover:scale-110
                                                            ${result === 'W' ? 'bg-[#10b981]' : result === 'L' ? 'bg-[#f43f5e]' : 'bg-slate-600'}`}>
                                                            {result}
                                                        </div>
                                                        <div className="hidden sm:block text-right min-w-[100px] space-y-0.5">
                                                            <div className="text-[11px] font-black text-slate-200 leading-tight">{(m as any).matchNo || 'Match'}</div>
                                                            <div className="text-[10px] font-bold text-slate-500 truncate max-w-[120px] italic">{m.tournamentName || tournament?.name}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="flex justify-between items-center px-3 pt-2">
                                            <div className="flex items-center gap-2.5 group cursor-pointer">
                                                <div className="w-7 h-7 rounded-full overflow-hidden bg-[#060b16] border border-white/5 flex items-center justify-center p-1">
                                                    {row.squad?.logoUrl ? <img src={row.squad.logoUrl} className="w-full h-full object-contain" /> : <div className="w-full h-full bg-white/5 rounded-full" />}
                                                </div>
                                                <span className="text-[11px] font-black text-slate-500 group-hover:text-blue-400 transition-colors">See complete team history</span>
                                            </div>
                                            <button className="text-[11px] font-black text-blue-400 hover:text-blue-300 px-3 py-1 rounded-full bg-blue-500/10 transition-colors">FIXTURES</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                    <div className="text-[10px] font-bold text-slate-500 italic pt-1 flex items-center gap-1.5 px-3">
                        <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                        * Upcoming Matches
                    </div>
                </div>
            </div>

            {/* 7. Head to Head */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-[13px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-wide">Head to Head <span className="text-[11px] font-bold text-slate-500 normal-case">(Last 10 matches)</span></h3>
                    <button className="text-[12px] font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors uppercase tracking-tight">All Matches</button>
                </div>

                {/* Summary View */}
                <div className="bg-white dark:bg-[#0f172a] rounded-2xl p-8 border border-slate-200 dark:border-white/5 shadow-sm space-y-10">
                    <div className="flex items-center justify-center gap-10 sm:gap-20">
                        <div className="text-center space-y-4">
                            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-[#060b16] border border-slate-200 dark:border-white/5 flex items-center justify-center p-4 mx-auto shadow-md">
                                {teamASquad?.logoUrl ? <img src={teamASquad.logoUrl} className="w-full h-full object-contain" /> : <span className="text-4xl font-black text-white/10">{teamAName[0]}</span>}
                            </div>
                            <div className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">{(match as any).teamAShort || formatShortTeamName(teamAName)}</div>
                        </div>

                        <div className="flex flex-col items-center">
                            <div className="text-5xl font-black flex items-center gap-6 tabular-nums tracking-tighter text-slate-900 dark:text-white">
                                <span>{headToHead.teamA}</span>
                                <span className="text-white/10 text-3xl font-normal">—</span>
                                <span>{headToHead.teamB}</span>
                            </div>
                            {headToHead.tie > 0 && <div className="text-[10px] font-bold text-slate-500 mt-2 uppercase tracking-widest">{headToHead.tie} {headToHead.tie === 1 ? 'Tie' : 'Ties'}</div>}
                        </div>

                        <div className="text-center space-y-4">
                            <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-[#060b16] border border-slate-200 dark:border-white/5 flex items-center justify-center p-4 mx-auto shadow-md">
                                {teamBSquad?.logoUrl ? <img src={teamBSquad.logoUrl} className="w-full h-full object-contain" /> : <span className="text-4xl font-black text-white/10">{teamBName[0]}</span>}
                            </div>
                            <div className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">{(match as any).teamBShort || formatShortTeamName(teamBName)}</div>
                        </div>
                    </div>

                    {/* Recent H2H Matches Cards */}
                    <div className="space-y-4">
                        {headToHead.recentMatches.map((m: any) => {
                            const mWinnerNameRaw = (m as any).winnerName || (m as any).winner;
                            const mDate = coerceToDate(m.date);
                            const resSummary = (m as any).resultSummary || `${mWinnerNameRaw || 'Result'} Won`;

                            const getInningsDisplay = (side: 'A' | 'B') => {
                                const inn = side === 'A' ? m.innA : m.innB;
                                if (!inn) return { score: '—', overs: '' };
                                const r = inn.totalRuns || 0;
                                const w = inn.totalWickets || 0;
                                const o = typeof inn.overs === 'number' ? inn.overs.toFixed(1) : inn.overs || '';
                                return { score: `${r}/${w}`, overs: o ? `${o}` : '' };
                            }

                            const scoreA = getInningsDisplay('A');
                            const scoreB = getInningsDisplay('B');

                            return (
                                <div key={m.id} className="bg-slate-50/50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all group">
                                    <div className="bg-white/[0.03] px-5 py-2.5 border-b border-white/5 flex justify-between items-center">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">{m.tournamentName || tournament?.name || (m as any).matchNo || 'Series Match'}</span>
                                        <span className="text-[10px] font-black text-slate-500">{mDate ? mDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                                    </div>
                                    <div className="p-5 flex items-center justify-between gap-6">
                                        <div className="space-y-3 flex-1">
                                            <div className="flex items-center justify-between group-hover:translate-x-1 transition-transform duration-300">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#060b16] border border-slate-200 dark:border-white/5 flex items-center justify-center overflow-hidden p-1 shadow-sm">
                                                        <span className="text-[9px] font-black text-slate-400 dark:text-white/10">{m.teamAName?.[0]}</span>
                                                    </div>
                                                    <span className="text-[13px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-tight">{m.teamAName}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-slate-900 dark:text-slate-200 tabular-nums">{scoreA.score}</span>
                                                    {scoreA.overs && <span className="text-[10px] font-bold text-slate-500 tabular-nums">({scoreA.overs})</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between group-hover:translate-x-1 transition-transform duration-300 delay-75">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-[#060b16] border border-slate-200 dark:border-white/5 flex items-center justify-center overflow-hidden p-1 shadow-sm">
                                                        <span className="text-[9px] font-black text-slate-400 dark:text-white/10">{m.teamBName?.[0]}</span>
                                                    </div>
                                                    <span className="text-[13px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-tight">{m.teamBName}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-black text-slate-900 dark:text-slate-200 tabular-nums">{scoreB.score}</span>
                                                    {scoreB.overs && <span className="text-[10px] font-bold text-slate-500 tabular-nums">({scoreB.overs})</span>}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-px h-12 bg-slate-100 dark:bg-white/5 hidden sm:block"></div>

                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shadow-sm transition-transform group-hover:scale-110
                                                ${m.resCode === 'W' ? 'bg-[#10b981]' : m.resCode === 'L' ? 'bg-[#f43f5e]' : 'bg-[#94a3b8]'}`}>
                                                {m.resCode}
                                            </div>
                                            <div className="hidden sm:block text-right min-w-[120px] space-y-1">
                                                <div className={`text-[12px] font-black leading-tight tracking-tight ${m.resCode === 'W' ? 'text-emerald-400' : m.resCode === 'L' ? 'text-rose-400' : 'text-slate-500'}`}>
                                                    {resSummary.includes('won') ? resSummary.replace('won', 'Won') :
                                                        resSummary.includes('Won') ? resSummary : `${resSummary} Won`}
                                                </div>
                                                <div className="text-[9px] font-bold text-slate-600 italic tracking-wider uppercase">Match Result</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Playing XI Popup Modal */}
            {showPlayingXIModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-50 dark:bg-[#060b16] w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-white/10 relative">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-[#0f172a]">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Playing XI</h3>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Match Day Squad</p>
                            </div>
                            <button
                                onClick={() => setShowPlayingXIModal(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto">
                            <MatchPlayingXI compact={true} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

