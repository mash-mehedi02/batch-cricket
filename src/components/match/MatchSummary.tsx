import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Match, InningsStats } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { matchService } from '@/services/firestore/matches'

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
        // Calculate result if summary missing
        if (teamAInnings && teamBInnings) {
            const inningsA = teamAInnings
            const inningsB = teamBInnings
            // Determine who batted first to be accurate (though simple diff works for casual text usually)
            // Let's rely on standard: if status is finished
            if (inningsA.totalRuns > inningsB.totalRuns) {
                return `${teamAName} won by ${inningsA.totalRuns - inningsB.totalRuns} runs`
            }
            if (inningsB.totalRuns > inningsA.totalRuns) {
                return `${teamBName} won by ${10 - inningsB.totalWickets} wickets` // Assuming B chased
                // Wait, simplistic assumption. Just say "won".
                // Actually logic: If A batted first and A > B -> A won by runs.
                // If A batted first and B > A -> B won by wickets.
                // Let's check toss/elected
                const battedFirst = (match.tossWinner === 'teamA' && match.electedTo === 'bat') ||
                    (match.tossWinner === 'teamB' && match.electedTo === 'bowl')
                    ? 'teamA' : 'teamB'

                const firstInn = battedFirst === 'teamA' ? inningsA : inningsB
                const secondInn = battedFirst === 'teamA' ? inningsB : inningsA
                const firstTeam = battedFirst === 'teamA' ? teamAName : teamBName
                const secondTeam = battedFirst === 'teamA' ? teamBName : teamAName

                if (firstInn.totalRuns > secondInn.totalRuns) {
                    return `${firstTeam} won by ${firstInn.totalRuns - secondInn.totalRuns} runs`
                } else if (secondInn.totalRuns > firstInn.totalRuns) {
                    return `${secondTeam} won by ${10 - secondInn.totalWickets} wickets`
                } else {
                    return 'Match Tied'
                }
            }
        }
        return 'Match Finished'
    }, [match, teamAInnings, teamBInnings, teamAName, teamBName])

    // --- Auto Player of the Match Calculation ---
    // Simple MVP formula: Runs + (Wickets * 20) + (Maidens * 10) + (Catches * 5)
    // We assume fielding stats might be missing, so rely mainly on Bat/Bowl
    const calculatedPomId = useMemo(() => {
        if ((match as any).playerOfMatchId) return (match as any).playerOfMatchId

        let bestId = ''
        let maxPoints = -1



        // We need to aggregate first
        const playerPoints = new Map<string, number>()

        const addPoints = (id: string, pts: number) => {
            if (!id) return
            const c = playerPoints.get(id) || 0
            playerPoints.set(id, c + pts)
        }

        teamAInnings?.batsmanStats?.forEach(b => addPoints(b.batsmanId, (b.runs || 0) + (b.runs > 49 ? 20 : 0)))
        teamAInnings?.bowlerStats?.forEach(b => addPoints(b.bowlerId, (b.wickets * 20) + (b.wickets > 2 ? 10 : 0))) // simple logic

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
    const pomStatLabel = useMemo(() => {
        if (!calculatedPomId) return ''
        // Check A
        const batA = teamAInnings?.batsmanStats?.find(b => b.batsmanId === calculatedPomId)
        const bowlA = teamAInnings?.bowlerStats?.find(b => b.bowlerId === calculatedPomId)
        // Check B
        const batB = teamBInnings?.batsmanStats?.find(b => b.batsmanId === calculatedPomId)
        const bowlB = teamBInnings?.bowlerStats?.find(b => b.bowlerId === calculatedPomId)

        const bat = batA || batB
        const bowl = bowlA || bowlB

        const parts = []
        if (bat && bat.runs > 0) parts.push(`${bat.runs} runs`)
        if (bowl && bowl.wickets > 0) parts.push(`${bowl.wickets} wkts`)
        return parts.join(' & ')
    }, [calculatedPomId, teamAInnings, teamBInnings])



    // Top Batters (One from each innings usually, or just top scorers overall? 
    // Screenshot shows "RGR - 1st Inns" list. So it lists performers by innings.

    const renderInningsPerformers = (innings: InningsStats | null, teamName: string, inningLabel: string) => {
        if (!innings) return null
        // Wait, "Top Performers" for "RGR - 1st Inns" usually means RGR batsmen who performed in 1st inns.
        // The screenshot shows "Mohammad Mahmudullah 51(41)". This is a batsman.
        // "Ziaur Rahman Sharifi 2-35". This is a bowler. But if RGR batted 1st, Ziaur (bowler) would be from DC.
        // Standard apps usually group by "Innings 1" and show Best Batter (Team A) and Best Bowler (Team B).

        // Let's stick to the screenshot: "RGR - 1st Inns".
        // It list Mahmudullah (Bat), Khushdil (Bat), Ziaur (Bowl).
        // So it mixes Batters of that innings and Bowlers of that innings (who are from opposition).

        // Let's just find the top 3 impact players for this innings (Runs or Wickets).
        // Batters: from `innings.batsmanStats`.
        // Bowlers: from `innings.bowlerStats`.

        const topBatters = (innings.batsmanStats || [])
            .sort((a, b) => b.runs - a.runs)
            .slice(0, 2)
            .map(b => ({ ...b, type: 'bat' }))

        const topBowlers = (innings.bowlerStats || [])
            .sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)
            .filter(b => Number(b.overs) > 0) // Ensure they bowled
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
                                    <img
                                        src={player.photoUrl || 'https://via.placeholder.com/40'}
                                        alt={player.name}
                                        className="w-10 h-10 rounded-full object-cover border border-slate-100"
                                    />
                                    <div>
                                        <Link to={`/player/${pid}`} className="text-sm font-bold text-slate-900 hover:text-blue-600 hover:underline decoration-blue-400 underline-offset-2 transition-all block">
                                            {player.name}
                                        </Link>
                                        <div className="text-xs text-slate-500">
                                            {p.type === 'bat' ? `SR: ${p.strikeRate}` : `ER: ${p.economy}`}
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
            <div className="bg-[#1a1f3c] text-white p-6 pb-8 rounded-b-3xl shadow-lg relative overflow-hidden">
                {/* Teams Row */}
                <div className="flex items-center justify-between px-4 mt-8 relative z-10">
                    {/* Team A */}
                    <div className="flex flex-col items-center gap-2 w-1/3">
                        <img src={getTeamLogo('A')} alt={teamAName} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5 p-2 object-contain" />
                        <div className="text-sm sm:text-base font-bold text-center uppercase tracking-wide opacity-90">{teamAName}</div>
                        <div className="text-3xl sm:text-4xl font-black mt-1 tracking-tight">
                            {teamAInnings?.totalRuns || '0'}-{teamAInnings?.totalWickets || '0'}
                            <span className="text-base sm:text-lg font-medium text-white/50 ml-1">({teamAInnings?.overs || '0.0'})</span>
                        </div>
                    </div>

                    {/* Lightning Icon */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl md:text-7xl select-none pointer-events-none opacity-20 scale-150 mix-blend-overlay">
                        ⚡
                    </div>

                    {/* Team B */}
                    <div className="flex flex-col items-center gap-2 w-1/3">
                        <img src={getTeamLogo('B')} alt={teamBName} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/5 p-2 object-contain" />
                        <div className="text-sm sm:text-base font-bold text-center uppercase tracking-wide opacity-90">{teamBName}</div>
                        <div className="text-3xl sm:text-4xl font-black mt-1 tracking-tight">
                            {teamBInnings?.totalRuns || '0'}-{teamBInnings?.totalWickets || '0'}
                            <span className="text-base sm:text-lg font-medium text-white/50 ml-1">({teamBInnings?.overs || '0.0'})</span>
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


            {/* 2. Recent Overs (Last Innings) */}
            {/* Optional: Add if data available. Skipping to keep it simple as per "Summary" focus. */}

            {/* 3. Player of the Match */}
            {pomPlayer && (
                <div className="mx-4 -mt-6 relative z-10">
                    <div className="bg-white rounded-xl shadow-lg shadow-black/5 p-4 flex items-center gap-4 relative overflow-hidden group">
                        {/* Glow effect */}
                        <div className="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-300 to-amber-500" />

                        <img
                            src={pomPlayer.photoUrl || 'https://via.placeholder.com/60'}
                            alt={pomPlayer.name}
                            className="w-14 h-14 rounded-full object-cover border-2 border-amber-100 shadow-sm flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-0.5">Player of the Match</div>
                            <Link to={`/player/${calculatedPomId}`} className="text-sm font-black text-slate-900 truncate block hover:text-blue-600 transition-colors">
                                {pomPlayer.name}
                            </Link>
                            <div className="text-xs text-slate-500 font-medium">{pomStatLabel}</div>
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

                {/* Innings 1 (Team A batted) */}
                {renderInningsPerformers(teamAInnings, teamAName, '1st Inns')}

                {/* Innings 2 (Team B batted) */}
                {renderInningsPerformers(teamBInnings, teamBName, '2nd Inns')}
            </div>

        </div >
    )
}

export default MatchSummary
