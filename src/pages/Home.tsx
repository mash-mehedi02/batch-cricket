/**
 * Home Page
 * Beautiful, modern, and 100% responsive landing page
 */

import { useEffect, useState, useRef } from 'react'
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

  // Dynamic Spider Thread Animation State
  const floatingContainerRef = useRef<HTMLDivElement>(null)
  const [threadOffset, setThreadOffset] = useState(0)

  // Track floating animation and update thread coordinates
  useEffect(() => {
    let animationFrameId: number

    const updateThreads = () => {
      if (floatingContainerRef.current) {
        const element = floatingContainerRef.current
        const computedStyle = window.getComputedStyle(element)
        const transform = computedStyle.transform

        // Extract translateY from transform matrix
        if (transform && transform !== 'none') {
          const matrix = new DOMMatrix(transform)
          const translateY = matrix.m42 // Get Y translation

          // Normalize to -1 to 1 range (assuming ±20px float)
          const normalizedOffset = Math.max(-1, Math.min(1, translateY / 20))
          setThreadOffset(normalizedOffset)
        }
      }

      animationFrameId = requestAnimationFrame(updateThreads)
    }

    animationFrameId = requestAnimationFrame(updateThreads)

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  const squadsMap = squads.reduce((acc, s) => {
    acc[s.id] = s
    return acc
  }, {} as Record<string, Squad>)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* HERO SECTION: Enhanced with better responsive design */}
      <div className="relative h-[45vh] sm:h-[50vh] min-h-[350px] sm:min-h-[400px] md:min-h-[450px] bg-gradient-to-br from-[#000814] via-[#001122] to-[#000814] overflow-visible flex flex-col items-center z-10 w-full">

        {/* Enhanced Background Glows with better positioning */}
        <div className="absolute top-[-15%] sm:top-[-20%] left-[-10%] sm:left-[-5%] w-[80%] sm:w-[70%] h-[80%] sm:h-[70%] bg-blue-800/25 blur-[120px] sm:blur-[100px] rounded-full animate-pulse-slow"></div>
        <div className="absolute top-[-15%] sm:top-[-20%] right-[-10%] sm:right-[-5%] w-[70%] sm:w-[60%] h-[70%] sm:h-[60%] bg-cyan-600/20 blur-[120px] sm:blur-[100px] rounded-full animate-pulse-slow delay-1000"></div>
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-[60%] h-[40%] bg-teal-500/10 blur-[80px] rounded-full"></div>

        {/* TOP HEADER: Logo & School Name - Better responsive */}
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-3 sm:py-4 md:py-6 mb-1 sm:mb-2 flex flex-col items-center z-50">
          <div className="flex items-center gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-4 duration-700">
            <img
              src={schoolConfig.logo}
              alt="Logo"
              className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14 object-contain filter drop-shadow-lg"
            />
            <div className="flex flex-col items-start leading-none">
              <span className="text-white font-black tracking-[0.1em] sm:tracking-[0.15em] text-[9px] sm:text-[10px] md:text-sm lg:text-base uppercase drop-shadow-md text-left">
                {schoolConfig.name}
              </span>
              <div className="h-0.5 sm:h-1 w-full bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 rounded-full mt-0.5 sm:mt-1 shadow-sm"></div>
            </div>
          </div>
        </div>

        {/* CENTER CONTENT: Enhanced Text & Image */}
        <div className="relative flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 flex flex-col items-center justify-center -mt-6 sm:-mt-8 md:-mt-12">

          {/* Enhanced Text with better typography */}
          <div className="text-center mt-1 sm:mt-2 mb-3 sm:mb-4 z-30">
            <h2 className="text-blue-200/90 text-[0.45rem] sm:text-[0.5rem] md:text-xs font-bold tracking-[0.25em] sm:tracking-[0.3em] uppercase mb-1 sm:mb-1.5 drop-shadow-sm">
              The Ultimate
            </h2>
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black text-white leading-none tracking-tighter drop-shadow-2xl">
              CRICKET<span className="text-red-400 sm:text-red-500">!</span>
            </h1>
            <p className="text-blue-300/70 text-[8px] sm:text-[9px] md:text-[10px] font-semibold tracking-wider mt-1 sm:mt-2 uppercase">
              {schoolConfig.tagline}
            </p>
          </div>

          {/* CONTAINER: Bigger image size + REF for thread tracking + Spider threads move together */}
          <div
            ref={floatingContainerRef}
            className="relative w-[240px] h-[180px] sm:w-[300px] sm:h-[225px] md:w-[380px] md:h-[285px] lg:w-[420px] lg:h-[315px] aspect-[4/3] flex flex-col items-center justify-center z-40 animate-float -mt-2 sm:-mt-4"
          >
            {/* DYNAMIC SPIDER THREADS - Move WITH the image */}
            <div className="absolute inset-0 z-5 flex items-center justify-center pointer-events-none overflow-visible scale-150">
              <svg className="w-full h-full" viewBox="0 0 300 300" preserveAspectRatio="xMidYMid meet">
                {/* Fixed anchor points on edges, fixed center at 180 - container movement creates stretch effect */}

                {/* Top Left Thread */}
                <line
                  x1="30"
                  y1="30"
                  x2={150}
                  y2={180}
                  stroke="#67e8f9"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                  className="opacity-20 sm:opacity-25 animate-pulse"
                />

                {/* Top Right Thread */}
                <line
                  x1="270"
                  y1="30"
                  x2={150}
                  y2={180}
                  stroke="#67e8f9"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                  className="opacity-20 sm:opacity-25 animate-pulse delay-100"
                />

                {/* Left Side Thread */}
                <line
                  x1="20"
                  y1="150"
                  x2={150}
                  y2={180}
                  stroke="#67e8f9"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                  className="opacity-25 sm:opacity-30 animate-pulse delay-200"
                />

                {/* Right Side Thread */}
                <line
                  x1="280"
                  y1="150"
                  x2={150}
                  y2={180}
                  stroke="#67e8f9"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                  className="opacity-25 sm:opacity-30 animate-pulse delay-300"
                />

                {/* Bottom Left Thread */}
                <line
                  x1="30"
                  y1="270"
                  x2={150}
                  y2={180}
                  stroke="#67e8f9"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                  className="opacity-20 sm:opacity-25 animate-pulse delay-150"
                />

                {/* Bottom Right Thread */}
                <line
                  x1="270"
                  y1="270"
                  x2={150}
                  y2={180}
                  stroke="#67e8f9"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                  className="opacity-20 sm:opacity-25 animate-pulse delay-250"
                />

                {/* Center Node - moves with image */}
                <circle
                  cx="150"
                  cy={180}
                  r="4"
                  fill="#67e8f9"
                  className="opacity-50"
                />
              </svg>
            </div>

            {/* Stumps Image - Better responsive */}
            <div className="relative z-10 w-full h-full p-2 sm:p-3">
              <img
                src={heroStumps}
                alt="Cricket Stumps"
                className="w-full h-full object-contain drop-shadow-2xl"
              />
            </div>
          </div>
        </div>

        {/* SINGLE CURVE - Better responsive (removed back curve) */}
        <div className="absolute bottom-0 left-0 w-full z-10 pointer-events-none translate-y-[1px]">
          <svg
            viewBox="0 0 1440 120"
            className="w-full h-[50px] sm:h-[60px] md:h-[80px] lg:h-[100px] block"
            preserveAspectRatio="none"
          >
            <path fill="#ffffff" d="M0,64L60,58.7C120,53,240,43,360,48C480,53,600,75,720,80C840,85,960,75,1080,64C1200,53,1320,43,1380,37.3L1440,32L1440,120L0,120Z"></path>
          </svg>
        </div>

        {/* Enhanced Button - Higher z-index to prevent cutoff */}
        <div className="absolute bottom-[-12px] sm:bottom-[-15px] md:bottom-[-20px] left-1/2 transform -translate-x-1/2 z-[100]">
          <button
            onClick={() => document.getElementById('match-sections')?.scrollIntoView({ behavior: 'smooth' })}
            className="group relative px-4 py-1.5 sm:px-6 sm:py-2 md:px-8 md:py-2.5 bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-500 text-white font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] rounded-full shadow-[0_4px_15px_rgba(16,185,129,0.4)] hover:shadow-[0_6px_25px_rgba(16,185,129,0.6)] transform transition-all duration-300 hover:-translate-y-1 active:scale-95 flex flex-col items-center leading-none text-[8px] sm:text-[9px] md:text-xs border-2 border-white/20 hover:border-white/40"
          >
            <span>LET'S</span>
            <span>EXPLORE</span>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
          </button>
        </div>
      </div>

      {/* ENHANCED SQUAD MARQUEE - Better responsive */}
      <div id="main-content" className="bg-gradient-to-b from-white to-slate-50/50 py-8 sm:py-10 md:py-12 overflow-hidden relative border-b border-slate-200/50">
        <div className="flex animate-marquee whitespace-nowrap">
          {(() => {
            const logoSquads = squads.filter(s => s.logoUrl);
            if (logoSquads.length === 0) return null;
            const LogoSet = () => (
              <div className="flex shrink-0 items-center justify-around min-w-full gap-6 sm:gap-8 md:gap-10 px-4 sm:px-6">
                {logoSquads.map((squad) => (
                  <Link
                    to={`/squads/${squad.id}`}
                    key={squad.id}
                    className="relative group/logo transform transition-all duration-500 hover:scale-110"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-400/0 to-emerald-400/0 group-hover/logo:from-teal-400/20 group-hover/logo:to-emerald-400/20 rounded-full blur-xl transition-all duration-500"></div>
                    <img
                      src={squad.logoUrl}
                      alt={squad.name}
                      className="relative w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 object-contain opacity-75 group-hover/logo:opacity-100 transition-all duration-500 drop-shadow-sm group-hover/logo:drop-shadow-md"
                    />
                  </Link>
                ))}
              </div>
            );
            return <><LogoSet /><LogoSet /></>;
          })()}
        </div>
      </div>

      {/* ENHANCED MATCH SECTIONS: Better responsive tabs */}
      <div id="match-sections" className="sticky top-16 bg-white/95 backdrop-blur-sm z-40 border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto flex overflow-x-auto scrollbar-hide px-2 sm:px-4">
          <button
            onClick={() => setActiveTab('live')}
            className={`px-4 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 relative group ${activeTab === 'live' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Live
            {liveMatches.length > 0 && (
              <span className="ml-1.5 sm:ml-2 bg-red-100 text-red-600 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md text-[9px] sm:text-[10px] font-bold shadow-sm">
                {liveMatches.length}
              </span>
            )}
            {activeTab === 'live' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-400 to-red-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('featured')}
            className={`px-4 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 relative group ${activeTab === 'featured' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            For You
            {activeTab === 'featured' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-400 to-indigo-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-4 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 relative group ${activeTab === 'upcoming' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Upcoming
            {activeTab === 'upcoming' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-amber-600"></div>
            )}
          </button>
          <button
            onClick={() => setActiveTab('finished')}
            className={`px-4 sm:px-6 py-3 sm:py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 relative group ${activeTab === 'finished' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            Finished
            {activeTab === 'finished' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-600"></div>
            )}
          </button>
        </div>
      </div>

      {/* ENHANCED MATCH GRID - Better responsive */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 md:py-10">
        <section className="min-h-[300px] sm:min-h-[400px]">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
              {[1, 2, 3].map((i) => <MatchCardSkeleton key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
              {activeTab === 'featured' && featuredMatches.map(m => <MatchCard key={m.id} match={m} squadsMap={squadsMap} />)}
              {activeTab === 'live' && (
                <>
                  {liveMatches.length === 0 ? (
                    <div className="col-span-full py-12 sm:py-16 md:py-20 text-center bg-gradient-to-br from-white to-slate-50 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
                      <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4 animate-bounce">🏏</div>
                      <p className="text-slate-500 font-bold uppercase tracking-widest text-xs sm:text-sm mb-2">No Live Matches</p>
                      <p className="text-slate-400 text-[10px] sm:text-xs mb-4 sm:mb-6">Check back soon for live action!</p>
                      <Link
                        to="/schedule?tab=live"
                        className="text-blue-500 hover:text-blue-600 text-[10px] sm:text-xs font-black uppercase tracking-widest underline decoration-2 underline-offset-4 transition-colors"
                      >
                        See Full Match List
                      </Link>
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

          {/* Enhanced See Full Schedule Button */}
          {!loading && (
            <div className="mt-8 sm:mt-10 md:mt-12 flex justify-center">
              <Link
                to="/schedule"
                className="group bg-white px-6 sm:px-8 md:px-10 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 flex items-center gap-2 sm:gap-3 hover:border-teal-300 hover:bg-gradient-to-r hover:from-teal-50 hover:to-emerald-50"
              >
                <span className="text-[9px] sm:text-[10px] md:text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-500 group-hover:text-slate-900 transition-colors">
                  See Full Schedule
                </span>
                <svg
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-slate-300 group-hover:text-teal-500 group-hover:translate-x-1 transition-all duration-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </section>

        {/* ENHANCED Quick Links Section - Better responsive */}
        <section className="mt-12 sm:mt-16 md:mt-20 lg:mt-24">
          <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8 md:mb-10">
            <div className="h-0.5 sm:h-1 w-6 sm:w-8 md:w-10 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"></div>
            <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-900 uppercase tracking-[0.15em] sm:tracking-[0.2em]">
              Platform Hub
            </h2>
            <div className="flex-1 h-0.5 sm:h-1 bg-gradient-to-r from-teal-500/50 to-transparent rounded-full"></div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
            <Link
              to="/schedule"
              className="group bg-white p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-teal-200 flex flex-col items-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-teal-50/0 to-emerald-50/0 group-hover:from-teal-50/50 group-hover:to-emerald-50/50 transition-all duration-300"></div>
              <span className="relative text-2xl sm:text-3xl md:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">📅</span>
              <span className="relative text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-400 mb-1 group-hover:text-teal-600 transition-colors">
                Date Wise
              </span>
              <span className="relative text-xs sm:text-sm md:text-base font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                Schedule
              </span>
            </Link>
            <Link
              to="/tournaments"
              className="group bg-white p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-amber-200 flex flex-col items-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50/0 to-yellow-50/0 group-hover:from-amber-50/50 group-hover:to-yellow-50/50 transition-all duration-300"></div>
              <span className="relative text-2xl sm:text-3xl md:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">🏆</span>
              <span className="relative text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-400 mb-1 group-hover:text-amber-600 transition-colors">
                View All
              </span>
              <span className="relative text-xs sm:text-sm md:text-base font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                Tournaments
              </span>
            </Link>
            <Link
              to="/squads"
              className="group bg-white p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-blue-200 flex flex-col items-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/0 to-cyan-50/0 group-hover:from-blue-50/50 group-hover:to-cyan-50/50 transition-all duration-300"></div>
              <span className="relative text-2xl sm:text-3xl md:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">👥</span>
              <span className="relative text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-400 mb-1 group-hover:text-blue-600 transition-colors">
                Total Teams
              </span>
              <span className="relative text-xs sm:text-sm md:text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                Squads List
              </span>
            </Link>
            <Link
              to="/players"
              className="group bg-white p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border border-slate-100 hover:border-emerald-200 flex flex-col items-center hover:shadow-xl transition-all duration-300 hover:-translate-y-1 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 to-green-50/0 group-hover:from-emerald-50/50 group-hover:to-green-50/50 transition-all duration-300"></div>
              <span className="relative text-2xl sm:text-3xl md:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">🏏</span>
              <span className="relative text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-400 mb-1 group-hover:text-emerald-600 transition-colors">
                Performance
              </span>
              <span className="relative text-xs sm:text-sm md:text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                Player Stats
              </span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}

