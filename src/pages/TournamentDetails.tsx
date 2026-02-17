/**
 * Tournament Details Page - Redesigned for a premium, high-fidelity experience
 * Matching the requested "All Series" overview with Key Stats, Bracket, Points Table, etc.
 * Ads and Videos removed as requested.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import type { Match, Tournament, Squad, Player, InningsStats } from '@/types'
import { coerceToDate } from '@/utils/date.ts'
import { getMatchResultString } from '@/utils/matchWinner'
import TournamentPointsTable from '@/pages/TournamentPointsTable'
import TournamentKeyStats from '@/pages/TournamentKeyStats'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import { ArrowLeft, Bell, ChevronDown, Share2, ChevronRight, ChevronRight as ChevronRightIcon } from 'lucide-react'
import PlayoffBracket from '@/components/tournament/PlayoffBracket'

type Tab = 'overview' | 'matches' | 'teams' | 'points' | 'stats' | 'bracket'

export default function TournamentDetails() {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get('tab')?.toLowerCase()
    if (tab === 'matches' || tab === 'teams' || tab === 'points' || tab === 'stats' || tab === 'bracket') return tab as Tab
    return 'overview'
  })

  const [tournamentData, setTournamentData] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [inningsMap, setInningsMap] = useState<Map<string, { teamA: InningsStats | null; teamB: InningsStats | null }>>(new Map())
  const [loading, setLoading] = useState(true)

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
        return s === 'live' || s === 'finished' || s === 'completed'
      })

      if (relevantMatches.length > 0) {
        const entries = await Promise.all(
          relevantMatches.map(async (m) => {
            const [a, b] = await Promise.all([
              matchService.getInnings(m.id, 'teamA').catch(() => null),
              matchService.getInnings(m.id, 'teamB').catch(() => null),
            ])
            return [m.id, { teamA: a, teamB: b }] as const
          })
        )
        const im = new Map<string, { teamA: InningsStats | null; teamB: InningsStats | null }>()
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

  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      const isScrolled = window.scrollY > 40
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(isScrolled)
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
          />
        )
      case 'matches':
        return <TournamentMatchesTab matches={matches} squads={squads} inningsMap={inningsMap} />
      case 'teams':
        return <TournamentTeamsTab squads={squads} players={players} />
      case 'points':
        return <TournamentPointsTable embedded tournamentId={tournamentId!} matches={matches} inningsMap={inningsMap} />
      case 'stats':
        return <TournamentKeyStats embedded tournamentId={tournamentId!} matches={matches} inningsMap={inningsMap} />
      case 'bracket':
        return <PlayoffBracket tournament={tournamentData} squads={squads} matches={matches} />
      default:
        return null
    }
  }, [activeTab, tournamentData, matches, squads, players, inningsMap, tournamentId])

  if (loading && !tournamentData) {
    return (
      <div className="min-h-screen bg-[#050B18] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!tournamentData) return null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#05060f] pb-24">
      {/* 1. Dark Hero Header - Sticky & Optimized */}
      <div
        className={`bg-[#050B18] text-white pt-[calc(var(--status-bar-height)+8px)] relative overflow-hidden sticky top-0 z-50 transition-shadow duration-300 border-b border-white/5 ${scrolled ? 'shadow-2xl' : ''}`}
        style={{ willChange: 'transform' }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full -mr-20 -mt-20 pointer-events-none" />

        <div className="max-w-4xl mx-auto px-5 relative z-10">
          {/* Top Row: Back + Compact Name + Actions */}
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button onClick={() => navigate('/tournaments')} className="p-1 -ml-1 hover:bg-white/10 rounded-full transition-colors shrink-0">
                <ArrowLeft size={24} />
              </button>

              <h1 className={`text-sm font-bold text-white truncate tracking-tight transition-all duration-300 transform ${scrolled ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                {tournamentData.name}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all shadow-sm">
                <Bell size={14} className="fill-white" />
                <span className="hidden xs:inline">Following</span>
                <ChevronDown size={12} />
              </button>
              <button className="p-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all shadow-sm">
                <Share2 size={16} />
              </button>
            </div>
          </div>

          {/* Hero Content - Collapses with GPU optimized transforms */}
          <div className={`transition-all duration-500 transform origin-top ${scrolled ? 'h-0 opacity-0 pointer-events-none scale-y-95 -translate-y-4' : 'h-auto py-4 opacity-100 scale-y-100 translate-y-0'}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <h1 className="text-xl font-bold text-white tracking-tight leading-tight">
                  {tournamentData.name}
                </h1>
                <div className="text-[11px] font-bold text-slate-400 mt-1">
                  {coerceToDate(tournamentData.startDate)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} to {coerceToDate(tournamentData.endDate)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
                <button className="flex items-center gap-1 text-blue-500 mt-3 group">
                  <span className="text-xs font-bold">Seasons</span>
                  <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              <div className="w-24 h-24 bg-white/5 rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center p-2 shadow-2xl backdrop-blur-md shrink-0">
                <img src={tournamentData.logoUrl || '/placeholder-tournament.png'} alt="" className="w-full h-full object-contain" />
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-4xl mx-auto px-5 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'matches', label: 'Matches' },
              { id: 'teams', label: 'Teams' },
              { id: 'points', label: 'Points Table' },
              { id: 'stats', label: 'Stats' },
              ...(tournamentData.config?.knockout?.custom?.matches?.length > 0 ? [{ id: 'bracket', label: 'Playoffs' }] : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`pb-3 text-[13px] font-bold transition-all relative whitespace-nowrap ${activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
              >
                {tab.label}
                {activeTab === tab.id && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-500 rounded-full" />}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-4xl mx-auto px-5">
        {content}
      </div>
    </div>
  )
}

/**
 * OVERVIEW TAB COMPONENT
 */
function OverviewTab({ tournament, matches, squads, players, inningsMap, setActiveTab }: { tournament: Tournament, matches: Match[], squads: Squad[], players: Player[], inningsMap: Map<string, any>, setActiveTab: (t: Tab) => void }) {

  const featuredMatches = useMemo(() => {
    return [...matches].sort((a, b) => {
      const getScore = (m: Match) => {
        const s = String(m.status || '').toLowerCase()
        if (s === 'live') return 3
        if (s === 'upcoming') return 2
        return 1
      }
      return getScore(b) - getScore(a)
    }).slice(0, 3)
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
          <div className="space-y-4">
            {featuredMatches.map(m => (
              <FeaturedMatchCard key={m.id} match={m} squads={squads} innings={inningsMap.get(m.id)} />
            ))}
          </div>
        </section>
      )}

      {/* 3. Key Stats Section */}
      <section className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Key Stats</h2>
          <button onClick={() => setActiveTab('stats')} className="text-blue-500 text-xs font-bold uppercase tracking-widest">See All</button>
        </div>

        <div className="space-y-4">
          <Link to="/tournaments" onClick={(e) => { e.preventDefault(); setActiveTab('stats'); }} className="flex items-center justify-between group transition-all">
            <div className="flex items-center gap-4">
              <PlayerAvatar photoUrl={statsSummary.mostRuns.photo} name={statsSummary.mostRuns.name} size="lg" className="border-2 border-slate-50 shadow-sm" />
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Most Runs</span>
                <div className="text-sm font-bold text-slate-900 dark:text-white leading-tight group-hover:text-blue-500">{statsSummary.mostRuns.name}</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase">{statsSummary.mostRuns.team}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{statsSummary.mostRuns.val}</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase">runs</div>
            </div>
          </Link>

          <div className="h-px bg-slate-100 dark:bg-white/5 mx-2" />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Most Wickets</span>
              <div className="flex items-center gap-2">
                <PlayerAvatar photoUrl={statsSummary.mostWkts.photo} name={statsSummary.mostWkts.name} size="sm" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-800 dark:text-white truncate">{statsSummary.mostWkts.name}</div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase truncate">{statsSummary.mostWkts.team.substring(0, 3)}</div>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{statsSummary.mostWkts.val}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase">wickets</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Best Figures</span>
              <div className="flex items-center gap-2">
                <PlayerAvatar photoUrl={statsSummary.bestFig.photo} name={statsSummary.bestFig.name} size="sm" />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-800 dark:text-white truncate">{statsSummary.bestFig.name}</div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase truncate">{statsSummary.bestFig.team.substring(0, 3)}</div>
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{statsSummary.bestFig.val}</div>
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-white/5 mx-2" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Highest Score</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-white">{statsSummary.highestScore.name}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">({statsSummary.highestScore.team.substring(0, 3)})</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{statsSummary.highestScore.val}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase">runs</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Most Sixes</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-white">{statsSummary.mostSixes.name}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">({statsSummary.mostSixes.team.substring(0, 3)})</span>
                </div>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white">{statsSummary.mostSixes.val}</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase">sixes</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* 5. Points Table Preview */}
      <section>
        <TournamentPointsTable embedded tournamentId={tournament.id} matches={matches} inningsMap={inningsMap} />
      </section>

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
            <InfoRow label="Duration" value={`${coerceToDate(tournament.startDate)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${coerceToDate(tournament.endDate)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`} />
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
}

function FeaturedMatchCard({ match, squads, innings }: { match: Match; squads: Squad[]; innings?: { teamA: InningsStats | null; teamB: InningsStats | null } }) {
  const status = String(match.status || '').toLowerCase()
  const isFin = status === 'finished' || status === 'completed'
  const isLive = status === 'live'

  const squadA = squads.find(s => s.id === match.teamAId)
  const squadB = squads.find(s => s.id === match.teamBId)

  const resultStr = isFin ? getMatchResultString(match.teamAName || 'Team A', match.teamBName || 'Team B', innings?.teamA || null, innings?.teamB || null, match) : ''

  return (
    <Link to={`/match/${match.id}`} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[2.5rem] p-6 shadow-sm hover:shadow-md transition-all block">
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 w-1/3">
          <div className="w-10 h-10 rounded-full border border-slate-100 overflow-hidden flex items-center justify-center shadow-sm shrink-0 relative">
            {squadA?.logoUrl ? (
              <img src={squadA.logoUrl} alt="" className="w-full h-full object-contain p-1" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[14px] font-black uppercase">
                {match.teamAName?.charAt(0) || 'A'}
              </div>
            )}
          </div>
          <span className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-tighter truncate">{(squadA as any)?.shortName || match.teamAName?.substring(0, 3)}</span>
        </div>

        <div className="flex-1 text-center">
          {isLive ? (
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-red-600 uppercase tracking-widest animate-pulse">Innings Break</span>
            </div>
          ) : isFin ? (
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-bold text-slate-800 dark:text-white uppercase leading-tight">{match.winnerId === match.teamAId ? (squadA as any)?.shortName : (squadB as any)?.shortName} Won</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">by {resultStr.split('by')[1]?.trim() || '24 runs'}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{match.time || '11:30 AM'}</span>
              <span className="text-[11px] font-black text-slate-800 dark:text-white uppercase mt-0.5">Tomorrow</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 w-1/3 justify-end">
          <span className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-tighter text-right truncate">{(squadB as any)?.shortName || match.teamBName?.substring(0, 3)}</span>
          <div className="w-10 h-10 rounded-full border border-slate-100 overflow-hidden flex items-center justify-center shadow-sm shrink-0 relative">
            {squadB?.logoUrl ? (
              <img src={squadB.logoUrl} alt="" className="w-full h-full object-contain p-1" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-500 to-pink-600 text-white text-[14px] font-black uppercase">
                {match.teamBName?.charAt(0) || 'B'}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function InfoRow({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex items-center justify-between px-6 py-5">
      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      <span className="text-[11px] font-black text-slate-800 dark:text-white text-right max-w-[200px]">{value}</span>
    </div>
  )
}


function CompactMatchCard({ match, squads, innings }: { match: Match; squads: Squad[]; innings?: { teamA: InningsStats | null; teamB: InningsStats | null } }) {
  const status = String(match.status || '').toLowerCase()
  const isFin = status === 'finished' || status === 'completed'

  const squadA = squads.find(s => s.id === match.teamAId)
  const squadB = squads.find(s => s.id === match.teamBId)

  const resultStr = isFin ? getMatchResultString(match.teamAName || 'Team A', match.teamBName || 'Team B', innings?.teamA || null, innings?.teamB || null, match) : ''

  return (
    <Link to={`/match/${match.id}`} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-[120px]">
          <div className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative">
            {squadA?.logoUrl ? (
              <img src={squadA.logoUrl} alt="" className="w-full h-full object-contain p-1" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[14px] font-black uppercase">
                {match.teamAName?.charAt(0) || 'A'}
              </div>
            )}
          </div>
          <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tighter">{(squadA as any)?.shortName || match.teamAName?.substring(0, 3)}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          {isFin ? (
            <span className="text-[10px] font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight">{resultStr}</span>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{match.time || 'TBD'}</span>
              <span className="text-[11px] font-black text-slate-800 dark:text-white uppercase mt-0.5">{coerceToDate(match.date)?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 w-[120px] justify-end">
          <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tighter text-right">{(squadB as any)?.shortName || match.teamBName?.substring(0, 3)}</span>
          <div className="w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative">
            {squadB?.logoUrl ? (
              <img src={squadB.logoUrl} alt="" className="w-full h-full object-contain p-1" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-rose-500 to-pink-600 text-white text-[14px] font-black uppercase">
                {match.teamBName?.charAt(0) || 'B'}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}

function TournamentMatchesTab({ matches, squads, inningsMap }: { matches: Match[]; squads: Squad[]; inningsMap: Map<string, any> }) {
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all')
  const filtered = useMemo(() => {
    let f = matches
    if (filter === 'live') f = matches.filter(m => m.status?.toLowerCase() === 'live')
    else if (filter === 'upcoming') f = matches.filter(m => (m.status?.toLowerCase() === 'upcoming' || !m.status) && coerceToDate(m.date)?.getTime()! > Date.now())
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
      <div className="grid gap-4">
        {filtered.map(m => <CompactMatchCard key={m.id} match={m} squads={squads} innings={inningsMap.get(m.id)} />)}
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
