import express from 'express'
import { body, validationResult } from 'express-validator'
import { db } from '../config/firebaseAdmin.js'
import { verifyToken } from '../middleware/auth.js'

const router = express.Router()

// Get all players
router.get('/', async (req, res) => {
  try {
    const {
      batch,
      role,
      search,
      year,
      tournamentId,
      squadId,
      includeRelations = 'true',
    } = req.query

    const includeRelationsFlag = includeRelations !== 'false'

    let playersRef = db.collection('players')

    if (batch) {
      playersRef = playersRef.where('batch', '==', batch)
    }
    if (role) {
      playersRef = playersRef.where('role', '==', role)
    }
    if (year) {
      playersRef = playersRef.where('year', '==', Number.parseInt(year, 10))
    }
    if (tournamentId) {
      playersRef = playersRef.where('tournamentId', '==', tournamentId)
    }
    if (squadId) {
      playersRef = playersRef.where('squadId', '==', squadId)
    }

    const hasFilters = Boolean(batch || role || year || tournamentId || squadId || search)
    const snapshot = hasFilters
      ? await playersRef.get()
      : await playersRef.orderBy('name', 'asc').get()

    let players = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    if (includeRelationsFlag && players.length > 0) {
      const uniqueTournamentIds = [
        ...new Set(players.map((player) => player.tournamentId).filter(Boolean)),
      ]
      const uniqueSquadIds = [...new Set(players.map((player) => player.squadId).filter(Boolean))]

      const tournamentsMap = {}
      const squadsMap = {}

      if (uniqueTournamentIds.length > 0) {
        const tournamentRefs = uniqueTournamentIds.map((id) =>
          db.collection('tournaments').doc(id)
        )
        const tournamentDocs = await db.getAll(...tournamentRefs)
        tournamentDocs.forEach((docSnapshot, index) => {
          if (docSnapshot.exists) {
            tournamentsMap[uniqueTournamentIds[index]] = docSnapshot.data()
          }
        })
      }

      if (uniqueSquadIds.length > 0) {
        const squadRefs = uniqueSquadIds.map((id) => db.collection('squads').doc(id))
        const squadDocs = await db.getAll(...squadRefs)
        squadDocs.forEach((docSnapshot, index) => {
          if (docSnapshot.exists) {
            squadsMap[uniqueSquadIds[index]] = docSnapshot.data()
          }
        })
      }

      players = players.map((player) => {
        const tournamentData = tournamentsMap[player.tournamentId] || {}
        const squadData = squadsMap[player.squadId] || {}

        return {
          ...player,
          tournamentName: player.tournamentName || tournamentData.name || '',
          squadName:
            player.squadName ||
            squadData.teamName ||
            squadData.name ||
            (squadData.batch ? `Batch ${squadData.batch}` : ''),
        }
      })
    }

    if (search) {
      const searchLower = search.toLowerCase()
      players = players.filter((playerData) => {
        const matchesName = playerData.name?.toLowerCase().includes(searchLower)
        const matchesBatch = playerData.batch?.toString().includes(searchLower)
        const matchesTournament = playerData.tournamentName
          ?.toLowerCase()
          .includes(searchLower)
        const matchesSquad = playerData.squadName?.toLowerCase().includes(searchLower)

        if (includeRelationsFlag) {
          return matchesName || matchesBatch || matchesTournament || matchesSquad
        }

        return matchesName || matchesBatch
      })
    }

    if (hasFilters) {
      players.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }

    res.json({
      success: true,
      data: players,
    })
  } catch (error) {
    console.error('Error fetching players:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch players',
    })
  }
})

// Get single player
router.get('/:id', async (req, res) => {
  try {
    const playerRef = db.collection('players').doc(req.params.id)
    const doc = await playerRef.get()

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Player not found',
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
    console.error('Error fetching player:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch player',
    })
  }
})

// Create player (Admin only)
router.post(
  '/',
  verifyToken,
  [
    body('name').trim().notEmpty().withMessage('Player name is required'),
    body('role').isIn(['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper']).withMessage('Invalid role'),
    body('village').optional().trim(),
    body('batch').optional().isInt({ min: 1900, max: 2100 }).withMessage('Batch year must be valid'),
    body('tournamentId').optional().trim(), // Make tournamentId optional - players can be independent
    body('squadId').optional().trim(), // Make squadId optional - players can be independent
    body('year').optional().isInt({ min: 2020, max: 2100 }).withMessage('Valid year is required'),
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

      // Verify tournament exists (if provided)
      if (req.body.tournamentId) {
        const tournamentRef = db.collection('tournaments').doc(req.body.tournamentId)
        const tournamentDoc = await tournamentRef.get()
        
        if (!tournamentDoc.exists) {
          return res.status(400).json({
            success: false,
            error: 'Tournament not found',
          })
        }
      }

      // Verify squad exists and belongs to tournament (if both provided)
      if (req.body.squadId) {
        const squadRef = db.collection('squads').doc(req.body.squadId)
        const squadDoc = await squadRef.get()
        
        if (!squadDoc.exists) {
          return res.status(400).json({
            success: false,
            error: 'Squad not found',
          })
        }

        // If tournamentId is also provided, verify squad belongs to tournament
        if (req.body.tournamentId && squadDoc.data().tournamentId !== req.body.tournamentId) {
          return res.status(400).json({
            success: false,
            error: 'Squad does not belong to selected tournament',
          })
        }
      }

      const baseStats = {
        matches: 0,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        wickets: 0,
        ballsBowled: 0,
        runsConceded: 0,
        battingInnings: 0,
        bowlingInnings: 0,
        dismissals: 0,
        notOuts: 0,
        strikeRate: 0,
        average: 0,
        economy: 0,
        bowlingAverage: 0,
        bowlingStrikeRate: 0,
        highest: 0,
        fifties: 0,
        hundreds: 0,
        wins: 0,
        losses: 0,
        ties: 0,
      }

      const playerData = {
        name: req.body.name,
        batch: req.body.batch ? req.body.batch.toString() : req.body.year.toString(),
        year: req.body.year,
        role: req.body.role,
        village: req.body.village || '',
        photo: req.body.photo || '',
        tournamentId: req.body.tournamentId,
        squadId: req.body.squadId,
        stats: {
          ...baseStats,
          ...(req.body.stats || {}),
        },
        pastMatches: req.body.pastMatches || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: req.user.email,
      }

      const docRef = await db.collection('players').add(playerData)

      res.status(201).json({
        success: true,
        data: {
          id: docRef.id,
          ...playerData,
        },
      })
    } catch (error) {
      console.error('Error creating player:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to create player',
      })
    }
  }
)

// Update player (Admin only)
router.put(
  '/:id',
  verifyToken,
  [
    body('role').optional().isIn(['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper']),
    body('stats').optional().isObject(),
    body('stats.runs').optional().isInt({ min: 0 }),
    body('batch').optional().isInt({ min: 1900, max: 2100 }),
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

      const playerRef = db.collection('players').doc(req.params.id)
      const doc = await playerRef.get()

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Player not found',
        })
      }

      const updateData = {
        ...req.body,
        ...(req.body.batch && { batch: req.body.batch.toString() }),
        updatedAt: new Date(),
        updatedBy: req.user.email,
      }

      await playerRef.update(updateData)

      const updatedDoc = await playerRef.get()

      res.json({
        success: true,
        data: {
          id: updatedDoc.id,
          ...updatedDoc.data(),
        },
      })
    } catch (error) {
      console.error('Error updating player:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to update player',
      })
    }
  }
)

// Delete player (Admin only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const playerRef = db.collection('players').doc(req.params.id)
    const doc = await playerRef.get()

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Player not found',
      })
    }

    await playerRef.delete()

    res.json({
      success: true,
      message: 'Player deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting player:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete player',
    })
  }
})

router.post('/sync-squad-players', verifyToken, async (req, res) => {
  try {
    const { squadId, players } = req.body

    if (!squadId || !Array.isArray(players)) {
      return res.status(400).json({
        success: false,
        error: 'squadId and players array are required',
      })
    }

    const batch = db.batch()

    for (const player of players) {
      const playerData = {
        name: player.name,
        role: player.role,
        village: player.village || '',
        class: player.class || '',
      }

      const playerRef = db.collection('squads').doc(squadId).collection('players').doc(player.id)

      if (player.id) {
        batch.update(playerRef, playerData)
      } else {
        batch.set(playerRef, playerData)
      }
    }

    await batch.commit()

    res.json({
      success: true,
      message: 'Squad players synced successfully',
    })
  } catch (error) {
    console.error('Error syncing squad players:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to sync squad players',
    })
  }
})

export default router

