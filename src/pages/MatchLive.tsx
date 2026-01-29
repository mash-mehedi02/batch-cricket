/**
 * Live Match Page
 * Screenshot-based design with tabs, dark blue header, tables
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { squadService } from '@/services/firestore/squads'
import { tournamentService } from '@/services/firestore/tournaments'
import { Match, InningsStats, Ball } from '@/types'
import { useAuthStore } from '@/store/authStore'
import MatchTabs from '@/components/match/MatchTabs'
import { getMatchResultString } from '@/utils/matchWinner'
import MatchLiveSkeleton from '@/components/skeletons/MatchLiveSkeleton'
import { subscribeToCommentary, type CommentaryEntry } from '@/services/commentary/commentaryService'
import CrexLiveSection from '@/components/live/CrexLiveSection'
import BallEventDisplay from '@/components/live/BallEventDisplay'
import MatchLiveHero from '@/components/live/MatchLiveHero'
import { NotificationBell } from '@/components/notifications/NotificationBell'
// Import all match page components to render inline
import MatchScorecard from '@/pages/MatchScorecard'
import MatchPlayingXI from '@/pages/MatchPlayingXI'
import MatchGraphs from '@/pages/MatchGraphs'
import MatchInfo from '@/pages/MatchInfo'
import MatchSummary from '@/components/match/MatchSummary'
import TournamentPointsTable from '@/pages/TournamentPointsTable'
import { coerceToDate, formatDateLabelTZ, formatTimeHMTo12h, formatTimeLabelBD } from '@/utils/date'

export default function MatchLive() {
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [match, setMatch] = useState<Match | null>(null)
  const [currentInnings, setCurrentInnings] = useState<InningsStats | null>(null)
  const [teamAInnings, setTeamAInnings] = useState<InningsStats | null>(null)
  const [teamBInnings, setTeamBInnings] = useState<InningsStats | null>(null)
  const [balls, setBalls] = useState<Ball[]>([])
  const [playersMap, setPlayersMap] = useState<Map<string, any>>(new Map())
  const [squadsById, setSquadsById] = useState<Map<string, any>>(new Map())
  const [tournament, setTournament] = useState<any>(null)
  const [relatedMatches, setRelatedMatches] = useState<Match[]>([])
  const [relatedInningsMap, setRelatedInningsMap] = useState<Map<string, { teamA: any | null; teamB: any | null }>>(new Map())
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [commentary, setCommentary] = useState<CommentaryEntry[]>([])
  const [activeCommentaryFilter, setActiveCommentaryFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('summary') // Upcoming should land on Summary by default
  const didInitTab = useRef(false)
  const [now, setNow] = useState<Date>(() => new Date())
  const [centerEventText, setCenterEventText] = useState<string>('')
  const [wicketDisplayText, setWicketDisplayText] = useState<string>('')
  const [isWicketDisplay, setIsWicketDisplay] = useState<boolean>(false)
  const [centerEventAnim, setCenterEventAnim] = useState(false)
  const [ballAnimating, setBallAnimating] = useState(false)
  const [ballEventType, setBallEventType] = useState<'4' | '6' | 'wicket' | 'normal'>('normal')
  const [animationEvent, setAnimationEvent] = useState<string>('')
  const [showAnimation, setShowAnimation] = useState<boolean>(false)
  const [expandedTeamIdx, setExpandedTeamIdx] = useState<number | null>(null)

  // --- Match status and derived data (Must be declared before hooks) ---
  const statusLower = String(match?.status || '').toLowerCase()
  const isLiveMatch = statusLower === 'live'
  const isUpcomingMatch = statusLower === '' || statusLower === 'upcoming' || statusLower === 'scheduled'
  const isFinishedMatch = statusLower === 'finished' || statusLower === 'completed'

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

  const resolveSquad = (m: any, side: 'A' | 'B') => {
    const sidRaw = side === 'A'
      ? (m.teamAId || m.teamASquadId || m.teamA)
      : (m.teamBId || m.teamBSquadId || m.teamB)
    const sid = String(sidRaw || '').trim()
    return squadsById.get(sid)
  }
  const teamASquad = match ? resolveSquad(match as any, 'A') : null
  const teamBSquad = match ? resolveSquad(match as any, 'B') : null

  // Load match and subscribe
  useEffect(() => {
    if (!matchId) return

    matchService.getById(matchId).then((matchData) => {
      if (matchData) {
        setMatch(matchData)
        setLoading(false)

        // Load tournament if tournamentId exists
        if (matchData.tournamentId) {
          tournamentService.getById(matchData.tournamentId).then((tournamentData: any) => {
            if (tournamentData) setTournament(tournamentData)
          }).catch((err: any) => {
            console.warn('Error loading tournament:', err)
          })
        }
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

        // Load tournament if tournamentId exists
        if (matchData.tournamentId && !tournament) {
          tournamentService.getById(matchData.tournamentId).then((tournamentData: any) => {
            if (tournamentData) setTournament(tournamentData)
          }).catch((err: any) => {
            console.warn('Error loading tournament:', err)
          })
        }
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

  // Subscribe to Commentary
  useEffect(() => {
    if (!matchId) return
    console.log('[MatchLive] Subscribing to commentary for match:', matchId)
    const unsub = subscribeToCommentary(matchId, (data) => {
      setCommentary(data)
    })
    return () => unsub()
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

        const squadAId = await resolveSquadId((match as any).teamASquadId || (match as any).teamAId, teamAName)
        const squadBId = await resolveSquadId((match as any).teamBSquadId || (match as any).teamBId, teamBName)

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
    // Master Match Document is the single source of truth for who is at crease
    const strikerId = match?.currentStrikerId || '';
    if (!strikerId) return null;

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
    const nonStrikerId = match?.currentNonStrikerId || '';
    if (!nonStrikerId) return null;

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
    if (!currentInnings || !currentInnings.bowlerStats || currentInnings.bowlerStats.length === 0) return null

    // Find by ID first, fallback to the very last entry in bowlerStats (the person who bowled last)
    const bowlerStats = currentInnings.bowlerStats.find(b => b.bowlerId === currentInnings.currentBowlerId) ||
      currentInnings.bowlerStats[currentInnings.bowlerStats.length - 1]

    if (!bowlerStats) return null
    const ballsBowled = Number((bowlerStats as any).ballsBowled || (bowlerStats as any).balls || 0)
    const overs = `${Math.floor(ballsBowled / 6)}.${ballsBowled % 6}`
    return {
      id: bowlerStats.bowlerId,
      name: bowlerStats.bowlerName,
      photo: playersMap.get(bowlerStats.bowlerId)?.photoUrl || null,
      wickets: bowlerStats.wickets || 0,
      runsConceded: bowlerStats.runsConceded || 0,
      ballsBowled,
      overs,
      economy: bowlerStats.economy || 0,
    }
  }, [currentInnings, playersMap])

  const lastWicket = useMemo(() => {
    if (!currentInnings || !currentInnings.fallOfWickets || currentInnings.fallOfWickets.length === 0) return null

    // Find the latest valid FOW entry (sometimes the very last one might be incomplete during live transition)
    const fows = [...currentInnings.fallOfWickets].reverse()
    const lastFow = fows.find(f => f.batsmanId && f.batsmanId !== 'None') || currentInnings.fallOfWickets[currentInnings.fallOfWickets.length - 1]

    if (!lastFow) return null

    const pStats = currentInnings.batsmanStats?.find(b => b.batsmanId === lastFow.batsmanId)
    const pRegistry = playersMap.get(lastFow.batsmanId)

    // Robust name resolution
    const resolvedName = (
      (pStats?.batsmanName && pStats.batsmanName !== 'None' ? pStats.batsmanName : '') ||
      (lastFow.batsmanName && lastFow.batsmanName !== 'None' ? lastFow.batsmanName : '') ||
      (pRegistry?.name && pRegistry.name !== 'None' ? pRegistry.name : '') ||
      'Batter'
    )

    // Construct a complete object
    return {
      batsmanId: lastFow.batsmanId,
      batsmanName: resolvedName,
      runs: pStats?.runs ?? 0,
      balls: pStats?.balls ?? 0,
      fours: pStats?.fours ?? 0,
      sixes: pStats?.sixes ?? 0,
      dismissal: lastFow.dismissal || pStats?.dismissal || 'Out'
    }
  }, [currentInnings, playersMap])

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

  const computeCenterLabel = (ballDoc: any, innLast: any) => {
    // If we have real-time over balls, prioritize those for the primary label
    if (innLast) {
      const rawValue = String(innLast.value || '').trim()
      const type = String(innLast.type || '').toLowerCase()

      // Basic formatting for common types if they aren't already pretty
      if (type === 'wide') {
        const clean = rawValue.toLowerCase()
        if (clean === 'wd' || clean === '0' || !rawValue) return 'WIDE'
        if (clean.startsWith('wd+')) return `WIDE + ${clean.split('+')[1]}`
        if (/^\d+$/.test(rawValue)) return `WIDE + ${Number(rawValue) - 1}`
        return rawValue.toUpperCase()
      }
      if (type === 'no-ball' || type === 'noball') {
        const clean = rawValue.toLowerCase()
        if (clean === 'nb' || clean === '0' || !rawValue) return 'NO BALL'
        if (clean.startsWith('nb+')) return `NO BALL + ${clean.split('+')[1]}`
        if (/^\d+$/.test(rawValue)) return `NO BALL + ${Number(rawValue) - 1}`
        return rawValue.toUpperCase()
      }
      if (type === 'wicket') {
        // Fallback to prettyWicket only if we can't find a better label
        return rawValue || 'OUT'
      }

      if (!rawValue) return ''
      return rawValue === '·' ? '0' : rawValue
    }

    // Fallback to polling-based ballDoc if no real-time innings ball found
    if (!ballDoc) return ''

    const extras = (ballDoc?.extras || {}) as any
    const type = String(ballDoc?.type || '').toLowerCase()
    const isWide = Number(extras?.wides || 0) > 0 || type === 'wide'
    const isNoBall = Number(extras?.noBalls || 0) > 0 || type === 'no-ball' || type === 'noball'
    const isWicket = Boolean(ballDoc?.wicket)

    if (isWicket) return prettyWicket(String(ballDoc?.wicket?.type || ''))
    if (isWide) {
      const byes = Number(extras?.byes || 0)
      const legByes = Number(extras?.legByes || 0)
      const additionalRuns = byes + legByes
      return additionalRuns > 0 ? `WIDE+${additionalRuns}` : 'WIDE'
    }
    if (isNoBall) {
      const total = Number(ballDoc?.totalRuns || 0)
      const extraRuns = Math.max(0, total - 1)
      return extraRuns > 0 ? `NO BALL + ${extraRuns}` : 'NO BALL'
    }
    const badge = String(ballDoc?.badge || '').trim()
    if (badge) return badge
    const raw = String(ballDoc?.value || '').trim()
    if (!raw) return ''
    if (raw === '·' || raw === '0') return '0'
    return raw
  }

  const [showBoundaryAnim, setShowBoundaryAnim] = useState(false)

  // Center event animation sequence:
  // - no-ball: show "NO BALL (+X)" then switch to "FREE HIT"
  // - otherwise: show immediate label
  useEffect(() => {
    const inn: any = currentInnings

    // 1. Find the "True" last ball for the label
    // If currentOverBalls exists, use it.
    // If we just reached an over boundary (e.g. 1.0) and currentOverBalls is empty/cleared, 
    // we look into the last ball of the last element in recentOvers.

    let innLast = (inn?.currentOverBalls && inn.currentOverBalls.length > 0)
      ? inn.currentOverBalls[inn.currentOverBalls.length - 1]
      : null

    const totalLegalBalls = Number(inn?.legalBalls || 0)
    const isAtOverBoundary = totalLegalBalls > 0 && totalLegalBalls % 6 === 0

    if (!innLast && isAtOverBoundary && inn?.recentOvers?.length > 0) {
      const lastOver = inn.recentOvers[inn.recentOvers.length - 1]
      const ballsInOver = lastOver?.balls || lastOver?.deliveries || []
      if (ballsInOver.length > 0) {
        innLast = ballsInOver[ballsInOver.length - 1]
      }
    }

    const base = computeCenterLabel(lastBallDoc, innLast)

    // 2. Wicket/Boundary flags for animation
    const isWicket = (lastBallDoc?.wicket || (innLast?.wicket && innLast.wicket.isWicket));
    const isWicketLabel = String(base || '').toUpperCase().includes('OUT') || String(base || '').toUpperCase() === 'W' || isWicket;
    const extras = (lastBallDoc?.extras || {}) as any
    const type = String(lastBallDoc?.type || '').toLowerCase()
    const isNoBall = Boolean(lastBallDoc) && (Number(extras?.noBalls || 0) > 0 || type === 'no-ball' || type === 'noball')

    let t1: any = null
    let t2: any = null
    let t3: any = null
    let t4: any = null
    let t5: any = null  // Timer for wicket display
    let intervalId: any = null
    const bump = () => {
      setCenterEventAnim(true)
      t2 = window.setTimeout(() => setCenterEventAnim(false), 260)
    }

    // Clear display after delay, but handle special states like Innings Break or Match Finished
    const wickets = Number(inn?.totalWickets || 0)
    const oversLimit = Number(match?.oversLimit || 20)
    const isAllOut = wickets >= 10
    const isOversFinished = totalLegalBalls >= oversLimit * 6
    const isInningsEnded = isAllOut || isOversFinished

    // Detect if we should show Innings Break or Match Completed
    if (isFinishedMatch) {
      setCenterEventText('MATCH COMPLETED')
    } else if (isInningsEnded) {
      setCenterEventText('INNINGS BREAK')
    } else {
      // Handle wicket display sequence: first show 'WICKET', then after 2 seconds show wicket type
      if (isWicketLabel) {
        const wType = (innLast as any)?.wicketType || base || 'OUT';
        setWicketDisplayText(wType)
        setIsWicketDisplay(true)
        setCenterEventText('WICKET')  // Show 'WICKET' first

        // Trigger the wicket animation
        setAnimationEvent('WICKET')
        setShowAnimation(true)

        // After 2 seconds, show the wicket type in red
        t5 = window.setTimeout(() => {
          setCenterEventText(wType)
          // After another 2 seconds, clear only the animation overlay, keep the event indicator
          const timerId = window.setTimeout(() => {
            setShowAnimation(false) // Clear the animation overlay only
            setShowBoundaryAnim(false)
          }, 2000);
          // Store timerId in a way we can clear it
          (window as any)._wicketClearTimer = timerId;
        }, 2000)
      } else {
        setCenterEventText(base || '')
        setIsWicketDisplay(false)
      }

      // RESET boundary animation state first to avoid carrying over from previous ball
      setShowBoundaryAnim(false)

      // Trigger Boundary Animation for 4/6
      const cleanBase = String(base || '').trim()
      if (cleanBase === '4' || cleanBase === '6') {
        setShowBoundaryAnim(true)
        // Trigger the new full-screen animation
        setAnimationEvent(cleanBase)
        setShowAnimation(true)
        if (t3) window.clearTimeout(t3)
        t3 = window.setTimeout(() => {
          setShowBoundaryAnim(false)
          setShowAnimation(false)
          // Only remove the animation overlay, keep the event indicator
        }, 2000)
      }

      // Check if over is complete by counting legal balls in current over or scoreboard state
      const currentOverBalls = inn?.currentOverBalls || []
      const legalBallsInOver = currentOverBalls.filter((b: any) => {
        const bExtras = b?.extras || {}
        const bType = String(b?.type || '').toLowerCase()
        const isWide = Number(bExtras?.wides || 0) > 0 || bType === 'wide'
        const isNB = Number(bExtras?.noBalls || 0) > 0 || bType === 'no-ball' || bType === 'noball'
        return !isWide && !isNB
      }).length

      if (!isInningsEnded && !isFinishedMatch) {
        const isTrueOverEnd = legalBallsInOver === 6 || (isAtOverBoundary && lastBallDoc?.isLegal);
        if (isTrueOverEnd) {
          if (t4) window.clearTimeout(t4)
          t4 = window.setTimeout(() => {
            setCenterEventText('OVER')
          }, 5000)
        }
      }

    }

    bump()

    if (isNoBall && !isWicketLabel && !isInningsEnded && !isFinishedMatch) {
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
      if (t3) window.clearTimeout(t3)
      if (t4) window.clearTimeout(t4)
      if (t5) window.clearTimeout(t5)  // Clear wicket timer
      if ((window as any)._wicketClearTimer) window.clearTimeout((window as any)._wicketClearTimer)  // Clear wicket clear timer
      if (intervalId) window.clearInterval(intervalId)
    }
  }, [
    lastBallDoc?.id,
    lastBallDoc?.sequence,
    currentInnings?.inningId,
    currentInnings?.legalBalls,
    currentInnings?.totalRuns,
    currentInnings?.totalWickets,
    isFinishedMatch
  ])

  const xiCountA = Number((match as any)?.teamAPlayingXI?.length || 0)
  const xiCountB = Number((match as any)?.teamBPlayingXI?.length || 0)
  const hasAnyXI = xiCountA > 0 || xiCountB > 0
  const { firstSide, secondSide } = useMemo(() => {
    if (!match) return { firstSide: 'teamA' as const, secondSide: 'teamB' as const }

    // Default to Team A batting first if no toss info
    const teamAId = (match as any).teamAId || (match as any).teamASquadId;
    const tossWinnerId = (match as any).tossWinner;
    const decision = ((match as any).tossDecision || (match as any).electedTo || '').toLowerCase(); // 'bat' or 'bowl'

    if (!tossWinnerId || !decision) {
      return { firstSide: 'teamA' as const, secondSide: 'teamB' as const }
    }

    // Determine who won toss: Team A or Team B?
    const isTeamAWinner = tossWinnerId === teamAId;

    // If Team A won and batted -> A first
    // If Team A won and bowled -> B first
    // If Team B won and batted -> B first
    // If Team B won and bowled -> A first

    let batFirstSide: 'teamA' | 'teamB' = 'teamA';

    if (isTeamAWinner) {
      batFirstSide = decision === 'bat' ? 'teamA' : 'teamB';
    } else {
      // Team B won toss
      batFirstSide = decision === 'bat' ? 'teamB' : 'teamA';
    }

    return {
      firstSide: batFirstSide,
      secondSide: batFirstSide === 'teamA' ? 'teamB' : 'teamA'
    }
  }, [match])

  const firstName = firstSide === 'teamA' ? teamAName : teamBName
  const secondName = secondSide === 'teamA' ? teamAName : teamBName

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
  const canUseLiveTab = true // Always available to show countdown/status/result

  const resultSummary = useMemo(() => {
    if ((match as any)?.resultSummary) return (match as any).resultSummary
    return getMatchResultString(teamAName, teamBName, teamAInnings, teamBInnings, match || undefined)
  }, [match, teamAInnings, teamBInnings, teamAName, teamBName])

  // Commentary - lightweight feed used by CrexLiveSection
  useEffect(() => {
    if (!matchId || !match) return

    if (isUpcomingMatch && !isLiveEffective) {
      setCommentary([])
      return
    }

    // Show all commentary for the match (both innings)
    const unsub = subscribeToCommentary(matchId, (entries) => {
      setCommentary(entries)
    })
    return () => unsub()
  }, [matchId, match?.status, isUpcomingMatch, isLiveEffective])

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

      const mapFormItem = (m: any, currentTeamKey: string) => {
        const aName = getMatchDisplayTeam(m, 'A')
        const bName = getMatchDisplayTeam(m, 'B')
        const badge = resultBadge(m, currentTeamKey)
        const scoreA = getScoreText(m, 'A')
        const scoreB = getScoreText(m, 'B')
        const inn = relatedInningsMap.get(m.id)
        let winnerText = '—'
        if (inn?.teamA && inn?.teamB) {
          const aRuns = Number(inn.teamA.totalRuns || 0)
          const bRuns = Number(inn.teamB.totalRuns || 0)
          if (aRuns === bRuns) winnerText = 'Tied'
          else winnerText = (aRuns > bRuns ? aName : bName) + ' won'
        }
        const d = coerceToDate(m?.date)
        const dt = d ? formatDateLabelTZ(d) : ''
        return {
          id: m.id,
          badge,
          teamAName: aName,
          teamBName: bName,
          scoreA,
          scoreB,
          winnerText,
          dt
        }
      }

      return {
        teamAForm: teamAForm.map((m: any) => mapFormItem(m, currentKeyA)),
        teamBForm: teamBForm.map((m: any) => mapFormItem(m, currentKeyB)),
        h2hSummary: { winsA, winsB, total: h2h.length },
        h2hRows: h2h.map((m: any) => {
          const aKey = keyForMatchSide(m, 'A')
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
    // Default to Live for upcoming (shows hero/countdown), Live for active, Summary for finished
    setActiveTab(isFinishedMatch ? 'summary' : 'live')
    didInitTab.current = true
  }, [match, isFinishedMatch, isUpcomingMatch])

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

  // Match tabs (MUST be before early returns) - All tabs in one page
  const matchTabs = useMemo(() => {
    const baseTabs = [
      { id: isFinishedMatch ? 'summary' : 'info', label: isFinishedMatch ? 'Summary' : 'Info' },
      { id: 'commentary', label: 'Commentary' },
      { id: 'live', label: 'Live' },
      { id: 'scorecard', label: 'Scorecard' },
      { id: 'playing-xi', label: 'Playing XI' },
    ]

    // Add Points Table if match has group (groupName or groupId) or tournament has groups
    const hasGroup = Boolean((match as any)?.groupName || (match as any)?.groupId)
    const tournamentHasGroups = Boolean(tournament?.groups && Array.isArray(tournament.groups) && tournament.groups.length > 0)

    if (match?.tournamentId && (hasGroup || tournamentHasGroups)) {
      baseTabs.push({ id: 'points-table', label: 'Points Table' })
    }

    // Add Graphs (maybe only for live/finished?)
    if (isLiveMatch || isFinishedMatch) {
      baseTabs.push({ id: 'graphs', label: 'Graphs' })
    }

    return baseTabs
  }, [match?.tournamentId, isFinishedMatch, isLiveMatch])

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
    const hasGroup = Boolean((match as any)?.groupName || (match as any)?.groupId)

    return (
      <div className="min-h-screen bg-white">
        <div className="w-full lg:max-w-5xl xl:max-w-4xl mx-auto px-2 sm:px-4 py-6 sm:py-8 space-y-8 sm:space-y-12 pb-24">

          {/* Top Hero - Final Premium Balanced Layout */}
          <div className="bg-[#0f172a] rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5 p-4 sm:p-10 text-white relative w-full">

            {/* 1. Status Bar */}
            <div className="flex items-center justify-between gap-2 mb-6 sm:mb-10 border-b border-white/5 pb-4">
              <div className="flex items-center gap-1.5 shrink-0 truncate max-w-[150px] sm:max-w-none">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zM7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 2.88-2.88 7.19-5 9.88C9.92 16.21 7 11.85 7 9z" />
                  <circle cx="12" cy="9" r="2.5" />
                </svg>
                <span className="text-[7px] sm:text-[9px] font-black tracking-[0.2em] text-slate-500 uppercase truncate">
                  {match.venue || 'SMA Ground'}
                </span>
              </div>
              <div className="px-2 py-0.5 sm:px-4 sm:py-1.5 rounded-full bg-white/5 border border-white/10 text-[8px] sm:text-[11px] font-bold text-slate-300 mx-2 truncate">
                {startDate ? formatDateLabelTZ(startDate) : 'Date TBA'} {startTimeText ? ` • ${startTimeText}` : ''}
              </div>
              <div className="px-2 py-0.5 sm:px-3 sm:py-1 rounded bg-black/40 border border-yellow-500/20 text-[7px] sm:text-[8px] font-black text-yellow-500 tracking-widest uppercase shrink-0">
                Upcoming
              </div>
            </div>

            {/* 2. Main Content: Teams (Left) & Countdown (Right) */}
            <div className="flex flex-col sm:flex-row gap-8 sm:gap-12 lg:items-start mb-10">
              {/* Left Column: Teams & Info Cards */}
              <div className="flex-1 w-full space-y-6 sm:space-y-10">
                <div className="space-y-4">
                  {/* Teams with Logos */}
                  <div className="flex flex-row items-center gap-3 sm:gap-8 justify-between sm:justify-start">
                    {/* Team A */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-1 sm:p-2 overflow-hidden shadow-inner shrink-0">
                        {teamASquad?.logoUrl ? <img src={teamASquad.logoUrl} className="w-full h-full object-contain" alt="" /> : <span className="text-[10px] sm:text-lg font-black text-white/10">{teamAName[0]}</span>}
                      </div>
                      <h2 className="text-sm sm:text-2xl lg:text-3xl font-black tracking-tightest uppercase leading-tight text-white mb-0 text-center sm:text-left truncate w-full">
                        {firstName}
                      </h2>
                    </div>

                    <div className="flex flex-col items-center shrink-0">
                      <span className="text-[7px] sm:text-[9px] font-black text-slate-700 mb-0.5 uppercase">VS</span>
                      <div className="w-6 sm:w-10 h-px bg-white/10"></div>
                    </div>

                    {/* Team B */}
                    <div className="flex flex-col-reverse sm:flex-row items-center gap-3 flex-1 min-w-0 sm:justify-end">
                      <h2 className="text-sm sm:text-2xl lg:text-3xl font-black tracking-tightest uppercase leading-tight text-white mb-0 text-center sm:text-right truncate w-full">
                        {secondName}
                      </h2>
                      <div className="w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-1 sm:p-2 overflow-hidden shadow-inner shrink-0">
                        {teamBSquad?.logoUrl ? <img src={teamBSquad.logoUrl} className="w-full h-full object-contain" alt="" /> : <span className="text-[10px] sm:text-lg font-black text-white/10">{secondName[0]}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Sub-cards Row - Directly under Teams */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
                    <div className="bg-white/5 border border-white/5 rounded-xl sm:rounded-2xl p-2 sm:p-4 space-y-0.5 hover:bg-white/10 transition-colors">
                      <div className="text-[6px] sm:text-[7px] font-black text-slate-600 uppercase tracking-widest ">Toss</div>
                      <div className="text-[8px] sm:text-[10px] font-bold text-slate-300 truncate">{(match as any)?.tossWinnerName ? `${(match as any).tossWinnerName} won` : 'Not set'}</div>
                    </div>
                    <div className="bg-white/5 border border-white/5 rounded-xl sm:rounded-2xl p-2 sm:p-4 space-y-0.5 hover:bg-white/10 transition-colors">
                      <div className="text-[6px] sm:text-[7px] font-black text-slate-600 uppercase tracking-widest ">Playing XI</div>
                      <div className="text-[8px] sm:text-[10px] font-bold text-slate-300 truncate">{hasAnyXI ? 'Announced' : 'Not yet'}</div>
                    </div>
                    <div className="bg-white/5 border border-white/5 rounded-xl sm:rounded-2xl p-2 sm:p-4 space-y-0.5 hover:bg-white/10 transition-colors">
                      <div className="text-[6px] sm:text-[7px] font-black text-slate-600 uppercase tracking-widest ">Group</div>
                      <div className="text-[8px] sm:text-[10px] font-bold text-slate-300 truncate">{(match as any)?.groupName || 'Senior S'}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Countdown Panel - Compact blocks */}
              <div className="shrink-0 w-full sm:w-[210px] md:w-[240px] lg:w-[300px] bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 pl-1">
                    <div className="w-1 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Starts In</span>
                  </div>

                  {countdown ? (
                    <div className="flex items-center justify-between gap-1 sm:gap-2">
                      {[
                        { l: 'D', v: countdown.days },
                        { l: 'H', v: countdown.hours },
                        { l: 'M', v: countdown.minutes },
                        { l: 'S', v: countdown.seconds },
                      ].map((x) => (
                        <div key={x.l} className="flex flex-col items-center gap-1 flex-1">
                          <div className="w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16 flex items-center justify-center rounded-lg sm:rounded-xl bg-[#1a2332] border border-white/5 shadow-inner">
                            <span className="text-xs sm:text-xl lg:text-2xl font-black text-white tabular-nums drop-shadow-sm">{String(x.v).padStart(2, '0')}</span>
                          </div>
                          <span className="text-[7px] sm:text-[8px] font-black text-slate-500 uppercase tracking-widest">{x.l}</span>
                        </div>
                      ))}
                    </div>
                  ) : <div className="py-6 text-center text-slate-600 font-bold italic text-[9px]">Checking...</div>}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button onClick={() => setActiveTab('playing-xi')} className={`h-7 sm:h-9 rounded-lg sm:rounded-xl ${hasAnyXI ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-700 hover:bg-slate-600'} text-white font-black text-[7px] sm:text-[8px] uppercase tracking-widest transition-all`}>
                    {hasAnyXI ? 'View XI' : 'Squads'}
                  </button>
                  <button onClick={() => setActiveTab('scorecard')} className="h-7 sm:h-9 rounded-lg sm:rounded-xl bg-[#2a3447] hover:bg-[#344158] border border-white/5 text-white font-black text-[7px] sm:text-[8px] uppercase tracking-widest transition-all">
                    Summary
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Team Form Section (Refactored to match image) */}
          <div className="space-y-4">
            <h3 className="text-[13px] font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide">
              Team form <span className="text-[11px] font-bold text-slate-400 normal-case">(Last 5 matches)</span>
            </h3>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
              {[
                { name: teamAName, form: teamFormAndH2H.teamAForm, logo: teamASquad?.logoUrl },
                { name: teamBName, form: teamFormAndH2H.teamBForm, logo: teamBSquad?.logoUrl },
              ].map((row, idx) => {
                const isExpanded = expandedTeamIdx === idx
                return (
                  <div key={idx} className="space-y-0">
                    <div
                      onClick={() => setExpandedTeamIdx(isExpanded ? null : idx)}
                      className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50/50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-white border border-slate-100 flex items-center justify-center p-1.5 overflow-hidden shrink-0 shadow-sm">
                          {row.logo ? <img src={row.logo} className="w-full h-full object-contain" alt="" /> : <span className="text-lg font-black text-slate-200">{row.name[0]}</span>}
                        </div>
                        <span className="text-xs sm:text-sm font-black text-slate-800 uppercase truncate tracking-tight">{row.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-hide">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[6px] bg-slate-50 border border-slate-200/50 flex items-center justify-center text-[9px] font-bold text-slate-300">*</div>
                        {(row.form.length ? row.form : Array.from({ length: 5 }).map((_, i) => ({ id: String(i), badge: '*' as const }))).slice(0, 5).map((f: any, i) => (
                          <div
                            key={i}
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-[6px] flex items-center justify-center font-black text-[10px] sm:text-xs shadow-sm ${f.badge === 'W' ? 'bg-[#51b163] text-white' :
                              f.badge === 'L' ? 'bg-[#f76a6a] text-white' :
                                'bg-slate-100 text-slate-400 border border-slate-200/50'
                              }`}
                          >
                            {f.badge === '*' ? '—' : f.badge}
                          </div>
                        ))}
                        <div className={`w-6 h-6 flex items-center justify-center text-slate-300 ml-1 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-blue-500' : ''}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </div>
                    </div>

                    {isExpanded && row.form.filter((f: any) => f.badge !== '*').length > 0 && (
                      <div className="bg-slate-50/70 border-t border-slate-100 p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        {row.form.filter((f: any) => f.badge !== '*').map((f: any) => (
                          <div key={f.id} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-slate-50/50 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{f.dt}</span>
                              <span className="text-[9px] font-black text-slate-300 tracking-tighter italic">Match Summary</span>
                            </div>
                            <div className="p-4 flex items-center justify-between gap-4">
                              <div className="flex-1 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-md bg-white border border-slate-100 flex items-center justify-center p-1 shadow-sm font-black text-[10px] text-slate-200">{f.teamAName[0]}</div>
                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate max-w-[100px]">{f.teamAName}</span>
                                  </div>
                                  <span className="text-xs font-black text-slate-800 tabular-nums">{f.scoreA}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-md bg-white border border-slate-100 flex items-center justify-center p-1 shadow-sm font-black text-[10px] text-slate-200">{f.teamBName[0]}</div>
                                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate max-w-[100px]">{f.teamBName}</span>
                                  </div>
                                  <span className="text-xs font-black text-slate-800 tabular-nums">{f.scoreB}</span>
                                </div>
                              </div>
                              <div className="w-px h-12 bg-slate-100 mx-1"></div>
                              <div className="text-right min-w-[100px] space-y-0.5">
                                <div className={`text-[11px] font-black leading-tight ${f.badge === 'W' ? 'text-emerald-600' : f.badge === 'L' ? 'text-rose-600' : 'text-slate-500'}`}>
                                  {f.winnerText}
                                </div>
                                <div className="text-[9px] font-bold text-slate-300 italic">Match Details</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="text-[10px] font-bold text-slate-400 italic pl-1">* Upcoming Matches</div>
          </div>

          {/* Head to Head Section (Refactored to match image) */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wide">
                Head to Head <span className="text-[11px] font-bold text-slate-400 normal-case">(Last 10 matches)</span>
              </h3>
              <button onClick={() => setActiveTab('scorecard')} className="text-[12px] font-black text-blue-600 tracking-tight hover:underline">All Matches</button>
            </div>

            <div className="flex items-center justify-center gap-12 sm:gap-24 py-4">
              <div className="text-center space-y-3">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden mx-auto shadow-sm p-4">
                  {teamASquad?.logoUrl ? <img src={teamASquad.logoUrl} className="w-full h-full object-contain" alt="" /> : <span className="text-4xl italic font-black text-slate-100">{teamAName[0]}</span>}
                </div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{teamAName}</div>
              </div>

              <div className="text-5xl sm:text-7xl font-black flex items-center gap-8 tabular-nums">
                <span className="text-rose-900/10 transition-colors hover:text-rose-800 tracking-tighter">{teamFormAndH2H.h2hSummary.winsA}</span>
                <span className="text-slate-100 text-3xl mb-4">—</span>
                <span className="text-blue-900/10 transition-colors hover:text-blue-800 tracking-tighter">{teamFormAndH2H.h2hSummary.winsB}</span>
              </div>

              <div className="text-center space-y-3">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden mx-auto shadow-sm p-4">
                  {teamBSquad?.logoUrl ? <img src={teamBSquad.logoUrl} className="w-full h-full object-contain" alt="" /> : <span className="text-4xl italic font-black text-slate-100">{teamBName[0]}</span>}
                </div>
                <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{teamBName}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teamFormAndH2H.h2hRows.slice(0, 4).map((r) => (
                <div key={r.id} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="bg-slate-50/50 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{r.dt}</span>
                    <span className="text-[9px] font-black text-slate-300 tracking-tighter italic">Match Summary</span>
                  </div>
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-white border border-slate-100 flex items-center justify-center p-1 shadow-sm">
                            <span className="text-[10px] font-black text-slate-200">{r.leftName[0]}</span>
                          </div>
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate max-w-[80px]">{r.leftName}</span>
                        </div>
                        <span className="text-xs font-black text-slate-800 tabular-nums">{r.leftScore}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-md bg-white border border-slate-100 flex items-center justify-center p-1 shadow-sm">
                            <span className="text-[10px] font-black text-slate-200">{r.rightName[0]}</span>
                          </div>
                          <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight truncate max-w-[80px]">{r.rightName}</span>
                        </div>
                        <span className="text-xs font-black text-slate-800 tabular-nums">{r.rightScore}</span>
                      </div>
                    </div>

                    <div className="w-px h-12 bg-slate-100 mx-2"></div>

                    <div className="text-right min-w-[80px] space-y-0.5">
                      <div className={`text-[11px] font-black leading-tight ${r.winnerText.includes('Tied') ? 'text-slate-500' : r.winnerText.includes(firstName) ? 'text-rose-600' : 'text-blue-600'}`}>
                        {r.winnerText.replace(' Won', ' won')}
                      </div>
                      <div className="text-[9px] font-bold text-slate-300 italic">Match Details</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Points Table Context (If Grouped) */}
          {hasGroup && match?.tournamentId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  {firstName} vs {secondName} <br />
                  <span className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest">Points Table Standing</span>
                </h3>
                <button onClick={() => setActiveTab('points-table')} className="text-[9px] sm:text-[10px] font-black text-blue-600 uppercase tracking-[0.15em] px-3 py-1.5 border border-blue-50 bg-blue-50/10 rounded-lg hover:bg-blue-50 transition-colors">View Table</button>
              </div>

              <div className="border border-slate-100 rounded-2xl sm:rounded-[2rem] overflow-hidden shadow-sm shadow-slate-50 bg-white">
                <TournamentPointsTable
                  embedded={true}
                  tournamentId={match.tournamentId}
                  hideQualification={true}
                  filterSquadIds={[
                    String(resolveMatchSideRef(match as any, 'A') || ''),
                    String(resolveMatchSideRef(match as any, 'B') || '')
                  ].filter(Boolean)}
                />
              </div>
            </div>
          )}

        </div>
      </div >
    )
  }

  // Render content based on active tab - All inline, no navigation
  const renderTabContent = () => {
    switch (activeTab) {
      case 'commentary':
        return (
          <div className="bg-gray-50 min-h-screen">
            <CrexLiveSection
              match={match as any}
              striker={striker as any}
              nonStriker={nonStriker as any}
              currentBowler={bowler as any}
              partnership={(currentInnings as any)?.partnership}
              lastWicket={lastWicket}
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
              teamAInnings={teamAInnings}
              teamBInnings={teamBInnings}
              firstSide={firstSide}
              secondSide={secondSide}
              resultSummary={isFinishedMatch ? (resultSummary || null) : null}
              onlyCommentary={true} // New prop to only show commentary
            />
          </div>
        )
      case 'scorecard':
        return <MatchScorecard compact={true} />
      case 'graphs':
        return <MatchGraphs compact={true} />
      case 'playing-xi':
        return <MatchPlayingXI compact={true} />
      case 'info':
        return <MatchInfo compact={true} onSwitchTab={setActiveTab} />
      case 'summary':
        // Upcoming matches show the upcoming design on summary tab
        if (isUpcomingMatch) return renderUpcoming()
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
      case 'points-table':
        return match?.tournamentId ? (
          <div className="bg-gray-50 min-h-screen py-6">
            <TournamentPointsTable embedded={true} tournamentId={match.tournamentId} />
          </div>
        ) : null
      default:
      case 'live':
        if (isUpcomingMatch && !isPastStart) return renderUpcoming()
        return (
          <div className="bg-gray-50 min-h-screen">
            <CrexLiveSection
              match={match as any}
              striker={striker as any}
              nonStriker={nonStriker as any}
              currentBowler={bowler as any}
              partnership={(currentInnings as any)?.partnership}
              lastWicket={lastWicket}
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
              currentInnings={currentInnings}
              currentWickets={(currentInnings as any)?.totalWickets || 0}
              teamAName={teamAName}
              teamBName={teamBName}
              teamAInnings={teamAInnings}
              teamBInnings={teamBInnings}
              teamASquad={teamASquad}
              teamBSquad={teamBSquad}
              firstSide={firstSide}
              secondSide={secondSide}
              resultSummary={isFinishedMatch ? (resultSummary || null) : null}
            />
          </div>
        )
    }
  }

  // --- Swipe Navigation Logic ---
  const currentTabIndex = matchTabs.findIndex(t => t.id === activeTab)
  const handleSwipe = (direction: 'left' | 'right') => {
    if (direction === 'left' && currentTabIndex < matchTabs.length - 1) {
      const nextTab = matchTabs[currentTabIndex + 1]
      if (!nextTab.disabled) setActiveTab(nextTab.id)
    } else if (direction === 'right' && currentTabIndex > 0) {
      const prevTab = matchTabs[currentTabIndex - 1]
      if (!prevTab.disabled) setActiveTab(prevTab.id)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 1. Match Title Bar (Back + Info) - Scrollable */}
      {!isUpcomingMatch && (
        <div className="bg-[#0f172a] text-white py-3 px-4 flex items-center justify-between border-b border-white/5 shadow-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1 hover:bg-white/10 rounded-full transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex flex-col">
              <h1 className="text-sm font-semibold uppercase tracking-tight">
                {teamAName} vs {teamBName}
              </h1>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                {match.matchNo || 'T20 Match'} • {tournament?.name || 'Senior School League'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            {matchId && (
              <NotificationBell
                matchId={matchId}
                matchTitle={`${teamAName} vs ${teamBName}`}
                color="text-slate-300 hover:text-white hover:bg-white/10"
              />
            )}
          </div>
        </div>
      )}

      {/* 2. Sticky Match Tabs (Sticks to Top of Screen) */}
      <MatchTabs
        tabs={matchTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        stickyTop="0px"
      />

      {/* 3. Sticky Scoreboard (Below Tabs) - Global for all tabs */}
      {(!isUpcomingMatch || (match as any).tossWinner) && (
        <div className="sticky z-40 transition-all duration-300" style={{ top: '48px' }}>
          <MatchLiveHero
            match={match}
            teamAName={teamAName}
            teamBName={teamBName}
            teamASquad={teamASquad}
            teamBSquad={teamBSquad}
            currentInnings={currentInnings}
            teamAInnings={teamAInnings}
            teamBInnings={teamBInnings}
            isFinishedMatch={isFinishedMatch}
            resultSummary={resultSummary}
            centerEventText={centerEventText || '—'}
            showBoundaryAnim={showBoundaryAnim}
            ballAnimating={ballAnimating}
            ballEventType={ballEventType}
            lastBall={null}
            recentOvers={(currentInnings as any)?.recentOvers || []}
            animationEvent={animationEvent}
            showAnimation={showAnimation}
            onAnimationClose={() => setShowAnimation(false)}
            setBallAnimating={setBallAnimating}
            setBallEventType={setBallEventType}
          />
        </div>
      )}

      {/* 4. Tab Content with Swipe Animations */}
      <div className="relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              const swipeThreshold = 50
              if (info.offset.x < -swipeThreshold) handleSwipe('left')
              if (info.offset.x > swipeThreshold) handleSwipe('right')
            }}
            className="w-full touch-pan-y"
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
