/**
 * Centralized Statistics Calculator
 * All stat calculations for players, teams, and matches
 */

/**
 * Calculate batting average
 */
export const calculateBattingAverage = (runs, dismissals) => {
  if (!dismissals || dismissals === 0) return runs > 0 ? runs.toFixed(2) : '0.00'
  return (runs / dismissals).toFixed(2)
}

/**
 * Calculate strike rate
 */
export const calculateStrikeRate = (runs, balls) => {
  if (!balls || balls === 0) return '0.00'
  return ((runs / balls) * 100).toFixed(2)
}

/**
 * Calculate bowling average
 */
export const calculateBowlingAverage = (runsConceded, wickets) => {
  if (!wickets || wickets === 0) return runsConceded > 0 ? '∞' : '0.00'
  return (runsConceded / wickets).toFixed(2)
}

/**
 * Calculate economy rate
 */
export const calculateEconomy = (runsConceded, overs) => {
  if (!overs || overs === 0) return '0.00'
  const oversDecimal = parseFloat(overs) || 0
  return (runsConceded / oversDecimal).toFixed(2)
}

/**
 * Calculate bowling strike rate
 */
export const calculateBowlingStrikeRate = (balls, wickets) => {
  if (!wickets || wickets === 0) return balls > 0 ? '∞' : '0.00'
  return (balls / wickets).toFixed(2)
}

/**
 * Convert balls to overs (e.g., 18 balls = 3.0 overs)
 */
export const ballsToOvers = (balls = 0) => {
  const totalBalls = Number.isFinite(balls) ? balls : 0
  const overs = Math.floor(totalBalls / 6)
  const remainingBalls = totalBalls % 6
  return `${overs}.${remainingBalls}`
}

/**
 * Convert overs string to balls (e.g., "3.2" = 20 balls)
 */
export const oversToBalls = (oversValue = '0.0') => {
  if (oversValue === undefined || oversValue === null) return 0
  const value = typeof oversValue === 'number' ? oversValue.toString() : oversValue
  const [oversPart, ballsPart] = value.split('.')
  const oversInt = Number.parseInt(oversPart || '0', 10)
  const ballsInt = Number.parseInt(ballsPart || '0', 10)
  return oversInt * 6 + ballsInt
}

/**
 * Calculate Net Run Rate (NRR)
 */
export const calculateNRR = (runsScored, oversFaced, runsConceded, oversBowled) => {
  const oversFacedDecimal = parseFloat(oversFaced) || 0
  const oversBowledDecimal = parseFloat(oversBowled) || 0

  if (oversFacedDecimal === 0 && oversBowledDecimal === 0) return '0.000'

  const runRateFor = oversFacedDecimal > 0 ? runsScored / oversFacedDecimal : 0
  const runRateAgainst = oversBowledDecimal > 0 ? runsConceded / oversBowledDecimal : 0

  const nrr = runRateFor - runRateAgainst
  return nrr.toFixed(3)
}

/**
 * Calculate team points (2 for win, 1 for tie, 0 for loss)
 */
export const calculatePoints = (wins, ties) => {
  return wins * 2 + ties
}

/**
 * Calculate player's career stats from match performances
 */
export const calculatePlayerCareerStats = (matchPerformances = []) => {
  const stats = {
    matches: 0,
    innings: 0,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    notOuts: 0,
    dismissals: 0,
    highestScore: 0,
    wickets: 0,
    runsConceded: 0,
    overs: 0,
    maidens: 0,
    wides: 0,
    noBalls: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
  }

  matchPerformances.forEach((performance) => {
    // Batting stats
    if (performance.batting) {
      stats.matches++
      if (performance.batting.runs !== undefined) {
        stats.innings++
        stats.runs += performance.batting.runs || 0
        stats.balls += performance.batting.balls || 0
        stats.fours += performance.batting.fours || 0
        stats.sixes += performance.batting.sixes || 0

        if (performance.batting.runs > stats.highestScore) {
          stats.highestScore = performance.batting.runs
        }

        if (performance.batting.dismissed) {
          stats.dismissals++
        } else {
          stats.notOuts++
        }
      }
    }

    // Bowling stats
    if (performance.bowling) {
      stats.wickets += performance.bowling.wickets || 0
      stats.runsConceded += performance.bowling.runsConceded || 0
      stats.overs += oversToBalls(performance.bowling.overs || '0.0')
      stats.maidens += performance.bowling.maidens || 0
      stats.wides += performance.bowling.wides || 0
      stats.noBalls += performance.bowling.noBalls || 0
    }

    // Fielding stats
    if (performance.fielding) {
      stats.catches += performance.fielding.catches || 0
      stats.stumpings += performance.fielding.stumpings || 0
      stats.runOuts += performance.fielding.runOuts || 0
    }
  })

  // Calculate derived stats
  const battingAverage = calculateBattingAverage(stats.runs, stats.dismissals)
  const strikeRate = calculateStrikeRate(stats.runs, stats.balls)
  const bowlingAverage = calculateBowlingAverage(stats.runsConceded, stats.wickets)
  const economy = calculateEconomy(stats.runsConceded, ballsToOvers(stats.overs))
  const bowlingStrikeRate = calculateBowlingStrikeRate(stats.overs, stats.wickets)

  return {
    ...stats,
    overs: ballsToOvers(stats.overs),
    battingAverage,
    strikeRate,
    bowlingAverage,
    economy,
    bowlingStrikeRate,
  }
}

/**
 * Calculate tournament points table
 */
export const calculatePointsTable = (squads = [], matches = []) => {
  const table = squads.map((squad) => {
    const squadMatches = matches.filter(
      (m) =>
        (m.teamASquadId === squad.id || m.teamBSquadId === squad.id) &&
        m.status === 'finished'
    )

    let wins = 0
    let losses = 0
    let ties = 0
    let runsScored = 0
    let oversFaced = 0
    let runsConceded = 0
    let oversBowled = 0

    squadMatches.forEach((match) => {
      const isTeamA = match.teamASquadId === squad.id
      const teamAScore = match.score?.teamA || {}
      const teamBScore = match.score?.teamB || {}

      if (isTeamA) {
        runsScored += teamAScore.runs || 0
        oversFaced += oversToBalls(teamAScore.overs || '0.0')
        runsConceded += teamBScore.runs || 0
        oversBowled += oversToBalls(teamBScore.overs || '0.0')

        if (match.winnerSquadId === squad.id) {
          wins++
        } else if (match.winnerSquadId === match.teamBSquadId) {
          losses++
        } else {
          ties++
        }
      } else {
        runsScored += teamBScore.runs || 0
        oversFaced += oversToBalls(teamBScore.overs || '0.0')
        runsConceded += teamAScore.runs || 0
        oversBowled += oversToBalls(teamAScore.overs || '0.0')

        if (match.winnerSquadId === squad.id) {
          wins++
        } else if (match.winnerSquadId === match.teamASquadId) {
          losses++
        } else {
          ties++
        }
      }
    })

    const points = calculatePoints(wins, ties)
    const nrr = calculateNRR(
      runsScored,
      ballsToOvers(oversFaced),
      runsConceded,
      ballsToOvers(oversBowled)
    )
    const played = wins + losses + ties

    return {
      squadId: squad.id,
      squadName: squad.name,
      played,
      wins,
      losses,
      ties,
      points,
      nrr: parseFloat(nrr),
      runsScored,
      runsConceded,
    }
  })

  // Sort by points (desc), then by NRR (desc)
  return table.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return b.nrr - a.nrr
  })
}

/**
 * Calculate Fantasy points for a player
 */
export const calculateFantasyPoints = (stats) => {
  if (!stats) return 0

  const runs = Number(stats.batting?.runs || stats.runs || 0)
  const fours = Number(stats.batting?.fours || stats.fours || 0)
  const sixes = Number(stats.batting?.sixes || stats.sixes || 0)
  const fifties = Number(stats.batting?.fifties || stats.fifties || 0)
  const hundreds = Number(stats.batting?.hundreds || stats.hundreds || 0)
  const wickets = Number(stats.bowling?.wickets || stats.wickets || 0)
  const maidens = Number(stats.bowling?.maidens || stats.maidens || 0)
  const catches = Number(stats.fielding?.catches || stats.catches || 0)
  const stumpings = Number(stats.fielding?.stumpings || stats.stumpings || 0)
  const runOuts = Number(stats.fielding?.runOuts || stats.runOuts || 0)

  // Standard Fantasy Point System
  const points =
    (runs * 1) +                  // 1 pt per run
    (fours * 1) +                 // +1 pt per boundary
    (sixes * 2) +                 // +2 pt per six
    (fifties * 8) +               // +8 pt per half century
    (hundreds * 16) +             // +16 pt per century
    (wickets * 25) +              // 25 pts per wicket
    (maidens * 12) +              // 12 pts per maiden
    (catches * 8) +               // 8 pts per catch
    (stumpings * 12) +            // 12 pts per stumping
    (runOuts * 6)                 // 6 pts per run-out

  return Math.round(points)
}

