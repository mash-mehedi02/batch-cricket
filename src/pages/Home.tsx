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
import { coerceToDate, formatDateLabelTZ, formatTimeHMTo12h, formatTimeLabelBD } from '@/utils/date'
import schoolConfig from '@/config/school'
import heroStumps from '@/assets/hero_stumps.png'

export default function Home() {
  const [liveMatches, setLiveMatches] = useState<Match[]>([])
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([])
  const [finishedMatches, setFinishedMatches] = useState<Match[]>([])
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

        // Load live matches
        const live = await matchService.getLiveMatches()
        console.log('Loaded live matches:', live)
        setLiveMatches(live)

        const parseStartTs = (m: any): number => {
          const d0 = coerceToDate(m?.date)
          if (d0) return d0.getTime()
          const d = String(m?.date || '').trim()
          const t = String(m?.time || '').trim()
          if (!d) return 0
          // If time includes AM/PM, prefer space parsing
          const ts1 = t ? Date.parse(`${d} ${t}`) : Date.parse(d)
          if (Number.isFinite(ts1)) return ts1
          const ts2 = Date.parse(`${d}T${t || '00:00'}:00`)
          return Number.isFinite(ts2) ? ts2 : 0
        }

        // Load all matches and split by status
        const allMatches = await matchService.getAll()
        const liveIds = new Set(live.map((m) => m.id))
        const nonLive = allMatches.filter((m) => !liveIds.has(m.id))

        const statusLower = (m: any) => String(m?.status || '').toLowerCase().trim()
        const isFinished = (m: any) => ['finished', 'completed'].includes(statusLower(m))
        const isUpcoming = (m: any) => {
          const s = statusLower(m)
          return s === '' || s === 'upcoming' || s === 'scheduled'
        }

        const finished = nonLive
          .filter(isFinished)
          .slice()
          .sort((a: any, b: any) => parseStartTs(b) - parseStartTs(a) || String(b.id).localeCompare(String(a.id)))
          .slice(0, 6)

        const upcoming = nonLive
          .filter(isUpcoming)
          .slice()
          .sort((a: any, b: any) => {
            const ta = parseStartTs(a) || Number.MAX_SAFE_INTEGER
            const tb = parseStartTs(b) || Number.MAX_SAFE_INTEGER
            return ta - tb || String(a.id).localeCompare(String(b.id))
          })
          .slice(0, 6)

        setFinishedMatches(finished)
        setUpcomingMatches(upcoming)
      } catch (error) {
        console.error('Error loading matches:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMatches()
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* NIGHT STADIUM HERO (High-Impact Visuals) */}
      <div className="relative min-h-[650px] md:h-[90vh] bg-[#000814] overflow-hidden flex flex-col items-center justify-center z-10 transition-all duration-1000">

        {/* 1. LAYERED STADIUM GLOWS (Vibrant Corners) */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full animate-pulse-slow"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-400/15 blur-[120px] rounded-full animate-pulse-slow delay-1000"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-magenta-600/10 blur-[120px] rounded-full animate-pulse-slow delay-500" style={{ backgroundColor: '#c026d320' }}></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-blue-500/10 blur-[100px] rounded-full animate-float"></div>

        {/* 2. ENERGY PARTICLES (Drifting Embers) */}
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
          {/* Top School Branding (Minimalist) */}
          <div className="flex items-center gap-5 mb-10 opacity-100 scale-100 transition-transform">
            <img
              src={schoolConfig.logo}
              alt="Logo"
              className="w-[5.5rem] h-[5.5rem] md:w-24 md:h-24 object-contain filter drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]"
            />
            <div className="flex flex-col items-start leading-none group">
              <span className="text-white font-black tracking-[0.2em] text-lg md:text-2xl uppercase drop-shadow-md">{schoolConfig.name}</span>
              <div className="h-0.5 w-full bg-blue-400/50 rounded-full mt-2"></div>
            </div>
          </div>

          {/* Headline Group (Refined Scale) */}
          <div className="mb-0 z-30">
            <h2 className="text-blue-200 text-[0.9rem] md:text-xl font-bold tracking-[0.4em] uppercase mb-1 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)] animate-in fade-in slide-in-from-top-4 duration-1000">
              Ultimate Destination For
            </h2>
            <h1 className="text-[2rem] md:text-6xl lg:text-7xl font-black text-white leading-none tracking-tighter drop-shadow-[0_15px_40px_rgba(0,0,0,0.7)] animate-in zoom-in-95 duration-700">
              CRICKET<span className="text-red-600 animate-pulse">!</span>
            </h1>
          </div>

          {/* Central Graphic: Stumps Hit (Refined Burst) */}
          <div className="relative w-full max-w-2xl h-[450px] md:h-[650px] -mt-16 md:-mt-24 flex flex-col items-center justify-center pointer-events-none group">

            {/* ENERGY BURST SVG (High-Impact Layers) */}
            <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
              <svg viewBox="0 0 500 500" className="w-[150%] h-[150%] opacity-70">
                <defs>
                  <radialGradient id="energyGlowRefined" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.8" />
                    <stop offset="40%" stopColor="#2563eb" stopOpacity="0.4" />
                    <stop offset="70%" stopColor="#1e3a8a" stopOpacity="0.1" />
                    <stop offset="100%" stopColor="#000" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Main Energy Pulse */}
                <circle cx="250" cy="250" r="200" fill="url(#energyGlowRefined)" className="animate-pulse-slow" />

                {/* Thick Kinetic Lines */}
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => (
                  <g key={i} transform={`rotate(${angle} 250 250)`}>
                    <line
                      x1="250" y1="210" x2="250" y2="50"
                      stroke={i % 2 === 0 ? "#60a5fa" : "#3b82f6"}
                      strokeWidth={i % 3 === 0 ? "4" : "2"}
                      strokeOpacity="0.4"
                      className="animate-pulse"
                    />
                    <circle cx="250" cy="40" r="2" fill="white" opacity="0.6" />
                  </g>
                ))}

                {/* Particle Ring (Animated Rotation) */}
                <g className="animate-spin-slow">
                  {[...Array(12)].map((_, i) => (
                    <circle
                      key={i}
                      cx={250 + 160 * Math.cos(i * 30 * Math.PI / 180)}
                      cy={250 + 160 * Math.sin(i * 30 * Math.PI / 180)}
                      r="1.5"
                      fill="white"
                      opacity="0.3"
                    />
                  ))}
                </g>
              </svg>
            </div>

            {/* CENTRAL GRAPHIC */}
            <div className="relative z-10 w-full h-[350px] md:h-[500px] animate-float">
              <img
                src={heroStumps}
                alt="Cricket Stumps"
                className="w-full h-full object-contain filter drop-shadow-[0_30px_60px_rgba(0,0,0,0.9)]"
              />
              {/* Impact Core Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-orange-500/25 blur-[50px] rounded-full animate-ping"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-white/15 blur-[25px] rounded-full"></div>
            </div>

            {/* INTEGRATED CTA BUTTON */}
            <div className="relative z-[60] -mt-8 md:-mt-12 pointer-events-auto flex flex-col items-center">
              <button
                onClick={() => document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth' })}
                className="group relative px-12 py-5 bg-gradient-to-r from-teal-400 to-emerald-500 text-white font-black uppercase tracking-[0.2em] rounded-full shadow-[0_20px_50px_rgba(20,184,166,0.4)] hover:shadow-[0_30px_70px_rgba(20,184,166,0.6)] transform transition-all duration-300 hover:-translate-y-1 active:scale-95 border-b-4 border-teal-600 active:border-b-0 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-700"
              >
                <span className="relative z-10 flex items-center gap-4 text-sm md:text-base">
                  Let's Explore
                </span>
                {/* Arrow Icon in Circle */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:right-4 transition-all duration-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
                {/* Glossy Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-transparent rounded-full pointer-events-none"></div>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Smooth Wave */}
        <div className="absolute bottom-[-1px] left-0 w-full z-40">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
            <path d="M0 120H1440V40.5C1360.5 15.5 1184 -19.5 905.5 14.5C557.375 57 186.5 102 0 40.5V120Z" fill="white" />
          </svg>
        </div>
      </div>

      {/* SQUAD MARQUEE: Seamless Luxury Edition */}
      <div id="main-content" className="bg-white py-14 overflow-hidden relative group/marquee">
        {/* Edge Masking for smooth fade-in/out */}
        <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-white via-white/80 to-transparent z-10 pointer-events-none"></div>
        <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-white via-white/80 to-transparent z-10 pointer-events-none"></div>

        <div className="flex items-center">
          {(() => {
            const logoSquads = squads.filter(s => s.logoUrl);
            if (logoSquads.length === 0) return null;

            // Simple loop of logos for the marquee segments
            const LogoSet = () => (
              <div className="flex shrink-0 items-center justify-around min-w-full gap-20 px-10">
                {logoSquads.map((squad) => (
                  <div key={squad.id} className="relative group/logo">
                    <img
                      src={squad.logoUrl}
                      alt={squad.name}
                      className="w-24 h-24 md:w-28 md:h-28 object-contain opacity-90 group-hover/logo:opacity-100 group-hover/logo:scale-110 transition-all duration-700 ease-out cursor-pointer drop-shadow-sm"
                    />
                    {/* Subtle dot indicator below */}
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-500 rounded-full opacity-0 group-hover/logo:opacity-100 transition-opacity"></div>
                  </div>
                ))}
              </div>
            );

            return (
              <div className="flex animate-marquee whitespace-nowrap">
                <LogoSet />
                <LogoSet />
              </div>
            );
          })()}
        </div>

        {/* Floating Label (Luxury Touch) */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/marquee:opacity-100 transition-opacity duration-500">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-[.6em]">Our Participating Squads</span>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Live Matches */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 w-12 bg-gradient-to-r from-red-500 to-red-600 rounded-full"></div>
            <h2 className="text-3xl font-bold text-slate-900">
              Live Matches
            </h2>
            <div className="h-1 flex-1 bg-gradient-to-r from-red-500/30 to-transparent rounded-full"></div>
          </div>

          {
            loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <MatchCardSkeleton key={i} />
                ))}
              </div>
            ) : liveMatches.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl shadow-lg p-12 text-center border-2 border-dashed border-slate-200">
                <div className="text-5xl mb-4">📅</div>
                <p className="text-lg text-slate-600 font-medium">No live matches at the moment</p>
                <p className="text-sm text-slate-500 mt-2">Check back later for upcoming matches</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {liveMatches.map((match) => {
                  const d = coerceToDate((match as any).date)
                  const timeText = String((match as any).time || '').trim()
                    ? formatTimeHMTo12h(String((match as any).time || '').trim())
                    : d
                      ? formatTimeLabelBD(d)
                      : null

                  return (
                    <Link
                      key={match.id}
                      to={`/match/${match.id}`}
                      className="group bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border-2 border-transparent hover:border-red-500/30 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full -mr-16 -mt-16"></div>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                          <span className="px-4 py-1.5 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold rounded-full animate-pulse shadow-lg shadow-red-500/50">
                            🔴 LIVE
                          </span>
                        </div>

                        <h3 className="font-bold text-xl text-slate-900 mb-2 group-hover:text-teal-600 transition">
                          {match.teamAName || match.teamA || 'Team A'} vs {match.teamBName || match.teamB || 'Team B'}
                        </h3>
                        <p className="text-sm text-slate-600 font-medium mb-1">📍 {match.venue || 'Venue TBA'}</p>

                        {d ? (
                          <p className="text-xs text-slate-500">
                            📅 {formatDateLabelTZ(d)}
                            {timeText ? ` • ${timeText}` : ''}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )
          }
        </section>

        {/* Upcoming Matches */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 w-12 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full"></div>
            <h2 className="text-3xl font-bold text-slate-900">
              Upcoming Matches
            </h2>
            <div className="h-1 flex-1 bg-gradient-to-r from-amber-500/30 to-transparent rounded-full"></div>
          </div>

          {
            loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <MatchCardSkeleton key={i} />
                ))}
              </div>
            ) : upcomingMatches.length === 0 ? (
              <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl shadow-lg p-12 text-center border-2 border-dashed border-slate-200">
                <div className="text-5xl mb-4">⏳</div>
                <p className="text-lg text-slate-600 font-medium">No upcoming matches scheduled</p>
                <p className="text-sm text-slate-500 mt-2">Please check back later</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingMatches.map((match) => {
                  const d = coerceToDate((match as any).date)
                  const timeText = String((match as any).time || '').trim()
                    ? formatTimeHMTo12h(String((match as any).time || '').trim())
                    : d
                      ? formatTimeLabelBD(d)
                      : null
                  return (
                    <Link
                      key={match.id}
                      to={`/match/${match.id}`}
                      className="group bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border-2 border-transparent hover:border-amber-500/30 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -mr-16 -mt-16"></div>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                          <span className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-bold rounded-full shadow-lg">
                            UPCOMING
                          </span>
                        </div>
                        <h3 className="font-bold text-xl text-slate-900 mb-2 group-hover:text-amber-700 transition">
                          {match.teamAName || match.teamA || 'Team A'} vs {match.teamBName || match.teamB || 'Team B'}
                        </h3>
                        <p className="text-sm text-slate-600 font-medium mb-1">📍 {match.venue || 'Venue TBA'}</p>
                        {d ? (
                          <p className="text-xs text-slate-500">
                            📅 {formatDateLabelTZ(d)}{timeText ? ` • ${timeText}` : ''}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )
          }
        </section>

        {/* Finished Matches (Recent) */}
        {
          finishedMatches.length > 0 && (
            <section className="mb-16">
              <div className="flex items-center gap-3 mb-8">
                <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"></div>
                <h2 className="text-3xl font-bold text-slate-900">
                  Finished Matches
                </h2>
                <div className="h-1 flex-1 bg-gradient-to-r from-blue-500/30 to-transparent rounded-full"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {finishedMatches.map((match) => {
                  const statusLower = String(match.status || '').toLowerCase()
                  const statusColor =
                    statusLower === 'live' ? 'from-red-500 to-red-600' :
                      (statusLower === 'finished' || statusLower === 'completed') ? 'from-slate-500 to-slate-600' :
                        'from-blue-500 to-blue-600'
                  const d = coerceToDate((match as any).date)
                  const timeText = String((match as any).time || '').trim()
                    ? formatTimeHMTo12h(String((match as any).time || '').trim())
                    : d
                      ? formatTimeLabelBD(d)
                      : null

                  return (
                    <Link
                      key={match.id}
                      to={`/match/${match.id}`}
                      className="group bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border-2 border-transparent hover:border-blue-500/30 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16"></div>
                      <div className="relative">
                        <div className="flex items-center justify-between mb-4">
                          <span className={`px-4 py-1.5 bg-gradient-to-r ${statusColor} text-white text-xs font-bold rounded-full shadow-lg ${(String(match.status).toLowerCase() === 'live') ? 'animate-pulse' : ''
                            }`}>
                            {match.status?.toUpperCase() || 'FINISHED'}
                          </span>
                        </div>
                        <h3 className="font-bold text-xl text-slate-900 mb-2 group-hover:text-blue-600 transition">
                          {match.teamAName || match.teamA || 'Team A'} vs {match.teamBName || match.teamB || 'Team B'}
                        </h3>
                        <p className="text-sm text-slate-600 font-medium mb-1">📍 {match.venue || 'Venue TBA'}</p>
                        {d ? (
                          <p className="text-xs text-slate-500">
                            📅 {formatDateLabelTZ(d)}{timeText ? ` • ${timeText}` : ''}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>
          )
        }

        {/* Quick Links - Professional Cards */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 w-12 bg-gradient-to-r from-teal-500 to-emerald-600 rounded-full"></div>
            <h2 className="text-3xl font-bold text-slate-900">
              Explore Platform
            </h2>
            <div className="h-1 flex-1 bg-gradient-to-r from-teal-500/30 to-transparent rounded-full"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link
              to="/tournaments"
              className="group bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-center border-2 border-amber-200 hover:border-amber-400 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/20 rounded-full -mr-12 -mt-12"></div>
              <div className="relative">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🏆</div>
                <h3 className="font-bold text-xl text-slate-900 mb-2 group-hover:text-amber-700 transition">Tournaments</h3>
                <p className="text-sm text-slate-600">View all tournaments</p>
              </div>
            </Link>
            <Link
              to="/squads"
              className="group bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-center border-2 border-blue-200 hover:border-blue-400 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-400/20 rounded-full -mr-12 -mt-12"></div>
              <div className="relative">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">👥</div>
                <h3 className="font-bold text-xl text-slate-900 mb-2 group-hover:text-blue-700 transition">Squads</h3>
                <p className="text-sm text-slate-600">Browse team squads</p>
              </div>
            </Link>
            <Link
              to="/players"
              className="group bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-center border-2 border-emerald-200 hover:border-emerald-400 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-400/20 rounded-full -mr-12 -mt-12"></div>
              <div className="relative">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🏏</div>
                <h3 className="font-bold text-xl text-slate-900 mb-2 group-hover:text-emerald-700 transition">Players</h3>
                <p className="text-sm text-slate-600">Explore player profiles</p>
              </div>
            </Link>
            <Link
              to="/champions"
              className="group bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-8 text-center border-2 border-purple-200 hover:border-purple-400 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-400/20 rounded-full -mr-12 -mt-12"></div>
              <div className="relative">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">👑</div>
                <h3 className="font-bold text-xl text-slate-900 mb-2 group-hover:text-purple-700 transition">Champions</h3>
                <p className="text-sm text-slate-600">View champions archive</p>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
