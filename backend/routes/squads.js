import express from 'express'
import { body, validationResult } from 'express-validator'
import { db } from '../config/firebaseAdmin.js'
import { verifyToken } from '../middleware/auth.js'

const router = express.Router()

const fetchTournamentGroups = async (tournamentId) => {
  if (!tournamentId) return []
  const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get()
  if (!tournamentDoc.exists) return []
  const data = tournamentDoc.data()
  if (data?.groupStage?.enabled && Array.isArray(data.groupStage.groups)) {
    return data.groupStage.groups
  }
  return []
}

const resolveGroupAssignment = async (tournamentId, groupKey) => {
  if (!groupKey) {
    return { groupKey: '', groupName: '' }
  }
  const groups = await fetchTournamentGroups(tournamentId)
  const matched = groups.find((grp) => (grp.key || '').toUpperCase() === groupKey.toUpperCase())
  if (!matched) {
    throw new Error('Invalid group selection for this tournament')
  }
  return {
    groupKey: matched.key.toUpperCase(),
    groupName: matched.name,
  }
}

// Get all squads
router.get('/', async (req, res) => {
  try {
    const { batch, tournamentId } = req.query
    let squadsRef = db.collection('squads')

    if (batch) {
      squadsRef = squadsRef.where('batch', '==', batch)
    }
    if (tournamentId) {
      squadsRef = squadsRef.where('tournamentId', '==', tournamentId)
    }

    const snapshot = await squadsRef.get()

    const squads = []
    
    // Get all squads and fetch tournament names
    for (const doc of snapshot.docs) {
      const squadData = {
        id: doc.id,
        ...doc.data(),
      }

      // Fetch tournament name if tournamentId exists
      if (squadData.tournamentId) {
        try {
          const tournamentDoc = await db.collection('tournaments').doc(squadData.tournamentId).get()
          if (tournamentDoc.exists) {
            squadData.tournamentName = tournamentDoc.data().name
          }
        } catch (error) {
          console.error(`Error fetching tournament for squad ${doc.id}:`, error)
        }
      }

      squads.push(squadData)
    }

    // Sort squads by year/batch descending for consistent display
    squads.sort((a, b) => {
      const yearA = parseInt(a.year || a.batch || '0', 10)
      const yearB = parseInt(b.year || b.batch || '0', 10)
      return yearB - yearA
    })

    res.json({
      success: true,
      data: squads,
    })
  } catch (error) {
    console.error('Error fetching squads:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch squads',
    })
  }
})

// Get single squad
router.get('/:id', async (req, res) => {
  try {
    const squadRef = db.collection('squads').doc(req.params.id)
    const doc = await squadRef.get()

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Squad not found',
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
    console.error('Error fetching squad:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch squad',
    })
  }
})

// Create squad (Admin only)
router.post(
  '/',
  verifyToken,
  [
    body('name').optional().trim().notEmpty(),
    body('teamName').optional().trim().notEmpty(),
    body('year').isInt({ min: 2020, max: 2100 }).withMessage('Valid year is required'),
    body('tournamentId').optional().trim(), // Make tournamentId optional - squads can be independent
    body('players').optional().isArray(),
  ],
  async (req, res) => {
    try {
      // Ensure at least one of 'name' or 'teamName' is provided
      if (!req.body.name && !req.body.teamName) {
        return res.status(400).json({
          success: false,
          errors: [{ msg: 'Either name or teamName is required' }],
        })
      }

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

      let groupAssignment = { groupKey: '', groupName: '' }
      if (req.body.groupKey && req.body.tournamentId) {
        try {
          groupAssignment = await resolveGroupAssignment(req.body.tournamentId, req.body.groupKey)
        } catch (groupError) {
          return res.status(400).json({
            success: false,
            error: groupError.message,
          })
        }
      }

      const squadData = {
        name: req.body.name || req.body.teamName, // Support both 'name' and 'teamName'
        teamName: req.body.name || req.body.teamName, // Keep for backward compatibility
        year: req.body.year,
        batch: req.body.year.toString(), // Keep batch for backward compatibility
        tournamentId: req.body.tournamentId || null, // Optional - squads can be independent
        players: req.body.players || [],
        captain: req.body.captain || null,
        viceCaptain: req.body.viceCaptain || null,
        groupKey: groupAssignment.groupKey,
        groupName: groupAssignment.groupName,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: req.user.email,
      }

      const docRef = await db.collection('squads').add(squadData)

      // Add tournament name to response
      squadData.tournamentName = tournamentDoc.data().name

      res.status(201).json({
        success: true,
        data: {
          id: docRef.id,
          ...squadData,
        },
      })
    } catch (error) {
      console.error('Error creating squad:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to create squad',
      })
    }
  }
)

// Update squad (Admin only)
router.put(
  '/:id',
  verifyToken,
  [
    body('players').optional().isArray(),
    body('players.*.name').optional().trim().notEmpty(),
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

      const squadRef = db.collection('squads').doc(req.params.id)
      const doc = await squadRef.get()

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Squad not found',
        })
      }

      const updateData = {
        ...req.body,
      }

      if (req.body.groupKey !== undefined) {
        try {
          const assignment = await resolveGroupAssignment(doc.data().tournamentId, req.body.groupKey)
          updateData.groupKey = assignment.groupKey
          updateData.groupName = assignment.groupName
        } catch (groupError) {
          return res.status(400).json({
            success: false,
            error: groupError.message,
          })
        }
      }

      updateData.updatedAt = new Date()
      updateData.updatedBy = req.user.email

      await squadRef.update(updateData)

      const updatedDoc = await squadRef.get()

      res.json({
        success: true,
        data: {
          id: updatedDoc.id,
          ...updatedDoc.data(),
        },
      })
    } catch (error) {
      console.error('Error updating squad:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to update squad',
      })
    }
  }
)

// Delete squad (Admin only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const squadRef = db.collection('squads').doc(req.params.id)
    const doc = await squadRef.get()

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Squad not found',
      })
    }

    await squadRef.delete()

    res.json({
      success: true,
      message: 'Squad deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting squad:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete squad',
    })
  }
})

export default router

