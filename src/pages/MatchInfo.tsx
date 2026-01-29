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
import { Calendar, MapPin, ChevronRight, ChevronDown, Info } from 'lucide-react'

interface MatchInfoProps {
    compact?: boolean
    onSwitchTab?: (tab: string) => void
}

export default function MatchInfo({ compact = false, onSwitchTab }: MatchInfoProps) {
    const { matchId } = useParams<{ matchId: string }>()
    const [match, setMatch] = useState<Match | null>(null)
    const [tournament, setTournament] = useState<Tournament | null>(null)
    const [teamASquad, setTeamASquad] = useState<any>(null)
    const [teamBSquad, setTeamBSquad] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [headToHead, setHeadToHead] = useState<{ total: number, teamA: number, teamB: number, tie: number, recentMatches: any[] }>({ total: 0, teamA: 0, teamB: 0, tie: 0, recentMatches: [] })
    const [teamAForm, setTeamAForm] = useState<any[]>([])
    const [teamBForm, setTeamBForm] = useState<any[]>([])

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
                        (m.teamAId === squadIdB || m.teamBId === squadIdB || (m as any).teamA === squadIdB || (m as any).teamB === squadIdB) &&
                        (m.status === 'finished')
                    ).sort((a, b) => (coerceToDate((b as any).date)?.getTime() || 0) - (coerceToDate((a as any).date)?.getTime() || 0))

                    const h2h = { total: commonMatches.length, teamA: 0, teamB: 0, tie: 0, recentMatches: commonMatches.slice(0, 5) }
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
                <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100 space-y-6">
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

    const hasAnyXI = (match.teamAPlayingXI?.length || 0) > 0 || (match.teamBPlayingXI?.length || 0) > 0
    const xiTitle = hasAnyXI ? 'Playing XI' : 'Squad'

    const FormCircle = ({ result }: { result: 'W' | 'L' | 'T' }) => (
        <div className={`w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-black text-white shadow-sm
      ${result === 'W' ? 'bg-[#51b163]' : result === 'L' ? 'bg-[#f76a6a]' : 'bg-slate-300'}`}>
            {result}
        </div>
    )

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
        <div className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${compact ? 'py-4' : 'py-12'} space-y-4 pb-20 bg-gray-50/50`}>

            {/* 1. Toss Message (Orange text in image) */}
            {tossMessage && (
                <div className="text-[#a66a00] text-sm font-medium px-1">
                    {tossMessage}
                </div>
            )}

            {/* 2. Brand/Series Card */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{(match as any).matchNo || 'T20 Match'}</div>
                    <div className="text-sm font-black text-slate-800 flex items-center gap-1.5 hover:text-blue-600 cursor-pointer">
                        {tournament?.name || 'Local Tournament'}
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2">
                    {tournament?.logoUrl ? <img src={tournament.logoUrl} className="w-full h-full object-contain" /> : <Info className="w-6 h-6 text-slate-200" />}
                </div>
            </div>

            {/* 3. Match Metadata (Date/Time/Venue) */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
                <div className="flex items-center gap-3 text-sm text-slate-600 font-medium">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-slate-400" />
                    </div>
                    <span>{matchDate ? matchDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' }) : 'TBA'}, {timeText}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm text-slate-600 font-medium group cursor-pointer">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-blue-600 hover:underline">{match.venue || 'SMA Home Ground'}</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                </div>
            </div>

            {/* 4. Squad / Playing XI Section */}
            <div className="space-y-3 pt-2">
                <h3 className="text-sm font-black text-slate-800 px-1">{xiTitle}</h3>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
                    <div className="flex items-center justify-between p-4 group cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={() => onSwitchTab?.('playing-xi')}>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                                {teamASquad?.logoUrl ? <img src={teamASquad.logoUrl} className="w-6 h-6 object-contain" /> : <span className="text-[10px] font-black text-slate-300">{teamAName[0]}</span>}
                            </div>
                            <span className="text-sm font-bold text-slate-700">{teamAName}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <div className="flex items-center justify-between p-4 group cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={() => onSwitchTab?.('playing-xi')}>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                                {teamBSquad?.logoUrl ? <img src={teamBSquad.logoUrl} className="w-6 h-6 object-contain" /> : <span className="text-[10px] font-black text-slate-300">{teamBName[0]}</span>}
                            </div>
                            <span className="text-sm font-bold text-slate-700">{teamBName}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </div>


            {/* 6. Team Form */}
            <div className="space-y-3 pt-2">
                <h3 className="text-sm font-black text-slate-800 px-1">Team form <span className="text-[10px] font-bold text-slate-400 lowercase">(Last 5 matches)</span></h3>
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                                {teamASquad?.logoUrl ? <img src={teamASquad.logoUrl} className="w-4 h-4 object-contain" /> : <span className="text-[8px] font-black text-slate-300">{teamAName[0]}</span>}
                            </div>
                            <span className="text-xs font-black text-slate-700 uppercase">{(match as any).teamAShort || teamAName.substring(0, 3)}</span>
                        </div>
                        <div className="flex gap-1.5 items-center">
                            <div className="w-8 h-8 rounded-md bg-slate-50 border border-slate-200/50 flex items-center justify-center text-[8px] font-black text-slate-300">*</div>
                            {teamAForm.map((r, i) => <FormCircle key={i} result={r} />)}
                            <ChevronDown className="w-4 h-4 text-slate-300 ml-1" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                                {teamBSquad?.logoUrl ? <img src={teamBSquad.logoUrl} className="w-4 h-4 object-contain" /> : <span className="text-[8px] font-black text-slate-300">{teamBName[0]}</span>}
                            </div>
                            <span className="text-xs font-black text-slate-700 uppercase">{(match as any).teamBShort || teamBName.substring(0, 3)}</span>
                        </div>
                        <div className="flex gap-1.5 items-center">
                            <div className="w-8 h-8 rounded-md bg-slate-50 border border-slate-200/50 flex items-center justify-center text-[8px] font-black text-slate-300">*</div>
                            {teamBForm.map((r, i) => <FormCircle key={i} result={r} />)}
                            <ChevronDown className="w-4 h-4 text-slate-300 ml-1" />
                        </div>
                    </div>
                    <div className="text-[9px] font-bold text-slate-400 italic pt-1">* Upcoming Matches</div>
                </div>
            </div>

            {/* 7. Head to Head */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-black text-slate-800">Head to Head <span className="text-[10px] font-bold text-slate-400 lowercase">(Last 10 matches)</span></h3>
                    <button className="text-[11px] font-black text-blue-600 hover:underline">All Matches</button>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-8">
                    {/* Summary Row */}
                    <div className="flex items-center justify-around gap-4">
                        <div className="text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center p-2 mx-auto">
                                {teamASquad?.logoUrl ? <img src={teamASquad.logoUrl} className="w-full h-full object-contain" /> : <span className="text-xl font-black text-slate-100">{teamAName[0]}</span>}
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{(match as any).teamAShort || teamAName.substring(0, 3)}</div>
                        </div>

                        <div className="text-3xl font-black flex items-center gap-4 tabular-nums">
                            <span className="text-slate-800">{headToHead.teamA}</span>
                            <span className="text-slate-200 text-xl font-normal">—</span>
                            <span className="text-slate-800">{headToHead.teamB}</span>
                        </div>

                        <div className="text-center space-y-3">
                            <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center p-2 mx-auto">
                                {teamBSquad?.logoUrl ? <img src={teamBSquad.logoUrl} className="w-full h-full object-contain" /> : <span className="text-xl font-black text-slate-100">{teamBName[0]}</span>}
                            </div>
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{(match as any).teamBShort || teamBName.substring(0, 3)}</div>
                        </div>
                    </div>

                    {/* Recent H2H Matches List */}
                    <div className="space-y-3">
                        {headToHead.recentMatches.map((m: any) => {
                            const mWinnerId = (m as any).winnerId;
                            const mWinnerName = mWinnerId === (m.teamAId || (m as any).teamA) ? m.teamAName : m.teamBName;
                            const mDate = coerceToDate(m.date);
                            const resSummary = (m as any).resultSummary || `${mWinnerName} won`;

                            return (
                                <div key={m.id} className="bg-slate-50/50 rounded-xl p-4 border border-slate-100 space-y-3 group cursor-pointer hover:bg-white hover:border-blue-100 transition-all">
                                    <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase">
                                        <span>{tournament?.name || 'Previous Series'}</span>
                                        <span>{mDate ? mDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : ''}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="space-y-2 flex-1">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
                                                        <span className="text-[8px] font-black text-slate-200">{m.teamAName?.[0]}</span>
                                                    </div>
                                                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{m.teamAName}</span>
                                                </div>
                                                <div className="text-xs font-black text-slate-800">
                                                    {(m as any).teamAOverallScore || `${(m as any).teamAScore || 0}/${(m as any).teamAWickets || 0}`}
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 rounded-full bg-white border border-slate-100 flex items-center justify-center overflow-hidden">
                                                        <span className="text-[8px] font-black text-slate-200">{m.teamBName?.[0]}</span>
                                                    </div>
                                                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{m.teamBName}</span>
                                                </div>
                                                <div className="text-xs font-black text-slate-800">
                                                    {(m as any).teamBOverallScore || `${(m as any).teamBScore || 0}/${(m as any).teamBWickets || 0}`}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-px h-10 bg-slate-200"></div>
                                        <div className="min-w-[80px] text-right">
                                            <div className={`text-[10px] font-black leading-tight ${mWinnerId ? 'text-blue-600' : 'text-slate-400'}`}>
                                                {resSummary.includes('won') ? resSummary.replace('won', 'Won') : resSummary}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
