
import { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { Tournament } from '@/types'
import { UserCircle, Trophy, Filter, RefreshCw, SwatchBook, Swords, Target, LayoutGrid, ChevronDown } from 'lucide-react'
import { calculateFantasyPoints, calculateBattingPoints, calculateBowlingPoints } from '@/utils/statsCalculator'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'react-hot-toast'
import { tournamentService } from '@/services/firestore/tournaments'
import RankingsSkeleton from '@/components/skeletons/RankingsSkeleton'


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

    const modesOrder: ('overall' | 'batting' | 'bowling')[] = ['overall', 'batting', 'bowling'];
    const currentModeIndex = modesOrder.indexOf(rankMode);
    const isAnimatingRef = useRef(false);
    const x = useMotionValue(0);
    const animatedX = useTransform(x, (value) => `calc(-${currentModeIndex * 100}% + ${value}px)`);

    useEffect(() => {
        if (!isAnimatingRef.current) {
            animate(x, 0, { type: 'spring', stiffness: 300, damping: 30, mass: 0.5 });
        }
    }, [currentModeIndex, x]);

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
        // Subscribe to players for instant ranking updates
        const unsubPlayers = playerService.subscribeAll((allPlayers) => {
            setPlayers(allPlayers)
        })

        // Load other static-ish data normally
        const loadInitialData = async () => {
            try {
                const [allSquads, allTournaments] = await Promise.all([
                    squadService.getAll(),
                    tournamentService.getAll()
                ])
                setSquads(allSquads)
                setTournaments(allTournaments)
            } catch (error) {
                console.error('Error loading squads/tournaments:', error)
            } finally {
                setLoading(false)
            }
        }

        loadInitialData()

        return () => {
            unsubPlayers()
        }
    }, [])

    const containerRef = useRef<HTMLDivElement>(null)



    // Optimized: Calculate all rankings once in a single useMemo
    const memoizedRankings = useMemo(() => {
        if (!players.length) return { overall: [], batting: [], bowling: [] };

        // 1. Pre-filter and pre-calculate points for all relevant players ONCE
        const baseList = players.map(player => {
            const stats = selectedTournamentId === 'all'
                ? player.stats
                : (player.tournamentStats?.[selectedTournamentId] || null);

            // If player doesn't have stats for this tournament, or doesn't match squad, skip
            if (!stats || (selectedSquadId !== 'all' && player.squadId !== selectedSquadId)) return null;

            return {
                ...player,
                displayStats: stats,
                points: {
                    overall: calculateFantasyPoints(stats),
                    batting: calculateBattingPoints(stats),
                    bowling: calculateBowlingPoints(stats)
                }
            };
        }).filter((p): p is NonNullable<typeof p> => p !== null);

        // 2. Helper to get sorted top 100 for a specific mode
        const getTopForMode = (mode: 'overall' | 'batting' | 'bowling') => {
            return baseList
                .filter(p => p.points[mode] > 0)
                .sort((a, b) => b.points[mode] - a.points[mode])
                .slice(0, 100); // Only keep top 100 for performance
        };

        return {
            overall: getTopForMode('overall'),
            batting: getTopForMode('batting'),
            bowling: getTopForMode('bowling')
        };
    }, [players, selectedSquadId, selectedTournamentId]);

    // Used for GSAP trigger only
    const currentModeRankings = memoizedRankings[rankMode];

    // GSAP Animations (Scoped to active mode)
    useEffect(() => {
        if (!loading && currentModeRankings.length > 0) {
            const ctx = gsap.context(() => {
                const selector = `.ranking-card-${rankMode}`;
                const targets = containerRef.current?.querySelectorAll(selector);

                if (targets && targets.length > 0) {
                    gsap.fromTo(selector,
                        { y: 15, opacity: 0 },
                        {
                            y: 0,
                            opacity: 1,
                            duration: 0.35,
                            stagger: 0.02,
                            ease: "power2.out",
                            clearProps: "all"
                        }
                    )
                }
            }, containerRef)
            return () => ctx.revert()
        }
    }, [loading, rankMode, selectedSquadId, selectedTournamentId])



    return (
        <div ref={containerRef} className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 font-sans pt-16">
            <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/5 pb-2 px-6">
                <div className="max-w-4xl mx-auto">
                    {/* Mode & Filter Section */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="flex-1 flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl relative">
                            {(['overall', 'batting', 'bowling'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setRankMode(mode)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative z-10 ${rankMode === mode ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}
                                >
                                    {mode === 'overall' && <LayoutGrid size={14} />}
                                    {mode === 'batting' && <Swords size={14} />}
                                    {mode === 'bowling' && <Target size={14} />}
                                    {mode}
                                    {rankMode === mode && (
                                        <motion.div
                                            layoutId="rankModeActive"
                                            className="absolute inset-0 bg-white dark:bg-slate-700 rounded-xl shadow-sm -z-10"
                                            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                </button>
                            ))}
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

            {/* 4. Tab Content with Dynamic Carousel & Swipe Support */}
            <div className="relative w-full overflow-hidden">
                <motion.div
                    style={{ x: animatedX, willChange: 'transform' }}
                    drag="x"
                    dragDirectionLock
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={1} // 1:1 tracking
                    onDragStart={() => {
                        isAnimatingRef.current = true;
                    }}
                    onDragEnd={(_, info) => {
                        const swipeThreshold = window.innerWidth * 0.25;
                        const velocityThreshold = 400;

                        if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
                            if (currentModeIndex < modesOrder.length - 1) setRankMode(modesOrder[currentModeIndex + 1]);
                        } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
                            if (currentModeIndex > 0) setRankMode(modesOrder[currentModeIndex - 1]);
                        }

                        animate(x, 0, {
                            type: 'spring',
                            stiffness: 400,
                            damping: 40,
                            velocity: info.velocity.x
                        });

                        setTimeout(() => {
                            isAnimatingRef.current = false;
                        }, 50);
                    }}
                    className="flex w-full items-start touch-pan-y"
                >
                    {(['overall', 'batting', 'bowling'] as const).map((currentMode) => {
                        const listForMode = memoizedRankings[currentMode];

                        return (
                            <div key={currentMode} className="w-full shrink-0 px-4 sm:px-6">
                                {/* Top 3 Podium for this mode */}
                                {!loading && listForMode.length >= 3 && (
                                    <div className="flex items-end justify-center gap-2 sm:gap-4 mb-12 mt-4 px-2">
                                        {/* 2nd Place */}
                                        <Link to={`/players/${listForMode[1].id}`} className="flex-1 max-w-[120px] flex flex-col items-center group">
                                            <div className="relative mb-3">
                                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 overflow-hidden group-hover:scale-105 transition-transform">
                                                    {listForMode[1].photoUrl ? (
                                                        <img src={listForMode[1].photoUrl} alt="" className="w-full h-full object-cover" />
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
                                            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase truncate w-full text-center">{listForMode[1].name}</span>
                                            <span className="text-[14px] font-black text-slate-400 tabular-nums">{listForMode[1].points[currentMode]}</span>
                                        </Link>

                                        {/* 1st Place */}
                                        <Link to={`/players/${listForMode[0].id}`} className="flex-1 max-w-[140px] flex flex-col items-center group -translate-y-4">
                                            <div className="relative mb-4">
                                                <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                                                    <Trophy size={28} className="text-amber-500 animate-bounce" />
                                                </div>
                                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-amber-50 dark:bg-amber-500/10 border-4 border-amber-400/30 overflow-hidden group-hover:scale-105 transition-transform shadow-xl shadow-amber-500/10">
                                                    {listForMode[0].photoUrl ? (
                                                        <img src={listForMode[0].photoUrl} alt="" className="w-full h-full object-cover" />
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
                                            <span className="text-[12px] font-black text-slate-900 dark:text-white uppercase truncate w-full text-center">{listForMode[0].name}</span>
                                            <span className="text-[18px] font-black text-amber-500 tabular-nums">{listForMode[0].points[currentMode]}</span>
                                        </Link>

                                        {/* 3rd Place */}
                                        <Link to={`/players/${listForMode[2].id}`} className="flex-1 max-w-[120px] flex flex-col items-center group">
                                            <div className="relative mb-3">
                                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-amber-700/30 overflow-hidden group-hover:scale-105 transition-transform">
                                                    {listForMode[2].photoUrl ? (
                                                        <img src={listForMode[2].photoUrl} alt="" className="w-full h-full object-cover" />
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
                                            <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase truncate w-full text-center">{listForMode[2].name}</span>
                                            <span className="text-[14px] font-black text-slate-400 tabular-nums">{listForMode[2].points[currentMode]}</span>
                                        </Link>
                                    </div>
                                )}

                                <div className="space-y-4 pb-20">
                                    {loading ? (
                                        <RankingsSkeleton />
                                    ) : listForMode.length === 0 ? (
                                        <div className="py-20 flex flex-col items-center justify-center text-center">
                                            <p className="text-slate-500 font-bold">No players found</p>
                                        </div>
                                    ) : (
                                        // Lazy Render: Only render list items for the ACTIVE tab to save DOM complexity
                                        rankMode === currentMode && listForMode.slice(listForMode.length >= 3 ? 3 : 0).map((player, index) => {
                                            const actualIndex = listForMode.length >= 3 ? index + 3 : index
                                            const squad = squads.find(s => s.id === player.squadId)
                                            const squadName = squad?.name || 'Unassigned'
                                            const points = player.points[currentMode]

                                            return (
                                                <Link
                                                    key={player.id}
                                                    to={`/players/${player.id}`}
                                                    className={`ranking-card-${currentMode} group flex items-center gap-3 bg-white dark:bg-slate-900 p-2.5 px-4 rounded-2xl border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all duration-300 relative`}
                                                >
                                                    <div className="w-5 shrink-0 text-[11px] font-black text-slate-400 tabular-nums">{actualIndex + 1}</div>
                                                    <div className="w-10 h-10 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-50 dark:border-white/5">
                                                        {player.photoUrl ? (
                                                            <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <UserCircle className="text-slate-300 dark:text-slate-600" size={24} strokeWidth={1.5} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-[13px] font-black text-slate-800 dark:text-slate-100 uppercase truncate group-hover:text-blue-600 transition-colors">{player.name}</h3>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{squadName}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-black text-slate-900 dark:text-white leading-none tabular-nums">{points}</div>
                                                        <div className="text-[8px] font-black text-slate-500/60 uppercase tracking-widest mt-0.5">
                                                            {currentMode === 'overall' ? 'PTS' : currentMode === 'batting' ? 'BAT' : 'BOWL'}
                                                        </div>
                                                    </div>
                                                </Link>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </motion.div>
            </div>
        </div>
    )
}
