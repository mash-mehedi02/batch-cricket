/**
 * Live Match Page
 * Screenshot-based design with tabs, dark blue header, tables
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { Match, InningsStats, Ball } from '@/types'
import { useAuthStore } from '@/store/authStore'
import HeroScoreboard from '@/components/match/HeroScoreboard'
import MatchTabs from '@/components/match/MatchTabs'
import BattingTable from '@/components/match/BattingTable'
import BowlingTableLive from '@/components/match/BowlingTableLive'
import WinProbability from '@/components/match/WinProbability'
import OverStrip from '@/components/match/OverStrip'
import MatchLiveSkeleton from '@/components/skeletons/MatchLiveSkeleton'
import { subscribeToCommentary, type CommentaryEntry } from '@/services/commentary/commentaryService'
import CrexLiveSection from '@/components/live/CrexLiveSection'
import { useNavigate } from 'react-router-dom'
// Import all match page components to render inline
import MatchScorecard from '@/pages/MatchScorecard'
import MatchPlayingXI from '@/pages/MatchPlayingXI'
import MatchGraphs from '@/pages/MatchGraphs'
import MatchInfo from '@/pages/MatchInfo'
import MatchSummary from '@/components/match/MatchSummary'
import { coerceToDate, formatDateLabelTZ, formatTimeHMTo12h, formatTimeLabelBD } from '@/utils/date'

export default function MatchLive() {
  const { matchId } = useParams<{ matchId: string }>()
  const { user } = useAuthStore()
  const [match, setMatch] = useState<Match | null>(null)
  const [currentInnings, setCurrentInnings] = useState<InningsStats | null>(null)
  const [teamAInnings, setTeamAInnings] = useState<InningsStats | null>(null)
  const [teamBInnings, setTeamBInnings] = useState<InningsStats | null>(null)
  const [balls, setBalls] = useState<Ball[]>([])
  const [playersMap, setPlayersMap] = useState<Map<string, any>>(new Map())
  const [squadsById, setSquadsById] = useState<Map<string, any>>(new Map())
  const [relatedMatches, setRelatedMatches] = useState<Match[]>([])
  const [relatedInningsMap, setRelatedInningsMap] = useState<Map<string, { teamA: any | null; teamB: any | null }>>(new Map())
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [commentary, setCommentary] = useState<CommentaryEntry[]>([])
  const [activeCommentaryFilter, setActiveCommentaryFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('summary') // Upcoming should land on Summary by default
  const didInitTab = useRef(false)
  const [now, setNow] = useState<Date>(() => new Date())
  const [centerEventText, setCenterEventText] = useState<string>('Over')
  const [centerEventAnim, setCenterEventAnim] = useState(false)

  // Load match and subscribe
  useEffect(() => {
    if (!matchId) return

    matchService.getById(matchId).then((matchData) => {
      if (matchData) {
        setMatch(matchData)
        setLoading(false)
      } else {
        setLoading(false)
      }
    }).catch((error) => {
      console.error('Error loading match:', error)
      setLoading(false)
    })

    const unsubscribeMatch = matchService.subscribeToMatch(matchId, (matchData) => {
      if (matchData) {
        setMatch(matchData)
        setLoading(false)
      }
    })

    return () => unsubscribeMatch()
  }, [matchId])

  // Subscribe to both innings + Initial load
  useEffect(() => {
    if (!matchId) return

    // Initial load for team A
    matchService.getInnings(matchId, 'teamA').then((innings) => {
      if (innings) setTeamAInnings(innings)
    }).catch((err) => {
      console.error('Error initial loading team A innings:', err)
    })

    // Initial load for team B
    matchService.getInnings(matchId, 'teamB').then((innings) => {
      if (innings) setTeamBInnings(innings)
    }).catch((err) => {
      console.error('Error initial loading team B innings:', err)
    })

    // Subscribe to real-time updates
    const unsubA = matchService.subscribeToInnings(matchId, 'teamA', (innings) => {
      if (innings) setTeamAInnings(innings)
    })

    const unsubB = matchService.subscribeToInnings(matchId, 'teamB', (innings) => {
      if (innings) setTeamBInnings(innings)
    })

    return () => {
      unsubA()
      unsubB()
    }
  }, [matchId])

  // Set current innings based on match status
  useEffect(() => {
    if (!match) return
    const currentBatting = match.currentBatting || 'teamA'
    setCurrentInnings(currentBatting === 'teamA' ? teamAInnings : teamBInnings)
  }, [match, teamAInnings, teamBInnings])

  // Load balls for commentary
  useEffect(() => {
    if (!match || !matchId) return
    const inningId = match.currentBatting || 'teamA'

    matchService.getBalls(matchId, inningId).then(setBalls).catch(console.error)

    // Subscribe to balls - reload when innings change
    const interval = setInterval(() => {
      matchService.getBalls(matchId, inningId).then(setBalls).catch(console.error)
    }, 2000) // Refresh every 2 seconds for live updates

    return () => clearInterval(interval)
  }, [match, matchId])

  // Load players from squads (more efficient than loading all players)
  useEffect(() => {
    const loadPlayers = async () => {
      if (!match) return

      try {
        const resolveSquadId = async (candidate?: string, nameFallback?: string): Promise<string | null> => {
          if (candidate) {
            try {
              const s = await squadService.getById(candidate)
              if (s?.id) return s.id
            } catch {
              // ignore
            }
          }
          const name = nameFallback || candidate
          if (name) {
            const list = await squadService.getByName(name)
            if (list?.[0]?.id) return list[0].id
          }
          return null
        }

        const teamAName = (match as any).teamAName || match.teamA || ''
        const teamBName = (match as any).teamBName || match.teamB || ''
        const squadAId = await resolveSquadId((match as any).teamASquadId || (match as any).teamAId || match.teamA, teamAName)
        const squadBId = await resolveSquadId((match as any).teamBSquadId || (match as any).teamBId || match.teamB, teamBName)

        // Realtime squads cache (for squad rename reflection)
        const unsubSquads = squadService.subscribeAll((list) => {
          const sm = new Map<string, any>()
            ; (list as any[]).forEach((s) => s?.id && sm.set(s.id, s))
          setSquadsById(sm)
        })

        // Realtime players for both squads (so player rename reflects instantly)
        let latestA: any[] = []
        let latestB: any[] = []
        const rebuild = () => {
          const map = new Map<string, any>()
            ; (latestA as any[]).forEach((p: any) => p?.id && map.set(p.id, p))
            ; (latestB as any[]).forEach((p: any) => p?.id && map.set(p.id, p))
          setPlayersMap(map)
        }

        const unsubA = squadAId
          ? playerService.subscribeBySquad(squadAId, (list) => { latestA = list as any[]; rebuild() })
          : () => { }
        const unsubB = squadBId
          ? playerService.subscribeBySquad(squadBId, (list) => { latestB = list as any[]; rebuild() })
          : () => { }

        return () => {
          unsubA()
          unsubB()
          unsubSquads()
        }
      } catch (error) {
        console.error('Error loading players:', error)
        return
      }
    }
    let cleanup: undefined | (() => void)
    loadPlayers().then((c: any) => { cleanup = typeof c === 'function' ? c : undefined }).catch(() => { })
    return () => cleanup?.()
  }, [match])

  // Prepare data for components
  const striker = useMemo(() => {
    const strikerId =
      (currentInnings as any)?.currentStrikerId ||
      (match as any)?.currentStrikerId ||
      ''
    if (!strikerId) return null

    const batsman = currentInnings?.batsmanStats?.find((b) => b.batsmanId === strikerId)
    const player = playersMap.get(strikerId)

    return {
      id: strikerId,
      name: batsman?.batsmanName || player?.name || 'Batter',
      photo: player?.photoUrl || null,
      runs: batsman?.runs || 0,
      balls: batsman?.balls || 0,
      fours: batsman?.fours || 0,
      sixes: batsman?.sixes || 0,
      strikeRate: batsman?.strikeRate || (batsman?.balls ? (batsman.runs / batsman.balls) * 100 : 0) || 0,
    }
  }, [currentInnings, match, playersMap])

  const nonStriker = useMemo(() => {
    const nonStrikerId =
      (currentInnings as any)?.nonStrikerId ||
      (match as any)?.currentNonStrikerId ||
      (match as any)?.nonStrikerId ||
      ''
    if (!nonStrikerId) return null

    const batsman = currentInnings?.batsmanStats?.find((b) => b.batsmanId === nonStrikerId)
    const player = playersMap.get(nonStrikerId)

    return {
      id: nonStrikerId,
      name: batsman?.batsmanName || player?.name || 'Batter',
      photo: player?.photoUrl || null,
      runs: batsman?.runs || 0,
      balls: batsman?.balls || 0,
      fours: batsman?.fours || 0,
      sixes: batsman?.sixes || 0,
      strikeRate: batsman?.strikeRate || (batsman?.balls ? (batsman.runs / batsman.balls) * 100 : 0) || 0,
    }
  }, [currentInnings, match, playersMap])

  const bowler = useMemo(() => {
    if (!currentInnings || !currentInnings.bowlerStats) return null
    const bowlerStats = currentInnings.bowlerStats.find(b => b.bowlerId === currentInnings.currentBowlerId)
    if (!bowlerStats) return null
    const ballsBowled = Number((bowlerStats as any).ballsBowled || (bowlerStats as any).balls || 0)
    const overs = `${Math.floor(ballsBowled / 6)}.${ballsBowled % 6}`
    return {
      name: bowlerStats.bowlerName,
      photo: playersMap.get(bowlerStats.bowlerId)?.photoUrl || null,
      wickets: bowlerStats.wickets || 0,
      runsConceded: bowlerStats.runsConceded || 0,
      ballsBowled,
      overs,
      economy: bowlerStats.economy || 0,
    }
  }, [currentInnings, playersMap])

  // Match context for AI
  const matchContext = useMemo(() => {
    if (!currentInnings || !match) return null
    return {
      currentScore: currentInnings.totalRuns,
      wickets: currentInnings.totalWickets,
      oversBowled: parseFloat(currentInnings.overs || '0'),
      oversLimit: match.oversLimit || 20,
      requiredRuns: currentInnings.target ? currentInnings.target - currentInnings.totalRuns : undefined,
      oversRemaining: match.oversLimit ? match.oversLimit - parseFloat(currentInnings.overs || '0') : undefined,
    }
  }, [currentInnings, match])

  // Ball events for commentary
  const ballEvents = useMemo(() => {
    return balls.map((ball, idx) => ({
      // Support multiple schemas (legacy/current)
      strikerId: (ball as any).strikerId || (ball as any).batsmanId,
      bowlerId: (ball as any).bowlerId,
      batsman: playersMap.get((ball as any).strikerId || (ball as any).batsmanId)?.name || 'Batter',
      bowler: playersMap.get(ball.bowlerId)?.name || 'Bowler',
      runs: ball.totalRuns,
      batRuns: ball.runsOffBat,
      extraType: (ball.extras.wides > 0 ? 'wide' : ball.extras.noBalls > 0 ? 'no-ball' : ball.extras.byes > 0 ? 'bye' : ball.extras.legByes > 0 ? 'leg-bye' : 'normal') as any,
      wicketType: (ball.wicket?.type || null) as any,
      isWicket: !!ball.wicket,
      isBoundary: ball.runsOffBat === 4 || ball.runsOffBat === 6,
      over: Math.floor(ball.sequence / 6) + 1,
      ball: (ball.sequence % 6) + 1,
      timestamp: ball.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
    }))
  }, [balls, playersMap])

  const lastBallDoc = useMemo(() => {
    return Array.isArray(balls) && balls.length > 0 ? (balls[balls.length - 1] as any) : null
  }, [balls])

  const prettyWicket = (t: string) => {
    const k = String(t || '').toLowerCase().trim()
    if (!k) return 'OUT'
    if (k === 'run-out') return 'RUN OUT'
    if (k === 'hit-wicket') return 'HIT WICKET'
    if (k === 'obstructing-field') return 'OBSTRUCT'
    return k.toUpperCase()
  }

  const computeCenterLabel = (ball: any, innLastFallback: any) => {
    if (!ball) {
      const fallbackRaw = String(innLastFallback?.value || '').trim()
      if (!fallbackRaw) return 'Over'
      return fallbackRaw === '·' ? '0' : fallbackRaw
    }
    const extras = (ball?.extras || {}) as any
    const type = String(ball?.type || '').toLowerCase()
    const isWide = Number(extras?.wides || 0) > 0 || type === 'wide'
    const isNoBall = Number(extras?.noBalls || 0) > 0 || type === 'no-ball' || type === 'noball'
    const isWicket = Boolean(ball?.wicket)
    if (isWicket) return `OUT (${prettyWicket(String(ball?.wicket?.type || ''))})`
    if (isWide) return 'WIDE'
    if (isNoBall) {
      const total = Number(ball?.totalRuns || 0)
      const extraRuns = Math.max(0, total - 1) // total = 1 (no-ball) + additional runs
      return extraRuns > 0 ? `NO BALL + ${extraRuns}` : 'NO BALL'
    }
    const badge = String(ball?.badge || '').trim()
    if (badge) return badge
    const fallbackRaw = String(innLastFallback?.value || '').trim()
    const raw = fallbackRaw || String(ball?.value || '').trim()
    if (!raw) return 'Over'
    if (raw === '·' || raw === '0') return '0'
    return raw
  }

  // Center event animation sequence:
  // - no-ball: show "NO BALL (+X)" then switch to "FREE HIT"
  // - otherwise: show immediate label
  useEffect(() => {
    const inn: any = currentInnings
    const innLast = (inn?.currentOverBalls && inn.currentOverBalls.length > 0)
      ? inn.currentOverBalls[inn.currentOverBalls.length - 1]
      : null
    const base = computeCenterLabel(lastBallDoc, innLast)

    const extras = (lastBallDoc?.extras || {}) as any
    const type = String(lastBallDoc?.type || '').toLowerCase()
    const isNoBall = Boolean(lastBallDoc) && (Number(extras?.noBalls || 0) > 0 || type === 'no-ball' || type === 'noball')
    const isWicket = Boolean(lastBallDoc?.wicket)

    let t1: any = null
    let t2: any = null
    let intervalId: any = null
    const bump = () => {
      setCenterEventAnim(true)
      t2 = window.setTimeout(() => setCenterEventAnim(false), 260)
    }

    setCenterEventText(base || 'Over')
    bump()

    if (isNoBall && !isWicket) {
      // Keep toggling: NO BALL (+X) <-> FREE HIT every 2s
      let showFreeHit = false
      intervalId = window.setInterval(() => {
        showFreeHit = !showFreeHit
        setCenterEventText(showFreeHit ? 'FREE HIT' : (base || 'NO BALL'))
        bump()
      }, 2000)
    }

    return () => {
      if (t1) window.clearTimeout(t1)
      if (t2) window.clearTimeout(t2)
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [lastBallDoc?.id, lastBallDoc?.sequence, currentInnings])

  // Calculate team names and chasing status (before early returns)
  const resolveSquadName = (m: any, side: 'A' | 'B') => {
    const sidRaw = side === 'A'
      ? (m.teamAId || m.teamASquadId || m.teamA)
      : (m.teamBId || m.teamBSquadId || m.teamB)
    const sid = String(sidRaw || '').trim()
    const fromSquad = String(squadsById.get(sid)?.name || squadsById.get(sid)?.teamName || '').trim()
    if (fromSquad) return fromSquad
    if (side === 'A') return String(m.teamAName || m.teamA || m.teamAId || 'Team A')
    return String(m.teamBName || m.teamB || m.teamBId || 'Team B')
  }
  const teamAName = match ? resolveSquadName(match as any, 'A') : 'Team A'
  const teamBName = match ? resolveSquadName(match as any, 'B') : 'Team B'

  // Resolve full squad objects for logos/details
  const resolveSquad = (m: any, side: 'A' | 'B') => {
    const sidRaw = side === 'A'
      ? (m.teamAId || m.teamASquadId || m.teamA)
      : (m.teamBId || m.teamBSquadId || m.teamB)
    const sid = String(sidRaw || '').trim()
    return squadsById.get(sid)
  }
  const teamASquad = match ? resolveSquad(match as any, 'A') : null
  const teamBSquad = match ? resolveSquad(match as any, 'B') : null

  // Match status flags (must be declared before any hook deps use them)
  const statusLower = String(match?.status || '').toLowerCase()
  const isLiveMatch = statusLower === 'live'
  const isUpcomingMatch = statusLower === '' || statusLower === 'upcoming' || statusLower === 'scheduled'
  const isFinishedMatch = statusLower === 'finished' || statusLower === 'completed'

  const xiCountA = Number((match as any)?.teamAPlayingXI?.length || 0)
  const xiCountB = Number((match as any)?.teamBPlayingXI?.length || 0)
  const hasAnyXI = xiCountA > 0 || xiCountB > 0
  const xiIsComplete = xiCountA === 11 && xiCountB === 11

  // Start datetime: prefer Timestamp, but if legacy stored date-only + time, merge them.
  const startDate = useMemo(() => {
    if (!match) return null
    const rawDate = (match as any)?.date
    const rawTime = String((match as any)?.time || '').trim()

    // Best effort: base date
    const d0 = coerceToDate(rawDate)
    if (d0) {
      // If time looks like HH:mm, apply it (keeps Timestamp time intact if same)
      const m = rawTime.match(/^(\d{1,2}):(\d{2})$/)
      if (m) {
        const hh = Number(m[1])
        const mm = Number(m[2])
        if (Number.isFinite(hh) && Number.isFinite(mm)) {
          const d = new Date(d0)
          d.setHours(hh, mm, 0, 0)
          return d
        }
      }
      return d0
    }

    // Fallback: try to parse date+time strings
    const dateStr = String(rawDate || '').trim()
    if (dateStr) {
      const ts = Date.parse(`${dateStr}T${rawTime || '00:00'}:00`)
      if (Number.isFinite(ts)) return new Date(ts)
    }
    return null
  }, [match])

  const isPastStart = useMemo(() => {
    if (!startDate) return false
    return now.getTime() >= startDate.getTime()
  }, [now, startDate])

  // Effective live: either status says live, OR start time has passed (auto-promote)
  const isLiveEffective = isLiveMatch || (isUpcomingMatch && isPastStart)
  const canUseLiveTab = isLiveEffective || isFinishedMatch

  const resultSummary = useMemo(() => {
    if (!match || !isFinishedMatch) return null
    if (!teamAInnings || !teamBInnings) return null

    const aRuns = Number((teamAInnings as any).totalRuns || 0)
    const aWkts = Number((teamAInnings as any).totalWickets || 0)
    const bRuns = Number((teamBInnings as any).totalRuns || 0)
    const bWkts = Number((teamBInnings as any).totalWickets || 0)

    const aTarget = (teamAInnings as any).target
    const bTarget = (teamBInnings as any).target
    const chasing: 'teamA' | 'teamB' =
      typeof aTarget === 'number' ? 'teamA' : typeof bTarget === 'number' ? 'teamB' : 'teamB'

    const chasingName = chasing === 'teamA' ? teamAName : teamBName
    const defendingName = chasing === 'teamA' ? teamBName : teamAName
    const target = Number((chasing === 'teamA' ? aTarget : bTarget) || 0) || (chasing === 'teamA' ? bRuns : aRuns) + 1
    const chasingRuns = chasing === 'teamA' ? aRuns : bRuns
    const chasingWkts = chasing === 'teamA' ? aWkts : bWkts

    if (target && chasingRuns >= target) {
      const wktsLeft = Math.max(0, 10 - chasingWkts)
      return `${chasingName} won by ${wktsLeft} wicket${wktsLeft !== 1 ? 's' : ''}`
    }
    if (target && chasingRuns < target) {
      const runsLeft = Math.max(0, (target - 1) - chasingRuns)
      if (runsLeft === 0) return 'Match Tied'
      return `${defendingName} won by ${runsLeft} run${runsLeft !== 1 ? 's' : ''}`
    }

    // Fallback (shouldn't happen): compare totals
    if (aRuns > bRuns) return `${teamAName} won by ${aRuns - bRuns} runs`
    if (bRuns > aRuns) return `${teamBName} won by ${bRuns - aRuns} runs`
    return 'Match Tied'
  }, [match, isFinishedMatch, teamAInnings, teamBInnings, teamAName, teamBName])

  // Commentary (live only) - lightweight feed used by CrexLiveSection
  useEffect(() => {
    if (!matchId) return
    if (!match) return
    if (!isLiveMatch) {
      setCommentary([])
      return
    }
    const inningId = (match.currentBatting || 'teamA') as 'teamA' | 'teamB'
    const unsub = subscribeToCommentary(matchId, (entries) => {
      const filtered = entries.filter((e) => !e.inningId || e.inningId === inningId)
      setCommentary(filtered)
    })
    return () => unsub()
  }, [matchId, match, isLiveMatch])

  const squadIdByLowerName = useMemo(() => {
    const m = new Map<string, string>()
    squadsById.forEach((s: any, id: string) => {
      const n = String(s?.name || s?.teamName || '').trim().toLowerCase()
      if (n) m.set(n, id)
    })
    return m
  }, [squadsById])

  const resolveSquadIdLoose = (ref: any) => {
    const raw = String(ref || '').trim()
    if (!raw) return ''
    if (squadsById.has(raw)) return raw
    const byName = squadIdByLowerName.get(raw.toLowerCase())
    return byName || ''
  }

  const teamKeyFor = (ref: any, nameFallback?: string) => {
    const id = resolveSquadIdLoose(ref)
    if (id) return `id:${id}`
    const name = String(nameFallback || ref || '').trim().toLowerCase()
    return name ? `name:${name}` : ''
  }

  const resolveMatchSideRef = (m: any, side: 'A' | 'B') => {
    return side === 'A'
      ? (m.teamAId || m.teamASquadId || m.teamA)
      : (m.teamBId || m.teamBSquadId || m.teamB)
  }

  const currentKeyA = useMemo(() => {
    if (!match) return ''
    return teamKeyFor(resolveMatchSideRef(match as any, 'A'), teamAName)
  }, [match, teamAName])
  const currentKeyB = useMemo(() => {
    if (!match) return ''
    return teamKeyFor(resolveMatchSideRef(match as any, 'B'), teamBName)
  }, [match, teamBName])

  // Load recent matches for Team Form + Head-to-Head (upcoming only)
  useEffect(() => {
    const run = async () => {
      if (!match) return
      if (!currentKeyA || !currentKeyB) return
      if (!isUpcomingMatch) return
      setRelatedLoading(true)
      try {
        const tid = String((match as any).tournamentId || '').trim()
        const ms = tid ? await matchService.getByTournament(tid) : await matchService.getAll()
        const others = ms.filter((m) => m.id !== match.id)

        const withKeys = others.map((m: any) => {
          const aName = String(m.teamAName || m.teamA || m.teamAId || '').trim()
          const bName = String(m.teamBName || m.teamB || m.teamBId || '').trim()
          const aKey = teamKeyFor(resolveMatchSideRef(m, 'A'), aName)
          const bKey = teamKeyFor(resolveMatchSideRef(m, 'B'), bName)
          return { m, aKey, bKey }
        }).filter((x) => x.aKey && x.bKey)

        const involves = (x: any, key: string) => x.aKey === key || x.bKey === key

        const teamAMs = withKeys.filter((x) => involves(x, currentKeyA))
        const teamBMs = withKeys.filter((x) => involves(x, currentKeyB))
        const h2hMs = withKeys.filter((x) => involves(x, currentKeyA) && involves(x, currentKeyB))

        // Sort by match date desc
        const tsOf = (m: any) => {
          const d = coerceToDate(m?.date)
          if (d) return d.getTime()
          const dd = String(m.date || '').trim()
          const tt = String(m.time || '').trim()
          const ts = dd ? Date.parse(`${dd}T${tt || '00:00'}:00`) : 0
          return Number.isFinite(ts) ? ts : 0
        }
        const sortDesc = (a: any, b: any) => (tsOf(b.m) - tsOf(a.m)) || String(b.m.id).localeCompare(String(a.m.id))

        const pickIds = Array.from(new Set([
          ...teamAMs.sort(sortDesc).slice(0, 5).map((x) => x.m.id),
          ...teamBMs.sort(sortDesc).slice(0, 5).map((x) => x.m.id),
          ...h2hMs.sort(sortDesc).slice(0, 10).map((x) => x.m.id),
        ].filter(Boolean)))

        const pickedMatches = others.filter((m) => pickIds.includes(m.id))
        setRelatedMatches(pickedMatches)

        const entries = await Promise.all(
          pickIds.map(async (id) => {
            const [a, b] = await Promise.all([
              matchService.getInnings(id, 'teamA').catch(() => null),
              matchService.getInnings(id, 'teamB').catch(() => null),
            ])
            return [id, { teamA: a, teamB: b }] as const
          })
        )
        const im = new Map<string, { teamA: any | null; teamB: any | null }>()
        entries.forEach(([id, v]) => im.set(id, v))
        setRelatedInningsMap(im)
      } catch (e) {
        console.warn('[MatchLive] Failed to load related matches:', e)
        setRelatedMatches([])
        setRelatedInningsMap(new Map())
      } finally {
        setRelatedLoading(false)
      }
    }
    run()
  }, [match?.id, (match as any)?.tournamentId, currentKeyA, currentKeyB, isUpcomingMatch])

  const teamFormAndH2H = useMemo(() => {
    try {
      const getMatchDisplayTeam = (m: any, side: 'A' | 'B') => {
        const nameFallback = side === 'A'
          ? String(m.teamAName || m.teamA || m.teamAId || 'Team A')
          : String(m.teamBName || m.teamB || m.teamBId || 'Team B')
        return resolveSquadName(m, side) || nameFallback
      }
      const keyForMatchSide = (m: any, side: 'A' | 'B') => {
        const nameFallback = side === 'A'
          ? String(m.teamAName || m.teamA || m.teamAId || '')
          : String(m.teamBName || m.teamB || m.teamBId || '')
        return teamKeyFor(resolveMatchSideRef(m, side), nameFallback)
      }

      const tsOf = (m: any) => {
        const d = coerceToDate(m?.date)
        if (d) return d.getTime()
        const dd = String(m.date || '').trim()
        const tt = String(m.time || '').trim()
        const ts = dd ? Date.parse(`${dd}T${tt || '00:00'}:00`) : 0
        return Number.isFinite(ts) ? ts : 0
      }

      const related = relatedMatches.slice().sort((a: any, b: any) => tsOf(b) - tsOf(a))

      const resultBadge = (m: any, teamKey: string): 'W' | 'L' | 'T' | '*' => {
        const inn = relatedInningsMap.get(m.id)
        if (!inn?.teamA || !inn?.teamB) return '*'
        const aRuns = Number(inn.teamA.totalRuns || 0)
        const bRuns = Number(inn.teamB.totalRuns || 0)
        if (aRuns === bRuns) return 'T'
        const aKey = keyForMatchSide(m, 'A')
        const bKey = keyForMatchSide(m, 'B')
        const teamIsA = aKey === teamKey
        const teamIsB = bKey === teamKey
        if (!teamIsA && !teamIsB) return '*'
        const teamWon = (aRuns > bRuns && teamIsA) || (bRuns > aRuns && teamIsB)
        return teamWon ? 'W' : 'L'
      }

      const getScoreText = (m: any, side: 'A' | 'B') => {
        const inn = relatedInningsMap.get(m.id)
        const data = side === 'A' ? inn?.teamA : inn?.teamB
        if (!data) return '—'
        const r = Number(data.totalRuns || 0)
        const w = Number(data.totalWickets || 0)
        const o = String(data.overs || '').trim()
        return `${r}/${w}${o ? `  ${o}` : ''}`
      }

      const teamAForm = related.filter((m: any) => {
        const aKey = keyForMatchSide(m, 'A')
        const bKey = keyForMatchSide(m, 'B')
        return aKey === currentKeyA || bKey === currentKeyA
      }).slice(0, 5)
      const teamBForm = related.filter((m: any) => {
        const aKey = keyForMatchSide(m, 'A')
        const bKey = keyForMatchSide(m, 'B')
        return aKey === currentKeyB || bKey === currentKeyB
      }).slice(0, 5)

      const h2h = related.filter((m: any) => {
        const aKey = keyForMatchSide(m, 'A')
        const bKey = keyForMatchSide(m, 'B')
        return (aKey === currentKeyA || bKey === currentKeyA) && (aKey === currentKeyB || bKey === currentKeyB)
      }).slice(0, 10)

      let winsA = 0
      let winsB = 0
      h2h.forEach((m: any) => {
        const inn = relatedInningsMap.get(m.id)
        if (!inn?.teamA || !inn?.teamB) return
        const aRuns = Number(inn.teamA.totalRuns || 0)
        const bRuns = Number(inn.teamB.totalRuns || 0)
        if (aRuns === bRuns) return
        const aKey = keyForMatchSide(m, 'A')
        const bKey = keyForMatchSide(m, 'B')
        const winnerKey = aRuns > bRuns ? aKey : bKey
        if (winnerKey === currentKeyA) winsA += 1
        if (winnerKey === currentKeyB) winsB += 1
      })

      return {
        teamAForm: teamAForm.map((m: any) => ({ id: m.id, badge: resultBadge(m, currentKeyA) })),
        teamBForm: teamBForm.map((m: any) => ({ id: m.id, badge: resultBadge(m, currentKeyB) })),
        h2hSummary: { winsA, winsB, total: h2h.length },
        h2hRows: h2h.map((m: any) => {
          const aKey = keyForMatchSide(m, 'A')
          const bKey = keyForMatchSide(m, 'B')
          const aName = getMatchDisplayTeam(m, 'A')
          const bName = getMatchDisplayTeam(m, 'B')
          const aScore = getScoreText(m, 'A')
          const bScore = getScoreText(m, 'B')
          const inn = relatedInningsMap.get(m.id)
          let winnerText = '—'
          if (inn?.teamA && inn?.teamB) {
            const aRuns = Number(inn.teamA.totalRuns || 0)
            const bRuns = Number(inn.teamB.totalRuns || 0)
            if (aRuns === bRuns) winnerText = 'Tied'
            else winnerText = (aRuns > bRuns ? aName : bName) + ' Won'
          }
          const d = coerceToDate(m?.date)
          const dt = d ? `${formatDateLabelTZ(d)}${String((m as any).time || '').trim() ? ` • ${formatTimeHMTo12h(String((m as any).time || '').trim())}` : ''}` : ''
          const leftIsA = aKey === currentKeyA
          // Keep consistent orientation: show current TeamA on left in H2H list
          const leftName = leftIsA ? aName : bName
          const rightName = leftIsA ? bName : aName
          const leftScore = leftIsA ? aScore : bScore
          const rightScore = leftIsA ? bScore : aScore
          return { id: m.id, leftName, rightName, leftScore, rightScore, winnerText, dt }
        }),
      }
    } catch (e) {
      console.error('[MatchLive] TeamForm/H2H compute failed:', e)
      return {
        teamAForm: [],
        teamBForm: [],
        h2hSummary: { winsA: 0, winsB: 0, total: 0 },
        h2hRows: [],
      }
    }
  }, [currentKeyA, currentKeyB, relatedInningsMap, relatedMatches])
  const isChasing = match?.currentBatting === 'teamB' && teamAInnings

  const startTimeText = useMemo(() => {
    if (!match) return ''
    const d = startDate
    // Prefer match.time if present (admin stores HH:mm)
    const t = String((match as any).time || '').trim()
    if (t) return formatTimeHMTo12h(t)
    return d ? formatTimeLabelBD(d) : ''
  }, [match, startDate])

  // Initialize default tab once, based on match status
  useEffect(() => {
    if (!match || didInitTab.current) return
    setActiveTab(isLiveEffective && !isFinishedMatch ? 'live' : 'summary')
    didInitTab.current = true
  }, [match, canUseLiveTab])

  // Countdown timer (only when upcoming + we have a start date)
  useEffect(() => {
    if (!startDate) return
    if (isLiveEffective) return
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [startDate, isLiveEffective])

  // Auto-promote upcoming -> live in Firestore when time has passed (admin only).
  // This makes Home/Live lists reflect the change automatically.
  useEffect(() => {
    const run = async () => {
      if (!matchId || !match) return
      if (!isUpcomingMatch) return
      if (!isPastStart) return
      if (isLiveMatch) return
      if (!user || user.role !== 'admin') return
      try {
        await matchService.update(matchId, {
          status: 'live' as any,
          // keep existing matchPhase if present; else default to FirstInnings
          matchPhase: ((match as any)?.matchPhase || 'FirstInnings') as any,
        } as any)
      } catch (e) {
        console.warn('[MatchLive] Auto-promote to live failed:', e)
      }
    }
    run()
  }, [isLiveMatch, isPastStart, isUpcomingMatch, match, matchId, user])

  const countdown = useMemo(() => {
    if (!startDate) return null
    const diffMs = Math.max(0, startDate.getTime() - now.getTime())
    const totalSeconds = Math.floor(diffMs / 1000)
    const days = Math.floor(totalSeconds / (24 * 3600))
    const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    return { days, hours, minutes, seconds, totalSeconds }
  }, [startDate, now])

  // Calculate win probability - simple version (MUST be before early returns)
  const winProb = useMemo(() => {
    if (!currentInnings || !match) return { teamA: 50, teamB: 50, draw: 0 }

    // Simple probability calculation based on score and wickets
    if (isChasing && teamAInnings) {
      const target = teamAInnings.totalRuns + 1
      const current = currentInnings.totalRuns || 0
      const needed = target - current
      const wickets = currentInnings.totalWickets || 0
      const oversCompleted = parseFloat(currentInnings.overs || '0')
      const oversRemaining = (match.oversLimit || 20) - oversCompleted

      if (needed <= 0) {
        return { teamA: 0, teamB: 100, draw: 0 }
      }

      // Simple calculation: more runs needed = lower probability
      // More wickets lost = lower probability
      const runFactor = Math.max(0, Math.min(1, 1 - (needed / target)))
      const wicketFactor = Math.max(0, Math.min(1, (10 - wickets) / 10))
      const teamBProb = Math.round((runFactor * 0.6 + wicketFactor * 0.4) * 100)

      return {
        teamA: Math.max(0, Math.min(100, 100 - teamBProb - 10)),
        teamB: teamBProb,
        draw: 10
      }
    } else {
      // First innings - equal probability
      return { teamA: 45, teamB: 45, draw: 10 }
    }
  }, [currentInnings, match, isChasing, teamAInnings])

  const allOversForStrip = useMemo(() => {
    // One row with ALL overs, horizontally scrollable
    return currentInnings?.recentOvers || []
  }, [currentInnings])

  // Match tabs (MUST be before early returns) - All tabs in one page
  const matchTabs = useMemo(() => [
    { id: 'live', label: 'Live', disabled: !canUseLiveTab },
    { id: 'summary', label: 'Summary' },
    { id: 'scorecard', label: 'Scorecard' },
    { id: 'graphs', label: 'Graphs' },
    { id: 'playing-xi', label: 'Playing XI' },
  ], [canUseLiveTab])

  // Early returns AFTER all hooks
  if (loading) {
    return <MatchLiveSkeleton />
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Match not found</p>
        </div>
      </div>
    )
  }

  const renderUpcoming = () => {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Upcoming Hero */}
        <div className="bg-gradient-to-br from-batchcrick-navy-dark via-batchcrick-navy to-batchcrick-navy-light rounded-2xl shadow-2xl overflow-hidden border border-batchcrick-navy-light">
          <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-black tracking-wider text-white/70 uppercase">Upcoming Match</span>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 text-white border border-white/10">
                {startDate ? `${formatDateLabelTZ(startDate)}${startTimeText ? ` • ${startTimeText}` : ''}` : 'Start time: TBA'}
              </span>
            </div>
            <div className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-400/15 text-amber-200 border border-amber-300/20">
              {String(match.status || 'upcoming').toUpperCase()}
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div className="min-w-0">
                {/* Team names: show FULL (no ellipsis). Long names wrap nicely. */}
                <div className="text-white">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                    <div
                      className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight text-center whitespace-normal break-words"
                      title={teamAName}
                    >
                      {teamAName}
                    </div>
                    <div className="pt-1 sm:pt-2 text-center">
                      <div className="text-xs font-black tracking-widest text-white/70 uppercase">VS</div>
                      <div className="mt-2 w-10 h-[2px] bg-white/20 mx-auto rounded-full" />
                    </div>
                    <div
                      className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight text-center whitespace-normal break-words"
                      title={teamBName}
                    >
                      {teamBName}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-sm text-white/70">
                  {match.venue ? `📍 ${match.venue}` : '📍 Venue: TBA'}
                  {match.oversLimit ? ` • ${match.oversLimit} overs` : ''}
                </div>

                <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[11px] font-bold text-white/60 uppercase">Toss</div>
                    {match.tossWinner ? (
                      <div className="text-sm font-semibold text-white whitespace-normal break-words">
                        {(() => {
                          const tw = String((match as any).tossWinner || '').trim()
                          const decisionRaw = String((match as any).electedTo || (match as any).tossDecision || '').trim()
                          const decision = decisionRaw ? decisionRaw.toLowerCase() : ''
                          const decisionLabel = decision ? (decision === 'bat' ? 'Bat' : decision === 'bowl' ? 'Bowl' : decisionRaw) : '—'

                          const isTeamA = tw === 'teamA' || tw === 'A' || tw === 'a'
                          const isTeamB = tw === 'teamB' || tw === 'B' || tw === 'b'
                          const aId = String(((match as any).teamAId || (match as any).teamASquadId || (match as any).teamA || '')).trim()
                          const bId = String(((match as any).teamBId || (match as any).teamBSquadId || (match as any).teamB || '')).trim()
                          const winnerName =
                            isTeamA ? teamAName :
                              isTeamB ? teamBName :
                                (tw && (tw === aId)) ? teamAName :
                                  (tw && (tw === bId)) ? teamBName :
                                    tw

                          return (
                            <>
                              <span className="font-extrabold">{winnerName}</span>
                              <span className="text-white/70"> won the toss • chose to </span>
                              <span className="font-extrabold">{decisionLabel}</span>
                            </>
                          )
                        })()}
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-white">Not set</div>
                    )}
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[11px] font-bold text-white/60 uppercase">Playing XI</div>
                    {hasAnyXI ? (
                      <div className="mt-0.5">
                        <button
                          type="button"
                          onClick={() => setActiveTab('playing-xi')}
                          className="text-sm font-extrabold text-white hover:text-white/90 transition"
                          title="See Playing XI"
                        >
                          See Playing XI
                        </button>
                        <div className="text-xs text-white/70 font-semibold mt-1">
                          {xiCountA}/11 • {xiCountB}/11
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-white/80">Playing XI not yet</div>
                    )}
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="text-[11px] font-bold text-white/60 uppercase">Group</div>
                    <div className="text-sm font-semibold text-white">{(match as any).groupName || '—'}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 md:p-6">
                <div className="text-xs font-black text-white/70 uppercase tracking-wider">Match starts in</div>
                {countdown ? (
                  <div className="mt-4 grid grid-cols-4 gap-3">
                    {([
                      { label: 'Days', value: countdown.days },
                      { label: 'Hours', value: countdown.hours },
                      { label: 'Min', value: countdown.minutes },
                      { label: 'Sec', value: countdown.seconds },
                    ] as const).map((x) => (
                      <div key={x.label} className="rounded-xl bg-black/20 border border-white/10 p-3 text-center">
                        <div className="text-2xl md:text-3xl font-extrabold text-white tabular-nums">{String(x.value).padStart(2, '0')}</div>
                        <div className="text-[11px] font-bold text-white/60 uppercase">{x.label}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-white/70">Start time not set yet.</div>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => (hasAnyXI ? setActiveTab('playing-xi') : null)}
                    disabled={!hasAnyXI}
                    className="px-4 py-2 rounded-xl bg-white text-batchcrick-navy font-bold hover:bg-white/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {hasAnyXI ? 'See Playing XI' : 'Playing XI not yet'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('summary')}
                    className="px-4 py-2 rounded-xl bg-white/10 text-white font-bold border border-white/15 hover:bg-white/15 transition"
                  >
                    Summary
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Helpful note */}
        <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="text-sm font-bold text-slate-900">Live scoring will appear here when the match starts.</div>
          <div className="text-sm text-slate-600 mt-1">You can check Playing XI before start.</div>
        </div>

        {/* Team Form + Head to Head (BBL-style) */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="text-lg font-extrabold text-slate-900">Team Form</div>
              <div className="text-sm text-slate-600 mt-0.5">Last 5 matches</div>
            </div>
            <div className="p-5 space-y-4">
              {([
                { name: teamAName, form: teamFormAndH2H.teamAForm },
                { name: teamBName, form: teamFormAndH2H.teamBForm },
              ] as const).map((row) => (
                <div key={row.name} className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-extrabold text-slate-800">
                      {String(row.name || '?').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="font-bold text-slate-900 truncate">{row.name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(row.form.length ? row.form : Array.from({ length: 5 }).map((_, i) => ({ id: String(i), badge: '*' as const }))).map((x) => {
                      const b = x.badge
                      const cls =
                        b === 'W'
                          ? 'bg-emerald-600 text-white'
                          : b === 'L'
                            ? 'bg-rose-500 text-white'
                            : b === 'T'
                              ? 'bg-slate-700 text-white'
                              : 'bg-slate-200 text-slate-700'
                      return (
                        <div key={x.id} className={`w-9 h-9 rounded-lg flex items-center justify-center font-extrabold ${cls}`}>
                          {b}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              {relatedLoading ? <div className="text-xs text-slate-500">Loading form…</div> : null}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="text-lg font-extrabold text-slate-900">Head to Head</div>
              <div className="text-sm text-slate-600 mt-0.5">Last 10 matches</div>
            </div>
            <div className="p-5">
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 font-extrabold text-slate-900 truncate">{teamAName}</div>
                  <div className="text-3xl font-extrabold tabular-nums">
                    <span className="text-emerald-600">{teamFormAndH2H.h2hSummary.winsA}</span>
                    <span className="text-slate-400 mx-2">-</span>
                    <span className="text-amber-600">{teamFormAndH2H.h2hSummary.winsB}</span>
                  </div>
                  <div className="min-w-0 font-extrabold text-slate-900 truncate text-right">{teamBName}</div>
                </div>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {teamFormAndH2H.h2hRows.length === 0 ? (
                  <div className="py-6 text-slate-600 text-sm">No head-to-head matches found yet.</div>
                ) : (
                  teamFormAndH2H.h2hRows.map((r) => (
                    <div key={r.id} className="py-4">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                        <div className="text-left">
                          <div className="text-xs font-bold text-slate-500">{r.leftName}</div>
                          <div className="text-sm font-extrabold text-slate-900">{r.leftScore}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-extrabold text-emerald-700">{r.winnerText}</div>
                          {r.dt ? <div className="text-xs text-slate-500 mt-0.5">{r.dt}</div> : null}
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-slate-500">{r.rightName}</div>
                          <div className="text-sm font-extrabold text-slate-900">{r.rightScore}</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {relatedLoading ? <div className="text-xs text-slate-500 mt-3">Loading head-to-head…</div> : null}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render content based on active tab - All inline, no navigation
  const renderTabContent = () => {
    switch (activeTab) {
      case 'scorecard':
        return <MatchScorecard />
      case 'graphs':
        return <MatchGraphs />
      case 'playing-xi':
        return <MatchPlayingXI />
      case 'summary':
        if (isUpcomingMatch) return renderUpcoming()
        // If it's LIVE, we want the standard Info tab (Venue, Toss, etc) as summary is not ready
        if (isLiveMatch) return <MatchInfo />
        // Only finished matches get the new specific Summary component
        return (
          <MatchSummary
            match={match}
            teamAInnings={teamAInnings}
            teamBInnings={teamBInnings}
            playersMap={playersMap}
            teamAName={teamAName}
            teamBName={teamBName}
            teamALogo={teamASquad?.logoUrl}
            teamBLogo={teamBSquad?.logoUrl}
          />
        )
      default:
      case 'live':
        if (!canUseLiveTab) return renderUpcoming()
        return (
          <div className="bg-gray-50 min-h-screen">
            {/* CREX/BBL style dark header */}
            < div className="bg-gradient-to-r from-[#1a1f3c] via-[#1e2345] to-[#1a1f3c] text-white border-b border-white/5 relative overflow-hidden" >
              {/* Background Glow */}
              < div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.1),transparent_50%)]" />

              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 relative z-10">
                {/* Top Row: Live Status & Venue */}
                <div className="flex items-center justify-between mb-6 text-xs font-bold tracking-wider">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                    </span>
                    <span className="text-white/90">LIVE</span>
                  </div>
                  <div className="text-white/60 uppercase">{match.venue || 'VENUE TBD'}</div>
                </div>

                {(() => {
                  const inn: any = currentInnings
                  const runs = Number(inn?.totalRuns || 0)
                  const wkts = Number(inn?.totalWickets || 0)
                  const overs = String(inn?.overs || '0.0')
                  const crr = typeof inn?.currentRunRate === 'number' ? inn.currentRunRate : Number(inn?.currentRunRate || 0)
                  const rrr = typeof inn?.requiredRunRate === 'number' ? inn.requiredRunRate : Number(inn?.requiredRunRate || 0)
                  const target = inn?.target

                  const currentTeamName = match.currentBatting === 'teamB' ? teamBName : teamAName

                  // Toss Logic
                  const tossWinner = String((match as any)?.tossWinner || '').trim()
                  const tossDecision = String((match as any)?.tossDecision || (match as any)?.electedTo || '').trim().toLowerCase()
                  const tossText = tossWinner && tossDecision
                    ? `${tossWinner === 'teamA' ? teamAName : teamBName} Opt to ${tossDecision}`
                    : ''

                  const last = (inn?.currentOverBalls && inn.currentOverBalls.length > 0)
                    ? inn.currentOverBalls[inn.currentOverBalls.length - 1]
                    : null

                  // Center Event calculation
                  const eventLabel = (isFinishedMatch && resultSummary) ? resultSummary : (centerEventText || '—')
                  const isBoundary = eventLabel === '4' || eventLabel === '6'
                  const isWicket = eventLabel.includes('OUT')

                  return (
                    <div>
                      {/* SPLIT HEADER DESIGN */}
                      <div className="flex items-center relative max-w-full h-24 mb-0">
                        {/* LEFT: Team, Score, Overs (60%) */}
                        <div className="w-[60%] flex items-center gap-2 md:gap-4 pr-2 h-full">
                          {/* Logo */}
                          <div className="relative flex-shrink-0">
                            {(match as any)[match.currentBatting === 'teamB' ? 'teamBLogoUrl' : 'teamALogoUrl'] ? (
                              <img
                                src={(match as any)[match.currentBatting === 'teamB' ? 'teamBLogoUrl' : 'teamALogoUrl']}
                                alt={currentTeamName}
                                className="w-10 h-10 sm:w-12 sm:h-12 md:w-20 md:h-20 rounded-full object-cover border-2 border-white/10 shadow-lg bg-white/5"
                              />
                            ) : (
                              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-white/10 flex items-center justify-center text-lg md:text-2xl font-bold text-white/40 shadow-inner">
                                {currentTeamName.charAt(0)}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col min-w-0 overflow-hidden w-full">
                            <div className="text-base sm:text-lg md:text-2xl font-bold text-white tracking-wide uppercase mb-0.5 md:mb-1 drop-shadow-sm leading-none truncate pr-1">
                              {currentTeamName}
                            </div>
                            <div className="flex items-baseline gap-1.5 md:gap-3">
                              <div className="text-3xl sm:text-4xl md:text-7xl font-black text-white leading-none tracking-tight drop-shadow-lg whitespace-nowrap">
                                {runs}<span className="text-white/30 text-xl md:text-4xl align-top mx-0.5 md:mx-1">-</span>{wkts}
                              </div>
                              <div className="text-xs sm:text-sm md:text-2xl font-bold text-white/50 lowercase self-end mb-0.5 md:mb-1 whitespace-nowrap">
                                {overs}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* CENTER DIVIDER - ABSOLUTE FIXED POSITION AT 60% */}
                        <div className="absolute left-[60%] top-1/2 -translate-y-1/2 h-16 w-px bg-gradient-to-b from-transparent via-white/40 to-transparent shadow-[0_0_10px_rgba(255,255,255,0.3)] z-10" />

                        {/* RIGHT: Current Ball Event (40%) */}
                        <div className="w-[40%] pl-2 h-full flex flex-col justify-center items-center relative">
                          <div className={`
                             font-black tracking-tighter transition-all duration-300 transform drop-shadow-2xl
                             ${isBoundary ? 'text-emerald-400 scale-105' : isWicket ? 'text-red-500 scale-105' : 'text-[#facc15]'}
                             ${centerEventAnim ? 'opacity-80 scale-95' : 'opacity-100 scale-100'}
                             leading-none flex justify-center items-center h-full break-all
                             ${(() => {
                              let label = eventLabel;
                              // Logic to check text length for sizing
                              if (isWicket && (last?.dismissalType?.toLowerCase().includes('run out') || eventLabel.toLowerCase().includes('run out'))) {
                                label = "RUN OUT";
                              } else if (isWicket && last?.dismissalType) {
                                label = last.dismissalType.toUpperCase();
                              } else if (isWicket && eventLabel.includes('OUT')) {
                                label = eventLabel.replace(/OUT\s*\(?|\)?/gi, '').trim() || 'WICKET';
                              }

                              const len = label.length;
                              if (len <= 2) return 'text-5xl sm:text-6xl md:text-9xl';
                              if (len <= 4) return 'text-4xl sm:text-5xl md:text-8xl';
                              return 'text-2xl sm:text-3xl md:text-6xl';
                            })()}
                           `}>
                            <span className="block max-w-full">
                              {(() => {
                                if (isWicket && (last?.dismissalType?.toLowerCase().includes('run out') || eventLabel.toLowerCase().includes('run out'))) return "RUN OUT";
                                if (isWicket && last?.dismissalType) return last.dismissalType.toUpperCase();
                                if (isWicket && eventLabel.includes('OUT')) return eventLabel.replace(/OUT\s*\(?|\)?/gi, '').trim() || 'WICKET';
                                return eventLabel === 'Over' ? '•' : eventLabel;
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* BOTTOM ROW: CRR, RRR, Target/Toss */}
                      <div className="flex items-center justify-between pt-4 border-t border-white/5 text-sm md:text-base font-medium">
                        <div className="flex gap-8 text-white/50 uppercase tracking-widest text-xs font-bold">
                          <div>
                            CRR: <span className="text-white text-base ml-1">{Number.isFinite(crr) ? crr.toFixed(2) : '0.00'}</span>
                          </div>
                          {target && (
                            <div>
                              RRR: <span className="text-white text-base ml-1">{Number.isFinite(rrr) ? rrr.toFixed(2) : '0.00'}</span>
                            </div>
                          )}
                        </div>

                        <div className="text-white/70 font-semibold">
                          {target ? (
                            <span className="bg-white/10 px-3 py-1 rounded-full text-xs uppercase tracking-wide">Target: <span className="text-white">{target}</span></span>
                          ) : (
                            <span className="uppercase tracking-wide text-xs opacity-70">{tossText}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div >

            {/* Main live body (BBL-style) */}
            < CrexLiveSection
              match={match as any}
              striker={striker as any}
              nonStriker={nonStriker as any}
              currentBowler={bowler as any}
              partnership={(currentInnings as any)?.partnership
              }
              lastWicket={(currentInnings as any)?.fallOfWickets?.[(currentInnings as any)?.fallOfWickets?.length - 1]}
              recentOvers={(currentInnings as any)?.recentOvers || []}
              commentary={commentary as any}
              activeCommentaryFilter={activeCommentaryFilter as any}
              onCommentaryFilterChange={(id: string) => setActiveCommentaryFilter(id)}
              currentRunRate={(currentInnings as any)?.currentRunRate || 0}
              requiredRunRate={(currentInnings as any)?.requiredRunRate || null}
              currentRuns={(currentInnings as any)?.totalRuns || 0}
              currentOvers={(currentInnings as any)?.overs || '0.0'}
              oversLimit={match.oversLimit || 20}
              target={(currentInnings as any)?.target || null}
              runsNeeded={(currentInnings as any)?.target ? Math.max(0, Number((currentInnings as any).target) - Number((currentInnings as any).totalRuns || 0)) : null}
              ballsRemaining={(currentInnings as any)?.remainingBalls ?? ((match.oversLimit || 20) * 6 - Number((currentInnings as any)?.legalBalls || 0))}
              matchStatus={String((isLiveEffective ? 'Live' : isFinishedMatch ? 'Finished' : match.status) || '')}
              matchPhase={(match as any)?.matchPhase}
              currentInnings={(match.currentBatting || 'teamA') as any}
              currentWickets={(currentInnings as any)?.totalWickets || 0}
              teamAName={teamAName}
              teamBName={teamBName}
              resultSummary={isFinishedMatch ? (resultSummary || null) : null}
            />
          </div >
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Match Tabs */}
      <MatchTabs tabs={matchTabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {renderTabContent()}
    </div>
  )
}

