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
        <div className="min-h-screen bg-[#f1f5f9] pb-20">
            {/* 1. Ultra-Premium Header */}
            <div className="relative bg-[#0b0f1a] text-white pt-6 pb-12 md:pb-16 px-4 md:px-8 rounded-b-[2rem] md:rounded-b-[3rem] shadow-2xl overflow-hidden group">
                {/* Background Textures */}
                <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.15),transparent_70%)]"></div>

                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="grid grid-cols-2 md:grid-cols-3 items-center gap-y-8 md:gap-4">

                        {/* Team A - Left on Laptop, Top-Left on Mobile */}
                        <div className="flex flex-col items-center md:items-end text-center md:text-right animate-in fade-in slide-in-from-left-4 duration-700">
                            <div className="relative mb-3 md:mb-4">
                                <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-lg scale-125"></div>
                                <img src={leftTeam.logo} alt={leftTeam.name} className="relative w-14 h-14 md:w-28 md:h-28 rounded-full bg-slate-800 border-2 border-white/5 p-1.5 md:p-2 object-contain shadow-xl" />
                            </div>
                            <h3 className="text-[10px] md:text-sm font-black uppercase tracking-widest text-white/40 mb-0.5 md:mb-1 truncate max-w-[120px] md:max-w-none">{leftTeam.name}</h3>
                            <div className="flex items-baseline gap-1 md:gap-2">
                                <span className="text-xl md:text-5xl font-black tracking-tighter">{leftTeam.innings?.totalRuns || '0'}-{leftTeam.innings?.totalWickets || '0'}</span>
                                <span className="text-[10px] md:text-lg font-bold text-white/20">({leftTeam.innings?.overs || '0.0'})</span>
                            </div>
                        </div>

                        {/* VS Divider - Only Mobile */}
                        <div className="md:hidden absolute left-1/2 top-10 -translate-x-1/2 flex flex-col items-center opacity-20">
                            <div className="h-4 w-px bg-white/20"></div>
                            <span className="text-[8px] font-black tracking-widest py-1">VS</span>
                            <div className="h-4 w-px bg-white/20"></div>
                        </div>

                        {/* Team B - Right on Laptop, Top-Right on Mobile */}
                        <div className="flex flex-col items-center md:items-start text-center md:text-left order-2 md:order-3 animate-in fade-in slide-in-from-right-4 duration-700">
                            <div className="relative mb-3 md:mb-4">
                                <div className="absolute inset-0 bg-rose-500/10 rounded-full blur-lg scale-125"></div>
                                <img src={rightTeam.logo} alt={rightTeam.name} className="relative w-14 h-14 md:w-28 md:h-28 rounded-full bg-slate-800 border-2 border-white/5 p-1.5 md:p-2 object-contain shadow-xl" />
                            </div>
                            <h3 className="text-[10px] md:text-sm font-black uppercase tracking-widest text-white/40 mb-0.5 md:mb-1 truncate max-w-[120px] md:max-w-none">{rightTeam.name}</h3>
                            <div className="flex items-baseline gap-1 md:gap-2">
                                <span className="text-xl md:text-5xl font-black tracking-tighter">{rightTeam.innings?.totalRuns || '0'}-{rightTeam.innings?.totalWickets || '0'}</span>
                                <span className="text-[10px] md:text-lg font-bold text-white/20">({rightTeam.innings?.overs || '0.0'})</span>
                            </div>
                        </div>

                        {/* Result Column - Bottom on Mobile, Center on Laptop */}
                        <div className="col-span-2 md:col-span-1 order-3 md:order-2 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-1000">
                            <div className="hidden md:flex w-14 h-14 rounded-2xl bg-white/5 border border-white/10 items-center justify-center mb-6 backdrop-blur-md">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-amber-500">
                                    <path fillRule="evenodd" d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z" clipRule="evenodd" />
                                </svg>
                            </div>

                            <div className="text-center w-full px-2">
                                <div className="text-[8px] md:text-xs font-black text-amber-500 uppercase tracking-[0.3em] mb-2 md:mb-4 opacity-70">Match Completed</div>
                                <div className="relative inline-block px-6 py-2 md:py-3 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 shadow-lg group-hover:border-blue-500/50 transition-colors">
                                    <h2 className="text-xs md:text-xl font-black text-white leading-tight tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
                                        {resultText}
                                    </h2>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 md:px-8">
                {/* 2. Compact Player of the Match Section */}
                {pomPlayer && (
                    <div className="-mt-6 md:-mt-10 relative z-20">
                        <div className="bg-white rounded-2xl md:rounded-3xl shadow-[0_15px_40px_rgba(0,0,0,0.08)] border border-slate-100 p-4 md:p-6 flex items-center gap-4 md:gap-6 group">
                            <div className="relative shrink-0">
                                <PlayerAvatar
                                    photoUrl={pomPlayer.photoUrl || (pomPlayer as any).photo}
                                    name={pomPlayer.name}
                                    size="lg"
                                    className="w-16 h-16 md:w-28 md:h-28 border-2 md:border-4 border-amber-100 shadow-lg"
                                />
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 md:w-9 md:h-9 bg-amber-500 rounded-full border-2 md:border-4 border-white flex items-center justify-center text-white text-[10px] md:text-base">⭐</div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-600 text-[8px] md:text-[10px] font-black uppercase tracking-widest rounded-md mb-1 md:mb-2 text-center">PLAYER OF THE MATCH</span>
                                <Link to={`/players/${calculatedPomId}`} className="text-sm md:text-2xl font-black text-slate-900 truncate block hover:text-blue-600 transition-colors">
                                    {pomPlayer.name}
                                </Link>
                                <div className="hidden md:flex gap-4 mt-3">
                                    {pomStats?.bat && (pomStats.bat.runs > 0 || pomStats.bat.balls > 0) && (
                                        <div className="text-xs font-bold text-slate-500">Bat: <span className="text-slate-900 font-black">{pomStats.bat.runs}({pomStats.bat.balls})</span></div>
                                    )}
                                    {pomStats?.bowl && (pomStats.bowl.wickets > 0 || parseFloat(String(pomStats.bowl.overs || 0)) > 0) && (
                                        <div className="text-xs font-bold text-slate-500">Bowl: <span className="text-slate-900 font-black">{pomStats.bowl.wickets}-{pomStats.bowl.runsConceded}</span></div>
                                    )}
                                </div>
                            </div>

                            <div className="md:hidden text-right shrink-0">
                                {pomStats?.bat && <div className="text-xs font-black text-slate-900">{pomStats.bat.runs} <span className="text-[8px] font-medium text-slate-400">({pomStats.bat.balls})</span></div>}
                                {pomStats?.bowl && <div className="text-xs font-black text-emerald-600">{pomStats.bowl.wickets}-{pomStats.bowl.runsConceded}</div>}
                            </div>

                            {(user as any)?.isAdmin && (
                                <button onClick={startEditingPom} className="p-2 text-slate-300 hover:text-blue-600">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                            )}

                            {isEditingPom && (
                                <div className="absolute inset-0 bg-white/98 z-30 flex items-center justify-center p-4 rounded-3xl">
                                    <select
                                        className="grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold"
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
                                    <button onClick={() => setIsEditingPom(false)} className="ml-2 text-[10px] font-black text-red-500 uppercase">Close</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. Balanced Top Performers */}
                <div className="mt-10 md:mt-16">
                    <div className="flex items-center gap-3 mb-6 px-1">
                        <div className="w-1 h-6 bg-slate-900 rounded-full"></div>
                        <h3 className="text-sm md:text-xl font-black text-slate-800 uppercase tracking-tight">Key Match Performers</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 pb-12">
                        {firstBatSide === 'A' ? (
                            <>
                                <div className="space-y-4">{renderInningsPerformers(teamAInnings, teamAName, '1st Innings')}</div>
                                <div className="space-y-4">{renderInningsPerformers(teamBInnings, teamBName, '2nd Innings')}</div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-4">{renderInningsPerformers(teamBInnings, teamBName, '1st Innings')}</div>
                                <div className="space-y-4">{renderInningsPerformers(teamAInnings, teamAName, '2nd Innings')}</div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MatchSummary
