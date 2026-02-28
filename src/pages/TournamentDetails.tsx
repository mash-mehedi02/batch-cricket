/**
 * Tournament Details Page - Redesigned for a premium, high-fidelity experience
 * Matching the requested "All Series" overview with Key Stats, Bracket, Points Table, etc.
 * Ads and Videos removed as requested.
 */

import { useEffect, useState, useMemo, useRef } from 'react'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import type { Match, Tournament, Squad, Player, InningsStats } from '@/types'
import { coerceToDate } from '@/utils/date'
import { formatShortTeamName } from '@/utils/teamName'
import { getMatchResultString } from '@/utils/matchWinner'
import TournamentPointsTable from '@/pages/TournamentPointsTable'
import TournamentKeyStats from '@/pages/TournamentKeyStats'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import { ArrowLeft, Bell, Share2, ChevronRight, Check, Shield, MapPin, Calendar, Users, Trophy } from 'lucide-react'
import PlayoffBracket from '@/components/tournament/PlayoffBracket'
import MatchCard from '@/components/match/MatchCard'
import { memo } from 'react'
import { useAuthStore } from '@/store/authStore'
import { oneSignalService } from '@/services/oneSignalService'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { db } from '@/config/firebase'
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import toast from 'react-hot-toast'
// Screenshot sharing removed
import { followService } from '@/services/firestore/followService'


type Tab = 'overview' | 'matches' | 'teams' | 'points' | 'stats'

export default function TournamentDetails() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get('tab')?.toLowerCase()
    if (tab === 'matches' || tab === 'teams' || tab === 'points' || tab === 'stats') return tab as Tab
    return 'overview'
  })

  const [tournamentData, setTournamentData] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [inningsMap, setInningsMap] = useState<Map<string, { teamA: InningsStats | null; teamB: InningsStats | null; aso?: InningsStats | null; bso?: InningsStats | null }>>(new Map())
  const [loading, setLoading] = useState(true)

  // const tabsArray: Tab[] = ['overview', 'matches', 'teams', 'points', 'stats'];
  // const currentTabIndex = tabsArray.indexOf(activeTab);
  // const isAnimatingRef = useRef(false);
  // const x = useMotionValue(0);
  // const animatedX = useTransform(x, (value) => `calc(-${currentTabIndex * 100}% + ${value}px)`);

  // useEffect(() => {
  //   if (!isAnimatingRef.current) {
  //     animate(x, 0, { type: 'spring', stiffness: 300, damping: 30, mass: 0.5 });
  //   }
  // }, [currentTabIndex, x]);

  const { user } = useAuthStore()
  const isFollowing = useMemo(() => followService.isFollowing(user, 'tournament', tournamentId!), [user, tournamentId])

  const handleFollow = async () => {
    if (!user) {
      // Store pending follow and show login sheet
      await followService.follow('tournament', tournamentId!)
      setSearchParams({ ...Object.fromEntries(searchParams), login: 'true' }, { replace: true })
      return
    }

    if (!tournamentId) return

    if (isFollowing) {
      await followService.unfollow('tournament', tournamentId)
      // Unsubscribe from notifications
      oneSignalService.unsubscribeFromTournament(tournamentId, tournamentData?.createdBy || 'admin')
    } else {
      await followService.follow('tournament', tournamentId)
      // Subscribe to notifications
      oneSignalService.subscribeToTournament(tournamentId, tournamentData?.createdBy || 'admin')
    }
  }


  // Update URL when tab changes
  useEffect(() => {
    setSearchParams({ tab: activeTab }, { replace: true })
  }, [activeTab, setSearchParams])

  // Data loading (Real-time)
  useEffect(() => {
    if (!tournamentId) return
    setLoading(true)

    // 1. Subscribe to tournament
    const unsubTournament = tournamentService.subscribeToTournament(tournamentId, (t) => {
      setTournamentData(t)
      if (t) {
        // Fetch squads & players (once, or can subscribe if needed, but tournament & matches are priority)
        const fetchMeta = async () => {
          const [allS, allP] = await Promise.all([
            squadService.getAll(),
            playerService.getAll()
          ])
          setPlayers(allP)
          // Filter squads later based on matches or explicit IDs
          setSquads(allS.filter(s => (t as any)?.participantSquadIds?.includes(s.id)))
        }
        fetchMeta()
      }
      setLoading(false)
    })

    // 2. Subscribe to matches
    const unsubMatches = matchService.subscribeByTournament(tournamentId, async (ms) => {
      setMatches(ms)

      // Fetch innings for relevant matches
      const relevantMatches = ms.filter(m => {
        const s = String(m.status || '').toLowerCase()
        return s === 'live' || s === 'finished' || s === 'completed' || s === 'inningsbreak' || s === 'innings break'
      })

      if (relevantMatches.length > 0) {
        const entries = await Promise.all(
          relevantMatches.map(async (m) => {
            const [a, b, aso, bso] = await Promise.all([
              matchService.getInnings(m.id, 'teamA').catch(() => null),
              matchService.getInnings(m.id, 'teamB').catch(() => null),
              matchService.getInnings(m.id, 'teamA_super').catch(() => null),
              matchService.getInnings(m.id, 'teamB_super').catch(() => null),
            ])
            return [m.id, { teamA: a, teamB: b, aso, bso }] as const
          })
        )
        const im = new Map<string, { teamA: InningsStats | null; teamB: InningsStats | null; aso?: InningsStats | null; bso?: InningsStats | null }>()
        entries.forEach(([id, v]) => im.set(id, v))
        setInningsMap(im)
      }
    })

    return () => {
      unsubTournament()
      unsubMatches()
    }
  }, [tournamentId])

  const [scrolled, setScrolled] = useState(false)
  // Long-press screenshot sharing removed

  useEffect(() => {
    const handleScroll = () => {
      // Small threshold for a quick feel
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Create squadsMap for MatchCard
  const squadsMap = useMemo(() => {
    const map: Record<string, Squad> = {}
    squads.forEach(s => {
      if (s.id) map[s.id] = s
    })
    return map
  }, [squads])

  // Memoize tabs to prevent heavy re-renders on scroll state change
  const content = useMemo(() => {
    if (!tournamentData) return null

    switch (activeTab) {
      case 'overview':
        return (
          <OverviewTab
            tournament={tournamentData}
            matches={matches}
            squads={squads}
            players={players}
            inningsMap={inningsMap}
            setActiveTab={setActiveTab}
            squadsMap={squadsMap}
          />
        )
      case 'matches':
        return <TournamentMatchesTab matches={matches} squadsMap={squadsMap} />
      case 'teams':
        return <TournamentTeamsTab squads={squads} players={players} />
      case 'points':
        return <TournamentPointsTable embedded tournamentId={tournamentId!} matches={matches} inningsMap={inningsMap} />
      case 'stats':
        return <TournamentKeyStats embedded tournamentId={tournamentId!} matches={matches} inningsMap={inningsMap} />
      default:
        return null
    }
  }, [activeTab, tournamentData, matches, squads, players, inningsMap, tournamentId])

  if (loading && !tournamentData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#05060f] pb-24">
        {/* Sticky Top Bar Skeleton */}
        <div className="bg-[#050B18] text-white sticky top-0 z-50 border-b border-white/5 h-14 flex items-center px-5 gap-3">
          <div className="w-8 h-8 rounded-full bg-white/10 animate-pulse" />
          <div className="w-32 h-4 rounded bg-white/10 animate-pulse" />
        </div>

        {/* Hero Skeleton */}
        <div className="bg-[#050B18] text-white p-5 py-10 flex justify-between items-start">
          <div className="space-y-4 flex-1">
            <div className="w-48 h-8 rounded bg-white/10 animate-pulse" />
            <div className="w-32 h-4 rounded bg-white/10 animate-pulse" />
            <div className="w-24 h-6 rounded bg-white/10 animate-pulse" />
          </div>
          <div className="w-20 h-20 rounded-2xl bg-white/10 animate-pulse" />
        </div>

        {/* Content Skeleton */}
        <div className="max-w-4xl mx-auto px-5 py-8 space-y-10">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="w-32 h-4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="w-16 h-4 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-44 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 animate-pulse" />
              <div className="h-44 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!tournamentData) return null

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-[#05060f] pb-24"
    >
      {/* 1. Sticky Top Bar - Clean & Stable */}
      <div
        className={`hide-in-screenshot bg-[#050B18] text-white sticky top-0 z-50 transition-all duration-300 border-b border-white/5 ${scrolled ? 'shadow-2xl' : ''}`}
      >
        <div className="max-w-4xl mx-auto px-5">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => navigate(-1)}
                className="hide-in-screenshot p-1 -ml-1 hover:bg-white/10 rounded-full transition-colors shrink-0"
              >
                <ArrowLeft size={24} />
              </button>
              <h1 className={`text-sm font-bold text-white truncate tracking-tight transition-all duration-300 ${scrolled ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                {tournamentData.name}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {user?.role !== 'admin' && user?.role !== 'super_admin' && (
                <button
                  onClick={handleFollow}
                  className={`hide-in-screenshot flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${isFollowing
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
                    }`}
                >
                  {isFollowing ? <Check size={14} /> : <Bell size={14} className="fill-white" />}
                  <span>{isFollowing ? 'Following' : 'Follow'}</span>
                </button>
              )}

              <button
                className="hide-in-screenshot p-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all text-white/40 cursor-not-allowed"
                disabled
              >
                <Share2 size={16} />
              </button>
            </div>
          </div>

          {/* Tab Navigation - Nested in Sticky Bar for zero-jump effect */}
          <div className="overflow-x-auto no-scrollbar pb-1">
            <div className="flex items-center gap-8 px-2">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'matches', label: 'Matches' },
                { id: 'teams', label: 'Teams' },
                { id: 'points', label: 'Points Table' },
                { id: 'stats', label: 'Stats' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as Tab)}
                  className={`pb-3 text-[13px] font-bold transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTabUnderlineTournament"
                      className="absolute bottom-0 left-0 w-full h-0.5 bg-red-500 rounded-full"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Hero Content - Part of normal scroll flow to prevent layout shifts */}
      <div className="bg-[#050B18] text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="max-w-4xl mx-auto px-5 py-6">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <h1 className="text-2xl font-black text-white tracking-tight leading-tight">
                {tournamentData.name}
              </h1>
              <div className="text-[12px] font-bold text-slate-400 mt-1.5">
                {coerceToDate(tournamentData.startDate)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} to {coerceToDate(tournamentData.endDate)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <button className="flex items-center gap-1 text-blue-500 mt-4 group">
                <span className="text-xs font-bold uppercase tracking-wider">Seasons</span>
                <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <div className="w-24 h-24 bg-white/5 rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center p-2 shadow-2xl backdrop-blur-md shrink-0">
              <img src={tournamentData.logoUrl || '/placeholder-tournament.png'} alt="" className="w-full h-full object-contain" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Content Container - Simplified Rendering */}
      <div className="w-full">
        <div className="max-w-4xl mx-auto px-5 pt-6 min-h-[60vh]">
          {content}
        </div>
      </div>
      {/* ShareModal removed */}
    </div>
  )
}

/**
 * OVERVIEW TAB COMPONENT - Wrapped in memo to prevent re-renders when parent's scroll state changes
 */
const OverviewTab = memo(({ tournament, matches, squads, players, inningsMap, setActiveTab, squadsMap }: { tournament: Tournament, matches: Match[], squads: Squad[], players: Player[], inningsMap: Map<string, any>, setActiveTab: (t: Tab) => void, squadsMap: Record<string, Squad> }) => {

  const featuredMatches = useMemo(() => {
    const statusLower = (m: Match) => String(m.status || '').toLowerCase().trim()

    // 1. Most recent Live/InningsBreak match
    const live = matches.filter(m => {
      const s = statusLower(m)
      return s === 'live' || s === 'inningsbreak' || s === 'innings break'
    }).sort((a, b) => (coerceToDate(b.date)?.getTime() || 0) - (coerceToDate(a.date)?.getTime() || 0))

    // 2. Upcoming matches (not yet live or finished)
    const upcoming = matches.filter(m => {
      const s = statusLower(m)
      const isStatusUpcoming = s === 'upcoming' || s === '' || !m.status
      // Remove strict isDateFuture check to show matches that might be delayed or haven't started yet
      return isStatusUpcoming
    }).sort((a, b) => (coerceToDate(a.date)?.getTime() || 0) - (coerceToDate(b.date)?.getTime() || 0))

    // 3. Most recent Finished match
    const finished = matches.filter(m => {
      const s = statusLower(m)
      return s === 'finished' || s === 'completed'
    }).sort((a, b) => (coerceToDate(b.date)?.getTime() || 0) - (coerceToDate(a.date)?.getTime() || 0))

    const result: Match[] = []
    if (live.length > 0) result.push(live[0])
    if (upcoming.length > 0) result.push(upcoming[0])
    if (finished.length > 0) result.push(finished[0])

    return result
  }, [matches])

  const statsSummary = useMemo(() => {
    let mostRuns = { val: 0, name: '—', team: '', photo: '' }
    let mostWkts = { val: 0, name: '—', team: '', photo: '' }
    let bestFig = { val: '—', name: '—', team: '', photo: '', wkts: 0, runs: 0 }
    let highestScore = { val: 0, name: '—', team: '', photo: '' }
    let mostSixes = { val: 0, name: '—', team: '', photo: '' }

    const batMap = new Map<string, { runs: number, sixes: number, hs: number }>()
    const bowlMap = new Map<string, { wkts: number, bestW: number, bestR: number }>()

    inningsMap.forEach((inn) => {
      [inn.teamA, inn.teamB].filter(Boolean).forEach((i: any) => {
        const bStats = Array.isArray(i.batsmanStats) ? i.batsmanStats : (i.batsmanStats ? Object.values(i.batsmanStats) : []);
        bStats.forEach((b: any) => {
          const pid = String(b.batsmanId || '');
          if (!pid) return;
          const r = Number(b.runs || 0);
          const s = Number(b.sixes || 0);
          const existing = batMap.get(pid) || { runs: 0, sixes: 0, hs: 0 };
          batMap.set(pid, { runs: existing.runs + r, sixes: existing.sixes + s, hs: Math.max(existing.hs, r) });
        });

        const boStats = Array.isArray(i.bowlerStats) ? i.bowlerStats : (i.bowlerStats ? Object.values(i.bowlerStats) : []);
        boStats.forEach((bw: any) => {
          const pid = String(bw.bowlerId || '');
          if (!pid) return;
          const w = Number(bw.wickets || 0);
          const r = Number(bw.runsConceded || 0);
          const existing = bowlMap.get(pid) || { wkts: 0, bestW: 0, bestR: 999 };
          let nw = existing.wkts + w; let nbw = existing.bestW; let nbr = existing.bestR;
          if (w > existing.bestW || (w === existing.bestW && r < existing.bestR)) { nbw = w; nbr = r; }
          bowlMap.set(pid, { wkts: nw, bestW: nbw, bestR: nbr });
        });
      });
    });

    const getP = (id: string) => players.find(p => p.id === id)
    const getT = (pid: string) => squads.find(s => s.id === players.find(p => p.id === pid)?.squadId)?.name || 'Team'

    batMap.forEach((v, k) => {
      if (v.runs > mostRuns.val) { const p = getP(k); mostRuns = { val: v.runs, name: p?.name || 'Player', team: getT(k), photo: p?.photoUrl || '' } }
      if (v.hs > highestScore.val) { const p = getP(k); highestScore = { val: v.hs, name: p?.name || 'Player', team: getT(k), photo: p?.photoUrl || '' } }
      if (v.sixes > mostSixes.val) { const p = getP(k); mostSixes = { val: v.sixes, name: p?.name || 'Player', team: getT(k), photo: p?.photoUrl || '' } }
    })
    bowlMap.forEach((v, k) => {
      if (v.wkts > mostWkts.val) { const p = getP(k); mostWkts = { val: v.wkts, name: p?.name || 'Player', team: getT(k), photo: p?.photoUrl || '' } }
      if (v.bestW > bestFig.wkts || (v.bestW === bestFig.wkts && v.bestR < bestFig.runs)) { const p = getP(k); bestFig = { val: `${v.bestW}-${v.bestR}`, name: p?.name || 'Player', team: getT(k), photo: p?.photoUrl || '', wkts: v.bestW, runs: v.bestR } }
    })
    return { mostRuns, mostWkts, bestFig, highestScore, mostSixes }
  }, [inningsMap, players, squads])

  return (
    <div className="pt-6 space-y-10">

      {/* 2. Featured Matches Section */}
      {featuredMatches.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Featured Matches</h2>
            <button onClick={() => setActiveTab('matches')} className="text-blue-500 text-xs font-bold uppercase tracking-widest">All Matches</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredMatches.map(m => (
              <MatchCard key={m.id} match={m} squadsMap={squadsMap} tournamentName={tournament.name} />
            ))}
          </div>
        </section>
      )}

      {/* 3. Key Stats Section - Redesigned to match high-fidelity cards */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Key Stats</h2>
          <button onClick={() => setActiveTab('stats')} className="text-blue-600 text-xs font-black uppercase tracking-widest hover:opacity-70 transition-opacity">See All</button>
        </div>

        <div className="space-y-4">
          {/* Most Runs - Hero Card */}
          <div className="bg-[#F2F5F7] dark:bg-slate-900/40 rounded-[2rem] p-6 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full" />
                <PlayerAvatar photoUrl={statsSummary.mostRuns.photo} name={statsSummary.mostRuns.name} size="xl" className="border-2 border-white dark:border-slate-800 relative z-10 shadow-md" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Most Runs</span>
                <div className="text-[17px] font-black text-slate-900 dark:text-white italic uppercase tracking-tighter mt-0.5 leading-tight">{statsSummary.mostRuns.name}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{statsSummary.mostRuns.team}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{statsSummary.mostRuns.val}</div>
              <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Runs</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Most Wickets Card */}
            <div className="bg-[#F2F5F7] dark:bg-slate-900/40 rounded-[2.5rem] p-6 flex flex-col gap-6 shadow-sm">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Most Wickets</span>
                <div className="flex items-center gap-3">
                  <PlayerAvatar photoUrl={statsSummary.mostWkts.photo} name={statsSummary.mostWkts.name} size="sm" className="border border-white dark:border-slate-800" />
                  <div className="min-w-0">
                    <div className="text-[9px] text-slate-500 font-bold uppercase truncate">{formatShortTeamName(statsSummary.mostWkts.team)}</div>
                    <div className="text-xs font-black text-slate-900 dark:text-white italic uppercase truncate">{statsSummary.mostWkts.name}</div>
                  </div>
                </div>
              </div>
              <div className="h-px bg-slate-200 dark:bg-white/5" />
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{statsSummary.mostWkts.val}</span>
                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Wickets</span>
              </div>
            </div>

            {/* Best Figures Card */}
            <div className="bg-[#F2F5F7] dark:bg-slate-900/40 rounded-[2.5rem] p-6 flex flex-col gap-6 shadow-sm">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Best Figures</span>
                <div className="flex items-center gap-3">
                  <PlayerAvatar photoUrl={statsSummary.bestFig.photo} name={statsSummary.bestFig.name} size="sm" className="border border-white dark:border-slate-800" />
                  <div className="min-w-0">
                    <div className="text-[9px] text-slate-500 font-bold uppercase truncate">{formatShortTeamName(statsSummary.bestFig.team)}</div>
                    <div className="text-xs font-black text-slate-900 dark:text-white italic uppercase truncate">{statsSummary.bestFig.name}</div>
                  </div>
                </div>
              </div>
              <div className="h-px bg-slate-200 dark:bg-white/5" />
              <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{statsSummary.bestFig.val}</div>
            </div>
          </div>

          {/* Highest Score - Pink Card */}
          <div className="bg-[#FFEFEF] dark:bg-rose-950/20 rounded-[2rem] p-6 flex items-center justify-between border border-rose-100/50 dark:border-rose-500/10 shadow-sm">
            <div>
              <span className="text-[10px] font-black text-rose-400 dark:text-rose-500 uppercase tracking-widest">Highest Score</span>
              <div className="flex items-baseline gap-2 mt-1">
                <div className="text-[17px] font-black text-slate-900 dark:text-white italic uppercase tracking-tighter">{statsSummary.highestScore.name}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">({formatShortTeamName(statsSummary.highestScore.team)})</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{statsSummary.highestScore.val}</div>
              <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Runs</div>
            </div>
          </div>

          {/* Most Sixes - Light Card */}
          <div className="bg-[#F2F5F7] dark:bg-slate-900/40 rounded-[2rem] p-6 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Most Sixes</span>
              <div className="flex items-baseline gap-2 mt-1">
                <div className="text-[17px] font-black text-slate-900 dark:text-white italic uppercase tracking-tighter">{statsSummary.mostSixes.name}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">({formatShortTeamName(statsSummary.mostSixes.team)})</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">{statsSummary.mostSixes.val}</div>
              <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-1">Sixes</div>
            </div>
          </div>
        </div>
      </section>


      {/* 5. Points Table Preview */}
      <section>
        <TournamentPointsTable embedded tournamentId={tournament.id} matches={matches} inningsMap={inningsMap} />
      </section>

      {/* 5.5 Playoff Bracket Preview (Added here to Overview) */}
      {tournament && (tournament as any).config?.knockout?.custom?.matches?.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5 px-2">
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Playoff Bracket</h2>
          </div>
          <div className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-2 overflow-hidden shadow-sm">
            <PlayoffBracket
              tournament={tournament}
              squads={squads}
              matches={matches}
            />
          </div>
        </section>
      )}

      {/* 6. Team Squads - Now below Points Table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Team Squads</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-5 px-5">
          {squads.map(s => (
            <Link key={s.id} to={`/squads/${s.id}`} className={`min-w-[130px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[2rem] p-5 flex flex-col items-center gap-4 shadow-sm group ${s.logoUrl ? 'hover:scale-[1.02]' : ''} transition-transform`}>
              <div className={`w-20 h-20 rounded-full border border-slate-100 overflow-hidden flex items-center justify-center shadow-inner relative transition-transform ${s.logoUrl ? 'group-hover:scale-105' : ''}`}>
                {s.logoUrl ? (
                  <img src={s.logoUrl} alt={s.name} className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-3xl font-black uppercase">
                    {s.name.charAt(0)}
                  </div>
                )}
              </div>
              <span className={`text-[12px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight text-center truncate w-full ${s.logoUrl ? 'group-hover:text-blue-500' : ''} transition-colors`}>{(s as any).shortName || s.name}</span>
            </Link>
          ))}
          {squads.length === 0 && (
            <div className="text-center py-4 text-slate-400 text-[10px] font-black uppercase tracking-widest w-full">No squads available</div>
          )}
        </div>
      </section>

      {/* 6. Series Info - Using REAL data from tournament object */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Series Info</h2>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-2 shadow-sm">
          <div className="divide-y divide-slate-50 dark:divide-white/5">
            <InfoRow label="Series" value={tournament.name} />
            <InfoRow label="Host" value={tournament.host || "N/A"} />
            <InfoRow label="Duration" value={`${coerceToDate(tournament.startDate)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Dhaka' })} - ${coerceToDate(tournament.endDate)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Dhaka' })}`} />
            <InfoRow label="Format" value={tournament.format || (tournament.totalMatches ? `${tournament.totalMatches} Matches` : "N/A")} />
            <InfoRow label="Broadcaster" value={tournament.broadcaster || "N/A"} />
          </div>
        </div>
      </section>

      {/* 7. More Seasons */}
      <section className="pb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">More Seasons</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {['2024', '2022', '2021'].map(year => (
            <button key={year} className="h-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[2rem] flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs tracking-tight shadow-sm hover:bg-blue-50/50 transition-colors">
              {tournament.name.replace(/\d+/g, '').trim()} {year}
            </button>
          ))}
          <button className="h-16 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[2.5rem] flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs tracking-tight shadow-sm hover:bg-blue-50/50 transition-colors">
            More Seasons {'>'}
          </button>
        </div>
      </section>
    </div>
  )
})

function InfoRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex items-center justify-between px-6 py-5">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      <span className="text-[11px] font-black text-slate-800 dark:text-white text-right max-w-[200px]">{value}</span>
    </div>
  )
}


function TournamentMatchesTab({ matches, squadsMap }: { matches: Match[]; squadsMap: Record<string, Squad> }) {
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all')
  const filtered = useMemo(() => {
    let f = matches
    if (filter === 'live') f = matches.filter(m => {
      const s = String(m.status || '').toLowerCase()
      return s === 'live' || s === 'inningsbreak' || s === 'innings break'
    })
    else if (filter === 'upcoming') f = matches.filter(m => {
      const s = String(m.status || '').toLowerCase()
      return s === 'upcoming' || s === '' || !m.status
    })
    else if (filter === 'finished') f = matches.filter(m => m.status?.toLowerCase() === 'finished' || m.status?.toLowerCase() === 'completed')
    return f.sort((a, b) => (coerceToDate(b.date)?.getTime() || 0) - (coerceToDate(a.date)?.getTime() || 0))
  }, [matches, filter])

  return (
    <div className="space-y-5 pb-10 pt-6">
      <div className="flex gap-2 pb-2 overflow-x-auto no-scrollbar">
        {(['all', 'live', 'upcoming', 'finished'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-900 text-slate-500 border border-slate-100 dark:border-white/5'}`}>{f}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(m => <MatchCard key={m.id} match={m} squadsMap={squadsMap} />)}
        {filtered.length === 0 && <div className="text-center py-20 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">No matches found</div>}
      </div>
    </div>
  )
}

function TournamentTeamsTab({ squads, players }: { squads: Squad[]; players: Player[] }) {
  return (
    <div className="space-y-4 pb-10 pt-6">
      {squads.map(s => (
        <Link key={s.id} to={`/squads/${s.id}`} className="flex items-center gap-5 bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm group">
          <div className="w-14 h-14 rounded-2xl border border-slate-100 shrink-0 shadow-sm flex items-center justify-center overflow-hidden relative">
            {s.logoUrl ? (
              <img src={s.logoUrl} alt={s.name} className="w-full h-full object-contain p-1 group-hover:scale-110 transition-transform" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xl font-black uppercase">
                {s.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="font-black text-slate-900 dark:text-white uppercase tracking-tight group-hover:text-blue-500 transition-colors">{s.name}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{players.filter(p => p.squadId === s.id).length} Players Registered</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 transition-all">
            <ChevronRight size={20} />
          </div>
        </Link>
      ))}
    </div>
  )
}
