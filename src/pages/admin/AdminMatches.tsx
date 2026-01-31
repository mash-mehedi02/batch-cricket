/**
 * Match Management Page
 * List, Create, Edit matches
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { tournamentService } from '@/services/firestore/tournaments'
import { squadService } from '@/services/firestore/squads'
import { playerService } from '@/services/firestore/players'
import { Match, Tournament, Squad } from '@/types'
import { useAuthStore } from '@/store/authStore'
import { Timestamp } from 'firebase/firestore'
import { generateMatchNumber } from '@/utils/matchNumber'
import toast from 'react-hot-toast'
import { CalendarClock, Play, Eye, Edit2, Trash2, Filter, Search, Plus, MapPin, Calendar, Clock, Trophy, ArrowLeft, Save, Shield, User, CheckCircle, Mic, AlertCircle, Check } from 'lucide-react'
import { SkeletonCard } from '@/components/skeletons/SkeletonCard'
import TableSkeleton from '@/components/skeletons/TableSkeleton'
import { addManualCommentary } from '@/services/commentary/commentaryService'
import DeleteConfirmationModal from '@/components/admin/DeleteConfirmationModal'
import { coerceToDate, formatDateLabel, formatTimeLabel } from '@/utils/date'
import WheelDatePicker from '@/components/common/WheelDatePicker'

interface AdminMatchesProps {
  mode?: 'list' | 'create' | 'edit' | 'view'
}

export default function AdminMatches({ mode = 'list' }: AdminMatchesProps) {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [matches, setMatches] = useState<Match[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [squads, setSquads] = useState<Squad[]>([])
  const [loading, setLoading] = useState(true)
  const [matchView, setMatchView] = useState<Match | null>(null)
  const [teamAPlayers, setTeamAPlayers] = useState<any[]>([])
  const [teamBPlayers, setTeamBPlayers] = useState<any[]>([])
  const [teamAPlayingXI, setTeamAPlayingXI] = useState<string[]>([])
  const [teamBPlayingXI, setTeamBPlayingXI] = useState<string[]>([])
  const [teamACaptainId, setTeamACaptainId] = useState<string>('')
  const [teamAKeeperId, setTeamAKeeperId] = useState<string>('')
  const [teamBCaptainId, setTeamBCaptainId] = useState<string>('')
  const [teamBKeeperId, setTeamBKeeperId] = useState<string>('')
  const [manualInningId, setManualInningId] = useState<'teamA' | 'teamB'>('teamA')
  const [manualText, setManualText] = useState('')
  const [manualOver, setManualOver] = useState('0.0')
  const [manualBall, setManualBall] = useState(0)
  const [preMatchSaving, setPreMatchSaving] = useState(false)
  const [isEditingToss, setIsEditingToss] = useState(true)
  const [isEditingXI, setIsEditingXI] = useState(true)
  const getDefaultFormData = () => ({
    tournamentId: '',
    groupId: '',
    teamA: '',
    teamB: '',
    teamAName: '',
    teamBName: '',
    venue: 'SMA Home Ground',
    date: new Date().toISOString().split('T')[0],
    time: '16:00',
    oversLimit: 20,
    tossWinner: '',
    tossDecision: 'bat' as 'bat' | 'bowl',
    status: 'upcoming' as any,
    matchNo: '',
  })
  const [formData, setFormData] = useState({
    tournamentId: '',
    groupId: '',
    teamA: '',
    teamB: '',
    teamAName: '',
    teamBName: '',
    venue: 'SMA Home Ground',
    date: new Date().toISOString().split('T')[0],
    time: '16:00',
    oversLimit: 20,
    tossWinner: '',
    tossDecision: 'bat' as 'bat' | 'bowl',
    status: 'upcoming' as any,
    matchNo: '',
  })
  const [saving, setSaving] = useState(false)
  const [rescheduleModal, setRescheduleModal] = useState<{ open: boolean; match: Match | null }>({ open: false, match: null })
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '' })

  // Deletion state
  const [itemToDelete, setItemToDelete] = useState<Match | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Tournament → Groups → Allowed squads (for tournament-based fixtures)
  const selectedTournament = useMemo(() => {
    return tournaments.find((t) => t.id === formData.tournamentId) as any
  }, [formData.tournamentId, tournaments])

  const tournamentGroups = useMemo(() => {
    const raw = (selectedTournament?.config?.groups || selectedTournament?.groups || []) as any[]
    return raw
      .map((g: any) => ({
        id: String(g?.id || ''),
        name: String(g?.name || ''),
        squadIds: Array.isArray(g?.squadIds) ? (g.squadIds as string[]) : [],
      }))
      .filter((g) => g.id && g.name)
  }, [selectedTournament])

  const tournamentSquadIds = useMemo(() => {
    if (!selectedTournament) return [] as string[]
    const fromParticipants: string[] = Array.isArray(selectedTournament?.participantSquadIds) ? selectedTournament.participantSquadIds : []
    if (fromParticipants.length) return fromParticipants.map((x: any) => String(x))
    const metaKeys = selectedTournament?.participantSquadMeta ? Object.keys(selectedTournament.participantSquadMeta) : []
    if (metaKeys.length) return metaKeys.map((x: any) => String(x))
    const union = new Set<string>()
    tournamentGroups.forEach((g) => (g.squadIds || []).forEach((sid: any) => union.add(String(sid))))
    return Array.from(union.values())
  }, [selectedTournament, tournamentGroups])

  const availableSquads = useMemo(() => {
    // If no tournament selected: show all squads (current behavior)
    if (!formData.tournamentId) return squads

    // Filter by tournament participants if available
    const set = new Set<string>(tournamentSquadIds.map((x) => String(x)))
    const base = set.size ? squads.filter((s) => set.has(String(s.id))) : squads

    // If groups exist and group selected: restrict to that group
    if (tournamentGroups.length && formData.groupId) {
      const g = tournamentGroups.find((x) => x.id === formData.groupId)
      const gset = new Set<string>((g?.squadIds || []).map((x: any) => String(x)))
      return base.filter((s) => gset.has(String(s.id)))
    }

    return base
  }, [formData.groupId, formData.tournamentId, squads, tournamentGroups, tournamentSquadIds])

  useEffect(() => {
    if (mode === 'list') {
      loadMatches()
    } else {
      loadTournaments()
      loadSquads()
      if ((mode === 'edit' || mode === 'view') && id) {
        loadMatch(id)
      } else {
        // Reset state when opening the create page, so teams are not "stuck" from a previous match
        if (mode === 'create') {
          setFormData(getDefaultFormData())
          setMatchView(null)
          setTeamAPlayers([])
          setTeamBPlayers([])
          setTeamAPlayingXI([])
          setTeamBPlayingXI([])
          setTeamACaptainId('')
          setTeamAKeeperId('')
          setTeamBCaptainId('')
          setTeamBKeeperId('')
          setManualInningId('teamA')
          setManualText('')
          setManualOver('0.0')
          setManualBall(0)
        }
        setLoading(false)
      }
    }
  }, [mode, id])

  const loadMatches = async () => {
    try {
      const data = await matchService.getAll()
      setMatches(data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading matches:', error)
      toast.error('Failed to load matches')
      setLoading(false)
    }
  }

  const loadTournaments = async () => {
    try {
      const data = await tournamentService.getAll()
      setTournaments(data)
    } catch (error) {
      console.error('Error loading tournaments:', error)
    }
  }

  const loadSquads = async () => {
    try {
      const data = await squadService.getAll()
      setSquads(data)
    } catch (error) {
      console.error('Error loading squads:', error)
    }
  }

  const loadMatch = async (matchId: string) => {
    try {
      const data = await matchService.getById(matchId)
      if (data) {
        setMatchView(data)
        const d = coerceToDate((data as any).date) || new Date()
        const resolvedTeamA =
          (data as any).teamASquadId ||
          (data as any).teamAId ||
          (data as any).teamA ||
          ''
        const resolvedTeamB =
          (data as any).teamBSquadId ||
          (data as any).teamBId ||
          (data as any).teamB ||
          ''
        setFormData({
          tournamentId: data.tournamentId || '',
          groupId: String((data as any).groupId || ''),
          teamA: resolvedTeamA,
          teamB: resolvedTeamB,
          teamAName: data.teamAName || '',
          teamBName: data.teamBName || '',
          venue: data.venue || '',
          date: d.toISOString().split('T')[0],
          time: (data as any).time || d.toTimeString().slice(0, 5),
          oversLimit: data.oversLimit || 20,
          tossWinner: data.tossWinner || '',
          tossDecision: ((data as any).tossDecision as any) || (data as any).electedTo || 'bat',
          status: (data as any).status || 'upcoming',
          matchNo: (data as any).matchNo || (data as any).matchNumber || '',
        })

        // Initialize pre-match states
        setTeamAPlayingXI((data as any).teamAPlayingXI || [])
        setTeamBPlayingXI((data as any).teamBPlayingXI || [])
        setTeamACaptainId((data as any).teamACaptainId || '')
        setTeamAKeeperId((data as any).teamAKeeperId || '')
        setTeamBCaptainId((data as any).teamBCaptainId || '')
        setTeamBKeeperId((data as any).teamBKeeperId || '')
        setManualInningId(((data as any).currentBatting as any) || 'teamA')

        // Determine saved/locked state for setup sections (Save → Modify UX)
        const hasToss = Boolean((data as any).tossWinner) || Boolean((data as any).electedTo) || Boolean((data as any).tossDecision)
        const hasXI = Array.isArray((data as any).teamAPlayingXI) || Array.isArray((data as any).teamBPlayingXI)
        setIsEditingToss(!hasToss)
        setIsEditingXI(!hasXI)
      }
      setLoading(false)
    } catch (error) {
      console.error('Error loading match:', error)
      toast.error('Failed to load match')
      setLoading(false)
    }
  }

  // Load squad players for Pre-Match setup (View mode)
  useEffect(() => {
    const loadPreMatchPlayers = async () => {
      if (mode !== 'view') return
      if (!matchView) return

      try {
        const normalize = (v: any) => String(v || '').trim().toLowerCase()
        const canonical = (v: any) => normalize(v).replace(/[^a-z0-9]/g, '')

        const loadPlayersBySquadDoc = async (squadId: string, squadDoc: any): Promise<any[]> => {
          // Some legacy squads store `players` as an array of objects (not IDs).
          // Only treat arrays of strings as IDs.
          const toStringIdArray = (arr: any): string[] => {
            if (!Array.isArray(arr)) return []
            if (arr.length === 0) return []
            return arr.filter((x) => typeof x === 'string') as string[]
          }

          const ids: string[] =
            toStringIdArray(squadDoc?.playerIds).length > 0
              ? toStringIdArray(squadDoc?.playerIds)
              : toStringIdArray(squadDoc?.players)

          if (ids.length) {
            const results = await Promise.all(ids.map((pid: string) => playerService.getById(pid).catch(() => null)))
            return results.filter(Boolean) as any[]
          }

          if (!squadId) return []
          // Try query by squadId first
          const bySquad = await playerService.getBySquad(squadId)
          if (bySquad && bySquad.length > 0) return bySquad

          // Final fallback: load all players and filter in memory (handles legacy/edge cases)
          const all = await playerService.getAll()
          return all.filter((p: any) => String(p?.squadId || '') === String(squadId))
        }

        // Resolve squad IDs (support multiple schemas)
        const rawA =
          (matchView as any).teamASquadId ||
          (matchView as any).teamAId ||
          (matchView as any).teamA ||
          ''
        const rawB =
          (matchView as any).teamBSquadId ||
          (matchView as any).teamBId ||
          (matchView as any).teamB ||
          ''

        let squadAId = String(rawA || '')
        let squadBId = String(rawB || '')

        let squadA: any = squadAId ? await squadService.getById(squadAId).catch(() => null) : null
        let squadB: any = squadBId ? await squadService.getById(squadBId).catch(() => null) : null

        // Fallback: if match stores squad NAME instead of ID, resolve by name from loaded squads
        if (!squadA) {
          const target = normalize((matchView as any).teamAName || (matchView as any).teamA)
          const targetC = canonical(target)
          const found = squads.find((s) => {
            const n = (s as any).name
            return normalize(n) === target || canonical(n) === targetC
          })
          if (found) {
            squadAId = found.id
            squadA = await squadService.getById(squadAId).catch(() => null)
            // Persist resolved ID into form state for consistency
            setFormData((prev) => ({ ...prev, teamA: squadAId }))
          } else if (target) {
            // If squads list is empty/outdated, query Firestore by name as a fallback
            const byName = await squadService.getByName((matchView as any).teamAName || (matchView as any).teamA)
            // Pick the first squad that can actually load players
            for (const cand of byName) {
              const candDoc = await squadService.getById(cand.id).catch(() => null)
              const candPlayers = await loadPlayersBySquadDoc(cand.id, candDoc)
              if (candPlayers.length) {
                squadAId = cand.id
                squadA = candDoc
                setFormData((prev) => ({ ...prev, teamA: squadAId }))
                break
              }
            }
          }
        }
        if (!squadB) {
          const target = normalize((matchView as any).teamBName || (matchView as any).teamB)
          const targetC = canonical(target)
          const found = squads.find((s) => {
            const n = (s as any).name
            return normalize(n) === target || canonical(n) === targetC
          })
          if (found) {
            squadBId = found.id
            squadB = await squadService.getById(squadBId).catch(() => null)
            setFormData((prev) => ({ ...prev, teamB: squadBId }))
          } else if (target) {
            const byName = await squadService.getByName((matchView as any).teamBName || (matchView as any).teamB)
            for (const cand of byName) {
              const candDoc = await squadService.getById(cand.id).catch(() => null)
              const candPlayers = await loadPlayersBySquadDoc(cand.id, candDoc)
              if (candPlayers.length) {
                squadBId = cand.id
                squadB = candDoc
                setFormData((prev) => ({ ...prev, teamB: squadBId }))
                break
              }
            }
          }
        }

        // Load players for each side; if empty, try alternative squads with same canonical name (duplicate squads)
        const teamAKey = canonical((matchView as any).teamAName || (matchView as any).teamA || squadA?.name)
        const teamBKey = canonical((matchView as any).teamBName || (matchView as any).teamB || squadB?.name)

        const loadSide = async (side: 'A' | 'B') => {
          let sid = side === 'A' ? squadAId : squadBId
          let sdoc = side === 'A' ? squadA : squadB
          let players = await loadPlayersBySquadDoc(sid, sdoc)

          // If no players, search other squads with same name (duplicate squads) and pick one that has players
          if (players.length === 0) {
            const key = side === 'A' ? teamAKey : teamBKey
            if (key) {
              const candidates = squads.filter((s) => canonical((s as any).name) === key)
              for (const cand of candidates) {
                const candDoc = await squadService.getById(cand.id).catch(() => null)
                const candPlayers = await loadPlayersBySquadDoc(cand.id, candDoc)
                if (candPlayers.length) {
                  sid = cand.id
                  sdoc = candDoc
                  players = candPlayers
                  // Persist resolved ID into form state
                  if (side === 'A') setFormData((prev) => ({ ...prev, teamA: sid }))
                  else setFormData((prev) => ({ ...prev, teamB: sid }))
                  break
                }
              }
            }
          }

          return { sid, players }
        }

        const [sideA, sideB] = await Promise.all([loadSide('A'), loadSide('B')])
        squadAId = sideA.sid
        squadBId = sideB.sid
        const playersA = sideA.players
        const playersB = sideB.players

        const a = (playersA as any[]).slice().sort((x: any, y: any) => (x?.name || '').localeCompare(y?.name || ''))
        const b = (playersB as any[]).slice().sort((x: any, y: any) => (x?.name || '').localeCompare(y?.name || ''))

        setTeamAPlayers(a)
        setTeamBPlayers(b)

        // Auto-select first 11 if not set yet
        setTeamAPlayingXI((prev) => {
          if (prev && prev.length > 0) return prev
          return a.slice(0, 11).map((p: any) => p.id)
        })
        setTeamBPlayingXI((prev) => {
          if (prev && prev.length > 0) return prev
          return b.slice(0, 11).map((p: any) => p.id)
        })

        // Optional: auto-fill captain/keeper if empty and XI has players
        setTeamACaptainId((prev) => prev || (a[0]?.id || ''))
        setTeamAKeeperId((prev) => prev || (a[1]?.id || a[0]?.id || ''))
        setTeamBCaptainId((prev) => prev || (b[0]?.id || ''))
        setTeamBKeeperId((prev) => prev || (b[1]?.id || b[0]?.id || ''))
      } catch (e) {
        console.error('Error loading pre-match players:', e)
        setTeamAPlayers([])
        setTeamBPlayers([])
      }
    }

    loadPreMatchPlayers()
  }, [mode, matchView, squads])

  const canEditPreMatch = useMemo(() => {
    const raw = String((formData as any).status || '').toLowerCase()
    if (raw === 'upcoming') return true

    // Allow editing in LIVE if match hasn't technically started (0 balls)
    if (raw === 'live') {
      const m = matchView as any
      // If we have robust ball tracking, use it. Otherwise default to allowing edits in early live state.
      // Assuming 'currentOver' starts at "0.0" and 'currentBall' at 0.
      const over = parseFloat(m?.currentOver || '0.0')
      const ball = Number(m?.currentBall || 0)
      const total = Number(m?.totalBalls || 0)

      // If no balls bowled, allow update
      if (over === 0 && ball === 0 && total === 0) return true
    }

    return false
  }, [formData.status, matchView])

  const handleSaveToss = async () => {
    if (!id) return
    if (!user) {
      toast.error('Please login to update toss.')
      return
    }
    setPreMatchSaving(true)
    try {
      await matchService.update(id, {
        tossWinner: (formData.tossWinner as any) || '',
        tossDecision: (formData.tossDecision as any) || 'bat',
        electedTo: (formData.tossDecision as any) || 'bat',
        updatedAt: Timestamp.now(),
      } as any)
      toast.success('Toss updated successfully.')
      setIsEditingToss(false)
      setMatchView((prev) =>
        prev
          ? ({
            ...(prev as any),
            tossWinner: (formData.tossWinner as any) || '',
            tossDecision: (formData.tossDecision as any) || 'bat',
            electedTo: (formData.tossDecision as any) || 'bat',
          } as any)
          : prev
      )
    } catch (e) {
      console.error('Error updating toss:', e)
      toast.error('Failed to update toss.')
    } finally {
      setPreMatchSaving(false)
    }
  }

  const toggleXI = (team: 'A' | 'B', playerId: string) => {
    if (!canEditPreMatch) return
    if (team === 'A') {
      setTeamAPlayingXI((prev) => {
        const exists = prev.includes(playerId)
        if (exists) return prev.filter((id) => id !== playerId)
        if (prev.length >= 11) {
          toast.error('Team A Playing XI cannot exceed 11 players.')
          return prev
        }
        return [...prev, playerId]
      })
    } else {
      setTeamBPlayingXI((prev) => {
        const exists = prev.includes(playerId)
        if (exists) return prev.filter((id) => id !== playerId)
        if (prev.length >= 11) {
          toast.error('Team B Playing XI cannot exceed 11 players.')
          return prev
        }
        return [...prev, playerId]
      })
    }
  }

  const handleSavePlayingXI = async () => {
    if (!id) return
    if (!user) {
      toast.error('Please login to set Playing XI.')
      return
    }
    setPreMatchSaving(true)
    try {
      await matchService.update(id, {
        teamAPlayingXI,
        teamBPlayingXI,
        teamACaptainId: teamACaptainId || '',
        teamAKeeperId: teamAKeeperId || '',
        teamBCaptainId: teamBCaptainId || '',
        teamBKeeperId: teamBKeeperId || '',
        updatedAt: Timestamp.now(),
      } as any)
      toast.success('Playing XI updated successfully.')
      setIsEditingXI(false)
      setMatchView((prev) =>
        prev
          ? ({
            ...(prev as any),
            teamAPlayingXI,
            teamBPlayingXI,
            teamACaptainId: teamACaptainId || '',
            teamAKeeperId: teamAKeeperId || '',
            teamBCaptainId: teamBCaptainId || '',
            teamBKeeperId: teamBKeeperId || '',
          } as any)
          : prev
      )
    } catch (e) {
      console.error('Error saving Playing XI:', e)
      toast.error('Failed to update Playing XI.')
    } finally {
      setPreMatchSaving(false)
    }
  }

  const handleAddManualCommentary = async () => {
    if (!id) return
    if (!user) {
      toast.error('Please login to add manual commentary.')
      return
    }
    if (!manualText.trim()) {
      toast.error('Commentary text is required.')
      return
    }
    setPreMatchSaving(true)
    try {
      await addManualCommentary(id, manualInningId, manualText.trim(), manualOver || '0.0', Number(manualBall) || 0, 0, false, false)
      setManualText('')
      toast.success('Manual commentary added.')
    } catch (e) {
      console.error('Error adding manual commentary:', e)
      toast.error('Failed to add manual commentary.')
    } finally {
      setPreMatchSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🚀 [AdminMatches] handleSubmit triggered. Mode:', mode)

    if (loading) {
      console.log('⏳ [AdminMatches] Auth store is still loading...')
      return
    }

    if (!user) {
      console.warn('⚠️ [AdminMatches] No user found in auth store.')
      toast.error('Match create করতে login লাগবে।')
      return
    }

    // Client-side hard validation
    if (!formData.tournamentId) {
      toast.error('Please select a tournament.')
      return
    }

    if (!formData.teamA || !formData.teamB) {
      toast.error('Please select both Team A and Team B.')
      return
    }

    console.log('📝 [AdminMatches] Form Data:', formData)

    if (formData.tournamentId && tournamentGroups.length > 0 && !formData.groupId) {
      toast.error('Please select a group for this tournament.')
      return
    }

    if (formData.tournamentId && tournamentGroups.length > 0 && formData.groupId) {
      const g = tournamentGroups.find((x) => x.id === formData.groupId)
      const allowed = new Set<string>((g?.squadIds || []).map((x: any) => String(x)))
      if (formData.teamA && !allowed.has(String(formData.teamA))) {
        toast.error('Team A must be from the selected group.')
        return
      }
      if (formData.teamB && !allowed.has(String(formData.teamB))) {
        toast.error('Team B must be from the selected group.')
        return
      }
    }

    // Prevent selecting same squad for both teams
    if (formData.teamA && formData.teamB && formData.teamA === formData.teamB) {
      toast.error('Team A and Team B cannot be the same.')
      return
    }

    setSaving(true)

    try {
      const stripUndefined = (obj: Record<string, any>) => {
        const out: Record<string, any> = {}
        Object.entries(obj).forEach(([k, v]) => {
          if (v !== undefined) out[k] = v
        })
        return out
      }

      // Combine date + time into a single timestamp for Firestore
      const effectiveTime = formData.time || '16:00'

      // Safer date parsing to avoid cross-browser "Invalid Date"
      console.log('📅 [AdminMatches] Parsing date/time:', formData.date, effectiveTime)
      const [year, month, day] = formData.date.split('-').map(Number)
      const [hour, min] = effectiveTime.split(':').map(Number)
      const dateTime = new Date(year, month - 1, day, hour, min)

      if (isNaN(dateTime.getTime())) {
        console.error('❌ [AdminMatches] Invalid Date calculation:', { year, month, day, hour, min })
        toast.error('Invalid Date or Time format.')
        setSaving(false)
        return
      }

      if (!formData.teamA || !formData.teamB) {
        toast.error('Please select both Team A and Team B.')
        setSaving(false)
        return
      }

      const selectedGroup = tournamentGroups.find((g) => g.id === formData.groupId)
      const squadA = squads.find((s) => s.id === formData.teamA)
      const squadB = squads.find((s) => s.id === formData.teamB)
      const resolvedTeamAName = formData.teamAName || squadA?.name || 'Team A'
      const resolvedTeamBName = formData.teamBName || squadB?.name || 'Team B'

      const matchData = stripUndefined({
        tournamentId: formData.tournamentId,
        groupId: formData.groupId || '',
        groupName: tournamentGroups.length > 0 ? (selectedGroup?.name || '') : undefined,
        // Keep legacy + canonical team fields for compatibility across pages
        teamA: formData.teamA,
        teamB: formData.teamB,
        teamAId: formData.teamA,
        teamBId: formData.teamB,
        teamASquadId: formData.teamA,
        teamBSquadId: formData.teamB,
        teamAName: resolvedTeamAName,
        teamBName: resolvedTeamBName,
        venue: formData.venue || '',
        date: Timestamp.fromDate(dateTime) as any,
        time: effectiveTime,
        oversLimit: Number(formData.oversLimit || 20),
        tossWinner: formData.tossWinner || '',
        tossDecision: (formData.tossDecision as any) || 'bat',
        electedTo: (formData.tossDecision as any) || 'bat',
        status: (formData.status as any) || 'upcoming',
        matchNo: formData.matchNo || undefined,
        matchPhase: mode === 'create' ? 'FirstInnings' : undefined,
        createdBy: mode === 'create' ? user?.uid || '' : undefined,
      })

      console.log('🚀 [AdminMatches] Sending to matchService...', matchData)

      if (mode === 'create') {
        await matchService.create(matchData as any)
        toast.success('Match created successfully!')
        navigate('/admin/matches')
      } else if (mode === 'edit' && id) {
        await matchService.update(id, matchData as any)
        toast.success('Match updated successfully!')
        navigate('/admin/matches')
      }
    } catch (error) {
      console.error('Error saving match:', error)
      const eAny: any = error
      const msg = String(eAny?.message || '')
      const code = String(eAny?.code || '')
      if (code === 'permission-denied' || msg.toLowerCase().includes('permission')) {
        try {
          const { debugAdminPermissions, printAdminDebugInfo } = await import('@/utils/debugAdmin')
          printAdminDebugInfo()
          const debugInfo = await debugAdminPermissions()
          console.error('🔍 Admin Permission Debug:', debugInfo)

          toast.error(
            <div>
              <p className="font-semibold text-red-600">⚠️ Permission Denied (Admin Request)</p>
              <p className="text-sm mt-1">Match create করার অনুমতি নেই।</p>
              <ul className="text-xs mt-2 ml-4 list-decimal space-y-1 text-slate-600">
                <li>Firestore Rule-এ আপনার UID ({debugInfo.userId}) অনুমোদিত কিনা চেক করুন।</li>
                <li>Admin collection-এ আপনার জন্যে ডকুমেন্ট আছে কিনা নিশ্চিত করুন।</li>
                <li>নিশ্চিত হয়ে Logout করে আবার Login করুন।</li>
              </ul>
              <p className="text-[10px] mt-2 text-slate-400">Error: {msg || code}</p>
            </div>,
            { duration: 8000 }
          )
          return
        } catch (debugError) {
          console.error('Debug check failed:', debugError)
        }
      }
      toast.error(`Error: ${msg || code || 'Submission failed'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleStartMatch = async (matchId: string) => {
    // Check if user is admin
    if (!user) {
      toast.error('Please login to start matches')
      return
    }

    try {
      // First, get the match data to check toss results
      const matchData = await matchService.getById(matchId)
      if (!matchData) {
        toast.error('Match not found')
        return
      }

      // Determine who bats first based on toss
      let currentBatting: 'teamA' | 'teamB' = 'teamA' // Default

      const tossWinner = (matchData as any).tossWinner
      const tossDecision = (matchData as any).tossDecision || 'bat'

      // Get team IDs for comparison
      const teamAId = (matchData as any).teamASquadId || (matchData as any).teamAId || (matchData as any).teamA
      const teamBId = (matchData as any).teamBSquadId || (matchData as any).teamBId || (matchData as any).teamB

      if (tossWinner) {
        const tossWinnerStr = String(tossWinner).trim()
        const teamAIdStr = String(teamAId).trim()
        const teamBIdStr = String(teamBId).trim()

        // Robust check for winner: key ('teamA'/'teamB') OR original ID
        const isWinnerTeamA = tossWinnerStr === 'teamA' || tossWinnerStr === teamAIdStr;
        const isWinnerTeamB = tossWinnerStr === 'teamB' || tossWinnerStr === teamBIdStr;

        if (isWinnerTeamA || isWinnerTeamB) {
          if (tossDecision === 'bat') {
            currentBatting = isWinnerTeamA ? 'teamA' : 'teamB'
          } else if (tossDecision === 'bowl') {
            currentBatting = isWinnerTeamA ? 'teamB' : 'teamA'
          }
        }
      }

      await matchService.update(matchId, {
        status: 'live',
        currentBatting,
        matchPhase: 'FirstInnings',
        updatedAt: Timestamp.now(),
      } as any)

      toast.success(`Match started! ${currentBatting === 'teamA' ? matchData.teamAName : matchData.teamBName} will bat first.`)
      loadMatches()
    } catch (error: any) {
      console.error('Error starting match:', error)
      if (error.code === 'permission-denied' || error.message?.includes('permission')) {
        toast.error('Permission denied. Make sure you are logged in as an admin.')
      } else {
        toast.error('Failed to start match')
      }
    }
  }

  const handleDeleteClick = (match: Match) => {
    // Check if user is admin is handled by UI visibility, but double check
    if (!user || user.role !== 'admin') {
      toast.error('Only admins can delete matches')
      return
    }
    setItemToDelete(match)
    setDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!itemToDelete) return
    setIsDeleting(true)
    try {
      await matchService.delete(itemToDelete.id)
      setMatches(prev => prev.filter(m => m.id !== itemToDelete.id))
      toast.success('Match deleted successfully')
      setDeleteModalOpen(false)
      setItemToDelete(null)
    } catch (error) {
      console.error('Error deleting match:', error)
      toast.error('Failed to delete match')
    } finally {
      setIsDeleting(false)
    }
  }


  const handleOpenReschedule = (match: Match) => {
    const matchDate = coerceToDate((match as any).date) || new Date()
    const pad2 = (n: number) => String(n).padStart(2, '0')
    setRescheduleData({
      // Avoid UTC shift from toISOString(); keep local date parts
      date: `${matchDate.getFullYear()}-${pad2(matchDate.getMonth() + 1)}-${pad2(matchDate.getDate())}`,
      time: matchDate.toTimeString().slice(0, 5), // HH:MM format
    })
    setRescheduleModal({ open: true, match })
  }

  const handleRescheduleMatch = async () => {
    // Check if user is admin
    if (!user || user.role !== 'admin') {
      toast.error('Only admins can reschedule matches')
      return
    }

    if (!rescheduleModal.match || !rescheduleData.date) {
      toast.error('Please select a date')
      return
    }

    try {
      const previousTime = String((rescheduleModal.match as any)?.time || '').trim()
      const effectiveTime = String(rescheduleData.time || previousTime || '16:00').trim()
      // Construct timestamp using date + time to avoid timezone parsing issues
      const newDate = new Date(`${rescheduleData.date}T${effectiveTime}`)

      await matchService.update(rescheduleModal.match.id, {
        date: Timestamp.fromDate(newDate),
        time: effectiveTime,
        updatedAt: Timestamp.now(),
      } as any)

      toast.success('Match rescheduled successfully!')
      setRescheduleModal({ open: false, match: null })
      loadMatches()
    } catch (error: any) {
      console.error('Error rescheduling match:', error)
      if (error.code === 'permission-denied' || error.message?.includes('permission')) {
        toast.error('Permission denied. Make sure you are logged in as an admin.')
      } else {
        toast.error('Failed to reschedule match')
      }
    }
  }

  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/admin/matches" className="text-teal-600 hover:underline mb-2 inline-block">
            ← Back to Matches
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            {mode === 'create' ? 'Create Match' : 'Edit Match'}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 border border-gray-200 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Tournament</label>
              <select
                required
                value={formData.tournamentId}
                onChange={(e) => {
                  const nextTournamentId = e.target.value
                  // Reset group + teams when tournament changes (prevents invalid cross-tournament/group selections)
                  setFormData((prev) => ({
                    ...prev,
                    tournamentId: nextTournamentId,
                    groupId: '',
                    teamA: '',
                    teamB: '',
                  }))

                  // Auto-generate match number if creating a new match
                  if (mode === 'create' && nextTournamentId) {
                    const t = tournaments.find(x => x.id === nextTournamentId)
                    if (t) {
                      generateMatchNumber(nextTournamentId, t.name).then(no => {
                        setFormData(prev => ({ ...prev, matchNo: no }))
                      })
                    }
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Select Tournament</option>
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.year})
                  </option>
                ))}
              </select>
            </div>

            {tournamentGroups.length > 0 ? (
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Group *</label>
                <select
                  required
                  value={formData.groupId}
                  onChange={(e) => {
                    const nextGroupId = e.target.value
                    setFormData((prev) => ({
                      ...prev,
                      groupId: nextGroupId,
                      // Reset teams when group changes (prevents cross-group match)
                      teamA: '',
                      teamB: '',
                    }))
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  disabled={!formData.tournamentId}
                >
                  <option value="">Select Group</option>
                  {tournamentGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({(g.squadIds || []).length} teams)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Group stage: only teams from the same group can play.</p>
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Team A *</label>
              <select
                required
                value={formData.teamA}
                onChange={(e) => {
                  const nextTeamA = e.target.value
                  setFormData((prev) => ({
                    ...prev,
                    teamA: nextTeamA,
                    // If same as Team B, clear Team B
                    teamB: prev.teamB === nextTeamA ? '' : prev.teamB,
                  }))
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                disabled={tournamentGroups.length > 0 && !formData.groupId}
              >
                <option value="">Select Squad</option>
                {availableSquads.map((squad) => (
                  <option key={squad.id} value={squad.id}>
                    {squad.name}
                  </option>
                ))}
              </select>
              {tournamentGroups.length > 0 && !formData.groupId ? (
                <p className="text-xs text-gray-500 mt-1">Select a group first.</p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Team B *</label>
              <select
                required
                value={formData.teamB}
                onChange={(e) => {
                  const nextTeamB = e.target.value
                  setFormData((prev) => ({
                    ...prev,
                    teamB: nextTeamB,
                    // If same as Team A, clear Team A
                    teamA: prev.teamA === nextTeamB ? '' : prev.teamA,
                  }))
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                disabled={tournamentGroups.length > 0 && !formData.groupId}
              >
                <option value="">Select Squad</option>
                {availableSquads.map((squad) => (
                  <option key={squad.id} value={squad.id} disabled={!!formData.teamA && squad.id === formData.teamA}>
                    {squad.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Venue</label>
              <input
                type="text"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                placeholder="SMA Home Ground"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date *</label>
              <WheelDatePicker
                value={formData.date}
                onChange={(val) => setFormData({ ...formData, date: val })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Time</label>
              <input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
              <p className="text-xs text-gray-500 mt-1">Default: 04:00 PM</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Overs Limit *</label>
              <input
                type="number"
                required
                min="1"
                value={formData.oversLimit}
                onChange={(e) => setFormData({ ...formData, oversLimit: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Match Number (Auto-generated)</label>
              <input
                type="text"
                value={formData.matchNo}
                onChange={(e) => setFormData({ ...formData, matchNo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 bg-slate-50 font-mono font-bold"
                placeholder="e.g. SFM01"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Toss Winner</label>
              <select
                value={formData.tossWinner}
                onChange={(e) => setFormData({ ...formData, tossWinner: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="">Not decided</option>
                <option value="teamA">Team A</option>
                <option value="teamB">Team B</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Toss Decision</label>
              <select
                value={formData.tossDecision}
                onChange={(e) => setFormData({ ...formData, tossDecision: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              >
                <option value="bat">Bat</option>
                <option value="bowl">Bowl</option>
              </select>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : mode === 'create' ? 'Create Match' : 'Update Match'}
            </button>
            <Link
              to="/admin/matches"
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
            >
              Cancel
            </Link>
          </div>
        </form >
      </div >
    )
  }

  // View mode (Pre-Match setup)
  if (mode === 'view') {
    if (loading) {
      return (
        <div className="space-y-6">
          <div className="h-10 bg-gray-200 rounded w-64 animate-pulse"></div>
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
            <div className="h-6 bg-gray-200 rounded w-48 animate-pulse mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-40 bg-gray-100 rounded-xl animate-pulse"></div>
              <div className="h-40 bg-gray-100 rounded-xl animate-pulse"></div>
            </div>
          </div>
        </div>
      )
    }

    if (!matchView) {
      return (
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-md p-8 border border-gray-200 text-center">
            <h1 className="text-2xl font-bold text-gray-900">Match not found</h1>
            <Link to="/admin/matches" className="inline-block mt-6 px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold">
              Back to Matches
            </Link>
          </div>
        </div>
      )
    }

    const teamAName = formData.teamAName || squads.find((s) => s.id === formData.teamA)?.name || 'Team A'
    const teamBName = formData.teamBName || squads.find((s) => s.id === formData.teamB)?.name || 'Team B'
    const d = coerceToDate((matchView as any).date)
    const timeText = (matchView as any).time || (d ? formatTimeLabel(d) : '')

    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pb-6 border-b border-slate-200">
          <div>
            <Link to="/admin/matches" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-3 text-sm font-medium">
              <ArrowLeft size={16} /> Back to Matches
            </Link>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
              {teamAName} <span className="text-slate-300 mx-2">vs</span> {teamBName}
            </h1>
            <div className="flex items-center gap-3 mt-3 text-sm font-medium text-slate-500">
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded text-slate-600">
                <MapPin size={14} /> {matchView.venue || 'Venue TBA'}
              </span>
              {d && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded text-slate-600">
                  <Calendar size={14} /> {formatDateLabel(d)}
                </span>
              )}
              {timeText && (
                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded text-slate-600">
                  <Clock size={14} /> {timeText}
                </span>
              )}
              {formData.status && (
                <StatusBadge status={String(formData.status)} />
              )}
            </div>
          </div>
          <div className="flex gap-3 flex-wrap md:justify-end">
            <Link
              to={`/admin/matches/${matchView.id}/edit`}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50 hover:border-slate-300 transition shadow-sm"
            >
              <Edit2 size={16} /> Edit Details
            </Link>
            <Link
              to={`/match/${matchView.id}`}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50 hover:border-slate-300 transition shadow-sm"
            >
              <Eye size={16} /> Public View
            </Link>
            {canEditPreMatch && (
              <button
                onClick={() => handleStartMatch(matchView.id)}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition shadow-sm shadow-green-200"
              >
                <Play size={16} fill="currentColor" /> Start Match
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column: Playing XI */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                    <User size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 leading-none">Playing XI</h2>
                    <p className="text-sm text-slate-500 mt-1">Select 11 players for each team</p>
                  </div>
                </div>
                {isEditingXI ? (
                  <button
                    onClick={handleSavePlayingXI}
                    disabled={preMatchSaving || !canEditPreMatch}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
                  >
                    {preMatchSaving ? 'Saving...' : <><Save size={16} /> Save Squads</>}
                  </button>
                ) : (
                  <button
                    onClick={() => setIsEditingXI(true)}
                    disabled={!canEditPreMatch}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-50 hover:text-blue-600 transition"
                  >
                    <Edit2 size={16} /> Modify
                  </button>
                )}
              </div>

              {!canEditPreMatch && (
                <div className="bg-amber-50 px-6 py-3 border-b border-amber-100 flex items-center gap-2 text-amber-800 text-sm font-medium">
                  <AlertCircle size={16} /> Playing XI is locked because the match has started/finished.
                </div>
              )}

              <div className={`grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 ${!isEditingXI ? 'opacity-90' : ''}`}>
                {/* Team A Selection */}
                <div className="flex flex-col h-full">
                  <div className="p-4 bg-slate-50/30 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">{teamAName}</h3>
                    <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full border ${teamAPlayingXI.length === 11 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {teamAPlayingXI.length}/11
                    </span>
                  </div>
                  <div className="flex-1 p-2 max-h-[500px] overflow-y-auto space-y-1">
                    {teamAPlayers.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-sm italic">No squad players found for this team.</div>
                    ) : teamAPlayers.map((p: any) => {
                      const checked = teamAPlayingXI.includes(p.id)
                      const isCaptain = p.id === teamACaptainId
                      const isKeeper = p.id === teamAKeeperId
                      return (
                        <label key={p.id} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'bg-blue-50/50 border-blue-200 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                              {checked && <Check size={12} className="text-white" />}
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleXI('A', p.id)}
                              disabled={!canEditPreMatch || !isEditingXI}
                              className="hidden"
                            />
                            <span className={`text-sm font-semibold ${checked ? 'text-blue-900' : 'text-slate-700'}`}>{p.name}</span>
                          </div>
                          <div className="flex gap-1">
                            {isCaptain && <span className="w-6 h-6 flex items-center justify-center bg-amber-100 text-amber-700 rounded-full text-[10px] font-black border border-amber-200" title="Captain">C</span>}
                            {isKeeper && <span className="w-6 h-6 flex items-center justify-center bg-purple-100 text-purple-700 rounded-full text-[10px] font-black border border-purple-200" title="Wicket Keeper">WK</span>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 pl-1">Captain</label>
                      <div className="relative">
                        <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                          value={teamACaptainId}
                          onChange={(e) => setTeamACaptainId(e.target.value)}
                          disabled={!canEditPreMatch || !isEditingXI}
                          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                        >
                          <option value="">Select C</option>
                          {teamAPlayers.filter((p: any) => teamAPlayingXI.includes(p.id)).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 pl-1">Wicket Keeper</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 border border-slate-300 rounded px-0.5">WK</div>
                        <select
                          value={teamAKeeperId}
                          onChange={(e) => setTeamAKeeperId(e.target.value)}
                          disabled={!canEditPreMatch || !isEditingXI}
                          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                        >
                          <option value="">Select WK</option>
                          {teamAPlayers.filter((p: any) => teamAPlayingXI.includes(p.id)).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Team B Selection */}
                <div className="flex flex-col h-full">
                  <div className="p-4 bg-slate-50/30 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">{teamBName}</h3>
                    <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full border ${teamBPlayingXI.length === 11 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {teamBPlayingXI.length}/11
                    </span>
                  </div>
                  <div className="flex-1 p-2 max-h-[500px] overflow-y-auto space-y-1">
                    {teamBPlayers.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-sm italic">No squad players found for this team.</div>
                    ) : teamBPlayers.map((p: any) => {
                      const checked = teamBPlayingXI.includes(p.id)
                      const isCaptain = p.id === teamBCaptainId
                      const isKeeper = p.id === teamBKeeperId
                      return (
                        <label key={p.id} className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${checked ? 'bg-blue-50/50 border-blue-200 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                              {checked && <Check size={12} className="text-white" />}
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleXI('B', p.id)}
                              disabled={!canEditPreMatch || !isEditingXI}
                              className="hidden"
                            />
                            <span className={`text-sm font-semibold ${checked ? 'text-blue-900' : 'text-slate-700'}`}>{p.name}</span>
                          </div>
                          <div className="flex gap-1">
                            {isCaptain && <span className="w-6 h-6 flex items-center justify-center bg-amber-100 text-amber-700 rounded-full text-[10px] font-black border border-amber-200" title="Captain">C</span>}
                            {isKeeper && <span className="w-6 h-6 flex items-center justify-center bg-purple-100 text-purple-700 rounded-full text-[10px] font-black border border-purple-200" title="Wicket Keeper">WK</span>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 pl-1">Captain</label>
                      <div className="relative">
                        <Shield size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <select
                          value={teamBCaptainId}
                          onChange={(e) => setTeamBCaptainId(e.target.value)}
                          disabled={!canEditPreMatch || !isEditingXI}
                          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                        >
                          <option value="">Select C</option>
                          {teamBPlayers.filter((p: any) => teamBPlayingXI.includes(p.id)).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5 pl-1">Wicket Keeper</label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 border border-slate-300 rounded px-0.5">WK</div>
                        <select
                          value={teamBKeeperId}
                          onChange={(e) => setTeamBKeeperId(e.target.value)}
                          disabled={!canEditPreMatch || !isEditingXI}
                          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                        >
                          <option value="">Select WK</option>
                          {teamBPlayers.filter((p: any) => teamBPlayingXI.includes(p.id)).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Toss & Manual Comm */}
          <div className="space-y-8">
            {/* Toss Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><Trophy size={18} /></span>
                  <h2 className="font-bold text-slate-900">Toss</h2>
                </div>
                {!isEditingToss && (
                  <span className="flex items-center gap-1 text-[10px] uppercase font-black tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                    <CheckCircle size={10} /> Saved
                  </span>
                )}
              </div>

              <div className="p-6">
                {isEditingToss ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Toss Winner</label>
                      <select
                        value={formData.tossWinner}
                        onChange={(e) => setFormData({ ...formData, tossWinner: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select Winner</option>
                        <option value="teamA">{teamAName}</option>
                        <option value="teamB">{teamBName}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Decision</label>
                      <select
                        value={formData.tossDecision}
                        onChange={(e) => setFormData({ ...formData, tossDecision: e.target.value as any })}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="bat">Bat</option>
                        <option value="bowl">Bowl</option>
                      </select>
                    </div>
                    <div className="pt-2 flex gap-2">
                      <button onClick={handleSaveToss} disabled={preMatchSaving} className="flex-1 bg-blue-600 text-white rounded-lg py-2 font-bold text-sm hover:bg-blue-700">Save</button>
                      <button onClick={() => setIsEditingToss(false)} className="px-3 bg-slate-100 text-slate-600 rounded-lg font-bold text-sm hover:bg-slate-200">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    {formData.tossWinner ? (
                      <div>
                        <div className="text-slate-500 text-sm mb-1">Toss Winner</div>
                        <div className="text-xl font-black text-slate-900 mb-3">
                          {formData.tossWinner === 'teamA' ? teamAName : teamBName}
                        </div>
                        <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-800 px-3 py-1.5 rounded-full border border-amber-100 text-sm font-bold">
                          Elected to {formData.tossDecision?.toUpperCase()}
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">Toss not yet decided</div>
                    )}
                    {canEditPreMatch && (
                      <button onClick={() => setIsEditingToss(true)} className="mt-6 w-full py-2 border border-slate-200 rounded-lg text-slate-600 font-bold text-sm hover:bg-slate-50 hover:text-blue-600 transition">
                        Update Toss
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Manual Commentary Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-purple-100 text-purple-600 rounded-lg"><Mic size={18} /></span>
                  <h2 className="font-bold text-slate-900">Manual Update</h2>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Innings</label>
                    <select
                      value={manualInningId}
                      onChange={(e) => setManualInningId(e.target.value as any)}
                      className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="teamA">{teamAName}</option>
                      <option value="teamB">{teamBName}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Over</label>
                    <input value={manualOver} onChange={e => setManualOver(e.target.value)} className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg text-center font-mono" placeholder="0.0" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Ball</label>
                    <input type="number" value={manualBall} onChange={e => setManualBall(Number(e.target.value))} className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg text-center font-mono" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={handleAddManualCommentary} disabled={!manualText.trim()} className="w-full bg-slate-900 text-white rounded-lg py-2 text-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition">
                      Post
                    </button>
                  </div>
                </div>
                <div>
                  <textarea
                    value={manualText}
                    onChange={e => setManualText(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    placeholder="Type commentary here..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // List View
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded-lg w-32 animate-pulse"></div>
        </div>
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
        <TableSkeleton columns={4} rows={6} />
      </div>
    )
  }

  const activeLiveMatches = matches.filter(m => String((m as any).status || '').toLowerCase() === 'live')

  const filteredMatches = matches.filter(match => {
    const rawStatus = String((match as any).status || 'upcoming').toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    const matchTerms = [
      match.teamAName, (match as any).teamA,
      match.teamBName, (match as any).teamB,
      match.venue,
      match.id,
      (match as any).matchNo,
      tournaments.find(t => t.id === match.tournamentId)?.name
    ].map(t => String(t || '').toLowerCase());

    const matchesSearch = !searchTerm || matchTerms.some(t => t.includes(searchLower));

    let matchesStatus = true;
    if (filterStatus === 'live') matchesStatus = rawStatus === 'live';
    else if (filterStatus === 'completed') matchesStatus = ['completed', 'finished', 'abandoned'].includes(rawStatus);
    else if (filterStatus === 'upcoming') matchesStatus = rawStatus === 'upcoming';

    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const da = coerceToDate((a as any).date) || new Date(0)
    const db = coerceToDate((b as any).date) || new Date(0)
    return db.getTime() - da.getTime()
  })

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Match Center</h1>
          <p className="text-slate-500 text-sm mt-1">Manage fixture schedules, venues, and status.</p>
        </div>
        <Link
          to="/admin/matches/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm"
        >
          <Plus size={18} />
          Create Match
        </Link>
      </div>

      {/* Live Matches Section - Pinned */}
      {activeLiveMatches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeLiveMatches.map(match => (
            <div key={match.id} className="bg-white rounded-xl shadow-sm border border-rose-100 p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Clock size={64} className="text-rose-600" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-rose-600 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                    Live Now
                  </span>
                  <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                    {match.oversLimit} Overs
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-lg leading-snug mb-1">
                  {match.teamAName || 'Team A'} vs {match.teamBName || 'Team B'}
                </h3>
                <p className="text-sm text-slate-500 mb-4">{match.venue}</p>

                <div className="flex gap-2">
                  <Link
                    to={`/admin/live/${match.id}/scoring`}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold py-2 px-3 rounded-lg text-center transition-colors shadow-sm shadow-rose-200"
                  >
                    Score Match
                  </Link>
                  <Link
                    to={`/admin/matches/${match.id}`}
                    className="p-2 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 rounded-lg transition-colors"
                  >
                    <Eye size={18} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Filter & Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row gap-4 justify-between items-center bg-slate-50/50">
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by team, ID, or match number (e.g. BT204)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-blue-400 focus:outline-none cursor-pointer min-w-[140px]"
            >
              <option value="all">All Stages</option>
              <option value="upcoming">Upcoming</option>
              <option value="live">Live</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">Match Info</th>
                <th className="px-6 py-4">Teams</th>
                <th className="px-6 py-4">Schedule</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMatches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400">
                      <Calendar className="mb-4 text-slate-200" size={48} strokeWidth={1} />
                      <p className="text-lg font-medium text-slate-900">No matches found</p>
                      <p className="text-sm">Create a new match to get started.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMatches.map(match => {
                  const matchDate = coerceToDate((match as any).date) || new Date();
                  const statusRaw = String((match as any).status || '').toLowerCase();
                  const isLive = statusRaw === 'live';
                  const isUpcoming = statusRaw === 'upcoming';
                  const tourneyName = tournaments.find(t => t.id === match.tournamentId)?.name || 'Friendly Match';

                  return (
                    <tr key={match.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded font-mono text-xs font-bold ${(match as any).matchNo ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                            {(match as any).matchNo ? (match as any).matchNo : `#${match.id.slice(0, 6).toUpperCase()}`}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-blue-600 uppercase tracking-tight">{tourneyName}</div>
                            <div className="text-xs text-slate-400 capitalize">{match.groupName ? `${match.groupName} Group` : 'Match'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900 text-sm">
                          <div className="mb-1">{match.teamAName || 'Team A'}</div>
                          <div className="text-slate-400 text-xs font-normal mb-1">vs</div>
                          <div>{match.teamBName || 'Team B'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-slate-600">
                          <span className="flex items-center gap-1.5 font-medium text-slate-900">
                            <Calendar size={14} className="text-slate-400" />
                            {formatDateLabel(matchDate)}
                          </span>
                          <span className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                            <Clock size={14} className="text-slate-400" />
                            {(match as any).time || matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={statusRaw} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isUpcoming && (
                            <button
                              onClick={() => handleStartMatch(match.id)}
                              className="hidden group-hover:flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition"
                            >
                              Start
                            </button>
                          )}
                          {isLive && (
                            <Link
                              to={`/admin/live/${match.id}/scoring`}
                              className="hidden group-hover:flex items-center gap-1 px-2 py-1 bg-rose-600 text-white rounded text-xs font-bold hover:bg-rose-700 transition"
                            >
                              Score
                            </Link>
                          )}

                          <div className="flex items-center bg-slate-100 rounded-lg p-1">
                            {isUpcoming && (
                              <button onClick={() => handleOpenReschedule(match)} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md transition" title="Reschedule">
                                <CalendarClock size={16} />
                              </button>
                            )}
                            <Link to={`/admin/matches/${match.id}/edit`} className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-white rounded-md transition" title="Edit">
                              <Edit2 size={16} />
                            </Link>
                            <Link to={`/admin/matches/${match.id}`} className="p-1.5 text-slate-900 bg-white shadow-sm rounded-md transition" title="View Full Control">
                              <Eye size={16} />
                            </Link>
                            <button onClick={() => handleDeleteClick(match)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-md transition" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reschedule Modal */}
      {rescheduleModal.open && rescheduleModal.match && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                <CalendarClock size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Reschedule</h3>
                <p className="text-xs text-slate-500">Update match timing</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">New Date</label>
                <WheelDatePicker
                  value={rescheduleData.date}
                  onChange={(val) => setRescheduleData({ ...rescheduleData, date: val })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">New Time</label>
                <input
                  type="time"
                  value={rescheduleData.time}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, time: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => setRescheduleModal({ open: false, match: null })}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRescheduleMatch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition shadow-sm shadow-blue-200"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Match"
        message="This action cannot be undone. This will permanently delete the match and remove match stats from all players who played in this match."
        verificationText={`${itemToDelete?.teamAName || (itemToDelete as any)?.teamA} vs ${itemToDelete?.teamBName || (itemToDelete as any)?.teamB}`}
        itemType="Match"
        isDeleting={isDeleting}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase()
  if (s === 'live') return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-wide">LIVE</span>
  if (s === 'upcoming') return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase tracking-wide">Upcoming</span>
  if (['completed', 'finished'].includes(s)) return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wide">Finished</span>
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 uppercase tracking-wide">{s}</span>
}

