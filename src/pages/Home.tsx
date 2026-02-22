
/**
 * Home Page
 * Beautiful, modern, and 100% responsive landing page
 * Optimized for performance (no heavy animations)
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { squadService } from '@/services/firestore/squads'
import { tournamentService } from '@/services/firestore/tournaments'
import { Match, Squad } from '@/types'
import MatchCardSkeleton from '@/components/skeletons/MatchCardSkeleton'
import MatchCard from '@/components/match/MatchCard'
import { PinnedScoreWidget } from '@/components/match/PinnedScoreWidget'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { coerceToDate } from '@/utils/date'
import { formatShortTeamName } from '@/utils/teamName'
import schoolConfig from '@/config/school'
import heroStumps from '@/assets/hero_stumps.png'
import HangingCountdownCard from '@/components/common/HangingCountdownCard'

const HeroFlipDigit = ({ digit, color }: { digit: string, color: string }) => {
  const [displayDigit, setDisplayDigit] = useState(digit)
  const [nextDigit, setNextDigit] = useState(digit)
  const [isFlipping, setIsFlipping] = useState(false)

  useEffect(() => {
    if (digit !== nextDigit) {
      setNextDigit(digit)
      setIsFlipping(true)
      const timer = setTimeout(() => {
        setDisplayDigit(digit)
        setIsFlipping(false)
      }, 700)
      return () => clearTimeout(timer)
    }
  }, [digit, nextDigit])

  const commonStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: '50%',
    overflow: 'hidden',
    background: color,
    color: '#fff',
    fontSize: '24px',
    fontWeight: '900',
    textAlign: 'center',
    display: 'flex',
    justifyContent: 'center',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
  }

  const topStyle: React.CSSProperties = {
    ...commonStyle,
    top: 0,
    alignItems: 'flex-end',
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px',
    borderBottom: '1px solid rgba(0,0,0,0.15)',
  }

  const bottomStyle: React.CSSProperties = {
    ...commonStyle,
    bottom: 0,
    alignItems: 'flex-start',
    borderBottomLeftRadius: '8px',
    borderBottomRightRadius: '8px',
  }

  return (
    <div className="relative w-8 h-12 sm:w-12 sm:h-18 lg:w-16 lg:h-22 perspective-[500px] rounded-lg shadow-xl shadow-black/30 overflow-hidden bg-black/20">
      {/* 1. UPPER BACK */}
      <div style={{ ...topStyle, zIndex: 1 }}>
        <span style={{ transform: 'translateY(50%)' }}>{nextDigit}</span>
      </div>

      {/* 2. LOWER BACK */}
      <div style={{ ...bottomStyle, zIndex: 1 }}>
        <span style={{ transform: 'translateY(-50%)' }}>{displayDigit}</span>
      </div>

      {/* 3. UPPER FLAP */}
      <div style={{
        ...topStyle,
        zIndex: isFlipping ? 3 : 2,
        transformOrigin: 'bottom',
        transition: isFlipping ? 'transform 0.35s ease-in' : 'none',
        transform: isFlipping ? 'rotateX(-90deg)' : 'rotateX(0deg)',
        background: `linear-gradient(180deg, ${color} 0%, ${color}dd 100%)`
      }}>
        <span style={{ transform: 'translateY(50%)' }}>{displayDigit}</span>
      </div>

      {/* 4. LOWER FLAP */}
      <div style={{
        ...bottomStyle,
        zIndex: isFlipping ? 4 : 2,
        transformOrigin: 'top',
        transition: isFlipping ? 'transform 0.35s ease-out 0.35s' : 'none',
        transform: isFlipping ? 'rotateX(0deg)' : 'rotateX(90deg)',
        background: `linear-gradient(180deg, ${color} 0%, ${color}dd 100%)`
      }}>
        <span style={{ transform: 'translateY(-50%)' }}>{nextDigit}</span>
      </div>

      {/* Split Line */}
      <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-black/30 z-10" />

      {/* Gloss Overlay */}
      <div className="absolute inset-0 z-11 pointer-events-none rounded-lg border border-white/10 bg-gradient-to-b from-white/5 to-transparent" />
    </div>
  )
}

const HeroTimeUnit = ({ value, label, color }: { value: number, label: string, color: string }) => {
  const str = String(value).padStart(2, '0')
  return (
    <div className="flex flex-col items-center gap-2 sm:gap-3">
      <div className="flex gap-1 sm:gap-1.5 lg:gap-2">
        <HeroFlipDigit digit={str[0]} color={color} />
        <HeroFlipDigit digit={str[1]} color={color} />
      </div>
      <span className="text-[8px] sm:text-[11px] lg:text-xs font-black text-white/40 uppercase tracking-[0.2em]">{label}</span>
    </div>
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
  const [cpConfig, setCpConfig] = useState<{ enabled: boolean, startDate: string, tournamentName: string } | null>(null)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    // Subscribe to squads
    const unsubscribeSquads = squadService.subscribeAll(setSquads)
    return () => unsubscribeSquads()
  }, [])

  useEffect(() => {
    // Real-time Countdown Config listener
    const docRef = doc(db, 'settings', 'countdownPopup')
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setCpConfig({
          enabled: !!data.enabled,
          startDate: data.startDate || '',
          tournamentName: data.tournamentName || ''
        })
      }
    }, (err) => {
      console.warn('Failed to subscribe to hero countdown:', err)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!cpConfig?.enabled || !cpConfig?.startDate) return

    const calc = () => {
      const target = new Date(cpConfig.startDate + 'T00:00:00').getTime()
      const now = Date.now()
      const diff = Math.max(0, target - now)
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      })
    }
    calc()
    const ival = setInterval(calc, 1000)
    return () => clearInterval(ival)
  }, [cpConfig])

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
    <div className="min-h-screen bg-slate-50 dark:bg-[#060b16] font-sans">
      {/* MODERN HERO SECTION - Adjusted Height for content */}
      <div className={`relative bg-[#0f172a] text-white flex flex-col pt-6 transition-all duration-500 ${cpConfig?.enabled ? 'min-h-[450px] sm:min-h-[580px] pb-24' : 'h-[45vh] min-h-[350px]'}`}>

        {/* Background Gradients Wrapper - Contained to prevent overflow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-600/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 flex-1 flex flex-col">

          {/* Header */}
          <div className="flex flex-col items-center mb-4 shrink-0">
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
              <img
                src={schoolConfig.logo}
                alt="Logo"
                className="w-10 h-10 object-contain drop-shadow-md hover:scale-110 transition-transform cursor-pointer"
              />
              <div className="text-left">
                <span className="block text-[10px] text-teal-400 font-black uppercase tracking-widest leading-none mb-1">Official App</span>
                <span className="block text-sm font-black text-white leading-none tracking-wide">{schoolConfig.name}</span>
              </div>
            </div>
          </div>

          {/* Hero Content Grid - Pull content up */}
          <div className="flex-1 flex flex-col items-center justify-start pt-4 sm:pt-8 text-center pb-4">

            {cpConfig?.enabled ? (
              <div className="animate-in fade-in zoom-in duration-700 w-full">
                {/* Reference Design Header */}
                <div className="flex items-center justify-center gap-2 sm:gap-8 mb-3 sm:mb-8">
                  <div className="h-px w-8 sm:w-32 border-b border-dashed border-white/20" />
                  <span className="text-[9px] sm:text-xs font-black uppercase tracking-[0.3em] text-white/40">Time Remaining</span>
                  <div className="h-px w-8 sm:w-32 border-b border-dashed border-white/20" />
                </div>

                {/* Flip Clock Grid - Fully Responsive scaling */}
                <div className="mx-auto max-w-[340px] sm:max-w-2xl bg-white/5 backdrop-blur-md px-4 py-4 sm:px-12 rounded-3xl border border-white/5 shadow-2xl">
                  <div className="flex items-start justify-center gap-2 sm:gap-6 lg:gap-8">
                    <HeroTimeUnit value={timeLeft.days} label="Days" color="#f59e0b" />
                    <div className="pt-2 sm:pt-4 text-xs sm:text-2xl font-black text-white/10 animate-pulse">:</div>
                    <HeroTimeUnit value={timeLeft.hours} label="Hrs" color="#84cc16" />
                    <div className="pt-2 sm:pt-4 text-xs sm:text-2xl font-black text-white/10 animate-pulse">:</div>
                    <HeroTimeUnit value={timeLeft.minutes} label="Min" color="#ef4444" />
                    <div className="pt-2 sm:pt-4 text-xs sm:text-2xl font-black text-white/10 animate-pulse">:</div>
                    <HeroTimeUnit value={timeLeft.seconds} label="Sec" color="#a855f7" />
                  </div>
                </div>

                <div className="mt-3 sm:mt-8 px-2">
                  <div className="inline-block px-3 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 mb-2">
                    <p className="text-[8px] sm:text-xs font-black text-teal-400 uppercase tracking-[0.2em]">Upcoming Tournament</p>
                  </div>
                  <h1 className="text-xl sm:text-4xl font-black text-white tracking-tight drop-shadow-2xl max-w-2xl mx-auto leading-tight">{cpConfig.tournamentName}</h1>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-teal-400 font-bold tracking-[0.2em] uppercase text-[10px] sm:text-xs mb-1 sm:mb-2">The Ultimate Platform</h2>
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-2 drop-shadow-xl">
                  CRICKET <span className="text-teal-500">LIVE</span>
                </h1>
                <p className="text-blue-200/80 text-[10px] sm:text-xs font-medium tracking-wide max-w-md mx-auto mb-4 sm:mb-6">
                  {schoolConfig.tagline}
                </p>
              </>
            )}

            {/* Hero Image - Scaled to fit */}
            {!cpConfig?.enabled && (
              <div className="relative w-full max-w-[320px] sm:max-w-sm md:max-w-md aspect-video flex items-center justify-center">
                <HangingCountdownCard />
                <img
                  src={heroStumps}
                  alt="Cricket Stumps"
                  className="w-full h-full object-contain filter drop-shadow-2xl"
                />
              </div>
            )}
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
            className="group relative bg-[#0f172a] dark:bg-white text-white dark:text-[#0f172a] px-8 py-3 rounded-full font-black uppercase tracking-widest text-[11px] sm:text-xs transition-all hover:scale-105 active:scale-95 shadow-xl shadow-teal-500/20 whitespace-nowrap border-4 border-white dark:border-slate-900"
          >
            Let's Explore
          </button>
        </div>

      </div>

      {/* SQUADS SCROLL - Native Horizontal Scroll (No Marquee Lag) */}
      <div className="py-6 bg-white dark:bg-[#060b16] overflow-hidden">
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
                        {formatShortTeamName(squad.name, squad.batch)}
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
      <div id="match-sections" className="bg-white dark:bg-[#0f172a] border-b border-slate-100 dark:border-white/5 sticky top-0 z-30 shadow-sm">
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
                ? 'text-[#0f172a] dark:text-white'
                : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
                }`}
            >
              {tab.label}
              {tab.id === 'live' && liveMatches.length > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-[9px] px-1.5 rounded-full animate-pulse">
                  {liveMatches.length}
                </span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0f172a] dark:bg-teal-500"></div>
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
            {activeTab === 'featured' && featuredMatches.map(m => <MatchCard key={m.id} match={m} squadsMap={squadsMap} tournamentName={tournamentsMap[m.tournamentId]} />)}

            {activeTab === 'live' && (
              <>
                {liveMatches.length === 0 ? (
                  <div className="col-span-full py-12 text-center flex flex-col items-center opacity-60">
                    <div className="text-5xl mb-4 grayscale">🏏</div>
                    <p className="text-slate-900 dark:text-white font-bold uppercase text-xs tracking-widest">No Live Matches</p>
                  </div>
                ) : (
                  liveMatches.map(m => <MatchCard key={m.id} match={m} squadsMap={squadsMap} tournamentName={tournamentsMap[m.tournamentId]} />)
                )}
              </>
            )}

            {activeTab === 'upcoming' && upcomingMatches.map(m => <MatchCard key={m.id} match={m} squadsMap={squadsMap} tournamentName={tournamentsMap[m.tournamentId]} />)}
            {activeTab === 'finished' && finishedMatches.map(m => <MatchCard key={m.id} match={m} squadsMap={squadsMap} tournamentName={tournamentsMap[m.tournamentId]} />)}

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
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#0f172a] dark:text-teal-400 hover:text-teal-600 transition-colors border-b border-[#0f172a]/20 dark:border-teal-400/20 pb-0.5 hover:border-teal-600"
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
    <Link to={to} className="bg-white dark:bg-[#0f172a] p-4 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all active:scale-95 flex flex-col items-center text-center">
      <div className={`text-2xl mb-2`}>{icon}</div>
      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-0.5">{sub}</div>
      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{label}</div>
    </Link>
  )
}
