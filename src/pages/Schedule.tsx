import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { squadService } from '@/services/firestore/squads'
import { tournamentService } from '@/services/firestore/tournaments'
import { Match, Squad } from '@/types'
import MatchCard from '@/components/match/MatchCard'
import MatchCardSkeleton from '@/components/skeletons/MatchCardSkeleton'
import { coerceToDate, formatDateLabel, getMatchTimestamp } from '@/utils/date'

export default function Schedule() {
    const [searchParams, setSearchParams] = useSearchParams()
    const initialTab = (searchParams.get('tab') as any) || 'upcoming'
    const [activeTab, setActiveTab] = useState<'live' | 'upcoming' | 'finished'>(initialTab)

    const [allMatches, setAllMatches] = useState<Match[]>([])
    const [squads, setSquads] = useState<Squad[]>([])
    const [tournamentsMap, setTournamentsMap] = useState<Record<string, string>>({})
    const [loading, setLoading] = useState(true)

    // Filters
    const [selectedTournament, setSelectedTournament] = useState<string>('all')
    const [selectedSchool, setSelectedSchool] = useState<string>('all')

    const tabsOrder: ('upcoming' | 'live' | 'finished')[] = ['upcoming', 'live', 'finished'];
    const currentTabIndex = tabsOrder.indexOf(activeTab);

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

    // Extracted schools and tournaments for filters (Smart: only show if present in current tab's total matches)
    const filterOptions = useMemo(() => {
        const schools = new Set<string>()
        const tournaments = new Set<string>()

        // Check which matches would even show up for this tab (ignoring current filters but respecting tab)
        const statusLower = (m: any) => String(m?.status || '').toLowerCase().trim()
        const tabMatches = allMatches.filter(m => {
            const s = statusLower(m)
            if (activeTab === 'live') return s === 'live'
            if (activeTab === 'finished') return ['finished', 'completed'].includes(s)
            if (activeTab === 'upcoming') return s === '' || s === 'upcoming' || s === 'scheduled'
            return false
        })

        tabMatches.forEach(m => {
            if (m.school) schools.add(m.school)
            if (m.tournamentId) tournaments.add(m.tournamentId)
        })

        return {
            schools: Array.from(schools).sort(),
            tournaments: Array.from(tournaments).map(id => ({ id, name: tournamentsMap[id] || 'Unknown' })).sort((a, b) => a.name.localeCompare(b.name))
        }
    }, [allMatches, tournamentsMap, activeTab])

    // Reset filters when tab changes IF the selected ones aren't available for the new tab
    useEffect(() => {
        if (selectedTournament !== 'all' && !filterOptions.tournaments.find(t => t.id === selectedTournament)) {
            setSelectedTournament('all')
        }
        if (selectedSchool !== 'all' && !filterOptions.schools.includes(selectedSchool)) {
            setSelectedSchool('all')
        }
    }, [activeTab, filterOptions, selectedTournament, selectedSchool])

    // Local filtering and grouping logic
    const getMatchesForTab = (tab: 'upcoming' | 'live' | 'finished') => {
        const statusLower = (m: any) => String(m?.status || '').toLowerCase().trim()

        const filtered = allMatches.filter(m => {
            // Tab Filter
            const s = statusLower(m)
            let tabMatch = false
            if (tab === 'live') tabMatch = s === 'live'
            else if (tab === 'finished') tabMatch = ['finished', 'completed'].includes(s)
            else if (tab === 'upcoming') tabMatch = s === '' || s === 'upcoming' || s === 'scheduled'

            if (!tabMatch) return false

            // Tournament Filter
            if (selectedTournament !== 'all' && m.tournamentId !== selectedTournament) return false

            // School Filter
            if (selectedSchool !== 'all' && m.school !== selectedSchool) return false

            return true
        })

        // Sort
        filtered.sort((a, b) => {
            const tA = getMatchTimestamp(a.date, a.time)
            const tB = getMatchTimestamp(b.date, b.time)
            return tab === 'finished' ? tB - tA : tA - tB
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

    const upcomingData = useMemo(() => getMatchesForTab('upcoming'), [allMatches, selectedTournament, selectedSchool])
    const liveData = useMemo(() => getMatchesForTab('live'), [allMatches, selectedTournament, selectedSchool])
    const finishedData = useMemo(() => getMatchesForTab('finished'), [allMatches, selectedTournament, selectedSchool])

    const activeData = useMemo(() => {
        if (activeTab === 'live') return liveData;
        if (activeTab === 'finished') return finishedData;
        return upcomingData;
    }, [activeTab, upcomingData, liveData, finishedData])

    return (
        <div className="min-h-0 bg-slate-50 dark:bg-[#060b16] pb-4">
            {/* Header */}
            <div className="bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-white/5 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto">
                    <div className="px-6 py-6 flex items-center justify-between">
                        <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">Match Schedule</h1>
                        <div className="flex gap-1.5 items-center">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{activeData.count} Matches Found</span>
                        </div>
                    </div>

                    {/* Filters Section */}
                    <div className="px-5 pb-4 grid grid-cols-2 gap-3">
                        {/* Tournament Filter */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Tournament</label>
                            <select
                                value={selectedTournament}
                                onChange={(e) => setSelectedTournament(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="all">All Tournaments</option>
                                {filterOptions.tournaments.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* School Filter */}
                        <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">School / Batch</label>
                            <select
                                value={selectedSchool}
                                onChange={(e) => setSelectedSchool(e.target.value)}
                                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-teal-500/20"
                            >
                                <option value="all">All Schools</option>
                                {filterOptions.schools.map(school => (
                                    <option key={school} value={school}>{school}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex px-4 border-b border-slate-100 dark:border-white/5">
                        {tabsOrder.map(tab => (
                            <button
                                key={tab}
                                onClick={() => {
                                    setActiveTab(tab)
                                    setSearchParams({ tab })
                                }}
                                className={`flex-1 py-4 text-[11px] font-black uppercase tracking-widest relative transition-all ${activeTab === tab ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
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

            <div className="max-w-4xl mx-auto min-[320px]:px-0">
                {loading ? (
                    <div className="space-y-12 px-4 py-8">
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
                    <div className="relative overflow-hidden">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0.8, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.2}
                            onDragEnd={(_e, info) => {
                                const swipeThreshold = 50;
                                if (info.offset.x < -swipeThreshold) {
                                    if (currentTabIndex < tabsOrder.length - 1) {
                                        const nextTab = tabsOrder[currentTabIndex + 1];
                                        setActiveTab(nextTab);
                                        setSearchParams({ tab: nextTab });
                                    }
                                } else if (info.offset.x > swipeThreshold) {
                                    if (currentTabIndex > 0) {
                                        const prevTab = tabsOrder[currentTabIndex - 1];
                                        setActiveTab(prevTab);
                                        setSearchParams({ tab: prevTab });
                                    }
                                }
                            }}
                            className="w-full px-4 py-8"
                        >
                            {activeData.dateKeys.length === 0 ? (
                                <div className="bg-white dark:bg-[#0f172a] rounded-3xl p-16 text-center border border-slate-200 dark:border-white/5 shadow-sm">
                                    <div className="text-5xl mb-6">📅</div>
                                    <h3 className="text-xl font-bold text-black dark:text-white mb-2 capitalize">No {activeTab} matches found</h3>
                                    <p className="text-slate-400 dark:text-slate-500 text-sm">Check other tabs for more matches.</p>
                                </div>
                            ) : (
                                <div className="space-y-12">
                                    {activeData.dateKeys.map((dateKey: string) => (
                                        <div key={dateKey} className="space-y-6">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md shadow-blue-500/20">
                                                    {formatDateLabel(new Date(dateKey))}
                                                </div>
                                                <div className="h-px bg-slate-200 dark:bg-white/5 flex-1"></div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {activeData.grouped[dateKey].map((m: Match) => (
                                                    <MatchCard key={m.id} match={m} squadsMap={squadsMap} tournamentName={tournamentsMap[m.tournamentId || '']} />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </div>
        </div>
    )
}
