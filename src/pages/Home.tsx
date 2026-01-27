
/**
 * Home Page
 * Beautiful, modern, and 100% responsive landing page
 * Optimized for performance (no heavy animations)
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { squadService } from '@/services/firestore/squads'
import { Match, Squad } from '@/types'
import MatchCardSkeleton from '@/components/skeletons/MatchCardSkeleton'
import MatchCard from '@/components/match/MatchCard'
import { coerceToDate } from '@/utils/date'
import schoolConfig from '@/config/school'
import heroStumps from '@/assets/hero_stumps.png'

export default function Home() {
  const [liveMatches, setLiveMatches] = useState<Match[]>([])
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([])
  const [finishedMatches, setFinishedMatches] = useState<Match[]>([])
  const [featuredMatches, setFeaturedMatches] = useState<Match[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Subscribe to squads
    const unsubscribeSquads = squadService.subscribeAll(setSquads)
    return () => unsubscribeSquads()
  }, [])

  useEffect(() => {
    const loadMatches = async () => {
      try {
        setLoading(true)

        // Load all matches
        const allMatches = await matchService.getAll()

        const parseStartTs = (m: any): number => {
          const d0 = coerceToDate(m?.date)
          if (!d0) return 0
          const t = String(m?.time || '00:00').trim()
          const [hh, mm] = t.split(':').map(Number)
          const target = new Date(d0)
          target.setHours(hh || 0, mm || 0, 0, 0)
          return target.getTime()
        }

        const statusLower = (m: any) => String(m?.status || '').toLowerCase().trim()
        const isLive = (m: any) => statusLower(m) === 'live'
        const isFinished = (m: any) => ['finished', 'completed'].includes(statusLower(m))
        const isUpcoming = (m: any) => {
          const s = statusLower(m)
          return s === '' || s === 'upcoming' || s === 'scheduled'
        }

        const live = allMatches.filter(isLive)
        const finished = allMatches
          .filter(isFinished)
          .sort((a, b) => parseStartTs(b) - parseStartTs(a))

        const upcoming = allMatches
          .filter(isUpcoming)
          .sort((a, b) => parseStartTs(a) - parseStartTs(b))

        setLiveMatches(live)
        setFinishedMatches(finished)
        setUpcomingMatches(upcoming)

        // FEATURED LOGIC
        // 1 live, 1 most recent upcoming, 1 most recent finished
        // if no live: 2 upcoming, 1 finished
        // if no upcoming: 3 finished
        let featured: Match[] = []
        if (live.length > 0) {
          featured.push(live[0])
          if (upcoming.length > 0) featured.push(upcoming[0])
          if (finished.length > 0) featured.push(finished[0])
        } else if (upcoming.length > 0) {
          featured.push(...upcoming.slice(0, 2))
          if (finished.length > 0) featured.push(finished[0])
        } else {
          featured.push(...finished.slice(0, 3))
        }
        setFeaturedMatches(featured)

      } catch (error) {
        console.error('Error loading matches:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMatches()
  }, [])

  const [activeTab, setActiveTab] = useState<'featured' | 'live' | 'upcoming' | 'finished'>('featured')

  const squadsMap = squads.reduce((acc, s) => {
    acc[s.id] = s
    return acc
  }, {} as Record<string, Squad>)

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* MODERN HERO SECTION - Adjusted Height 50vh */}
      <div className="h-[50vh] min-h-[350px] relative bg-[#0f172a] text-white flex flex-col pt-6">

        {/* Background Gradients Wrapper - Contained to prevent overflow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-600/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 flex-1 flex flex-col">

          {/* Header */}
          <div className="flex flex-col items-center mb-4 sm:mb-6 shrink-0">
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 shadow-lg">
              <img
                src={schoolConfig.logo}
                alt="Logo"
                className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-md"
              />
              <div className="flex flex-col">
                <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-0.5">Official App</span>
                <span className="text-xs sm:text-sm font-bold text-white leading-none tracking-wide">{schoolConfig.name}</span>
              </div>
            </div>
          </div>

          {/* Hero Content Grid - Fill remaining space */}
          <div className="flex-1 flex flex-col items-center justify-center text-center pb-8">

            <h2 className="text-teal-400 font-bold tracking-[0.2em] uppercase text-[10px] sm:text-xs mb-1 sm:mb-2">The Ultimate Platform</h2>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-2 drop-shadow-xl">
              CRICKET <span className="text-teal-500">LIVE</span>
            </h1>
            <p className="text-blue-200/80 text-[10px] sm:text-xs font-medium tracking-wide max-w-md mx-auto mb-4 sm:mb-6">
              {schoolConfig.tagline}
            </p>

            {/* Hero Image - Scaled to fit */}
            <div className="relative w-full max-w-[320px] sm:max-w-sm md:max-w-md aspect-video flex items-center justify-center">
              <img
                src={heroStumps}
                alt="Cricket Stumps"
                className="w-full h-full object-contain filter drop-shadow-2xl"
              />
            </div>
          </div>
        </div>

        {/* SINGLE CURVE SVG - Attached to Bottom */}
        <div className="absolute bottom-0 left-0 w-full z-10 pointer-events-none translate-y-[2px]">
          <svg
            viewBox="0 0 1440 120"
            className="w-full h-[60px] md:h-[100px] block"
            preserveAspectRatio="none"
          >
            <path fill="currentColor" className="text-white dark:text-slate-900" d="M0,64L60,58.7C120,53,240,43,360,48C480,53,600,75,720,80C840,85,960,75,1080,64C1200,53,1320,43,1380,37.3L1440,32L1440,120L0,120Z"></path>
          </svg>
        </div>

        {/* Action Button - Perfectly Centered on Curve Centerpoint */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[20px] md:translate-y-[35px] z-20">
          <button
            onClick={() => document.getElementById('match-sections')?.scrollIntoView({ behavior: 'smooth' })}
            className="group relative bg-[#0f172a] dark:bg-teal-500 text-white dark:text-[#0f172a] px-8 py-3 rounded-full font-black uppercase tracking-widest text-[11px] sm:text-xs transition-all hover:scale-105 active:scale-95 shadow-xl shadow-teal-500/20 whitespace-nowrap border-4 border-white dark:border-slate-900"
          >
            Let's Explore
          </button>
        </div>

      </div>

      {/* SQUADS SCROLL - Native Horizontal Scroll (No Marquee Lag) */}
      <div className="py-6 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Participating Teams</p>

          {squads.length > 0 ? (
            <div className="relative w-full overflow-hidden">
              <div className="flex w-max animate-marquee hover:pause gap-8">
                {/* Show only teams with logos for a premium brand feel */}
                {[...squads, ...squads]
                  .filter(s => s && s.logoUrl && s.name)
                  .map((squad, index) => {
                    const formatHomeName = (name: string) => {
                      if (!name) return '???'
                      const parts = name.split(/[- ]+/).filter(Boolean)
                      const label = (parts[0] || '').substring(0, 3).toUpperCase()
                      // Extract batch from squad object or name
                      const batch = squad.batch || parts[parts.length - 1]?.match(/\d+/) ? parts[parts.length - 1] : ''
                      return batch ? `${label}-${batch}` : label
                    }

                    return (
                      <Link
                        to={`/squads/${squad.id}`}
                        key={`${squad.id}-${index}`}
                        className="flex flex-col items-center gap-2 min-w-[70px] group"
                      >
                        <div className="w-14 h-14 sm:w-16 sm:h-16 transition-all transform group-hover:scale-110 duration-300 flex items-center justify-center">
                          <img
                            src={squad.logoUrl}
                            alt={squad.name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span className="text-[9px] font-black text-slate-700 truncate max-w-full group-hover:text-teal-600 transition-colors uppercase tracking-tight">
                          {formatHomeName(squad.name)}
                        </span>
                      </Link>
                    )
                  })}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic px-4">No squads loaded</div>
          )}
        </div>
      </div>

      {/* MATCH SECTIONS - Clean Tabs */}
      <div id="match-sections" className="sticky top-16 bg-white/95 backdrop-blur-md z-40 border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto flex overflow-x-auto scrollbar-hide px-2">
          {[
            { id: 'live', label: 'Live' },
            { id: 'featured', label: 'For You' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'finished', label: 'Finished' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[100px] py-4 text-[11px] sm:text-xs font-black uppercase tracking-wider relative transition-colors ${activeTab === tab.id
                ? 'text-[#0f172a]'
                : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              {tab.label}
              {tab.id === 'live' && liveMatches.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[9px] px-1.5 rounded-full animate-pulse">
                  {liveMatches.length}
                </span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0f172a]"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* MATCH GRID */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8 min-h-[50vh]">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => <MatchCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeTab === 'featured' && featuredMatches.map(m => <MatchCard key={m.id} match={m} squadsMap={squadsMap} />)}

            {activeTab === 'live' && (
              <>
                {liveMatches.length === 0 ? (
                  <div className="col-span-full py-12 text-center flex flex-col items-center opacity-60">
                    <div className="text-5xl mb-4 grayscale">🏏</div>
                    <p className="text-slate-900 font-bold uppercase text-xs tracking-widest">No Live Matches</p>
                  </div>
                ) : (
                  liveMatches.map(m => <MatchCard key={m.id} match={m} squadsMap={squadsMap} />)
                )}
              </>
            )}

            {activeTab === 'upcoming' && upcomingMatches.map(m => <MatchCard key={m.id} match={m} squadsMap={squadsMap} />)}
            {activeTab === 'finished' && finishedMatches.map(m => <MatchCard key={m.id} match={m} squadsMap={squadsMap} />)}

            {!loading && activeTab === 'featured' && featuredMatches.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-400 text-sm">No matches found</div>
            )}
          </div>
        )}

        {/* View Full Schedule Link */}
        {!loading && (
          <div className="mt-8 text-center">
            <Link
              to="/schedule"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#0f172a] hover:text-teal-600 transition-colors border-b border-[#0f172a]/20 pb-0.5 hover:border-teal-600"
            >
              View Full Schedule
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>
        )}
      </div>

      {/* FOOTER NAV / QUICK LINKS - Cards */}
      <div className="px-4 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6 opacity-80">
            <div className="h-px bg-slate-200 flex-1"></div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Explore More</span>
            <div className="h-px bg-slate-200 flex-1"></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickLinkCard to="/schedule" icon="📅" label="Schedule" sub="Date Wise" />
            <QuickLinkCard to="/tournaments" icon="🏆" label="Tournaments" sub="All Series" />
            <QuickLinkCard to="/squads" icon="👥" label="Teams" sub="Squad Info" />
            <QuickLinkCard to="/players" icon="📊" label="Stats" sub="Player Records" />
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickLinkCard({ to, icon, label, sub }: { to: string, icon: string, label: string, sub: string }) {
  return (
    <Link to={to} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center text-center">
      <div className={`text-2xl mb-2`}>{icon}</div>
      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{sub}</div>
      <div className="text-xs font-bold text-slate-800">{label}</div>
    </Link>
  )
}
