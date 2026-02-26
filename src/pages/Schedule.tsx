import { useEffect, useState, useMemo, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { squadService } from '@/services/firestore/squads'
import { tournamentService } from '@/services/firestore/tournaments'
import { Match, Squad } from '@/types'
import MatchCard from '@/components/match/MatchCard'
import MatchCardSkeleton from '@/components/skeletons/MatchCardSkeleton'
import { coerceToDate, formatDateLabel } from '@/utils/date'

export default function Schedule() {
    const [searchParams, setSearchParams] = useSearchParams()
    const initialTab = (searchParams.get('tab') as any) || 'upcoming'
    const [activeTab, setActiveTab] = useState<'live' | 'upcoming' | 'finished'>(initialTab)

    const [allMatches, setAllMatches] = useState<Match[]>([])
    const [squads, setSquads] = useState<Squad[]>([])
    const [tournamentsMap, setTournamentsMap] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)

    const tabsOrder: ('upcoming' | 'live' | 'finished')[] = ['upcoming', 'live', 'finished'];
    const currentTabIndex = tabsOrder.indexOf(activeTab);
    const isAnimatingRef = useRef(false);
    const x = useMotionValue(0);
    const animatedX = useTransform(x, (value) => `calc(-${currentTabIndex * 100}% + ${value}px)`);

    useEffect(() => {
        if (!isAnimatingRef.current) {
            animate(x, 0, { type: 'spring', stiffness: 300, damping: 30, mass: 0.5 });
        }
    }, [currentTabIndex, x]);

    useEffect(() => {
        const unsubscribeSquads = squadService.subscribeAll(setSquads)
        return () => unsubscribeSquads()
    }, [])

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true)
                // Load all tournaments for map
                const allTournaments = await tournamentService.getAll()
                const tMap: Record<string, string> = {}
                allTournaments.forEach(t => { tMap[t.id] = t.name })
                setTournamentsMap(tMap)

                // Load all matches once
                const all = await matchService.getAll()
                setAllMatches(all)
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        loadInitialData()
    }, [])

    const squadsMap = squads.reduce((acc, s) => {
        acc[s.id] = s
        return acc
    }, {} as Record<string, Squad>)

    // Local filtering and grouping logic
    const getMatchesForTab = (tab: 'upcoming' | 'live' | 'finished') => {
        const statusLower = (m: any) => String(m?.status || '').toLowerCase().trim()

        const filtered = allMatches.filter(m => {
            const s = statusLower(m)
            if (tab === 'live') return s === 'live'
            if (tab === 'finished') return ['finished', 'completed'].includes(s)
            if (tab === 'upcoming') return s === '' || s === 'upcoming' || s === 'scheduled'
            return false
        })

        // Sort
        filtered.sort((a, b) => {
            const da = coerceToDate(a.date)?.getTime() || 0
            const db = coerceToDate(b.date)?.getTime() || 0
            return tab === 'finished' ? db - da : da - db
        })

        // Group by date
        const grouped: Record<string, Match[]> = {}
        filtered.forEach(m => {
            const d = coerceToDate(m.date)
            const dateKey = d ? d.toDateString() : 'Unknown Date'
            if (!grouped[dateKey]) grouped[dateKey] = []
            grouped[dateKey].push(m)
        })

        const dateKeys = Object.keys(grouped).sort((a, b) => {
            const da = new Date(a).getTime() || 0
            const db = new Date(b).getTime() || 0
            return tab === 'finished' ? db - da : da - db
        })

        return { grouped, dateKeys, count: filtered.length }
    }

    const upcomingData = useMemo(() => getMatchesForTab('upcoming'), [allMatches])
    const liveData = useMemo(() => getMatchesForTab('live'), [allMatches])
    const finishedData = useMemo(() => getMatchesForTab('finished'), [allMatches])

    const activeData = useMemo(() => {
        if (activeTab === 'live') return liveData;
        if (activeTab === 'finished') return finishedData;
        return upcomingData;
    }, [activeTab, upcomingData, liveData, finishedData])

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#060b16] pb-20">
            {/* Header */}
            <div className="bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-white/5 sticky top-0 z-30">
                <div className="max-w-4xl mx-auto">
                    <div className="px-6 py-6 flex items-center justify-between">
                        <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">Match Schedule</h1>
                        <div className="flex gap-1.5 items-center">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{activeData.count} Matches Found</span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex px-4 overflow-x-auto scrollbar-hide">
                        {(['upcoming', 'live', 'finished'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => {
                                    setActiveTab(tab)
                                    setSearchParams({ tab })
                                }}
                                className={`px-8 py-4 text-xs font-black uppercase tracking-widest relative transition-all whitespace-nowrap ${activeTab === tab ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                                    }`}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <motion.div
                                        layoutId="activeTabUnderlineSchedule"
                                        className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8">
                {loading ? (
                    <div className="space-y-12">
                        {[1, 2].map(g => (
                            <div key={g} className="space-y-6">
                                {/* Date Heading Skeleton */}
                                <div className="flex items-center gap-4">
                                    <div className="w-32 h-6 bg-blue-100 dark:bg-blue-900/20 rounded-full animate-pulse" />
                                    <div className="h-px bg-slate-200 dark:bg-white/5 flex-1" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[1, 2].map(i => <MatchCardSkeleton key={i} />)}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <motion.div
                        style={{ x: animatedX, willChange: 'transform' }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={1} // 1:1 tracking
                        onDragStart={() => {
                            isAnimatingRef.current = true;
                        }}
                        onDragEnd={(_e, info) => {
                            const swipeThreshold = window.innerWidth * 0.25;
                            const velocityThreshold = 400;

                            if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
                                if (currentTabIndex < tabsOrder.length - 1) {
                                    const nextTab = tabsOrder[currentTabIndex + 1];
                                    setActiveTab(nextTab);
                                    setSearchParams({ tab: nextTab });
                                }
                            } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
                                if (currentTabIndex > 0) {
                                    const prevTab = tabsOrder[currentTabIndex - 1];
                                    setActiveTab(prevTab);
                                    setSearchParams({ tab: prevTab });
                                }
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
                        className="flex w-full"
                    >
                        {[upcomingData, liveData, finishedData].map((tabData, idx) => (
                            <div key={idx} className="w-full shrink-0">
                                {tabData.dateKeys.length === 0 ? (
                                    <div className="bg-white dark:bg-[#0f172a] rounded-3xl p-16 text-center border border-slate-200 dark:border-white/5 shadow-sm">
                                        <div className="text-5xl mb-6">📅</div>
                                        <h3 className="text-xl font-bold text-black dark:text-white mb-2 capitalize">No {['upcoming', 'live', 'finished'][idx]} matches found</h3>
                                        <p className="text-slate-400 dark:text-slate-500 text-sm">Check other tabs for more matches.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-12 pr-1"> {/* Slightly pad to avoid horizontal snap issues */}
                                        {tabData.dateKeys.map((dateKey: string) => (
                                            <div key={dateKey} className="space-y-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-md shadow-blue-500/20">
                                                        {formatDateLabel(new Date(dateKey))}
                                                    </div>
                                                    <div className="h-px bg-slate-200 dark:bg-white/5 flex-1"></div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {tabData.grouped[dateKey].map((m: Match) => (
                                                        <MatchCard key={m.id} match={m} squadsMap={squadsMap} tournamentName={tournamentsMap[m.tournamentId || '']} />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </motion.div>
                )}
            </div>
        </div>
    )
}
