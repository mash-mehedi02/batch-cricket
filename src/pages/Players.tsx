/**
 * Players Page
 * Display all players from Firebase
 */

import { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { Player, Squad } from '@/types'
import cricketBatIcon from '@/assets/cricket-bat.png'
import cricketBallIcon from '@/assets/cricket-ball.png'
import { UserCircle } from 'lucide-react'

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([])
  const [squads, setSquads] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('all')

  useEffect(() => {
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

        setPlayers(allPlayers)
        setSquads(squadMap)
      } catch (error) {
        console.error('Error loading players/squads:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)

  const categories = [
    { id: 'all', label: 'All', icon: null },
    { id: 'batsman', label: 'Batsman', icon: cricketBatIcon },
    { id: 'bowler', label: 'Bowler', icon: cricketBallIcon },
    { id: 'all-rounder', label: 'All Rounder', icon: null },
  ]

  const filteredPlayers = useMemo(() => {
    return players.filter(player => {
      const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = activeCategory === 'all' ||
        (activeCategory === 'batsman' && (player.role === 'batsman' || player.role === 'wicket-keeper')) ||
        (activeCategory === 'bowler' && player.role === 'bowler') ||
        (activeCategory === 'all-rounder' && player.role === 'all-rounder')
      return matchesSearch && matchesCategory
    })
  }, [players, searchQuery, activeCategory])

  // GSAP Animations
  useEffect(() => {
    if (!loading && filteredPlayers.length > 0) {
      const ctx = gsap.context(() => {
        // Card entrance
        gsap.fromTo(".player-card",
          { y: 30, opacity: 0, scale: 0.98 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.5,
            stagger: 0.05,
            ease: "back.out(1.2)",
            clearProps: "all"
          }
        )

        // Header animation
        gsap.fromTo(".players-header",
          { y: -20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power2.out" }
        )
      }, containerRef)
      return () => ctx.revert()
    }
  }, [loading, activeCategory, filteredPlayers.length])


  return (
    <div ref={containerRef} className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 font-sans">
      {/* Search and Navigation Bar */}
      <div className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-100 dark:border-white/5 pt-10 pb-4 mb-8 sticky top-0 z-40 px-4 md:px-8">
        <div className="max-w-7xl mx-auto players-header">
          {/* Top Header Area */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">
              Players
            </h1>
            <div className="relative w-full md:max-w-md group">
              <input
                type="text"
                placeholder="Search elite players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-6 py-4 pl-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all shadow-sm placeholder:text-slate-400 font-bold text-slate-800 dark:text-white"
              />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Category Tabs with Icons */}
          <div className="flex justify-end items-center gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-2 flex items-center gap-2 rounded-xl transition-all duration-300 whitespace-nowrap ${activeCategory === cat.id
                  ? 'bg-red-600 text-white shadow-lg shadow-red-500/20'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
              >
                {cat.icon && (
                  <img src={cat.icon} alt="" className={`w-4 h-4 object-contain ${activeCategory === cat.id ? 'brightness-0 invert' : 'opacity-60 grayscale'}`} />
                )}
                <span className="font-bold text-xs md:text-sm">
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 md:gap-8 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-44 md:h-56 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5"></div>
            ))}
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-20 text-center shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/5">
            <div className="text-8xl mb-8 animate-bounce">🏏</div>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-3 uppercase italic tracking-tighter">No Players Found</h3>
            <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Adjust your search or category filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-8">
            {filteredPlayers.map((player) => {
              const hasPhoto = !!(player.photoUrl || (player as any).photo)
              const squadName = squads[player.squadId] || 'Unassigned'

              return (
                <Link
                  key={player.id}
                  to={`/players/${player.id}`}
                  className="player-card group relative flex h-44 md:h-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 overflow-hidden rounded-2xl md:rounded-[2rem] transition-all duration-500 shadow-sm hover:shadow-2xl hover:shadow-red-500/10 hover:border-red-500/30"
                >
                  {/* Left Side: Player Info */}
                  <div className="relative z-20 w-[60%] p-6 md:p-8 flex flex-col justify-center">
                    <h3 className="text-xl md:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter group-hover:text-red-600 transition-colors leading-[0.8] mb-4">
                      {player.name.split(' ').map((part, i) => (
                        <span key={i} className="block">{part}</span>
                      ))}
                    </h3>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                        <p className="text-[10px] md:text-xs text-red-600 dark:text-red-500 font-black uppercase tracking-widest">
                          {squadName}
                        </p>
                      </div>

                      <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.2em] ml-3.5">
                        {player.role === 'wicket-keeper' ? 'Wicketkeeper' : player.role === 'batsman' ? 'Batter' : player.role === 'bowler' ? 'Bowler' : 'All Rounder'}
                      </p>
                    </div>
                  </div>

                  {/* Right Side: Photo Zone */}
                  <div className="relative w-[40%] h-full">
                    {/* Decorative Shape */}
                    <div
                      className="absolute inset-0 bg-slate-100 dark:bg-slate-800"
                      style={{ clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)' }}
                    >
                      {hasPhoto ? (
                        <img
                          src={player.photoUrl || (player as any).photo}
                          alt={player.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-800">
                          <UserCircle className="w-20 h-20 md:w-32 md:h-32 text-slate-400 dark:text-slate-600 opacity-40" strokeWidth={1} />
                        </div>
                      )}

                      {/* Gradient Overlays */}
                      <div className="absolute inset-0 bg-gradient-to-r from-white dark:from-slate-900 via-transparent to-transparent w-8"></div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                    </div>
                  </div>

                  {/* Hover Accent */}
                  <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-red-600 to-rose-600 transition-all duration-500 group-hover:w-full"></div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


