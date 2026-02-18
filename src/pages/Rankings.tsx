
import { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { motion, AnimatePresence } from 'framer-motion'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { Tournament } from '@/types'
import { UserCircle, Trophy, Medal, Filter, RefreshCw, SwatchBook, Swords, Target, LayoutGrid, ChevronDown } from 'lucide-react'
import { calculateFantasyPoints, calculateBattingPoints, calculateBowlingPoints } from '@/utils/statsCalculator'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'react-hot-toast'
import { tournamentService } from '@/services/firestore/tournaments'

export default function Rankings() {
    const [players, setPlayers] = useState<any[]>([])
    const [squads, setSquads] = useState<any[]>([])
    const [tournaments, setTournaments] = useState<Tournament[]>([])
    const [loading, setLoading] = useState(true)
    const [rankMode, setRankMode] = useState<'overall' | 'batting' | 'bowling'>('overall')
    const [selectedSquadId, setSelectedSquadId] = useState<string>('all')
    const [selectedTournamentId, setSelectedTournamentId] = useState<string>('all')
    const [isSyncing, setIsSyncing] = useState(false)
    const [showFilters, setShowFilters] = useState(false)
    const { user } = useAuthStore()

    const loadData = async () => {
        try {
            setLoading(true)
            const [allPlayers, allSquads, allTournaments] = await Promise.all([
                playerService.getAll(),
                squadService.getAll(),
                tournamentService.getAll()
            ])

            setSquads(allSquads)
            setTournaments(allTournaments)

            setPlayers(allPlayers)
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSync = async () => {
        if (isSyncing) return
        try {
            setIsSyncing(true)
            const result = await playerService.bulkSyncAllPlayers()
            toast.success(`Success! Synced ${result.success}/${result.total} players.`)
            await loadData() // Reload rankings after sync
        } catch (error) {
            console.error('Sync failed:', error)
            toast.error('Sync failed. Please try again.')
        } finally {
            setIsSyncing(false)
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const containerRef = useRef<HTMLDivElement>(null)



    const filteredRankings = useMemo(() => {
        let list = players.map(player => {
            const stats = selectedTournamentId === 'all'
                ? player.stats
                : (player.tournamentStats?.[selectedTournamentId] || null)

            return {
                ...player,
                displayStats: stats,
                displayPoints: {
                    overall: calculateFantasyPoints(stats),
                    batting: calculateBattingPoints(stats),
                    bowling: calculateBowlingPoints(stats)
                }
            }
        }).filter(player => {
            // Squad & Tournament filter
            const matchesSquad = selectedSquadId === 'all' || player.squadId === selectedSquadId
            const hasStats = !!player.displayStats

            return matchesSquad && hasStats
        })

        // Sort by current rank mode
        return [...list].sort((a, b) => b.displayPoints[rankMode] - a.displayPoints[rankMode])
            .filter(p => p.displayPoints[rankMode] > 0) // Hide players with 0 points in that category
    }, [players, rankMode, selectedSquadId, selectedTournamentId])

    // GSAP Animations
    useEffect(() => {
        if (!loading && filteredRankings.length > 0) {
            const ctx = gsap.context(() => {
                gsap.fromTo(".ranking-card",
                    { x: -30, opacity: 0 },
                    {
                        x: 0,
                        opacity: 1,
                        duration: 0.5,
                        stagger: 0.05,
                        ease: "power2.out",
                        clearProps: "all"
                    }
                )
            }, containerRef)
            return () => ctx.revert()
        }
    }, [loading, filteredRankings.length])

    const getRankBadge = (index: number) => {
        if (index === 0) return <Trophy className="text-amber-500" size={24} />
        if (index === 1) return <Medal className="text-slate-400" size={24} />
        if (index === 2) return <Medal className="text-amber-700" size={24} />
        return <span className="text-lg font-black text-slate-400">#{index + 1}</span>
    }

    return (
        <div ref={containerRef} className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 font-sans pt-16">
            <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/5 pb-2 px-6">
                <div className="max-w-4xl mx-auto">
                    {/* Mode & Filter Section */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="flex-1 flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                            <button
                                onClick={() => setRankMode('overall')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${rankMode === 'overall' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                            >
                                <LayoutGrid size={14} />
                                Overall
                            </button>
                            <button
                                onClick={() => setRankMode('batting')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${rankMode === 'batting' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                            >
                                <Swords size={14} />
                                Batting
                            </button>
                            <button
                                onClick={() => setRankMode('bowling')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${rankMode === 'bowling' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                            >
                                <Target size={14} />
                                Bowling
                            </button>
                        </div>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-3.5 rounded-2xl transition-all border shrink-0 ${showFilters
                                ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-400 hover:border-blue-500/50 shadow-sm'}`}
                        >
                            <Filter size={20} strokeWidth={showFilters ? 3 : 2} />
                        </button>
                    </div>

                    {(user?.role === 'admin' || user?.role === 'super_admin') && (
                        <div className="mb-6 flex justify-end">
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className={`flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-all font-black text-[9px] uppercase tracking-widest border border-slate-200 dark:border-white/5 hover:border-emerald-200 ${isSyncing ? 'opacity-50' : ''}`}
                            >
                                <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                                {isSyncing ? 'Syncing...' : 'Sync Data'}
                            </button>
                        </div>
                    )}

                    <AnimatePresence>
                        {showFilters && (
                            <motion.div
                                initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                                animate={{ height: 'auto', opacity: 1, marginBottom: 24 }}
                                exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-200 dark:border-white/10">
                                    {/* Squad Filter */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Filter by Squad</label>
                                        <div className="relative">
                                            <select
                                                value={selectedSquadId}
                                                onChange={(e) => setSelectedSquadId(e.target.value)}
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 appearance-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                                            >
                                                <option value="all">Every Squad</option>
                                                {squads.map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} ({s.batch})</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <ChevronDown size={14} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tournament Filter */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Filter by Tournament</label>
                                        <div className="relative">
                                            <select
                                                value={selectedTournamentId}
                                                onChange={(e) => setSelectedTournamentId(e.target.value)}
                                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl px-5 py-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 appearance-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                                            >
                                                <option value="all">Overall Career</option>
                                                {tournaments.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name} {t.year}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                                <SwatchBook size={14} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-8">
                {/* Top 3 Podium */}
                {!loading && filteredRankings.length >= 3 && (
                    <div className="flex items-end justify-center gap-2 sm:gap-4 mb-12 mt-4 px-2">
                        {/* 2nd Place */}
                        <Link to={`/players/${filteredRankings[1].id}`} className="flex-1 max-w-[120px] flex flex-col items-center group">
                            <div className="relative mb-3">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 overflow-hidden group-hover:scale-105 transition-transform">
                                    {filteredRankings[1].photoUrl ? (
                                        <img src={filteredRankings[1].photoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                                            <UserCircle size={32} />
                                        </div>
                                    )}
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-slate-400 text-white flex items-center justify-center text-sm font-black shadow-lg border-2 border-white dark:border-slate-900">
                                    2
                                </div>
                            </div>
                            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase truncate w-full text-center">{filteredRankings[1].name}</span>
                            <span className="text-[14px] font-black text-slate-400 tabular-nums">{filteredRankings[1].displayPoints[rankMode]}</span>
                        </Link>

                        {/* 1st Place */}
                        <Link to={`/players/${filteredRankings[0].id}`} className="flex-1 max-w-[140px] flex flex-col items-center group -translate-y-4">
                            <div className="relative mb-4">
                                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                                    <Trophy size={28} className="text-amber-500 animate-bounce" />
                                </div>
                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-amber-50 dark:bg-amber-500/10 border-4 border-amber-400/30 overflow-hidden group-hover:scale-105 transition-transform shadow-xl shadow-amber-500/10">
                                    {filteredRankings[0].photoUrl ? (
                                        <img src={filteredRankings[0].photoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-amber-500">
                                            <UserCircle size={40} />
                                        </div>
                                    )}
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center text-lg font-black shadow-lg border-2 border-white dark:border-slate-900">
                                    1
                                </div>
                            </div>
                            <span className="text-[12px] font-black text-slate-900 dark:text-white uppercase truncate w-full text-center">{filteredRankings[0].name}</span>
                            <span className="text-[18px] font-black text-amber-500 tabular-nums">{filteredRankings[0].displayPoints[rankMode]}</span>
                        </Link>

                        {/* 3rd Place */}
                        <Link to={`/players/${filteredRankings[2].id}`} className="flex-1 max-w-[120px] flex flex-col items-center group">
                            <div className="relative mb-3">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-amber-700/30 overflow-hidden group-hover:scale-105 transition-transform">
                                    {filteredRankings[2].photoUrl ? (
                                        <img src={filteredRankings[2].photoUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-amber-800">
                                            <UserCircle size={32} />
                                        </div>
                                    )}
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-800 text-white flex items-center justify-center text-sm font-black shadow-lg border-2 border-white dark:border-slate-900">
                                    3
                                </div>
                            </div>
                            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase truncate w-full text-center">{filteredRankings[2].name}</span>
                            <span className="text-[14px] font-black text-slate-400 tabular-nums">{filteredRankings[2].displayPoints[rankMode]}</span>
                        </Link>
                    </div>
                )}

                <div className="space-y-4">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-24 bg-white dark:bg-slate-900 rounded-3xl animate-pulse border border-slate-100 dark:border-white/5"></div>
                            ))}
                        </div>
                    ) : filteredRankings.length === 0 ? (
                        <div className="py-32 flex flex-col items-center justify-center text-center px-8">
                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                                <Filter className="text-slate-300 dark:text-slate-600" size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tight mb-2">No Rankings Found</h3>
                            <p className="text-slate-400 text-sm max-w-xs font-bold">
                                Try adjusting your filters. If you're an admin, make sure to sync all stats first.
                            </p>
                            {(selectedSquadId !== 'all' || selectedTournamentId !== 'all') && (
                                <button
                                    onClick={() => {
                                        setSelectedSquadId('all')
                                        setSelectedTournamentId('all')
                                    }}
                                    className="mt-8 text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline"
                                >
                                    Reset All Filters
                                </button>
                            )}
                        </div>
                    ) : (
                        filteredRankings.slice(filteredRankings.length >= 3 ? 3 : 0).map((player, index) => {
                            const actualIndex = filteredRankings.length >= 3 ? index + 3 : index
                            const squad = squads.find(s => s.id === player.squadId)
                            const squadName = squad?.name || 'Unassigned'
                            const points = player.displayPoints[rankMode] || 0

                            return (
                                <Link
                                    key={player.id}
                                    to={`/players/${player.id}`}
                                    className="ranking-card group flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-100 dark:border-white/5 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 relative overflow-hidden"
                                >
                                    {/* Rank */}
                                    <div className="w-12 h-12 shrink-0 flex items-center justify-center">
                                        {getRankBadge(actualIndex)}
                                    </div>

                                    {/* Avatar */}
                                    <div className="w-14 h-14 shrink-0 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-50 dark:border-white/5">
                                        {player.photoUrl ? (
                                            <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <UserCircle className="text-slate-300 dark:text-slate-600" size={32} strokeWidth={1.5} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase truncate group-hover:text-blue-600 transition-colors">
                                            {player.name}
                                        </h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{squadName}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
                                            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">
                                                {(player.role || 'All Rounder').replace('-', ' ')}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Points */}
                                    <div className="text-right px-4">
                                        <div className="text-2xl font-black text-slate-900 dark:text-white leading-none tabular-nums">
                                            {points}
                                        </div>
                                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">
                                            {rankMode === 'overall' ? 'Points' : rankMode === 'batting' ? 'Batting' : 'Bowling'}
                                        </div>
                                    </div>

                                    {/* Background Accent */}
                                    <div className="absolute top-0 right-0 w-32 h-full bg-linear-to-l from-blue-500/5 to-transparent pointer-events-none"></div>
                                </Link>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
