import express from 'express'
import { body, validationResult } from 'express-validator'
import { db } from '../config/firebaseAdmin.js'
import { verifyToken } from '../middleware/auth.js'

const router = express.Router()

const MAX_GROUPS = 8

const ballsFromOversValue = (oversValue = '0.0', fallbackBalls = 0) => {
  if (typeof oversValue === 'number') {
    return Math.round(oversValue * 6)
  }
  if (fallbackBalls && Number.isFinite(fallbackBalls)) {
    return fallbackBalls
  }
  const [oversPart, ballsPart] = String(oversValue).split('.')
  const oversInt = Number.parseInt(oversPart || '0', 10)
  const ballsInt = Number.parseInt(ballsPart || '0', 10)
  return oversInt * 6 + ballsInt
}

const computeNetRunRateBackend = (runsFor, ballsFaced, runsAgainst, ballsBowled) => {
  const oversFaced = ballsFaced > 0 ? ballsFaced / 6 : 0
  const oversBowled = ballsBowled > 0 ? ballsBowled / 6 : 0
  const forRate = oversFaced > 0 ? runsFor / oversFaced : 0
  const againstRate = oversBowled > 0 ? runsAgainst / oversBowled : 0
  return Number((forRate - againstRate).toFixed(3))
}

const generateGroupKeys = (count) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  return Array.from({ length: count }, (_, idx) => alphabet[idx] || `G${idx + 1}`)
}

const normaliseGroupStage = (groupStage = {}) => {
  const enabled = Boolean(groupStage.enabled)
  if (!enabled) {
    return {
      enabled: false,
      groups: [],
      qualifiersPerGroup: 0,
    }
  }

  const requestedCount = Number.parseInt(groupStage.totalGroups || groupStage.groupCount || (groupStage.groups?.length ?? 0), 10)
  const safeCount = Number.isNaN(requestedCount) ? (groupStage.groups?.length ?? 0) : requestedCount
  const totalGroups = Math.max(1, Math.min(MAX_GROUPS, safeCount || 1))

  const defaultQualifiers = Number.parseInt(groupStage.qualifiersPerGroup || 2, 10)
  const qualifiersPerGroup = Math.max(1, Math.min(4, Number.isNaN(defaultQualifiers) ? 2 : defaultQualifiers))

  const existingGroups = Array.isArray(groupStage.groups) ? groupStage.groups : []
  const groupKeys = generateGroupKeys(totalGroups)

  const groups = groupKeys.map((key, idx) => {
    const existing = existingGroups[idx] || existingGroups.find((grp) => (grp.key || grp.id || '').toUpperCase() === key)
    const name = existing?.name || existing?.label || `Group ${key}`
    const qualifiers = Number.parseInt(existing?.qualifiers || existing?.qualifierSlots || qualifiersPerGroup, 10)
    const squads = Array.isArray(existing?.squads)
      ? existing.squads
          .map((squad) => {
            const squadId = extractSquadId(squad)
            if (!squadId) return null
            return buildSquadSummary(
              {
                squadId,
                squadName: squad?.squadName || squad?.name,
                squadLogo: squad?.squadLogo || squad?.logo,
              },
              {}
            )
          })
          .filter(Boolean)
      : []
    return {
      key,
      name,
      qualifiers: Math.max(1, Math.min(4, Number.isNaN(qualifiers) ? qualifiersPerGroup : qualifiers)),
      squads,
    }
  })

  return {
    enabled: true,
    groups,
    qualifiersPerGroup,
  }
}

const normaliseKnockoutStageFn = (knockoutStage = {}) => {
  const enabled = Boolean(knockoutStage.enabled)
  if (!enabled) {
    return {
      enabled: false,
      stages: [],
      autoSeedFromGroups: true,
    }
  }

  const stages = Array.isArray(knockoutStage.stages) ? knockoutStage.stages : []
  const defaultStages = [
    { key: 'semi_final', name: 'Semi Final', matches: 2, seededTeams: [] },
    { key: 'final', name: 'Final', matches: 1, seededTeams: [] },
  ]

  const mergedStages = stages.length > 0 ? stages : defaultStages
  const normalised = mergedStages.map((stage, index) => ({
    key: stage.key || defaultStages[index]?.key || `stage_${index + 1}`,
    name: stage.name || defaultStages[index]?.name || `Stage ${index + 1}`,
    matches: Math.max(1, Number.parseInt(stage.matches || defaultStages[index]?.matches || 1, 10)),
    seededTeams: Array.isArray(stage.seededTeams) ? stage.seededTeams : [],
  }))

  return {
    enabled: true,
    stages: normalised,
    autoSeedFromGroups: knockoutStage.autoSeedFromGroups !== false,
  }
}

const extractSquadId = (entry) => {
  if (!entry) return null
  if (typeof entry === 'string') return entry
  if (entry.squadId) return entry.squadId
  if (entry.id) return entry.id
  return null
}

const buildSquadSummary = (partial = {}, fallback = {}) => {
  const squadId = partial.squadId || fallback.squadId
  if (!squadId) return null
  const squadName =
    partial.squadName ||
    partial.name ||
    fallback.squadName ||
    fallback.name ||
    (typeof squadId === 'string' ? `Squad ${squadId.slice(0, 6)}` : 'Squad')
  const squadLogo = partial.squadLogo || partial.logo || fallback.squadLogo || fallback.logo || ''
  return {
    squadId,
    squadName,
    squadLogo,
  }
}

const fetchSquadSummaries = async (squadIds = []) => {
  const uniqueIds = [...new Set(squadIds.filter(Boolean))]
  if (!uniqueIds.length) return []

  const summaries = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const squadDoc = await db.collection('squads').doc(id).get()
        if (!squadDoc.exists) {
          return null
        }
        const data = squadDoc.data()
        return {
          squadId: squadDoc.id,
          squadName: data.teamName || data.name || `Squad ${squadDoc.id.slice(0, 6)}`,
          squadLogo: data.logo || data.teamLogo || '',
        }
      } catch (error) {
        console.error(`Failed to fetch squad summary for ${id}:`, error)
        return null
      }
    })
  )

  return summaries.filter(Boolean)
}

const attachGroupSquads = async (normalisedGroups = [], rawGroups = []) => {
  const rawGroupMap = new Map(
    (rawGroups || []).map((grp) => [(grp.key || grp.id || '').toUpperCase(), grp])
  )
  const requestedIds = []
  rawGroups.forEach((grp) => {
    const squadList = Array.isArray(grp?.squads) ? grp.squads : []
    squadList.forEach((entry) => {
      const squadId = extractSquadId(entry)
      if (squadId) {
        requestedIds.push(squadId)
      }
    })
  })

  const fetchedSummaries = await fetchSquadSummaries(requestedIds)
  const summaryMap = new Map(fetchedSummaries.map((summary) => [summary.squadId, summary]))
  const participantMap = new Map()

  const groupsWithSquads = normalisedGroups.map((group) => {
    const rawGroup = rawGroupMap.get(group.key) || {}
    const sanitizedSquads = (rawGroup.squads || [])
      .map((entry) => {
        const squadId = extractSquadId(entry)
        if (!squadId) return null
        const fallback = summaryMap.get(squadId) || {}
        const summary = buildSquadSummary(
          {
            squadId,
            squadName: entry.squadName || entry.name,
            squadLogo: entry.squadLogo || entry.logo,
          },
          fallback
        )
        if (summary) {
          participantMap.set(summary.squadId, summary)
        }
        return summary
      })
      .filter(Boolean)

    return {
      ...group,
      squads: sanitizedSquads,
    }
  })

  return {
    groupsWithSquads,
    participants: Array.from(participantMap.values()),
  }
}

const normaliseParticipantsList = async (rawParticipants = []) => {
  const requestedIds = rawParticipants.map((entry) => extractSquadId(entry)).filter(Boolean)
  const fetchedSummaries = await fetchSquadSummaries(requestedIds)
  const summaryMap = new Map(fetchedSummaries.map((summary) => [summary.squadId, summary]))
  const participantMap = new Map()

  rawParticipants.forEach((entry) => {
    const squadId = extractSquadId(entry)
    if (!squadId) return
    const fallback = summaryMap.get(squadId) || {}
    const summary = buildSquadSummary(
      {
        squadId,
        squadName: entry?.squadName || entry?.name,
        squadLogo: entry?.squadLogo || entry?.logo,
      },
      fallback
    )
    if (summary) {
      participantMap.set(summary.squadId, summary)
    }
  })

  return Array.from(participantMap.values())
}

// Get all tournaments
router.get('/', async (req, res) => {
  try {
    const tournamentsRef = db.collection('tournaments')
    const snapshot = await tournamentsRef.orderBy('createdAt', 'desc').get()

    const tournaments = []
    
    // Get all tournaments and count squads for each
    for (const doc of snapshot.docs) {
      const tournamentData = {
        id: doc.id,
        ...doc.data(),
      }

      // Count participant squads from tournament data (ICC-compliant)
      try {
        // Count from participantSquads array (primary source)
        if (tournamentData.participantSquads && Array.isArray(tournamentData.participantSquads)) {
          tournamentData.totalSquads = tournamentData.participantSquads.length
        } else if (tournamentData.groupStage?.enabled && tournamentData.groupStage?.groups) {
          // If group stage enabled, count unique squads from all groups
          const squadSet = new Set()
          tournamentData.groupStage.groups.forEach((group) => {
            if (group.squads && Array.isArray(group.squads)) {
              group.squads.forEach((squad) => {
                const squadId = squad.squadId || squad.id
                if (squadId) squadSet.add(squadId)
              })
            }
          })
          tournamentData.totalSquads = squadSet.size
        } else {
          // Fallback: count from squads collection
          const squadsSnapshot = await db
            .collection('squads')
            .where('tournamentId', '==', doc.id)
            .get()
          tournamentData.totalSquads = squadsSnapshot.size
        }
      } catch (error) {
        console.error(`Error counting squads for tournament ${doc.id}:`, error)
        tournamentData.totalSquads = 0
      }

      tournaments.push(tournamentData)
    }

    res.json({
      success: true,
      data: tournaments,
    })
  } catch (error) {
    console.error('Error fetching tournaments:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tournaments',
    })
  }
})

// Get single tournament
router.get('/:id', async (req, res) => {
  try {
    const tournamentRef = db.collection('tournaments').doc(req.params.id)
    const doc = await tournamentRef.get()

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found',
      })
    }

    res.json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data(),
      },
    })
  } catch (error) {
    console.error('Error fetching tournament:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tournament',
    })
  }
})

// Create tournament (Admin only)
router.post(
  '/',
  verifyToken,
  [
    body('name').trim().notEmpty().withMessage('Tournament name is required'),
    body('year').isInt({ min: 2020, max: 2100 }).withMessage('Valid year is required'),
    body('school').optional().trim().notEmpty(),
    body('schoolName').optional().trim().notEmpty(),
    body('startDate').notEmpty().withMessage('Start date is required'),
    body('format').optional().isIn(['T20', 'ODI', 'Test']),
  ],
  async (req, res) => {
    try {
      // Ensure at least one of 'school' or 'schoolName' is provided
      if (!req.body.school && !req.body.schoolName) {
        return res.status(400).json({
          success: false,
          errors: [{ msg: 'Either school or schoolName is required' }],
        })
      }

      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const groupStage = normaliseGroupStage(req.body.groupStage)
      const knockoutStage = normaliseKnockoutStageFn(req.body.knockoutStage)

      let participantSquads = []
      if (groupStage.enabled) {
        const { groupsWithSquads, participants } = await attachGroupSquads(
          groupStage.groups,
          req.body.groupStage?.groups || []
        )
        groupStage.groups = groupsWithSquads
        participantSquads = participants
      } else {
        participantSquads = await normaliseParticipantsList(req.body.participantSquads || [])
      }

      const tournamentData = {
        name: req.body.name,
        year: req.body.year,
        school: req.body.school || req.body.schoolName, // Support both 'school' and 'schoolName'
        schoolName: req.body.school || req.body.schoolName, // Keep for backward compatibility
        startDate: req.body.startDate,
        format: req.body.format || 'T20',
        status: req.body.status || 'upcoming', // upcoming, ongoing, completed
        description: req.body.description || '',
        groupStage,
        knockoutStage,
        participantSquads,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: req.user.email,
      }

      const docRef = await db.collection('tournaments').add(tournamentData)

      // Count squads for new tournament (will be 0)
      tournamentData.totalSquads = 0

      res.status(201).json({
        success: true,
        data: {
          id: docRef.id,
          ...tournamentData,
        },
      })
    } catch (error) {
      console.error('Error creating tournament:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to create tournament',
      })
    }
  }
)

// Update tournament (Admin only)
router.put(
  '/:id',
  verifyToken,
  [
    body('name').optional().trim().notEmpty(),
    body('year').optional().isInt({ min: 2020, max: 2100 }),
    body('format').optional().isIn(['T20', 'ODI', 'Test']),
    body('status').optional().isIn(['upcoming', 'ongoing', 'completed']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        })
      }

      const tournamentRef = db.collection('tournaments').doc(req.params.id)
      const doc = await tournamentRef.get()

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Tournament not found',
        })
      }

      const updateData = { ...req.body }
      let participantSquads = null

      if (req.body.groupStage) {
        updateData.groupStage = normaliseGroupStage(req.body.groupStage)
        if (updateData.groupStage.enabled) {
          const { groupsWithSquads, participants } = await attachGroupSquads(
            updateData.groupStage.groups,
            req.body.groupStage?.groups || []
          )
          updateData.groupStage.groups = groupsWithSquads
          participantSquads = participants
        } else {
          participantSquads = await normaliseParticipantsList(req.body.participantSquads || [])
        }
      }

      if (req.body.knockoutStage) {
        updateData.knockoutStage = normaliseKnockoutStageFn(req.body.knockoutStage)
      }

      if (!req.body.groupStage && Array.isArray(req.body.participantSquads)) {
        participantSquads = await normaliseParticipantsList(req.body.participantSquads)
      }

      if (participantSquads) {
        updateData.participantSquads = participantSquads
      }

      updateData.updatedAt = new Date()
      updateData.updatedBy = req.user.email

      await tournamentRef.update(updateData)

      const updatedDoc = await tournamentRef.get()

      res.json({
        success: true,
        data: {
          id: updatedDoc.id,
          ...updatedDoc.data(),
        },
      })
    } catch (error) {
      console.error('Error updating tournament:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to update tournament',
      })
    }
  }
)

// Delete tournament (Admin only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const tournamentRef = db.collection('tournaments').doc(req.params.id)
    const doc = await tournamentRef.get()

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Tournament not found',
      })
    }

    await tournamentRef.delete()

    res.json({
      success: true,
      message: 'Tournament deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting tournament:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete tournament',
    })
  }
})

const buildGroupStandings = async (tournamentId, groups, qualifiersPerGroup) => {
  const squadsSnapshot = await db
    .collection('squads')
    .where('tournamentId', '==', tournamentId)
    .get()

  const groupAssignments = new Map()
  groups.forEach((group = {}) => {
    (group.squads || []).forEach((squad) => {
      const squadId = extractSquadId(squad)
      if (!squadId) return
      groupAssignments.set(squadId, {
        key: (group.key || '').toUpperCase(),
        name: group.name || `Group ${group.key}`,
      })
    })
  })

  const squadMap = new Map()
  squadsSnapshot.forEach((doc) => {
    const data = doc.data()
    const assignment = groupAssignments.get(doc.id) || {}
    squadMap.set(doc.id, {
      id: doc.id,
      name: data.teamName || data.name || `Squad ${doc.id.slice(0, 6)}`,
      groupKey: assignment.key || (data.groupKey || '').toUpperCase() || 'UNASSIGNED',
      groupName: assignment.name || '',
      captain: data.captain || '',
      viceCaptain: data.viceCaptain || '',
    })
  })

  const stats = new Map()
  squadMap.forEach((squad) => {
    stats.set(squad.id, {
      squadId: squad.id,
      name: squad.name,
      groupKey: squad.groupKey,
      groupName: squad.groupName || '',
      matches: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      noResult: 0,
      points: 0,
      runsFor: 0,
      runsAgainst: 0,
      ballsFaced: 0,
      ballsBowled: 0,
      netRunRate: 0,
    })
  })

  const matchesSnapshot = await db
    .collection('matches')
    .where('tournamentId', '==', tournamentId)
    .where('status', 'in', ['Completed', 'Finished'])
    .get()

  matchesSnapshot.forEach((doc) => {
    const match = doc.data()
    const isGroupStage = !match.stage || match.stage === 'group'
    if (!isGroupStage) return
    if (!match.teamASquadId || !match.teamBSquadId) return

    const teamAStats = stats.get(match.teamASquadId)
    const teamBStats = stats.get(match.teamBSquadId)
    if (!teamAStats || !teamBStats) return

    const runs1 = match.runs1 ?? match.score?.teamA?.runs ?? 0
    const runs2 = match.runs2 ?? match.score?.teamB?.runs ?? 0
    const balls1 = match.balls1 ?? match.score?.teamA?.balls ?? ballsFromOversValue(match.overs1 || match.score?.teamA?.overs || '0.0')
    const balls2 = match.balls2 ?? match.score?.teamB?.balls ?? ballsFromOversValue(match.overs2 || match.score?.teamB?.overs || '0.0')

    teamAStats.matches += 1
    teamBStats.matches += 1

    teamAStats.runsFor += runs1
    teamAStats.runsAgainst += runs2
    teamAStats.ballsFaced += balls1
    teamAStats.ballsBowled += balls2

    teamBStats.runsFor += runs2
    teamBStats.runsAgainst += runs1
    teamBStats.ballsFaced += balls2
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

  const groupStandings = new Map()
  stats.forEach((teamStats) => {
    const nrr = computeNetRunRateBackend(teamStats.runsFor, teamStats.ballsFaced, teamStats.runsAgainst, teamStats.ballsBowled)
    teamStats.netRunRate = nrr
    const groupKey = teamStats.groupKey || 'UNASSIGNED'
    if (!groupStandings.has(groupKey)) {
      groupStandings.set(groupKey, [])
    }
    groupStandings.get(groupKey).push(teamStats)
  })

  const qualifiers = []
  groups.forEach((group = {}) => {
    const key = (group.key || '').toUpperCase() || 'UNASSIGNED'
    const contenders = groupStandings.get(key) || []
    contenders.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.netRunRate !== a.netRunRate) return b.netRunRate - a.netRunRate
      return a.name.localeCompare(b.name)
    })

    const spots = Math.max(1, group.qualifiers || qualifiersPerGroup || 1)
    contenders.slice(0, spots).forEach((team, idx) => {
      qualifiers.push({
        groupKey: key,
        groupName: group.name || '',
        position: idx + 1,
        ...team,
      })
    })
  })

  return { groupStandings, qualifiers }
}

const createOrUpdateKnockoutMatches = async (tournament, qualifiers) => {
  const tournamentId = tournament.id
  const knockoutStage = tournament.knockoutStage
  const firstStage = knockoutStage.stages?.[0]
  if (!firstStage) {
    throw new Error('Knockout stage configuration missing stage definitions')
  }

  const requiredMatches = Math.max(1, Number.parseInt(firstStage.matches || 1, 10))
  if (qualifiers.length < requiredMatches * 2) {
    throw new Error('Not enough qualified teams to seed knockout stage')
  }

  const seeds = qualifiers.slice(0, requiredMatches * 2)
  const pairings = []
  for (let i = 0; i < requiredMatches; i += 1) {
    const teamA = seeds[i * 2]
    const teamB = seeds[i * 2 + 1]
    pairings.push({
      matchOrder: i,
      teamA,
      teamB,
    })
  }

  const matchesSnapshot = await db
    .collection('matches')
    .where('tournamentId', '==', tournamentId)
    .where('stage', '==', firstStage.key)
    .get()

  const existingMatches = matchesSnapshot.docs
  const batch = db.batch()

  pairings.forEach((pairing, index) => {
    const matchDoc = existingMatches[index]
    const matchPayload = {
      tournamentId,
      tournamentName: tournament.name,
      date: '',
      time: '',
      venue: 'TBD',
      status: 'Upcoming',
      teamASquadId: pairing.teamA.squadId,
      teamBSquadId: pairing.teamB.squadId,
      team1: pairing.teamA.name,
      team2: pairing.teamB.name,
      teamA: pairing.teamA.name,
      teamB: pairing.teamB.name,
      runs1: 0,
      runs2: 0,
      wickets1: 0,
      wickets2: 0,
      overs1: '0.0',
      overs2: '0.0',
      balls1: 0,
      balls2: 0,
      stage: firstStage.key,
      stageLabel: firstStage.name || firstStage.key,
      bracketPosition: `match_${index + 1}`,
      bracketOrder: index,
      isFinal: firstStage.key === 'final',
      winnerSquadId: '',
      loserSquadId: '',
      championRecorded: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    if (matchDoc) {
      batch.update(matchDoc.ref, {
        ...matchPayload,
        createdAt: matchDoc.data().createdAt || new Date(),
      })
    } else {
      const newRef = db.collection('matches').doc()
      batch.set(newRef, matchPayload)
    }
  })

  // Remove extra matches if there are more than needed
  if (existingMatches.length > pairings.length) {
    existingMatches.slice(pairings.length).forEach((doc) => {
      batch.delete(doc.ref)
    })
  }

  await batch.commit()

  return pairings
}

router.post('/:id/seed-knockout', verifyToken, async (req, res) => {
  try {
    const tournamentRef = db.collection('tournaments').doc(req.params.id)
    const tournamentDoc = await tournamentRef.get()

    if (!tournamentDoc.exists) {
      return res.status(404).json({ success: false, error: 'Tournament not found' })
    }

    const tournament = { id: tournamentDoc.id, ...tournamentDoc.data() }

    if (!tournament.groupStage?.enabled) {
      return res.status(400).json({ success: false, error: 'Group stage is not enabled for this tournament' })
    }

    if (!tournament.knockoutStage?.enabled) {
      return res.status(400).json({ success: false, error: 'Knockout stage is not enabled for this tournament' })
    }

    if (tournament.knockoutStage.autoSeedFromGroups === false) {
      return res.status(400).json({ success: false, error: 'Auto seeding is disabled. Please seed manually.' })
    }

    const groups = tournament.groupStage.groups || []
    const qualifiersPerGroup = tournament.groupStage.qualifiersPerGroup || 1

    const { groupStandings, qualifiers } = await buildGroupStandings(tournament.id, groups, qualifiersPerGroup)
    if (qualifiers.length === 0) {
      return res.status(400).json({ success: false, error: 'No group results available yet.' })
    }

    const pairings = await createOrUpdateKnockoutMatches(tournament, qualifiers)

    res.json({
      success: true,
      message: 'Knockout stage seeded successfully',
      pairings,
      standings: Array.from(groupStandings.entries()).map(([groupKey, rows]) => ({ groupKey, rows })),
    })
  } catch (error) {
    console.error('Error seeding knockout stage:', error)
    res.status(500).json({ success: false, error: error.message || 'Failed to seed knockout stage' })
  }
})

export default router

