
/**
 * Home Page
 * Beautiful, modern, and 100% responsive landing page
 * Optimized for performance (no heavy animations)
 */

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { squadService } from '@/services/firestore/squads'
import { tournamentService } from '@/services/firestore/tournaments'
import { Match, Squad } from '@/types'
import MatchCardSkeleton from '@/components/skeletons/MatchCardSkeleton'
import MatchCard from '@/components/match/MatchCard'
import { PinnedScoreWidget } from '@/components/match/PinnedScoreWidget'
import { coerceToDate } from '@/utils/date'
import { formatShortTeamName } from '@/utils/teamName'
import schoolConfig from '@/config/school'
import stadiumBg from '@/assets/hero-assets/stadium-bg.png'
import HeroCricketAnimation from '@/components/HeroCricketAnimation'

const HeroCricketSection = () => {
  return (
    <>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-teal-400 font-bold tracking-[0.4em] uppercase text-[9px] sm:text-[11px] mb-3"
      >
        The Ultimate Platform
      </motion.h2>
      <motion.h1
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tighter mb-2 leading-none"
      >
        <span className="italic">CRICKET</span> <span className="text-teal-400">LIVE</span>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-teal-400 font-extrabold tracking-[0.2em] text-[10px] sm:text-xs mx-auto mb-6 uppercase"
      >
        FASTEST SCORE • DEEP INSIGHTS
      </motion.p>
      <div className="w-12 h-1 bg-teal-500 rounded-full mb-6 sm:mb-4 mx-auto" />
      <div className="relative w-full max-w-[300px] sm:max-w-[320px] md:max-w-md flex items-center justify-center -mt-6 sm:-mt-10">
        <HeroCricketAnimation />
      </div>
    </>
  )
}

export default function Home() {
  const [liveMatches, setLiveMatches] = useState<Match[]>([])
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([])
  const [finishedMatches, setFinishedMatches] = useState<Match[]>([])
  const [featuredMatches, setFeaturedMatches] = useState<Match[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
  const [tournamentsMap, setTournamentsMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Subscribe to squads
    const unsubscribeSquads = squadService.subscribeAll(setSquads)
    return () => unsubscribeSquads()
  }, [])

  useEffect(() => {
    // Subscriber logic for CP config removed
  }, [])

  useEffect(() => {
    const loadMatches = async () => {
      try {
        setLoading(true)

        // Load all matches
        const allMatches = await matchService.getAll()

        // Load all tournaments
        const allTournaments = await tournamentService.getAll()
        const tMap: Record<string, string> = {}
        allTournaments.forEach(t => {
          tMap[t.id] = t.name
        })
        setTournamentsMap(tMap)

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
        const isLive = (m: any) => {
          const s = statusLower(m)
          return s === 'live' || s === 'inningsbreak' || s === 'innings break'
        }
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

        // FEATURED LOGIC: 2 Live + 1 Upcoming + 1 Finished
        let featured: Match[] = []

        // 1. Up to 2 Live matches
        featured.push(...live.slice(0, 2))

        // 2. 1 Most recent upcoming match
        if (upcoming.length > 0) {
          featured.push(upcoming[0])
        }

        // 3. 1 Most recent finished match
        if (finished.length > 0) {
          featured.push(finished[0])
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#060b16] font-sans overflow-x-hidden">
      {/* MODERN HERO SECTION - Adjusted Height for content */}
      <div className={`relative bg-[#060b16] text-white flex flex-col pt-6 transition-all duration-500 min-h-[480px] sm:min-h-[520px] pb-16`}>

        {/* STADIUM BACKGROUND OVERLAY - Optimized Height & Fade */}
        <div className="absolute top-0 left-0 w-full h-[70%] z-0 overflow-hidden pointer-events-none">
          <img
            src={stadiumBg}
            alt="Stadium Crowd"
            className="w-full h-full object-cover object-top opacity-20 mix-blend-luminosity scale-110"
          />
          {/* Subtle Fade to Hero Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#060b16]" />
        </div>

        {/* CINEMATIC PREMIUM BACKGROUND - Layered Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Deep Mesh Gradients */}
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-600/10 rounded-full blur-[140px] animate-pulse-slow"></div>
          <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[140px] animate-pulse-slow delay-700"></div>
          <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] bg-teal-600/10 rounded-full blur-[160px] animate-pulse-slow delay-1000"></div>

          {/* Subtle Floating Lights / Particles */}
          <motion.div
            animate={{
              y: [0, -30, 0],
              x: [0, 20, 0],
              opacity: [0.1, 0.3, 0.1]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[20%] left-[15%] w-32 h-32 bg-teal-400/20 rounded-full blur-3xl"
          />
          <motion.div
            animate={{
              y: [0, 40, 0],
              x: [0, -20, 0],
              opacity: [0.05, 0.2, 0.05]
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-[30%] right-[10%] w-48 h-48 bg-blue-500/10 rounded-full blur-3xl"
          />

          {/* Noise Texture Overlay for Premium Feel */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] contrast-150 brightness-150 mix-blend-overlay"></div>

          {/* Subtle Grid / Pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:32px_32px] opacity-40"></div>
        </div>

        <div className="relative z-30 w-full max-w-7xl mx-auto px-4 sm:px-6 flex-1 flex flex-col">

          {/* Header */}
          <div className="flex flex-col items-center mb-4 shrink-0">
            <div className="flex items-center gap-3 bg-[#060b16]/40 backdrop-blur-xl px-8 py-3 rounded-full border border-teal-500/20 shadow-[0_0_20px_rgba(20,184,166,0.1)]">
              <img
                src={schoolConfig.logo}
                alt="Logo"
                className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
              />
              <div className="text-left">
                <span className="block text-xs text-teal-400 font-extrabold uppercase tracking-[0.2em] leading-none mb-1">BATCHCRICKBD</span>
                <span className="block text-[8px] text-white/40 font-bold uppercase tracking-[0.2em]">{schoolConfig.slogan}</span>
              </div>
            </div>
          </div>

          {/* Hero Content Grid - Pull content up */}
          <div className="flex-1 flex flex-col items-center justify-start pt-2 sm:pt-4 text-center pb-2">
            <HeroCricketSection />
          </div>
        </div>

        {/* SINGLE WAVE CURVE - Perfectly Aligned with Button Center */}
        {/* SINGLE WAVE CURVE - Perfectly Aligned & Visible in Dark Mode */}
        <div className="absolute bottom-0 left-0 w-full z-20 pointer-events-none">
          <svg
            viewBox="0 0 1440 120"
            className="w-full h-[100px] block"
            preserveAspectRatio="none"
          >
            <path
              fill="currentColor"
              className="text-white dark:text-[#0a1224] transition-colors duration-500"
              d="M0,80 C480,80 480,40 720,40 C960,40 960,80 1440,80 V120 H0 Z"
            ></path>
            {/* Subtle Top Stroke for Wave in Dark Mode */}
            <path
              d="M0,80 C480,80 480,40 720,40 C960,40 960,80 1440,80"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-transparent dark:text-teal-500/20 transition-colors duration-500"
            />
          </svg>
        </div>

        {/* Premium Action Button - Enhanced with Glow & Gradient */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[-40px] z-30">
          <button
            onClick={() => document.getElementById('match-sections')?.scrollIntoView({ behavior: 'smooth' })}
            className="group relative bg-[#060b16] dark:bg-slate-900 text-white px-10 py-3 rounded-full font-black uppercase tracking-[0.2em] text-[11px] transition-all duration-500 hover:scale-110 active:scale-95 shadow-[0_15px_35px_-10px_rgba(0,0,0,0.6)] dark:shadow-[0_15px_35px_-10px_rgba(20,184,166,0.3)] whitespace-nowrap border-[4px] border-[#060b16] dark:border-slate-900 ring-2 ring-white/90 dark:ring-teal-500/50 overflow-hidden"
          >
            <span className="relative z-10">Let's Explore</span>
            {/* Animated Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-teal-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 -translate-x-full group-hover:translate-x-full" />
            <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </button>
        </div>

      </div>

      {/* SQUADS SCROLL - Native Horizontal Scroll (No Marquee Lag) */}
      <div className="py-6 bg-white dark:bg-[#050B18] overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <p className="px-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Participating Teams</p>

          {squads.filter(s => s.logoUrl).length > 0 ? (
            <div className="relative w-full overflow-hidden">
              <div className="flex w-max animate-marquee hover:pause gap-8">
                {/* Auto-moving list of squads WITH logos */}
                {(() => {
                  const filtered = squads.filter(s => s && s.name && s.logoUrl)
                  return [...filtered, ...filtered].map((squad, index) => (
                    <Link
                      to={`/squads/${squad.id}`}
                      key={`${squad.id}-${index}`}
                      className="flex flex-col items-center gap-2 min-w-[70px] group hover:scale-105 transition-transform"
                    >
                      <div className="w-14 h-14 sm:w-16 sm:h-16 transition-all transform group-hover:scale-110 duration-300 flex items-center justify-center rounded-full border border-slate-100 dark:border-white/5 overflow-hidden bg-white dark:bg-[#0f172a] shadow-sm relative">
                        <img
                          src={squad.logoUrl}
                          alt={squad.name}
                          className="w-full h-full object-contain p-1"
                        />
                      </div>
                      <span className="text-[9px] font-black text-slate-700 dark:text-slate-300 truncate max-w-full group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors uppercase tracking-tight">
                        {formatShortTeamName(squad.name)}
                      </span>
                    </Link>
                  ))
                })()}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic px-4">No team logos available</div>
          )}
        </div>
      </div>

      {/* MATCH SECTIONS - Clean Tabs - Sticky */}
      <div id="match-sections" className="bg-white dark:bg-[#080E1C] border-b border-slate-100 dark:border-white/5 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex overflow-x-auto scrollbar-hide px-2">
          {[
            { id: 'featured', label: 'For You' },
            { id: 'live', label: 'Live' },
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'finished', label: 'Finished' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 min-w-[100px] py-4 text-[11px] sm:text-xs font-black uppercase tracking-wider relative transition-all duration-300 ${activeTab === tab.id
                ? 'text-[#0f172a] dark:text-white scale-105'
                : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 opacity-60'
                }`}
            >
              {tab.label}
              {tab.id === 'live' && liveMatches.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[9px] px-1.5 rounded-full animate-pulse">
                  {liveMatches.length}
                </span>
              )}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTabUnderlineHome"
                  className="absolute bottom-1 left-4 right-4 h-1 bg-gradient-to-r from-teal-500 to-emerald-600 rounded-full shadow-[0_2px_10px_rgba(20,184,166,0.3)]"
                />
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
          <div className="w-full">
            {/* Standard Tab Content Rendering */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 px-1">
              {(() => {
                const matches = activeTab === 'featured' ? featuredMatches :
                  activeTab === 'live' ? liveMatches :
                    activeTab === 'upcoming' ? upcomingMatches :
                      finishedMatches;

                if (matches.length === 0) {
                  return (
                    <div className="col-span-full py-20 text-center flex flex-col items-center opacity-60">
                      <div className="text-5xl mb-4 grayscale">🏏</div>
                      <p className="text-slate-900 dark:text-white font-bold uppercase text-xs tracking-widest">
                        No {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Matches
                      </p>
                    </div>
                  );
                }

                return matches.map(m => (
                  <MatchCard key={m.id} match={m} squadsMap={squadsMap} tournamentName={tournamentsMap[m.tournamentId || '']} />
                ));
              })()}
            </div>
          </div>
        )}

        {/* View Full Schedule Link */}
        {!loading && (
          <div className="mt-8 text-center">
            <Link
              to="/schedule"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#0f172a] dark:text-teal-400 hover:text-teal-600 transition-colors border-b border-[#0f172a]/20 dark:border-teal-400/20 pb-0.5 hover:border-teal-600"
            >
              View Full Schedule
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            </Link>
          </div>
        )}
      </div>

      <div className="px-4 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-6 opacity-60">
            <div className="h-px bg-slate-200 dark:bg-white/5 flex-1"></div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Explore More</span>
            <div className="h-px bg-slate-200 dark:bg-white/5 flex-1"></div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickLinkCard to="/schedule" icon="📅" label="Schedule" sub="Date Wise" />
            <QuickLinkCard to="/tournaments" icon="🏆" label="Tournaments" sub="All Series" />
            <QuickLinkCard to="/squads" icon="👥" label="Teams" sub="Squad Info" />
            <QuickLinkCard to="/players" icon="📊" label="Stats" sub="Player Records" />
          </div>
        </div>
      </div>
      <PinnedScoreWidget />
    </div>
  )
}

function QuickLinkCard({ to, icon, label, sub }: { to: string, icon: string, label: string, sub: string }) {
  return (
    <Link to={to} className="bg-white dark:bg-[#081020] p-5 rounded-2xl border border-slate-100 dark:border-white/[0.05] shadow-sm hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.1)] transition-all duration-500 hover:-translate-y-1 active:scale-95 flex flex-col items-center text-center group">
      <div className="text-3xl mb-3 transform transition-transform group-hover:scale-125 duration-500 drop-shadow-md">{icon}</div>
      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.1em] mb-1 group-hover:text-teal-500 transition-colors">{sub}</div>
      <div className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter">{label}</div>
    </Link>
  )
}
