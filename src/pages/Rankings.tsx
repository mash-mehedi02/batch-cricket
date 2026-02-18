
import { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { Player, Squad } from '@/types'
import { UserCircle, Trophy, Medal, Star, Filter, RefreshCw } from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { calculateFantasyPoints } from '@/utils/statsCalculator'
import schoolConfig from '@/config/school'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'react-hot-toast'

export default function Rankings() {
    const [players, setPlayers] = useState<Player[]>([])
    const [squads, setSquads] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)
    const [activeCategory, setActiveCategory] = useState<string>('all')
    const [isSyncing, setIsSyncing] = useState(false)
    const { t } = useTranslation()
    const { user } = useAuthStore()

    const loadData = async () => {
        try {
            setLoading(true)
            const [allPlayers, allSquads] = await Promise.all([
                playerService.getAll(),
                squadService.getAll()
            ])

            const squadMap: Record<string, string> = {}
            allSquads.forEach((s: Squad) => {
                squadMap[s.id] = s.name
            })

            // Sort players by fantasy points initially
            const playersWithPoints = allPlayers.map(p => ({
                ...p,
                fantasyPoints: calculateFantasyPoints(p.stats)
            })).sort((a, b) => b.fantasyPoints - a.fantasyPoints)

            setPlayers(playersWithPoints as any)
            setSquads(squadMap)
        } catch (error) {
            console.error('Error loading players/squads:', error)
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

    const categories = [
        { id: 'all', label: t('filter_all') },
        { id: 'batsman', label: t('batsman') },
        { id: 'bowler', label: t('bowler') },
        { id: 'all-rounder', label: t('all_rounder') },
    ]

    const filteredRankings = useMemo(() => {
        return players.filter(player => {
            const matchesCategory = activeCategory === 'all' ||
                (activeCategory === 'batsman' && (player.role === 'batsman' || player.role === 'wicket-keeper')) ||
                (activeCategory === 'bowler' && player.role === 'bowler') ||
                (activeCategory === 'all-rounder' && player.role === 'all-rounder')
            return matchesCategory
        })
    }, [players, activeCategory])

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
    }, [loading, activeCategory, filteredRankings.length])

    const getRankBadge = (index: number) => {
        if (index === 0) return <Trophy className="text-amber-500" size={24} />
        if (index === 1) return <Medal className="text-slate-400" size={24} />
        if (index === 2) return <Medal className="text-amber-700" size={24} />
        return <span className="text-lg font-black text-slate-400">#{index + 1}</span>
    }

    return (
        <div ref={containerRef} className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 font-sans">
            {/* Header Section */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-white/5 pt-12 pb-8 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-4 mb-2">
                        <Star className="text-amber-500 fill-amber-500" size={20} />
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{schoolConfig.appName}</span>
                    </div>
                    <div className="flex items-center justify-between mb-6">
                        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter leading-none">
                            Player Rankings
                        </h1>

                        {(user?.role === 'admin' || user?.role === 'super_admin') && (
                            <button
                                onClick={handleSync}
                                disabled={isSyncing}
                                className={`flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border border-slate-200 dark:border-white/5 hover:border-emerald-200 ${isSyncing ? 'opacity-50' : ''}`}
                            >
                                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                                {isSyncing ? 'Syncing...' : 'Sync All Stats'}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg mr-2 shrink-0">
                            <Filter size={18} className="text-slate-500" />
                        </div>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={`px-5 py-2.5 rounded-xl transition-all whitespace-nowrap text-xs font-black uppercase tracking-widest ${activeCategory === cat.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 sm:px-6 mt-8 space-y-4">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-24 bg-white dark:bg-slate-900 rounded-3xl animate-pulse border border-slate-100 dark:border-white/5"></div>
                        ))}
                    </div>
                ) : filteredRankings.length === 0 ? (
                    <div className="py-20 text-center">
                        <h3 className="text-2xl font-black text-slate-400 uppercase italic">No Rankings Found</h3>
                    </div>
                ) : (
                    filteredRankings.map((player, index) => {
                        const squadName = squads[player.squadId] || 'Unassigned'
                        const points = (player as any).fantasyPoints || 0

                        return (
                            <Link
                                key={player.id}
                                to={`/players/${player.id}`}
                                className="ranking-card group flex items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-100 dark:border-white/5 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 relative overflow-hidden"
                            >
                                {/* Rank */}
                                <div className="w-12 h-12 shrink-0 flex items-center justify-center">
                                    {getRankBadge(index)}
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
                                        Points
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
    )
}
