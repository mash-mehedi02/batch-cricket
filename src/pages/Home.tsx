/**
 * Home Page
 * Landing page with live matches and recent updates
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
    <div className="min-h-screen bg-slate-50/50">
      {/* NIGHT STADIUM HERO (High-Impact Visuals) */}
      <div className="relative min-h-[500px] md:h-[70vh] bg-[#000814] overflow-hidden flex flex-col items-center justify-center z-10 transition-all duration-1000">

        {/* Stadium Glows */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse-slow"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-400/15 blur-[120px] rounded-full animate-pulse-slow delay-1000"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-magenta-600/10 blur-[120px] rounded-full animate-pulse-slow delay-500" style={{ backgroundColor: '#c026d320' }}></div>

        {/* Energy Particles */}
        <div className="absolute inset-0 z-10 pointer-events-none opacity-40">
          {[...Array(15)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white rounded-full animate-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 4}s`
              }}
            ></div>
          ))}
        </div>

        {/* Content Container */}
        <div className="relative z-50 w-full max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
          <div className="flex items-center gap-5 mb-8">
            <img
              src={schoolConfig.logo}
              alt="Logo"
              className="w-20 h-20 md:w-24 md:h-24 object-contain filter drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]"
            />
            <div className="flex flex-col items-start leading-none">
              <span className="text-white font-black tracking-[0.2em] text-lg md:text-2xl uppercase drop-shadow-md">{schoolConfig.name}</span>
              <div className="h-0.5 w-full bg-blue-400/50 rounded-full mt-2"></div>
            </div>
          </div>

          <div className="mb-0 z-30">
            <h2 className="text-blue-200 text-[0.8rem] md:text-lg font-bold tracking-[0.4em] uppercase mb-1 animate-in fade-in slide-in-from-top-4 duration-1000">
              Ultimate Destination For
            </h2>
            <h1 className="text-[2rem] md:text-5xl lg:text-6xl font-black text-white leading-none tracking-tighter drop-shadow-[0_15px_40px_rgba(0,0,0,0.7)] animate-in zoom-in-95 duration-700">
              CRICKET<span className="text-red-600 animate-pulse">!</span>
            </h1>
          </div>

          <div className="relative w-full max-w-xl h-[350px] md:h-[500px] -mt-12 md:-mt-16 flex flex-col items-center justify-center pointer-events-none group">
            <div className="relative z-10 w-full h-[280px] md:h-[400px] animate-float">
              <img
                src={heroStumps}
                alt="Cricket Stumps"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* Floating Action Button - Positioned on the Curve */}
        <div className="absolute bottom-[30px] md:bottom-[60px] left-1/2 transform -translate-x-1/2 z-[60] pointer-events-auto">
          <button
            onClick={() => document.getElementById('match-sections')?.scrollIntoView({ behavior: 'smooth' })}
            className="group relative px-10 py-3 bg-gradient-to-r from-teal-400 to-emerald-500 text-white font-black uppercase tracking-[0.2em] rounded-full transform transition-all duration-300 hover:-translate-y-1 active:scale-95 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-700 flex flex-col items-center leading-none"
          >
            <span>LET'S</span>
            <span>EXPLORE</span>
          </button>
        </div>

        <div className="absolute bottom-[-1px] left-0 w-full z-40">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M0 120H1440V40.5C1360.5 15.5 1184 -19.5 905.5 14.5C557.375 57 186.5 102 0 40.5V120Z" fill="white" />
          </svg>
        </div>
      </div>

      {/* SQUAD MARQUEE */}
      <div id="main-content" className="bg-white py-10 overflow-hidden relative border-b border-slate-100">
        <div className="flex animate-marquee whitespace-nowrap">
          {(() => {
            const logoSquads = squads.filter(s => s.logoUrl);
            if (logoSquads.length === 0) return null;
            const LogoSet = () => (
              <div className="flex shrink-0 items-center justify-around min-w-full gap-8 px-4">
                {logoSquads.map((squad) => (
                  <Link to={`/squads/${squad.id}`} key={squad.id} className="relative group/logo">
                    <img
                      src={squad.logoUrl}
                      alt={squad.name}
                      className="w-16 h-16 md:w-20 md:h-20 object-contain opacity-80 group-hover/logo:opacity-100 group-hover/logo:scale-110 transition-all duration-500"
                    />
                  </Link>
                ))}
              </div>
            );
            return <><LogoSet /><LogoSet /></>;
          })()}
        </div>
      </div>

      {/* MATCH SECTIONS: CREX Style Tabs */}
      <div id="match-sections" className="sticky top-16 bg-white z-40 border-b border-slate-200">
        <div className="max-w-7xl mx-auto flex overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-6 py-4 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${activeTab === 'live' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Live {liveMatches.length > 0 && <span className="ml-1 bg-red-100 text-red-500 px-1.5 py-0.5 rounded-md text-[10px]">{liveMatches.length}</span>}
          </button>
          <button
            onClick={() => setActiveTab('featured')}
            className={`px-6 py-4 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${activeTab === 'featured' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            For You
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-6 py-4 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${activeTab === 'upcoming' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab('finished')}
            className={`px-6 py-4 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 ${activeTab === 'finished' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Finished
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <section className="min-h-[400px]">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => <MatchCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeTab === 'featured' && featuredMatches.map(m => <MatchCard key={m.id} match={m} squadsMap={squadsMap} />)}
              {activeTab === 'live' && (
                <>
                  {liveMatches.length === 0 ? (
                    <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
                      <div className="text-4xl mb-4">🏏</div>
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No Live Matches</p>
                      <Link to="/schedule?tab=live" className="mt-4 text-blue-500 text-[10px] font-black uppercase tracking-widest underline decoration-2 underline-offset-4">See Full Match List</Link>
                    </div>
                  ) : (
                    liveMatches.map(m => <MatchCard key={m.id} match={m} squadsMap={squadsMap} />)
                  )}
                </>
              )}
              {activeTab === 'upcoming' && upcomingMatches.map(m => <MatchCard key={m.id} match={m} squadsMap={squadsMap} />)}
              {activeTab === 'finished' && finishedMatches.map(m => <MatchCard key={m.id} match={m} squadsMap={squadsMap} />)}
            </div>
          )}

          {/* See Full Schedule Button (Always visible at bottom of matches) */}
          {!loading && (
            <div className="mt-10 flex justify-center">
              <Link to="/schedule" className="bg-white px-8 py-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex items-center gap-2 group">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 group-hover:text-black transition-colors">See Full Schedule</span>
                <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </section>

        {/* Quick Links Section */}
        <section className="mt-20">
          <div className="flex items-center gap-3 mb-10">
            <div className="h-0.5 w-8 bg-teal-500"></div>
            <h2 className="text-lg font-black text-black uppercase tracking-[0.2em]">Platform Hub</h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/schedule" className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col items-center hover:shadow-lg transition-all group">
              <span className="text-3xl mb-3 group-hover:scale-110 transition-transform">📅</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Date Wise</span>
              <span className="text-sm font-bold text-slate-900">Schedule</span>
            </Link>
            <Link to="/tournaments" className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col items-center hover:shadow-lg transition-all group">
              <span className="text-3xl mb-3 group-hover:scale-110 transition-transform">🏆</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">View All</span>
              <span className="text-sm font-bold text-slate-900">Tournaments</span>
            </Link>
            <Link to="/squads" className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col items-center hover:shadow-lg transition-all group">
              <span className="text-3xl mb-3 group-hover:scale-110 transition-transform">👥</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total Teams</span>
              <span className="text-sm font-bold text-slate-900">Squads List</span>
            </Link>
            <Link to="/players" className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col items-center hover:shadow-lg transition-all group">
              <span className="text-3xl mb-3 group-hover:scale-110 transition-transform">🏏</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Performance</span>
              <span className="text-sm font-bold text-slate-900">Player Stats</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

