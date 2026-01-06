import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PlayerLink from '../PlayerLink'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import { Match, InningsStats } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { matchService } from '@/services/firestore/matches'
import { getMatchResultString } from '@/utils/matchWinner'

interface MatchSummaryProps {
    match: Match
    teamAInnings: InningsStats | null
    teamBInnings: InningsStats | null
    playersMap: Map<string, any>
    teamAName: string
    teamBName: string
    teamALogo?: string
    teamBLogo?: string
}

const MatchSummary: React.FC<MatchSummaryProps> = ({
    match,
    teamAInnings,
    teamBInnings,
    playersMap,
    teamAName,
    teamBName,
    teamALogo,
    teamBLogo,
}) => {
    const { user } = useAuthStore()
    const [isEditingPom, setIsEditingPom] = useState(false)

    // --- Helpers ---
    const getPlayer = (id: string) => playersMap.get(id) || { name: 'Unknown', photoUrl: null }

    const getTeamLogo = (teamSide: 'A' | 'B') => {
        if (teamSide === 'A') return teamALogo || (match as any).teamALogoUrl
        return teamBLogo || (match as any).teamBLogoUrl
    }

    // --- Result Logic ---
    const resultText = useMemo(() => {
        if ((match as any).resultSummary) return (match as any).resultSummary
        return getMatchResultString(teamAName, teamBName, teamAInnings, teamBInnings, match)
    }, [match, teamAInnings, teamBInnings, teamAName, teamBName])

    // --- Auto Player of the Match Calculation ---
    const calculatedPomId = useMemo(() => {
        if ((match as any).playerOfMatchId) return (match as any).playerOfMatchId

        let bestId = ''
        let maxPoints = -1

        const playerPoints = new Map<string, number>()

        const addPoints = (id: string, pts: number) => {
            if (!id) return
            const c = playerPoints.get(id) || 0
            playerPoints.set(id, c + pts)
        }

        teamAInnings?.batsmanStats?.forEach(b => addPoints(b.batsmanId, (b.runs || 0) + (b.runs > 49 ? 20 : 0)))
        teamAInnings?.bowlerStats?.forEach(b => addPoints(b.bowlerId, (b.wickets * 20) + (b.wickets > 2 ? 10 : 0)))

        teamBInnings?.batsmanStats?.forEach(b => addPoints(b.batsmanId, (b.runs || 0) + (b.runs > 49 ? 20 : 0)))
        teamBInnings?.bowlerStats?.forEach(b => addPoints(b.bowlerId, (b.wickets * 20) + (b.wickets > 2 ? 10 : 0)))

        playerPoints.forEach((pts, id) => {
            if (pts > maxPoints) {
                maxPoints = pts
                bestId = id
            }
        })

        return bestId
    }, [match, teamAInnings, teamBInnings])

    const startEditingPom = () => {
        setIsEditingPom(true)
    }

    const savePom = async (id: string) => {
        await matchService.update(match.id, { playerOfMatchId: id } as any)
        setIsEditingPom(false)
    }

    const pomPlayer = getPlayer(calculatedPomId)
    // Find basic stats for display (Bat or Bowl dominant)
    const pomStats = useMemo(() => {
        if (!calculatedPomId) return null
        const batA = teamAInnings?.batsmanStats?.find(b => b.batsmanId === calculatedPomId)
        const bowlA = teamAInnings?.bowlerStats?.find(b => b.bowlerId === calculatedPomId)
        const batB = teamBInnings?.batsmanStats?.find(b => b.batsmanId === calculatedPomId)
        const bowlB = teamBInnings?.bowlerStats?.find(b => b.bowlerId === calculatedPomId)

        const bat = batA || batB
        const bowl = bowlA || bowlB

        return { bat, bowl }
    }, [calculatedPomId, teamAInnings, teamBInnings])

    // --- Batting Order for Layout ---
    const firstBatSide = useMemo(() => {
        if (!match.tossWinner || !match.electedTo) return 'A'
        const tossSide = (match as any).tossWinner === 'teamA' ? 'A' : 'B'
        const decision = String((match as any).tossDecision || match.electedTo || '').toLowerCase()
        if (decision.includes('bat')) return tossSide
        return tossSide === 'A' ? 'B' : 'A'
    }, [match])

    const leftTeam = useMemo(() => {
        if (firstBatSide === 'A') {
            return { name: teamAName, logo: getTeamLogo('A'), innings: teamAInnings, side: 'A' }
        }
        return { name: teamBName, logo: getTeamLogo('B'), innings: teamBInnings, side: 'B' }
    }, [firstBatSide, teamAName, teamBName, teamAInnings, teamBInnings, match])

    const rightTeam = useMemo(() => {
        if (firstBatSide === 'A') {
            return { name: teamBName, logo: getTeamLogo('B'), innings: teamBInnings, side: 'B' }
        }
        return { name: teamAName, logo: getTeamLogo('A'), innings: teamAInnings, side: 'A' }
    }, [firstBatSide, teamAName, teamBName, teamAInnings, teamBInnings, match])

    const renderInningsPerformers = (innings: InningsStats | null, teamName: string, inningLabel: string) => {
        if (!innings) return null

        const topBatters = (innings.batsmanStats || [])
            .sort((a, b) => b.runs - a.runs)
            .slice(0, 2)
            .map(b => ({ ...b, type: 'bat' }))

        const topBowlers = (innings.bowlerStats || [])
            .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)
            .filter(b => Number(b.overs) > 0)
            .slice(0, 1)
            .map(b => ({ ...b, type: 'bowl' }))

        const allPerfs = [...topBatters, ...topBowlers]
        return (
            <div className="mb-2">
                <div className="px-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100">
                    {teamName} - {inningLabel}
                </div>
                <div className="divide-y divide-slate-100 bg-white">
                    {allPerfs.map((p: any, idx) => {
                        const pid = p.type === 'bat' ? p.batsmanId : p.bowlerId
                        const player = getPlayer(pid)
                        return (
                            <div key={idx} className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                    <PlayerAvatar
                                        photoUrl={player.photoUrl || (player as any).photo}
                                        name={player.name}
                                        size="sm"
                                    />
                                    <div>
                                        <PlayerLink
                                            playerId={pid}
                                            playerName={player.name}
                                            className="text-sm font-bold text-slate-900 truncate block decoration-blue-400 underline-offset-2"
                                        />
                                        <div className="text-xs text-slate-500">
                                            {p.type === 'bat' ? `SR: ${Number(p.strikeRate || 0).toFixed(2)}` : `ER: ${Number(p.economy || 0).toFixed(2)}`}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-bold text-slate-900">
                                        {p.type === 'bat' ? `${p.runs} (${p.balls})` : `${p.wickets}-${p.runsConceded}`}
                                    </div>
                                    {p.isNotOut && <div className="text-[10px] bg-slate-100 px-1 rounded inline-block text-slate-500">NO</div>}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* 1. Dark Score Summary Card */}
            <div className="bg-[#1a1f3c] text-white p-4 sm:p-6 pb-8 rounded-b-3xl shadow-lg relative overflow-hidden">
                {/* Teams Row */}
                <div className="flex items-center justify-between px-2 sm:px-4 mt-4 sm:mt-8 relative z-10">
                    {/* Left Team (First Bat) */}
                    <div className="flex flex-col items-center gap-1 sm:gap-2 w-[35%]">
                        <img src={leftTeam.logo} alt={leftTeam.name} className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-white/5 p-1.5 sm:p-2 object-contain" />
                        <div className="text-[10px] sm:text-base font-bold text-center uppercase tracking-wide opacity-90 leading-tight min-h-[1.5em] flex items-center justify-center">{leftTeam.name}</div>
                        <div className="text-2xl sm:text-4xl font-black mt-0.5 sm:mt-1 tracking-tight whitespace-nowrap">
                            {leftTeam.innings?.totalRuns || '0'}-{leftTeam.innings?.totalWickets || '0'}
                            <span className="text-xs sm:text-lg font-medium text-white/50 ml-0.5 sm:ml-1">({leftTeam.innings?.overs || '0.0'})</span>
                        </div>
                    </div>

                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-amber-500 opacity-20 pointer-events-none mix-blend-screen">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-16 h-16 sm:w-32 sm:h-32">
                            <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
                        </svg>
                    </div>

                    {/* Right Team (Second Bat) */}
                    <div className="flex flex-col items-center gap-1 sm:gap-2 w-[35%]">
                        <img src={rightTeam.logo} alt={rightTeam.name} className="w-12 h-12 sm:w-20 sm:h-20 rounded-full bg-white/5 p-1.5 sm:p-2 object-contain" />
                        <div className="text-[10px] sm:text-base font-bold text-center uppercase tracking-wide opacity-90 leading-tight min-h-[1.5em] flex items-center justify-center">{rightTeam.name}</div>
                        <div className="text-2xl sm:text-4xl font-black mt-0.5 sm:mt-1 tracking-tight whitespace-nowrap">
                            {rightTeam.innings?.totalRuns || '0'}-{rightTeam.innings?.totalWickets || '0'}
                            <span className="text-xs sm:text-lg font-medium text-white/50 ml-0.5 sm:ml-1">({rightTeam.innings?.overs || '0.0'})</span>
                        </div>
                    </div>
                </div>

                {/* Result Pill */}
                <div className="mt-8 flex justify-center relative z-10">
                    <div className="px-8 py-2.5 rounded-full border border-blue-500/20 bg-[#242b4d] text-blue-400 font-bold uppercase tracking-widest text-[11px] shadow-xl">
                        {resultText}
                    </div>
                </div>
            </div>

            {/* 3. Player of the Match */}
            {pomPlayer && (
                <div className="mx-4 -mt-6 relative z-10">
                    <div className="bg-white rounded-xl shadow-lg shadow-black/5 p-4 flex items-center gap-4 relative overflow-hidden group">
                        {/* Glow effect */}
                        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-300 to-amber-500" />

                        <PlayerAvatar
                            photoUrl={pomPlayer.photoUrl || (pomPlayer as any).photo}
                            name={pomPlayer.name}
                            size="lg"
                            className="border-2 border-amber-100 shadow-sm"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-0.5">Player of the Match</div>
                            <Link to={`/players/${calculatedPomId}`} className="text-sm font-black text-slate-900 truncate block hover:text-blue-600 transition-colors">
                                {pomPlayer.name}
                            </Link>
                        </div>

                        <div className="text-right shrink-0">
                            {pomStats?.bat && (pomStats.bat.runs > 0 || pomStats.bat.balls > 0) && (
                                <div className="text-sm font-black text-slate-900">
                                    {pomStats.bat.runs} <span className="text-xs text-slate-500 font-medium">({pomStats.bat.balls})</span>
                                </div>
                            )}
                            {pomStats?.bowl && (pomStats.bowl.wickets > 0 || parseFloat(String(pomStats.bowl.overs || 0)) > 0) && (
                                <div className="text-sm font-black text-slate-900 mt-0.5">
                                    {pomStats.bowl.wickets}-{pomStats.bowl.runsConceded} <span className="text-[10px] text-slate-500 font-medium">({pomStats.bowl.overs})</span>
                                </div>
                            )}
                        </div>

                        {(user as any)?.isAdmin && (
                            <button
                                onClick={startEditingPom}
                                className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-blue-600 hover:bg-slate-50 rounded-full transition-all"
                                title="Edit Player of the Match"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                            </button>
                        )}

                        {/* Admin Selector Overlay */}
                        {isEditingPom && (
                            <div className="absolute inset-0 bg-white z-20 flex flex-col p-2">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold uppercase">Select POM</span>
                                    <button onClick={() => setIsEditingPom(false)} className="text-red-500 font-bold px-2">X</button>
                                </div>
                                <select
                                    className="flex-1 w-full text-xs border rounded p-1 bg-white"
                                    onChange={(e) => savePom(e.target.value)}
                                    value={calculatedPomId || ''}
                                >
                                    <option value="">Auto Select</option>
                                    {[...(teamAInnings?.batsmanStats || []), ...(teamAInnings?.bowlerStats || []),
                                    ...(teamBInnings?.batsmanStats || []), ...(teamBInnings?.bowlerStats || [])]
                                        .filter((v, i, a) => a.findIndex(t => ((t as any).batsmanId || (t as any).bowlerId) === ((v as any).batsmanId || (v as any).bowlerId)) === i)
                                        .map(p => {
                                            const id = (p as any).batsmanId || (p as any).bowlerId
                                            const pl = getPlayer(id)
                                            return <option key={id} value={id}>{pl.name}</option>
                                        })}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 4. Top Performers */}
            <div className="mt-6">
                <h3 className="px-4 text-sm font-bold text-slate-900 mb-2">Top Performers</h3>

                {firstBatSide === 'A' ? (
                    <>
                        {renderInningsPerformers(teamAInnings, teamAName, '1st Inns')}
                        {renderInningsPerformers(teamBInnings, teamBName, '2nd Inns')}
                    </>
                ) : (
                    <>
                        {renderInningsPerformers(teamBInnings, teamBName, '1st Inns')}
                        {renderInningsPerformers(teamAInnings, teamAName, '2nd Inns')}
                    </>
                )}
            </div>
        </div>
    )
}

export default MatchSummary
