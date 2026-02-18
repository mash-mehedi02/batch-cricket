import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search as SearchIcon, X, Users, Trophy, User as UserIcon, Zap, ArrowLeft, History, Trash2 } from 'lucide-react'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { tournamentService } from '@/services/firestore/tournaments'
import { matchService } from '@/services/firestore/matches'
import { Player, Squad, Tournament, Match } from '@/types'
import { useThemeStore } from '@/store/themeStore'
import { formatShortTeamName } from '@/utils/teamName'

interface SearchHistoryItem {
    id: string
    name: string
    type: string
    timestamp: number
}

export default function Search() {
    const navigate = useNavigate()
    const { isDarkMode } = useThemeStore()
    const [searchQuery, setSearchQuery] = React.useState('')
    const [allData, setAllData] = React.useState<{
        players: Player[],
        squads: Squad[],
        tournaments: Tournament[],
        matches: Match[]
    }>({ players: [], squads: [], tournaments: [], matches: [] })
    const [history, setHistory] = React.useState<SearchHistoryItem[]>([])

    // Load history from localStorage
    React.useEffect(() => {
        const savedHistory = localStorage.getItem('search_history')
        if (savedHistory) {
            try {
                setHistory(JSON.parse(savedHistory))
            } catch (e) {
                console.error('Failed to parse search history')
            }
        }
    }, [])

    // Save item to history
    const addToHistory = (item: { id: string, name: string, type: string }) => {
        const newItem: SearchHistoryItem = { ...item, timestamp: Date.now() }
        const updatedHistory = [newItem, ...history.filter(h => h.id !== item.id)].slice(0, 10)
        setHistory(updatedHistory)
        localStorage.setItem('search_history', JSON.stringify(updatedHistory))
    }

    const clearHistory = () => {
        setHistory([])
        localStorage.removeItem('search_history')
    }

    // Fetch all data
    React.useEffect(() => {
        const fetchData = async () => {
            try {
                const [p, s, t, m] = await Promise.all([
                    playerService.getAll(),
                    squadService.getAll(),
                    tournamentService.getAll(),
                    matchService.getAll()
                ])
                setAllData({ players: p, squads: s, tournaments: t, matches: m })

                // High-Speed Image Preloading for "Instant" feel
                const imagesToPreload = [
                    ...p.map(player => player.photoUrl || (player as any).photo),
                    ...s.map(squad => squad.logoUrl),
                    ...t.map(tournament => tournament.logoUrl)
                ].filter(Boolean) as string[]

                imagesToPreload.forEach(src => {
                    const img = new Image()
                    img.src = src
                })
            } catch (err) {
                console.error('Search data load failed:', err)
            }
        }
        fetchData()
    }, [])

    const [brokenImages, setBrokenImages] = React.useState<Record<string, boolean>>({})

    const handleImageError = (id: string) => {
        setBrokenImages(prev => ({ ...prev, [id]: true }))
    }

    // Fuzzy Search Logic (Updated to 1-character trigger)
    const results = React.useMemo(() => {
        if (searchQuery.length < 1) return []
        const q = searchQuery.toLowerCase().trim()

        const getScore = (target: string) => {
            const t = target.toLowerCase()
            if (t === q) return 100
            if (t.startsWith(q)) return 85
            if (t.includes(q)) return 60

            let i = 0, j = 0
            while (i < t.length && j < q.length) {
                if (t[i] === q[j]) j++
                i++
            }
            return j === q.length ? 30 : 0
        }

        const items = [
            ...allData.players.map(p => ({ ...p, type: 'player', icon: <UserIcon size={20} />, score: getScore(p.name) })),
            ...allData.squads.map(s => ({ ...s, type: 'squad', icon: <Users size={20} />, score: getScore(s.name) })),
            ...allData.tournaments.map(t => ({ ...t, type: 'tournament', icon: <Trophy size={20} />, score: getScore(t.name) })),
            ...allData.matches.map(m => {
                const matchName = `${formatShortTeamName(m.teamAName)} vs ${formatShortTeamName(m.teamBName)}`
                const score = Math.max(getScore(m.teamAName || ''), getScore(m.teamBName || ''), getScore(m.venue || ''), getScore(matchName))
                return { ...m, name: matchName, type: 'match', icon: <Zap size={20} />, score }
            })
        ]

        return items
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 20)
    }, [searchQuery, allData])

    return (
        <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}>
            {/* Header - Native App Style */}
            <div className={`sticky top-0 z-50 pt-[var(--status-bar-height)] pb-3 px-4 flex items-center gap-3 border-b ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <div className="relative flex-1">
                    <input
                        autoFocus
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Teams, Players, Series & more"
                        className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-[15px] outline-none transition-all ${isDarkMode
                            ? 'bg-slate-800 text-white placeholder-slate-500'
                            : 'bg-slate-50 text-slate-900 placeholder-slate-400'
                            }`}
                    />
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
                <button
                    onClick={() => navigate(-1)}
                    className="text-[15px] font-bold text-teal-600 px-1"
                >
                    Cancel
                </button>
            </div>

            <div className="max-w-3xl mx-auto p-4 sm:p-6">
                {searchQuery.length < 1 ? (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Recent Searches */}
                        {history.length > 0 && (
                            <div className="section-reveal">
                                <div className="flex items-center justify-between mb-4 px-1">
                                    <h3 className={`text-xs font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Recent Searches</h3>
                                    <button
                                        onClick={clearHistory}
                                        className="text-[10px] font-bold text-red-500 flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={12} /> Clear
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    {history.map((item) => (
                                        <Link
                                            key={`${item.type}-${item.id}-${item.timestamp}`}
                                            to={
                                                item.type === 'player' ? `/players/${item.id}` :
                                                    item.type === 'squad' ? `/squads/${item.id}` :
                                                        item.type === 'tournament' ? `/tournaments/${item.id}` :
                                                            `/match/${item.id}`
                                            }
                                            className={`flex items-center gap-4 py-3.5 px-3 rounded-2xl transition-all ${isDarkMode ? 'hover:bg-slate-900' : 'hover:bg-white'
                                                } active:scale-95 group`}
                                        >
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
                                                <History size={18} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-[15px] font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{item.name}</p>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.type}</p>
                                            </div>
                                            <ArrowLeft className="text-slate-300 opacity-0 group-hover:opacity-100 rotate-180 transition-all" size={16} />
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Trending / Suggested */}
                        <div>
                            <h3 className={`text-xs font-black uppercase tracking-[0.2em] mb-4 px-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Trending Players</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {allData.players.slice(0, 4).map((player) => (
                                    <Link
                                        key={player.id}
                                        to={`/players/${player.id}`}
                                        onClick={() => addToHistory({ id: player.id, name: player.name, type: 'player' })}
                                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${isDarkMode
                                            ? 'bg-slate-900/50 border-slate-800 hover:border-teal-500/50 hover:bg-slate-800'
                                            : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-teal-100'
                                            }`}
                                    >
                                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-white dark:border-slate-700 shadow-sm transition-opacity">
                                            {(player.photoUrl || (player as any).photo) && !brokenImages[player.id] ? (
                                                <img
                                                    src={player.photoUrl || (player as any).photo}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    onError={() => handleImageError(player.id)}
                                                />
                                            ) : (
                                                <UserIcon className="text-slate-400" size={24} />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-sm font-bold truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{player.name}</p>
                                            <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">{player.batch}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Quick Links Chips */}
                        <div className="flex gap-2.5 overflow-x-auto pb-4 no-scrollbar">
                            {[
                                { label: 'Schedule', to: '/schedule', icon: <Zap size={16} /> },
                                { label: 'Tournaments', to: '/tournaments', icon: <Trophy size={16} /> },
                                { label: 'All Players', to: '/players', icon: <UserIcon size={16} /> },
                                { label: 'Squads', to: '/squads', icon: <Users size={16} /> }
                            ].map(link => (
                                <Link
                                    key={link.label}
                                    to={link.to}
                                    className={`flex items-center gap-2 px-5 py-3 rounded-full border text-sm font-bold whitespace-nowrap transition-all ${isDarkMode
                                        ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                                        : 'bg-white border-slate-200 text-slate-600 shadow-sm hover:shadow-md'
                                        }`}
                                >
                                    <span className="text-teal-500">{link.icon}</span>
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Search Results */
                    <div className="space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h3 className={`px-2 py-4 text-xs font-black uppercase tracking-[0.2em] ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>Search Results</h3>
                        {results.length > 0 ? (
                            results.map((item: any) => (
                                <Link
                                    key={`${item.type}-${item.id}`}
                                    to={
                                        item.type === 'player' ? `/players/${item.id}` :
                                            item.type === 'squad' ? `/squads/${item.id}` :
                                                item.type === 'tournament' ? `/tournaments/${item.id}` :
                                                    `/match/${item.id}`
                                    }
                                    onClick={() => addToHistory({ id: item.id, name: item.name, type: item.type })}
                                    className={`flex items-center gap-4 px-4 py-4 border-b last:border-0 transition-all ${isDarkMode
                                        ? 'border-slate-800/50 hover:bg-slate-900/60'
                                        : 'border-slate-50 hover:bg-white shadow-sm hover:shadow-md hover:rounded-2xl active:scale-98'
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm transition-transform group-active:scale-90 overflow-hidden ${isDarkMode
                                        ? 'bg-slate-800 border-slate-700 text-slate-400'
                                        : 'bg-white border-slate-100 text-slate-500'
                                        }`}>
                                        {((item.type === 'player' && (item.photoUrl || item.photo)) && !brokenImages[item.id]) ? (
                                            <img
                                                src={item.photoUrl || item.photo}
                                                alt=""
                                                className="w-full h-full object-cover"
                                                onError={() => handleImageError(item.id)}
                                            />
                                        ) : (item.type === 'squad' && item.logoUrl && !brokenImages[item.id]) ? (
                                            <img
                                                src={item.logoUrl}
                                                alt=""
                                                className="w-full h-full object-contain p-1.5"
                                                onError={() => handleImageError(item.id)}
                                            />
                                        ) : (item.type === 'tournament' && item.logoUrl && !brokenImages[item.id]) ? (
                                            <img
                                                src={item.logoUrl}
                                                alt=""
                                                className="w-full h-full object-contain p-1.5"
                                                onError={() => handleImageError(item.id)}
                                            />
                                        ) : item.type === 'player' ? (
                                            <UserIcon size={22} />
                                        ) : item.type === 'squad' ? (
                                            <Users size={22} />
                                        ) : item.type === 'tournament' ? (
                                            <Trophy size={22} />
                                        ) : (
                                            <Zap size={22} />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-base font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{item.name}</p>
                                        <p className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{item.type}</p>
                                    </div>
                                    {item.score >= 85 && (
                                        <div className="px-2 py-1 bg-teal-500/10 text-teal-600 text-[10px] font-black uppercase rounded-lg">Best Match</div>
                                    )}
                                </Link>
                            ))
                        ) : (
                            <div className="py-20 text-center">
                                <SearchIcon className="w-16 h-16 text-slate-200 dark:text-slate-800 mx-auto mb-6" strokeWidth={1} />
                                <p className={`text-xl font-black mb-2 ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`}>No Matches Found</p>
                                <p className="text-slate-400 text-sm">Try searching for teams, venues or player names</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
