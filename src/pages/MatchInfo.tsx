/**
 * Match Info Page
 * Display comprehensive match information from Firebase
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { tournamentService } from '@/services/firestore/tournaments'
import { squadService } from '@/services/firestore/squads'
import { Match, Tournament } from '@/types'
import { coerceToDate, formatTimeLabel, formatTimeHMTo12h } from '@/utils/date'

interface MatchInfoProps {
    compact?: boolean
}

export default function MatchInfo({ compact = false }: MatchInfoProps) {
    const { matchId } = useParams<{ matchId: string }>()
    const [match, setMatch] = useState<Match | null>(null)
    const [tournament, setTournament] = useState<Tournament | null>(null)
    const [teamASquad, setTeamASquad] = useState<any>(null)
    const [teamBSquad, setTeamBSquad] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [headToHead, setHeadToHead] = useState<{ total: number, teamA: number, teamB: number, tie: number }>({ total: 0, teamA: 0, teamB: 0, tie: 0 })
    const [teamAForm, setTeamAForm] = useState<any[]>([])
    const [teamBForm, setTeamBForm] = useState<any[]>([])
    const [venueStats, setVenueStats] = useState<{ total: number, avgScore: number }>({ total: 0, avgScore: 0 })

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
                // Load tournament
                if (match.tournamentId) {
                    const tournamentData = await tournamentService.getById(match.tournamentId)
                    if (tournamentData) setTournament(tournamentData)
                }

                // Load squads
                const squadIdA = match.teamAId || (match as any).teamASquadId || (match as any).teamA
                const squadIdB = match.teamBId || (match as any).teamBSquadId || (match as any).teamB

                if (squadIdA) {
                    const squadA = await squadService.getById(squadIdA)
                    if (squadA) setTeamASquad(squadA)
                }

                if (squadIdB) {
                    const squadB = await squadService.getById(squadIdB)
                    if (squadB) setTeamBSquad(squadB)
                }

                // Fetch All Matches for Form & H2H
                if (squadIdA && squadIdB) {
                    const [matchesA, matchesB] = await Promise.all([
                        matchService.getBySquad(squadIdA),
                        matchService.getBySquad(squadIdB)
                    ])

                    // 1. Head to Head
                    const commonMatches = matchesA.filter(m =>
                        (m.teamAId === squadIdB || m.teamBId === squadIdB) &&
                        (m.status === 'finished')
                    )

                    const h2h = { total: commonMatches.length, teamA: 0, teamB: 0, tie: 0 }
                    commonMatches.forEach(m => {
                        const winnerId = (m as any).winnerId
                        if (winnerId === squadIdA) h2h.teamA++
                        else if (winnerId === squadIdB) h2h.teamB++
                        else h2h.tie++
                    })
                    setHeadToHead(h2h)

                    // 2. Form (Last 5)
                    const getForm = (matches: any[], squadId: string) => {
                        return matches
                            .filter(m => m.status === 'finished')
                            .slice(0, 5)
                            .map(m => {
                                const winnerId = (m as any).winnerId
                                if (!winnerId) return 'T'
                                return winnerId === squadId ? 'W' : 'L'
                            })
                    }
                    setTeamAForm(getForm(matchesA, squadIdA))
                    setTeamBForm(getForm(matchesB, squadIdB))

                    // 3. Venue Stats (Simple)
                    if (match.venue) {
                        const allMatches = await matchService.getAll()
                        const venueMatches = allMatches.filter(m => m.venue === match.venue && (m.status === 'finished'))
                        setVenueStats({
                            total: venueMatches.length,
                            avgScore: 0
                        })
                    }
                }
            } catch (error) {
                console.error('Error loading related data:', error)
            }
        }

        loadRelatedData()
    }, [match])

    if (loading) {
        return (
            <div className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${compact ? 'py-4' : 'py-12'} animate-pulse`}>
                <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-200 space-y-6">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="bg-gray-50 rounded-xl p-6">
                            <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
                            <div className="h-6 bg-gray-200 rounded w-48"></div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (!match) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-slate-600 text-lg mb-4">Match not found</p>
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

    const InfoCard = ({ title, icon, value, subValue, bg, border, iconBg }: { title: string, icon: React.ReactNode, value: string, subValue?: string, bg: string, border: string, iconBg?: string }) => (
        <div className={`p-6 rounded-[1.5rem] border ${border} ${bg} transition-all hover:shadow-md space-y-4`}>
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${iconBg || 'bg-white/50'} flex items-center justify-center text-lg`}>
                    {icon}
                </div>
                <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-400">{title}</h3>
            </div>
            <div className="space-y-1">
                <p className="text-base sm:text-xl font-black text-slate-800 leading-tight">{value}</p>
                {subValue && <p className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase tracking-wider">{subValue}</p>}
            </div>
        </div>
    )

    const FormCircle = ({ result }: { result: 'W' | 'L' | 'T' }) => (
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black text-white shadow-sm transition-transform hover:scale-110
      ${result === 'W' ? 'bg-emerald-500' : result === 'L' ? 'bg-rose-500' : 'bg-slate-400'}`}>
            {result}
        </div>
    )

    return (
        <div className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${compact ? 'py-4' : 'py-12'} space-y-8 pb-20`}>
            {/* 1. Head to Head & Form Guide */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Head to Head Card */}
                <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -mr-16 -mt-16"></div>
                    <div className="flex items-center justify-between relative z-10">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Head to Head</h3>
                        <span className="text-[10px] font-black bg-blue-50 px-3 py-1 rounded-full text-blue-600">LAST {headToHead.total} MATCHES</span>
                    </div>

                    <div className="flex items-center gap-6 relative z-10">
                        <div className="flex-1 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-black text-slate-700 truncate max-w-[120px]">{teamAName}</span>
                                <span className="text-4xl font-black text-slate-900">{headToHead.teamA}</span>
                            </div>
                            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                <div
                                    className="bg-gradient-to-r from-blue-600 to-blue-400 h-full transition-all duration-1000"
                                    style={{ width: `${headToHead.total > 0 ? (headToHead.teamA / headToHead.total) * 100 : 50}%` }}
                                ></div>
                                <div
                                    className="bg-gradient-to-l from-rose-500 to-rose-400 h-full transition-all duration-1000"
                                    style={{ width: `${headToHead.total > 0 ? (headToHead.teamB / headToHead.total) * 100 : 50}%` }}
                                ></div>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-4xl font-black text-slate-900">{headToHead.teamB}</span>
                                <span className="text-sm font-black text-slate-700 truncate max-w-[120px] text-right">{teamBName}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-6 text-[10px] font-black uppercase text-slate-400 relative z-10">
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div>{teamAName}</div>
                        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>{teamBName}</div>
                    </div>
                </div>

                {/* Form Guide Card */}
                <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16"></div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 relative z-10">Form Guide</h3>

                    <div className="space-y-10 relative z-10">
                        <div className="flex flex-col gap-8">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-black text-slate-700 uppercase tracking-wider">{teamAName}</span>
                                    <span className="text-[10px] font-bold text-slate-400">LAST 5</span>
                                </div>
                                <div className="flex gap-2">
                                    {teamAForm.length > 0 ? teamAForm.map((r, i) => <FormCircle key={i} result={r} />) : <span className="text-[10px] text-slate-400 font-bold italic uppercase px-4 py-2 bg-slate-50 rounded-xl">No historical data</span>}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-black text-slate-700 uppercase tracking-wider">{teamBName}</span>
                                    <span className="text-[10px] font-bold text-slate-400">LAST 5</span>
                                </div>
                                <div className="flex gap-2">
                                    {teamBForm.length > 0 ? teamBForm.map((r, i) => <FormCircle key={i} result={r} />) : <span className="text-[10px] text-slate-400 font-bold italic uppercase px-4 py-2 bg-slate-50 rounded-xl">No historical data</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Venue & Tournament Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Venue Highlights */}
                <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-[2.5rem] p-8 text-white overflow-hidden relative group shadow-xl">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/20 blur-[80px] -mr-20 -mt-20 group-hover:bg-rose-500/30 transition-all duration-500"></div>
                    <div className="relative z-10 space-y-10">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-2xl shadow-lg">📍</div>
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-1">Venue Intelligence</h4>
                                <p className="text-xl font-black tracking-tight">{match.venue || 'SMA Home Ground'}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-5 border border-white/5 transition-transform hover:scale-[1.02]">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Track Record</p>
                                <p className="text-3xl font-black">{venueStats.total} <span className="text-sm font-medium text-slate-500">Matches</span></p>
                            </div>
                            <div className="bg-emerald-500/10 backdrop-blur-md rounded-3xl p-5 border border-emerald-500/10 transition-transform hover:scale-[1.02]">
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Surface Type</p>
                                <p className="text-xl font-black">Balanced <span className="block text-[10px] font-medium text-slate-400 mt-1">PACE & SPIN</span></p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tournament Card */}
                {tournament && (
                    <div className="bg-gradient-to-br from-indigo-700 to-blue-800 rounded-[2.5rem] p-8 text-white overflow-hidden relative group shadow-xl border border-indigo-500/20">
                        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 blur-[80px] -mr-20 -mt-20 group-hover:bg-white/20 transition-all duration-500"></div>
                        <div className="relative z-10 space-y-10">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-2xl shadow-lg">🏆</div>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300 mb-1">Competition</h4>
                                    <p className="text-xl font-black truncate pr-4 tracking-tight">{tournament.name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-8">
                                <div className="flex-1 bg-white/5 rounded-3xl p-5 border border-white/5">
                                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-2">Season</p>
                                    <p className="text-3xl font-black">{tournament.year}</p>
                                </div>
                                <div className="flex-1 bg-white/5 rounded-3xl p-5 border border-white/5">
                                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-2">Format</p>
                                    <p className="text-3xl font-black uppercase">{tournament.format || 'T20'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 3. Basic Match Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Match Ref */}
                <InfoCard
                    title="Match Identifier"
                    icon={<span className="text-slate-500">#️⃣</span>}
                    value={(match as any).matchNo || `#${match.id.substring(0, 6).toUpperCase()}`}
                    subValue={(match as any).matchNo ? 'OFFICIAL REF' : 'INTERNAL ID'}
                    bg="bg-[#f8fafc]"
                    border="border-[#f1f5f9]"
                />

                {/* Date & Time */}
                <InfoCard
                    title="Schedule"
                    icon={<span className="text-blue-500">📅</span>}
                    value={matchDate ? matchDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBA'}
                    subValue={timeText ? `KICK OFF AT ${timeText.toUpperCase()}` : ''}
                    bg="bg-[#faf5ff]"
                    border="border-[#f3e8ff]"
                />

                {/* Match Format */}
                <InfoCard
                    title="Duration"
                    icon={<span className="text-purple-400">⚙️</span>}
                    value={match.oversLimit ? `${match.oversLimit} Overs` : 'Limited Oversight'}
                    bg="bg-[#f8fafc]"
                    border="border-[#f1f5f9]"
                />

                {/* Toss Details */}
                {(match.tossWinner || (match as any).tossWinner) ? (
                    <InfoCard
                        title="Toss Information"
                        icon={<span className="text-amber-600 font-bold">🪙</span>}
                        value={`${(() => {
                            const m2 = match as any;
                            const tw = m2.tossWinner;
                            const tAId = String(m2.teamAId || m2.teamASquadId || m2.teamA || '').trim().toLowerCase();
                            const tBId = String(m2.teamBId || m2.teamBSquadId || m2.teamB || '').trim().toLowerCase();
                            const twid = String(tw || '').trim().toLowerCase();

                            if (twid === 'teama' || (tAId && twid === tAId)) return teamAName;
                            if (twid === 'teamb' || (tBId && twid === tBId)) return teamBName;
                            return tw || 'Unspecified Team';
                        })()} won the toss`}
                        subValue={`ELECTED TO ${(match.electedTo || (match as any).tossDecision || 'bat').toUpperCase()} FIRST`}
                        bg="bg-[#fff9f2]"
                        border="border-[#ffe4cc]"
                        iconBg="bg-amber-100"
                    />
                ) : (
                    <InfoCard
                        title="Toss Status"
                        icon={<span className="text-slate-400">🪙</span>}
                        value="Toss Pending"
                        subValue="NOT YET PERFORMED"
                        bg="bg-[#f8fafc]"
                        border="border-[#f1f5f9]"
                    />
                )}
            </div>
        </div>
    )
}
