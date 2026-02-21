/**
 * Live Match Page
 * Screenshot-based design with tabs, dark blue header, tables
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams } from 'react-router-dom'
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
import MatchLiveHero from '@/components/live/MatchLiveHero'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import PageHeader from '@/components/common/PageHeader'
// Import all match page components to render inline
import MatchScorecard from '@/pages/MatchScorecard'
import MatchPlayingXI from '@/pages/MatchPlayingXI'
import MatchGraphs from '@/pages/MatchGraphs'
import MatchInfo from '@/pages/MatchInfo'
import MatchSummary from '@/components/match/MatchSummary'
import { MatchSettingsSheet } from '@/components/match/MatchSettingsSheet'
import TournamentPointsTable from '@/pages/TournamentPointsTable'
import { MapPin, Info, Users, Hash, ChevronDown, Pin, LayoutDashboard } from 'lucide-react'
import { coerceToDate, formatDateLabelTZ, formatTimeHMTo12h, formatTimeLabelBD } from '@/utils/date'

import { useTranslation } from '@/hooks/useTranslation'

export default function MatchLive() {
  const { matchId } = useParams<{ matchId: string }>()
  const { user } = useAuthStore()
  const { t } = useTranslation()
  const [match, setMatch] = useState<Match | null>(null)
  const [currentInnings, setCurrentInnings] = useState<InningsStats | null>(null)
  const [teamAInnings, setTeamAInnings] = useState<InningsStats | null>(null)
  const [teamBInnings, setTeamBInnings] = useState<InningsStats | null>(null)
  const [teamASuperInnings, setTeamASuperInnings] = useState<InningsStats | null>(null)
  const [teamBSuperInnings, setTeamBSuperInnings] = useState<InningsStats | null>(null)
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
  const [isWicketDisplay, setIsWicketDisplay] = useState<boolean>(false)
  const [ballAnimating, setBallAnimating] = useState(false)
  const [ballEventType, setBallEventType] = useState<'4' | '6' | 'wicket' | 'normal'>('normal')
  const [animationEvent, setAnimationEvent] = useState<string>('')
  const [showAnimation, setShowAnimation] = useState<boolean>(false)
  const [displayedInnings, setDisplayedInnings] = useState<InningsStats | null>(null)
  const [isPinned, setIsPinned] = useState(false)
  const prevBallKeyRef = useRef<string | null>(null)
  const isAnimatingRef = useRef(false)
  const scoreTimerRef = useRef<any>(null)

  useEffect(() => {
    const pinnedId = localStorage.getItem('pinnedMatchId')
    setIsPinned(pinnedId === matchId)
  }, [matchId])

  const togglePin = () => {
    if (isPinned) {
      localStorage.removeItem('pinnedMatchId')
      setIsPinned(false)
    } else {
      localStorage.setItem('pinnedMatchId', matchId || '')
      localStorage.setItem('pinnedMatchTitle', `${teamAName} vs ${teamBName}`)
      setIsPinned(true)
    }
    window.dispatchEvent(new Event('matchPinned'))
  }

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Provide global functions for child components to interact with the parent
  useEffect(() => {
    (window as any).openMatchSettings = () => setIsSettingsOpen(true);
    (window as any).setActiveTab = (tabId: string) => setActiveTab(tabId);
    return () => {
      delete (window as any).openMatchSettings;
      delete (window as any).setActiveTab;
    }
  }, [matchId]) // Re-bind if match changes

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

    const unsubASO = matchService.subscribeToInnings(matchId, 'teamA_super', (innings) => {
      if (innings) setTeamASuperInnings(innings)
    })

    const unsubBSO = matchService.subscribeToInnings(matchId, 'teamB_super', (innings) => {
      if (innings) setTeamBSuperInnings(innings)
    })

    return () => {
      unsubA()
      unsubB()
      unsubASO()
      unsubBSO()
    }
  }, [matchId])

  // Subscribe to Commentary
  useEffect(() => {
    if (!matchId) return

    const unsub = subscribeToCommentary(matchId, (data) => {
      setCommentary(data)
    })
    return () => unsub()
  }, [matchId])

  // Set current innings based on match status
  useEffect(() => {
    if (!match) return
    const cb = match.currentBatting || 'teamA'
    if (cb === 'teamA') setCurrentInnings(teamAInnings)
    else if (cb === 'teamB') setCurrentInnings(teamBInnings)
    else if (cb === 'teamA_super') setCurrentInnings(teamASuperInnings)
    else if (cb === 'teamB_super') setCurrentInnings(teamBSuperInnings)
    else setCurrentInnings(teamAInnings)
  }, [match, teamAInnings, teamBInnings, teamASuperInnings, teamBSuperInnings])

  // Synchronize displayedInnings initially only once when match loads
  useEffect(() => {
    if (currentInnings && !displayedInnings) {
      setDisplayedInnings(currentInnings)
      prevBallKeyRef.current = `${currentInnings.legalBalls || 0}_${currentInnings.totalRuns || 0}_${currentInnings.totalWickets || 0}`;
    }
  }, [currentInnings, displayedInnings])

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

    const batsman = (displayedInnings || currentInnings)?.batsmanStats?.find((b) => b.batsmanId === strikerId)
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
  }, [displayedInnings, currentInnings, match, playersMap])

  const nonStriker = useMemo(() => {
    const nonStrikerId = match?.currentNonStrikerId || '';
    if (!nonStrikerId) return null;

    const batsman = (displayedInnings || currentInnings)?.batsmanStats?.find((b) => b.batsmanId === nonStrikerId)
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
  }, [displayedInnings, currentInnings, match, playersMap])

  const bowler = useMemo(() => {
    const inn = displayedInnings || currentInnings;
    if (!inn || !inn.bowlerStats || inn.bowlerStats.length === 0) return null

    // Find by ID first, fallback to the very last entry in bowlerStats (the person who bowled last)
    const bowlerStats = inn.bowlerStats.find(b => b.bowlerId === inn.currentBowlerId) ||
      inn.bowlerStats[inn.bowlerStats.length - 1]

    if (!bowlerStats) return null
    const ballsBowled = Number((bowlerStats as any).ballsBowled || (bowlerStats as any).balls || 0)
    const overs = `${Math.floor(ballsBowled / 6)}.${ballsBowled % 6}`
    return {
      id: bowlerStats.bowlerId,
      name: bowlerStats.bowlerName,
      bowlerId: bowlerStats.bowlerId,
      bowlerName: bowlerStats.bowlerName,
      photo: playersMap.get(bowlerStats.bowlerId)?.photoUrl || null,
      wickets: bowlerStats.wickets || 0,
      runsConceded: bowlerStats.runsConceded || 0,
      ballsBowled,
      overs,
      economy: bowlerStats.economy || 0,
    }
  }, [displayedInnings, currentInnings, playersMap])

  const lastWicket = useMemo(() => {
    const inn = displayedInnings || currentInnings;
    if (!inn || !inn.fallOfWickets || inn.fallOfWickets.length === 0) return null

    // Find the latest valid FOW entry (sometimes the very last one might be incomplete during live transition)
    const fows = [...inn.fallOfWickets].reverse()
    const lastFow = fows.find(f => f.batsmanId && f.batsmanId !== 'None') || inn.fallOfWickets[inn.fallOfWickets.length - 1]

    if (!lastFow) return null

    const pStats = inn.batsmanStats?.find(b => b.batsmanId === lastFow.batsmanId)
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
    if (k === 'run-out') return 'RUN OUT!!'
    if (k === 'runout') return 'RUN OUT!!'
    if (k === 'bowled') return 'BOWLED!!'
    if (k === 'caught') return 'CAUGHT!!'
    if (k === 'lbw') return 'LBW!!'
    if (k === 'hit-wicket') return 'HIT WICKET!!'
    if (k === 'stumped') return 'STUMPED!!'
    if (k === 'obstructing-field') return 'OBSTRUCT!!'
    return `${k.toUpperCase()}!!`
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
      // Logic for bump removed as centerEventAnim is unused
    }

    // Clear display after delay, but handle special states like Innings Break or Match Finished
    const wickets = Number(inn?.totalWickets || 0)
    const oversLimit = Number(match?.oversLimit || 20)
    const isAllOut = wickets >= 10
    const isOversFinished = totalLegalBalls >= oversLimit * 6
    const isInningsEnded = isAllOut || isOversFinished

    const performUpdate = () => {
      // Detect if we should show Innings Break or Match Completed
      if (isFinishedMatch) {
        setCenterEventText('MATCH COMPLETED')
      } else if (isInningsEnded) {
        const isTied = (match as any)?.matchPhase === 'Tied';
        if (isTied) {
          setCenterEventText('WAITING FOR SUPER OVER')
        } else {
          setCenterEventText('INNINGS BREAK')
        }
      } else {
        // Handle wicket display sequence: first show 'WICKET', then after 2 seconds show wicket type
        if (isWicketLabel) {
          const wType = (innLast as any)?.wicketType || base || 'OUT';
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
            }, 5000) // Increase delay to let boundary/wicket anims finish
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
    };

    const activeBallKey = `${inn?.legalBalls || 0}_${inn?.totalRuns || 0}_${inn?.totalWickets || 0}`;
    const isBallChanged = prevBallKeyRef.current !== null && prevBallKeyRef.current !== activeBallKey && !isFinishedMatch && !isInningsEnded;

    // Only trigger new ball logic if not already animating or it's a truly different ball
    if (isBallChanged && !isAnimatingRef.current) {
      prevBallKeyRef.current = activeBallKey;
      isAnimatingRef.current = true;
      setCenterEventText('BALL');
      setBallAnimating(true);

      t1 = window.setTimeout(() => {
        performUpdate();

        const cleanBase = String(base || '').trim();
        const isBigEvent = isWicketLabel || cleanBase === '4' || cleanBase === '6';
        const scoreboardDelay = isBigEvent ? 4500 : 3000;

        if (scoreTimerRef.current) window.clearTimeout(scoreTimerRef.current);
        scoreTimerRef.current = window.setTimeout(() => {
          setDisplayedInnings(inn);
          isAnimatingRef.current = false;
          setBallAnimating(false);
          scoreTimerRef.current = null;
        }, scoreboardDelay);
      }, 1500);
    } else if (!isAnimatingRef.current && !scoreTimerRef.current) {
      // Regular update (score correction, etc.) - only if no animation is blocking
      prevBallKeyRef.current = activeBallKey;
      performUpdate();
      setDisplayedInnings(inn);
    }

    return () => {
      if (t1) window.clearTimeout(t1)
      if (t2) window.clearTimeout(t2)
      if (t3) window.clearTimeout(t3)
      if (t4) window.clearTimeout(t4)
      if (t5) window.clearTimeout(t5)  // Clear wicket timer
      if ((window as any)._wicketClearTimer) window.clearTimeout((window as any)._wicketClearTimer)  // Clear wicket clear timer
      if ((window as any)._scoreUpdateTimer) window.clearTimeout((window as any)._scoreUpdateTimer)  // Clear score update timer
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
  }, [match, teamAName, teamBName])

  const tossDisplay = useMemo(() => {
    if (!match) return null;
    const tw = (match as any)?.tossWinner;
    if (!tw) return null;

    const tAId = String((match as any)?.teamAId || (match as any)?.teamASquadId || (match as any)?.teamA || '').trim().toLowerCase();
    const tBId = String((match as any)?.teamBId || (match as any)?.teamBSquadId || (match as any)?.teamB || '').trim().toLowerCase();
    const twid = String(tw || '').trim().toLowerCase();

    const winnerName = (twid === 'teama' || (tAId && twid === tAId)) ? teamAName : (twid === 'teamb' || (tBId && twid === tBId)) ? teamBName : (tw || 'Team');
    const decision = (match.electedTo || (match as any).tossDecision || 'bat').toLowerCase();
    return { winnerName, decision };
  }, [match, teamAName, teamBName])

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

  const resultSummary = useMemo(() => {
    if ((match as any)?.resultSummary) return (match as any).resultSummary
    return getMatchResultString(teamAName, teamBName, teamAInnings, teamBInnings, match || undefined, teamASuperInnings, teamBSuperInnings)
  }, [match, teamAInnings, teamBInnings, teamASuperInnings, teamBSuperInnings, teamAName, teamBName])

  // Centralized Target & Chase Info for Win Probability
  const chaseInfo = useMemo(() => {
    const isMainSecondInn = (match as any)?.matchPhase === 'SecondInnings' || (match as any)?.matchPhase === 'InningsBreak' || isFinishedMatch;
    const isSO = (match as any)?.matchPhase === 'superover' || (match as any)?.isSuperOver;

    // In Super Over, we are in "second innings" mode if the current innings is the second one chronologically
    const isSOSecondInn = isSO && currentInnings?.inningId?.includes('super') && (
      (firstSide === 'teamA' && currentInnings.inningId === 'teamA_super') ||
      (firstSide === 'teamB' && currentInnings.inningId === 'teamB_super')
    );
    // Note: In Super Over, the order is reversed. If Team A batted first in main match, Team B bats first in SO.
    // So if current is "teamA_super" and Team A was firstSide, then it IS the second SO innings.

    const isSecondInn = isMainSecondInn || isSOSecondInn;

    let targetVal = Number((currentInnings as any)?.target || 0);

    if (!targetVal && isSecondInn) {
      if (isSOSecondInn) {
        // Target for SO second innings comes from SO first innings
        const soFirstInn = firstSide === 'teamA' ? teamBSuperInnings : teamASuperInnings;
        if (soFirstInn && Number(soFirstInn.totalRuns || 0) > 0) {
          targetVal = Number(soFirstInn.totalRuns) + 1;
        }
      } else {
        // Fallback: Check match master doc
        const mTarget = Number((match as any)?.target || 0);
        const mInn1 = Number((match as any)?.innings1Score || 0);
        const mScore1 = Number((match as any)?.score?.[firstSide]?.runs || 0);

        targetVal = mTarget || (mInn1 > 0 ? mInn1 + 1 : (mScore1 > 0 ? mScore1 + 1 : 0));

        // Secondary Fallback: Check opponent innings runs directly from state
        if (!targetVal) {
          const firstInn = firstSide === 'teamA' ? teamAInnings : teamBInnings;
          if (firstInn && Number(firstInn.totalRuns || 0) > 0) {
            targetVal = Number(firstInn.totalRuns) + 1;
          }
        }
      }
    }

    const runsDone = Number((currentInnings as any)?.totalRuns || 0);
    const runsNeeded = targetVal > 0 ? Math.max(0, targetVal - runsDone) : null;

    return { target: targetVal || null, runsNeeded };
  }, [match, currentInnings, teamAInnings, teamBInnings, teamASuperInnings, teamBSuperInnings, firstSide, isFinishedMatch]);

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

  // Load recent matches for Team Form + Head-to-Head
  useEffect(() => {
    const run = async () => {
      if (!match) return
      if (!currentKeyA || !currentKeyB) return
      setRelatedLoading(true)
      try {
        const tid = String((match as any).tournamentId || '').trim()

        // Defer this heavy operation to avoid blocking UI interaction
        setTimeout(async () => {
          try {
            let ms = tid ? await matchService.getByTournament(tid) : await matchService.getAll()

            // Fallback: If tournament specific fetch yields very few matches, try fetching all matches
            // This ensures we find cross-tournament history if available
            if (ms.length < 5 && tid) {
              const allMs = await matchService.getAll()
              // Deduplicate just in case
              const existingIds = new Set(ms.map(m => m.id))
              const newMatches = allMs.filter(m => !existingIds.has(m.id))
              ms = [...ms, ...newMatches]
            }

            const others = ms.filter((m) => m.id !== match.id)

            const withKeys = others.map((m: any) => {
              const aName = String(m.teamAName || m.teamA || m.teamAId || '').trim()
              const bName = String(m.teamBName || m.teamB || m.teamBId || '').trim()
              const aKey = teamKeyFor(resolveMatchSideRef(m, 'A'), aName)
              const bKey = teamKeyFor(resolveMatchSideRef(m, 'B'), bName)

              // DEBUG: Log if this match involves Team B but key doesn't match
              if (bName.includes('Elite') || bName.includes('Eagle')) {
                // console.log(`[MatchLive] DEBUG MATCH ${m.id} vs Team B KEY:`, { bName, bKey, currentKeyB, match: bKey === currentKeyB })
              }

              return { m, aKey, bKey }
            }).filter((x) => x.aKey && x.bKey)



            // Robust matching function taking key AND name into account
            const normalizeTeamName = (name: string): string => {
              return name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-')
            }

            const isSameTeam = (matchKey: string, matchTeamName: string, targetKey: string) => {
              if (matchKey === targetKey) return true

              // Fallback: If keys don't match (e.g. one is ID, one is Name), try name matching
              // Only do this if one of them is a 'name:' key or purely fallback
              if (targetKey.startsWith('name:') || matchKey.startsWith('name:')) {
                const tNameRaw = targetKey.replace('name:', '').replace('id:', '')
                const mNameRaw = matchKey.replace('name:', '').replace('id:', '') // fallback if key was used
                const realMName = matchTeamName || mNameRaw

                // Normalized comparison with better normalization
                const n1 = normalizeTeamName(tNameRaw)
                const n2 = normalizeTeamName(realMName)

                // Exact match
                if (n1 === n2) return true

                // Partial match for longer names
                if (n1.length > 3 && n2.includes(n1)) return true
                if (n2.length > 3 && n1.includes(n2)) return true

                // Try matching without numbers/suffixes
                const n1Base = n1.replace(/\s*-\s*\d+$/, '').replace(/\d+$/, '').trim()
                const n2Base = n2.replace(/\s*-\s*\d+$/, '').replace(/\d+$/, '').trim()
                if (n1Base.length > 3 && n2Base.length > 3 && (n1Base === n2Base || n1Base.includes(n2Base) || n2Base.includes(n1Base))) {
                  return true
                }
              }
              return false
            }

            const involves = (x: any, targetKey: string) => {
              // Extract names from match object x.m
              const aName = String(x.m.teamAName || x.m.teamA || '').trim()
              const bName = String(x.m.teamBName || x.m.teamB || '').trim()

              return isSameTeam(x.aKey, aName, targetKey) || isSameTeam(x.bKey, bName, targetKey)
            }

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

            // OPTIMIZATION: Dropped the heavy innings fetch. 
            // Logic in downstream components should rely on match.score for results.
            setRelatedLoading(false)
          } catch (e) {
            console.warn('[MatchLive] Failed to load related matches:', e)
            setRelatedLoading(false)
          }
        }, 1500) // Delay by 1.5s to prioritize main content load
      } catch (e) {
        console.warn('[MatchLive] Failed to initialize related matches:', e)
        setRelatedLoading(false)
      }
    }
    run()
  }, [match?.id, (match as any)?.tournamentId, currentKeyA, currentKeyB])

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
      // Filter only completed/finished matches
      const completedMatches = related.filter((m: any) => {
        const status = String(m.status || '').toLowerCase()
        const isFinishedStatus = status === 'finished' || status === 'completed' || status === 'result' || status === 'abandoned'

        // Also check if match has scores and a result, even if status tag is missing
        const hasScores = (m.score?.teamA?.runs !== undefined && m.score?.teamB?.runs !== undefined) ||
          (relatedInningsMap.get(m.id)?.teamA && relatedInningsMap.get(m.id)?.teamB)
        const hasWinner = Boolean(m.winner || m.winningTeam || m.winnerId || m.resultSummary)

        return isFinishedStatus || (hasScores && hasWinner)
      })



      const resultBadge = (m: any, teamKey: string): 'W' | 'L' | 'T' | '*' => {
        const m2 = m as any;
        const winnerId = m2.winnerId || m2.winnerSquadId;
        const winnerTextRaw = m2.winnerName || m2.winner || m2.winningTeam || m2.winnerSquadName || '';
        const winnerNorm = String(winnerTextRaw).toLowerCase().trim();
        const resultSummary = String(m2.resultSummary || '').toLowerCase();

        const isTie = winnerNorm === 'tie' || winnerNorm === 'draw' || winnerId === 'Tie' || winnerId === 'Draw' ||
          m2.status?.toLowerCase() === 'abandoned' || resultSummary.includes('no result') || resultSummary.includes('abandoned');

        // 1. Explicit winner fields
        const isMeWinner = (winnerId && (teamKey.includes(winnerId) || winnerId.includes(teamKey))) ||
          (winnerNorm && teamKey.toLowerCase().includes(winnerNorm));

        if (isMeWinner) return 'W';
        if (isTie) return 'T';

        // If some other winner is set, it's a loss for me
        if (winnerId && winnerId !== 'Tie') return 'L';
        if (winnerNorm && !['tie', 'draw', 'pending'].includes(winnerNorm)) return 'L';

        // 2. Score Fallback
        const sA = m.score?.teamA
        const sB = m.score?.teamB
        const soA = m.score?.teamA_super
        const soB = m.score?.teamB_super
        const inn = relatedInningsMap.get(m.id)

        let aRuns = 0, bRuns = 0, soARuns = 0, soBRuns = 0;
        let hasData = false;

        if (sA && sB) {
          aRuns = Number(sA.runs || 0);
          bRuns = Number(sB.runs || 0);
          soARuns = Number(soA?.runs || 0);
          soBRuns = Number(soB?.runs || 0);
          hasData = true;
        } else if (inn?.teamA && inn?.teamB) {
          aRuns = Number(inn.teamA.totalRuns || 0);
          bRuns = Number(inn.teamB.totalRuns || 0);
          soARuns = Number(inn.aso?.totalRuns || 0);
          soBRuns = Number(inn.bso?.totalRuns || 0);
          hasData = true;
        }

        if (!hasData) return '*';

        const aKey = keyForMatchSide(m, 'A');
        const bKey = keyForMatchSide(m, 'B');
        const teamIsA = aKey === teamKey;
        const teamIsB = bKey === teamKey;
        if (!teamIsA && !teamIsB) return '*';

        let teamAWon = false;
        let isActuallyTie = false;

        if (aRuns > bRuns) teamAWon = true;
        else if (bRuns > aRuns) teamAWon = false;
        else if (soARuns > soBRuns) teamAWon = true;
        else if (soBRuns > soARuns) teamAWon = false;
        else isActuallyTie = true;

        if (isActuallyTie) return 'T';
        const winForMe = teamIsA ? teamAWon : !teamAWon;
        return winForMe ? 'W' : 'L';
      }

      const getScoreText = (m: any, side: 'A' | 'B') => {
        const s = side === 'A' ? m.score?.teamA : m.score?.teamB
        if (s) {
          const r = Number(s.runs || 0)
          const w = Number(s.wickets || 0)
          const o = String(s.overs || '').trim()
          return `${r}/${w}${o ? `  ${o}` : ''}`
        }

        const inn = relatedInningsMap.get(m.id)
        const data = side === 'A' ? inn?.teamA : inn?.teamB
        if (!data) return '—'
        const r = Number(data.totalRuns || 0)
        const w = Number(data.totalWickets || 0)
        const o = String(data.overs || '').trim()
        return `${r}/${w}${o ? `  ${o}` : ''}`
      }

      const teamAForm = completedMatches.filter((m: any) => {
        const aKey = keyForMatchSide(m, 'A')
        const bKey = keyForMatchSide(m, 'B')
        return aKey === currentKeyA || bKey === currentKeyA
      }).slice(0, 5)
      const teamBForm = completedMatches.filter((m: any) => {
        const aKey = keyForMatchSide(m, 'A')
        const bKey = keyForMatchSide(m, 'B')
        return aKey === currentKeyB || bKey === currentKeyB
      }).slice(0, 5)

      const h2h = completedMatches.filter((m: any) => {
        const aKey = keyForMatchSide(m, 'A')
        const bKey = keyForMatchSide(m, 'B')
        return (aKey === currentKeyA || bKey === currentKeyA) && (aKey === currentKeyB || bKey === currentKeyB)
      }).slice(0, 10)



      let winsA = 0
      let winsB = 0
      h2h.forEach((m: any) => {
        const m2 = m as any;
        const winnerId = m2.winnerId || m2.winnerSquadId;
        const winnerName = String(m2.winnerName || m2.winner || m2.winningTeam || '').toLowerCase();
        const resSum = String(m2.resultSummary || '').toLowerCase();

        // 1. Explicit winner check
        if (winnerId || (winnerName && !['tie', 'pending'].includes(winnerName))) {
          const aKey = keyForMatchSide(m, 'A');
          const bKey = keyForMatchSide(m, 'B');
          const isWinA = (winnerId && (aKey.includes(winnerId) || winnerId.includes(aKey))) ||
            (winnerName && aKey.toLowerCase().includes(winnerName));
          const isWinB = (winnerId && (bKey.includes(winnerId) || winnerId.includes(bKey))) ||
            (winnerName && bKey.toLowerCase().includes(winnerName));

          if (isWinA) { winsA++; return; }
          if (isWinB) { winsB++; return; }
        }

        // 2. Score check
        let aRuns = 0, bRuns = 0, soA = 0, soB = 0;
        let hasData = false;

        if (m.score?.teamA && m.score?.teamB) {
          aRuns = Number(m.score.teamA.runs || 0);
          bRuns = Number(m.score.teamB.runs || 0);
          soA = Number(m.score.teamA_super?.runs || 0);
          soB = Number(m.score.teamB_super?.runs || 0);
          hasData = true;
        } else {
          const inn = relatedInningsMap.get(m.id);
          if (inn?.teamA && inn?.teamB) {
            aRuns = Number(inn.teamA.totalRuns || 0);
            bRuns = Number(inn.teamB.totalRuns || 0);
            soA = Number(inn.aso?.totalRuns || 0);
            soB = Number(inn.bso?.totalRuns || 0);
            hasData = true;
          }
        }

        if (!hasData) return;

        if (aRuns > bRuns) winsA++;
        else if (bRuns > aRuns) winsB++;
        else if (soA > soB) winsA++;
        else if (soB > soA) winsB++;
      })

      const mapFormItem = (m: any, currentTeamKey: string) => {
        const aName = getMatchDisplayTeam(m, 'A')
        const bName = getMatchDisplayTeam(m, 'B')
        const badge = resultBadge(m, currentTeamKey)
        const scoreA = getScoreText(m, 'A')
        const scoreB = getScoreText(m, 'B')
        let winnerText = '—'
        let hasData = false

        if ((m as any).resultSummary) {
          winnerText = (m as any).resultSummary;
          hasData = true;
        } else {
          let aRuns = 0, bRuns = 0, soA = 0, soB = 0;

          if (m.score?.teamA && m.score?.teamB) {
            aRuns = Number(m.score.teamA.runs || 0);
            bRuns = Number(m.score.teamB.runs || 0);
            soA = Number(m.score.teamA_super?.runs || 0);
            soB = Number(m.score.teamB_super?.runs || 0);
            hasData = true;
          } else {
            const inn = relatedInningsMap.get(m.id);
            if (inn?.teamA && inn?.teamB) {
              aRuns = Number(inn.teamA.totalRuns || 0);
              bRuns = Number(inn.teamB.totalRuns || 0);
              soA = Number(inn.aso?.totalRuns || 0);
              soB = Number(inn.bso?.totalRuns || 0);
              hasData = true;
            }
          }

          if (hasData) {
            if (aRuns === bRuns) {
              if (soA > soB) winnerText = aName + ' won (Super Over)';
              else if (soB > soA) winnerText = bName + ' won (Super Over)';
              else winnerText = 'Tied';
            } else {
              winnerText = (aRuns > bRuns ? aName : bName) + ' won';
            }
          }
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

      const teamAFormMapped = teamAForm.map((m: any) => mapFormItem(m, currentKeyA))
      const teamBFormMapped = teamBForm.map((m: any) => mapFormItem(m, currentKeyB))



      return {
        teamAForm: teamAFormMapped,
        teamBForm: teamBFormMapped,
        h2hSummary: { winsA, winsB, total: h2h.length },
        h2hRows: h2h.map((m: any) => {
          const aKey = keyForMatchSide(m, 'A')
          const aName = getMatchDisplayTeam(m, 'A')
          const bName = getMatchDisplayTeam(m, 'B')
          const aScore = getScoreText(m, 'A')
          const bScore = getScoreText(m, 'B')

          let winnerText = '—'
          let hasData = false
          let aRuns = 0, bRuns = 0

          if (m.score?.teamA && m.score?.teamB) {
            aRuns = Number(m.score.teamA.runs || 0)
            bRuns = Number(m.score.teamB.runs || 0)
            hasData = true
          } else {
            const inn = relatedInningsMap.get(m.id)
            if (inn?.teamA && inn?.teamB) {
              aRuns = Number(inn.teamA.totalRuns || 0)
              bRuns = Number(inn.teamB.totalRuns || 0)
              hasData = true
            }
          }

          if (hasData) {
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
    return {
      days: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diffMs % (1000 * 60)) / 1000),
    }
  }, [startDate, now])

  // Match tabs (MUST be before early returns) - All tabs in one page
  const matchTabs = useMemo(() => {
    const baseTabs: { id: string; label: string; disabled?: boolean }[] = [
      ...(isFinishedMatch ? [{ id: 'summary', label: t('tab_summary') }] : []),
      { id: 'info', label: t('tab_info') },
      { id: 'commentary', label: t('tab_commentary') },
      { id: 'live', label: t('tab_live'), disabled: !isLiveEffective && !isFinishedMatch },
      { id: 'scorecard', label: t('tab_scorecard') },
      { id: 'playing-xi', label: t('tab_playing_xi') },
    ]

    // Add Points Table if match has group (groupName or groupId) or tournament has groups
    const hasGroup = Boolean((match as any)?.groupName || (match as any)?.groupId)
    const tournamentHasGroups = Boolean(tournament?.groups && Array.isArray(tournament.groups) && tournament.groups.length > 0)

    if (match?.tournamentId && (hasGroup || tournamentHasGroups)) {
      baseTabs.push({ id: 'points-table', label: t('tab_point_table') })
    }

    // Add Graphs
    if (isLiveMatch || isFinishedMatch) {
      baseTabs.push({ id: 'graphs', label: t('tab_graphs') })
    }

    return baseTabs
  }, [match?.tournamentId, isFinishedMatch, isLiveMatch, isLiveEffective, match, tournament, t])

  const calculatedResultSummary = useMemo(() => {
    if (!isFinishedMatch) return null
    const calc = getMatchResultString(
      teamAName,
      teamBName,
      teamAInnings,
      teamBInnings,
      match,
      teamASuperInnings,
      teamBSuperInnings
    )
    if (calc && (calc.toLowerCase().includes(' won') || calc.includes('Tie'))) return calc
    return (match as any)?.resultSummary || ''
  }, [isFinishedMatch, match, teamAName, teamBName, teamAInnings, teamBInnings, teamASuperInnings, teamBSuperInnings])

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
      <div className="min-h-screen bg-slate-50 dark:bg-[#060b16]">
        <div className="w-full max-w-2xl mx-auto px-4 py-8 pb-32">
          {/* 1. Header: Venue & Status */}
          <div className="flex flex-col items-center gap-6 mb-12">
            {/* Stage Pill */}
            {(match as any).stage && (
              <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl shadow-sm">
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest leading-none">
                  {(match as any).stage === 'knockout'
                    ? String((match as any).round || '').replace('_', ' ')
                    : (match as any).matchNo ? `Match ${(match as any).matchNo}` : (match as any).groupName ? `${(match as any).groupName} Group` : (match as any).stage}
                </span>
              </div>
            )}

            {/* Venue Pill */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm">
              <MapPin size={14} className="text-rose-500" />
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest leading-none">
                {match.venue || 'SMA Home Ground'}
              </span>
            </div>

            {/* Date & State */}
            <div className="flex items-center gap-3">
              <div className="px-5 py-2.5 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-[11px] font-black text-slate-900 dark:text-slate-200 tracking-tight shadow-sm dark:shadow-xl">
                {startDate ? formatDateLabelTZ(startDate) : 'Date TBA'} {startTimeText ? ` • ${startTimeText}` : ''}
              </div>
              <div className="px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[10px] font-black text-amber-500 tracking-widest uppercase shadow-lg shadow-amber-500/5">
                Upcoming
              </div>
            </div>
          </div>

          {/* 2. Team Branding */}
          <div className="flex items-center justify-between px-2 sm:px-8 mb-16 relative">
            {/* Center VS */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 opacity-20">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">VS</span>
            </div>

            {/* Team A */}
            <div className="flex flex-col items-center gap-4 z-10 w-[40%]">
              <div className="relative group">
                <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 p-0.5 shadow-2xl overflow-hidden shadow-blue-500/20">
                  <div className="w-full h-full bg-[#1a2332] rounded-[1.4rem] flex items-center justify-center p-3 sm:p-5">
                    {teamASquad?.logoUrl ? (
                      <img src={teamASquad.logoUrl} className="w-full h-full object-contain" alt="" />
                    ) : (
                      <span className="text-3xl sm:text-5xl font-black text-white">{teamAName.charAt(0)}</span>
                    )}
                  </div>
                </div>
              </div>
              <h2 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight text-center leading-tight mt-1">
                {firstName}
              </h2>
            </div>

            {/* Team B */}
            <div className="flex flex-col items-center gap-4 z-10 w-[40%]">
              <div className="relative group text-right">
                <div className="absolute -inset-4 bg-rose-500/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-rose-600 to-pink-700 p-0.5 shadow-2xl overflow-hidden shadow-rose-500/20">
                  <div className="w-full h-full bg-[#1a2332] rounded-[1.4rem] flex items-center justify-center p-3 sm:p-5">
                    {teamBSquad?.logoUrl ? (
                      <img src={teamBSquad.logoUrl} className="w-full h-full object-contain" alt="" />
                    ) : (
                      <span className="text-3xl sm:text-5xl font-black text-white">{secondName.charAt(0)}</span>
                    )}
                  </div>
                </div>
              </div>
              <h2 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight text-center leading-tight mt-1">
                {secondName}
              </h2>
            </div>
          </div>

          {/* 3. Countdown Section */}
          <div className="bg-white dark:bg-white/[0.03] backdrop-blur-md border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8 sm:p-10 mb-8 border-b-slate-300 dark:border-b-white/10 shadow-xl dark:shadow-2xl">
            <div className="flex items-center gap-2 mb-8 justify-center sm:justify-start">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Starts In</span>
            </div>
            {countdown ? (
              <div className="grid grid-cols-4 gap-3 sm:gap-6">
                {[
                  { label: 'Days', val: countdown.days },
                  { label: 'Hrs', val: countdown.hours },
                  { label: 'Min', val: countdown.minutes },
                  { label: 'Sec', val: countdown.seconds },
                ].map((x) => (
                  <div key={x.label} className="flex flex-col items-center gap-2">
                    <div className="w-full aspect-square flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-[#141b2b] border border-slate-200 dark:border-white/5 shadow-inner">
                      <span className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">{String(x.val).padStart(2, '0')}</span>
                    </div>
                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{x.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-24 flex items-center justify-center italic text-xs text-slate-500 font-bold uppercase tracking-widest animate-pulse">Syncing...</div>
            )}
          </div>

          {/* 4. Info Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {/* Toss */}
            <div className="bg-white dark:bg-white/[0.03] backdrop-blur-sm border border-slate-200 dark:border-white/5 rounded-3xl p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all group shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                <Info size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Toss</p>
                <p className="text-[13px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                  {tossDisplay ? (
                    <span className="text-blue-600 dark:text-blue-400">{tossDisplay.winnerName} <span className="text-slate-500 dark:text-slate-400 font-bold">won</span></span>
                  ) : 'Not Decided'}
                </p>
              </div>
            </div>

            {/* Playing XI */}
            <div className="bg-white dark:bg-white/[0.03] backdrop-blur-sm border border-slate-200 dark:border-white/5 rounded-3xl p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all group shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <Users size={20} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Playing XI</p>
                <p className="text-[13px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{hasAnyXI ? 'Announced' : 'TBD'}</p>
              </div>
            </div>

            {/* Category */}
            <div className="bg-white dark:bg-white/[0.03] backdrop-blur-sm border border-slate-200 dark:border-white/5 rounded-3xl p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all group shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform">
                <Hash size={20} className="text-purple-500" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Category</p>
                <p className="text-[13px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{(match as any)?.groupName || 'Pool Match'}</p>
              </div>
            </div>

            {/* Format */}
            <div className="bg-white dark:bg-white/[0.03] backdrop-blur-sm border border-slate-200 dark:border-white/5 rounded-3xl p-5 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all group shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform">
                <Info size={20} className="text-indigo-500" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Format</p>
                <p className="text-[13px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{match.oversLimit || 20} Overs</p>
              </div>
            </div>
          </div>

          {/* 5. Points Table Preview */}
          {
            hasGroup && match?.tournamentId && (
              <div className="mt-12">
                <div className="flex items-center justify-between px-2 mb-6">
                  <h3 className="text-[13px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <LayoutDashboard size={14} className="text-blue-500" />
                    Points Table
                  </h3>
                  <button onClick={() => setActiveTab('points-table')} className="text-[11px] font-black text-blue-500 hover:text-blue-400 transition-colors uppercase tracking-widest">
                    View Full Table
                  </button>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                  <TournamentPointsTable
                    embedded={true}
                    tournamentId={match.tournamentId}
                    hideQualification={true}
                    filterSquadIds={[
                      String(resolveMatchSideRef(match as any, 'A') || ''),
                      String(resolveMatchSideRef(match as any, 'B') || '')
                    ].filter(Boolean)}
                    highlightMatch={match as any}
                  />
                </div>
              </div>
            )
          }
        </div >
      </div >
    )
  }

  // Render content based on active tab - All inline, no navigation
  const renderTabContent = () => {
    switch (activeTab) {
      case 'commentary':
        const effInningsComm = displayedInnings || currentInnings;
        return (
          <div className="bg-slate-50 dark:bg-[#060b16] min-h-screen">
            <CrexLiveSection
              match={match as any}
              striker={striker as any}
              nonStriker={nonStriker as any}
              currentBowler={bowler as any}
              partnership={effInningsComm?.partnership}
              lastWicket={lastWicket}
              recentOvers={effInningsComm?.recentOvers || []}
              commentary={commentary as any}
              activeCommentaryFilter={activeCommentaryFilter as any}
              onCommentaryFilterChange={(id: string) => setActiveCommentaryFilter(id)}
              currentRunRate={effInningsComm?.currentRunRate || 0}
              requiredRunRate={effInningsComm?.requiredRunRate || null}
              currentRuns={effInningsComm?.totalRuns || 0}
              currentOvers={effInningsComm?.overs || '0.0'}
              oversLimit={match.oversLimit || 20}
              target={chaseInfo.target}
              runsNeeded={chaseInfo.runsNeeded}
              ballsRemaining={effInningsComm?.remainingBalls ?? ((match.oversLimit || 20) * 6 - Number(effInningsComm?.legalBalls || 0))}
              matchStatus={String((isLiveEffective ? 'Live' : isFinishedMatch ? 'Finished' : match.status) || '')}
              matchPhase={(match as any)?.matchPhase}
              currentInnings={effInningsComm as any}
              currentWickets={effInningsComm?.totalWickets || 0}
              teamAName={teamAName}
              teamBName={teamBName}
              teamAInnings={teamAInnings}
              teamBInnings={teamBInnings}
              firstSide={firstSide}
              secondSide={secondSide}
              resultSummary={isFinishedMatch ? (calculatedResultSummary || (match as any)?.resultSummary || null) : null}
              onlyCommentary={true} // New prop to only show commentary
              teamFormAndH2H={teamFormAndH2H}
              hasGroup={Boolean((match as any)?.groupName || (match as any)?.groupId)}
              tournamentId={match.tournamentId}
              resolveMatchSideRef={resolveMatchSideRef}
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
            teamASuperInnings={teamASuperInnings}
            teamBSuperInnings={teamBSuperInnings}
          />
        )
      case 'points-table':
        return match?.tournamentId ? (
          <div className="bg-slate-50 dark:bg-[#060b16] min-h-screen py-6">
            <TournamentPointsTable embedded={true} tournamentId={match.tournamentId} highlightMatch={match as any} />
          </div>
        ) : null
      default:
      case 'live':
        if (isUpcomingMatch && !isPastStart) return renderUpcoming()
        const effInningsLive = displayedInnings || currentInnings;
        return (
          <div className="bg-slate-50 dark:bg-[#060b16] min-h-screen">
            <CrexLiveSection
              match={match as any}
              striker={striker as any}
              nonStriker={nonStriker as any}
              currentBowler={bowler as any}
              partnership={effInningsLive?.partnership}
              lastWicket={lastWicket}
              recentOvers={effInningsLive?.recentOvers || []}
              commentary={commentary as any}
              activeCommentaryFilter={activeCommentaryFilter as any}
              onCommentaryFilterChange={(id: string) => setActiveCommentaryFilter(id)}
              currentRunRate={effInningsLive?.currentRunRate || 0}
              requiredRunRate={effInningsLive?.requiredRunRate || null}
              currentRuns={effInningsLive?.totalRuns || 0}
              currentOvers={effInningsLive?.overs || '0.0'}
              oversLimit={match.oversLimit || 20}
              target={chaseInfo.target}
              runsNeeded={chaseInfo.runsNeeded}
              ballsRemaining={effInningsLive?.remainingBalls ?? ((match.oversLimit || 20) * 6 - Number(effInningsLive?.legalBalls || 0))}
              matchStatus={String((isLiveEffective ? 'Live' : isFinishedMatch ? 'Finished' : match.status) || '')}
              matchPhase={(match as any)?.matchPhase}
              currentInnings={effInningsLive}
              currentWickets={effInningsLive?.totalWickets || 0}
              teamAName={teamAName}
              teamBName={teamBName}
              teamAInnings={teamAInnings}
              teamBInnings={teamBInnings}
              teamASquad={teamASquad}
              teamBSquad={teamBSquad}
              firstSide={firstSide}
              secondSide={secondSide}
              resultSummary={isFinishedMatch ? (resultSummary || null) : null}
              teamFormAndH2H={teamFormAndH2H}
              hasGroup={Boolean((match as any)?.groupName || (match as any)?.groupId)}
              tournamentId={match.tournamentId}
              resolveMatchSideRef={resolveMatchSideRef}
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#060b16]">
      {/* 1. Page Header (Sticky) */}
      <PageHeader
        title={<span className="text-[11px] sm:text-lg">{isUpcomingMatch ? `${firstName} vs ${secondName}` : `${teamAName} vs ${teamBName}`}</span>}
        subtitle={isUpcomingMatch ? "Upcoming Match" : `${match.matchNo ? `#${match.matchNo} • ` : ''}${tournament?.name || 'Tournament'}`}
        rightContent={
          matchId && (
            <div className="flex items-center gap-2">
              <button
                onClick={togglePin}
                className={`p-2 rounded-full transition-all ${isPinned
                  ? 'text-amber-500'
                  : 'text-slate-400 hover:bg-white/10'
                  }`}
              >
                {isPinned ? <Pin size={20} fill="currentColor" /> : <Pin size={20} />}
              </button>
              <NotificationBell
                matchId={matchId}
                adminId={match?.adminId || ''}
                matchTitle={`${teamAName} vs ${teamBName}`}
                tournamentId={match?.tournamentId}
                color="text-slate-400 hover:text-emerald-400 hover:bg-white/10"
              />
            </div>
          )
        }
      />

      {/* 2. Sticky Match Tabs (Sticks to Top of Screen) */}
      <MatchTabs
        tabs={matchTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        stickyTop="var(--status-bar-height)"
      />

      {/* 3. Sticky Scoreboard (Below Tabs) - Global for all tabs */}
      {(!isUpcomingMatch || (match as any).tossWinner) && !(isFinishedMatch && activeTab === 'summary') && !(activeTab === 'live' && isUpcomingMatch && !isPastStart) && (
        <div className="sticky z-40 transition-all duration-300" style={{ top: 'calc(48px + var(--status-bar-height))' }}>
          <MatchLiveHero
            match={match}
            teamAName={teamAName}
            teamBName={teamBName}
            teamASquad={teamASquad}
            teamBSquad={teamBSquad}
            currentInnings={displayedInnings || currentInnings}
            teamAInnings={teamAInnings}
            teamBInnings={teamBInnings}
            isFinishedMatch={isFinishedMatch}
            resultSummary={calculatedResultSummary || resultSummary}
            centerEventText={centerEventText || '—'}
            showBoundaryAnim={showBoundaryAnim}
            ballAnimating={ballAnimating}
            ballEventType={ballEventType}
            lastBall={null}
            recentOvers={(displayedInnings || currentInnings)?.recentOvers || []}
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
      <MatchSettingsSheet
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        matchId={matchId || ''}
        matchTitle={`${teamAName} vs ${teamBName}`}
      />
    </div>
  )
}
