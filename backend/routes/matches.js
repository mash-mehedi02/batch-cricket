import express from 'express'
import { body, validationResult } from 'express-validator'
import { db } from '../config/firebaseAdmin.js'
import { verifyToken, verifyTokenOptional } from '../middleware/auth.js'

const router = express.Router()

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const roundStat = (value, digits = 2) => {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const ballsToOversValue = (balls = 0) => {
  const total = toNumber(balls, 0)
  const overs = Math.floor(total / 6)
  const remainder = total % 6
  return `${overs}.${remainder}`
}

const getResultForSquad = (matchData = {}, squadId = '') => {
  if (!squadId) return 'Tied'
  if (matchData.winnerSquadId) {
    if (matchData.winnerSquadId === squadId) return 'Won'
    if (matchData.loserSquadId === squadId) return 'Lost'
    return 'Tied'
  }
  const runsTeamA = toNumber(matchData?.score?.teamA?.runs ?? matchData.runs1 ?? 0)
  const runsTeamB = toNumber(matchData?.score?.teamB?.runs ?? matchData.runs2 ?? 0)
  if (runsTeamA === runsTeamB) return 'Tied'
  if (squadId === matchData.teamASquadId) {
    return runsTeamA > runsTeamB ? 'Won' : 'Lost'
  }
  if (squadId === matchData.teamBSquadId) {
    return runsTeamB > runsTeamA ? 'Won' : 'Lost'
  }
  return 'Tied'
}

const buildPlayerMatchSummary = (playerEntry = {}, matchData = {}, context = {}) => {
  const runs = toNumber(playerEntry.runs)
  const balls = toNumber(playerEntry.balls)
  const fours = toNumber(playerEntry.fours)
  const sixes = toNumber(playerEntry.sixes)
  const wickets = toNumber(playerEntry.bowlingWickets)
  const ballsBowled = toNumber(playerEntry.bowlingBalls)
  const runsConceded = toNumber(playerEntry.bowlingRuns)
  const strikeRate = balls > 0 ? roundStat((runs / balls) * 100) : 0
  const economy = ballsBowled > 0 ? roundStat(runsConceded / (ballsBowled / 6)) : 0
  const bowlingStrikeRate = wickets > 0 ? roundStat(ballsBowled / wickets) : 0
  // ICC Rule: Player has batted (innings count) if they:
  // 1. Faced at least 1 ball (balls > 0) - minimum requirement
  // 2. Were dismissed (status === 'out') - even if balls = 0 (e.g., run out on 0 balls)
  // Note: Just being on crease (isOnCrease === true) without facing a ball and not dismissed does NOT count as an innings
  const batted = balls > 0 || playerEntry.status === 'out'
  const bowled = ballsBowled > 0
  const dismissed = playerEntry.status === 'out'

  return {
    matchId: context.matchId,
    tournamentId: matchData.tournamentId || '',
    tournamentName: matchData.tournamentName || '',
    date: matchData.date || '',
    time: matchData.time || '',
    venue: matchData.venue || '',
    teamName: context.teamName || '',
    opponentName: context.opponentName || '',
    squadId: context.squadId || '',
    opponentSquadId: context.opponentSquadId || '',
    result: context.result || 'Tied',
    resultSummary: matchData.resultSummary || '', // Include match result summary
    played: true,
    batted,
    bowled,
    notOut: batted ? !dismissed : false,
    runs,
    balls,
    fours,
    sixes,
    strikeRate,
    wickets,
    ballsBowled,
    oversBowled: ballsToOversValue(ballsBowled),
    economy,
    bowlingStrikeRate,
    runsConceded,
    dismissalText: playerEntry.dismissalText || '',
    battingPosition: playerEntry.battingPosition ?? null,
    captain: Boolean(playerEntry.isCaptain),
    keeper: Boolean(playerEntry.isKeeper),
    timestamp: Date.now(),
    createdAt: new Date(),
  }
}

const aggregateCareerStats = (matchSummaries = []) => {
  const totals = matchSummaries.reduce(
    (acc, match) => {
      if (match.played) {
        acc.matches += 1
      }
      const runs = toNumber(match.runs)
      const balls = toNumber(match.balls)
      const fours = toNumber(match.fours)
      const sixes = toNumber(match.sixes)
      const wickets = toNumber(match.wickets)
      const ballsBowled = toNumber(match.ballsBowled)
      const runsConceded = toNumber(match.runsConceded)

      acc.runs += runs
      acc.balls += balls
      acc.fours += fours
      acc.sixes += sixes
      acc.wickets += wickets
      acc.ballsBowled += ballsBowled
      acc.runsConceded += runsConceded

      if (match.batted) {
        acc.battingInnings += 1
        if (match.notOut) {
          acc.notOuts += 1
        } else {
          acc.dismissals += 1
        }
      }

      if (match.bowled) {
        acc.bowlingInnings += 1
      }

      if (match.result === 'Won') acc.wins += 1
      else if (match.result === 'Lost') acc.losses += 1
      else if (match.result === 'Tied') acc.ties += 1

      if (runs > acc.highest) {
        acc.highest = runs
      }
      if (runs >= 50 && runs < 100) {
        acc.fifties += 1
      }
      if (runs >= 100) {
        acc.hundreds += 1
      }

      return acc
    },
    {
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
      wins: 0,
      losses: 0,
      ties: 0,
      highest: 0,
      fifties: 0,
      hundreds: 0,
    }
  )

  const strikeRate = totals.balls > 0 ? roundStat((totals.runs / totals.balls) * 100) : 0
  // ICC Rule: Batting Average = Total Runs / Dismissals
  // If dismissals = 0 but player has innings, average = runs (not out)
  // If no innings, average = 0
  const battingAverage =
    totals.dismissals > 0
      ? roundStat(totals.runs / totals.dismissals)
      : totals.battingInnings > 0 && totals.runs > 0
      ? roundStat(totals.runs)
      : totals.battingInnings > 0
      ? 0
      : 0
  const economy =
    totals.ballsBowled > 0 ? roundStat(totals.runsConceded / (totals.ballsBowled / 6)) : 0
  // ICC Rule: Bowling Average = Runs Conceded / Wickets
  // If wickets = 0, bowling average is undefined (not 0)
  // Return Infinity if runsConceded > 0 but wickets = 0, otherwise 0
  const bowlingAverage =
    totals.wickets > 0 
      ? roundStat(totals.runsConceded / totals.wickets) 
      : totals.runsConceded > 0 
      ? Infinity 
      : 0
  const bowlingStrikeRate =
    totals.wickets > 0 ? roundStat(totals.ballsBowled / totals.wickets) : 0

  return {
    matches: totals.matches,
    runs: totals.runs,
    balls: totals.balls,
    fours: totals.fours,
    sixes: totals.sixes,
    wickets: totals.wickets,
    ballsBowled: totals.ballsBowled,
    runsConceded: totals.runsConceded,
    battingInnings: totals.battingInnings,
    bowlingInnings: totals.bowlingInnings,
    dismissals: totals.dismissals,
    notOuts: totals.notOuts,
    strikeRate,
    average: battingAverage,
    economy,
    bowlingAverage,
    bowlingStrikeRate,
    highest: totals.highest,
    fifties: totals.fifties,
    hundreds: totals.hundreds,
    wins: totals.wins,
    losses: totals.losses,
    ties: totals.ties,
    updatedAt: new Date(),
  }
}

const syncPlayerStatsForMatch = async (matchDoc) => {
  const matchData = matchDoc.data()
  if (!matchData) return
  if (!['Finished', 'Completed'].includes(matchData.status)) return

  if (!matchData.tournamentName && matchData.tournamentId) {
    try {
      const tournamentSnapshot = await db.collection('tournaments').doc(matchData.tournamentId).get()
      if (tournamentSnapshot.exists) {
        const tournamentData = tournamentSnapshot.data() || {}
        matchData.tournamentName = tournamentData.name || ''
      }
    } catch (error) {
      console.error(`Failed to fetch tournament for match ${matchDoc.id}:`, error)
    }
  }

  const teamAName = matchData.teamAName || matchData.team1 || matchData.teamA || 'Team A'
  const teamBName = matchData.teamBName || matchData.team2 || matchData.teamB || 'Team B'

  const teams = [
    {
      lineup: Array.isArray(matchData.teamAPlayingXI) ? matchData.teamAPlayingXI : [],
      squadId: matchData.teamASquadId,
      opponentSquadId: matchData.teamBSquadId,
      teamName: teamAName,
      opponentName: teamBName,
    },
    {
      lineup: Array.isArray(matchData.teamBPlayingXI) ? matchData.teamBPlayingXI : [],
      squadId: matchData.teamBSquadId,
      opponentSquadId: matchData.teamASquadId,
      teamName: teamBName,
      opponentName: teamAName,
    },
  ]

  for (const team of teams) {
    if (!team.squadId || !Array.isArray(team.lineup) || team.lineup.length === 0) continue
    for (const playerEntry of team.lineup) {
      if (!playerEntry?.playerId) continue

      const playerRef = db.collection('players').doc(playerEntry.playerId)
      const result = getResultForSquad(matchData, team.squadId)
      const summary = buildPlayerMatchSummary(playerEntry, matchData, {
        matchId: matchDoc.id,
        squadId: team.squadId,
        opponentSquadId: team.opponentSquadId,
        teamName: team.teamName,
        opponentName: team.opponentName,
        result,
      })

      // eslint-disable-next-line no-await-in-loop
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(playerRef)
        if (!snapshot.exists) return
        const playerData = snapshot.data() || {}
        const pastMatches = Array.isArray(playerData.pastMatches)
          ? [...playerData.pastMatches]
          : []
        const existingIndex = pastMatches.findIndex(
          (matchRecord) => matchRecord?.matchId === matchDoc.id
        )
        if (existingIndex >= 0) {
          pastMatches[existingIndex] = {
            ...pastMatches[existingIndex],
            ...summary,
          }
        } else {
          pastMatches.push(summary)
        }

        const aggregatedStats = aggregateCareerStats(pastMatches)

        transaction.update(playerRef, {
          pastMatches,
          stats: aggregatedStats,
          matchStats: aggregatedStats,
          lastMatchSummary: summary,
          updatedAt: new Date(),
          updatedBy: 'match-sync',
        })
      })
    }
  }
}

const recordChampionIfNeeded = async (matchDoc) => {
  const matchData = matchDoc.data()
  if (!matchData || matchData.championRecorded) return null
  if (matchData.stage !== 'final') return null
  if (!['Completed', 'Finished'].includes(matchData.status)) return null

  const runs1 = matchData.runs1 ?? matchData.score?.teamA?.runs ?? 0
  const runs2 = matchData.runs2 ?? matchData.score?.teamB?.runs ?? 0
  if (runs1 === runs2) return null

  const winnerSquadId = runs1 > runs2 ? matchData.teamASquadId : matchData.teamBSquadId
  const loserSquadId = runs1 > runs2 ? matchData.teamBSquadId : matchData.teamASquadId
  if (!winnerSquadId || !loserSquadId) return null

  const tournamentRef = db.collection('tournaments').doc(matchData.tournamentId)
  const tournamentDoc = await tournamentRef.get()
  if (!tournamentDoc.exists) return null
  const tournament = tournamentDoc.data()

  const winnerSquadDoc = await db.collection('squads').doc(winnerSquadId).get()
  const loserSquadDoc = await db.collection('squads').doc(loserSquadId).get()
  if (!winnerSquadDoc.exists || !loserSquadDoc.exists) return null

  const winnerSquad = winnerSquadDoc.data()
  const loserSquad = loserSquadDoc.data()

  const playersSnapshot = await db
    .collection('players')
    .where('squadId', '==', winnerSquadId)
    .get()

  const keyPlayers = playersSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((p) => p.matchStats && (p.matchStats.runs > 0 || p.matchStats.wickets > 0))
    .sort((a, b) => {
      const aScore = (a.matchStats?.runs || 0) + (a.matchStats?.wickets || 0) * 10
      const bScore = (b.matchStats?.runs || 0) + (b.matchStats?.wickets || 0) * 10
      return bScore - aScore
    })
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      role: p.role,
      runs: p.matchStats?.runs || 0,
      wickets: p.matchStats?.wickets || 0,
    }))

  const winnerRuns = runs1 > runs2 ? runs1 : runs2
  const winnerWickets = runs1 > runs2 ? matchData.wickets1 : matchData.wickets2
  const loserRuns = runs1 > runs2 ? runs2 : runs1
  const loserWickets = runs1 > runs2 ? matchData.wickets2 : matchData.wickets1
  const margin = Math.abs(runs1 - runs2)
  const summary = `${winnerSquad.teamName || `Batch ${winnerSquad.batch}`} won by ${margin} ${margin === 1 ? 'run' : 'runs'}`

  const championData = {
    tournamentId: matchData.tournamentId,
    tournamentName: tournament.name,
    year: tournament.year,
    squadId: winnerSquadId,
    teamName: winnerSquad.teamName || `Batch ${winnerSquad.batch}`,
    captain: winnerSquad.captain || 'N/A',
    viceCaptain: winnerSquad.viceCaptain || null,
    runnerUpId: loserSquadId,
    runnerUpName: loserSquad.teamName || `Batch ${loserSquad.batch}`,
    finalMatchId: matchDoc.id,
    finalMatchSummary: `${tournament.name} ${tournament.year} - ${summary}. ${winnerSquad.teamName || `Batch ${winnerSquad.batch}`} scored ${winnerRuns}/${winnerWickets} and ${loserSquad.teamName || `Batch ${loserSquad.batch}`} scored ${loserRuns}/${loserWickets}.`,
    venue: matchData.venue || 'Main Ground',
    date: matchData.date || '',
    time: matchData.time || '',
    keyPlayers,
    createdAt: new Date(),
  }

  await db.collection('champions').doc(matchData.tournamentId).set(championData)
  await matchDoc.ref.update({
    championRecorded: true,
    winnerSquadId,
    loserSquadId,
  })

  await tournamentRef.update({ status: 'completed', updatedAt: new Date() })

  return championData
}

// Get all matches
router.get('/', verifyTokenOptional, async (req, res) => {
  try {
    const { status, tournamentId } = req.query
    let matchesRef = db.collection('matches')

    if (status) {
      matchesRef = matchesRef.where('status', '==', status)
    }
    if (tournamentId) {
      matchesRef = matchesRef.where('tournamentId', '==', tournamentId)
    }

    const shouldSkipOrderBy = Boolean(status || tournamentId)
    const snapshot = shouldSkipOrderBy
      ? await matchesRef.get()
      : await matchesRef.orderBy('date', 'desc').get()

    const matches = []
    
    // Get all matches and fetch tournament/squad names
    for (const doc of snapshot.docs) {
      const matchData = {
        id: doc.id,
        ...doc.data(),
      }

      // Fetch tournament name if tournamentId exists
      if (matchData.tournamentId) {
        try {
          const tournamentDoc = await db.collection('tournaments').doc(matchData.tournamentId).get()
          if (tournamentDoc.exists) {
            matchData.tournamentName = tournamentDoc.data().name
          }
        } catch (error) {
          console.error(`Error fetching tournament for match ${doc.id}:`, error)
        }
      }

      // Fetch squad names if squadId exists
      if (matchData.teamASquadId) {
        try {
          const squadDoc = await db.collection('squads').doc(matchData.teamASquadId).get()
          if (squadDoc.exists) {
            matchData.teamAName = squadDoc.data().teamName || `Batch ${squadDoc.data().batch}`
          }
        } catch (error) {
          console.error(`Error fetching squad A for match ${doc.id}:`, error)
        }
      }

      if (matchData.teamBSquadId) {
        try {
          const squadDoc = await db.collection('squads').doc(matchData.teamBSquadId).get()
          if (squadDoc.exists) {
            matchData.teamBName = squadDoc.data().teamName || `Batch ${squadDoc.data().batch}`
          }
        } catch (error) {
          console.error(`Error fetching squad B for match ${doc.id}:`, error)
        }
      }

      matches.push(matchData)
    }

    res.json({
      success: true,
      data: shouldSkipOrderBy
        ? matches.sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.time || '00:00'}`)
            const dateB = new Date(`${b.date}T${b.time || '00:00'}`)
            return dateB - dateA
          })
        : matches,
    })
  } catch (error) {
    console.error('Error fetching matches:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch matches',
    })
  }
})

// Get live matches
router.get('/live', async (req, res) => {
  try {
    const snapshot = await db
      .collection('matches')
      .where('status', '==', 'Live')
      .orderBy('date', 'desc')
      .get()

    const matches = []
    snapshot.forEach((doc) => {
      matches.push({
        id: doc.id,
        ...doc.data(),
      })
    })

    res.json({
      success: true,
      data: matches,
    })
  } catch (error) {
    console.error('Error fetching live matches:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch live matches',
    })
  }
})

// Get single match
router.get('/:id', async (req, res) => {
  try {
    const matchRef = db.collection('matches').doc(req.params.id)
    const doc = await matchRef.get()

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Match not found',
      })
    }

    // Get commentary
    const commentarySnapshot = await db
      .collection('matches')
      .doc(req.params.id)
      .collection('commentary')
      .orderBy('timestamp', 'desc')
      .get()

    const commentary = []
    commentarySnapshot.forEach((commentDoc) => {
      commentary.push({
        id: commentDoc.id,
        ...commentDoc.data(),
      })
    })

    res.json({
      success: true,
      data: {
        id: doc.id,
        ...doc.data(),
        commentary: commentary.reverse(), // Oldest first
      },
    })
  } catch (error) {
    console.error('Error fetching match:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch match',
    })
  }
})

const validStages = ['group', 'qualifier', 'eliminator', 'semi_final', 'final', 'third_place']

const normaliseStagePayload = (payload = {}) => {
  if (!payload || !payload.stage) {
    return {
      stage: 'group',
      stageLabel: 'Group',
      bracketPosition: '',
      bracketOrder: 0,
    }
  }

  const stageKey = (payload.stage || '').toLowerCase()
  if (!validStages.includes(stageKey)) {
    throw new Error(`Invalid stage '${payload.stage}'. Allowed stages: ${validStages.join(', ')}`)
  }

  return {
    stage: stageKey,
    stageLabel: payload.stageLabel || (stageKey === 'semi_final' ? 'Semi Final' : stageKey.replace('_', ' ')),
    bracketPosition: payload.bracketPosition || '',
    bracketOrder: Number.parseInt(payload.bracketOrder || 0, 10),
  }
}

// Create match (Admin only)
router.post(
  '/',
  verifyToken,
  [
    body('tournamentId').trim().notEmpty().withMessage('Tournament is required'),
    body('teamASquadId').trim().notEmpty().withMessage('Team A is required'),
    body('teamBSquadId').trim().notEmpty().withMessage('Team B is required'),
    body('date').notEmpty().withMessage('Date is required'),
    body('time').notEmpty().withMessage('Time is required'),
    body('oversLimit').optional().isInt({ min: 1, max: 50 }).withMessage('Overs must be between 1 and 50'),
    body('venue').optional().trim(),
    body('stage').optional().isString(),
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

      // Verify tournament exists
      const tournamentRef = db.collection('tournaments').doc(req.body.tournamentId)
      const tournamentDoc = await tournamentRef.get()
      
      if (!tournamentDoc.exists) {
        return res.status(400).json({
          success: false,
          error: 'Tournament not found',
        })
      }

      // Verify squads exist and belong to tournament
      const squadARef = db.collection('squads').doc(req.body.teamASquadId)
      const squadADoc = await squadARef.get()
      
      if (!squadADoc.exists) {
        return res.status(400).json({
          success: false,
          error: 'Team A squad not found',
        })
      }

      const squadAData = squadADoc.data()
      const tournamentData = tournamentDoc.data()
      
      // Check if squad belongs to tournament (multiple ways)
      const squadABelongsToTournament = 
        squadAData.tournamentId === req.body.tournamentId ||
        (tournamentData.participantSquads && 
         tournamentData.participantSquads.some(p => (p.squadId || p.id) === req.body.teamASquadId)) ||
        (tournamentData.groupStage?.enabled && 
         tournamentData.groupStage.groups?.some(group => 
           group.squads?.some(s => (s.squadId || s.id) === req.body.teamASquadId)
         ))

      if (!squadABelongsToTournament) {
        return res.status(400).json({
          success: false,
          error: 'Team A does not belong to selected tournament',
        })
      }

      const squadBRef = db.collection('squads').doc(req.body.teamBSquadId)
      const squadBDoc = await squadBRef.get()
      
      if (!squadBDoc.exists) {
        return res.status(400).json({
          success: false,
          error: 'Team B squad not found',
        })
      }

      const squadBData = squadBDoc.data()
      
      // Check if squad belongs to tournament (multiple ways)
      const squadBBelongsToTournament = 
        squadBData.tournamentId === req.body.tournamentId ||
        (tournamentData.participantSquads && 
         tournamentData.participantSquads.some(p => (p.squadId || p.id) === req.body.teamBSquadId)) ||
        (tournamentData.groupStage?.enabled && 
         tournamentData.groupStage.groups?.some(group => 
           group.squads?.some(s => (s.squadId || s.id) === req.body.teamBSquadId)
         ))

      if (!squadBBelongsToTournament) {
        return res.status(400).json({
          success: false,
          error: 'Team B does not belong to selected tournament',
        })
      }

      // ICC Rule: Validate Team A and Team B are different
      if (req.body.teamASquadId === req.body.teamBSquadId) {
        return res.status(400).json({
          success: false,
          error: 'Team A and Team B cannot be the same squad (ICC Rule)',
        })
      }

      // Determine initial status based on date/time
      const matchDateTime = new Date(`${req.body.date}T${req.body.time}`)
      const now = new Date()
      let initialStatus = 'Upcoming'
      
      if (matchDateTime <= now) {
        initialStatus = 'Live'
      }

      const teamAName = squadADoc.data().teamName || `Batch ${squadADoc.data().batch}`
      const teamBName = squadBDoc.data().teamName || `Batch ${squadBDoc.data().batch}`

      const oversLimit = req.body.oversLimit ? parseInt(req.body.oversLimit, 10) : 10

      const stageInfo = normaliseStagePayload(req.body)

      const validTossDecisions = ['bat', 'bowl', 'field']
      let tossWinnerSquadId = ''
      let tossWinnerName = ''
      let tossDecision = ''

      if (req.body.tossWinnerSquadId) {
        if (![req.body.teamASquadId, req.body.teamBSquadId].includes(req.body.tossWinnerSquadId)) {
          return res.status(400).json({
            success: false,
            error: 'Toss winner must be one of the participating squads',
          })
        }
        const rawDecision = (req.body.tossDecision || '').toString().toLowerCase()
        const normalisedDecision = rawDecision === 'field' ? 'bowl' : rawDecision
        if (!validTossDecisions.includes(normalisedDecision)) {
          return res.status(400).json({
            success: false,
            error: 'Toss decision must be either "bat" or "bowl"',
          })
        }
        tossWinnerSquadId = req.body.tossWinnerSquadId
        tossDecision = normalisedDecision === 'field' ? 'bowl' : normalisedDecision
        const winningSquadDoc =
          tossWinnerSquadId === req.body.teamASquadId ? squadADoc : squadBDoc
        tossWinnerName =
          winningSquadDoc.data().teamName ||
          (winningSquadDoc.data().batch ? `Batch ${winningSquadDoc.data().batch}` : 'Toss Winner')
      }

      const matchData = {
        team1: teamAName,
        team2: teamBName,
        teamA: teamAName, // Alias for compatibility
        teamB: teamBName, // Alias for compatibility
        teamASquadId: req.body.teamASquadId,
        teamBSquadId: req.body.teamBSquadId,
        date: req.body.date,
        time: req.body.time,
        matchDateTime: matchDateTime.toISOString(),
        venue: req.body.venue || 'Main Ground',
        format: req.body.format || 'T20',
        tournamentId: req.body.tournamentId,
        status: initialStatus,
        // Score object structure
        score: {
          teamA: {
            runs: 0,
            wickets: 0,
            overs: '0.0',
            balls: 0,
          },
          teamB: {
            runs: 0,
            wickets: 0,
            overs: '0.0',
            balls: 0,
          },
        },
        // Legacy score fields for backward compatibility
        score1: '0/0',
        score2: '0/0',
        runs1: 0,
        runs2: 0,
        wickets1: 0,
        wickets2: 0,
        overs1: '0.0',
        overs2: '0.0',
        balls1: 0,
        balls2: 0,
        currentBatting: teamAName,
        currentStrikerId: '',
        nonStrikerId: '',
        currentBowlerId: '',
        partnership: {
          runs: 0,
          balls: 0,
        },
        freeHit: false,
        innings: 'teamA', // teamA or teamB
        oversLimit,
        teamAPlayingXI: [],
        teamBPlayingXI: [],
        teamALineupSet: false,
        teamBLineupSet: false,
        teamACaptainId: '',
        teamAKeeperId: '',
        teamBCaptainId: '',
        teamBKeeperId: '',
        fallOfWickets: [],
        lastOverBowlerId: '',
        pendingBowlerChange: false,
        ballEventsCount: 0,
        commentary: [], // Commentary array (also stored as subcollection)
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: req.user.email,
        stage: stageInfo.stage,
        stageLabel: stageInfo.stageLabel,
        bracketPosition: stageInfo.bracketPosition,
        bracketOrder: stageInfo.bracketOrder,
        isFinal: stageInfo.stage === 'final',
        winnerSquadId: '',
        loserSquadId: '',
        championRecorded: false,
        matchPhase: 'FirstInnings',
        targetRuns: null,
        inningsBreakMessage: '',
        resultSummary: '',
        tossWinnerSquadId,
        tossWinnerName,
        tossDecision,
        tossSetAt: tossWinnerSquadId ? new Date() : null,
      }

      const docRef = await db.collection('matches').add(matchData)

      matchData.tournamentName = tournamentDoc.data().name
      matchData.teamAName = teamAName
      matchData.teamBName = teamBName

      res.status(201).json({
        success: true,
        data: {
          id: docRef.id,
          ...matchData,
        },
      })
    } catch (error) {
      console.error('Error creating match:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to create match',
      })
    }
  }
)

// Update match status (Manual update - allows setting to "Finished" or any status)
router.put('/:id/status', verifyToken, async (req, res) => {
  try {
    const matchRef = db.collection('matches').doc(req.params.id)
    const doc = await matchRef.get()

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Match not found',
      })
    }

    const newStatus = req.body.status
    const validStatuses = ['Upcoming', 'Live', 'Completed', 'Finished']
    
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      })
    }

    const updateData = {
      status: newStatus,
      updatedAt: new Date(),
      updatedBy: req.user.email,
    }

    // If manually setting to Finished/Completed, ensure it's marked as manually ended
    if (newStatus === 'Finished' || newStatus === 'Completed') {
      updateData.manuallyEnded = true
      updateData.endedAt = new Date()
    }

    await matchRef.update(updateData)

    const updatedDoc = await matchRef.get()

    console.log(`✅ Match ${req.params.id} status updated to ${newStatus} by ${req.user.email}`)

    if (['Finished', 'Completed'].includes(newStatus)) {
      await recordChampionIfNeeded(updatedDoc)
    }

    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...updatedDoc.data(),
      },
    })
  } catch (error) {
    console.error('Error updating match status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update match status',
    })
  }
})

// Auto-update match statuses (checks all matches and updates status based on time)
router.post('/auto-update-status', verifyToken, async (req, res) => {
  try {
    const now = new Date()
    const matchesRef = db.collection('matches')
    const snapshot = await matchesRef.where('status', 'in', ['Upcoming', 'Live']).get()

    const updates = []
    snapshot.forEach((doc) => {
      const matchData = doc.data()
      const matchDateTime = matchData.matchDateTime 
        ? new Date(matchData.matchDateTime)
        : new Date(`${matchData.date}T${matchData.time}`)

      if (matchData.status === 'Upcoming' && matchDateTime <= now) {
        updates.push({
          id: doc.id,
          oldStatus: matchData.status,
          newStatus: 'Live',
        })
        doc.ref.update({
          status: 'Live',
          updatedAt: new Date(),
        })
      }
    })

    res.json({
      success: true,
      message: `Updated ${updates.length} match(es)`,
      updates,
    })
  } catch (error) {
    console.error('Error auto-updating match statuses:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to auto-update match statuses',
    })
  }
})

// Update match score (Admin only)
router.put(
  '/:id/score',
  verifyToken,
  [
    body('score1').optional(),
    body('score2').optional(),
    body('runs1').optional().isInt({ min: 0 }),
    body('runs2').optional().isInt({ min: 0 }),
    body('wickets1').optional().isInt({ min: 0, max: 10 }),
    body('wickets2').optional().isInt({ min: 0, max: 10 }),
    body('overs1').optional(),
    body('overs2').optional(),
    body('status').optional().isIn(['Upcoming', 'Live', 'Completed', 'Finished']),
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

      const matchRef = db.collection('matches').doc(req.params.id)
      const doc = await matchRef.get()

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Match not found',
        })
      }

      const updateData = {
        ...req.body,
        updatedAt: new Date(),
        updatedBy: req.user.email,
      }

      if (req.body.stage) {
        try {
          const stageInfo = normaliseStagePayload(req.body)
          updateData.stage = stageInfo.stage
          updateData.stageLabel = stageInfo.stageLabel
          updateData.bracketPosition = stageInfo.bracketPosition
          updateData.bracketOrder = stageInfo.bracketOrder
          updateData.isFinal = stageInfo.stage === 'final'
        } catch (stageError) {
          return res.status(400).json({
            success: false,
            error: stageError.message,
          })
        }
      }

      await matchRef.update(updateData)

      const updatedDoc = await matchRef.get()
      const resultingStatus = updateData.status || updatedDoc.data().status

      if (['Finished', 'Completed'].includes(resultingStatus)) {
        await syncPlayerStatsForMatch(updatedDoc)
        await recordChampionIfNeeded(updatedDoc)
      } else {
        await recordChampionIfNeeded(updatedDoc)
      }

      res.json({
        success: true,
        data: {
          id: updatedDoc.id,
          ...updatedDoc.data(),
        },
      })
    } catch (error) {
      console.error('Error updating match score:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to update match score',
      })
    }
  }
)

// Add commentary (Admin only)
router.post(
  '/:id/commentary',
  verifyToken,
  [
    body('text').trim().notEmpty().withMessage('Commentary text is required'),
    body('over').optional(),
    body('ball').optional().isInt({ min: 1, max: 6 }),
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

      const matchRef = db.collection('matches').doc(req.params.id)
      const doc = await matchRef.get()

      if (!doc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Match not found',
        })
      }

      const commentaryData = {
        text: req.body.text,
        batsman: req.body.batsman || '',
        bowler: req.body.bowler || '',
        over: req.body.over || '0.0',
        ball: req.body.ball || 1,
        runs: req.body.runs || 0,
        isWicket: req.body.isWicket || false,
        isBoundary: req.body.isBoundary || false,
        timestamp: new Date(),
        addedBy: req.user.email,
      }

      const commentaryRef = await matchRef.collection('commentary').add(commentaryData)

      res.status(201).json({
        success: true,
        data: {
          id: commentaryRef.id,
          ...commentaryData,
        },
      })
    } catch (error) {
      console.error('Error adding commentary:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to add commentary',
      })
    }
  }
)

// Update match (Admin only)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const matchRef = db.collection('matches').doc(req.params.id)
    const doc = await matchRef.get()

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Match not found',
      })
    }

    const matchData = doc.data()

    const updateData = {
      ...req.body,
      updatedAt: new Date(),
      updatedBy: req.user.email,
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'tossWinnerSquadId') || Object.prototype.hasOwnProperty.call(req.body, 'tossDecision')) {
      const teamASquadId = matchData.teamASquadId
      const teamBSquadId = matchData.teamBSquadId
      const validIds = [teamASquadId, teamBSquadId]

      const requestedWinnerId =
        req.body.tossWinnerSquadId !== undefined
          ? req.body.tossWinnerSquadId
          : matchData.tossWinnerSquadId || ''

      if (!requestedWinnerId) {
        updateData.tossWinnerSquadId = ''
        updateData.tossWinnerName = ''
        updateData.tossDecision = ''
        updateData.tossSetAt = null
      } else {
        if (!validIds.includes(requestedWinnerId)) {
          return res.status(400).json({
            success: false,
            error: 'Toss winner must be one of the participating squads',
          })
        }

        const rawDecision =
          req.body.tossDecision !== undefined
            ? req.body.tossDecision
            : matchData.tossDecision
        const decisionNormalised = (rawDecision || '').toString().toLowerCase() === 'field'
          ? 'bowl'
          : (rawDecision || '').toString().toLowerCase()

        if (!decisionNormalised) {
          return res.status(400).json({
            success: false,
            error: 'Toss decision is required when setting toss winner',
          })
        }

        if (!['bat', 'bowl'].includes(decisionNormalised)) {
          return res.status(400).json({
            success: false,
            error: 'Toss decision must be either "bat" or "bowl"',
          })
        }

        const winnerDoc = await db.collection('squads').doc(requestedWinnerId).get()
        if (!winnerDoc.exists) {
          return res.status(400).json({
            success: false,
            error: 'Toss winner squad not found',
          })
        }

        const winnerData = winnerDoc.data()
        const winnerName =
          winnerData.teamName ||
          (winnerData.batch ? `Batch ${winnerData.batch}` : 'Toss Winner')

        updateData.tossWinnerSquadId = requestedWinnerId
        updateData.tossWinnerName = winnerName
        updateData.tossDecision = decisionNormalised
        updateData.tossSetAt = new Date()
      }
    }

      await matchRef.update(updateData)

      const updatedDoc = await matchRef.get()

      res.json({
        success: true,
        data: {
          id: updatedDoc.id,
          ...updatedDoc.data(),
        },
      })
  } catch (error) {
    console.error('Error updating match:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update match',
    })
  }
})

/**
 * Remove match stats from all players who played in this match
 */
const removeMatchStatsFromPlayers = async (matchId) => {
  try {
    // Get all players
    const playersSnapshot = await db.collection('players').get()
    const updatePromises = []

    for (const playerDoc of playersSnapshot.docs) {
      const playerData = playerDoc.data()
      const pastMatches = Array.isArray(playerData.pastMatches) ? [...playerData.pastMatches] : []

      // Find and remove the match from pastMatches
      const matchIndex = pastMatches.findIndex(
        (match) => match?.matchId === matchId || match?.id === matchId
      )

      if (matchIndex >= 0) {
        // Remove the match from pastMatches
        pastMatches.splice(matchIndex, 1)

        // Recalculate stats without this match
        const aggregatedStats = aggregateCareerStats(pastMatches)

        // Update player document
        updatePromises.push(
          db.collection('players').doc(playerDoc.id).update({
            pastMatches,
            stats: aggregatedStats,
            matchStats: aggregatedStats,
            updatedAt: new Date(),
            updatedBy: 'match-delete',
          })
        )
      }
    }

    await Promise.all(updatePromises)
    console.log(`Removed match ${matchId} stats from ${updatePromises.length} players`)
  } catch (error) {
    console.error('Error removing match stats from players:', error)
    throw error
  }
}

// Delete match (Admin only)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const matchRef = db.collection('matches').doc(req.params.id)
    const doc = await matchRef.get()

    if (!doc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Match not found',
      })
    }

    const matchId = req.params.id

    // Remove match stats from all players
    await removeMatchStatsFromPlayers(matchId)

    // Delete commentary subcollection
    const commentarySnapshot = await matchRef.collection('commentary').get()
    const deletePromises = commentarySnapshot.docs.map((commentDoc) => commentDoc.ref.delete())
    await Promise.all(deletePromises)

    // Delete innings subcollections
    const inningsRefs = ['teamA', 'teamB']
    for (const inningId of inningsRefs) {
      const inningRef = matchRef.collection('innings').doc(inningId)
      const inningDoc = await inningRef.get()
      if (inningDoc.exists) {
        // Delete balls subcollection
        const ballsSnapshot = await inningRef.collection('balls').get()
        const ballDeletePromises = ballsSnapshot.docs.map((ballDoc) => ballDoc.ref.delete())
        await Promise.all(ballDeletePromises)
        // Delete innings document
        await inningRef.delete()
      }
    }

    // Delete match
    await matchRef.delete()

    res.json({
      success: true,
      message: 'Match deleted successfully and player stats updated',
    })
  } catch (error) {
    console.error('Error deleting match:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete match',
    })
  }
})

export default router

