/**
 * Cricket Statistics Calculator
 * Centralized stat calculations using ICC rule engine
 */

import {
  formatOvers,
  parseOvers,
  calculateStrikeRate,
  calculateBattingAverage,
  calculateBowlingAverage,
  calculateBowlingStrikeRate,
  calculateEconomy,
} from '../iccEngine/ruleEngine'

/**
 * Calculate player's career batting stats
 */
export const calculateBattingStats = (matchPerformances = []) => {
  const stats = {
    matches: 0,
    innings: 0,
    notOuts: 0,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    highestScore: 0,
    dismissals: 0,
  }

  matchPerformances.forEach((performance) => {
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
  })

  return {
    ...stats,
    average: calculateBattingAverage(stats.runs, stats.dismissals),
    strikeRate: calculateStrikeRate(stats.runs, stats.balls),
  }
}

/**
 * Calculate player's career bowling stats
 */
export const calculateBowlingStats = (matchPerformances = []) => {
  const stats = {
    matches: 0,
    innings: 0,
    overs: 0,
    runsConceded: 0,
    wickets: 0,
    maidens: 0,
    wides: 0,
    noBalls: 0,
    bestFigures: { wickets: 0, runs: Infinity },
  }

  matchPerformances.forEach((performance) => {
    if (performance.bowling) {
      stats.matches++
      stats.innings++
      stats.overs += parseOvers(performance.bowling.overs || '0.0')
      stats.runsConceded += performance.bowling.runsConceded || 0
      stats.wickets += performance.bowling.wickets || 0
      stats.maidens += performance.bowling.maidens || 0
      stats.wides += performance.bowling.wides || 0
      stats.noBalls += performance.bowling.noBalls || 0

      // Best figures (most wickets, then least runs)
      if (
        performance.bowling.wickets > stats.bestFigures.wickets ||
        (performance.bowling.wickets === stats.bestFigures.wickets &&
          performance.bowling.runsConceded < stats.bestFigures.runs)
      ) {
        stats.bestFigures = {
          wickets: performance.bowling.wickets,
          runs: performance.bowling.runsConceded,
        }
      }
    }
  })

  return {
    ...stats,
    overs: formatOvers(stats.overs),
    average: calculateBowlingAverage(stats.runsConceded, stats.wickets),
    economy: calculateEconomy(stats.runsConceded, formatOvers(stats.overs)),
    strikeRate: calculateBowlingStrikeRate(stats.overs, stats.wickets),
    bestFigures: `${stats.bestFigures.wickets}/${stats.bestFigures.runs}`,
  }
}

/**
 * Calculate player's fielding stats
 */
export const calculateFieldingStats = (matchPerformances = []) => {
  const stats = {
    matches: 0,
    catches: 0,
    stumpings: 0,
    runOuts: 0,
  }

  matchPerformances.forEach((performance) => {
    if (performance.fielding) {
      stats.matches++
      stats.catches += performance.fielding.catches || 0
      stats.stumpings += performance.fielding.stumpings || 0
      stats.runOuts += performance.fielding.runOuts || 0
    }
  })

  return {
    ...stats,
    totalDismissals: stats.catches + stats.stumpings + stats.runOuts,
  }
}

/**
 * Calculate complete player career stats
 */
export const calculatePlayerCareerStats = (matchPerformances = []) => {
  const batting = calculateBattingStats(matchPerformances)
  const bowling = calculateBowlingStats(matchPerformances)
  const fielding = calculateFieldingStats(matchPerformances)

  return {
    batting,
    bowling,
    fielding,
    matches: Math.max(batting.matches, bowling.matches, fielding.matches),
  }
}

/**
 * Calculate team's Net Run Rate (NRR)
 */
export const calculateNRR = (runsScored, oversFaced, runsConceded, oversBowled) => {
  const oversFacedDecimal = parseOvers(oversFaced)
  const oversBowledDecimal = parseOvers(oversBowled)

  if (oversFacedDecimal === 0 && oversBowledDecimal === 0) return 0

  const runRateFor = oversFacedDecimal > 0 ? runsScored / oversFacedDecimal : 0
  const runRateAgainst = oversBowledDecimal > 0 ? runsConceded / oversBowledDecimal : 0

  return runRateFor - runRateAgainst
}

/**
 * Calculate tournament points table
 */
export const calculatePointsTable = (squads = [], matches = []) => {
  return squads.map((squad) => {
    const squadMatches = matches.filter(
      (m) =>
        (m.teamASquadId === squad.id || m.teamBSquadId === squad.id) &&
        m.status === 'finished'
    )

    let wins = 0
    let losses = 0
    let ties = 0
    let noResults = 0
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
        oversFaced += parseOvers(teamAScore.overs || '0.0')
        runsConceded += teamBScore.runs || 0
        oversBowled += parseOvers(teamBScore.overs || '0.0')

        if (match.winnerSquadId === squad.id) {
          wins++
        } else if (match.winnerSquadId === match.teamBSquadId) {
          losses++
        } else if (match.resultSummary?.includes('tied')) {
          ties++
        } else {
          noResults++
        }
      } else {
        runsScored += teamBScore.runs || 0
        oversFaced += parseOvers(teamBScore.overs || '0.0')
        runsConceded += teamAScore.runs || 0
        oversBowled += parseOvers(teamAScore.overs || '0.0')

        if (match.winnerSquadId === squad.id) {
          wins++
        } else if (match.winnerSquadId === match.teamASquadId) {
          losses++
        } else if (match.resultSummary?.includes('tied')) {
          ties++
        } else {
          noResults++
        }
      }
    })

    const points = wins * 2 + ties
    const nrr = calculateNRR(
      runsScored,
      formatOvers(oversFaced),
      runsConceded,
      formatOvers(oversBowled)
    )
    const played = wins + losses + ties + noResults

    return {
      squadId: squad.id,
      squadName: squad.name,
      played,
      wins,
      losses,
      ties,
      noResults,
      points,
      nrr: parseFloat(nrr.toFixed(3)),
      runsScored,
      runsConceded,
    }
  })
}

export default {
  calculateBattingStats,
  calculateBowlingStats,
  calculateFieldingStats,
  calculatePlayerCareerStats,
  calculateNRR,
  calculatePointsTable,
}

