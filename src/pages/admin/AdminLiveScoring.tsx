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
import { generateCommentary } from '@/services/ai/aiCommentary' // RESTORED

import { deleteCommentaryForBall } from '@/services/commentary/commentaryService'
import { useAuthStore } from '@/store/authStore'
import { checkIfAdmin } from '@/utils/createAdmin'

export default function AdminLiveScoring() {
  const { matchId } = useParams<{ matchId: string }>()
  const { user } = useAuthStore()
  const [match, setMatch] = useState<Match | null>(null)
  const [isAdminVerified, setIsAdminVerified] = useState<boolean | null>(null)
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
  // const [autoAiCommentary, setAutoAiCommentary] = useState(true)  // Scoring Modifiers State
  const [activeBowlerType, setActiveBowlerType] = useState<'normal' | 'wide' | 'no-ball'>('normal')
  const [activeRunsType, setActiveRunsType] = useState<'bat' | 'bye' | 'leg-bye'>('bat')

  // Modals
  const [wicketModalOpen, setWicketModalOpen] = useState(false)
  const [needsNewBowler, setNeedsNewBowler] = useState(false)
  const [suggestedNextBatterId, setSuggestedNextBatterId] = useState<string>('')
  const [suggestedNextBowlerId, setSuggestedNextBowlerId] = useState<string>('')
  const [showNextBatterModal, setShowNextBatterModal] = useState(false)
  const [nextBatterSlot, setNextBatterSlot] = useState<'striker' | 'nonStriker' | null>(null)
  const [lastOverBowlerId, setLastOverBowlerId] = useState<string>('')
  const [allowManualStrikeControl, setAllowManualStrikeControl] = useState(false)
  const [matchFinished, setMatchFinished] = useState<boolean>(false)
  const [isRotated, setIsRotated] = useState<boolean>(false)
  const [rotationApplied, setRotationApplied] = useState<boolean>(false)
  const [wasUndone, setWasUndone] = useState<boolean>(false)
  const [undoPerformed, setUndoPerformed] = useState<boolean>(false)

  // Wicket & Dismissal State
  const [wicketType, setWicketType] = useState<'bowled' | 'caught' | 'lbw' | 'run-out' | 'stumped' | 'hit-wicket' | 'obstructing-field' | 'retired'>('bowled')
  const [wicketRuns, setWicketRuns] = useState<number>(0)
  const [wicketDismissed, setWicketDismissed] = useState<'striker' | 'nonStriker'>('striker')
  const [wicketFielderId, setWicketFielderId] = useState<string>('') // caught fielder (optional)
  const [wicketNextBatterId, setWicketNextBatterId] = useState<string>('') // user-selected next batter for wicket
  const [manualCommentary, setManualCommentary] = useState('')
  const [swappingStrike, setSwappingStrike] = useState(false)

  const handleSwapStrike = async () => {
    if (!matchId || !selectedStriker || !selectedNonStriker || swappingStrike) return
    try {
      setSwappingStrike(true)
      const tempStriker = selectedStriker
      const tempNonStriker = selectedNonStriker

      setSelectedStriker(tempNonStriker)
      setSelectedNonStriker(tempStriker)

      const matchRef = doc(db, COLLECTIONS.MATCHES, matchId)
      const innRef = doc(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.INNINGS, inningId)

      await Promise.all([
        updateDoc(matchRef, {
          currentStrikerId: tempNonStriker,
          currentNonStrikerId: tempStriker,
          nonStrikerId: tempStriker,
          updatedAt: Timestamp.now()
        } as any),
        setDoc(innRef, {
          currentStrikerId: tempNonStriker,
          nonStrikerId: tempStriker
        } as any, { merge: true })
      ])

      toast.success('Strike rotated', { icon: '🔄' } as any)
    } catch (err) {
      console.error('Failed to swap strike:', err)
      toast.error('Failed to rotate strike')
    } finally {
      setSwappingStrike(false)
    }
  }

  // Check if both teams have complete Playing XI (11 players each)
  const hasCompletePlayingXI = useMemo(() => {
    if (!match) return true; // If no match loaded yet, allow for now

    const teamAXI = match.teamAPlayingXI || [];
    const teamBXI = match.teamBPlayingXI || [];

    // Both teams must have exactly 11 players to start the match
    const hasTeamAComplete = teamAXI.length === 11;
    const hasTeamBComplete = teamBXI.length === 11;

    return hasTeamAComplete && hasTeamBComplete;
  }, [match]);

  // Function to apply player rotation between innings
  const applyPlayerRotation = async () => {
    if (!matchId || !match || rotationApplied || !isRotated) return;

    try {
      // Get both team's playing XI
      const teamABattingXI = match.teamAPlayingXI || [];
      const teamBBattingXI = match.teamBPlayingXI || [];

      // If current batting team is teamA, then teamB is bowling and vice versa
      const currentBattingTeam = effectiveCurrentBatting;
      let newStrikerId = '';
      let newNonStrikerId = '';
      let newBowlerId = '';

      if (currentBattingTeam === 'teamA') {
        // Team A is batting, Team B is bowling
        // For second innings, swap: former bowlers (Team B) now bat, former batters (Team A) now bowl
        if (match.matchPhase === 'SecondInnings') {
          // Select from team B (former bowlers) to bat
          if (teamBBattingXI.length > 0) {
            newStrikerId = teamBBattingXI[0] || '';
            // Pick next available player for non-striker, ensuring it's different from striker
            newNonStrikerId = teamBBattingXI.find((id: string, idx: number) =>
              idx > 0 && id !== newStrikerId
            ) || (teamBBattingXI.length > 1 ? teamBBattingXI[1] : '');
          }
          // Select from team A (former batters) to bowl
          if (teamABattingXI.length > 0) {
            newBowlerId = teamABattingXI[0] || '';
            // Ensure bowler is not one of the batters
            if (newBowlerId === newStrikerId || newBowlerId === newNonStrikerId) {
              newBowlerId = teamABattingXI.find((id: string) =>
                id !== newStrikerId && id !== newNonStrikerId
              ) || newBowlerId;
            }
          }
        } else {
          // First innings - use normal XI
          if (teamABattingXI.length > 0) {
            newStrikerId = teamABattingXI[0] || '';
            // Pick next available player for non-striker, ensuring it's different from striker
            newNonStrikerId = teamABattingXI.find((id: string, idx: number) =>
              idx > 0 && id !== newStrikerId
            ) || (teamABattingXI.length > 1 ? teamABattingXI[1] : '');
          }
          if (teamBBattingXI.length > 0) {
            newBowlerId = teamBBattingXI[0] || '';
            // Ensure bowler is not one of the batters
            if (newBowlerId === newStrikerId || newBowlerId === newNonStrikerId) {
              newBowlerId = teamBBattingXI.find((id: string) =>
                id !== newStrikerId && id !== newNonStrikerId
              ) || newBowlerId;
            }
          }
        }
      } else {
        // Team B is batting, Team A is bowling
        if (match.matchPhase === 'SecondInnings') {
          // Select from team A (former bowlers) to bat
          if (teamABattingXI.length > 0) {
            newStrikerId = teamABattingXI[0] || '';
            // Pick next available player for non-striker, ensuring it's different from striker
            newNonStrikerId = teamABattingXI.find((id: string, idx: number) =>
              idx > 0 && id !== newStrikerId
            ) || (teamABattingXI.length > 1 ? teamABattingXI[1] : '');
          }
          // Select from team B (former batters) to bowl
          if (teamBBattingXI.length > 0) {
            newBowlerId = teamBBattingXI[0] || '';
            // Ensure bowler is not one of the batters
            if (newBowlerId === newStrikerId || newBowlerId === newNonStrikerId) {
              newBowlerId = teamBBattingXI.find((id: string) =>
                id !== newStrikerId && id !== newNonStrikerId
              ) || newBowlerId;
            }
          }
        } else {
          // First innings - use normal XI
          if (teamBBattingXI.length > 0) {
            newStrikerId = teamBBattingXI[0] || '';
            // Pick next available player for non-striker, ensuring it's different from striker
            newNonStrikerId = teamBBattingXI.find((id: string, idx: number) =>
              idx > 0 && id !== newStrikerId
            ) || (teamBBattingXI.length > 1 ? teamBBattingXI[1] : '');
          }
          if (teamABattingXI.length > 0) {
            newBowlerId = teamABattingXI[0] || '';
            // Ensure bowler is not one of the batters
            if (newBowlerId === newStrikerId || newBowlerId === newNonStrikerId) {
              newBowlerId = teamABattingXI.find((id: string) =>
                id !== newStrikerId && id !== newNonStrikerId
              ) || newBowlerId;
            }
          }
        }
      }

      // Update selections
      if (newStrikerId && !selectedStriker) setSelectedStriker(newStrikerId);
      if (newNonStrikerId && !selectedNonStriker) setSelectedNonStriker(newNonStrikerId);
      if (newBowlerId && !selectedBowler) setSelectedBowler(newBowlerId);

      // Also update match document with these selections
      if (newStrikerId || newNonStrikerId || newBowlerId) {
        const matchRef = doc(db, COLLECTIONS.MATCHES, matchId);
        const updateObj: any = {};
        if (newStrikerId) updateObj.currentStrikerId = newStrikerId;
        if (newNonStrikerId) {
          updateObj.currentNonStrikerId = newNonStrikerId;
          updateObj.nonStrikerId = newNonStrikerId;
        }
        if (newBowlerId) updateObj.currentBowlerId = newBowlerId;
        updateObj.updatedAt = Timestamp.now();

        await updateDoc(matchRef, updateObj);
      }

      setRotationApplied(true);
      toast.success('Player rotation applied for second innings');
    } catch (error) {
      console.error('Error applying player rotation:', error);
      toast.error('Failed to apply player rotation');
    }
  };

  // Wicket rules:
  // - Run Out: can dismiss striker OR non-striker (admin selects)
  // - Others: always striker out (lock selection)
  useEffect(() => {
    if (!wicketModalOpen) return
    if (wicketType !== 'run-out' && wicketType !== 'retired') {
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
      ; (currentInnings?.batsmanStats || []).forEach((b: any) => used.add(b.batsmanId))
      ; (currentInnings?.fallOfWickets || []).forEach((f: any) => used.add(f.batsmanId))
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
    const replacingSlot = (wicketType === 'run-out' || wicketType === 'retired') ? (wicketDismissed === 'nonStriker' ? 'nonStriker' : 'striker') : 'striker'
    const candidates = getNextBatterCandidates(replacingSlot === 'striker' ? [selectedNonStriker] : [selectedStriker])
    if (candidates.length === 0) return
    if (!wicketNextBatterId || !candidates.some((c) => c.id === wicketNextBatterId)) {
      setWicketNextBatterId(candidates[0].id)
    }
  }, [selectedNonStriker, selectedStriker, wicketDismissed, wicketModalOpen, wicketNextBatterId, wicketType])

  // Verify admin status on mount
  useEffect(() => {
    const verifyAdmin = async () => {
      if (!user) {
        setIsAdminVerified(false)
        return
      }
      try {
        const admin = await checkIfAdmin()
        setIsAdminVerified(admin)
        if (!admin) {
          toast.error('Admin access required. Please check your permissions.', { duration: 5000 } as any)
        }
      } catch (error) {
        console.error('Error verifying admin:', error)
        setIsAdminVerified(false)
      }
    }
    verifyAdmin()
  }, [user])

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
    updateDoc(ref, { currentBatting: desired } as any).catch(() => { })
  }, [match, matchId, teamAInnings, teamBInnings])

  // Initialize last over bowler from match data
  useEffect(() => {
    if (match && match.lastOverBowlerId) {
      setLastOverBowlerId(match.lastOverBowlerId);
    }
  }, [match]);

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
  const canScoreNow = isReadyToScore && !needsNewBowler && !matchFinished && hasCompletePlayingXI

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

    // Get dismissed players in this innings
    const dismissedIds = new Set<string>()
    if (currentInnings?.fallOfWickets) {
      currentInnings.fallOfWickets.forEach((f: any) => {
        if (f.batsmanId) dismissedIds.add(String(f.batsmanId))
      })
    }

    const xiIds = getBattingPlayingXI()
    let pool: any[] = []

    if (xiIds.length > 0) {
      // Strict conformance to XI
      pool = xiIds.map((id) => getPlayerWithId(id)).filter(Boolean)
    } else {
      // Legacy fallback (XI not set): infer batting squadId reliably from striker/xi; then filter by squadId.
      const squadId = inferBattingSquadId()
      if (squadId) {
        pool = players.filter((p) => String((p as any).squadId || '') === squadId)
      } else {
        pool = players
      }
    }

    // Filter out dismissed players
    return pool.filter(p => !dismissedIds.has(String(p.id)))
  }, [effectiveCurrentBatting, match, players, playersById, currentInnings?.fallOfWickets])

  const availableBowlers = useMemo(() => {
    if (!match) return [] as any[]
    const xiIds = getFieldingPlayingXI()

    let candidates: any[] = []

    if (xiIds.length > 0) {
      candidates = xiIds.map((id) => getPlayerWithId(id)).filter(Boolean)
    } else {
      // Legacy fallback
      const squadId = inferFieldingSquadId()
      if (squadId) {
        candidates = players.filter((p) => String((p as any).squadId || '') === squadId)
      } else {
        const battingSid = inferBattingSquadId()
        if (battingSid) {
          candidates = players.filter((p) => String((p as any).squadId || '') && String((p as any).squadId || '') !== battingSid)
        } else {
          candidates = players
        }
      }
    }

    // Filter out Wicket Keepers
    // A player cannot bowl if they are the Wicket Keeper.
    // We check player 'role' or if they are 'wicket-keeper'.
    // Also, if matched logic has a specific wicketKeeperId field (future proof), check that.
    return candidates.filter(p => {
      const role = String(p.role || '').toLowerCase()
      if (role === 'wicket-keeper') return false
      if (match && (match as any).wicketKeeperId === p.id) return false
      return true
    })
  }, [effectiveCurrentBatting, match, players, playersById])

  // Hard guard: striker/non-striker must be from batting XI, bowler must be from fielding XI.
  // If a mismatch happens due to data issues, auto-clear to prevent scoring with wrong team players.
  useEffect(() => {
    if (!match) return
    const batXI = getBattingPlayingXI()
    const bowlXI = getFieldingPlayingXI()
    if (batXI.length > 0) {
      const set = new Set<string>(batXI.map(String))
      if (selectedStriker && !set.has(String(selectedStriker))) setSelectedStriker('')
      if (selectedNonStriker && !set.has(String(selectedNonStriker))) setSelectedNonStriker('')
    }
    if (bowlXI.length > 0) {
      const set = new Set<string>(bowlXI.map(String))
      if (selectedBowler && !set.has(String(selectedBowler))) setSelectedBowler('')
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
    nextFreeHit?: boolean,
    bowlerOverride?: string,
  ): Promise<InningsStats | null> => {
    if (!matchId || !match) return null

    const balls = ballsOverride ?? (await matchService.getBalls(matchId, inningId))

    // Compute "next delivery is free hit" from the ball stream.
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
        currentBowlerId: bowlerOverride || (match as any).currentBowlerId || selectedBowler,
        target: (currentInnings as any)?.target,
      },
    })

    // Safety: ensure dismissed batter is not still shown as current striker/non-striker.
    const lastBallInStream = balls[balls.length - 1]
    const dismissedFromLastBall = lastBallInStream?.wicket?.dismissedPlayerId || ''
    if (dismissedFromLastBall) {
      if (dismissedFromLastBall === (lastBallInStream as any)?.batsmanId) {
        computed.currentStrikerId = ''
      }
      if (dismissedFromLastBall === (lastBallInStream as any)?.nonStrikerId) {
        ; (computed as any).nonStrikerId = ''
      }
    }

    if (preferredNext?.playerId) {
      const pid = preferredNext.playerId
      const other =
        preferredNext.slot === 'striker'
          ? String((computed as any).nonStrikerId || '')
          : String(computed.currentStrikerId || '')
      if (pid && pid !== other) {
        if (preferredNext.slot === 'striker' && !computed.currentStrikerId) computed.currentStrikerId = pid
        if (preferredNext.slot === 'nonStriker' && !(computed as any).nonStrikerId) { (computed as any).nonStrikerId = pid }
      }
    }

    const initialNextStriker = computed.currentStrikerId || ''
    const initialNextNonStriker = (computed as any).nonStrikerId || ''
    if (!initialNextStriker || !initialNextNonStriker) {
      const excludeBase = [initialNextStriker, initialNextNonStriker].filter(Boolean)
      const suggestedForStriker = !initialNextStriker ? suggestNextBatter(balls, excludeBase) : ''
      const suggestedForNonStriker = !initialNextNonStriker
        ? suggestNextBatter(balls, [...excludeBase, suggestedForStriker].filter(Boolean))
        : ''

      if (!initialNextStriker && suggestedForStriker) computed.currentStrikerId = suggestedForStriker
      if (!initialNextNonStriker && suggestedForNonStriker) { (computed as any).nonStrikerId = suggestedForNonStriker }

      if (!computed.currentStrikerId) {
        const suggested = suggestNextBatter(balls, [String((computed as any).nonStrikerId || '')].filter(Boolean))
        setSuggestedNextBatterId(suggested)
      } else {
        setSuggestedNextBatterId('')
      }
    } else {
      setSuggestedNextBatterId('')
    }

    computed.batsmanStats = computed.batsmanStats.map((b) => ({
      ...b,
      batsmanName: playersById.get(b.batsmanId)?.name || b.batsmanName || 'Batter',
    }))

    const wicketBallByDismissed = new Map<string, Ball>()
    balls.forEach((bb) => {
      const d = String(bb?.wicket?.dismissedPlayerId || '').trim()
      if (d) wicketBallByDismissed.set(d, bb)
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

    computed.batsmanStats = computed.batsmanStats.map((b: any) => {
      if (b.notOut) return b
      const wb = wicketBallByDismissed.get(String(b.batsmanId || '').trim())
      const dText = dismissalTextFromBall(wb || null)
      return { ...b, dismissal: dText }
    })

    const ensureBatsmanRow = (batsmanId: string) => {
      if (!batsmanId) return
      if (computed.batsmanStats.some((b) => b.batsmanId === batsmanId)) return
      computed.batsmanStats.push({
        batsmanId,
        batsmanName: playersById.get(batsmanId)?.name || 'Batter',
        runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, notOut: true,
      })
    }
    ensureBatsmanRow(computed.currentStrikerId || '')
    ensureBatsmanRow(String((computed as any).nonStrikerId || ''))

    computed.bowlerStats = computed.bowlerStats.map((b) => ({
      ...b,
      bowlerName: playersById.get(b.bowlerId)?.name || b.bowlerName || 'Bowler',
    }))

    computed.fallOfWickets = computed.fallOfWickets.map((f: any) => {
      const wb = wicketBallByDismissed.get(String(f.batsmanId || '').trim())
      return {
        ...f,
        batsmanName: playersById.get(f.batsmanId)?.name || f.batsmanName || 'Batter',
        dismissal: dismissalTextFromBall(wb || null),
      }
    })

    await persistInnings(computed)

    const matchRef = doc(db, COLLECTIONS.MATCHES, matchId)
    const last = balls[balls.length - 1]
    const overEnded = Boolean(last && last.isLegal && (last as any).ballInOver === 5)

    const oversLimit = Number(match.oversLimit || 20)
    const inningsBallsLimit = Math.max(0, oversLimit * 6)
    const isOversComplete = inningsBallsLimit > 0 && Number(computed.legalBalls || 0) >= inningsBallsLimit
    const isAllOut = Number(computed.totalWickets || 0) >= 10
    const isTargetReached = computed.target && computed.totalRuns >= computed.target
    const inningsComplete = isOversComplete || isAllOut || isTargetReached

    if (inningsComplete) {
      const nextBatting: 'teamA' | 'teamB' = inningId === 'teamA' ? 'teamB' : 'teamA'
      const isSecondInningsPhase = String((match as any)?.matchPhase || '') === 'SecondInnings'

      const otherInnings = nextBatting === 'teamA' ? teamAInnings : teamBInnings
      const otherStarted = Number((otherInnings as any)?.legalBalls || 0) > 0 || Number((otherInnings as any)?.totalRuns || 0) > 0

      if (!isSecondInningsPhase && !otherStarted) {
        const target = Number(computed.totalRuns || 0) + 1
        const nextInningsRef = doc(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.INNINGS, nextBatting)
        await setDoc(nextInningsRef, {
          matchId, inningId: nextBatting, totalRuns: 0, totalWickets: 0, legalBalls: 0, overs: '0.0',
          ballsInCurrentOver: 0, currentRunRate: 0, requiredRunRate: null, remainingBalls: null,
          target, projectedTotal: null, lastBallSummary: null, partnership: { runs: 0, balls: 0, overs: '0.0' },
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
          fallOfWickets: [], batsmanStats: [], bowlerStats: [], recentOvers: [], currentOverBalls: [],
          currentStrikerId: '', nonStrikerId: '', currentBowlerId: '', lastUpdated: Timestamp.now(), updatedAt: new Date().toISOString(),
        } as any, { merge: true })

        await updateDoc(matchRef, {
          matchPhase: 'SecondInnings', currentBatting: nextBatting, status: 'live',
          currentStrikerId: '', currentNonStrikerId: '', nonStrikerId: '', currentBowlerId: '',
          lastOverBowlerId: '', freeHit: false, updatedAt: Timestamp.now(),
        } as any)

        setIsFreeHit(false); setNeedsNewBowler(false); setSuggestedNextBowlerId(''); setSuggestedNextBatterId('');
        setSelectedStriker(''); setSelectedNonStriker(''); setSelectedBowler('');
        setIsRotated(false); setRotationApplied(false);
        toast('Innings complete. 2nd innings starting.', { icon: '⏸️' } as any)
        return computed
      } else {
        // MATCH FINISHED
        let resultText = ''
        const teamAStats = inningId === 'teamA' ? computed : teamAInnings
        const teamBStats = inningId === 'teamB' ? computed : teamBInnings

        const scoreA = (teamAStats as any)?.totalRuns || 0
        const scoreB = (teamBStats as any)?.totalRuns || 0
        const wicketsA = (teamAStats as any)?.totalWickets || 0
        const wicketsB = (teamBStats as any)?.totalWickets || 0

        // Determine who batted first/second based on match.currentBatting at start or toss
        // For simplicity: if teamB just finished, they were chasing (usually)
        // Better: check which innings had the 'target' field.
        const firstInningsTeam = (teamAStats as any)?.target ? 'teamB' : 'teamA'

        if (scoreA === scoreB) {
          resultText = 'Match tied'
        } else if (scoreB > scoreA) {
          // Team B won
          if (firstInningsTeam === 'teamA') {
            // Team B was chasing
            const wicketsRemaining = 10 - wicketsB
            resultText = `${match?.teamBName || 'Team B'} won by ${wicketsRemaining} wickets`
          } else {
            // Team B was defending
            resultText = `${match?.teamBName || 'Team B'} won by ${scoreB - scoreA} runs`
          }
        } else {
          // Team A won
          if (firstInningsTeam === 'teamB') {
            // Team A was chasing
            const wicketsRemaining = 10 - wicketsA
            resultText = `${match?.teamAName || 'Team A'} won by ${wicketsRemaining} wickets`
          } else {
            // Team A was defending
            resultText = `${match?.teamAName || 'Team A'} won by ${scoreA - scoreB} runs`
          }
        }

        await updateDoc(matchRef, {
          matchPhase: 'finished', status: 'finished', freeHit: false,
          resultSummary: resultText, updatedAt: Timestamp.now()
        } as any)

        setIsFreeHit(false)
        setMatchFinished(true)
        toast(`Match finished. ${resultText}`, { icon: '🏁' } as any)
        return computed
      }
    }

    await updateDoc(matchRef, {
      currentStrikerId: computed.currentStrikerId || '',
      currentNonStrikerId: (computed as any).nonStrikerId || '',
      nonStrikerId: (computed as any).nonStrikerId || '',
      currentBowlerId: selectedBowler,
      lastOverBowlerId: lastOverBowlerId || '',
      freeHit: effectiveNextFreeHit,
      ...(overEnded ? { lastOverBowlerId: selectedBowler } : {}),
      updatedAt: Timestamp.now(),
    } as any)

    setSelectedStriker(computed.currentStrikerId || '')
    setSelectedNonStriker((computed as any).nonStrikerId || '')

    if (overEnded) {
      setLastOverBowlerId(selectedBowler);
      setNeedsNewBowler(true)
      const suggested = suggestNextBowler([selectedBowler])
      setSuggestedNextBowlerId(suggested)
      toast('Over complete.', { icon: '🎯' } as any)
    }

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

    // Prevent further updates after undo
    if (undoPerformed) {
      toast.error('Cannot add new balls after undo - please refresh the page to continue')
      return
    }

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

    // Validate bowler restriction for consecutive overs
    if (needsNewBowler && selectedBowler === lastOverBowlerId) {
      toast.error('Same bowler cannot bowl consecutive overs. Please select a different bowler.')
      return
    }

    try {
      setSubmitting(true)

      // Determine free-hit for NEXT delivery (no-ball -> next is free hit; wide does not consume free hit)
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
        ...({ type: payload.kind } as any),
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
      const newBallId = ballDoc.id; // Get the ID of the newly added ball

      // --- Generate & Save Auto Commentary (Hidden from Admin UI, visible to User) ---
      // We'll use the currentInnings state for context, as the new ball's stats aren't fully computed yet.
      // This is a slight approximation but generally acceptable for commentary.
      const shouldGenerateAiCommentary = true; // Hardcoded to true as per instructions
      if (shouldGenerateAiCommentary) {
        try {
          const commResult = generateCommentary({
            runs: ballData.runsOffBat || 0,
            ballType: ballData.type as any,
            wicketType: ballData.wicket?.type as any,
            batsman: playersById.get(ballData.batsmanId)?.name || 'Batter',
            bowler: playersById.get(ballData.bowlerId)?.name || 'Bowler',
            isBoundary: (ballData.runsOffBat === 4 || ballData.runsOffBat === 6),
            isFour: ballData.runsOffBat === 4,
            isSix: ballData.runsOffBat === 6,
            over: `${ballData.overNumber}.${ballData.ballInOver !== null ? ballData.ballInOver + 1 : 'E'}`, // E for extra ball
            matchContext: {
              currentScore: currentInnings?.totalRuns || 0,
              wickets: currentInnings?.totalWickets || 0,
              requiredRuns: match.target ? (match.target - (currentInnings?.totalRuns || 0)) : undefined,
              oversRemaining: (match.oversLimit || 20) * 6 - (currentInnings?.legalBalls || 0),
              isChase: match.matchPhase === 'SecondInnings'
            },
            style: 'tv'
          }, 'normal')

          if (commResult && commResult.text) {
            const commRef = collection(db, COLLECTIONS.MATCHES, matchId, 'commentary')
            await addDoc(commRef, {
              matchId,
              inningId,
              ballId: newBallId, // Link commentary to the new ball
              text: commResult.text,
              timestamp: Timestamp.now(),
              type: 'auto',
              isHighlight: commResult.isHighlight
            })
          }
        } catch (err) {
          console.error("Failed to generate AI commentary", err)
        }
      }

      // Update free hit state (no-ball -> next ball is free hit)
      setIsFreeHit(nextFreeHit)

      // Recalculate innings and persist so public pages show data
      // IMPORTANT: Firestore reads right after a write can sometimes lag; force-include the new ball for recalculation.
      const newBall = { id: newBallId, ...ballData } as Ball
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

      // Handle run-out strike rotation - now with admin control
      if (payload.kind === 'wicket' && payload.wicket && payload.wicket.type === 'run-out') {
        // Check if admin wants manual control over strike rotation
        if (allowManualStrikeControl) {
          // If manual control is enabled, don't automatically rotate strike
          // The admin can manually swap striker and non-striker as needed
          toast('Run-out recorded. Manual strike control is enabled - adjust striker/non-striker as needed.', { icon: '🔄' } as any);
        } else {
          // Automatic rotation based on runs completed (odd runs = rotate)
          if (payload.runsOffBat % 2 === 1) {  // Odd runs (1, 3, etc.)
            // Swap striker and non-stricker
            const tempStriker = selectedStriker;
            const tempNonStriker = selectedNonStriker;

            // Update local state
            setSelectedStriker(tempNonStriker);
            setSelectedNonStriker(tempStriker);

            // Update in Firestore
            if (matchId) {
              const matchRef = doc(db, COLLECTIONS.MATCHES, matchId);
              await updateDoc(matchRef, {
                currentStrikerId: tempNonStriker,
                currentNonStrikerId: tempStriker,
                nonStrikerId: tempStriker,
                updatedAt: Timestamp.now(),
              } as any);
            }
          }
        }
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
                      : payload.wicket.type === 'hit-wicket' ? 'Hit Wicket'
                        : payload.wicket.type === 'obstructing-field' ? 'Obstructing Field'
                          : payload.wicket.type === 'retired' ? 'Retired'
                            : 'Bowled'
        toast(`${outName} OUT (${wicketLabel})`, { icon: '🏏' } as any)
      }

      toast.success('Ball recorded')
    } catch (error: any) {
      console.error('Error adding ball:', error)
      const errorMessage = error?.message || error?.code || 'Unknown error'
      console.error('Full error details:', {
        code: error?.code,
        message: error?.message,
        stack: error?.stack,
      })

      // Show specific error messages
      if (error?.code === 'permission-denied') {
        toast.error('Permission denied. Please check if you are logged in as admin.')
      } else if (error?.code === 'unauthenticated') {
        toast.error('Not authenticated. Please log in again.')
      } else {
        toast.error(`Failed to record ball: ${errorMessage}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Primary Scoring Handler with Modifiers
   */
  const handleScoreInput = async (runs: number) => {
    // Determine effective extras based on modifiers
    const extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 }
    let runsOffBat = 0
    let totalRuns = 0
    let isLegal = true

    if (activeBowlerType === 'wide') {
      isLegal = false
      // Wide rule: 1 automatic + completed runs are all wides (usually)
      // ICC: "All runs scored shall be reckoned as Wides"
      // If we are recording 'runs', these are the completed runs.
      extras.wides = 1 + runs
      totalRuns = 1 + runs
      runsOffBat = 0 // No bat runs on wide
    } else if (activeBowlerType === 'no-ball') {
      isLegal = false
      extras.noBalls = 1
      totalRuns = 1 + runs // 1 NB + whatever runs occurred

      // Distribute runs
      if (activeRunsType === 'bye') {
        extras.byes = runs
      } else if (activeRunsType === 'leg-bye') {
        extras.legByes = runs
      } else {
        // Normal bat runs
        runsOffBat = runs
      }
    } else {
      // Normal Delivery
      isLegal = true // Valid ball
      totalRuns = runs
      if (activeRunsType === 'bye') {
        extras.byes = runs
        runsOffBat = 0
      } else if (activeRunsType === 'leg-bye') {
        extras.legByes = runs
        runsOffBat = 0
      } else {
        runsOffBat = runs
      }
    }

    await recordBall({
      kind: activeBowlerType === 'normal' ? activeRunsType === 'bat' ? 'normal' : activeRunsType : activeBowlerType,
      runsOffBat,
      totalRuns,
      extras,
      wicket: null,
      isLegal,
    })

    // Reset modifiers after successful input
    setActiveBowlerType('normal')
    setActiveRunsType('bat')
  }

  const handleWicketClick = () => {
    // If any modifier is active (Wide, No Ball, Bye, Leg Bye), default to Run Out
    // User requested specifically that only Run Out should be available in these cases
    const isModifierActive = activeBowlerType !== 'normal' || activeRunsType !== 'bat'

    setWicketRuns(0)
    setWicketDismissed('striker')
    // Force run-out if modifiers active, else default to bowled
    setWicketType(isModifierActive ? 'run-out' : 'bowled')
    setWicketFielderId('')
    setWicketNextBatterId('')
    setWicketModalOpen(true)
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
      const { deleteDoc, getDocs, collection } = await import('firebase/firestore')
      await deleteDoc(ballRef)

      // Fetch fresh balls to determine who the bowler should revert to
      const ballsRef = collection(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.INNINGS, inningId, SUBCOLLECTIONS.BALLS)
      const ballsSnap = await getDocs(ballsRef)
      const allBalls = ballsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ball)).sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))

      let prevBowlerId = ''
      if (allBalls.length > 0) {
        const newLast = allBalls[allBalls.length - 1]
        if (newLast) prevBowlerId = newLast.bowlerId || ''
      }

      // Explicitly update match doc + local state to revert bowler
      if (prevBowlerId) {
        setSelectedBowler(prevBowlerId)
        const matchRef = doc(db, COLLECTIONS.MATCHES, matchId)
        await updateDoc(matchRef, { currentBowlerId: prevBowlerId } as any)
      }

      // Recompute with the correct bowler override
      const computed = await recomputeAndSave(allBalls, undefined, undefined, prevBowlerId)
      await refreshLastBall()

      // Reset match status if it was finished
      const matchRef = doc(db, COLLECTIONS.MATCHES, matchId)
      const currentPhase = (match as any)?.matchPhase
      let revertPhase = currentPhase
      if (currentPhase === 'finished') {
        revertPhase = inningId === 'teamB' ? 'SecondInnings' : 'FirstInnings'
      }

      await updateDoc(matchRef, {
        status: 'live',
        matchPhase: revertPhase,
        resultSummary: '',
        updatedAt: Timestamp.now()
      } as any)
      setMatchFinished(false)

      // Reset local striker pointers from the computed result (reverts batsman swap if needed)
      if (computed) {
        if (computed.currentStrikerId) setSelectedStriker(computed.currentStrikerId)
        if ((computed as any).nonStrikerId) setSelectedNonStriker((computed as any).nonStrikerId)

        // ensure match doc is synced with reverted strikers too
        await updateDoc(matchRef, {
          currentStrikerId: computed.currentStrikerId,
          currentNonStrikerId: (computed as any).nonStrikerId || '',
          nonStrikerId: (computed as any).nonStrikerId || '',
          updatedAt: Timestamp.now()
        } as any)
      }

      // Mark that an undo was performed
      setUndoPerformed(true)
      setWasUndone(true)

      toast.success('Last ball undone & match status reverted')
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

  // Show admin permission warning
  if (isAdminVerified === false) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
          <h2 className="text-xl font-bold text-red-900 mb-2">⚠️ Admin Access Required</h2>
          <p className="text-red-700 mb-4">
            You need admin permissions to update match scores. Please verify your admin status.
          </p>
          <Link
            to="/admin/settings"
            className="inline-block px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
          >
            Go to Admin Settings
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-50 overflow-hidden font-sans">
      {/* 1. Top Header Bar - Dark Theme for Professional Look */}
      <header className="flex-none bg-slate-900 text-white shadow-lg z-20">
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-semibold mb-0.5">
              <Link to="/admin/live" className="hover:text-white transition-colors">Live Matches</Link>
              <span>/</span>
              <span>Scoring Console</span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="opacity-75">{teamAName}</span>
              <span className="text-slate-500 text-sm">vs</span>
              <span className="opacity-75">{teamBName}</span>
              <span className="ml-2 px-2 py-0.5 bg-red-600 text-[10px] font-bold uppercase rounded tracking-wide">Live</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Indicator */}
            <div className={`px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-2 ${canScoreNow
              ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
              : 'bg-amber-500/10 border-amber-500/50 text-amber-400'
              }`}>
              <span className={`w-2 h-2 rounded-full ${canScoreNow ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
              {canScoreNow ? 'SCORING ACTIVE' : needsNewBowler ? 'SELECT BOWLER' : 'SETUP REQUIRED'}
            </div>

            <Link
              to={`/match/${matchId}`}
              target="_blank"
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Public Page ↗
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Main Workspace - Fixed Flex Layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Scoring Board & Controls (Flexible, Scrollable) */}
        <main className="flex-1 flex flex-col min-w-0 bg-slate-50 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">

            {/* Score Summary Card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  {battingTeam} Batting
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-black text-slate-800 tracking-tight">
                    {currentInnings?.totalRuns || 0}<span className="text-3xl text-slate-400">/</span>{currentInnings?.totalWickets || 0}
                  </span>
                  <span className="text-xl font-medium text-slate-500">
                    {currentInnings?.overs || '0.0'} <span className="text-sm">ov</span>
                  </span>
                </div>
              </div>

              <div className="flex gap-6 text-right">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">CRR</div>
                  <div className="text-xl font-bold text-slate-700">
                    {currentInnings?.currentRunRate ? parseFloat(String(currentInnings.currentRunRate)).toFixed(2) : '0.00'}
                  </div>
                </div>
                {/* Partnership Widget */}
                {currentInnings?.partnership && (
                  <div className="pl-6 border-l border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Values</div>
                    <div className="text-xl font-bold text-slate-700">
                      {currentInnings.partnership.runs}
                      <span className="text-xs font-medium text-slate-400 ml-1">({currentInnings.partnership.balls})</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Match Finished / Results Status */}
            {(match?.status === 'finished' || matchFinished) && (
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl shadow-xl border border-slate-700 p-6 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-2">
                  <span className="text-4xl">🏁</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tight">Match Finished</h3>
                  <p className="text-emerald-400 font-bold text-lg mt-1 italic">
                    {match?.resultSummary || 'Calculated Results...'}
                  </p>
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={handleUndoBall}
                    disabled={submitting}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                  >
                    <span>↩️</span> Undo Last Ball
                  </button>
                  <Link
                    to="/admin/matches"
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-all"
                  >
                    Finish Scoring
                  </Link>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">Scoring is now locked. Click Undo if the match finish was a mistake.</p>
              </div>
            )}

            {/* Action Board (Controller) */}
            <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${(match?.status === 'finished' || matchFinished) ? 'opacity-40 pointer-events-none grayscale' : ''}`}>
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center h-10">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 uppercase">Scoring Controls</span>
                  {lastBall && (
                    <button
                      onClick={handleUndoLastBall}
                      disabled={submitting}
                      className="px-2 py-0.5 bg-white border border-slate-200 text-slate-500 text-[10px] font-bold uppercase rounded hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors flex items-center gap-1"
                    >
                      ↩ Undo
                    </button>
                  )}
                </div>
                {submitting && <span className="text-xs font-bold text-emerald-600 animate-pulse">Processing...</span>}
              </div>
              <div className="p-4 md:p-6">
                {isFreeHit && (
                  <div className="mb-4 bg-orange-50 border border-orange-200 text-orange-800 px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                    <span>⚠️ Free Hit Active</span>
                  </div>
                )}

                <div className="grid grid-cols-4 md:grid-cols-7 gap-3 mb-6">
                  <button onClick={() => handleScoreInput(0)} disabled={submitting || !canScoreNow} className="col-span-1 h-16 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xl active:scale-95 transition-all text-center">0</button>
                  <button onClick={() => handleScoreInput(1)} disabled={submitting || !canScoreNow} className="col-span-1 h-16 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xl active:scale-95 transition-all text-center">1</button>
                  <button onClick={() => handleScoreInput(2)} disabled={submitting || !canScoreNow} className="col-span-1 h-16 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xl active:scale-95 transition-all text-center">2</button>
                  <button onClick={() => handleScoreInput(3)} disabled={submitting || !canScoreNow} className="col-span-1 h-16 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xl active:scale-95 transition-all text-center">3</button>
                  <button onClick={() => handleScoreInput(4)} disabled={submitting || !canScoreNow} className="col-span-1 h-16 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-2xl active:scale-95 transition-all shadow-md shadow-blue-200 text-center">4</button>
                  <button onClick={() => handleScoreInput(6)} disabled={submitting || !canScoreNow} className="col-span-1 h-16 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-2xl active:scale-95 transition-all shadow-md shadow-emerald-200 text-center">6</button>
                  <button onClick={handleWicketClick} disabled={submitting || !canScoreNow} className="col-span-2 md:col-span-1 h-16 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm uppercase tracking-wide active:scale-95 transition-all shadow-md shadow-red-200 text-center flex items-center justify-center">OUT</button>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <button
                    onClick={() => activeBowlerType === 'wide' ? setActiveBowlerType('normal') : setActiveBowlerType('wide')}
                    disabled={submitting || !canScoreNow || activeRunsType !== 'bat'} // Wide incompatible with Bye/LegBye toggles for simplicity
                    className={`py-3 rounded-lg border font-bold text-sm transition-all ${activeBowlerType === 'wide' ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-[1.02]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    Wide
                  </button>
                  <button
                    onClick={() => activeBowlerType === 'no-ball' ? setActiveBowlerType('normal') : setActiveBowlerType('no-ball')}
                    disabled={submitting || !canScoreNow}
                    className={`py-3 rounded-lg border font-bold text-sm transition-all ${activeBowlerType === 'no-ball' ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-[1.02]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    No Ball
                  </button>
                  <button
                    onClick={() => activeRunsType === 'bye' ? setActiveRunsType('bat') : setActiveRunsType('bye')}
                    disabled={submitting || !canScoreNow || activeBowlerType === 'wide'} // Wide incompatible
                    className={`py-3 rounded-lg border font-bold text-sm transition-all ${activeRunsType === 'bye' ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-[1.02]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    Bye
                  </button>
                  <button
                    onClick={() => activeRunsType === 'leg-bye' ? setActiveRunsType('bat') : setActiveRunsType('leg-bye')}
                    disabled={submitting || !canScoreNow || activeBowlerType === 'wide'} // Wide incompatible
                    className={`py-3 rounded-lg border font-bold text-sm transition-all ${activeRunsType === 'leg-bye' ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-[1.02]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    Leg Bye
                  </button>
                </div>
              </div>
            </div>

            {/* Stats & manual text row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Batting Table */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Batting Scorecard</div>
                <div className="p-0">
                  <table className="w-full text-sm text-left">
                    <tbody className="divide-y divide-slate-100">
                      {currentInnings?.batsmanStats?.filter(b => b.batsmanId === selectedStriker || b.batsmanId === selectedNonStriker).map(b => (
                        <tr key={b.batsmanId} className={b.batsmanId === selectedStriker ? 'bg-emerald-50/50' : ''}>
                          <td className="px-4 py-3 font-medium text-slate-800">
                            <div className="flex items-center gap-2">
                              {b.batsmanName}
                              {b.batsmanId === selectedStriker && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">STR</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center leading-tight">
                              <span className="font-bold text-lg text-slate-800">{b.runs}</span>
                              <span className="text-[10px] text-slate-400 font-medium">({b.balls})</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-slate-600">{b.fours}</td>
                          <td className="px-4 py-3 text-center font-medium text-slate-600 pr-8">{b.sixes}</td> {/* Added right padding for gap */}
                          <td className="px-4 py-3 text-right font-mono text-slate-600 text-sm hidden sm:table-cell">{(b.strikeRate || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                      {(!currentInnings?.batsmanStats || currentInnings.batsmanStats.length === 0) && (
                        <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-400 text-sm italic">No active batters</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bowling Table */}
              <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Current Bowler</div>
                <div className="p-4">
                  {selectedBowler ? (
                    currentInnings?.bowlerStats?.filter(b => b.bowlerId === selectedBowler).map(b => (
                      <div key={b.bowlerId}>
                        <div className="font-bold text-slate-800 text-base mb-1">{b.bowlerName}</div>
                        <div className="flex justify-between items-end mt-2">
                          <div className="text-sm text-slate-500">
                            <div className="flex gap-4">
                              <span><b className="text-slate-800">{b.overs}</b> ov</span>
                              <span><b className="text-slate-800">{b.runsConceded}</b> run</span>
                              <span><b className="text-slate-800">{b.wickets}</b> wkt</span>
                            </div>
                          </div>
                          <div className="text-xs font-mono bg-slate-100 px-2 py-1 rounded">Eco: {(b.economy || 0).toFixed(1)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-400 text-sm italic py-2">No bowler selected</div>
                  )}
                </div>
              </div>
            </div>

            {/* Manual Commentary Input */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">Manual Commentary / Notes</div>
              <div className="p-3 flex gap-2">
                <input
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                  placeholder="Type commentary (e.g. 'Match stopped due to rain')..."
                  value={manualCommentary}
                  onChange={(e) => setManualCommentary(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualCommentary.trim()) {
                      // Logic duplicated in button, but simplifying for UI first
                      const text = manualCommentary.trim()
                      if (!matchId) return
                      const ref = collection(db, 'matches', matchId, 'commentary')
                      addDoc(ref, {
                        matchId,
                        inningId,
                        text,
                        timestamp: Timestamp.now(),
                        timestamp: Timestamp.now(),
                        type: 'manual',
                        ballDocId: lastBall?.id || null
                      }).then(() => {
                        toast.success('Sent')
                        setManualCommentary('')
                      }).catch(() => toast.error('Error'))
                    }
                  }}
                />
                <button
                  disabled={!manualCommentary.trim()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-lg disabled:opacity-50"
                  onClick={() => {
                    const text = manualCommentary.trim()
                    if (!matchId || !text) return
                    const ref = collection(db, 'matches', matchId, 'commentary')
                    addDoc(ref, { matchId, inningId, text, timestamp: Timestamp.now(), type: 'manual', ballId: lastBall?.id || null })
                      .then(() => { toast.success('Sent'); setManualCommentary('') })
                  }}
                >
                  Post
                </button>
              </div>
            </div>

            {/* Last Ball Event Log */}
            {lastBall && (
              <div className="text-center py-4 opacity-50 text-xs font-mono text-slate-400">
                Last Event: {lastBall.wicket ? 'Wicket Check' : `${lastBall.totalRuns} runs`} • ID: {lastBall.id}
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar: Player Management (Fixed Width) */}
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col z-10 shadow-xl">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-bold text-slate-800 text-sm uppercase max-w-full truncate">Match Configuration</h3>
            <p className="text-xs text-slate-400 mt-1">Manage active players</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">

            {/* Striker Select */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-500 uppercase">Striker</label>
                {selectedStriker && selectedNonStriker && (
                  <button
                    onClick={handleSwapStrike}
                    disabled={swappingStrike}
                    className="text-[10px] bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 px-2 py-0.5 rounded border border-slate-200 transition-colors flex items-center gap-1 font-bold"
                  >
                    <span>🔄 Rotate</span>
                  </button>
                )}
              </div>
              <select
                value={selectedStriker} onChange={(e) => {
                  const next = e.target.value
                  setSelectedStriker(next)
                  if (next && next === selectedNonStriker) setSelectedNonStriker('')
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none"
              >
                <option value="">-- Select --</option>
                {availableBatsmen.filter(p => p.id !== selectedNonStriker).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Non-Striker Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Non-Striker</label>
              <select
                value={selectedNonStriker} onChange={(e) => {
                  const next = e.target.value
                  setSelectedNonStriker(next)
                  if (next && next === selectedStriker) setSelectedStriker('')
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none"
              >
                <option value="">-- Select --</option>
                {availableBatsmen.filter(p => p.id !== selectedStriker).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* Bowler Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase flex justify-between">
                <span>Bowler</span>
                {needsNewBowler && <span className="text-amber-600 animate-pulse">Running change needed</span>}
              </label>
              <select
                value={selectedBowler} onChange={(e) => {
                  const next = e.target.value
                  setSelectedBowler(next)
                  if (needsNewBowler && next && next !== lastOverBowlerId) {
                    setNeedsNewBowler(false)
                    setSuggestedNextBowlerId('')
                  }
                }}
                className={`w-full p-2.5 bg-slate-50 border rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none ${needsNewBowler ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'}`}
              >
                <option value="">-- Select --</option>
                {availableBowlers.map(p => (
                  <option key={p.id} value={p.id} disabled={needsNewBowler && p.id === lastOverBowlerId}>
                    {p.name} {needsNewBowler && p.id === lastOverBowlerId ? '( Last Over )' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Suggestions */}
            {suggestedNextBatterId && !selectedStriker && (
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg animate-in slide-in-from-right fade-in-50">
                <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">Suggestion</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-blue-800">{playersById.get(suggestedNextBatterId)?.name}</span>
                  <button onClick={async () => {
                    setSelectedStriker(suggestedNextBatterId)
                    setSuggestedNextBatterId('')
                    if (matchId) {
                      const matchRef = doc(db, COLLECTIONS.MATCHES, matchId)
                      await updateDoc(matchRef, { currentStrikerId: suggestedNextBatterId } as any)
                    }
                  }} className="text-xs bg-blue-200 hover:bg-blue-300 text-blue-800 px-2 py-1 rounded font-bold transition-colors">Apply</button>
                </div>
              </div>
            )}

            {/* Warnings */}
            {(!strikerNonStrikerValid && selectedStriker && selectedNonStriker) && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 font-medium">
                ⚠️ Same player selected for both ends.
              </div>
            )}

            {/* Advanced Toggles */}
            <div className="pt-6 mt-6 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Manual Strike Change</span>
                <button onClick={() => setAllowManualStrikeControl(v => !v)} className={`w-8 h-4 rounded-full transition-colors ${allowManualStrikeControl ? 'bg-blue-500' : 'bg-slate-200'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${allowManualStrikeControl ? 'translate-x-4' : 'translate-x-1'}`} />
                </button>
              </div>
              {allowManualStrikeControl && (
                <div className="p-2 bg-slate-100 rounded text-[10px] text-slate-500 leading-tight">
                  When enabled, you can manually override strike rotation logic. Use with caution.
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Actions */}
          <div className="p-4 bg-white border-t border-slate-200 space-y-3">
            <button
              onClick={async () => {
                // Save Logic (Copied from original for functionality)
                if (!matchId || !match) return
                if (!selectedStriker || !selectedNonStriker || !selectedBowler) { toast.error('Incomplete selection'); return }
                // Minimal validation for speed
                // Validate that selected players are in the Playing XI
                const batXI = getBattingPlayingXI()
                const bowlXI = getFieldingPlayingXI()
                if (batXI.length > 0 && !batXI.includes(selectedStriker)) {
                  toast.error('Selected striker is not in batting Playing XI')
                  return
                }
                if (batXI.length > 0 && !batXI.includes(selectedNonStriker)) {
                  toast.error('Selected non-striker is not in batting Playing XI')
                  return
                }
                if (bowlXI.length > 0 && !bowlXI.includes(selectedBowler)) {
                  toast.error('Selected bowler is not in fielding Playing XI')
                  return
                }

                // Validate that selected bowler is not a wicket keeper
                const isWicketKeeper = (match?.teamAKeeperId === selectedBowler || match?.teamBKeeperId === selectedBowler);
                if (isWicketKeeper) {
                  toast.error('Wicket keeper cannot bowl. Please select a different bowler.');
                  return;
                }
                try {
                  const matchRef = doc(db, COLLECTIONS.MATCHES, matchId)
                  const innRef = doc(db, COLLECTIONS.MATCHES, matchId, SUBCOLLECTIONS.INNINGS, inningId)
                  await Promise.all([
                    updateDoc(matchRef, { currentBatting: effectiveCurrentBatting, currentStrikerId: selectedStriker, currentNonStrikerId: selectedNonStriker, nonStrikerId: selectedNonStriker, currentBowlerId: selectedBowler, updatedAt: Timestamp.now() } as any),
                    setDoc(innRef, { currentStrikerId: selectedStriker, nonStrikerId: selectedNonStriker, currentBowlerId: selectedBowler } as any, { merge: true })
                  ])
                  setNeedsNewBowler(false)
                  setSuggestedNextBowlerId('')
                  toast.success('Saved')
                } catch (e: any) {
                  console.error('Failed to save player selection:', e)
                  toast.error(e?.message || 'Failed to save selection')
                }
              }}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg shadow-slate-200 active:scale-95 transition-all text-sm"
            >
              Confirm Setup
            </button>

            {match?.matchPhase === 'SecondInnings' && !rotationApplied && (
              <button onClick={async () => { if (confirm('Apply player rotation for second innings? Former bowlers will now bat and former batters will now bowl.')) { setIsRotated(true); await applyPlayerRotation(); } }} className="w-full py-2 border border-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-50 text-xs">
                Apply Innings Rotation
              </button>
            )}
          </div>
        </aside>

      </div>

      {/* Wicket Modal */}
      {
        wicketModalOpen && (
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
                        // Rule: Limit dismissal types based on context
                        // 1. Free Hit: only run-out allowed (simplified)
                        // 2. Modifiers (Wide/NB/Bye/LB): only run-out allowed (per user request)
                        const isModifierActive = activeBowlerType !== 'normal' || activeRunsType !== 'bat'
                        let disabled = false

                        if (isFreeHit && opt.v !== 'run-out') disabled = true
                        if (isModifierActive && opt.v !== 'run-out') disabled = true

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
                              disabled ? 'opacity-30 cursor-not-allowed bg-slate-50 grayscale' : '', // stronger disabled style
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
                    {(activeBowlerType !== 'normal' || activeRunsType !== 'bat') && (
                      <div className="text-[11px] font-bold text-orange-600 mt-2 bg-orange-50 border border-orange-100 p-2 rounded-lg">
                        ⚠️ Note: With {activeBowlerType !== 'normal' ? activeBowlerType : activeRunsType} active, only 'Run Out' is allowed.
                      </div>
                    )}
                    <div className="text-[11px] text-gray-500 mt-2">
                      Run Out ছাড়া সব wicket type‑এ dismissed batter <span className="font-bold">Striker</span> (locked).
                    </div>
                  </div>

                  {(wicketType === 'run-out' || wicketType === 'retired') ? (
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
                        {(wicketType === 'run-out') ? 'Run Out হলে striker বা non-striker যেকেউ out হতে পারে—এখান থেকে select করুন।' : 'Retired Out হলে striker বা non-striker যেকেউ retired out হতে পারে—এখান থেকে select করুন।'}
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

                  {/* Next batter selection moved to separate modal */}

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
                      // For run-outs, validate that the selected player is actually on the field
                      if (wicketType === 'run-out') {
                        if (wicketDismissed === 'nonStriker' && !selectedNonStriker) {
                          toast.error('Please select non-striker')
                          return
                        }
                        if (wicketDismissed === 'striker' && !selectedStriker) {
                          toast.error('Please select striker')
                          return
                        }
                      }

                      // Next batter selection moved to separate modal
                      // If no candidates available, we can still record the wicket but won't auto-select next batter
                      const dismissedId =
                        wicketType === 'run-out'
                          ? (wicketDismissed === 'nonStriker' ? selectedNonStriker : selectedStriker)
                          : selectedStriker

                      const CREDIT_BOWLER_TYPES = ['bowled', 'caught', 'lbw', 'stumped', 'hit-wicket']
                      const isCreditToBowler = CREDIT_BOWLER_TYPES.includes(wicketType)

                      // Calculate Wicket Ball Data based on Modifiers
                      const extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 }
                      let runsOffBat = 0
                      let totalRuns = 0
                      let isLegal = true

                      if (activeBowlerType === 'wide') {
                        isLegal = false
                        // On wide, wicket runs are usually wides too
                        extras.wides = 1 + wicketRuns
                        totalRuns = 1 + wicketRuns
                        runsOffBat = 0
                      } else if (activeBowlerType === 'no-ball') {
                        isLegal = false
                        extras.noBalls = 1
                        if (activeRunsType === 'bat') {
                          runsOffBat = wicketRuns
                        } else if (activeRunsType === 'bye') {
                          extras.byes = wicketRuns
                        } else if (activeRunsType === 'leg-bye') {
                          extras.legByes = wicketRuns
                        }
                        totalRuns = 1 + wicketRuns
                      } else {
                        // Normal Ball Wicket
                        if (activeRunsType === 'bye') {
                          extras.byes = wicketRuns
                          runsOffBat = 0
                        } else if (activeRunsType === 'leg-bye') {
                          extras.legByes = wicketRuns
                          runsOffBat = 0
                        } else {
                          runsOffBat = wicketRuns
                        }
                        totalRuns = wicketRuns
                      }

                      await recordBall({
                        kind: activeBowlerType === 'normal' ? 'wicket' : activeBowlerType,
                        runsOffBat,
                        totalRuns,
                        extras,
                        wicket: {
                          type: wicketType,
                          dismissedPlayerId: dismissedId,
                          fielderId: (wicketType === 'caught' || wicketType === 'run-out') ? wicketFielderId : undefined,
                          creditedToBowler: isCreditToBowler,
                          bowlerId: selectedBowler,
                        },
                        isLegal,
                      })

                      // Reset modifiers
                      setActiveBowlerType('normal')
                      setActiveRunsType('bat')

                      setWicketModalOpen(false)

                      // Clear the dismissed batter from local state so the next-batter modal can auto-assign
                      if (wicketType === 'run-out' || wicketType === 'retired') {
                        if (wicketDismissed === 'nonStriker') setSelectedNonStriker('')
                        else setSelectedStriker('')
                      } else {
                        setSelectedStriker('')
                      }

                      // Determine next batter slot and open modal
                      let slot: 'striker' | 'nonStriker' = 'striker';
                      if (wicketType === 'run-out' || wicketType === 'retired') {
                        slot = (wicketDismissed === 'nonStriker' ? 'nonStriker' : 'striker');
                      } else {
                        slot = 'striker';
                      }

                      setNextBatterSlot(slot)
                      setShowNextBatterModal(true)
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
        )
      }

      {/* Next Batter Selection Modal - shown after wicket */}
      {
        showNextBatterModal && (
          <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 bg-slate-900 text-white flex items-start justify-between">
                <div>
                  <div className="text-base font-extrabold tracking-tight flex items-center gap-2">
                    <span aria-hidden>🏏</span> Next Batter for {nextBatterSlot === 'striker' ? 'Striker' : 'Non-Striker'} End
                  </div>
                  <div className="text-xs text-white/90 mt-0.5">Select the batter replacing {nextBatterSlot === 'striker' ? 'Striker' : 'Non-Striker'}</div>
                </div>
                <button
                  onClick={() => setShowNextBatterModal(false)}
                  className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-bold"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-extrabold text-gray-700 mb-2">
                    Select New Batter
                  </label>
                  <select
                    value={suggestedNextBatterId}
                    onChange={(e) => setSuggestedNextBatterId(e.target.value)}
                    className="w-full px-3 py-3 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-slate-500 font-semibold"
                  >
                    <option value="">Select batter...</option>
                    {availableBatsmen
                      .filter(b => b.id !== selectedStriker && b.id !== selectedNonStriker)
                      .map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-2 font-medium uppercase tracking-wider">Dismissed players are automatically excluded</p>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="font-bold text-slate-800 mb-1 tracking-tight">Current Situation:</div>
                  <div className="space-y-1 opacity-80">
                    <div className="flex justify-between"><span>Striker:</span> <span className="font-bold">{playersById.get(selectedStriker)?.name || 'Empty'}</span></div>
                    <div className="flex justify-between"><span>Non-Striker:</span> <span className="font-bold">{playersById.get(selectedNonStriker)?.name || 'Empty'}</span></div>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-gray-100 bg-white flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowNextBatterModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 font-extrabold text-gray-800"
                >
                  Skip
                </button>
                <button
                  onClick={async () => {
                    if (!suggestedNextBatterId) {
                      toast.error('Please select a batter');
                      return;
                    }
                    try {
                      const matchRef = doc(db, COLLECTIONS.MATCHES, matchId!);
                      const innRef = doc(db, COLLECTIONS.MATCHES, matchId!, SUBCOLLECTIONS.INNINGS, inningId);

                      const updateObj: any = {};
                      const innUpdate: any = {};

                      if (nextBatterSlot === 'striker') {
                        updateObj.currentStrikerId = suggestedNextBatterId;
                        innUpdate.currentStrikerId = suggestedNextBatterId;
                        setSelectedStriker(suggestedNextBatterId);
                      } else {
                        updateObj.currentNonStrikerId = suggestedNextBatterId;
                        updateObj.nonStrikerId = suggestedNextBatterId;
                        innUpdate.nonStrikerId = suggestedNextBatterId;
                        setSelectedNonStriker(suggestedNextBatterId);
                      }

                      updateObj.updatedAt = Timestamp.now();

                      await Promise.all([
                        updateDoc(matchRef, updateObj),
                        setDoc(innRef, innUpdate, { merge: true })
                      ]);

                      setShowNextBatterModal(false);
                      setSuggestedNextBatterId('');
                      toast.success('Next batter assigned');
                    } catch (err) {
                      console.error(err);
                      toast.error('Failed to assign batter');
                    }
                  }}
                  disabled={!suggestedNextBatterId}
                  className="px-6 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  )
}

