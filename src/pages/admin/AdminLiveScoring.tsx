/**
 * Live Match Admin Scoring Console
 * Professional scorer tool with real-time updates
 */

import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { Match, InningsStats, Ball } from '@/types'
import { doc, collection, addDoc, query, orderBy, limit, getDocs, Timestamp, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { COLLECTIONS, SUBCOLLECTIONS } from '@/services/firestore/collections'
import toast from 'react-hot-toast'
import { recalculateInnings } from '@/engine/recalculateInnings'
import EmbeddedCommentary from '@/components/commentary/EmbeddedCommentary'
import { generateAutoCommentary, deleteCommentaryForBall } from '@/services/commentary/commentaryService'

export default function AdminLiveScoring() {
  const { matchId } = useParams<{ matchId: string }>()
  const [match, setMatch] = useState<Match | null>(null)
  const [currentInnings, setCurrentInnings] = useState<InningsStats | null>(null)
  const [teamAInnings, setTeamAInnings] = useState<InningsStats | null>(null)
  const [teamBInnings, setTeamBInnings] = useState<InningsStats | null>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStriker, setSelectedStriker] = useState<string>('')
  const [selectedNonStriker, setSelectedNonStriker] = useState<string>('')
  const [selectedBowler, setSelectedBowler] = useState<string>('')
  const [lastBall, setLastBall] = useState<Ball | null>(null)
  const [isFreeHit, setIsFreeHit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [autoAiCommentary, setAutoAiCommentary] = useState(true)
  const [wicketModalOpen, setWicketModalOpen] = useState(false)
  const [needsNewBowler, setNeedsNewBowler] = useState(false)
  const [suggestedNextBatterId, setSuggestedNextBatterId] = useState<string>('')
  const [suggestedNextBowlerId, setSuggestedNextBowlerId] = useState<string>('')

  // Advanced input controls (ICC)
  const [wideExtraRuns, setWideExtraRuns] = useState<number>(0) // additional runs taken on a wide (beyond the automatic 1)
  const [noBallBatRuns, setNoBallBatRuns] = useState<number>(0) // runs off the bat on a no-ball
  const [noBallExtraRuns, setNoBallExtraRuns] = useState<number>(0) // additional running runs on a no-ball (beyond the automatic 1)
  const [byeRuns, setByeRuns] = useState<number>(1)
  const [legByeRuns, setLegByeRuns] = useState<number>(1)
  const [wicketType, setWicketType] = useState<'bowled' | 'caught' | 'lbw' | 'run-out' | 'stumped' | 'hit-wicket' | 'obstructing-field' | 'retired'>('bowled')
  const [wicketRuns, setWicketRuns] = useState<number>(0)
  const [wicketDismissed, setWicketDismissed] = useState<'striker' | 'nonStriker'>('striker')
  const [wicketFielderId, setWicketFielderId] = useState<string>('') // caught fielder (optional)
  const [wicketNextBatterId, setWicketNextBatterId] = useState<string>('') // user-selected next batter for wicket

  // Modal for extras (requested)
  const [extrasModalOpen, setExtrasModalOpen] = useState(false)
  const [extrasModalType, setExtrasModalType] = useState<'wide' | 'no-ball' | 'bye' | 'leg-bye'>('wide')

  // Wicket rules:
  // - Run Out: can dismiss striker OR non-striker (admin selects)
  // - Others: always striker out (lock selection)
  useEffect(() => {
    if (!wicketModalOpen) return
    if (wicketType !== 'run-out') {
      if (wicketDismissed !== 'striker') setWicketDismissed('striker')
      if (wicketRuns !== 0) setWicketRuns(0)
    }
    if (wicketType !== 'caught') {
      if (wicketFielderId) setWicketFielderId('')
    }
  }, [wicketDismissed, wicketFielderId, wicketModalOpen, wicketRuns, wicketType])

  const getNextBatterCandidates = (excludeIds: string[] = []) => {
    const pool = (() => {
      const xi = getBattingPlayingXI()
      return xi.length > 0 ? xi : availableBatsmen.map((p: any) => p.id)
    })()

    const used = new Set<string>()
    ;(currentInnings?.batsmanStats || []).forEach((b: any) => used.add(b.batsmanId))
    ;(currentInnings?.fallOfWickets || []).forEach((f: any) => used.add(f.batsmanId))
    ;[selectedStriker, selectedNonStriker].filter(Boolean).forEach((id) => used.add(id))
    excludeIds.filter(Boolean).forEach((id) => used.add(id))

    const ids = pool.filter((id) => id && !used.has(id))
    return ids
      .map((id) => ({ id, name: playersById.get(id)?.name || 'Batter' }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  // When wicket modal is open, keep next-batter selection valid + default to first available
  useEffect(() => {
    if (!wicketModalOpen) return
    const replacingSlot = wicketType === 'run-out' ? (wicketDismissed === 'nonStriker' ? 'nonStriker' : 'striker') : 'striker'
    const candidates = getNextBatterCandidates(replacingSlot === 'striker' ? [selectedNonStriker] : [selectedStriker])
    if (candidates.length === 0) return
    if (!wicketNextBatterId || !candidates.some((c) => c.id === wicketNextBatterId)) {
      setWicketNextBatterId(candidates[0].id)
    }
  }, [selectedNonStriker, selectedStriker, wicketDismissed, wicketModalOpen, wicketNextBatterId, wicketType])

  useEffect(() => {
    if (!matchId) return

    // Load match
    matchService.getById(matchId).then((matchData) => {
      if (matchData) {
        setMatch(matchData)
        setLoading(false)
      }
    })

    // Subscribe to match
    const unsubscribeMatch = matchService.subscribeToMatch(matchId, (matchData) => {
      if (matchData) {
        setMatch(matchData)
      }
    })

    // Subscribe to innings
    const unsubA = matchService.subscribeToInnings(matchId, 'teamA', (innings) => {
      setTeamAInnings(innings)
    })

    const unsubB = matchService.subscribeToInnings(matchId, 'teamB', (innings) => {
      setTeamBInnings(innings)
    })

    // Load players
    playerService.getAll().then(setPlayers)

    return () => {
      unsubscribeMatch()
      unsubA()
      unsubB()
    }
  }, [matchId])

  const resolveSideFromValue = (m: Match, v: any): 'teamA' | 'teamB' | null => {
    if (v === 'teamA' || v === 'teamB') return v
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase()
      if (s === 'teama' || s === 'team a' || s === 'team_a' || s === 'a') return 'teamA'
      if (s === 'teamb' || s === 'team b' || s === 'team_b' || s === 'b') return 'teamB'

      const aId = String((m as any).teamAId || (m as any).teamASquadId || (m as any).teamA || '').trim().toLowerCase()
      const bId = String((m as any).teamBId || (m as any).teamBSquadId || (m as any).teamB || '').trim().toLowerCase()
      const aName = String(m.teamAName || (m as any).teamA || '').trim().toLowerCase()
      const bName = String(m.teamBName || (m as any).teamB || '').trim().toLowerCase()

      if (aId && s === aId) return 'teamA'
      if (bId && s === bId) return 'teamB'
      if (aName && s === aName) return 'teamA'
      if (bName && s === bName) return 'teamB'
    }
    return null
  }

  const normalizeElectedTo = (v: any): 'bat' | 'bowl' | null => {
    if (v === 'bat' || v === 'bowl') return v
    if (typeof v !== 'string') return null
    const s = v.trim().toLowerCase()
    if (s === 'bat' || s === 'batting' || s === 'choose bat' || s === 'chose bat') return 'bat'
    if (s === 'bowl' || s === 'bowling' || s === 'field' || s === 'fielding' || s === 'choose bowl' || s === 'chose bowl')
      return 'bowl'
    return null
  }

  const inferFirstInningsBatting = (m: Match): 'teamA' | 'teamB' => {
    const tw = resolveSideFromValue(m, (m as any).tossWinner)
    const el = normalizeElectedTo((m as any).electedTo)
    // If toss info is missing, fall back to legacy default.
    if (!tw || !el) return 'teamA'
    // If toss winner elected to bat, they bat first; otherwise the other team bats first.
    if (el === 'bat') return tw
    return tw === 'teamA' ? 'teamB' : 'teamA'
  }

  const otherSide = (s: 'teamA' | 'teamB'): 'teamA' | 'teamB' => (s === 'teamA' ? 'teamB' : 'teamA')

  // IMPORTANT: don't rely only on match.currentBatting; it can be missing/wrong right after toss.
  // If it's missing/invalid, infer from innings state first (because match may already be in progress),
  // then fall back to toss + matchPhase.
  const effectiveCurrentBatting: 'teamA' | 'teamB' = (() => {
    if (!match) return 'teamA'

    const first = inferFirstInningsBatting(match)
    // If match is in second innings, ALWAYS show the 2nd batting side (even if 0 balls yet).
    // This is critical right after innings break, otherwise UI keeps showing 1st-innings team
    // because only one innings has "started" in stats.
    if (match.matchPhase === 'SecondInnings') return otherSide(first)

    const aHas =
      Number((teamAInnings as any)?.legalBalls || 0) > 0 ||
      Number((teamAInnings as any)?.totalRuns || 0) > 0 ||
      Number((teamAInnings as any)?.totalWickets || 0) > 0
    const bHas =
      Number((teamBInnings as any)?.legalBalls || 0) > 0 ||
      Number((teamBInnings as any)?.totalRuns || 0) > 0 ||
      Number((teamBInnings as any)?.totalWickets || 0) > 0

    // If only one innings has started, that's the batting side (prevents "0/0" flip after wickets).
    if (aHas && !bHas) return 'teamA'
    if (bHas && !aHas) return 'teamB'

    // If innings haven't started yet, trust toss-based first-innings batting over any stale currentBatting.
    return first
  })()

  // Best-effort: if innings haven't started yet and toss tells us who bats first, keep match.currentBatting synced.
  useEffect(() => {
    if (!matchId || !match) return
    const aHas =
      Number((teamAInnings as any)?.legalBalls || 0) > 0 ||
      Number((teamAInnings as any)?.totalRuns || 0) > 0 ||
      Number((teamAInnings as any)?.totalWickets || 0) > 0
    const bHas =
      Number((teamBInnings as any)?.legalBalls || 0) > 0 ||
      Number((teamBInnings as any)?.totalRuns || 0) > 0 ||
      Number((teamBInnings as any)?.totalWickets || 0) > 0
    if (aHas || bHas) return

    const desiredFirst = inferFirstInningsBatting(match)
    const desired = match.matchPhase === 'SecondInnings' ? otherSide(desiredFirst) : desiredFirst
    const current = resolveSideFromValue(match, (match as any).currentBatting)
    if (current === desired) return

    const ref = doc(db, COLLECTIONS.MATCHES, matchId)
    updateDoc(ref, { currentBatting: desired } as any).catch(() => {})
  }, [match, matchId, teamAInnings, teamBInnings])

  useEffect(() => {
    if (!match) return
    const currentBatting = effectiveCurrentBatting
    const innings = currentBatting === 'teamA' ? teamAInnings : teamBInnings
    setCurrentInnings(innings || null)

    // Set default players
    if (innings) {
      const strikerPtr =
        String((innings as any).currentStrikerId || (match as any).currentStrikerId || '') || ''
      const nonStrikerPtr =
        String((innings as any).nonStrikerId || (match as any).currentNonStrikerId || (match as any).nonStrikerId || '') || ''
      const bowlerPtr = String((innings as any).currentBowlerId || (match as any).currentBowlerId || '') || ''

      // Prefer persisted pointers (stable until wicket/over events)
      if (strikerPtr && !selectedStriker) setSelectedStriker(strikerPtr)
      if (nonStrikerPtr && !selectedNonStriker) setSelectedNonStriker(nonStrikerPtr)
      if (bowlerPtr && !selectedBowler) setSelectedBowler(bowlerPtr)

      // Fallback: if pointers are missing but UI shows 2 not-out batters, restore them.
      // This prevents admin panel showing only 1 batter while public side shows 2.
      if (!selectedNonStriker) {
        const strikerId = String(selectedStriker || strikerPtr || '')
        const notOutIds = ((innings as any).batsmanStats || [])
          .filter((b: any) => b && b.notOut)
          .map((b: any) => String(b.batsmanId || ''))
          .filter(Boolean)
        const candidate = notOutIds.find((id: string) => id && id !== strikerId) || ''
        if (candidate) setSelectedNonStriker(candidate)
      }
    }
  }, [effectiveCurrentBatting, match, teamAInnings, teamBInnings, selectedBowler, selectedNonStriker, selectedStriker])

  // Helpers
  const inningId = effectiveCurrentBatting
  // ICC: striker and non-striker must be different, and non-striker must be selected to score legal balls
  const strikerNonStrikerValid = Boolean(selectedStriker && selectedNonStriker && selectedNonStriker !== selectedStriker)
  const isReadyToScore = Boolean(matchId && selectedStriker && selectedNonStriker && selectedBowler && strikerNonStrikerValid)
  const canScoreNow = isReadyToScore && !needsNewBowler

  // Enforce ICC constraint even if user tries to select same player for both
  useEffect(() => {
    if (selectedStriker && selectedNonStriker && selectedStriker === selectedNonStriker) {
      setSelectedNonStriker('')
    }
  }, [selectedStriker, selectedNonStriker])

  const playersById = useMemo(() => {
    const map = new Map<string, any>()
    players.forEach((p) => map.set(p.id, p))
    return map
  }, [players])

  // Helpers to pick next batter/bowler suggestions
  const getBattingPlayingXI = (): string[] => {
    const xi = (effectiveCurrentBatting === 'teamA' ? (match as any)?.teamAPlayingXI : (match as any)?.teamBPlayingXI) as
      | string[]
      | undefined
    return Array.isArray(xi) ? xi : []
  }

  const getFieldingPlayingXI = (): string[] => {
    const xi = (effectiveCurrentBatting === 'teamA' ? (match as any)?.teamBPlayingXI : (match as any)?.teamAPlayingXI) as
      | string[]
      | undefined
    return Array.isArray(xi) ? xi : []
  }

  const getPlayerWithId = (id: string) => {
    const p = playersById.get(id)
    if (!p) return null
    // Some legacy player objects may not include `id` on the object itself.
    // We normalize it so dropdowns/guards always work reliably.
    return { ...p, id }
  }

  const getMatchSquadIds = (): string[] => {
    if (!match) return []
    const raw = [
      (match as any).teamAId,
      (match as any).teamBId,
      (match as any).teamASquadId,
      (match as any).teamBSquadId,
    ]
      .map((x) => String(x || '').trim())
      .filter(Boolean)
    return Array.from(new Set(raw))
  }

  const inferBattingSquadId = (): string => {
    // Prefer current selection; it's the most reliable in live scoring.
    const fromStriker = selectedStriker ? String((playersById.get(selectedStriker) as any)?.squadId || '') : ''
    if (fromStriker) return fromStriker

    // Next: first id in batting XI
    const xi = getBattingPlayingXI()
    for (const pid of xi) {
      const sid = String((playersById.get(pid) as any)?.squadId || '')
      if (sid) return sid
    }
    // Last fallback: use match team IDs (works when XI not set and no selections yet)
    const fallback =
      effectiveCurrentBatting === 'teamA'
        ? String((match as any)?.teamAId || (match as any)?.teamASquadId || '')
        : String((match as any)?.teamBId || (match as any)?.teamBSquadId || '')
    return fallback.trim()
  }

  const inferFieldingSquadId = (): string => {
    const matchSquads = getMatchSquadIds()
    const battingSid = inferBattingSquadId()
    if (matchSquads.length >= 2 && battingSid) {
      const other = matchSquads.find((id) => id && id !== battingSid)
      if (other) return other
    }
    // Fall back to “opposite of effectiveCurrentBatting” using stored IDs if possible.
    const fallback =
      effectiveCurrentBatting === 'teamA'
        ? String((match as any).teamBId || (match as any).teamBSquadId || '')
        : String((match as any).teamAId || (match as any).teamASquadId || '')
    return fallback.trim()
  }

  // Source of truth for player dropdowns:
  // - Prefer Playing XI lists (strict rule enforcement)
  // - Fall back to squadId filter only when XI isn't set (legacy)
  const availableBatsmen = useMemo(() => {
    if (!match) return [] as any[]
    const xiIds = getBattingPlayingXI()
    const xiPlayers = xiIds.map((id) => getPlayerWithId(id)).filter(Boolean)
    if (xiPlayers.length > 0) return xiPlayers

    // Legacy fallback (XI not set): infer batting squadId reliably from striker/xi; then filter by squadId.
    const squadId = inferBattingSquadId()
    if (squadId) return players.filter((p) => String((p as any).squadId || '') === squadId)

    // Absolute fallback: allow selecting from all players (but ICC guards will block recording if XI exists)
    // This prevents empty dropdowns when legacy match data is incomplete.
    return players
  }, [effectiveCurrentBatting, match, players, playersById])

  const availableBowlers = useMemo(() => {
    if (!match) return [] as any[]
    const xiIds = getFieldingPlayingXI()
    const xiPlayers = xiIds.map((id) => getPlayerWithId(id)).filter(Boolean)
    if (xiPlayers.length > 0) return xiPlayers

    // Legacy fallback: infer fielding squadId (the OTHER squad) to avoid empty bowler lists for legacy match docs.
    const squadId = inferFieldingSquadId()
    if (squadId) {
      const filtered = players.filter((p) => String((p as any).squadId || '') === squadId)
      if (filtered.length > 0) return filtered
    }

    // If we can infer batting squadId, prefer "everyone except batting squad" (usually the fielding squad).
    const battingSid = inferBattingSquadId()
    if (battingSid) {
      const notBatting = players.filter((p) => String((p as any).squadId || '') && String((p as any).squadId || '') !== battingSid)
      if (notBatting.length > 0) return notBatting
    }

    // Absolute fallback: show all players (legacy/partial data).
    return players
  }, [effectiveCurrentBatting, match, players, playersById])

  // Hard guard: striker/non-striker must be from batting XI, bowler must be from fielding XI.
  // If a mismatch happens due to data issues, auto-clear to prevent scoring with wrong team players.
  useEffect(() => {
    if (!match) return
    const batXI = getBattingPlayingXI()
    const bowlXI = getFieldingPlayingXI()
    if (batXI.length > 0) {
      const batIds = new Set<string>(batXI.map(String))
      if (selectedStriker && !batIds.has(String(selectedStriker))) setSelectedStriker('')
      if (selectedNonStriker && !batIds.has(String(selectedNonStriker))) setSelectedNonStriker('')
    }
    if (bowlXI.length > 0) {
      const bowlIds = new Set<string>(bowlXI.map(String))
      if (selectedBowler && !bowlIds.has(String(selectedBowler))) setSelectedBowler('')
    }
  }, [availableBatsmen, availableBowlers, match, selectedBowler, selectedNonStriker, selectedStriker])

  const suggestNextBatter = (balls: Ball[], excludeIds: string[] = []): string => {
    const xi = getBattingPlayingXI()
    const used = new Set<string>()
    balls.forEach((b) => {
      if ((b as any)?.batsmanId) used.add((b as any).batsmanId)
      if (b.wicket?.dismissedPlayerId) used.add(b.wicket.dismissedPlayerId)
    })
    excludeIds.filter(Boolean).forEach((id) => used.add(id))
    const pool = xi.length > 0 ? xi : availableBatsmen.map((p: any) => p.id)
    const next = pool.find((id) => id && !used.has(id))
    return next || ''
  }

  const suggestNextBowler = (excludeIds: string[] = []): string => {
    const used = new Set<string>(excludeIds.filter(Boolean))
    const pool = availableBowlers.map((p: any) => p.id)
    const next = pool.find((id) => id && !used.has(id))
    return next || ''
  }

  const persistInnings = async (computed: InningsStats) => {
    if (!matchId) return
    const ref = doc(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.INNINGS, computed.inningId)
    await setDoc(ref, computed as any, { merge: true })
  }

  const recomputeAndSave = async (
    ballsOverride?: Ball[],
    preferredNext?: { slot: 'striker' | 'nonStriker'; playerId: string },
    nextFreeHit?: boolean
  ): Promise<InningsStats | null> => {
    if (!matchId || !match) return

    const balls = ballsOverride ?? (await matchService.getBalls(matchId, inningId))

    // Compute "next delivery is free hit" from the ball stream.
    // Rule: no-ball => next delivery free hit; wide does not consume/change it; any other delivery clears it.
    const computeNextFreeHitFromBalls = (bs: Ball[]): boolean => {
      const sorted = [...(bs || [])].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
      let fh = false
      for (const b of sorted) {
        const extras: any = (b as any)?.extras || {}
        const type = String((b as any)?.type || '').toLowerCase()
        const hasNoBall = Number(extras?.noBalls || 0) > 0 || type === 'no-ball' || type === 'noball'
        const hasWide = Number(extras?.wides || 0) > 0 || type === 'wide'
        if (hasNoBall) fh = true
        else if (hasWide) fh = fh
        else fh = false
      }
      return fh
    }
    const effectiveNextFreeHit = typeof nextFreeHit === 'boolean' ? nextFreeHit : computeNextFreeHitFromBalls(balls)
    const computed = recalculateInnings({
      balls,
      matchId,
      inningId,
      matchData: {
        oversLimit: match.oversLimit || 20,
        currentStrikerId: (match as any).currentStrikerId || selectedStriker,
        currentNonStrikerId: (match as any).currentNonStrikerId || selectedNonStriker,
        currentBowlerId: (match as any).currentBowlerId || selectedBowler,
        target: (currentInnings as any)?.target,
      },
    })

    // Safety: ensure dismissed batter is not still shown as current striker/non-striker.
    // Some UI reads innings.currentStrikerId/nonStrikerId directly, so we hard-correct using the last ball wicket payload.
    const lastBallInStream = balls[balls.length - 1]
    const dismissedFromLastBall = lastBallInStream?.wicket?.dismissedPlayerId || ''
    if (dismissedFromLastBall) {
      // For most dismissals, dismissed is the striker (batsmanId). For run-out it can be non-striker.
      if (dismissedFromLastBall === (lastBallInStream as any)?.batsmanId) {
        computed.currentStrikerId = ''
      }
      if (dismissedFromLastBall === (lastBallInStream as any)?.nonStrikerId) {
        ;(computed as any).nonStrikerId = ''
      }
    }

    // If scorer selected the next batter during wicket entry, prefer that for the empty slot.
    if (preferredNext?.playerId) {
      const pid = preferredNext.playerId
      const other =
        preferredNext.slot === 'striker'
          ? String((computed as any).nonStrikerId || '')
          : String(computed.currentStrikerId || '')
      if (pid && pid !== other) {
        if (preferredNext.slot === 'striker' && !computed.currentStrikerId) computed.currentStrikerId = pid
        if (preferredNext.slot === 'nonStriker' && !(computed as any).nonStrikerId) ;(computed as any).nonStrikerId = pid
      }
    }

    // Auto bring in next batter BEFORE saving innings (public live page reads innings.currentStrikerId/nonStrikerId)
    const initialNextStriker = computed.currentStrikerId || ''
    const initialNextNonStriker = (computed as any).nonStrikerId || ''
    if (!initialNextStriker || !initialNextNonStriker) {
      const excludeBase = [initialNextStriker, initialNextNonStriker].filter(Boolean)
      const suggestedForStriker = !initialNextStriker ? suggestNextBatter(balls, excludeBase) : ''
      const suggestedForNonStriker = !initialNextNonStriker
        ? suggestNextBatter(balls, [...excludeBase, suggestedForStriker].filter(Boolean))
        : ''

      if (!initialNextStriker && suggestedForStriker) computed.currentStrikerId = suggestedForStriker
      if (!initialNextNonStriker && suggestedForNonStriker) ;(computed as any).nonStrikerId = suggestedForNonStriker

      // If still empty, keep fallback suggestion visible for manual set
      if (!computed.currentStrikerId) {
        const suggested = suggestNextBatter(balls, [String((computed as any).nonStrikerId || '')].filter(Boolean))
        setSuggestedNextBatterId(suggested)
      } else {
        setSuggestedNextBatterId('')
      }
    } else {
      setSuggestedNextBatterId('')
    }

    // Populate names for UI (batting/bowling tables, fall of wickets)
    computed.batsmanStats = computed.batsmanStats.map((b) => ({
      ...b,
      batsmanName: playersById.get(b.batsmanId)?.name || b.batsmanName || 'Batter',
    }))

    // Populate dismissal strings (caught/bowled etc.) from the actual wicket ball + player names.
    const wicketBallByDismissed = new Map<string, Ball>()
    balls.forEach((bb) => {
      const d = String(bb?.wicket?.dismissedPlayerId || '').trim()
      if (d) wicketBallByDismissed.set(d, bb) // last one wins
    })
    const dismissalTextFromBall = (wb?: Ball | null) => {
      if (!wb?.wicket) return ''
      const t = String(wb.wicket.type || '').toLowerCase()
      const bowlerId = String(wb.wicket.bowlerId || wb.bowlerId || '').trim()
      const bowlerName = playersById.get(bowlerId)?.name || 'Bowler'
      const fielderId = String(wb.wicket.fielderId || '').trim()
      const fielderName = fielderId ? (playersById.get(fielderId)?.name || 'Fielder') : ''

      if (t === 'bowled') return `b ${bowlerName}`
      if (t === 'lbw') return `lbw b ${bowlerName}`
      if (t === 'caught') {
        // Caught & bowled
        if (fielderId && bowlerId && bowlerId === fielderId) return `c & b ${bowlerName}`
        return fielderName ? `c ${fielderName} b ${bowlerName}` : `c b ${bowlerName}`
      }
      if (t === 'stumped') return fielderName ? `st ${fielderName} b ${bowlerName}` : `st b ${bowlerName}`
      if (t === 'hit-wicket') return `hit wicket b ${bowlerName}`
      if (t === 'obstructing-field') return 'obstructing the field'
      if (t === 'retired') return 'retired'
      if (t === 'run-out') return fielderName ? `run out (${fielderName})` : 'run out'
      return bowlerName ? `b ${bowlerName}` : 'out'
    }

    const isIncompleteDismissal = (s: string) => {
      const raw = String(s || '').trim().toLowerCase()
      if (!raw) return true
      // Cases where engine previously saved without names (e.g., "c b", "b", "lbw b", "st b")
      if (raw === 'c b') return true
      if (raw === 'b') return true
      if (raw === 'lbw b') return true
      if (raw === 'st b') return true
      if (raw === 'c') return true
      // "c & b" without name
      if (raw === 'c & b') return true
      // ends with " b" and no bowler name after it
      if (raw.endsWith(' b') && raw.split(' ').length <= 2) return true
      return false
    }

    computed.batsmanStats = computed.batsmanStats.map((b: any) => {
      if (b.notOut) return b
      const existing = String(b.dismissal || b.dismissalText || '').trim()
      if (existing && !isIncompleteDismissal(existing)) return b
      const wb = wicketBallByDismissed.get(String(b.batsmanId || '').trim())
      const dText = dismissalTextFromBall(wb || null)
      return { ...b, dismissal: dText }
    })
    // Ensure current striker/non-striker always appear in batting list (even if 0(0) and haven't faced yet)
    const ensureBatsmanRow = (batsmanId: string) => {
      if (!batsmanId) return
      if (computed.batsmanStats.some((b) => b.batsmanId === batsmanId)) return
      computed.batsmanStats.push({
        batsmanId,
        batsmanName: playersById.get(batsmanId)?.name || 'Batter',
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        notOut: true,
      })
    }
    ensureBatsmanRow(computed.currentStrikerId || '')
    ensureBatsmanRow(String((computed as any).nonStrikerId || ''))
    computed.bowlerStats = computed.bowlerStats.map((b) => ({
      ...b,
      bowlerName: playersById.get(b.bowlerId)?.name || b.bowlerName || 'Bowler',
    }))
    computed.fallOfWickets = computed.fallOfWickets.map((f: any) => {
      const existing = String(f.dismissal || '').trim()
      const wb = wicketBallByDismissed.get(String(f.batsmanId || '').trim())
      const dText = existing || dismissalTextFromBall(wb || null)
      return {
        ...f,
        batsmanName: playersById.get(f.batsmanId)?.name || f.batsmanName || 'Batter',
        dismissal: dText,
      }
    })

    await persistInnings(computed)

    // Keep match "current" pointers in sync for public pages
    const matchRef = doc(db, COLLECTIONS.MATCHES, matchId)
    const last = balls[balls.length - 1]
    const overEnded = Boolean(last && last.isLegal && (last as any).ballInOver === 5)
    const oversLimit = Number(match.oversLimit || 20)
    const inningsBallsLimit = Math.max(0, oversLimit * 6)
    const inningsCompleteByOvers = inningsBallsLimit > 0 && Number(computed.legalBalls || 0) >= inningsBallsLimit
    const inningsCompleteByAllOut = Number(computed.totalWickets || 0) >= 10
    const inningsComplete = inningsCompleteByOvers || inningsCompleteByAllOut

    // If innings is complete, auto switch to next innings (2nd team batting).
    // This keeps admin flow smooth: innings break -> clear selections -> start 2nd innings.
    if (inningsComplete) {
      const nextBatting: 'teamA' | 'teamB' = inningId === 'teamA' ? 'teamB' : 'teamA'
      const isSecondInningsFlag = String((match as any)?.matchPhase || '') === 'SecondInnings'

      // Robust guard: only finish the match if the "other" innings has actually started.
      // This prevents accidental finishing when matchPhase is stale/mis-set to SecondInnings.
      const otherInnings = nextBatting === 'teamA' ? teamAInnings : teamBInnings
      const otherStarted =
        Number((otherInnings as any)?.legalBalls || 0) > 0 ||
        Number((otherInnings as any)?.totalRuns || 0) > 0 ||
        Number((otherInnings as any)?.totalWickets || 0) > 0

      // True "second innings" means the opposite innings has started (not just matchPhase flag).
      const isReallySecondInnings = Boolean(isSecondInningsFlag && otherStarted)

      // If this was the first innings, start second innings and set target.
      if (!isReallySecondInnings) {
        const target = Number(computed.totalRuns || 0) + 1
        const nextInningsRef = doc(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.INNINGS, nextBatting)
        // Seed the 2nd innings doc with safe defaults so the admin UI can immediately
        // show the correct innings (0/0) without crashing on missing nested fields.
        await setDoc(
          nextInningsRef,
          {
            matchId,
            inningId: nextBatting,
            totalRuns: 0,
            totalWickets: 0,
            legalBalls: 0,
            overs: '0.0',
            ballsInCurrentOver: 0,
            currentRunRate: 0,
            requiredRunRate: null,
            remainingBalls: null,
            target,
            projectedTotal: null,
            lastBallSummary: null,
            partnership: { runs: 0, balls: 0, overs: '0.0' },
            extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
            fallOfWickets: [],
            batsmanStats: [],
            bowlerStats: [],
            recentOvers: [],
            currentOverBalls: [],
            currentStrikerId: '',
            nonStrikerId: '',
            currentBowlerId: '',
            lastUpdated: Timestamp.now(),
            updatedAt: new Date().toISOString(),
          } as any,
          { merge: true }
        )

        await updateDoc(matchRef, {
          matchPhase: 'SecondInnings',
          currentBatting: nextBatting,
          status: 'live',
          // Reset pointers for new innings selection
          currentStrikerId: '',
          currentNonStrikerId: '',
          nonStrikerId: '',
          currentBowlerId: '',
          lastOverBowlerId: '',
          freeHit: false,
          updatedAt: Timestamp.now(),
        } as any)

        setIsFreeHit(false)
        setNeedsNewBowler(false)
        setSuggestedNextBowlerId('')
        setSuggestedNextBatterId('')
        setSelectedStriker('')
        setSelectedNonStriker('')
        setSelectedBowler('')
        toast('Innings complete. 2nd innings starting — select new batters & bowler.', { icon: '⏸️' } as any)
        return computed
      }

      // Only now: this is truly the second innings, so match can be finished.
      await updateDoc(matchRef, {
        matchPhase: 'finished',
        status: 'finished',
        freeHit: false,
        updatedAt: Timestamp.now(),
      } as any)
      setIsFreeHit(false)
      toast('Match finished.', { icon: '🏁' } as any)
      return computed
    }

    await updateDoc(matchRef, {
      currentStrikerId: computed.currentStrikerId || '',
      // Keep both legacy and current field names in sync
      currentNonStrikerId: (computed as any).nonStrikerId || '',
      nonStrikerId: (computed as any).nonStrikerId || '',
      currentBowlerId: selectedBowler,
      // This flag represents whether the NEXT delivery is a free hit (after a no-ball).
      freeHit: effectiveNextFreeHit,
      ...(overEnded ? { lastOverBowlerId: selectedBowler } : {}),
      updatedAt: Timestamp.now(),
    } as any)

    // Auto-sync UI selection from computed state (even if empty, to avoid "out" staying on strike)
    const nextStriker = computed.currentStrikerId || ''
    const nextNonStriker = (computed as any).nonStrikerId || ''
    setSelectedStriker(nextStriker)
    setSelectedNonStriker(nextNonStriker)

    // Over-end: force new bowler selection (no consecutive overs by same bowler)
    if (overEnded) {
      setNeedsNewBowler(true)
      const suggested = suggestNextBowler([selectedBowler])
      setSuggestedNextBowlerId(suggested)
      toast('Over complete. Select a new bowler.', { icon: '🎯' } as any)
    }

    // Wicket: suggest next batter if striker/non-striker is now empty
    // (Legacy) suggestions are now only used as fallback when auto-pick can't find a batter.

    return computed
  }

  // Load last ball
  useEffect(() => {
    if (!matchId || !currentInnings) return

    const loadLastBall = async () => {
      try {
        const inningId = effectiveCurrentBatting
        const ballsRef = collection(
          db,
          COLLECTIONS.MATCHES,
          matchId,
          SUBCOLLECTIONS.INNINGS,
          inningId,
          SUBCOLLECTIONS.BALLS
        )
        const q = query(ballsRef, orderBy('sequence', 'desc'), limit(1))
        const snapshot = await getDocs(q)
        if (!snapshot.empty) {
          setLastBall({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Ball)
        } else {
          setLastBall(null)
        }
      } catch (error) {
        console.error('Error loading last ball:', error)
      }
    }

    loadLastBall()
  }, [matchId, currentInnings, match, effectiveCurrentBatting])

  const refreshLastBall = async () => {
    if (!matchId) return
    try {
      const inningId = effectiveCurrentBatting
      const ballsRef = collection(
        db,
        COLLECTIONS.MATCHES,
        matchId,
        SUBCOLLECTIONS.INNINGS,
        inningId,
        SUBCOLLECTIONS.BALLS
      )
      const q = query(ballsRef, orderBy('sequence', 'desc'), limit(1))
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        setLastBall({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Ball)
      } else {
        setLastBall(null)
      }
    } catch (e) {
      console.warn('Failed to refresh last ball:', e)
    }
  }

  // Free Hit state source of truth: match.freeHit indicates whether NEXT delivery is a free hit.
  // Do not derive it from last ball doc, because the no-ball itself is not a free hit.
  useEffect(() => {
    if (!match) return
    const fh = Boolean((match as any).freeHit || (match as any).isFreeHit)
    setIsFreeHit(fh)
  }, [match])

  const recordBall = async (payload: {
    kind: 'normal' | 'wide' | 'no-ball' | 'bye' | 'leg-bye' | 'wicket'
    runsOffBat: number
    totalRuns: number
    extras: { wides: number; noBalls: number; byes: number; legByes: number; penalty: number }
    wicket: null | { type: typeof wicketType; dismissedPlayerId: string; creditedToBowler: boolean; bowlerId: string; fielderId?: string }
    isLegal: boolean
    meta?: { preferredNextBatterId?: string; preferredNextSlot?: 'striker' | 'nonStriker' }
  }) => {
    if (!matchId || !match) return
    if (!selectedStriker || !selectedBowler) {
      toast.error('Please select striker and bowler')
      return
    }
    if (!strikerNonStrikerValid) {
      toast.error('Striker and non-striker cannot be the same player')
      return
    }
    // Free Hit rule (as per your requirement):
    // - No-ball => next delivery is Free Hit
    // - On Free Hit delivery, wicket is NOT allowed except Run Out
    if (isFreeHit && payload.kind === 'wicket') {
      if (payload.wicket?.type !== 'run-out') {
        toast.error('Free hit: only Run Out is allowed')
        return
      }
    }
    // ICC guard: if Playing XI is set, enforce team correctness strictly.
    const batXI = getBattingPlayingXI()
    const bowlXI = getFieldingPlayingXI()
    if (batXI.length > 0) {
      const set = new Set<string>(batXI.map(String))
      if (!set.has(String(selectedStriker))) {
        toast.error('Invalid striker (not in batting Playing XI)')
        return
      }
      if (!set.has(String(selectedNonStriker))) {
        toast.error('Invalid non-striker (not in batting Playing XI)')
        return
      }
    }
    if (bowlXI.length > 0) {
      const set = new Set<string>(bowlXI.map(String))
      if (!set.has(String(selectedBowler))) {
        toast.error('Invalid bowler (not in fielding Playing XI)')
        return
      }
      if (payload.wicket?.fielderId && !set.has(String(payload.wicket.fielderId))) {
        toast.error('Invalid fielder (not in fielding Playing XI)')
        return
      }
    }
    // For ICC correctness, keep non-striker for all legal deliveries
    const requiresNonStriker = payload.kind === 'normal' || payload.kind === 'bye' || payload.kind === 'leg-bye' || payload.kind === 'wicket'
    if (requiresNonStriker && !selectedNonStriker) {
      toast.error('Please select non-striker')
      return
    }

    try {
      setSubmitting(true)

      // Determine free-hit for NEXT delivery (no-ball => next is free hit; wide does not consume free hit)
      const nextFreeHit = payload.kind === 'no-ball' ? true : payload.kind === 'wide' ? isFreeHit : false

      const lastSeq = Number(lastBall?.sequence || 0)
      const sequence = lastSeq + 1

      const isLegal = payload.isLegal

      const legalBalls = Number(currentInnings?.legalBalls || 0)
      const ballsInCurrentOver = Number((currentInnings as any)?.ballsInCurrentOver || (legalBalls % 6))
      const overNumber = Math.floor(legalBalls / 6) + 1
      const ballInOver = isLegal ? ballsInCurrentOver : null

      // Free hit delivery flag should persist on the ball itself (even if a run-out wicket happens).
      const ballData: Omit<Ball, 'id'> = {
        matchId,
        inningId,
        sequence,
        overNumber,
        ballInOver,
        // Backward-compatible field used by some UI bits (e.g. last ball display)
        ...( { type: payload.kind } as any ),
        batsmanId: selectedStriker,
        nonStrikerId: selectedNonStriker || '',
        bowlerId: selectedBowler,
        runsOffBat: payload.runsOffBat,
        extras: payload.extras as any,
        totalRuns: payload.totalRuns,
        isLegal,
        wicket: payload.wicket as any,
        freeHit: isFreeHit,
        timestamp: Timestamp.now(),
        createdAt: new Date().toISOString(),
      }

      const ballsRef = collection(
        db,
        COLLECTIONS.MATCHES,
        matchId,
        SUBCOLLECTIONS.INNINGS,
        inningId,
        SUBCOLLECTIONS.BALLS
      )
      const ballDoc = await addDoc(ballsRef, ballData as any)

      // Update free hit state (no-ball -> next ball is free hit)
      setIsFreeHit(nextFreeHit)

      // Recalculate innings and persist so public pages show data
      // IMPORTANT: Firestore reads right after a write can sometimes lag; force-include the new ball for recalculation.
      const newBall = { id: ballDoc.id, ...ballData } as Ball
      let ballsForRecalc: Ball[] = []
      try {
        ballsForRecalc = await matchService.getBalls(matchId, inningId)
      } catch {
        ballsForRecalc = []
      }
      if (!ballsForRecalc.some((b) => b.id === newBall.id || b.sequence === newBall.sequence)) {
        ballsForRecalc = [...ballsForRecalc, newBall].sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
      }
      const computed = await recomputeAndSave(
        ballsForRecalc,
        payload.meta?.preferredNextBatterId && payload.meta?.preferredNextSlot
          ? { slot: payload.meta.preferredNextSlot, playerId: payload.meta.preferredNextBatterId }
          : undefined,
        nextFreeHit
      )

      // AI commentary (TV-style) -> saved to matches/{matchId}/commentary so public page shows it too
      if (autoAiCommentary) {
        const batsmanName = playersById.get(selectedStriker)?.name || 'Batter'
        const bowlerName = playersById.get(selectedBowler)?.name || 'Bowler'
        const overLabel =
          typeof ballData.overNumber === 'number' && typeof (ballData as any).ballInOver === 'number'
            ? `${Math.max(0, (ballData.overNumber || 1) - 1)}.${Number((ballData as any).ballInOver) + 1}`
            : (computed as any)?.overs || '0.0'

        const isFour = payload.kind === 'normal' && payload.runsOffBat === 4
        const isSix = payload.kind === 'normal' && payload.runsOffBat === 6
        const isBoundary = isFour || isSix

        const wicketTypeForAi =
          payload.kind === 'wicket'
            ? (payload.wicket?.type === 'run-out' ? 'Run Out'
              : payload.wicket?.type === 'hit-wicket' ? 'Hit Wicket'
              : payload.wicket?.type === 'obstructing-field' ? 'Obstructing Field'
              : payload.wicket?.type === 'lbw' ? 'LBW'
              : payload.wicket?.type === 'caught' ? 'Caught'
              : payload.wicket?.type === 'stumped' ? 'Stumped'
              : payload.wicket?.type === 'retired' ? 'Retired'
              : 'Bowled')
            : null

        const ballType =
          payload.kind === 'wide' ? 'wide'
            : payload.kind === 'no-ball' ? 'no-ball'
              : payload.kind === 'bye' ? 'bye'
                : payload.kind === 'leg-bye' ? 'leg-bye'
                  : 'normal'

        await generateAutoCommentary(matchId, inningId as any, {
          runs: payload.totalRuns,
          ballType: ballType as any,
          wicketType: wicketTypeForAi as any,
          batsman: batsmanName,
          bowler: bowlerName,
          isBoundary,
          isFour,
          isSix,
          over: overLabel,
          ball: Number((ballData as any).ballInOver ?? 0) + 1,
          matchContext: {
            currentScore: (computed as any)?.totalRuns || (currentInnings as any)?.totalRuns || 0,
            wickets: (computed as any)?.totalWickets || (currentInnings as any)?.totalWickets || 0,
            requiredRuns: (computed as any)?.requiredRuns,
            oversRemaining: (computed as any)?.ballsRemaining,
            isChase: inningId === 'teamB',
          },
          ballDocId: ballDoc.id,
          sequence,
          style: 'tv',
        } as any)
      }

      // Clear, visible feedback for wicket so scorer knows it executed
      if (payload.kind === 'wicket' && payload.wicket) {
        const outName = playersById.get(payload.wicket.dismissedPlayerId)?.name || 'Batter'
        const wicketLabel =
          payload.wicket.type === 'run-out' ? 'Run Out'
          : payload.wicket.type === 'hit-wicket' ? 'Hit Wicket'
          : payload.wicket.type === 'obstructing-field' ? 'Obstructing Field'
          : payload.wicket.type === 'lbw' ? 'LBW'
          : payload.wicket.type === 'caught' ? 'Caught'
          : payload.wicket.type === 'stumped' ? 'Stumped'
          : payload.wicket.type === 'retired' ? 'Retired'
          : 'Bowled'
        toast(`${outName} OUT (${wicketLabel})`, { icon: '🏏' } as any)
      }

      toast.success('Ball recorded')
    } catch (error) {
      console.error('Error adding ball:', error)
      toast.error('Failed to record ball')
    } finally {
      setSubmitting(false)
    }
  }

  const handleBallInput = async (runs: number, type: 'normal' | 'wide' | 'no-ball' | 'bye' | 'leg-bye' | 'wicket') => {
    // Backward-compatible quick buttons:
    // - wide/no-ball buttons record only the automatic +1 (runs parameter ignored for those)
    if (type === 'wide') {
      setExtrasModalType('wide')
      setWideExtraRuns(0)
      setExtrasModalOpen(true)
      return
    }
    if (type === 'no-ball') {
      setExtrasModalType('no-ball')
      setNoBallBatRuns(0)
      setNoBallExtraRuns(0)
      setExtrasModalOpen(true)
      return
    }
    if (type === 'bye') {
      setExtrasModalType('bye')
      setByeRuns(Math.max(0, runs || 1))
      setExtrasModalOpen(true)
      return
    }
    if (type === 'leg-bye') {
      setExtrasModalType('leg-bye')
      setLegByeRuns(Math.max(0, runs || 1))
      setExtrasModalOpen(true)
      return
    }
    if (type === 'wicket') {
      setWicketRuns(0)
      setWicketDismissed('striker')
      setWicketType('bowled')
      setWicketFielderId('')
      setWicketNextBatterId('')
      setWicketModalOpen(true)
      return
    }

    // normal
    return recordBall({
      kind: 'normal',
      runsOffBat: Math.max(0, runs),
      totalRuns: Math.max(0, runs),
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
      wicket: null,
      isLegal: true,
    })
  }

  const handleUndoLastBall = async () => {
    if (!lastBall || !matchId) return

    if (!confirm('Are you sure you want to undo the last ball?')) return

    try {
      setSubmitting(true)
      const inningId = effectiveCurrentBatting
      const ballRef = doc(
        db,
        COLLECTIONS.MATCHES,
        matchId,
        SUBCOLLECTIONS.INNINGS,
        inningId,
        SUBCOLLECTIONS.BALLS,
        lastBall.id!
      )
      // Remove linked commentary first (best-effort)
      try {
        if (lastBall.id) await deleteCommentaryForBall(matchId, lastBall.id)
      } catch (e) {
        console.warn('Failed to delete commentary for undone ball:', e)
      }
      const { deleteDoc } = await import('firebase/firestore')
      await deleteDoc(ballRef)

      await recomputeAndSave()
      await refreshLastBall()

      toast.success('Last ball undone')
    } catch (error) {
      console.error('Error undoing ball:', error)
      toast.error('Failed to undo ball')
    } finally {
      setSubmitting(false)
    }
  }

  const teamAName = match?.teamAName || match?.teamA || 'Team A'
  const teamBName = match?.teamBName || match?.teamB || 'Team B'
  const battingTeam = effectiveCurrentBatting === 'teamA' ? teamAName : teamBName

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Match not found</p>
        <Link to="/admin/matches" className="text-teal-600 hover:underline">
          Back to Matches
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link to="/admin/live" className="text-teal-600 hover:underline mb-2 inline-block">
            ← Back to Live Matches
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">
            Live Scoring: {teamAName} vs {teamBName}
          </h1>
          <p className="text-gray-600 mt-1">{battingTeam} batting</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap md:justify-end">
          <div
            className={`px-3 py-2 rounded-xl border text-sm font-semibold ${
              canScoreNow
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : needsNewBowler
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}
          >
            {canScoreNow ? 'Ready to score' : needsNewBowler ? 'Select new bowler' : 'Select players to start'}
          </div>
          <Link
            to={`/match/${matchId}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            View Public Page
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr_420px] gap-6">
        {/* Left Panel - Score Summary */}
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl shadow-lg p-6 text-white">
            <div className="mb-4">
              <div className="text-sm text-blue-200 mb-1">{battingTeam}</div>
              <div className="text-4xl font-extrabold">
                {currentInnings?.totalRuns || 0} / {currentInnings?.totalWickets || 0}
              </div>
              <div className="text-lg text-blue-200 mt-2">
                ({currentInnings?.overs || '0.0'}) overs
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-blue-700">
              <div>
                <div className="text-xs text-blue-200 mb-1">CRR</div>
                <div className="text-xl font-bold">
                  {currentInnings?.currentRunRate
                    ? parseFloat(String(currentInnings.currentRunRate)).toFixed(2)
                    : '0.00'}
                </div>
              </div>
              {currentInnings?.requiredRunRate && (
                <div>
                  <div className="text-xs text-blue-200 mb-1">RRR</div>
                  <div className="text-xl font-bold">
                    {parseFloat(String(currentInnings.requiredRunRate)).toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Player Selection */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold text-gray-900">Player Selection</h3>
              {(!strikerNonStrikerValid && selectedStriker && selectedNonStriker) ? (
                <span className="text-xs font-bold text-red-600">Invalid</span>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="text-xs text-gray-500">
                Options: Batters <span className="font-bold">{availableBatsmen.length}</span> • Bowlers{' '}
                <span className="font-bold">{availableBowlers.length}</span>
              </div>
              <button
                onClick={async () => {
                  if (!matchId || !match) return
                  if (!selectedStriker || !selectedNonStriker || !selectedBowler) {
                    toast.error('Select striker, non-striker and bowler first')
                    return
                  }
                  try {
                    const matchRef = doc(db, COLLECTIONS.MATCHES, matchId)
                    const innRef = doc(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.INNINGS, inningId)
                    await Promise.all([
                      updateDoc(matchRef, {
                        currentBatting: effectiveCurrentBatting,
                        currentStrikerId: selectedStriker,
                        currentNonStrikerId: selectedNonStriker,
                        nonStrikerId: selectedNonStriker,
                        currentBowlerId: selectedBowler,
                        updatedAt: Timestamp.now(),
                      } as any),
                      setDoc(
                        innRef,
                        {
                          currentStrikerId: selectedStriker,
                          nonStrikerId: selectedNonStriker,
                          currentBowlerId: selectedBowler,
                        } as any,
                        { merge: true }
                      ),
                    ])
                    setNeedsNewBowler(false)
                    setSuggestedNextBowlerId('')
                    toast.success('Player selection saved')
                  } catch (e: any) {
                    console.error('Failed to save player selection:', e)
                    toast.error(e?.message || 'Failed to save selection')
                  }
                }}
                className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Save Selection
              </button>
            </div>
            <div className="space-y-4">
              {needsNewBowler && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm font-semibold">
                  Over complete — select a new bowler (same bowler cannot bowl consecutive overs).
                </div>
              )}
              {suggestedNextBatterId && !selectedStriker && (
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-xs font-bold text-slate-500 mb-1">Suggested next batter</div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">
                      {playersById.get(suggestedNextBatterId)?.name || 'Next batter'}
                    </div>
                    <button
                      onClick={async () => {
                        setSelectedStriker(suggestedNextBatterId)
                        setSuggestedNextBatterId('')
                        if (matchId) {
                          const matchRef = doc(db, COLLECTIONS.MATCHES, matchId)
                          await updateDoc(matchRef, { currentStrikerId: suggestedNextBatterId } as any)
                        }
                      }}
                      className="px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700"
                    >
                      Set as Striker
                    </button>
                  </div>
                </div>
              )}
              {suggestedNextBowlerId && needsNewBowler && (
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="text-xs font-bold text-slate-500 mb-1">Suggested next bowler</div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">
                      {playersById.get(suggestedNextBowlerId)?.name || 'Next bowler'}
                    </div>
                    <button
                      onClick={async () => {
                        setSelectedBowler(suggestedNextBowlerId)
                        setSuggestedNextBowlerId('')
                        setNeedsNewBowler(false)
                        if (matchId) {
                          const matchRef = doc(db, COLLECTIONS.MATCHES, matchId)
                          await updateDoc(matchRef, { currentBowlerId: suggestedNextBowlerId } as any)
                        }
                      }}
                      className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
                    >
                      Set Bowler
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Striker *</label>
                <select
                  value={selectedStriker}
                  onChange={(e) => {
                    const next = e.target.value
                    setSelectedStriker(next)
                    if (next && next === selectedNonStriker) setSelectedNonStriker('')
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select Striker</option>
                  {availableBatsmen
                    .filter((p) => p.id !== selectedNonStriker)
                    .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Non-Striker *</label>
                <select
                  value={selectedNonStriker}
                  onChange={(e) => {
                    const next = e.target.value
                    setSelectedNonStriker(next)
                    if (next && next === selectedStriker) setSelectedStriker('')
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select Non-Striker</option>
                  {availableBatsmen
                    .filter((p) => p.id !== selectedStriker)
                    .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bowler *</label>
                <select
                  value={selectedBowler}
                  onChange={(e) => {
                    const next = e.target.value
                    setSelectedBowler(next)
                    if (needsNewBowler && next && next !== (match as any)?.lastOverBowlerId) {
                      setNeedsNewBowler(false)
                      setSuggestedNextBowlerId('')
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select Bowler</option>
                  {availableBowlers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* AI Controls */}
          <div className="bg-white rounded-xl shadow-md p-5 border border-gray-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-gray-900">Commentary</div>
                <div className="text-xs text-gray-500">Auto TV-style updates</div>
              </div>
              <button
                onClick={() => setAutoAiCommentary((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                  autoAiCommentary
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}
              >
                {autoAiCommentary ? 'AI: ON' : 'AI: OFF'}
              </button>
            </div>
          </div>

          {/* Partnership */}
          {currentInnings?.partnership && (
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Partnership</h3>
              <div className="text-2xl font-bold text-gray-900">
                {currentInnings.partnership.runs} ({currentInnings.partnership.balls})
              </div>
            </div>
          )}
        </div>

        {/* Center Panel - Scoring Console */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold text-gray-900">Ball Input</h3>
              <div className="text-xs font-bold text-gray-500">
                {submitting ? 'Recording…' : (isFreeHit ? 'FREE HIT' : '')}
              </div>
            </div>
            <div className="mb-4 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <span className="font-bold">ICC note:</span> Strike rotates on <span className="font-semibold">odd running runs</span> (1/3),
              not on 2. But at the <span className="font-semibold">end of the over</span> (ball 6), strike <span className="font-semibold">always swaps</span>.
            </div>

            {/* Runs Buttons */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[0, 1, 2, 3, 4, 6].map((runs) => (
                <button
                  key={runs}
                  onClick={() => handleBallInput(runs, 'normal')}
                  disabled={submitting || !canScoreNow || !strikerNonStrikerValid}
                  className={`px-6 py-4 rounded-lg font-bold text-lg transition ${
                    runs === 0
                      ? 'bg-gray-600 text-white hover:bg-gray-700'
                      : runs === 4
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : runs === 6
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-teal-600 text-white hover:bg-teal-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {runs}
                </button>
              ))}
            </div>

            {/* Special Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => handleBallInput(0, 'wicket')}
                disabled={submitting || !canScoreNow || !strikerNonStrikerValid}
                className="px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🏏 Wicket
              </button>
              <button
                onClick={() => handleBallInput(0, 'wide')}
                disabled={submitting || !canScoreNow || !strikerNonStrikerValid}
                className="px-4 py-3 bg-yellow-600 text-white rounded-lg font-semibold hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Wide
              </button>
              <button
                onClick={() => handleBallInput(0, 'no-ball')}
                disabled={submitting || !canScoreNow || !strikerNonStrikerValid}
                className="px-4 py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                No-Ball
              </button>
              <button
                onClick={() => handleBallInput(1, 'bye')}
                disabled={submitting || !canScoreNow || !strikerNonStrikerValid}
                className="px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Bye
              </button>
              <button
                onClick={() => handleBallInput(1, 'leg-bye')}
                disabled={submitting || !canScoreNow || !strikerNonStrikerValid}
                className="px-4 py-3 bg-pink-600 text-white rounded-lg font-semibold hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Leg-Bye
              </button>
            </div>

            {/* Simple advanced controls kept for Byes/Leg-byes + Wicket */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-gray-900">Byes / Leg-byes</div>
                  <div className="text-xs text-gray-500">legal balls</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Byes</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        max={6}
                        value={byeRuns}
                        onChange={(e) => setByeRuns(Number(e.target.value || 0))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <button
                        onClick={() =>
                          recordBall({
                            kind: 'bye',
                            runsOffBat: 0,
                            totalRuns: Math.max(0, byeRuns),
                            extras: { wides: 0, noBalls: 0, byes: Math.max(0, byeRuns), legByes: 0, penalty: 0 },
                            wicket: null,
                            isLegal: true,
                          })
                        }
                        disabled={submitting || !canScoreNow || !strikerNonStrikerValid}
                        className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Leg-byes</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        max={6}
                        value={legByeRuns}
                        onChange={(e) => setLegByeRuns(Number(e.target.value || 0))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <button
                        onClick={() =>
                          recordBall({
                            kind: 'leg-bye',
                            runsOffBat: 0,
                            totalRuns: Math.max(0, legByeRuns),
                            extras: { wides: 0, noBalls: 0, byes: 0, legByes: Math.max(0, legByeRuns), penalty: 0 },
                            wicket: null,
                            isLegal: true,
                          })
                        }
                        disabled={submitting || !canScoreNow || !strikerNonStrikerValid}
                        className="px-3 py-2 bg-pink-600 text-white rounded-lg text-sm font-bold hover:bg-pink-700 disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Free Hit Indicator */}
            {isFreeHit && (
              <div className="mb-4 p-3 bg-yellow-100 border-2 border-yellow-400 rounded-lg text-center">
                <span className="font-bold text-yellow-800">FREE HIT</span>
              </div>
            )}

            {/* Undo Button */}
            {lastBall && (
              <button
                onClick={handleUndoLastBall}
                className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
              >
                ↶ Undo Last Ball
              </button>
            )}

            {/* Last Event */}
            {lastBall && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Last Ball:</div>
                <div className="font-semibold text-gray-900">
                  {lastBall.wicket
                    ? (() => {
                        const outName = playersById.get(lastBall.wicket.dismissedPlayerId)?.name || 'Batter'
                        const wicketLabel =
                          lastBall.wicket.type === 'run-out' ? 'Run Out'
                          : lastBall.wicket.type === 'hit-wicket' ? 'Hit Wicket'
                          : lastBall.wicket.type === 'obstructing-field' ? 'Obstructing Field'
                          : lastBall.wicket.type === 'lbw' ? 'LBW'
                          : lastBall.wicket.type === 'caught' ? 'Caught'
                          : lastBall.wicket.type === 'stumped' ? 'Stumped'
                          : lastBall.wicket.type === 'retired' ? 'Retired'
                          : 'Bowled'
                        return `WICKET: ${outName} (${wicketLabel})`
                      })()
                    : `${lastBall.totalRuns} run${lastBall.totalRuns !== 1 ? 's' : ''} - ${(lastBall as any).type || 'normal'}`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Scorecards + Commentary */}
        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          {/* Batting Scorecard */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Batting</h3>
            <div className="space-y-2">
              {currentInnings?.batsmanStats?.slice(0, 5).map((batsman) => (
                <div
                  key={batsman.batsmanId}
                  className={`flex items-center justify-between p-2 rounded ${
                    batsman.batsmanId === selectedStriker ? 'bg-teal-50 border border-teal-200' : ''
                  }`}
                >
                  <div>
                    <div className="font-medium text-gray-900">{batsman.batsmanName}</div>
                    <div className="text-sm text-gray-600">
                      {batsman.runs} ({batsman.balls}) - SR: {(batsman.strikeRate || 0).toFixed(1)}
                    </div>
                  </div>
                  {batsman.batsmanId === selectedStriker && (
                    <span className="text-xs bg-teal-600 text-white px-2 py-1 rounded">ST</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bowling Scorecard */}
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Bowling</h3>
            <div className="space-y-2">
              {currentInnings?.bowlerStats?.slice(0, 5).map((bowler) => (
                <div
                  key={bowler.bowlerId}
                  className={`flex items-center justify-between p-2 rounded ${
                    bowler.bowlerId === selectedBowler ? 'bg-blue-50 border border-blue-200' : ''
                  }`}
                >
                  <div>
                    <div className="font-medium text-gray-900">{bowler.bowlerName}</div>
                    <div className="text-sm text-gray-600">
                      {bowler.overs} - {bowler.wickets}/{bowler.runsConceded} - Eco: {(bowler.economy || 0).toFixed(2)}
                    </div>
                  </div>
                  {bowler.bowlerId === selectedBowler && (
                    <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">BW</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Embedded AI Commentary */}
          <EmbeddedCommentary matchId={matchId!} inningId={inningId} />
        </div>
      </div>

      {/* Extras Modal */}
      {extrasModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-gray-900">
                  {extrasModalType === 'wide'
                    ? 'Wide Ball Details'
                    : extrasModalType === 'no-ball'
                      ? 'No-ball Details'
                      : extrasModalType === 'bye'
                        ? 'Bye Runs'
                        : 'Leg-bye Runs'}
                </div>
                <div className="text-xs text-gray-500">Add ICC details before saving the delivery</div>
              </div>
              <button
                onClick={() => setExtrasModalOpen(false)}
                className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {extrasModalType === 'wide' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Additional runs on wide (0–5)</label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={wideExtraRuns}
                      onChange={(e) => setWideExtraRuns(Number(e.target.value || 0))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <div className="text-xs text-gray-500 mt-1">Total = 1 (wide) + additional running runs</div>
                  </div>
                </>
              ) : extrasModalType === 'no-ball' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Bat runs (0–6)</label>
                    <input
                      type="number"
                      min={0}
                      max={6}
                      value={noBallBatRuns}
                      onChange={(e) => setNoBallBatRuns(Number(e.target.value || 0))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Extra running (0–5)</label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={noBallExtraRuns}
                      onChange={(e) => setNoBallExtraRuns(Number(e.target.value || 0))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="col-span-2 text-xs text-gray-500">
                    Total = 1 (no-ball) + bat runs + running runs
                  </div>
                </div>
              ) : extrasModalType === 'bye' ? (
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Bye runs (0–6)</label>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={byeRuns}
                    onChange={(e) => setByeRuns(Number(e.target.value || 0))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <div className="text-xs text-gray-500 mt-1">Legal delivery. Runs count as byes (batsman gets 0).</div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Leg-bye runs (0–6)</label>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={legByeRuns}
                    onChange={(e) => setLegByeRuns(Number(e.target.value || 0))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <div className="text-xs text-gray-500 mt-1">Legal delivery. Runs count as leg-byes (batsman gets 0).</div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setExtrasModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (extrasModalType === 'wide') {
                    await recordBall({
                      kind: 'wide',
                      runsOffBat: 0,
                      totalRuns: 1 + Math.max(0, wideExtraRuns),
                      extras: { wides: 1, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
                      wicket: null,
                      isLegal: false,
                    })
                  } else if (extrasModalType === 'no-ball') {
                    await recordBall({
                      kind: 'no-ball',
                      runsOffBat: Math.max(0, noBallBatRuns),
                      totalRuns: 1 + Math.max(0, noBallBatRuns) + Math.max(0, noBallExtraRuns),
                      extras: { wides: 0, noBalls: 1, byes: 0, legByes: 0, penalty: 0 },
                      wicket: null,
                      isLegal: false,
                    })
                  } else if (extrasModalType === 'bye') {
                    await recordBall({
                      kind: 'bye',
                      runsOffBat: 0,
                      totalRuns: Math.max(0, byeRuns),
                      extras: { wides: 0, noBalls: 0, byes: Math.max(0, byeRuns), legByes: 0, penalty: 0 },
                      wicket: null,
                      isLegal: true,
                    })
                  } else {
                    await recordBall({
                      kind: 'leg-bye',
                      runsOffBat: 0,
                      totalRuns: Math.max(0, legByeRuns),
                      extras: { wides: 0, noBalls: 0, byes: 0, legByes: Math.max(0, legByeRuns), penalty: 0 },
                      wicket: null,
                      isLegal: true,
                    })
                  }
                  setExtrasModalOpen(false)
                }}
                disabled={submitting || !isReadyToScore}
                className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wicket Modal */}
      {wicketModalOpen && (
        <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-red-600 to-rose-600 text-white flex items-start justify-between">
              <div>
                <div className="text-base font-extrabold tracking-tight flex items-center gap-2">
                  <span aria-hidden>🏏</span> Wicket
                </div>
                <div className="text-xs text-white/90 mt-0.5">Select wicket type and confirm who got out</div>
              </div>
              <button
                onClick={() => setWicketModalOpen(false)}
                className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-bold"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Striker: <span className="font-extrabold">{playersById.get(selectedStriker)?.name || '—'}</span>
                </span>
                <span className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Non-striker: <span className="font-extrabold">{playersById.get(selectedNonStriker)?.name || '—'}</span>
                </span>
                <span className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Bowler: <span className="font-extrabold">{playersById.get(selectedBowler)?.name || '—'}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-gray-700 mb-2">Wicket Type</label>
                  {isFreeHit ? (
                    <div className="mb-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                      Free Hit: wicket allowed only <span className="font-extrabold">Run Out</span>.
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {([
                      { v: 'bowled', label: 'Bowled', icon: '🎯' },
                      { v: 'caught', label: 'Caught', icon: '🤲' },
                      { v: 'lbw', label: 'LBW', icon: '🦵' },
                      { v: 'stumped', label: 'Stumped', icon: '🧤' },
                      { v: 'hit-wicket', label: 'Hit Wicket', icon: '💥' },
                      { v: 'run-out', label: 'Run Out', icon: '🏃' },
                      { v: 'obstructing-field', label: 'Obstruct', icon: '⛔' },
                      { v: 'retired', label: 'Retired', icon: '🩹' },
                    ] as const).map((opt) => {
                      const active = wicketType === opt.v
                      const disabled = isFreeHit && opt.v !== 'run-out'
                      return (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => {
                            if (disabled) return
                            setWicketType(opt.v as any)
                          }}
                          disabled={disabled}
                          className={[
                            'px-3 py-2.5 rounded-xl border text-left transition',
                            'flex items-center gap-2',
                            active
                              ? 'bg-rose-50 border-rose-300 text-rose-900 shadow-sm'
                              : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50',
                            disabled ? 'opacity-50 cursor-not-allowed hover:bg-white' : '',
                          ].join(' ')}
                          aria-pressed={active}
                        >
                          <span className="text-base" aria-hidden>
                            {opt.icon}
                          </span>
                          <span className="text-xs font-extrabold leading-tight">{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-2">
                    Run Out ছাড়া সব wicket type‑এ dismissed batter <span className="font-bold">Striker</span> (locked).
                  </div>
                </div>

                {wicketType === 'run-out' ? (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-extrabold text-gray-700 mb-1">Who is Out?</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWicketDismissed('striker')}
                        className={[
                          'px-3 py-2.5 rounded-xl border text-sm font-extrabold text-left transition',
                          wicketDismissed === 'striker'
                            ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-sm'
                            : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50',
                        ].join(' ')}
                      >
                        <div className="text-xs opacity-70 font-bold">Striker</div>
                        <div className="truncate">{playersById.get(selectedStriker)?.name || '—'}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWicketDismissed('nonStriker')}
                        disabled={!selectedNonStriker}
                        className={[
                          'px-3 py-2.5 rounded-xl border text-sm font-extrabold text-left transition',
                          wicketDismissed === 'nonStriker'
                            ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-sm'
                            : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50',
                          !selectedNonStriker ? 'opacity-50 cursor-not-allowed' : '',
                        ].join(' ')}
                      >
                        <div className="text-xs opacity-70 font-bold">Non-striker</div>
                        <div className="truncate">{playersById.get(selectedNonStriker)?.name || '—'}</div>
                      </button>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      Run Out হলে striker বা non-striker যেকেউ out হতে পারে—এখান থেকে select করুন।
                    </div>
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-extrabold text-gray-700 mb-1">Dismissed</label>
                    <div className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between">
                      <div className="text-sm font-extrabold text-gray-900">
                        Striker <span className="text-gray-500 font-bold">({playersById.get(selectedStriker)?.name || '—'})</span>
                      </div>
                      <span className="text-[11px] font-extrabold px-2 py-1 rounded-full bg-gray-200 text-gray-700">
                        Locked
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      এই wicket type‑এ out সবসময় striker হবে।
                    </div>
                  </div>
                )}

                {wicketType === 'caught' && (
                <div className="sm:col-span-2">
                    <label className="block text-xs font-extrabold text-gray-700 mb-1">Caught by (fielder)</label>
                    <select
                      value={wicketFielderId}
                      onChange={(e) => setWicketFielderId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400"
                    >
                      <option value="">Select fielder (optional)</option>
                      {availableBowlers.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-gray-500 mt-2">
                      Caught out হলে কে catch নিয়েছে সেটা এখানে select করুন।
                    </div>
                  </div>
                )}

                {/* Next batter selection (choose who comes in immediately after wicket) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-extrabold text-gray-700 mb-1">
                    Next batter (comes in after wicket)
                  </label>
                  {(() => {
                    const replacingSlot =
                      wicketType === 'run-out'
                        ? (wicketDismissed === 'nonStriker' ? 'nonStriker' : 'striker')
                        : 'striker'
                    const candidates = getNextBatterCandidates(replacingSlot === 'striker' ? [selectedNonStriker] : [selectedStriker])
                    if (candidates.length === 0) {
                      return (
                        <div className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-700">
                          No next batter available (check Playing XI)
                        </div>
                      )
                    }
                    return (
                      <>
                        <select
                          value={wicketNextBatterId}
                          onChange={(e) => setWicketNextBatterId(e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400"
                        >
                          {candidates.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        <div className="text-xs text-gray-500 mt-2">
                          এই batter <span className="font-bold">{replacingSlot === 'striker' ? 'Striker' : 'Non-striker'}</span> slot‑এ আসবে।
                        </div>
                      </>
                    )
                  })()}
                </div>

                {wicketType === 'run-out' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-extrabold text-gray-700 mb-1">Runs completed before Run Out (0–3)</label>
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={wicketRuns}
                    onChange={(e) => setWicketRuns(Number(e.target.value || 0))}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-400"
                  />
                    <div className="text-xs text-gray-500 mt-1">Run out হওয়ার আগে যত রান complete হয়েছে (max 3).</div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 bg-white flex items-center justify-between gap-3">
              <div className="text-[11px] text-gray-500">
                {wicketType === 'run-out' ? 'Tip: Fielder name চাইলে পরে scorecard notes/summary থেকে add করা যাবে।' : 'Tip: Next batter suggestion স্বয়ংক্রিয়ভাবে আসবে।'}
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setWicketModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-extrabold text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (wicketType === 'run-out' && wicketDismissed === 'nonStriker' && !selectedNonStriker) {
                      toast.error('Please select non-striker')
                      return
                    }
                    const replacingSlot =
                      wicketType === 'run-out'
                        ? (wicketDismissed === 'nonStriker' ? 'nonStriker' : 'striker')
                        : 'striker'
                    const candidates = getNextBatterCandidates(replacingSlot === 'striker' ? [selectedNonStriker] : [selectedStriker])
                    if (candidates.length > 0 && !wicketNextBatterId) {
                      toast.error('Please select next batter')
                      return
                    }
                    const dismissedId =
                      wicketType === 'run-out'
                        ? (wicketDismissed === 'nonStriker' ? selectedNonStriker : selectedStriker)
                        : selectedStriker

                    const credited =
                      wicketType === 'run-out' || wicketType === 'obstructing-field' || wicketType === 'retired'
                        ? false
                        : true

                    await recordBall({
                      kind: 'wicket',
                      runsOffBat: Math.max(0, wicketRuns),
                      totalRuns: Math.max(0, wicketRuns),
                      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
                      wicket: {
                        type: wicketType,
                        dismissedPlayerId: dismissedId || selectedStriker,
                        creditedToBowler: credited,
                        bowlerId: selectedBowler,
                        ...(wicketType === 'caught' && wicketFielderId ? { fielderId: wicketFielderId } : {}),
                      },
                      isLegal: true,
                      meta: {
                        preferredNextBatterId: wicketNextBatterId || '',
                        preferredNextSlot: replacingSlot,
                      },
                    })
                    await refreshLastBall()
                    setWicketModalOpen(false)
                  }}
                  disabled={submitting || !canScoreNow}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-extrabold disabled:opacity-50"
                >
                  Record Wicket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

