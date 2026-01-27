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
    <div ref={containerRef} className="min-h-screen bg-white pb-24 font-sans">
      {/* Search and Navigation Bar */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-slate-100 pt-10 pb-4 mb-8 sticky top-0 z-40 px-4 md:px-8">
        <div className="max-w-7xl mx-auto players-header">
          {/* Top Header Area */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <h1 className="text-4xl md:text-5xl font-[1000] text-[#0c162d] tracking-tighter uppercase italic">
              Players
            </h1>
            <div className="relative w-full md:max-w-md group">
              <input
                type="text"
                placeholder="Search elite players..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-6 py-4 pl-14 bg-slate-100/50 border-none rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:bg-white transition-all shadow-inner placeholder:text-slate-400 font-bold text-slate-800"
              />
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Category Tabs with Icons */}
          <div className="flex justify-end items-center border-b border-gray-100 mb-6 font-sans">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 pb-2 flex items-center gap-2 relative transition-all duration-300 ${activeCategory === cat.id ? 'text-red-600' : 'text-[#2b5a83]'
                  }`}
              >
                {cat.icon && (
                  <img src={cat.icon} alt="" className={`w-5 h-5 object-contain ${activeCategory === cat.id ? '' : 'opacity-60 grayscale'}`} />
                )}
                <span className={`font-bold text-sm md:text-base whitespace-nowrap`}>
                  {cat.label}
                </span>
                {activeCategory === cat.id && (
                  <div className="absolute bottom-0 left-0 w-full h-[3px] bg-red-600"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[3/4] bg-slate-200 rounded-[2rem]"></div>
            ))}
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="bg-white rounded-[3rem] p-20 text-center shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="text-8xl mb-8 animate-bounce">🏏</div>
            <h3 className="text-3xl font-black text-slate-900 mb-3 uppercase italic tracking-tighter">No Players Found</h3>
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Adjust your search or category filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-3 md:gap-6">
            {filteredPlayers.map((player) => {
              const hasPhoto = !!(player.photoUrl || (player as any).photo)
              const squadName = squads[player.squadId] || 'Unassigned'

              return (
                <Link
                  key={player.id}
                  to={`/players/${player.id}`}
                  className="player-card group relative flex h-44 md:h-56 bg-white border border-slate-100 overflow-hidden rounded-xl md:rounded-2xl transition-all duration-300 shadow-sm hover:shadow-xl hover:border-red-100"
                >
                  {/* Left Side: Player Info - Forced width for uniformity */}
                  <div className="relative z-20 w-[55%] p-3 md:p-6 flex flex-col justify-center bg-white">
                    <h3 className="text-[14px] md:text-xl lg:text-3xl font-black text-[#0c162d] uppercase italic tracking-tighter group-hover:text-red-600 transition-colors leading-[0.85] mb-2">
                      {player.name.split(' ').map((part, i) => (
                        <span key={i} className="block">{part}</span>
                      ))}
                    </h3>

                    <div className="mt-1 space-y-1.5">
                      <p className="text-[9px] md:text-[11px] text-red-600 font-black uppercase tracking-widest bg-red-50/50 px-2 py-0.5 rounded border border-red-100 inline-block whitespace-nowrap">
                        {squadName}
                      </p>

                      <p className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-tight block">
                        {player.role === 'wicket-keeper' ? 'Wicketkeeper' : player.role === 'batsman' ? 'Batter' : player.role === 'bowler' ? 'Bowler' : 'All Rounder'}
                      </p>
                    </div>
                  </div>

                  {/* Right Side: Uniform Slanted Photo Zone */}
                  <div className="relative w-[45%] h-full">
                    <div
                      className="absolute inset-0 bg-slate-100 overflow-hidden"
                      style={{ clipPath: 'polygon(20% 0, 100% 0, 100% 100%, 0% 100%)' }}
                    >
                      {hasPhoto ? (
                        <img
                          src={player.photoUrl || (player as any).photo}
                          alt={player.name}
                          className="w-full h-full object-cover object-[center_10%] group-hover:scale-110 transition-transform duration-700"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                          <UserCircle className="w-16 h-16 md:w-24 md:h-24 text-slate-400 opacity-60" strokeWidth={1} />
                        </div>
                      )}
                      {/* Subtler Gradient Overlay for White Theme */}
                      <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent"></div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}


