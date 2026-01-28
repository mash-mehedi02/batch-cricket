/**
 * Player Profile Page
 * Screenshot-based design with dark green header, tabs, recent form, career stats
 */

import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { Player } from '@/types'
import PlayerProfileSkeleton from '@/components/skeletons/PlayerProfileSkeleton'
import PlayerAvatar from '@/components/common/PlayerAvatar'
import cricketBatIcon from '@/assets/cricket-bat.png'
import cricketBallIcon from '@/assets/cricket-ball.png'



// Helper to format role names consistently
function formatRole(player: any): string {
  const role = player.role || 'Player'
  if (role === 'batsman') return 'RHB Batter'
  if (role === 'bowler') return player.bowlingStyle?.toLowerCase().includes('spin') ? 'Spinner' : 'Pacer'
  if (role === 'all-rounder') return 'All Rounder'
  if (role === 'wicket-keeper') return 'WK Batter'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

// Helper to format opponent name
function formatOpponentName(rawName: string): string {
  if (!rawName || rawName === 'Opponent' || rawName === 'Unknown') return 'OPP'

  const parts = rawName.split('-')
  const teamPart = parts[0].trim()
  const suffix = parts.length > 1 ? ` - ${parts.slice(1).join('-').trim()}` : ''

  // Clean up common prefixes/suffixes
  const cleanName = teamPart.replace(/(Academy|Cricket Club|School|High School|XI)/gi, '').trim() || teamPart

  const words = cleanName.split(/\s+/)
  let shortName = ''

  if (words.length === 1) {
    shortName = words[0].substring(0, 3).toUpperCase()
  } else {
    shortName = words.slice(0, 3).map(w => w[0]).join('').toUpperCase()
  }

  return `${shortName}${suffix}`
}

export default function PlayerProfile() {
  const { playerId } = useParams<{ playerId: string }>()
  const [player, setPlayer] = useState<Player | null>(null)
  const [squadName, setSquadName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [viewMode, setViewMode] = useState<'batting' | 'bowling'>('batting')

  // Real-time states
  const [allMatches, setAllMatches] = useState<any[]>([])
  const [dbStats, setDbStats] = useState<any[]>([])
  const [liveData, setLiveData] = useState<Record<string, any>>({})

  // 1. Listen to the Player document in real-time
  useEffect(() => {
    if (!playerId) return
    const docRef = doc(db, 'players', playerId)
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const playerData = { id: docSnap.id, ...docSnap.data() } as Player
        setPlayer(playerData)
        if (playerData.squadId) {
          squadService.getById(playerData.squadId).then(s => s && setSquadName(s.name))
        }
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [playerId])

  // 2. Listen to ALL matches (to handle deletions instantly)
  useEffect(() => {
    const q = collection(db, 'matches')
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setAllMatches(matches)
    })
    return () => unsubscribe()
  }, [])

  // 3. Listen to playerMatchStats for this player
  useEffect(() => {
    if (!playerId) return
    const q = query(collection(db, 'playerMatchStats'), where('playerId', '==', playerId))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stats = snapshot.docs.map(doc => doc.data())
      setDbStats(stats)
    })
    return () => unsubscribe()
  }, [playerId])

  // 4. Managed Innings Listeners for Participating Matches
  useEffect(() => {
    if (!playerId || allMatches.length === 0) return

    const participatingMatches = allMatches.filter(m => {
      const inXI = (m.teamAPlayingXI || []).includes(playerId) || (m.teamBPlayingXI || []).includes(playerId)
      return inXI
    })

    const unsubscribes: (() => void)[] = []

    participatingMatches.forEach(m => {
      // Team A
      unsubscribes.push(onSnapshot(doc(db, 'matches', m.id, 'innings', 'teamA'), (ds) => {
        if (ds.exists()) setLiveData(prev => ({ ...prev, [`${m.id}_teamA`]: ds.data() }))
      }))
      // Team B
      unsubscribes.push(onSnapshot(doc(db, 'matches', m.id, 'innings', 'teamB'), (ds) => {
        if (ds.exists()) setLiveData(prev => ({ ...prev, [`${m.id}_teamB`]: ds.data() }))
      }))
    })

    return () => unsubscribes.forEach(unsub => unsub())
  }, [playerId, allMatches])

  // 5. CALCULATE EVERYTHING REACTIVELY
  const { mergedMatches, careerStats } = useMemo(() => {
    if (!player) return { mergedMatches: [], careerStats: null }

    const validMatchMap = new Map(allMatches.map(m => [m.id, m]))
    // Process Live Data for this player
    const processedLiveEntries: any[] = []
    allMatches.forEach(m => {
      // Rule 1: Match must have started (at least one innings doc must exist or match marked as live)
      const status = m.status?.toLowerCase()
      const hasStarted = status === 'live' || status === 'completed' || status === 'finished' || status === 'innings break' || m.ballsBowled > 0 || m.overs > 0
      if (!hasStarted) return

      const xiA: string[] = m.teamAPlayingXI || []
      const xiB: string[] = m.teamBPlayingXI || []
      const inA = xiA.includes(playerId || '')
      const inB = xiB.includes(playerId || '')
      if (!inA && !inB) return

      const mySide = inA ? 'teamA' : 'teamB'
      const oppSide = inA ? 'teamB' : 'teamA'
      const myInnings = liveData[`${m.id}_${mySide}`]
      const oppInnings = liveData[`${m.id}_${oppSide}`]

      const batsStat = myInnings?.batsmanStats?.find((b: any) => b.batsmanId === playerId)
      const isOut = (myInnings?.fallOfWickets || []).some((f: any) => f.batsmanId === playerId)
      const bowlStat = oppInnings?.bowlerStats?.find((bw: any) => bw.bowlerId === playerId)

      const opponentName = inA ? (m.teamBName || m.teamB || 'Opponent') : (m.teamAName || m.teamA || 'Opponent')

      const b = Number(batsStat?.balls || 0)
      const bb = Number(bowlStat?.ballsBowled || 0)

      const entry = {
        matchId: m.id,
        opponentName,
        date: m.date || new Date().toISOString(),
        result: m.result || (m.status?.toLowerCase() === 'live' ? 'Live' : ''),
        isLive: m.status?.toLowerCase() === 'live',
        runs: Number(batsStat?.runs || 0),
        balls: b,
        fours: Number(batsStat?.fours || 0),
        sixes: Number(batsStat?.sixes || 0),
        notOut: Boolean(batsStat) && !isOut,
        out: isOut,
        wickets: Number(bowlStat?.wickets || 0),
        runsConceded: Number(bowlStat?.runsConceded || 0),
        ballsBowled: bb,
        oversBowled: bowlStat?.overs || (bb / 6),
        // Strict Participation Rules (Only counts as innings if they actually did something)
        batted: b > 0 || isOut,
        bowled: bb > 0 || (bowlStat?.overs && Number(bowlStat.overs) > 0),
        inPlayingXI: true // Rule: they are in Playing XI and match started
      }
      processedLiveEntries.push(entry)
    })

    // Filter DB stats for only existing matches (handle deletions)
    const validDbStatsFiltered = dbStats.filter(s => validMatchMap.has(s.matchId))

    // To prevent double counting and ensure matches count even if no stats documented yet in playerMatchStats
    // We combine them but use matchId as unique key
    const uniqueMatchStats = new Map<string, any>()

    // 1. Add DB stats first
    validDbStatsFiltered.forEach(s => {
      uniqueMatchStats.set(s.matchId, { ...s, inPlayingXI: true })
    })

    // 2. Add/Override with Live stats
    processedLiveEntries.forEach(l => {
      uniqueMatchStats.set(l.matchId, l)
    })

    const finalCombinedList = Array.from(uniqueMatchStats.values())

    // Recalculate Career Totals
    let batt = { innings: 0, runs: 0, balls: 0, outs: 0, fours: 0, sixes: 0, highest: 0, isHighestNotOut: false, fifties: 0, hundreds: 0, ducks: 0 }
    let bowl = { innings: 0, balls: 0, runs: 0, wickets: 0, bestW: 0, bestR: 0, threeW: 0, fiveW: 0, maidens: 0 }

    finalCombinedList.forEach(s => {
      const r = Number(s.runs || 0)
      const b = Number(s.balls || 0)
      const isActuallyOut = s.out === true
      const isActuallyNotOut = !isActuallyOut && (s.notOut === true || b > 0)

      // Batting Innings Rule: Only if faced ball or dismissed
      if (b > 0 || isActuallyOut) {
        batt.innings++
        batt.runs += r
        batt.balls += b
        batt.fours += Number(s.fours || 0)
        batt.sixes += Number(s.sixes || 0)
        if (isActuallyOut) batt.outs++

        if (r > batt.highest) {
          batt.highest = r
          batt.isHighestNotOut = isActuallyNotOut
        } else if (r === batt.highest && isActuallyNotOut) {
          batt.isHighestNotOut = true
        }

        if (r >= 100) batt.hundreds++
        else if (r >= 50) batt.fifties++

        if (r === 0 && isActuallyOut) batt.ducks++
      }

      // Bowling Innings Rule: Only if bowled a ball
      const bb = Number(s.ballsBowled || (Number(s.oversBowled || 0) * 6) || 0)
      if (bb > 0) {
        bowl.innings++
        bowl.balls += bb
        const rc = Number(s.runsConceded || 0)
        const wkts = Number(s.wickets || 0)
        bowl.runs += rc
        bowl.wickets += wkts

        // Best Bowling Figures
        if (wkts > bowl.bestW) {
          bowl.bestW = wkts
          bowl.bestR = rc
        } else if (wkts === bowl.bestW) {
          if (bowl.bestW > 0 && rc < bowl.bestR) {
            bowl.bestR = rc
          } else if (bowl.bestW === 0) {
            // If still 0 wickets, just track the one with least runs
            if (bowl.bestR === 0 || rc < bowl.bestR) bowl.bestR = rc
          }
        }

        if (wkts >= 5) bowl.fiveW++
        else if (wkts >= 3) bowl.threeW++

        // Maidens logic: if overs recorded and runs conceded is 0 for that over (simplified)
        // In full engine, we'd check over-by-over, but here we can check s.maidens if provided by backend
        bowl.maidens += Number(s.maidens || (wkts > 0 && rc === 0 ? 1 : 0))
      }
    })

    const bowlBest = bowl.bestW > 0 || bowl.bestR > 0 ? `${bowl.bestW}-${bowl.bestR}` : '0-0'

    const career = {
      matches: finalCombinedList.length,
      batting: {
        ...batt,
        average: batt.outs > 0 ? batt.runs / batt.outs : (batt.runs > 0 ? batt.runs : 0),
        strikeRate: batt.balls > 0 ? (batt.runs / batt.balls) * 100 : 0,
        highestScore: batt.highest,
        isHighestNotOut: batt.isHighestNotOut
      },
      bowling: {
        ...bowl,
        overs: bowl.balls / 6,
        economy: bowl.balls > 0 ? (bowl.runs / (bowl.balls / 6)) : 0,
        average: bowl.wickets > 0 ? bowl.runs / bowl.wickets : 0,
        best: bowlBest,
        wickets: bowl.wickets,
        runsConceded: bowl.runs
      }
    }

    // Prepare match list for display
    const mergedForDisplay = finalCombinedList.map(s => {
      const m = validMatchMap.get(s.matchId)
      return {
        ...s,
        opponentName: s.opponentName || (m ? (m.teamAId === player.squadId ? m.teamBName : m.teamAName) : 'Opponent'),
        date: s.date || m?.date,
        result: s.result || m?.result || '',
      }
    }).sort((a, b) => {
      if (a.isLive && !b.isLive) return -1
      if (!a.isLive && b.isLive) return 1
      const da = a.date ? new Date(a.date).getTime() : 0
      const db = b.date ? new Date(b.date).getTime() : 0
      return db - da
    })

    return { mergedMatches: mergedForDisplay, careerStats: career }
  }, [player, allMatches, dbStats, liveData, playerId])

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

  const age = player.dateOfBirth
    ? Math.floor((new Date().getTime() - new Date(player.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'matches', label: 'Matches' },
    { id: 'player-info', label: 'Player Info' },
  ]

  // Filter matches based on viewMode - only show if they actually participated (min 1 ball)
  const filteredMatches = mergedMatches
    .filter((m: any) => {
      if (viewMode === 'batting') {
        const b = Number(m.balls || 0)
        return b > 0 || m.out
      }
      if (viewMode === 'bowling') {
        const bb = Number(m.ballsBowled || (Number(m.oversBowled || 0) * 6) || 0)
        return bb > 0
      }
      return true
    })

  // Get recent matches for form display
  const recentForm = filteredMatches
    .slice(0, 10) // Show up to 10 last matches
    .map((match: any) => {
      return {
        runs: Number(match.runs || 0),
        balls: Number(match.balls || 0),
        isNotOut: match.notOut === true || (match.out === false && Number(match.balls || 0) > 0),
        wickets: Number(match.wickets || 0),
        runsConceded: Number(match.runsConceded || 0),
        opponent: match.opponentName || 'Opponent',
        matchId: match.matchId,
      }
    })

  // Prioritize calculated stats derived from history & live data
  const matchesCount = Number(careerStats?.matches || 0)
  const battingStats = careerStats?.batting
  const bowlingStats = careerStats?.bowling

  // Batting Stats
  const battingInnings = Number(battingStats?.innings || 0)
  const runs = Number(battingStats?.runs || 0)
  const averageValue = Number(battingStats?.average || 0)
  const average = averageValue > 0 ? averageValue.toFixed(1) : (runs > 0 ? runs : '-')
  const strikeRate = Number(battingStats?.strikeRate || 0).toFixed(1)
  const highestScoreRaw = battingStats?.highestScore
  const isHighestNotOut = battingStats?.isHighestNotOut

  const highestScore = highestScoreRaw !== undefined ? (
    <span className="relative">
      {highestScoreRaw}
      {isHighestNotOut && <span className="absolute -top-1 -right-2 text-[10px] text-slate-900 font-bold">*</span>}
    </span>
  ) : '-'

  const hundreds = Number(battingStats?.hundreds || 0)
  const fifties = Number(battingStats?.fifties || 0)
  const fours = Number(battingStats?.fours || 0)
  const sixes = Number(battingStats?.sixes || 0)

  // Bowling Stats
  const bowlingInnings = Number(bowlingStats?.innings || 0)
  const wickets = Number(bowlingStats?.wickets || 0)
  const economy = Number(bowlingStats?.economy || 0).toFixed(1)
  const bowlingAverage = wickets > 0 ? Number(bowlingStats?.average || 0).toFixed(1) : '-'
  const bowlingBest = bowlingStats?.best || '0-0'
  const threeW = Number(bowlingStats?.threeW || 0)
  const fiveW = Number(bowlingStats?.fiveW || 0)
  const maidens = Number(bowlingStats?.maidens || 0)
  const ducks = Number(battingStats?.ducks || 0)

  // Internal component for career grid cells
  const StatCell = ({ label, value, highlight, labelSmall }: { label: string, value: any, highlight?: boolean, labelSmall?: boolean }) => (
    <div className="flex flex-col items-center justify-center py-7 px-1 text-center">
      <div className={`text-2xl font-bold mb-1 ${highlight ? 'text-sky-600' : 'text-slate-800'}`}>
        {value}
      </div>
      <div className={`${labelSmall ? 'text-[11px]' : 'text-[13px]'} font-bold text-slate-500 uppercase tracking-tight`}>
        {label}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white relative pb-24">
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
            {recentForm.length > 0 && (
              <div className="animate-in slide-in-from-bottom-4 duration-700 mb-8">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    Recent Form <span className="text-slate-400 font-bold text-sm ml-1">(Last 10)</span>
                  </h3>
                  <button onClick={() => setActiveTab('matches')} className="text-blue-600 text-sm font-bold hover:underline">
                    See More
                  </button>
                </div>
                <div className="flex flex-nowrap overflow-x-auto gap-3 pb-2 scrollbar-none">
                  {recentForm.map((form, idx) => (
                    <Link
                      key={idx}
                      to={`/match/${form.matchId}`}
                      className="group flex flex-col justify-center items-center p-4 bg-white rounded-2xl shrink-0 min-w-[125px] h-[105px] text-center shadow-sm border border-slate-100 transition-all hover:shadow-md hover:border-blue-200"
                    >
                      <div className="flex items-baseline justify-center gap-1.5 mb-2">
                        {viewMode === 'batting' ? (
                          <>
                            <span className="text-slate-800 text-2xl font-bold relative leading-none">
                              {form.runs}
                              {form.isNotOut && (
                                <span className="absolute -top-1 -right-3 text-[14px] font-bold text-slate-900">
                                  *
                                </span>
                              )}
                            </span>
                            <span className="text-[12px] font-bold text-slate-600 leading-none">({form.balls})</span>
                          </>
                        ) : (
                          <>
                            <span className="text-slate-800 text-2xl font-bold leading-none">
                              {form.wickets}
                            </span>
                            <span className="text-slate-400 text-lg font-bold leading-none mx-0.5">-</span>
                            <span className="text-slate-800 text-xl font-bold leading-none">
                              {form.runsConceded}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="text-slate-600 text-[11px] font-bold uppercase tracking-tight truncate w-full px-1">
                        {formatOpponentName(form.opponent)}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Career Title */}
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="capitalize">{viewMode} Career</span>
                <img src={viewMode === 'batting' ? cricketBatIcon : cricketBallIcon} className="w-5 h-5 object-contain" alt="" />
              </h3>
            </div>

            {/* Premium Career Grid Design */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden mb-8">
              {viewMode === 'batting' ? (
                <div className="divide-y divide-slate-200">
                  {/* Row 1 */}
                  <div className="grid grid-cols-4 divide-x divide-slate-200">
                    <StatCell label="Matches" value={matchesCount} />
                    <StatCell label="Innings" value={battingInnings} />
                    <StatCell label="Runs" value={runs} />
                    <StatCell label="Highest Score" value={highestScore} highlight labelSmall />
                  </div>
                  {/* Row 2 */}
                  <div className="grid grid-cols-4 divide-x divide-slate-200">
                    <StatCell label="100s" value={hundreds} />
                    <StatCell label="50s" value={fifties} />
                    <StatCell label="SR" value={strikeRate} />
                    <StatCell label="Avg" value={average} />
                  </div>
                  {/* Row 3 */}
                  <div className="grid grid-cols-4 divide-x divide-slate-200">
                    <StatCell label="Fours" value={fours} />
                    <StatCell label="Sixes" value={sixes} />
                    <StatCell label="Duck Out" value={ducks} />
                    <StatCell label="Rank" value="#--" />
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {/* Row 1 */}
                  <div className="grid grid-cols-4 divide-x divide-slate-200">
                    <StatCell label="Matches" value={matchesCount} />
                    <StatCell label="Innings" value={bowlingInnings} />
                    <StatCell label="Wickets" value={wickets} />
                    <StatCell label="Best" value={bowlingBest} />
                  </div>
                  {/* Row 2 */}
                  <div className="grid grid-cols-4 divide-x divide-slate-200">
                    <StatCell label="Econ" value={economy} />
                    <StatCell label="3 Wkt" value={threeW} />
                    <StatCell label="5 Wkt" value={fiveW} />
                    <StatCell label="Avg" value={bowlingAverage} />
                  </div>
                  {/* Row 3 */}
                  <div className="grid grid-cols-4 divide-x divide-slate-200">
                    <StatCell label="SR" value={bowlingAverage !== '-' ? (Number(bowlingInnings * 6) / (wickets || 1)).toFixed(1) : '-'} />
                    <StatCell label="Maiden" value={maidens > 0 ? maidens : '--'} />
                    <StatCell label="Rank" value="#--" />
                    <StatCell label="" value="" />
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
                  const isNotOut = match.notOut === true || (match.out === false && Number(match.balls || 0) > 0)

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
                                    <span className="text-slate-900 font-extrabold relative">
                                      {match.runs ?? match.batting?.runs ?? 0}
                                      {isNotOut && <span className="absolute -top-1 -right-2 text-[10px] text-emerald-600">*</span>}
                                    </span>
                                    <span className="ml-2 text-xs opacity-60 font-medium">({match.balls ?? match.batting?.balls ?? 0} balls)</span>
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
            ? 'bg-emerald-600 shadow-lg shadow-emerald-900/40 transform scale-110'
            : 'hover:bg-white/5 opacity-50'
            }`}
          title="Batting Stats"
        >
          <img src={cricketBatIcon} alt="Batting" className="w-7 h-7 object-contain" />
        </button>
        <button
          onClick={() => setViewMode('bowling')}
          className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all duration-300 ${viewMode === 'bowling'
            ? 'bg-emerald-600 shadow-lg shadow-emerald-900/40 transform scale-110'
            : 'hover:bg-white/5 opacity-50'
            }`}
          title="Bowling Stats"
        >
          <img src={cricketBallIcon} alt="Bowling" className="w-7 h-7 object-contain" />
        </button>
      </div>
    </div>
  )
}
