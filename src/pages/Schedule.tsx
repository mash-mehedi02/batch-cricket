import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { squadService } from '@/services/firestore/squads'
import { Match, Squad } from '@/types'
import MatchCard from '@/components/match/MatchCard'
import MatchCardSkeleton from '@/components/skeletons/MatchCardSkeleton'
import { coerceToDate, formatDateLabel } from '@/utils/date'

export default function Schedule() {
    const [searchParams, setSearchParams] = useSearchParams()
    const initialTab = (searchParams.get('tab') as any) || 'upcoming'
    const [activeTab, setActiveTab] = useState<'live' | 'upcoming' | 'finished'>(initialTab)

    const [matches, setMatches] = useState<Match[]>([])
    const [squads, setSquads] = useState<Squad[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const unsubscribeSquads = squadService.subscribeAll(setSquads)
        return () => unsubscribeSquads()
    }, [])

    useEffect(() => {
        const loadMatches = async () => {
            try {
                setLoading(true)
                const all = await matchService.getAll()

                const statusLower = (m: any) => String(m?.status || '').toLowerCase().trim()

                let filtered = all.filter(m => {
                    const s = statusLower(m)
                    if (activeTab === 'live') return s === 'live'
                    if (activeTab === 'finished') return ['finished', 'completed'].includes(s)
                    if (activeTab === 'upcoming') return s === '' || s === 'upcoming' || s === 'scheduled'
                    return false
                })

                // Sort
                filtered.sort((a, b) => {
                    const da = coerceToDate(a.date)?.getTime() || 0
                    const db = coerceToDate(b.date)?.getTime() || 0
                    return activeTab === 'finished' ? db - da : da - db
                })

                setMatches(filtered)
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        loadMatches()
    }, [activeTab])

    const squadsMap = squads.reduce((acc, s) => {
        acc[s.id] = s
        return acc
    }, {} as Record<string, Squad>)

    // Group by date
    const groupedMatches: Record<string, Match[]> = {}
    matches.forEach(m => {
        const d = coerceToDate(m.date)
        const dateKey = d ? d.toDateString() : 'Unknown Date'
        if (!groupedMatches[dateKey]) groupedMatches[dateKey] = []
        groupedMatches[dateKey].push(m)
    })

    const dateKeys = Object.keys(groupedMatches).sort((a, b) => {
        const da = new Date(a).getTime() || 0
        const db = new Date(b).getTime() || 0
        return activeTab === 'finished' ? db - da : da - db
    })

    return (
        <div className="min-h-screen bg-slate-50 pb-20">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-16 z-30">
                <div className="max-w-4xl mx-auto">
                    <div className="px-6 py-6 flex items-center justify-between">
                        <h1 className="text-2xl font-black text-black tracking-tight">Match Schedule</h1>
                        <div className="flex gap-1.5 items-center">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{matches.length} Matches Found</span>
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
                                className={`px-8 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8">
                {loading ? (
                    <div className="space-y-6">
                        {[1, 2, 3].map(i => <MatchCardSkeleton key={i} />)}
                    </div>
                ) : matches.length === 0 ? (
                    <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-sm">
                        <div className="text-5xl mb-6">📅</div>
                        <h3 className="text-xl font-bold text-black mb-2 capitalize">No {activeTab} matches found</h3>
                        <p className="text-slate-400 text-sm">Check other tabs for more matches.</p>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {dateKeys.map(dateKey => (
                            <div key={dateKey} className="space-y-4">
                                {/* Date Heading */}
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-md shadow-blue-500/20">
                                        {formatDateLabel(new Date(dateKey))}
                                    </div>
                                    <div className="h-px bg-slate-200 flex-1"></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {groupedMatches[dateKey].map(m => (
                                        <MatchCard key={m.id} match={m} squadsMap={squadsMap} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
