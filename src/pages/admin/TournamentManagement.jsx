import { useState, useEffect } from 'react'
import { tournamentsAPI, matchesAPI, squadsAPI } from '../../services/api'
import { useFirebase } from '../../contexts/FirebaseContext'

const TournamentManagement = () => {
  const { currentAdmin } = useFirebase()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingTournament, setEditingTournament] = useState(null)
  const [pointsModalOpen, setPointsModalOpen] = useState(false)
  const [pointsLoading, setPointsLoading] = useState(false)
  const [pointsError, setPointsError] = useState('')
  const [pointsData, setPointsData] = useState({
    groupStage: false,
    groups: [],
    overall: [],
  })
  const [pointsTournament, setPointsTournament] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [seedingTournamentId, setSeedingTournamentId] = useState('')

  const emptyGroupStage = {
    enabled: false,
    qualifiersPerGroup: 2,
    groups: [],
  }

  const emptyKnockoutStage = {
    enabled: false,
    autoSeedFromGroups: true,
    stages: [],
  }

  const [formData, setFormData] = useState({
    name: '',
    year: new Date().getFullYear(),
    schoolName: '',
    startDate: '',
    format: 'T20',
    status: 'upcoming',
    description: '',
    groupStage: emptyGroupStage,
    knockoutStage: emptyKnockoutStage,
    participantSquads: [],
  })
  const [availableSquads, setAvailableSquads] = useState([])
  const [availableSquadsLoading, setAvailableSquadsLoading] = useState(false)
  const [availableSquadsError, setAvailableSquadsError] = useState('')
  const [isStarting, setIsStarting] = useState(false)

  useEffect(() => {
    loadTournaments()
  }, [])

  const loadTournaments = async () => {
    try {
      setLoading(true)
      const response = await tournamentsAPI.getAll()
      setTournaments(response.data || [])
      setError('')
    } catch (error) {
      console.error('Error loading tournaments:', error)
      setError('Failed to load tournaments')
    } finally {
      setLoading(false)
    }
  }

  const ensureGroupCount = (groups, count, qualifiersFallback = 2) => {
    const safeCount = Math.max(1, Math.min(8, count))
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

    const prepareGroup = (group, index) => {
      const key = (group.key || alphabet[index] || `G${index + 1}`).toUpperCase()
      const qualifiers = Math.max(
        1,
        Math.min(4, Number.parseInt(group.qualifiers, 10) || qualifiersFallback)
      )
      const squads = Array.isArray(group.squads)
        ? group.squads
            .map((squad) => {
              const squadId = squad?.squadId || squad?.id
              if (!squadId) return null
              return {
                squadId,
                squadName: squad?.squadName || squad?.name || `Squad ${squadId.slice(0, 6)}`,
                squadLogo: squad?.squadLogo || squad?.logo || '',
              }
            })
            .filter(Boolean)
        : []
      return {
        key,
        name: group.name || `Group ${key}`,
        qualifiers,
        squads,
      }
    }

    const trimmed = Array.isArray(groups) ? groups.slice(0, safeCount) : []
    const filled = trimmed.map((group, index) => prepareGroup(group, index))

    const result = [...filled]
    for (let i = result.length; i < safeCount; i += 1) {
      const key = alphabet[i] || `G${i + 1}`
      result.push({
        key,
        name: `Group ${key}`,
        qualifiers: qualifiersFallback,
        squads: [],
      })
    }
    return result
  }

  const ensureKnockoutStages = (stages, count) => {
    const safeCount = Math.max(1, Math.min(6, count))
    const defaultStageNames = ['Quarter Final', 'Semi Final', 'Final', '3rd Place', 'Stage 5', 'Stage 6']
    const nextStages = [...stages]
    if (nextStages.length > safeCount) {
      return nextStages.slice(0, safeCount)
    }
    while (nextStages.length < safeCount) {
      const idx = nextStages.length
      const key = ['quarter_final', 'semi_final', 'final', 'third_place', `stage_${idx + 1}`][idx] || `stage_${idx + 1}`
      nextStages.push({
        key,
        name: defaultStageNames[idx] || `Stage ${idx + 1}`,
        matches: idx === 2 ? 1 : 2,
      })
    }
    return nextStages
  }

  const getSquadMeta = (squadId) => {
    if (!squadId) return {}
    const identifier = String(squadId)
    const found = availableSquads.find((squad) => squad.id === squadId || squad.id === identifier) || {}
    return {
      squadId: identifier,
      squadName: found.teamName || found.name || `Squad ${identifier.slice(0, 6)}`,
      squadLogo: found.logo || found.teamLogo || '',
    }
  }

  const buildSquadSummaryLocal = (squadId, existing = {}) => {
    if (!squadId) return null
    const meta = getSquadMeta(squadId)
    return {
      squadId: meta.squadId,
      squadName: existing.squadName || existing.name || meta.squadName,
      squadLogo: existing.squadLogo || existing.logo || meta.squadLogo,
    }
  }

  const syncParticipantsFromGroups = (groups = []) => {
    const map = new Map()
    groups.forEach((group = {}) => {
      (group.squads || []).forEach((squad) => {
        const summary = buildSquadSummaryLocal(squad?.squadId || squad?.id, squad)
        if (summary) {
          map.set(summary.squadId, summary)
        }
      })
    })
    return Array.from(map.values())
  }

  const normaliseParticipantListLocal = (list = []) => {
    const map = new Map()
    list.forEach((entry) => {
      const squadId = entry?.squadId || entry?.id
      if (!squadId) return
      const summary = buildSquadSummaryLocal(squadId, entry)
      if (summary) {
        map.set(summary.squadId, summary)
      }
    })
    return Array.from(map.values())
  }

  const loadAvailableSquads = async (tournamentId) => {
    try {
      setAvailableSquadsLoading(true)
      // If tournamentId is provided, load squads for that tournament
      // Otherwise, load all squads for selection during tournament creation
      const response = tournamentId 
        ? await squadsAPI.getAll({ tournamentId })
        : await squadsAPI.getAll() // Load all squads when creating new tournament
      setAvailableSquads(response.data || [])
      setAvailableSquadsError('')
    } catch (error) {
      console.error('Error loading squads:', error)
      setAvailableSquads([])
      setAvailableSquadsError(tournamentId 
        ? 'Failed to load squads for this tournament. Update squads under Squad Management.'
        : 'Failed to load squads. Please try again or create squads under Squad Management first.')
    } finally {
      setAvailableSquadsLoading(false)
    }
  }

  const handleGroupToggle = (enabled) => {
    setFormData((prev) => {
      if (!enabled) {
        const participantsFromGroups = syncParticipantsFromGroups(prev.groupStage.groups)
        return {
          ...prev,
          groupStage: emptyGroupStage,
          participantSquads: participantsFromGroups,
        }
      }
      const groups =
        prev.groupStage.groups.length > 0
          ? ensureGroupCount(prev.groupStage.groups, prev.groupStage.groups.length, prev.groupStage.qualifiersPerGroup || 2)
          : ensureGroupCount([], 2, prev.groupStage.qualifiersPerGroup || 2)
      return {
        ...prev,
        groupStage: {
          enabled: true,
          qualifiersPerGroup: prev.groupStage.qualifiersPerGroup || 2,
          groups,
        },
        participantSquads: syncParticipantsFromGroups(groups),
      }
    })
  }

  const handleKnockoutToggle = (enabled) => {
    setFormData((prev) => {
      if (!enabled) {
        return {
          ...prev,
          knockoutStage: emptyKnockoutStage,
        }
      }
      const stages = ensureKnockoutStages(prev.knockoutStage.stages.length > 0 ? prev.knockoutStage.stages : [], 2)
      return {
        ...prev,
        knockoutStage: {
          enabled: true,
          autoSeedFromGroups: prev.knockoutStage.autoSeedFromGroups !== false,
          stages,
        },
      }
    })
  }

  const handleGroupCountChange = (value) => {
    const count = Number.parseInt(value, 10)
    if (Number.isNaN(count)) return
    setFormData((prev) => ({
      ...prev,
      groupStage: {
        ...prev.groupStage,
        enabled: true,
        groups: ensureGroupCount(prev.groupStage.groups, count, prev.groupStage.qualifiersPerGroup || 2),
      },
      participantSquads: syncParticipantsFromGroups(
        ensureGroupCount(prev.groupStage.groups, count, prev.groupStage.qualifiersPerGroup || 2)
      ),
    }))
  }

  const handleKnockoutStageCountChange = (value) => {
    const count = Number.parseInt(value, 10)
    if (Number.isNaN(count)) return
    setFormData((prev) => ({
      ...prev,
      knockoutStage: {
        ...prev.knockoutStage,
        enabled: true,
        stages: ensureKnockoutStages(prev.knockoutStage.stages, count),
      },
    }))
  }

  const handleGroupFieldChange = (index, field, value) => {
    setFormData((prev) => {
      const groups = [...prev.groupStage.groups]
      groups[index] = {
        ...groups[index],
        [field]:
          field === 'qualifiers'
            ? Math.max(1, Math.min(4, Number.parseInt(value, 10) || prev.groupStage.qualifiersPerGroup || 1))
            : value,
      }
      return {
        ...prev,
        groupStage: {
          ...prev.groupStage,
          groups,
        },
        participantSquads: syncParticipantsFromGroups(groups),
      }
    })
  }

  const handleKnockoutStageFieldChange = (index, field, value) => {
    setFormData((prev) => {
      const stages = [...prev.knockoutStage.stages]
      stages[index] = {
        ...stages[index],
        [field]: field === 'matches' ? Math.max(1, Number.parseInt(value, 10) || 1) : value,
      }
      return {
        ...prev,
        knockoutStage: {
          ...prev.knockoutStage,
          stages,
        },
      }
    })
  }

  const handleKnockoutSeedToggle = (value) => {
    setFormData((prev) => ({
      ...prev,
      knockoutStage: {
        ...prev.knockoutStage,
        autoSeedFromGroups: value,
      },
    }))
  }

  const handleGroupSquadToggle = (groupIndex, squadId, checked) => {
    setFormData((prev) => {
      if (!prev.groupStage.enabled) {
        return prev
      }
      const currentCount = prev.groupStage.groups.length || 1
      const groups = ensureGroupCount(
        prev.groupStage.groups,
        currentCount,
        prev.groupStage.qualifiersPerGroup || 2
      ).map((group, idx) => {
        let squads = Array.isArray(group.squads) ? [...group.squads] : []
        if (idx === groupIndex) {
          if (checked) {
            if (!squads.some((s) => s.squadId === squadId)) {
              const summary = buildSquadSummaryLocal(squadId)
              if (summary) {
                squads.push(summary)
              }
            }
          } else {
            squads = squads.filter((s) => s.squadId !== squadId)
          }
        } else if (checked) {
          squads = squads.filter((s) => s.squadId !== squadId)
        }
        return {
          ...group,
          squads,
        }
      })

      return {
        ...prev,
        groupStage: {
          ...prev.groupStage,
          groups,
        },
        participantSquads: syncParticipantsFromGroups(groups),
      }
    })
  }

  const handleParticipantToggle = (squadId, checked) => {
    setFormData((prev) => {
      let participants = Array.isArray(prev.participantSquads) ? [...prev.participantSquads] : []
      if (checked) {
        if (!participants.some((squad) => squad.squadId === squadId)) {
          const summary = buildSquadSummaryLocal(squadId)
          if (summary) {
            participants.push(summary)
          }
        }
      } else {
        participants = participants.filter((squad) => squad.squadId !== squadId)
      }
      return {
        ...prev,
        participantSquads: participants,
      }
    })
  }

  const handleGroupQualifierDefaultChange = (value) => {
    const qualifiers = Math.max(1, Math.min(4, Number.parseInt(value, 10) || 1))
    setFormData((prev) => ({
      ...prev,
      groupStage: {
        ...prev.groupStage,
        qualifiersPerGroup: qualifiers,
        groups: prev.groupStage.groups.map((grp) => ({
          ...grp,
          qualifiers,
        })),
      },
      participantSquads: syncParticipantsFromGroups(
        prev.groupStage.groups.map((grp) => ({
          ...grp,
          qualifiers,
        }))
      ),
    }))
  }

  const buildPayload = () => {
    const groupEnabled = Boolean(formData.groupStage.enabled)
    const baseGroups = groupEnabled
      ? ensureGroupCount(
          formData.groupStage.groups,
          formData.groupStage.groups.length || 2,
          formData.groupStage.qualifiersPerGroup || 2
        )
      : []

    const participantMap = new Map()
    const groupsWithSquads = groupEnabled
      ? baseGroups.map((group, index) => {
          const sourceGroup = formData.groupStage.groups[index] || group
          const squads = (sourceGroup.squads || [])
            .map((squad) => {
              const summary = buildSquadSummaryLocal(squad?.squadId || squad?.id, squad)
              if (summary) {
                participantMap.set(summary.squadId, summary)
              }
              return summary
            })
            .filter(Boolean)
          return {
            ...group,
            squads,
          }
        })
      : []

    const groupPayload = groupEnabled
      ? {
          enabled: true,
          qualifiersPerGroup: formData.groupStage.qualifiersPerGroup || 2,
          groups: groupsWithSquads,
        }
      : {
          enabled: false,
          qualifiersPerGroup: 0,
          groups: [],
        }

    const participantSquads = groupEnabled
      ? Array.from(participantMap.values())
      : normaliseParticipantListLocal(formData.participantSquads)

    const knockoutPayload = !formData.knockoutStage.enabled
      ? {
          enabled: false,
          autoSeedFromGroups: true,
          stages: [],
        }
      : {
          enabled: true,
          autoSeedFromGroups: formData.knockoutStage.autoSeedFromGroups !== false,
          stages: ensureKnockoutStages(
            formData.knockoutStage.stages.map((stage, index) => ({
              key: (stage.key || '').toLowerCase() || ['quarter_final', 'semi_final', 'final'][index] || `stage_${index + 1}`,
              name: stage.name || `Stage ${index + 1}`,
              matches: Math.max(1, Number.parseInt(stage.matches, 10) || (stage.key === 'final' ? 1 : 2)),
            })),
            formData.knockoutStage.stages.length || 2
          ),
        }

    return {
      name: formData.name,
      year: formData.year,
      schoolName: formData.schoolName,
      school: formData.schoolName,
      startDate: formData.startDate,
      format: formData.format,
      status: formData.status,
      description: formData.description,
      groupStage: groupPayload,
      knockoutStage: knockoutPayload,
      participantSquads,
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      const payload = buildPayload()

      // ICC-Compliant Validation: Ensure participants are selected
      if (payload.groupStage.enabled) {
        const hasEmptyGroup = payload.groupStage.groups.some(
          (group) => !group.squads || group.squads.length === 0
        )
        if (hasEmptyGroup) {
          setError('Every group must have at least one squad. Please assign squads to all groups.')
          return
        }
        // Validate minimum 2 teams per group (ICC Standard)
        const hasInvalidGroup = payload.groupStage.groups.some(
          (group) => group.squads && group.squads.length < 2
        )
        if (hasInvalidGroup) {
          setError('Each group must have at least 2 squads (ICC Standard).')
          return
        }
      } else {
        // Validate minimum 2 teams for tournament (ICC Standard)
        if (!payload.participantSquads || payload.participantSquads.length === 0) {
          setError('Please select at least 2 participating squads to create the tournament (ICC Standard: Minimum 2 teams required).')
          return
        }
        if (payload.participantSquads.length < 2) {
          setError('A tournament requires at least 2 participating squads (ICC Standard). Please select more squads.')
          return
        }
      }

      if (isStarting || editingTournament) {
        const targetId = editingTournament?.id
        if (isStarting) {
          payload.status = 'ongoing'
        }
        await tournamentsAPI.update(targetId, payload)
        setSuccess(isStarting ? 'Tournament started successfully!' : 'Tournament updated successfully!')
      } else {
        await tournamentsAPI.create(payload)
        setSuccess('Tournament created successfully!')
      }

      setShowModal(false)
      setEditingTournament(null)
      setFormData({
        name: '',
        year: new Date().getFullYear(),
        schoolName: '',
        startDate: '',
        format: 'T20',
        status: 'upcoming',
        description: '',
        groupStage: emptyGroupStage,
        knockoutStage: emptyKnockoutStage,
        participantSquads: [],
      })
      setAvailableSquads([])
      setAvailableSquadsError('')
      setIsStarting(false)
      loadTournaments()

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError(error.message || 'Failed to save tournament')
    }
  }

  const handleEdit = async (tournament, { startTournament = false } = {}) => {
    setEditingTournament(tournament)
    setIsStarting(startTournament)
    await loadAvailableSquads(tournament.id)

    const preparedGroups = tournament.groupStage?.enabled
      ? ensureGroupCount(
          (tournament.groupStage.groups || []).map((grp) => ({
            ...grp,
            squads: (grp.squads || []).map((squad) => ({
              squadId: squad.squadId || squad.id,
              squadName: squad.squadName || squad.name,
              squadLogo: squad.squadLogo || squad.logo || '',
            })),
          })),
          (tournament.groupStage.groups || []).length || 2,
          tournament.groupStage.qualifiersPerGroup || 2
        )
      : []

    const preparedParticipants = tournament.groupStage?.enabled
      ? syncParticipantsFromGroups(preparedGroups)
      : normaliseParticipantListLocal(tournament.participantSquads || [])

    setFormData({
      name: tournament.name,
      year: tournament.year,
      schoolName: tournament.schoolName || '',
      startDate: tournament.startDate || '',
      format: tournament.format || 'T20',
      status: startTournament ? 'ongoing' : tournament.status || 'upcoming',
      description: tournament.description || '',
      groupStage: tournament.groupStage?.enabled
        ? {
            enabled: true,
            qualifiersPerGroup: tournament.groupStage.qualifiersPerGroup || 2,
            groups: preparedGroups,
          }
        : emptyGroupStage,
      knockoutStage: tournament.knockoutStage?.enabled
        ? {
            enabled: true,
            autoSeedFromGroups: tournament.knockoutStage.autoSeedFromGroups !== false,
            stages: (tournament.knockoutStage.stages || []).map((stage, index) => ({
              key: stage.key || `stage_${index + 1}`,
              name: stage.name || `Stage ${index + 1}`,
              matches: stage.matches || 1,
            })),
          }
        : emptyKnockoutStage,
      participantSquads: preparedParticipants,
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this tournament?')) {
      return
    }

    try {
      await tournamentsAPI.delete(id)
      setSuccess('Tournament deleted successfully!')
      loadTournaments()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError(error.message || 'Failed to delete tournament')
    }
  }

  const openCreateModal = async () => {
    setEditingTournament(null)
    setIsStarting(false)
    setFormData({
      name: '',
      year: new Date().getFullYear(),
      schoolName: '',
      startDate: '',
      format: 'T20',
      status: 'upcoming',
      description: '',
      groupStage: emptyGroupStage,
      knockoutStage: emptyKnockoutStage,
      participantSquads: [],
    })
    setError('')
    setShowModal(true)
    // Load all available squads for selection during tournament creation
    await loadAvailableSquads(null)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingTournament(null)
    setError('')
    setAvailableSquads([])
    setAvailableSquadsError('')
    setIsStarting(false)
  }

  const ballsFromOvers = (oversValue = '0.0') => {
    if (typeof oversValue === 'number') {
      const whole = Math.trunc(oversValue)
      const fraction = Number((oversValue - whole).toFixed(1)) * 10
      return whole * 6 + Math.round(fraction)
    }
    const [oversPart, ballsPart] = oversValue.split('.')
    const oversInt = Number.parseInt(oversPart || '0', 10)
    const ballsInt = Number.parseInt(ballsPart || '0', 10)
    return oversInt * 6 + ballsInt
  }

  const computeNetRunRate = (runsFor, ballsFaced, runsAgainst, ballsBowled) => {
    const oversFaced = ballsFaced > 0 ? ballsFaced / 6 : 0
    const oversBowled = ballsBowled > 0 ? ballsBowled / 6 : 0
    const forRate = oversFaced > 0 ? runsFor / oversFaced : 0
    const againstRate = oversBowled > 0 ? runsAgainst / oversBowled : 0
    return Number((forRate - againstRate).toFixed(3))
  }

  const loadPointsTable = async (tournament) => {
    try {
      setPointsError('')
      setPointsLoading(true)
      setPointsTournament(tournament)
      
      // Load squads - try multiple sources
      let squads = []
      try {
        const squadsResponse = await squadsAPI.getAll({ tournamentId: tournament.id })
        squads = squadsResponse.data || []
      } catch (squadError) {
        console.error('Error loading squads by tournamentId:', squadError)
      }
      
      // If no squads found by tournamentId, try loading from participantSquads
      if (!squads.length && tournament.participantSquads && tournament.participantSquads.length > 0) {
        try {
          // Load all squads and filter by participantSquads IDs
          const allSquadsResponse = await squadsAPI.getAll()
          const allSquads = allSquadsResponse.data || []
          const participantIds = tournament.participantSquads.map(p => p.squadId || p.id).filter(Boolean)
          squads = allSquads.filter(squad => participantIds.includes(squad.id))
        } catch (error) {
          console.error('Error loading squads from participantSquads:', error)
        }
      }
      
      // Also check group stage squads if enabled
      if (!squads.length && tournament.groupStage?.enabled && tournament.groupStage?.groups) {
        try {
          const allSquadsResponse = await squadsAPI.getAll()
          const allSquads = allSquadsResponse.data || []
          const groupSquadIds = new Set()
          tournament.groupStage.groups.forEach(group => {
            if (group.squads && Array.isArray(group.squads)) {
              group.squads.forEach(squad => {
                const squadId = squad.squadId || squad.id
                if (squadId) groupSquadIds.add(squadId)
              })
            }
          })
          squads = allSquads.filter(squad => groupSquadIds.has(squad.id))
        } catch (error) {
          console.error('Error loading squads from groups:', error)
        }
      }
      
      // Load matches
      const matchesResponse = await matchesAPI.getAll({ tournamentId: tournament.id })
      const matches = matchesResponse.data || []

      if (!squads.length) {
        setPointsData({ groupStage: false, groups: [], overall: [] })
        setPointsError(
          `No squads found for tournament "${tournament.name}". ` +
          `Please ensure squads are created under Squad Management with tournamentId="${tournament.id}" ` +
          `or are selected in tournament's participantSquads.`
        )
        setPointsModalOpen(true)
        return
      }

      const statsMap = new Map()

      squads.forEach((squad) => {
        statsMap.set(squad.id, {
          squadId: squad.id,
          name: squad.teamName || squad.name || `Squad ${squad.id.slice(0, 4)}`,
          logo: squad.logo || '',
          matches: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          noResult: 0,
          points: 0,
          runsFor: 0,
          ballsFaced: 0,
          runsAgainst: 0,
          ballsBowled: 0,
          netRunRate: 0,
        })
      })

      matches
        .filter((match) => (match.status || '').toLowerCase() === 'finished' || (match.status || '').toLowerCase() === 'completed')
        .forEach((match) => {
          const teamAId = match.teamASquadId
          const teamBId = match.teamBSquadId
          if (!statsMap.has(teamAId) || !statsMap.has(teamBId)) {
            return
          }

          const teamAStats = statsMap.get(teamAId)
          const teamBStats = statsMap.get(teamBId)

          const runs1 = match.runs1 ?? match.score?.teamA?.runs ?? 0
          const runs2 = match.runs2 ?? match.score?.teamB?.runs ?? 0
          const balls1 = match.balls1 ?? match.score?.teamA?.balls ?? ballsFromOvers(match.overs1 || match.score?.teamA?.overs || '0.0')
          const balls2 = match.balls2 ?? match.score?.teamB?.balls ?? ballsFromOvers(match.overs2 || match.score?.teamB?.overs || '0.0')

          teamAStats.matches += 1
          teamBStats.matches += 1

          teamAStats.runsFor += runs1
          teamAStats.ballsFaced += balls1
          teamAStats.runsAgainst += runs2
          teamAStats.ballsBowled += balls2

          teamBStats.runsFor += runs2
          teamBStats.ballsFaced += balls2
          teamBStats.runsAgainst += runs1
          teamBStats.ballsBowled += balls1

          if (runs1 > runs2) {
            teamAStats.wins += 1
            teamBStats.losses += 1
            teamAStats.points += 2
          } else if (runs2 > runs1) {
            teamBStats.wins += 1
            teamAStats.losses += 1
            teamBStats.points += 2
          } else {
            teamAStats.ties += 1
            teamBStats.ties += 1
            teamAStats.points += 1
            teamBStats.points += 1
          }
        })

      const rows = Array.from(statsMap.values()).map((team) => ({
        ...team,
        netRunRate: computeNetRunRate(team.runsFor, team.ballsFaced, team.runsAgainst, team.ballsBowled),
      }))

      rows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.netRunRate !== a.netRunRate) return b.netRunRate - a.netRunRate
        return a.name.localeCompare(b.name)
      })

      const tournamentGroups = (tournament.groupStage?.groups || []).map((grp) => ({
        key: grp.key,
        name: grp.name,
        qualifiers: grp.qualifiers || tournament.groupStage.qualifiersPerGroup || 2,
      }))

      const groupedResults = []
      const groupTotals = new Map()
      rows.forEach((row) => {
        const key = row.groupKey || 'UNASSIGNED'
        const meta = tournamentGroups.find((grp) => grp.key === row.groupKey) || {
          key: row.groupKey || 'UNASSIGNED',
          name: row.groupName || (row.groupKey ? `Group ${row.groupKey}` : 'Unassigned'),
          qualifiers: tournament.groupStage?.qualifiersPerGroup || 2,
        }
        if (!groupTotals.has(key)) {
          groupTotals.set(key, { ...meta, rows: [] })
        }
        groupTotals.get(key).rows.push(row)
      })

      if (tournament.groupStage?.enabled) {
        tournamentGroups.forEach((grp) => {
          const bucket = groupTotals.get(grp.key) || { ...grp, rows: [] }
          bucket.rows.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points
            if (b.netRunRate !== a.netRunRate) return b.netRunRate - a.netRunRate
            return a.name.localeCompare(b.name)
          })
          groupedResults.push(bucket)
        })

        if (groupTotals.has('UNASSIGNED')) {
          const bucket = groupTotals.get('UNASSIGNED')
          bucket.rows.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points
            if (b.netRunRate !== a.netRunRate) return b.netRunRate - a.netRunRate
            return a.name.localeCompare(b.name)
          })
          groupedResults.push(bucket)
        }
      }

      setPointsData({
        groupStage: Boolean(tournament.groupStage?.enabled),
        groups: groupedResults,
        overall: rows,
      })
      setPointsModalOpen(true)
    } catch (err) {
      console.error('Error building points table:', err)
      setPointsError(err.message || 'Failed to load points table')
      setPointsData({ groupStage: false, groups: [], overall: [] })
      setPointsModalOpen(true)
    } finally {
      setPointsLoading(false)
    }
  }

  const closePointsModal = () => {
    setPointsModalOpen(false)
    setPointsError('')
    setPointsTournament(null)
    setPointsData({ groupStage: false, groups: [], overall: [] })
  }

  const handleSeedKnockout = async (tournament) => {
    try {
      setSeedingTournamentId(tournament.id)
      setError('')
      const response = await tournamentsAPI.seedKnockout(tournament.id)
      setSuccess(response.message || 'Knockout stage seeded successfully!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Seed knockout error:', err)
      setError(err.message || 'Failed to seed knockout stage')
    } finally {
      setSeedingTournamentId('')
    }
  }

  const handleStartClick = (tournament) => {
    handleEdit(tournament, { startTournament: true })
  }

  if (!currentAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please login to access this page</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-50 py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Premium Header */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-[#0D8F61] via-[#1FA06B] to-[#0D8F61] rounded-2xl shadow-2xl p-6 sm:p-8 text-white relative overflow-hidden">
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 translate-y-1/2"></div>
            </div>
            
            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                      <span className="text-2xl sm:text-3xl">🏆</span>
                    </div>
                    <div>
                      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black mb-1 drop-shadow-lg">
                        Tournament Management
                      </h1>
                      <p className="text-sm sm:text-base text-white/90">
                        ICC-Compliant Tournament System
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                      <div className="text-xs text-white/80">Total Tournaments</div>
                      <div className="text-xl font-bold">{tournaments.length}</div>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                      <div className="text-xs text-white/80">Ongoing</div>
                      <div className="text-xl font-bold">
                        {tournaments.filter(t => t.status === 'ongoing').length}
                      </div>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                      <div className="text-xs text-white/80">Upcoming</div>
                      <div className="text-xl font-bold">
                        {tournaments.filter(t => t.status === 'upcoming').length}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={openCreateModal}
                  className="bg-white text-[#0D8F61] px-6 py-3 sm:px-8 sm:py-4 rounded-xl hover:bg-gray-50 transition-all font-bold text-sm sm:text-base shadow-xl hover:shadow-2xl hover:scale-105 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <span className="text-xl">+</span>
                  <span>Create Tournament</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg shadow-md animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <p className="text-red-800 font-semibold">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg shadow-md animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <p className="text-green-800 font-semibold">{success}</p>
            </div>
          </div>
        )}

        {/* Premium Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Premium Modal Header */}
              <div className="bg-gradient-to-r from-[#0D8F61] via-[#1FA06B] to-[#0D8F61] px-6 py-5 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">
                    {isStarting
                      ? '🚀 Start Tournament'
                      : editingTournament
                      ? '✏️ Edit Tournament'
                      : '➕ Create New Tournament'}
                  </h2>
                  <p className="text-sm text-white/90">ICC-Compliant Tournament Setup</p>
                </div>
                <button
                  onClick={closeModal}
                  className="text-white/80 hover:text-white text-3xl font-bold w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>
              
              <div className="overflow-y-auto flex-1">

              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tournament Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      disabled={isStarting}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green ${isStarting ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      placeholder="e.g., Annual Cricket Championship"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Year <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                      required
                      min="2020"
                      max="2100"
                      disabled={isStarting}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green ${isStarting ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      School Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.schoolName}
                      onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                      required
                      disabled={isStarting}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green ${isStarting ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      placeholder="e.g., SMA High School"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                      disabled={isStarting}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green ${isStarting ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                    <select
                      value={formData.format}
                      onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                      disabled={isStarting}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green ${isStarting ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    >
                      <option value="T20">T20</option>
                      <option value="ODI">ODI</option>
                      <option value="Test">Test</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      disabled={isStarting}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green ${isStarting ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    >
                      <option value="upcoming">Upcoming</option>
                      <option value="ongoing">Ongoing</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows="3"
                      disabled={isStarting}
                      className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green ${isStarting ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                      placeholder="Optional description..."
                    />
                </div>

                {/* Group Stage Section - Premium Design */}
                <div className="space-y-4 border-2 border-gray-200 rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-gray-50 to-white shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg sm:text-xl font-black text-gray-900 flex items-center gap-2">
                        <span className="text-2xl">👥</span>
                        Group Stage
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Organize squads into groups before knockout phase (ICC Standard)
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <span className="text-sm font-bold text-gray-700">Enable</span>
                      <input
                        type="checkbox"
                        checked={formData.groupStage.enabled}
                        onChange={(e) => handleGroupToggle(e.target.checked)}
                        className="h-5 w-5 text-[#0D8F61] focus:ring-[#0D8F61] border-gray-300 rounded cursor-pointer"
                      />
                    </label>
                  </div>

                  {formData.groupStage.enabled && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Total Groups
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="8"
                            value={formData.groupStage.groups.length}
                            onChange={(e) => handleGroupCountChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Qualifiers per Group
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="4"
                            value={formData.groupStage.qualifiersPerGroup}
                            onChange={(e) => handleGroupQualifierDefaultChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {formData.groupStage.groups.map((group, index) => (
                          <div
                            key={group.key || index}
                            className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-700">
                                Key: <span className="text-gray-900">{group.key}</span>
                              </span>
                              <span className="text-xs text-gray-500">Group {index + 1}</span>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Group Name
                              </label>
                              <input
                                type="text"
                                value={group.name}
                                onChange={(e) => handleGroupFieldChange(index, 'name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Qualifiers
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="4"
                                value={group.qualifiers}
                                onChange={(e) => handleGroupFieldChange(index, 'qualifiers', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Assign Squads
                              </label>
                              {availableSquadsLoading ? (
                                <p className="text-xs text-gray-500">Loading squads...</p>
                              ) : availableSquadsError ? (
                                <p className="text-xs text-red-500">{availableSquadsError}</p>
                              ) : availableSquads.length === 0 ? (
                                <p className="text-xs text-gray-500">
                                  No squads available yet. Create squads under Squad Management.
                                </p>
                              ) : (
                                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                                  {availableSquads.map((squad) => {
                                    const summary = buildSquadSummaryLocal(squad.id, squad)
                                    const isChecked = summary
                                      ? (group.squads || []).some((s) => s.squadId === summary.squadId)
                                      : false
                                    return (
                                      <label
                                        key={squad.id}
                                        className="flex items-center gap-2 text-xs text-gray-700"
                                      >
                                        <input
                                          type="checkbox"
                                          className="rounded text-cricbuzz-green focus:ring-cricbuzz-green"
                                          checked={isChecked}
                                          onChange={(e) =>
                                            handleGroupSquadToggle(index, squad.id, e.target.checked)
                                          }
                                        />
                                        <span>{summary?.squadName}</span>
                                      </label>
                                    )
                                  })}
                                </div>
                              )}
                              {group.squads && group.squads.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {group.squads.map((squad) => (
                                    <span
                                      key={squad.squadId}
                                      className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-[11px] font-semibold text-green-700"
                                    >
                                      {squad.squadName}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Tournament Participants Section - Always Visible for ICC Compliance */}
                {!formData.groupStage.enabled && (
                  <div className="space-y-4 border-2 border-gray-200 rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-blue-50 to-white shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg sm:text-xl font-black text-gray-900 flex items-center gap-2">
                          <span className="text-2xl">👥</span>
                          Tournament Participants
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Select squads that will participate in this tournament (ICC Standard: Minimum 2 teams required)
                        </p>
                        {formData.participantSquads.length > 0 && (
                          <p className="text-xs text-green-600 font-semibold mt-1">
                            ✓ {formData.participantSquads.length} squad{formData.participantSquads.length !== 1 ? 's' : ''} selected
                          </p>
                        )}
                      </div>
                    </div>
                    {availableSquadsLoading ? (
                      <div className="py-8 text-center">
                        <div className="text-[#0D8F61] text-4xl mb-2 animate-pulse">⏳</div>
                        <p className="text-sm text-gray-600 font-medium">Loading available squads...</p>
                      </div>
                    ) : availableSquadsError ? (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600 font-semibold">{availableSquadsError}</p>
                        <p className="text-xs text-red-500 mt-1">Please create squads under Squad Management first.</p>
                      </div>
                    ) : availableSquads.length === 0 ? (
                      <div className="py-8 text-center bg-gray-50 rounded-lg">
                        <div className="text-gray-400 text-4xl mb-2">📋</div>
                        <p className="text-sm text-gray-600 font-medium">No squads available yet</p>
                        <p className="text-xs text-gray-500 mt-1">Create squads under Squad Management first</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-2">
                          {availableSquads.map((squad) => {
                            const summary = buildSquadSummaryLocal(squad.id, squad)
                            const isChecked = summary
                              ? formData.participantSquads.some((entry) => entry.squadId === summary.squadId)
                              : false
                            return (
                              <label
                                key={squad.id}
                                className={`flex items-center gap-3 rounded-xl border-2 p-3 text-sm font-medium transition-all cursor-pointer ${
                                  isChecked
                                    ? 'border-[#0D8F61] bg-green-50 text-[#0D8F61]'
                                    : 'border-gray-200 bg-white text-gray-700 hover:border-[#0D8F61] hover:bg-green-50/50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="w-5 h-5 rounded text-[#0D8F61] focus:ring-[#0D8F61] cursor-pointer"
                                  checked={isChecked}
                                  onChange={(e) => handleParticipantToggle(squad.id, e.target.checked)}
                                />
                                <span className="flex-1">{summary?.squadName || squad.teamName || squad.name}</span>
                                {isChecked && <span className="text-green-600">✓</span>}
                              </label>
                            )
                          })}
                        </div>
                        {formData.participantSquads.length > 0 && (
                          <div className="pt-4 border-t border-gray-200">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Selected Participants:</p>
                            <div className="flex flex-wrap gap-2">
                              {formData.participantSquads.map((squad) => (
                                <span
                                  key={squad.squadId}
                                  className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#0D8F61] to-[#1FA06B] px-4 py-1.5 text-xs font-bold text-white shadow-sm"
                                >
                                  <span>✓</span>
                                  {squad.squadName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Knockout Stage Section - Premium Design */}
                <div className="space-y-4 border-2 border-gray-200 rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-purple-50 to-white shadow-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg sm:text-xl font-black text-gray-900 flex items-center gap-2">
                        <span className="text-2xl">🏆</span>
                        Knockout Stage
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Configure knockout rounds (semi-final, final, etc.) with ICC-compliant seeding
                      </p>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <span className="text-sm font-bold text-gray-700">Enable</span>
                      <input
                        type="checkbox"
                        checked={formData.knockoutStage.enabled}
                        onChange={(e) => handleKnockoutToggle(e.target.checked)}
                        className="h-5 w-5 text-[#0D8F61] focus:ring-[#0D8F61] border-gray-300 rounded cursor-pointer"
                      />
                    </label>
                  </div>

                  {formData.knockoutStage.enabled && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Total Stages</label>
                          <input
                            type="number"
                            min="1"
                            max="6"
                            value={formData.knockoutStage.stages.length}
                            onChange={(e) => handleKnockoutStageCountChange(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Auto Seed</label>
                          <select
                            value={formData.knockoutStage.autoSeedFromGroups ? 'auto' : 'manual'}
                            onChange={(e) => handleKnockoutSeedToggle(e.target.value === 'auto')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                          >
                            <option value="auto">Use group standings</option>
                            <option value="manual">Manual seeding</option>
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            Auto = top group teams fill bracket automatically after groups finish.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {formData.knockoutStage.stages.map((stage, index) => (
                          <div key={stage.key || index} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-700">
                                Key: <span className="text-gray-900">{stage.key}</span>
                              </span>
                              <span className="text-xs text-gray-500">Stage {index + 1}</span>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Stage Name</label>
                              <input
                                type="text"
                                value={stage.name}
                                onChange={(e) => handleKnockoutStageFieldChange(index, 'name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Matches</label>
                              <input
                                type="number"
                                min="1"
                                max="4"
                                value={stage.matches}
                                onChange={(e) => handleKnockoutStageFieldChange(index, 'matches', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green text-sm"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Premium Form Footer */}
                <div className="sticky bottom-0 bg-white border-t-2 border-gray-200 px-6 py-4 flex gap-3 sm:flex-row flex-col">
                  <button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-[#0D8F61] to-[#1FA06B] text-white px-6 py-3 rounded-xl hover:from-[#0a7049] hover:to-[#0D8F61] transition-all font-bold shadow-lg hover:shadow-xl"
                  >
                    {isStarting ? '🚀 Start Tournament' : editingTournament ? '💾 Update Tournament' : '✨ Create Tournament'}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 bg-gray-500 text-white px-6 py-3 rounded-xl hover:bg-gray-600 transition-colors font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
              </div>
            </div>
          </div>
        )}

        {/* Tournament List - Premium Card View */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-[#0D8F61] text-6xl mb-4 animate-pulse">🏏</div>
            <p className="text-gray-600 font-medium">Loading tournaments...</p>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">🏆</div>
            <p className="text-gray-700 text-xl font-bold mb-2">No tournaments found</p>
            <p className="text-gray-500 text-sm">Create your first tournament to get started</p>
            <button
              onClick={openCreateModal}
              className="mt-6 bg-[#0D8F61] text-white px-6 py-3 rounded-xl hover:bg-[#0a7049] transition-colors font-semibold"
            >
              Create Tournament
            </button>
          </div>
        ) : (
          <>
            {/* Mobile/Tablet Card View */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 lg:hidden">
              {tournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all border border-gray-100 overflow-hidden"
                >
                  <div className={`h-2 ${
                    tournament.status === 'ongoing' 
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                      : tournament.status === 'completed'
                      ? 'bg-gradient-to-r from-gray-400 to-gray-500'
                      : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                  }`}></div>
                  
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 line-clamp-2">
                          {tournament.name}
                        </h3>
                        <p className="text-sm text-gray-600">{tournament.year}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        tournament.status === 'ongoing'
                          ? 'bg-green-100 text-green-800'
                          : tournament.status === 'completed'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {tournament.status}
                      </span>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>🏫</span>
                        <span className="truncate">{tournament.schoolName || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>📅</span>
                        <span>
                          {tournament.startDate
                            ? new Date(tournament.startDate).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'TBD'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span>⚡</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                          {tournament.format || 'T20'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4 pt-4 border-t border-gray-100">
                      <div>
                        <div className="text-xs text-gray-500">Squads</div>
                        <div className="text-lg font-bold text-gray-900">{tournament.totalSquads || 0}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Groups</div>
                        <div className="text-lg font-bold text-gray-900">
                          {tournament.groupStage?.enabled ? tournament.groupStage.groups?.length || 0 : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                      {tournament.status === 'upcoming' && (
                        <button
                          onClick={() => handleStartClick(tournament)}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-semibold"
                        >
                          Start
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(tournament)}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => loadPointsTable(tournament)}
                        className="flex-1 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-semibold"
                      >
                        Points
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View - Premium Design */}
            <div className="hidden lg:block bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Tournament Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Year
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      School Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Format
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Squads
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Groups
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Knockout
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {tournaments.map((tournament) => (
                    <tr key={tournament.id} className="hover:bg-blue-50/50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-[#0D8F61] to-[#1FA06B] rounded-lg flex items-center justify-center text-white font-bold text-sm">
                            🏆
                          </div>
                          <div>
                            <div className="text-sm font-bold text-gray-900">{tournament.name}</div>
                            {tournament.description && (
                              <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{tournament.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{tournament.year}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">{tournament.schoolName || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700">
                          {tournament.startDate
                            ? new Date(tournament.startDate).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-100 text-blue-800 border border-blue-200">
                          {tournament.format || 'T20'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg ${
                            tournament.status === 'ongoing'
                              ? 'bg-green-100 text-green-800 border border-green-200'
                              : tournament.status === 'completed'
                              ? 'bg-gray-100 text-gray-800 border border-gray-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {tournament.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-bold text-gray-900">
                          {tournament.totalSquads || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {tournament.groupStage?.enabled ? (
                          <div>
                            <div className="text-sm font-bold text-gray-900">
                              {tournament.groupStage.groups?.length || 0}
                            </div>
                            <div className="text-xs text-gray-500">
                              {tournament.groupStage.groups
                                ?.slice(0, 2)
                                .map((grp) => `${grp.name} (${grp.qualifiers})`)
                                .join(', ')}
                              {tournament.groupStage.groups?.length > 2 && '...'}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">—</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {tournament.knockoutStage?.enabled ? (
                          <div>
                            <div className="text-sm font-bold text-gray-900">
                              {tournament.knockoutStage.stages?.length || 0}
                            </div>
                            <div className="text-xs text-gray-500">
                              {tournament.knockoutStage.autoSeedFromGroups !== false ? 'Auto' : 'Manual'}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">—</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {tournament.status === 'upcoming' && (
                            <button
                              onClick={() => handleStartClick(tournament)}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-bold"
                            >
                              Start
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(tournament)}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-bold"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => loadPointsTable(tournament)}
                            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs font-bold"
                          >
                            Points
                          </button>
                          {tournament.groupStage?.enabled && tournament.knockoutStage?.enabled && (
                            <button
                              onClick={() => handleSeedKnockout(tournament)}
                              className={`px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-bold ${seedingTournamentId === tournament.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                              disabled={seedingTournamentId === tournament.id}
                            >
                              {seedingTournamentId === tournament.id ? 'Seeding...' : 'Seed'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(tournament.id)}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-bold"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}
      </div>

      {/* Premium Points Table Modal - ICC Compliant */}
      {pointsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Premium Header */}
            <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 px-6 py-5 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                    <span className="text-2xl">📊</span>
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white">
                      {pointsTournament ? `${pointsTournament.name} ${pointsTournament.year}` : 'Points Table'}
                    </h2>
                    <p className="text-sm text-white/90 mt-1">
                      ICC-Compliant Points Table • Calculated from completed matches
                    </p>
                  </div>
                </div>
                {pointsData.groupStage && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pointsData.groups.map((group) => (
                      <div key={group.key} className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                        <div className="text-xs text-white/80">{group.name}</div>
                        <div className="text-sm font-bold text-white">{group.rows.length} teams</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={closePointsModal}
                className="text-white/80 hover:text-white text-3xl font-bold w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white/20 transition-colors ml-4"
                aria-label="Close points table"
              >
                ×
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-6">
              {pointsLoading ? (
                <div className="py-16 text-center">
                  <div className="text-[#0D8F61] text-6xl mb-4 animate-pulse">📊</div>
                  <p className="text-gray-600 font-medium">Building ICC-compliant points table...</p>
                </div>
              ) : pointsError ? (
                <div className="py-16 text-center">
                  <div className="text-red-400 text-6xl mb-4">⚠️</div>
                  <p className="text-red-600 font-bold text-lg">{pointsError}</p>
                </div>
              ) : pointsData.groupStage ? (
                pointsData.groups.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="text-gray-400 text-5xl mb-4">ℹ️</div>
                    <p className="text-gray-500">No squads assigned to groups yet.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {pointsData.groups.map((group) => (
                      <div key={group.key || 'UNASSIGNED'} className="border-2 border-gray-200 rounded-2xl overflow-hidden shadow-lg bg-white">
                        {/* Group Header */}
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-4 flex items-center justify-between">
                          <div>
                            <h3 className="text-xl font-black text-white mb-1">
                              {group.name} {group.key && group.key !== 'UNASSIGNED' ? `(${group.key})` : ''}
                            </h3>
                            <p className="text-sm text-white/90">
                              Top {group.qualifiers || 0} team{group.qualifiers !== 1 ? 's' : ''} advance to knockout
                            </p>
                          </div>
                          <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                            <div className="text-xs text-white/80">Teams</div>
                            <div className="text-lg font-bold text-white">{group.rows.length}</div>
                          </div>
                        </div>
                        {group.rows.length === 0 ? (
                          <div className="py-12 text-center">
                            <div className="text-gray-400 text-4xl mb-3">📋</div>
                            <p className="text-sm text-gray-500 font-medium">No completed matches for this group yet.</p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Rank</th>
                                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Team</th>
                                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">P</th>
                                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">W</th>
                                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">L</th>
                                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">T</th>
                                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">NRR</th>
                                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Pts</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-100">
                                {group.rows.map((row, index) => {
                                  const qualifies = index < (group.qualifiers || 0)
                                  return (
                                    <tr
                                      key={row.squadId}
                                      className={`${qualifies ? 'bg-green-50 border-l-4 border-green-500' : 'hover:bg-gray-50'} transition-colors`}
                                    >
                                      <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                          <span className={`text-lg font-black ${qualifies ? 'text-green-700' : 'text-gray-700'}`}>
                                            {index + 1}
                                          </span>
                                          {qualifies && (
                                            <span className="px-2 py-0.5 bg-green-600 text-white text-xs font-bold rounded-full">
                                              Q
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                          {row.logo ? (
                                            <img src={row.logo} alt={row.name} className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 shadow-sm" />
                                          ) : (
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0D8F61] to-[#1FA06B] text-white flex items-center justify-center text-sm font-black shadow-sm">
                                              {row.name.slice(0, 2).toUpperCase()}
                                            </div>
                                          )}
                                          <div>
                                            <div className="text-sm font-bold text-gray-900">{row.name}</div>
                                            <div className="text-xs text-gray-500">RF: {row.runsFor} | RA: {row.runsAgainst}</div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-4 py-4 text-center text-sm font-semibold text-gray-700">{row.matches}</td>
                                      <td className="px-4 py-4 text-center text-sm font-semibold text-green-700">{row.wins}</td>
                                      <td className="px-4 py-4 text-center text-sm font-semibold text-red-700">{row.losses}</td>
                                      <td className="px-4 py-4 text-center text-sm font-semibold text-gray-700">{row.ties}</td>
                                      <td className="px-4 py-4 text-center">
                                        <span className={`text-sm font-mono font-bold ${row.netRunRate >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                          {row.netRunRate >= 0 ? '+' : ''}{row.netRunRate.toFixed(3)}
                                        </span>
                                      </td>
                                      <td className="px-4 py-4 text-center">
                                        <span className="text-lg font-black text-gray-900">{row.points}</span>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : pointsData.overall.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="text-gray-400 text-6xl mb-4">📋</div>
                  <p className="text-gray-600 font-medium text-lg">No completed matches yet</p>
                  <p className="text-gray-500 text-sm mt-2">Points table will appear once results are available</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden shadow-lg">
                  <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-5 py-4">
                    <h3 className="text-xl font-black text-white">Overall Standings</h3>
                    <p className="text-sm text-white/90 mt-1">ICC-Compliant Points Table</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Rank</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Team</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">P</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">W</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">L</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">T</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">NRR</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Pts</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {pointsData.overall.map((row, index) => (
                          <tr key={row.squadId} className="hover:bg-blue-50/50 transition-colors">
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="text-lg font-black text-gray-700">{index + 1}</span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                {row.logo ? (
                                  <img src={row.logo} alt={row.name} className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 shadow-sm" />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0D8F61] to-[#1FA06B] text-white flex items-center justify-center text-sm font-black shadow-sm">
                                    {row.name.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="text-sm font-bold text-gray-900">{row.name}</div>
                                  <div className="text-xs text-gray-500">RF: {row.runsFor} | RA: {row.runsAgainst}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center text-sm font-semibold text-gray-700">{row.matches}</td>
                            <td className="px-4 py-4 text-center text-sm font-semibold text-green-700">{row.wins}</td>
                            <td className="px-4 py-4 text-center text-sm font-semibold text-red-700">{row.losses}</td>
                            <td className="px-4 py-4 text-center text-sm font-semibold text-gray-700">{row.ties}</td>
                            <td className="px-4 py-4 text-center">
                              <span className={`text-sm font-mono font-bold ${row.netRunRate >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {row.netRunRate >= 0 ? '+' : ''}{row.netRunRate.toFixed(3)}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-lg font-black text-gray-900">{row.points}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default TournamentManagement
