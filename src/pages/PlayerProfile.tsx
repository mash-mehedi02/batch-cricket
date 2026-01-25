/**
 * Player Profile Page
 * Screenshot-based design with dark green header, tabs, recent form, career stats
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { matchService } from '@/services/firestore/matches'
import { Player } from '@/types'
import PlayerProfileSkeleton from '@/components/skeletons/PlayerProfileSkeleton'
import { playerMatchStatsService } from '@/services/firestore/playerMatchStats'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import cricketBatIcon from '@/assets/cricket-bat.png'


// Helper to format role names consistently
function formatRole(player: any): string {
  const role = player.role || 'Player'
  if (role === 'batsman') return 'RHB Batter'
  if (role === 'bowler') return player.bowlingStyle?.toLowerCase().includes('spin') ? 'Spinner' : 'Pacer'
  if (role === 'all-rounder') return 'All Rounder'
  if (role === 'wicket-keeper') return 'WK Batter'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export default function PlayerProfile() {
  const { playerId } = useParams<{ playerId: string }>()
  const [player, setPlayer] = useState<Player | null>(null)
  const [squadName, setSquadName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [liveEntries, setLiveEntries] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'batting' | 'bowling'>('batting')

  useEffect(() => {
    if (!playerId) return

    const loadPlayerData = async () => {
      try {
        const playerData = await playerService.getById(playerId)
        if (playerData) {
          setPlayer(playerData)

          // Load squad name
          if (playerData.squadId) {
            try {
              const squad = await squadService.getById(playerData.squadId)
              if (squad) setSquadName(squad.name)
            } catch (err) { }
          }

          const cs = (playerData as any).careerStats
          const pm = Array.isArray(playerData.pastMatches) ? playerData.pastMatches : []
          const hasPm = pm.length > 0
          const needsSync = !cs || (Number(cs.matches || 0) === 0 && hasPm)

          if (needsSync && hasPm) {
            try {
              console.log('[PlayerProfile] Syncing historical matches to career collection...')
              await playerMatchStatsService.migrateFromPastMatches(playerId, pm)
              const refreshed = await playerService.getById(playerId)
              if (refreshed) setPlayer(refreshed)
            } catch (e) {
              console.warn('[PlayerProfile] Migration failed:', e)
            }
          } else if (!cs) {
            try {
              await playerMatchStatsService.aggregateCareerStats(playerId)
              const refreshed = await playerService.getById(playerId)
              if (refreshed) setPlayer(refreshed)
            } catch (e) {
              console.warn('[PlayerProfile] aggregateCareerStats fallback failed:', e)
            }
          }
        }
      } catch (error) {
        console.error('Error loading player:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPlayerData()
  }, [playerId])

  // Include live matches in career stats (counts as match if in Playing XI)
  useEffect(() => {
    const loadLiveEntries = async () => {
      try {
        if (!playerId) return
        const liveMatches = await matchService.getLiveMatches()
        const entries: any[] = []
        for (const m of liveMatches) {
          const xiA: string[] = (m as any).teamAPlayingXI || []
          const xiB: string[] = (m as any).teamBPlayingXI || []
          const inA = xiA.includes(playerId)
          const inB = xiB.includes(playerId)
          if (!inA && !inB) continue

          const opponentName = inA ? ((m as any).teamBName || (m as any).teamB || 'Opponent') : ((m as any).teamAName || (m as any).teamA || 'Opponent')
          const opponentId = inA ? ((m as any).teamBId || (m as any).teamBSquadId || '') : ((m as any).teamAId || (m as any).teamASquadId || '')
          const [innA, innB] = await Promise.all([
            matchService.getInnings(m.id, 'teamA').catch(() => null),
            matchService.getInnings(m.id, 'teamB').catch(() => null),
          ])

          const batsmanFrom = (side: 'teamA' | 'teamB') => (side === 'teamA' ? innA : innB)
          const bowlerFrom = (side: 'teamA' | 'teamB') => (side === 'teamA' ? innB : innA)
          const mySide: 'teamA' | 'teamB' = inA ? 'teamA' : 'teamB'
          const bInnings = batsmanFrom(mySide)
          const bowlInnings = bowlerFrom(mySide)

          const batsStat = bInnings?.batsmanStats?.find((b: any) => b.batsmanId === playerId)
          const fowHit = (bInnings?.fallOfWickets || []).some((f: any) => (f.batsmanId === playerId))
          const batted = Boolean(batsStat || fowHit)
          const balls = Number(batsStat?.balls || 0)
          const runs = Number(batsStat?.runs || 0)
          const notOut = Boolean(batsStat?.notOut) && !fowHit

          const bowlStat = bowlInnings?.bowlerStats?.find((bw: any) => bw.bowlerId === playerId)
          const bowled = Boolean(bowlStat)
          const ballsBowled = Number(bowlStat?.ballsBowled || 0)
          const wickets = Number(bowlStat?.wickets || 0)
          const runsConceded = Number(bowlStat?.runsConceded || 0)

          entries.push({
            matchId: m.id,
            opponentName,
            opponentSquadId: opponentId,
            date: (m as any).date || new Date().toISOString(),
            result: 'Live',
            played: true,
            isLive: true,
            batted,
            bowled,
            // Batting
            runs,
            balls,
            fours: Number(batsStat?.fours || 0),
            sixes: Number(batsStat?.sixes || 0),
            notOut,
            dismissal: batsStat?.dismissal || null,
            batting: {
              runs,
              balls,
              fours: Number(batsStat?.fours || 0),
              sixes: Number(batsStat?.sixes || 0),
              strikeRate: balls > 0 ? (runs / balls) * 100 : 0,
              notOut,
              dismissal: batsStat?.dismissal || null,
            },
            // Bowling
            wickets,
            ballsBowled,
            runsConceded,
            overs: ballsBowled > 0 ? `${Math.floor(ballsBowled / 6)}.${ballsBowled % 6}` : undefined,
            bowling: bowled ? {
              wickets,
              ballsBowled,
              runsConceded,
              overs: ballsBowled > 0 ? `${Math.floor(ballsBowled / 6)}.${ballsBowled % 6}` : undefined,
            } : undefined,
          })
        }
        setLiveEntries(entries)
      } catch { }
    }
    loadLiveEntries()
  }, [playerId])

  if (loading) {
    return <PlayerProfileSkeleton />
  }

  if (!player) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Player not found</p>
          <Link
            to="/players"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Back to Players
          </Link>
        </div>
      </div>
    )
  }

  // Calculate age from date of birth
  const age = player.dateOfBirth
    ? Math.floor((new Date().getTime() - new Date(player.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'matches', label: 'Matches' },
    { id: 'player-info', label: 'Player Info' },
  ]

  // Merge legacy pastMatches array and new collection entries uniquely
  const allMatchesMap = new Map<string, any>()

    // 1. Load legacy matches from player doc
    ; (player?.pastMatches || []).forEach((m: any) => {
      const mid = m.matchId || m.id
      if (mid) allMatchesMap.set(String(mid), m)
    })

  // 2. Override/Supplement with collection data (primary source of truth)
  liveEntries.forEach((m: any) => {
    const mid = m.matchId || m.id
    if (mid) {
      const existing = allMatchesMap.get(String(mid))
      allMatchesMap.set(String(mid), {
        ...existing,
        ...m,
        // Keep descriptive fields from legacy if missing in collection doc
        opponent: m.opponentName || m.opponent || existing?.opponentName || existing?.opponent || 'Opponent',
        matchId: mid
      })
    }
  })

  const pastMatches = Array.from(allMatchesMap.values())
    .sort((a, b) => (b.date || 0) < (a.date || 0) ? -1 : 1)

  const career = (player as any)?.careerStats || {}
  const batting = career.batting || {}
  const bowling = career.bowling || {}

  // Filter matches based on viewMode
  const filteredMatches = pastMatches
    .filter((m: any) => {
      const mid = m.matchId || m.id
      if (!mid) return false
      if (viewMode === 'batting') return m.runs !== undefined || m.batting?.runs !== undefined || m.batted
      if (viewMode === 'bowling') return m.wickets !== undefined || m.bowling?.wickets !== undefined || m.bowled || m.oversBowled > 0
      return true
    })

  // Get recent matches for form display
  const recentForm = filteredMatches
    .slice(0, 10) // Show up to 10 last matches
    .map((match: any) => {
      const runs = match.runs ?? match.batting?.runs ?? 0
      const balls = match.balls ?? match.batting?.balls ?? 0
      const isNotOut = match.notOut ?? match.batting?.notOut ?? false
      const matchId = match.matchId || match.id

      const wickets = match.wickets ?? match.bowling?.wickets ?? 0
      const runsConceded = match.runsConceded ?? match.bowling?.runsConceded ?? 0

      return {
        runs: typeof runs === 'number' ? runs : (Number(runs) || 0),
        balls: typeof balls === 'number' ? balls : (Number(balls) || 0),
        isNotOut,
        wickets,
        runsConceded,
        opponent: match.opponentName || match.opponent || 'Opponent',
        matchId: matchId,
      }
    })

  // Prioritize calculated stats derived from history & live data
  const matches = Number(career.matches || 0)
  const runs = Number(batting.runs || 0)
  const average = Number(batting.average || 0) > 0 ? Number(batting.average).toFixed(2) : runs ? (Number(runs / (Number(batting.innings || 0) - Number(batting.notOut || 0))).toFixed(2)) : '-'
  const strikeRate = Number(batting.strikeRate || 0) > 0 ? Number(batting.strikeRate).toFixed(2) : '0.00'
  const highestScore = (batting as any).highestScore !== undefined ? (batting as any).highestScore : '-'
  const hundreds = Number((batting as any).hundreds || 0)
  const fifties = Number((batting as any).fifties || 0)
  const fours = Number(batting.fours || 0)
  const sixes = Number(batting.sixes || 0)
  const wickets = Number(bowling.wickets || 0)
  const runsConceded = Number(bowling.runsConceded || 0)
  const economy = Number(bowling.economy || 0) > 0 ? Number(bowling.economy).toFixed(2) : '0.00'
  const bowlingAverage = wickets > 0 ? (runsConceded / wickets).toFixed(2) : '0.00'

  return (
    <div className="min-h-screen bg-slate-50 relative pb-24">
      {/* Premium Dark Header */}
      <div className="bg-slate-950 text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 relative z-10 animate-in fade-in duration-700">
          <div className="flex flex-row items-center gap-4 md:gap-8">
            <div className="relative group shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-full blur opacity-40 group-hover:opacity-60 transition duration-1000 group-hover:duration-200"></div>
              <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-52 md:h-52 rounded-full bg-slate-900 flex items-center justify-center overflow-hidden border-2 md:border-4 border-slate-950 relative z-10 shadow-[0_0_25px_rgba(16,185,129,0.25)] md:shadow-[0_0_50px_rgba(16,185,129,0.3)] group-hover:shadow-[0_0_70px_rgba(16,185,129,0.5)] transition-all duration-700">
                <PlayerAvatar
                  photoUrl={player.photoUrl || (player as any).photo}
                  name={player.name}
                  size="xl"
                  className="w-full h-full border-none shadow-none bg-transparent"
                />
              </div>
              {/* Outer Pulse */}
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-20 pointer-events-none"></div>
            </div>

            <div className="flex-1 text-left min-w-0">
              <div className="inline-flex items-center gap-1.5 md:gap-2 px-2.5 py-0.5 md:px-3 md:py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] md:text-xs font-bold uppercase tracking-wider mb-2 md:mb-4">
                <span className="w-1 md:w-1.5 h-1 md:h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="truncate">Primary: {formatRole(player)}</span>
              </div>
              <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white tracking-tighter mb-2 md:mb-4 leading-none truncate">
                {player.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 md:gap-6 text-slate-400 font-medium">
                {player.batch && (
                  <span className="flex items-center gap-1.5 md:gap-2.5 bg-white/5 px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border border-white/5 animate-in slide-in-from-left-4 duration-500 delay-100">
                    <span className="text-emerald-500 text-xs md:text-base">📚</span>
                    <span className="text-[10px] md:text-sm whitespace-nowrap">Batch {player.batch}</span>
                  </span>
                )}
                {squadName && (
                  <span className="flex items-center gap-1.5 md:gap-2.5 bg-white/5 px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border border-white/5 animate-in slide-in-from-left-4 duration-500 delay-200">
                    <span className="text-emerald-500 text-xs md:text-base">👥</span>
                    <span className="text-[10px] md:text-sm whitespace-nowrap">{squadName}</span>
                  </span>
                )}
                {age && (
                  <span className="flex items-center gap-1.5 md:gap-2.5 bg-white/5 px-2.5 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl border border-white/5 animate-in slide-in-from-left-4 duration-500 delay-300">
                    <span className="text-emerald-500 text-xs md:text-base">🎂</span>
                    <span className="text-[10px] md:text-sm whitespace-nowrap">{age} Yrs</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Refined Tabs */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-5 text-sm font-bold relative transition-all ${activeTab === tab.id
                  ? 'text-emerald-600'
                  : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 w-full h-1 bg-emerald-600 rounded-t-full shadow-[0_-2px_8px_rgba(16,185,129,0.3)]"></span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Recent Form Cards - MOVED TO TOP */}
            {recentForm.length > 0 && (
              <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 p-6 md:p-8 border border-slate-200 animate-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center justify-between mb-6 md:mb-8">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-sm">🔥</span>
                    Recent Performance
                  </h3>
                  {pastMatches.length > 5 && (
                    <button onClick={() => setActiveTab('matches')} className="text-emerald-600 text-[10px] md:text-xs font-black uppercase tracking-widest hover:underline">
                      View All History →
                    </button>
                  )}
                </div>
                <div className="flex flex-nowrap overflow-x-auto gap-3 md:gap-4 pb-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                  {recentForm.map((form, idx) => (
                    <Link
                      key={idx}
                      to={`/match/${form.matchId}`}
                      className={`group p-4 md:p-5 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-emerald-500 hover:shadow-lg transition-all animate-in slide-in-from-bottom-4 duration-500 shrink-0 w-[140px] md:w-[160px]`}
                      style={{ transitionDelay: `${idx * 100}ms` }}
                    >
                      <div className="text-xl md:text-2xl font-black text-slate-900 mb-0.5 group-hover:text-emerald-600">
                        {viewMode === 'batting' ? (
                          <>
                            {form.runs}{form.isNotOut ? '*' : ''}
                            <span className="text-[10px] md:text-xs text-slate-400 font-bold ml-1.5 opacity-60 group-hover:opacity-100">({form.balls})</span>
                          </>
                        ) : (
                          <>
                            {form.wickets}/{form.runsConceded}
                            <span className="text-[10px] md:text-xs text-slate-400 font-bold ml-1.5 opacity-60 group-hover:opacity-100">{form.matchId.toString().startsWith('live') ? '' : ''}</span>
                          </>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2 md:mb-3">
                        {viewMode === 'batting' ? 'Runs (Balls)' : 'Wkts/Runs'}
                      </div>
                      <div className="text-[10px] md:text-xs text-slate-600 font-bold truncate">vs {form.opponent}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Career Summary Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-hidden">
              {(viewMode === 'batting' ? [
                { label: 'Matches', value: matches, icon: '🏟️', delay: 'delay-0' },
                { label: 'Total Runs', value: runs, icon: '🏏', delay: 'delay-100' },
                { label: 'Average', value: average, icon: '📈', delay: 'delay-200' },
                { label: 'Strike Rate', value: strikeRate, icon: '⚡', delay: 'delay-300' },
              ] : [
                { label: 'Matches', value: matches, icon: '🏟️', delay: 'delay-0' },
                { label: 'Wickets', value: wickets, icon: '⚽', highlight: true, delay: 'delay-100' },
                { label: 'Economy', value: economy, icon: '📉', delay: 'delay-200' },
                { label: 'Average', value: bowlingAverage, icon: '📊', delay: 'delay-300' },
              ]).map((item, i) => (
                <div key={i} className={`bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group animate-in zoom-in-95 duration-500 ${item.delay}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">{item.icon}</span>
                    <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{item.label}</div>
                  </div>
                  <div className={`text-2xl md:text-3xl font-black ${item.highlight ? 'text-emerald-600' : 'text-slate-900'}`}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* Career Stats Detail */}
            <div className="grid grid-cols-1 gap-8">
              {/* Batting Analytics */}
              {viewMode === 'batting' && (
                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 p-8 border border-slate-200 relative overflow-hidden group animate-in fade-in duration-700">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full pointer-events-none opacity-40 group-hover:scale-150 transition-transform duration-700"></div>
                  <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-sm">🏏</span>
                    Batting Analytics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { label: 'Runs', value: runs },
                      { label: 'H. Score', value: highestScore },
                      { label: 'Avg', value: average },
                      { label: 'S. Rate', value: strikeRate },
                      { label: '50s', value: fifties },
                      { label: '100s', value: hundreds },
                    ].map((s, i) => (
                      <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{s.label}</div>
                        <div className="text-xl font-black text-slate-900">{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                      <div>
                        <div className="text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-1">Fours</div>
                        <div className="text-2xl font-black text-emerald-700">{fours}</div>
                      </div>
                      <span className="text-xl">💥</span>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                      <div>
                        <div className="text-emerald-600 text-[10px] font-black uppercase tracking-widest mb-1">Sixes</div>
                        <div className="text-2xl font-black text-emerald-700">{sixes}</div>
                      </div>
                      <span className="text-xl">🚀</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bowling Analytics */}
              {viewMode === 'bowling' && (
                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 p-8 border border-slate-200 relative overflow-hidden group animate-in fade-in duration-700">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full pointer-events-none opacity-40 group-hover:scale-150 transition-transform duration-700"></div>
                  <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-sm">⚽</span>
                    Bowling Analytics
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                    {[
                      { label: 'Wickets', value: wickets, highlight: true },
                      { label: 'Economy', value: economy },
                      { label: 'Average', value: bowlingAverage },
                      { label: 'Runs Conc.', value: runsConceded },
                    ].map((s, i) => (
                      <div key={i} className={`p-4 rounded-2xl border ${s.highlight ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                        <div className={`${s.highlight ? 'text-blue-600' : 'text-slate-400'} text-[10px] font-black uppercase tracking-widest mb-1`}>{s.label}</div>
                        <div className={`text-xl font-black ${s.highlight ? 'text-blue-700' : 'text-slate-900'}`}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'matches' && (
          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 p-8 border border-slate-200">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-sm">📅</span>
                Performance History
              </h3>
            </div>

            {filteredMatches.length === 0 ? (
              <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="text-4xl mb-4">📭</div>
                <div className="text-slate-500 font-bold uppercase tracking-widest text-xs">No match history found</div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMatches.slice().map((match: any, idx: number) => {
                  const matchId = match.matchId || match.id
                  if (!matchId) return null
                  const isNotOut = match.notOut ?? match.batting?.notOut ?? false

                  return (
                    <Link
                      key={idx}
                      to={`/match/${matchId}`}
                      className="group block p-6 bg-white border border-slate-100 rounded-2xl hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/10 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl group-hover:bg-emerald-500 group-hover:text-white transition-all transform group-hover:rotate-6">🏟️</div>
                          <div>
                            <div className="font-black text-slate-900 text-lg group-hover:text-emerald-600 transition-colors">
                              vs {match.opponentName || match.opponent || 'Opponent'}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                                {viewMode === 'batting' ? 'Batting' : 'Bowling'}
                              </span>
                              <div className="text-sm text-slate-500 font-bold">
                                {viewMode === 'batting' ? (
                                  <>
                                    <span className="text-slate-900 font-black">{match.runs ?? match.batting?.runs ?? 0}{isNotOut ? '*' : ''}</span>
                                    <span className="ml-1 opacity-60">({match.balls ?? match.batting?.balls ?? 0} balls)</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="text-slate-900 font-black">{match.bowlingWickets ?? match.bowling?.wickets ?? 0}/{match.bowlingRuns ?? match.bowling?.runsConceded ?? 0}</span>
                                    <span className="ml-1 opacity-60">({match.overs ?? match.bowling?.overs ?? '0.0'} ov)</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-4 border-t sm:border-0 pt-4 sm:pt-0 border-slate-50">
                          <div className="text-sm font-black whitespace-nowrap">
                            {match.result === 'Won' || match.result === 'won' ? <span className="text-emerald-500 bg-emerald-50 px-3 py-1 rounded-lg">🏆 WIN</span> : ''}
                            {match.result === 'Lost' || match.result === 'lost' ? <span className="text-rose-500 bg-rose-50 px-3 py-1 rounded-lg">❌ LOSS</span> : ''}
                            {match.result === 'Tied' || match.result === 'tie' ? <span className="text-amber-500 bg-amber-50 px-3 py-1 rounded-lg">🤝 TIE</span> : ''}
                          </div>
                          <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest group-hover:text-emerald-500 transition-colors">View Scorecard →</div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'player-info' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 p-8 border border-slate-200">
              <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-sm">📋</span>
                Bio Data
              </h3>
              <div className="space-y-6">
                {[
                  { label: 'Date of Birth', value: player.dateOfBirth ? new Date(player.dateOfBirth).toLocaleDateString(undefined, { dateStyle: 'long' }) : 'N/A' },
                  { label: 'Batting Style', value: player.battingStyle || 'N/A' },
                  { label: 'Bowling Style', value: player.bowlingStyle || 'N/A' },
                  { label: 'Primary Role', value: player.role ? (player.role.charAt(0).toUpperCase() + player.role.slice(1)) : 'Player' },
                ].map((info, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">{info.label}</span>
                    <span className="text-lg font-bold text-slate-900">{info.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 p-8 border border-slate-200 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center text-4xl mb-6">🎓</div>
              <h4 className="text-2xl font-black text-slate-900 mb-2">Academic Info</h4>
              <p className="text-slate-500 font-medium mb-6 px-10">Currently playing for {squadName || 'N/A'} - Batch {player.batch || 'N/A'}</p>
              <div className="w-full h-px bg-slate-100 mb-6"></div>
              <div className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">Verified Academic Player</div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Toggle FAB (CREX Style) - HORIZONTAL BOTTOM RIGHT */}
      <div className="fixed bottom-6 right-6 z-[100] bg-slate-900/90 backdrop-blur-xl rounded-2xl p-1 shadow-2xl border border-white/10 flex flex-row items-center gap-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <button
          onClick={() => setViewMode('batting')}
          className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${viewMode === 'batting'
            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          title="Batting Stats"
        >
          <img src={cricketBatIcon} alt="Batting" className={`w-7 h-7 object-contain transition-all ${viewMode === 'batting' ? 'brightness-0 invert' : 'opacity-60'}`} />
        </button>
        <button
          onClick={() => setViewMode('bowling')}
          className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${viewMode === 'bowling'
            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          title="Bowling Stats"
        >
          <span className="text-xl text-center">⚽</span>
        </button>
      </div>
    </div>
  )
}
