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
import toast from 'react-hot-toast'
import { SkeletonCard } from '@/components/skeletons/SkeletonCard'
import TableSkeleton from '@/components/skeletons/TableSkeleton'
import { addManualCommentary } from '@/services/commentary/commentaryService'
import { coerceToDate, formatDateLabel, formatTimeLabel } from '@/utils/date'

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
  })
  const [saving, setSaving] = useState(false)
  const [rescheduleModal, setRescheduleModal] = useState<{ open: boolean; match: Match | null }>({ open: false, match: null })
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '' })

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
    return raw === 'upcoming'
  }, [formData.status])

  const handleSaveToss = async () => {
    if (!id) return
    if (!user || user.role !== 'admin') {
      toast.error('Only admins can update toss.')
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
    if (!user || user.role !== 'admin') {
      toast.error('Only admins can set Playing XI.')
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
    if (!user || user.role !== 'admin') {
      toast.error('Only admins can add manual commentary.')
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

    // Hard guard: avoid permission-denied loops (send user to Settings bootstrap)
    if (!user || user.role !== 'admin') {
      toast.error('Match create করতে Admin permission লাগবে। Settings → “Make Me Admin” দিয়ে ঠিক করুন।')
      navigate('/admin/settings')
      return
    }

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
      const effectiveTime = formData.time || '16:00' // Default: 04:00 PM
      const dateTime = new Date(`${formData.date}T${effectiveTime}`)

      const selectedGroup = tournamentGroups.find((g) => g.id === formData.groupId)
      const resolvedTeamAName = formData.teamAName || squads.find((s) => s.id === formData.teamA)?.name || 'Team A'
      const resolvedTeamBName = formData.teamBName || squads.find((s) => s.id === formData.teamB)?.name || 'Team B'

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
        date: Timestamp.fromDate(dateTime),
        time: effectiveTime,
        oversLimit: Number(formData.oversLimit || 20),
        tossWinner: formData.tossWinner || '',
        tossDecision: (formData.tossDecision as any) || 'bat',
        electedTo: (formData.tossDecision as any) || 'bat',
        status: (formData.status as any) || 'upcoming',
        createdBy: mode === 'create' ? user?.uid || '' : undefined,
      } as any)

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
              <p className="font-semibold">⚠️ Permission Denied</p>
              <p className="text-sm mt-1">Match create করতে admin permission লাগবে।</p>
              <ul className="text-xs mt-1 ml-4 list-disc space-y-0.5">
                <li><strong>admin/{debugInfo.userId || 'YOUR_UID'}</strong> ডকুমেন্ট আছে কিনা দেখুন</li>
                <li><strong>Auth Store Role</strong> = admin কিনা দেখুন</li>
                <li>Logout → Login করে token refresh করুন</li>
              </ul>
              <p className="text-xs mt-2">Details: browser console (F12) → Admin Permission Debug</p>
            </div>,
            { duration: 10000 }
          )
          return
        } catch (debugError) {
          console.error('Debug check failed:', debugError)
        }
      }
      toast.error(msg || code || 'Failed to save match')
    } finally {
      setSaving(false)
    }
  }

  const handleStartMatch = async (matchId: string) => {
    // Check if user is admin
    if (!user || user.role !== 'admin') {
      toast.error('Only admins can start matches')
      return
    }

    try {
      await matchService.update(matchId, {
        status: 'live',
        updatedAt: Timestamp.now(),
      } as any)
      toast.success('Match started!')
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

  const handleDeleteMatch = async (matchId: string) => {
    // Check if user is admin
    if (!user || user.role !== 'admin') {
      toast.error('Only admins can delete matches')
      return
    }

    if (!confirm('Are you sure you want to delete this match? This will also remove match stats from all players who played in this match.')) {
      return
    }

    try {
      console.log('🗑️ Attempting to delete match:', matchId)
      console.log('👤 Current user:', { uid: user.uid, email: user.email, role: user.role })
      
      // Debug admin permissions before attempting delete
      const { debugAdminPermissions } = await import('@/utils/debugAdmin')
      const debugInfo = await debugAdminPermissions()
      console.log('🔍 Admin Permission Debug:', debugInfo)
      console.log('🔍 Admin Permission Debug (JSON):', JSON.stringify(debugInfo, null, 2))
      
      if (!debugInfo.hasAdminDoc) {
        toast.error(
          <div>
            <p className="font-semibold">❌ Admin Document Missing</p>
            <p className="text-sm mt-1">Admin document not found at: admin/{user.uid}</p>
            <p className="text-xs mt-1">Please create it in Firebase Console or use Settings page.</p>
          </div>,
          { duration: 8000 }
        )
        return
      }
      
      await matchService.delete(matchId)
      toast.success('Match deleted successfully. Player stats have been updated.')
      loadMatches()
    } catch (error: any) {
      console.error('❌ Error deleting match:', error)
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
      })
      
      // Run debug check
      try {
        const { debugAdminPermissions, printAdminDebugInfo } = await import('@/utils/debugAdmin')
        printAdminDebugInfo()
        const debugInfo = await debugAdminPermissions()
        console.error('🔍 Debug Info After Error:', debugInfo)
      } catch (debugError) {
        console.error('Debug check failed:', debugError)
      }
      
      // Check if it's a permission error
      if (error.code === 'permission-denied' || error.message?.includes('permission') || error.message?.includes('Permission')) {
        toast.error(
          <div>
            <p className="font-semibold">⚠️ Permission Denied</p>
            <p className="text-sm mt-1">Проверьте Debug (F12) — там будут значения:</p>
            <ul className="text-xs mt-1 ml-4 list-disc space-y-0.5">
              <li><strong>projectId</strong> (должен быть sma-cricket-league)</li>
              <li><strong>userId</strong> (UID должен совпадать с ID документа в admin)</li>
              <li><strong>hasAdminDoc</strong> (должно быть true)</li>
              <li><strong>isUsingEmulators</strong> (должно быть false, если вы не запускаете emulators)</li>
            </ul>
            <ol className="text-xs mt-1 ml-4 list-decimal space-y-0.5">
              <li>Firestore rules not deployed (Console → Firestore → Rules → Publish)</li>
              <li>Auth token not refreshed (Logout & Login)</li>
              <li>Admin document missing (Check console F12 for debug info)</li>
            </ol>
            <p className="text-xs mt-2 font-semibold">Check browser console (F12) for detailed debug info</p>
          </div>,
          { duration: 10000 }
        )
      } else {
        toast.error(error.message || 'Failed to delete match')
      }
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
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
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
        </form>
      </div>
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
      <div className="max-w-6xl mx-auto space-y-6 px-2 sm:px-0">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <Link to="/admin/matches" className="text-teal-600 hover:underline inline-block">
              ← Back to Matches
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">
              {teamAName} vs {teamBName}
            </h1>
            <p className="text-gray-600 mt-1">
              {matchView.venue || 'Venue TBA'}
              {d ? ` • ${formatDateLabel(d)}${timeText ? ` • ${timeText}` : ''}` : ''}
              {formData.status ? ` • ${String(formData.status).toUpperCase()}` : ''}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap md:justify-end">
            <Link
              to={`/admin/matches/${matchView.id}/edit`}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-800"
            >
              Edit Match
            </Link>
            <Link
              to={`/match/${matchView.id}`}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300"
            >
              View Public
            </Link>
            {canEditPreMatch ? (
              <button
                onClick={() => handleStartMatch(matchView.id)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
              >
                Start Match
              </button>
            ) : null}
          </div>
        </div>

        {/* Toss */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">Toss</h2>
              {!isEditingToss ? (
                <span className="px-2 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">Saved</span>
              ) : null}
            </div>
            {isEditingToss ? (
              <button
                onClick={handleSaveToss}
                disabled={preMatchSaving || !canEditPreMatch}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50"
              >
                Save Toss
              </button>
            ) : (
              <button
                onClick={() => setIsEditingToss(true)}
                disabled={!canEditPreMatch}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50"
              >
                Modify
              </button>
            )}
          </div>
          {!canEditPreMatch ? (
            <p className="text-sm text-gray-500 mb-4">Toss can be edited before the match starts.</p>
          ) : null}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!isEditingToss ? 'opacity-60' : ''}`}>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Toss Winner</label>
              <select
                value={formData.tossWinner}
                onChange={(e) => setFormData({ ...formData, tossWinner: e.target.value })}
                disabled={!canEditPreMatch || !isEditingToss}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 disabled:bg-gray-50"
              >
                <option value="">Not decided</option>
                <option value="teamA">{teamAName}</option>
                <option value="teamB">{teamBName}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Decision</label>
              <select
                value={formData.tossDecision}
                onChange={(e) => setFormData({ ...formData, tossDecision: e.target.value as any })}
                disabled={!canEditPreMatch || !isEditingToss}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 disabled:bg-gray-50"
              >
                <option value="bat">Bat</option>
                <option value="bowl">Bowl</option>
              </select>
            </div>
          </div>
        </div>

        {/* Playing XI */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">Playing XI</h2>
              {!isEditingXI ? (
                <span className="px-2 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-700">Saved</span>
              ) : null}
            </div>
            {isEditingXI ? (
              <button
                onClick={handleSavePlayingXI}
                disabled={preMatchSaving || !canEditPreMatch}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50"
              >
                Save Playing XI
              </button>
            ) : (
              <button
                onClick={() => setIsEditingXI(true)}
                disabled={!canEditPreMatch}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg font-semibold hover:bg-slate-800 disabled:opacity-50"
              >
                Modify
              </button>
            )}
          </div>
          {!canEditPreMatch ? (
            <p className="text-sm text-gray-500 mb-4">Playing XI can be edited before the match starts.</p>
          ) : null}

          <div className={`grid grid-cols-1 xl:grid-cols-2 gap-6 ${!isEditingXI ? 'opacity-60' : ''}`}>
            {/* Team A */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-gray-900">{teamAName}</div>
                <div className="text-sm text-gray-600">{teamAPlayingXI.length}/11 selected</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-auto pr-1">
                {teamAPlayers.map((p: any) => {
                  const checked = teamAPlayingXI.includes(p.id)
                  return (
                    <label key={p.id} className={`flex items-center gap-2 p-2 rounded-lg border ${checked ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-white'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleXI('A', p.id)}
                        disabled={!canEditPreMatch || !isEditingXI}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-semibold text-gray-900 truncate">{p.name}</span>
                    </label>
                  )
                })}
                {teamAPlayers.length === 0 ? <div className="text-sm text-gray-500">No squad players found.</div> : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Captain</label>
                  <select
                    value={teamACaptainId}
                    onChange={(e) => setTeamACaptainId(e.target.value)}
                    disabled={!canEditPreMatch || !isEditingXI}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  >
                    <option value="">Not set</option>
                    {teamAPlayers.filter((p: any) => teamAPlayingXI.includes(p.id)).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Wicket Keeper</label>
                  <select
                    value={teamAKeeperId}
                    onChange={(e) => setTeamAKeeperId(e.target.value)}
                    disabled={!canEditPreMatch || !isEditingXI}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  >
                    <option value="">Not set</option>
                    {teamAPlayers.filter((p: any) => teamAPlayingXI.includes(p.id)).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Team B */}
            <div className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-bold text-gray-900">{teamBName}</div>
                <div className="text-sm text-gray-600">{teamBPlayingXI.length}/11 selected</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-auto pr-1">
                {teamBPlayers.map((p: any) => {
                  const checked = teamBPlayingXI.includes(p.id)
                  return (
                    <label key={p.id} className={`flex items-center gap-2 p-2 rounded-lg border ${checked ? 'border-teal-300 bg-teal-50' : 'border-gray-200 bg-white'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleXI('B', p.id)}
                        disabled={!canEditPreMatch || !isEditingXI}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-semibold text-gray-900 truncate">{p.name}</span>
                    </label>
                  )
                })}
                {teamBPlayers.length === 0 ? <div className="text-sm text-gray-500">No squad players found.</div> : null}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Captain</label>
                  <select
                    value={teamBCaptainId}
                    onChange={(e) => setTeamBCaptainId(e.target.value)}
                    disabled={!canEditPreMatch || !isEditingXI}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  >
                    <option value="">Not set</option>
                    {teamBPlayers.filter((p: any) => teamBPlayingXI.includes(p.id)).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Wicket Keeper</label>
                  <select
                    value={teamBKeeperId}
                    onChange={(e) => setTeamBKeeperId(e.target.value)}
                    disabled={!canEditPreMatch || !isEditingXI}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-50"
                  >
                    <option value="">Not set</option>
                    {teamBPlayers.filter((p: any) => teamBPlayingXI.includes(p.id)).map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Manual Commentary */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Manual Commentary</h2>
            <button
              onClick={handleAddManualCommentary}
              disabled={preMatchSaving || !manualText.trim()}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50"
            >
              Add Commentary
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Innings</label>
              <select
                value={manualInningId}
                onChange={(e) => setManualInningId(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="teamA">{teamAName}</option>
                <option value="teamB">{teamBName}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Over</label>
              <input
                value={manualOver}
                onChange={(e) => setManualOver(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Ball</label>
              <input
                type="number"
                value={manualBall}
                onChange={(e) => setManualBall(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                min={0}
              />
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1"> </label>
              <div className="text-xs text-gray-500 pt-2">This can be used before match start as well.</div>
            </div>
          </div>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            placeholder="Write a manual commentary update..."
          />
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

  const upcomingMatches = matches.filter(m => String((m as any).status || '').toLowerCase() === 'upcoming')
  const liveMatches = matches.filter(m => String((m as any).status || '').toLowerCase() === 'live')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Matches</h1>
          <p className="text-gray-600 mt-1">Manage all matches</p>
        </div>
        <Link
          to="/admin/matches/new"
          className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition"
        >
          + New Match
        </Link>
      </div>

      {/* Live Matches */}
      {liveMatches.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🔴 Live Matches</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {liveMatches.map((match) => (
              <div
                key={match.id}
                className="bg-white rounded-xl shadow-md p-6 border-2 border-red-200"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                  <h3 className="font-semibold text-gray-900">
                      {match.teamAName || (match as any).teamA || (match as any).teamAId} vs {match.teamBName || (match as any).teamB || (match as any).teamBId}
                    </h3>
                    <p className="text-sm text-gray-600">{match.venue}</p>
                  </div>
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                    LIVE
                  </span>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/admin/live/${match.id}/scoring`}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 text-center"
                  >
                    Score Match
                  </Link>
                  <Link
                    to={`/admin/matches/${match.id}`}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Matches - Comprehensive Table */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">All Matches</h2>
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Teams</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Venue</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {matches.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No matches found
                    </td>
                  </tr>
                ) : (
                  matches.map((match) => {
                    const matchDate = coerceToDate((match as any).date) || new Date()
                    const statusRaw = String((match as any).status || '').toLowerCase()
                    const isUpcoming = statusRaw === 'upcoming'
                    const isLive = statusRaw === 'live'
                    const isCompleted = statusRaw === 'completed' || statusRaw === 'finished'
                    const canStart = isUpcoming || (!isLive && !isCompleted)
                    
                    return (
                      <tr key={match.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">
                            {match.teamAName || (match as any).teamA || (match as any).teamAId} vs {match.teamBName || (match as any).teamB || (match as any).teamBId}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-700">{match.venue || '—'}</td>
                        <td className="px-6 py-4 text-gray-700">
                          <div>
                            <div>{matchDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                            <div className="text-sm text-gray-500">{matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {isLive && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                              🔴 LIVE
                            </span>
                          )}
                          {isUpcoming && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                              Upcoming
                            </span>
                          )}
                          {isCompleted && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                              Completed
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2 flex-wrap">
                            {canStart && (
                              <button
                                onClick={() => handleStartMatch(match.id)}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
                                title="Start match (even before scheduled time)"
                              >
                                Start
                              </button>
                            )}
                            {isUpcoming && (
                              <button
                                onClick={() => handleOpenReschedule(match)}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                                title="Reschedule match date/time"
                              >
                                Reschedule
                              </button>
                            )}
                            <Link
                              to={`/admin/matches/${match.id}/edit`}
                              className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition"
                              title="Edit match details"
                            >
                              Edit
                            </Link>
                            <button
                              onClick={() => handleDeleteMatch(match.id)}
                              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
                              title="Delete match"
                            >
                              Delete
                            </button>
                            <Link
                              to={`/admin/matches/${match.id}`}
                              className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition"
                              title="Setup / View (Admin)"
                            >
                              View
                            </Link>
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
      </div>

      {/* Upcoming Matches - Quick View */}
      {upcomingMatches.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming Matches</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingMatches.slice(0, 6).map((match) => {
              const matchDate = coerceToDate((match as any).date) || new Date()
              return (
                <div
                  key={match.id}
                  className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition"
                >
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 mb-1">
                  {match.teamAName || (match as any).teamA || (match as any).teamAId} vs {match.teamBName || (match as any).teamB || (match as any).teamBId}
                    </h3>
                    <p className="text-sm text-gray-600">{match.venue || '—'}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {matchDate.toLocaleDateString()} at {matchDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleStartMatch(match.id)}
                      className="flex-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
                    >
                      Start
                    </button>
                    <button
                      onClick={() => handleOpenReschedule(match)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => handleDeleteMatch(match.id)}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleModal.open && rescheduleModal.match && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reschedule Match</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {rescheduleModal.match.teamAName || (rescheduleModal.match as any).teamA || (rescheduleModal.match as any).teamAId} vs {rescheduleModal.match.teamBName || (rescheduleModal.match as any).teamB || (rescheduleModal.match as any).teamBId}
                </label>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleData.date}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New Time</label>
                <input
                  type="time"
                  value={rescheduleData.time}
                  onChange={(e) => setRescheduleData({ ...rescheduleData, time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleRescheduleMatch}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition"
              >
                Reschedule
              </button>
              <button
                onClick={() => setRescheduleModal({ open: false, match: null })}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

