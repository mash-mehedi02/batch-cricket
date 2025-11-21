import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { subscribeToMatch, subscribeToCommentary } from '../services/matchesService'
import { playersAPI, squadsAPI } from '../services/api'
import RecentOvers from '../components/RecentOvers'
import ManhattanGraph from '../components/graphs/ManhattanGraph'

const EXTRA_TYPES = {
  NO_BALL: 'no-ball',
  WIDE: 'wide',
  LEG_BYE: 'leg-bye',
  BYE: 'bye',
}

const ballsToOvers = (balls = 0) => {
  const totalBalls = Number.isFinite(balls) ? balls : 0
  const overs = Math.floor(totalBalls / 6)
  const remaining = totalBalls % 6
  return `${overs}.${remaining}`
}

const formatStrikeRate = (runs = 0, balls = 0) => {
  if (!balls) return '0.0'
  const value = ((runs / balls) * 100).toFixed(1)
  return Number.isNaN(Number(value)) ? '0.0' : value
}

const getRunRate = (runs, balls) => {
  if (!balls || balls === 0) return null
  const runRate = runs / (balls / 6)
  return Number.isFinite(runRate) ? runRate.toFixed(2) : null
}

// Extract first name from full name
const getFirstName = (fullName) => {
  if (!fullName) return ''
  return fullName.trim().split(' ')[0]
}

// Format dismissal text to show only first names
const formatDismissalText = (dismissalText) => {
  if (!dismissalText) return ''
  
  let formatted = dismissalText
  
  // Pattern: "c [Name] b [Name]" - catch by fielder, bowled by bowler
  formatted = formatted.replace(/\bc\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+b\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g, (match, fielder, bowler) => {
    return `c ${getFirstName(fielder)} b ${getFirstName(bowler)}`
  })
  
  // Pattern: "st [Name] b [Name]" - stumped by keeper, bowled by bowler
  formatted = formatted.replace(/\bst\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+b\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi, (match, keeper, bowler) => {
    return `st ${getFirstName(keeper)} b ${getFirstName(bowler)}`
  })
  
  // Pattern: "b [Name]" - bowled by bowler (no fielder)
  formatted = formatted.replace(/\bb\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?!\s+b\s)/g, (match, bowler) => {
    return `b ${getFirstName(bowler)}`
  })
  
  // Pattern: "lbw [Name]" - leg before wicket
  formatted = formatted.replace(/\blbw\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi, (match, bowler) => {
    return `lbw ${getFirstName(bowler)}`
  })
  
  // Pattern: "run out ([Name])" or "run out [Name]"
  formatted = formatted.replace(/\brun\s+out\s*(?:\(([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\)|([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+))/gi, (match, nameInParens, nameWithoutParens) => {
    const name = nameInParens || nameWithoutParens
    return nameInParens ? `run out (${getFirstName(name)})` : `run out ${getFirstName(name)}`
  })
  
  // Pattern: "hit wicket b [Name]"
  formatted = formatted.replace(/\bhit\s+wicket\s+b\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/gi, (match, bowler) => {
    return `hit wicket b ${getFirstName(bowler)}`
  })
  
  return formatted
}

const oversToBalls = (oversValue = '0.0') => {
  if (oversValue === undefined || oversValue === null) return 0
  const value = typeof oversValue === 'number' ? oversValue.toString() : oversValue
  const [oversPart, ballsPart] = value.split('.')
  const oversInt = Number.parseInt(oversPart || '0', 10)
  const ballsInt = Number.parseInt(ballsPart || '0', 10)
  return oversInt * 6 + ballsInt
}

const LiveMatch = () => {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('live')
  const [matchData, setMatchData] = useState(null)
  const [commentary, setCommentary] = useState([])
  const [teamASquad, setTeamASquad] = useState([])
  const [teamBSquad, setTeamBSquad] = useState([])
  const [teamAPlayers, setTeamAPlayers] = useState([])
  const [teamBPlayers, setTeamBPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedScoreboardTeam, setSelectedScoreboardTeam] = useState('teamA')
  const commentaryEndRef = useRef(null)

  const playersById = useMemo(() => {
    const map = new Map()
    teamAPlayers.forEach((player) => {
      map.set(player.id, { ...player, team: 'teamA' })
    })
    teamBPlayers.forEach((player) => {
      map.set(player.id, { ...player, team: 'teamB' })
    })
    return map
  }, [teamAPlayers, teamBPlayers])

  const derivedMatchInfo = useMemo(() => {
    if (!matchData) {
      return {
        teamAPlayingXI: [],
        teamBPlayingXI: [],
        striker: null,
        nonStriker: null,
        currentBowler: null,
        currentInnings: 'teamA',
        currentScore: { runs: 0, wickets: 0, balls: 0, overs: '0.0' },
        teamAScore: { runs: 0, wickets: 0, balls: 0, overs: '0.0' },
        teamBScore: { runs: 0, wickets: 0, balls: 0, overs: '0.0' },
        runRate: null,
        partnership: { runs: 0, balls: 0 },
        partnershipOvers: '0.0',
        chase: null,
        fallOfWicketsByTeam: { teamA: [], teamB: [] },
        fallOfWicketsMap: new Map(),
      }
    }

    const sortLineup = (lineup = []) =>
      [...lineup].sort((a, b) => (a.battingPosition ?? 999) - (b.battingPosition ?? 999))

    const teamAPlayingXI = sortLineup(matchData.teamAPlayingXI || [])
    const teamBPlayingXI = sortLineup(matchData.teamBPlayingXI || [])
    const fallOfWickets = matchData.fallOfWickets || []
    const fallOfWicketsByTeam = {
      teamA: fallOfWickets.filter((fow) => fow.team === 'teamA'),
      teamB: fallOfWickets.filter((fow) => fow.team === 'teamB'),
    }
    const fallOfWicketsMap = new Map()
    fallOfWickets.forEach((fow) => {
      if (fow?.batsmanId) {
        fallOfWicketsMap.set(fow.batsmanId, fow)
      }
    })

    const currentInnings = matchData.innings || 'teamA'
    const battingXI = currentInnings === 'teamA' ? teamAPlayingXI : teamBPlayingXI
    const bowlingXI = currentInnings === 'teamA' ? teamBPlayingXI : teamAPlayingXI

    const striker = battingXI.find((player) => player.playerId === matchData.currentStrikerId) || null
    const nonStriker =
      battingXI.find((player) => player.playerId === matchData.nonStrikerId) || null
    const currentBowler =
      bowlingXI.find((player) => player.playerId === matchData.currentBowlerId) ||
      bowlingXI.find((player) => player.bowlingActive) ||
      null

    const teamAScore = {
      runs: matchData.score?.teamA?.runs ?? matchData.runs1 ?? 0,
      wickets: matchData.score?.teamA?.wickets ?? matchData.wickets1 ?? 0,
      balls: matchData.score?.teamA?.balls ?? matchData.balls1 ?? 0,
      overs: matchData.score?.teamA?.overs ?? matchData.overs1 ?? '0.0',
    }
    const teamBScore = {
      runs: matchData.score?.teamB?.runs ?? matchData.runs2 ?? 0,
      wickets: matchData.score?.teamB?.wickets ?? matchData.wickets2 ?? 0,
      balls: matchData.score?.teamB?.balls ?? matchData.balls2 ?? 0,
      overs: matchData.score?.teamB?.overs ?? matchData.overs2 ?? '0.0',
    }

    const currentScore = currentInnings === 'teamA' ? teamAScore : teamBScore
    const runRate = currentScore.balls > 0 ? currentScore.runs / (currentScore.balls / 6) : null
    const partnership = matchData.partnership || { runs: 0, balls: 0 }
    const partnershipOvers = ballsToOvers(partnership.balls || 0)

    let chase = null
    const oversLimit = Number(matchData.oversLimit)
    const oversLimitBalls = Number.isFinite(oversLimit) && oversLimit > 0 ? oversLimit * 6 : null
    const matchPhase = matchData.matchPhase || 'FirstInnings'
    
    // ICC Rule: Target only shows in second innings (when matchPhase is SecondInnings)
    // First innings should never show target
    if (currentInnings === 'teamB' && matchData.status === 'Live' && matchPhase === 'SecondInnings') {
      // Only calculate target if Team A has completed their innings (has runs)
      if (teamAScore.runs > 0 || teamAScore.wickets >= 10) {
        const target = teamAScore.runs + 1
        const runsNeeded = target - teamBScore.runs
        const ballsRemaining = oversLimitBalls !== null ? Math.max(oversLimitBalls - teamBScore.balls, 0) : null
        const requiredRunRate =
          ballsRemaining && runsNeeded > 0 ? runsNeeded / (ballsRemaining / 6) : runsNeeded <= 0 ? 0 : null
        chase = {
          target,
          runsNeeded,
          ballsRemaining,
          requiredRunRate,
        }
      }
    }

    return {
      teamAPlayingXI,
      teamBPlayingXI,
      striker,
      nonStriker,
      currentBowler,
      currentInnings,
      currentScore,
      teamAScore,
      teamBScore,
      runRate,
      partnership,
      partnershipOvers,
      chase,
      fallOfWicketsByTeam,
      fallOfWicketsMap,
    }
  }, [matchData])

  const {
    teamAPlayingXI,
    teamBPlayingXI,
    striker,
    nonStriker,
    currentBowler,
    currentInnings,
    currentScore,
    teamAScore,
    teamBScore,
    runRate,
    partnership,
    partnershipOvers,
    chase,
    fallOfWicketsByTeam,
    fallOfWicketsMap,
  } = derivedMatchInfo

  const tossSummary = useMemo(() => {
    if (!matchData?.tossWinnerSquadId || !matchData?.tossDecision) return ''
    const winnerName =
      matchData.tossWinnerName ||
      (matchData.tossWinnerSquadId === matchData.teamASquadId
        ? matchData.teamAName || matchData.team1 || matchData.teamA
        : matchData.teamBName || matchData.team2 || matchData.teamB)
    const decision = matchData.tossDecision === 'bat' ? 'bat' : 'bowl'
    const readableDecision = decision === 'bat' ? 'bat first' : 'bowl first'
    return `${winnerName} won the toss and chose to ${readableDecision}.`
  }, [matchData])

  const renderEmptyCard = (label) => (
    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 flex items-center justify-center text-sm text-gray-500">
      {label} will appear once set
    </div>
  )

  const renderBatterCard = (player, isStriker = false) => {
    const meta = playersById.get(player.playerId) || {}
    const strikeBadgeClasses = isStriker
      ? 'bg-green-100 text-green-700'
      : player.isOnCrease
      ? 'bg-blue-100 text-blue-700'
      : 'bg-gray-100 text-gray-600'
    const containerClasses = isStriker
      ? 'border-green-200 bg-green-50'
      : player.isOnCrease
      ? 'border-blue-200 bg-blue-50'
      : 'border-gray-200 bg-white'
    const initials = player.name ? player.name.charAt(0) : '?'

    return (
      <div className={`rounded-xl border ${containerClasses} p-4 shadow-sm transition-all`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {player.photo ? (
              <img
                src={player.photo}
                alt={player.name}
                className="w-12 h-12 rounded-full object-cover border border-white shadow"
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-bold">
                {initials}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">
                  {player.name}
                </p>
                {player.isCaptain && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-semibold">
                    C
                  </span>
                )}
                {player.isKeeper && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-semibold">
                    WK
                  </span>
                )}
              </div>
              {meta.role && <p className="text-xs text-gray-500 capitalize">{meta.role}</p>}
              {player.status === 'out' && (
                <p className="text-xs text-red-600 font-medium">Out</p>
              )}
            </div>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${strikeBadgeClasses}`}>
            {isStriker ? 'On Strike' : player.isOnCrease ? 'Non-strike' : 'Bench'}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-gray-700">
          <div className="text-2xl font-bold text-gray-900">
            {player.runs || 0}
            <span className="text-sm text-gray-500"> ({player.balls || 0})</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>4s {player.fours || 0}</span>
            <span>6s {player.sixes || 0}</span>
            <span>SR {formatStrikeRate(player.runs, player.balls)}</span>
          </div>
        </div>
      </div>
    )
  }

  const renderBowlerCard = (player) => {
    const meta = playersById.get(player.playerId) || {}
    const overs = ballsToOvers(player.bowlingBalls || 0)
    const wickets = player.bowlingWickets || 0
    const runsConceded = player.bowlingRuns || 0
    const economyRaw =
      player.bowlingBalls > 0
        ? runsConceded / (player.bowlingBalls / 6)
        : typeof player.economy === 'number'
        ? player.economy
        : 0
    const economy = Number.isFinite(economyRaw) ? economyRaw.toFixed(1) : '0.0'

    return (
      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">{player.name}</p>
            {meta.role && <p className="text-xs text-gray-500 capitalize">{meta.role}</p>}
            <p className="text-xs text-purple-700 font-semibold mt-1">Current Bowler</p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-100 text-purple-700">
            Bowling
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-gray-700">
          <div className="text-xl font-semibold text-gray-900">
            {overs} ov
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>Runs {runsConceded}</span>
            <span>Wkts {wickets}</span>
            <span>Econ {economy}</span>
          </div>
        </div>
      </div>
    )
  }

  const buildBallBadge = (ball) => {
    let label = '0'
    let tone = 'bg-gray-100 text-gray-600'
    if (ball.extraType === EXTRA_TYPES.WIDE) {
      const extraRuns = Number(ball.runs || 0) - 1
      label = extraRuns > 0 ? `Wd+${extraRuns}` : 'Wd'
      tone = 'bg-blue-100 text-blue-700'
    } else if (ball.extraType === EXTRA_TYPES.NO_BALL) {
      const batAddition = Number(ball.batRuns || 0)
      label = batAddition > 0 ? `Nb+${batAddition}` : 'Nb'
      tone = 'bg-yellow-100 text-yellow-700'
    } else if (
      ball.extraType === EXTRA_TYPES.LEG_BYE ||
      ball.extraType === EXTRA_TYPES.BYE
    ) {
      const legByeRuns = Number(ball.runs || 0)
      label = legByeRuns > 0 ? `Lb${legByeRuns}` : 'Lb'
      tone = 'bg-amber-100 text-amber-700'
    } else if (ball.isWicket) {
      label = 'W'
      tone = 'bg-red-100 text-red-700'
    } else if (ball.runs === 4) {
      label = '4'
      tone = 'bg-green-100 text-green-700'
    } else if (ball.runs === 6) {
      label = '6'
      tone = 'bg-purple-100 text-purple-700'
    } else if (ball.runs > 0) {
      label = String(ball.runs)
      tone = 'bg-blue-100 text-blue-700'
    }

    const descriptionParts = []
    if (ball.over) descriptionParts.push(`Over ${ball.over}`)
    if (ball.ball) descriptionParts.push(`Ball ${ball.ball}`)
    if (ball.batsman) descriptionParts.push(ball.batsman)
    if (ball.bowler) descriptionParts.push(`b ${ball.bowler}`)
    if (ball.text) descriptionParts.push(ball.text)
    const description = descriptionParts.join(' • ')

    return { label, tone, description }
  }

  const getLineupForTeam = (teamKey) => (teamKey === 'teamA' ? teamAPlayingXI : teamBPlayingXI)

  const renderBattingTableForTeam = (teamKey) => {
    const lineup = getLineupForTeam(teamKey)
    if (!lineup || lineup.length === 0) {
      return (
        <div className="py-6 text-sm text-gray-500">
          Playing XI not set for this team yet.
        </div>
      )
    }

    return (
      <div className="mb-6">
        <h4 className="text-md font-semibold text-gray-700 mb-3">Batting</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Batsman</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">R</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">B</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">4s</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">6s</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">SR</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lineup.map((player) => {
                const fow = fallOfWicketsMap.get(player.playerId)
                let statusText = 'Did not bat'
                if (player.status === 'out') {
                  statusText =
                    player.dismissalText ||
                    (fow
                      ? `${fow.dismissalText || fow.wicketType || 'Out'} • ${fow.wicket}/${fow.runs} (${fow.over})`
                      : 'Out')
                } else if (player.status === 'retired') {
                  statusText = 'Retired hurt'
                } else if (player.isOnCrease && player.status !== 'out') {
                  // ICC Rule: Only show strike status if player is NOT out
                  statusText = player.isOnStrike ? 'Not out • striker' : 'Not out'
                } else if ((player.runs || 0) > 0 || (player.balls || 0) > 0) {
                  statusText = 'Not out'
                }
                const nameCell = (
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">
                      {player.name}
                      {player.isCaptain && <span className="text-xs text-gray-500 ml-1">(C)</span>}
                      {player.isKeeper && <span className="text-xs text-gray-500 ml-1">(WK)</span>}
                      {/* ICC Rule: Only show strike indicator if player is NOT out */}
                      {player.isOnStrike && player.status !== 'out' && <span className="text-xs text-green-600 ml-2">★</span>}
                    </span>
                    <span className="text-xs text-gray-500">{statusText}</span>
                  </div>
                )

                return (
                  <tr
                    key={player.playerId || player.name}
                    onClick={() => player.playerId && handlePlayerClick(player.playerId)}
                    className={`${player.playerId ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
                  >
                    <td className="px-4 py-2 whitespace-nowrap">{nameCell}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{player.runs ?? 0}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{player.balls ?? 0}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{player.fours ?? 0}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{player.sixes ?? 0}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">
                      {formatStrikeRate(player.runs, player.balls)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderBowlingTableForTeam = (teamKey, opponentName) => {
    const bowlingLineup = teamKey === 'teamA' ? teamBPlayingXI : teamAPlayingXI
    const bowlers = (bowlingLineup || []).filter((player) => {
      const balls = player.bowlingBalls || 0
      const runs = player.bowlingRuns || 0
      const wickets = player.bowlingWickets || 0
      return balls > 0 || runs > 0 || wickets > 0 || player.bowlingActive
    })

    if (bowlers.length === 0) {
      return (
        <div className="text-sm text-gray-500">No bowling figures yet.</div>
      )
    }

    return (
      <div>
        <h4 className="text-md font-semibold text-gray-700 mb-3">Bowling ({opponentName})</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bowler</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">O</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">R</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">W</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Econ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bowlers.map((player) => {
                const overs = ballsToOvers(player.bowlingBalls || 0)
                const economyRaw =
                  player.bowlingBalls > 0
                    ? (player.bowlingRuns || 0) / (player.bowlingBalls / 6)
                    : typeof player.economy === 'number'
                    ? player.economy
                    : 0
                const economy = Number.isFinite(economyRaw) ? economyRaw.toFixed(1) : '0.0'
                return (
                  <tr
                    key={player.playerId || player.name}
                    onClick={() => player.playerId && handlePlayerClick(player.playerId)}
                    className={`${player.playerId ? 'hover:bg-gray-50 cursor-pointer' : ''}`}
                  >
                    <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium ${player.bowlingActive ? 'text-purple-700' : 'text-gray-900'}`}>
                      {player.name}
                      {player.bowlingActive && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Current</span>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{overs}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{player.bowlingRuns || 0}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{player.bowlingWickets || 0}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{economy}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const renderInningsCard = (teamKey, teamName, teamScore, opponentName, headerClass) => {
    const inningsFall = fallOfWicketsByTeam[teamKey] || []
    const matchPhase = matchData.matchPhase || 'FirstInnings'
    const isCurrent = currentInnings === teamKey && matchData.status === 'Live'
    let statusText = 'Innings Complete'
    if (matchData.status === 'Upcoming') {
      statusText = 'Yet to Bat'
    } else if (teamScore.balls === 0 && teamKey === 'teamB' && matchPhase !== 'SecondInnings' && matchPhase !== 'Completed') {
      statusText = 'Yet to Bat'
    } else if (matchPhase === 'InningsBreak' && teamKey === 'teamB') {
      statusText = matchData.inningsBreakMessage || 'Innings Break'
    } else if (isCurrent) {
      statusText = 'Currently Batting'
    }
    if (matchData.status === 'Finished' && matchData.resultSummary) {
      statusText = teamKey === 'teamB' ? matchData.resultSummary : 'Innings Complete'
    }

    return (
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className={`${headerClass} text-white px-6 py-4`}>
          <h3 className="text-xl font-bold">{teamName}</h3>
          <div className="mt-2 text-2xl font-bold">
            {teamScore.runs}/{teamScore.wickets}
            <span className="text-lg font-normal ml-2">({teamScore.overs} overs)</span>
          </div>
        </div>
        <div className="p-6">
          <div className="text-sm text-gray-600 mb-4">{statusText}</div>
          {/* ICC Rule: Only show target in second innings */}
          {teamKey === 'teamB' && 
           matchData.matchPhase === 'SecondInnings' && 
           matchData.targetRuns && 
           matchData.status !== 'Finished' ? (
            <div className="text-sm text-gray-700 font-semibold mb-4">
              Target: {matchData.targetRuns} • Need {Math.max(matchData.targetRuns - (teamScore.runs || 0), 0)} run
              {Math.max(matchData.targetRuns - (teamScore.runs || 0), 0) === 1 ? '' : 's'} to win
            </div>
          ) : null}
          {renderBattingTableForTeam(teamKey)}
          {renderBowlingTableForTeam(teamKey, opponentName)}

          {inningsFall.length > 0 && (
            <div className="mt-6">
              <h4 className="text-md font-semibold text-gray-700 mb-3">Fall of Wickets</h4>
              <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                {inningsFall.map((fow) => (
                  <span key={fow.id} className="px-3 py-2 rounded-lg bg-gray-100">
                    {fow.wicket}/{fow.runs} ({fow.over}) — {fow.batsmanName || 'Batsman'}
                    {fow.dismissalText ? ` • ${fow.dismissalText}` : fow.wicketType ? ` • ${fow.wicketType}` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const teamAName = matchData?.teamAName || matchData?.team1 || matchData?.teamA || 'Team A'
  const teamBName = matchData?.teamBName || matchData?.team2 || matchData?.teamB || 'Team B'
  const battingTeamName = currentInnings === 'teamA' ? teamAName : teamBName
  const otherFallTeamName = currentInnings === 'teamA' ? teamBName : teamAName
  const currentFall = fallOfWicketsByTeam[currentInnings] || []
  const otherFall = fallOfWicketsByTeam[currentInnings === 'teamA' ? 'teamB' : 'teamA'] || []

  const recentBallEvents = useMemo(() => {
    if (!commentary || commentary.length === 0) return []
    return commentary.slice(-6).reverse()
  }, [commentary])

const recentBall =
    commentary && commentary.length > 0
      ? commentary[commentary.length - 1]
      : matchData?.recentBalls?.[0] || null


  const ballEventsFeed = useMemo(() => {
    // Only use recentBalls for timeline - manual commentary should NOT affect ball timeline
    const autoBalls = Array.isArray(matchData?.recentBalls) ? [...matchData.recentBalls] : []
    
    if (autoBalls.length === 0) return []
    
    // IMPORTANT: recentBalls is stored with newest first, so we need to reverse it
    // to get chronological order (oldest first) for proper timeline display
    const reversedBalls = [...autoBalls].reverse()
    
    // Remove duplicates based on unique ID or timestamp
    const seen = new Set()
    const unique = []
    reversedBalls.forEach((entry) => {
      // Use ID if available, otherwise use timestamp + over + ball + extraType
      const uniqueKey = entry.id || 
        `${entry.timestamp || Date.now()}-${entry.over || '0.0'}-${entry.ball || '1'}-${entry.extraType || 'legal'}-${entry.runs || 0}`
      if (!seen.has(uniqueKey)) {
        seen.add(uniqueKey)
        unique.push(entry)
      }
    })
    
    // Sort by over number, then by ball number, then by timestamp to maintain chronological order
    return unique
      .map((entry) => ({
        ...entry,
        parsedOver: Number.parseFloat(entry.over || '0'),
        ballNumber: entry.ball || 0,
      }))
      .sort((a, b) => {
        // First sort by over number
        if (a.parsedOver !== b.parsedOver) {
          return a.parsedOver - b.parsedOver
        }
        // Within same over, sort by ball number first (if available)
        if (a.ballNumber && b.ballNumber && a.ballNumber !== b.ballNumber) {
          return a.ballNumber - b.ballNumber
        }
        // If ball numbers are same or not available, sort by timestamp (oldest first)
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
        return aTime - bTime
      })
  }, [matchData?.recentBalls])

  const oversSummaryData = useMemo(() => {
    const overs = []
    const indexMap = new Map()
    
    // Process ball events - ballEventsFeed is already sorted chronologically (oldest first)
    if (ballEventsFeed && ballEventsFeed.length > 0) {
      // ballEventsFeed is already in chronological order, so we can process it directly
      // Process each ball in order to maintain proper sequence
      ballEventsFeed.forEach((entry) => {
        // Use overNumber if available (from AdminPanel), otherwise parse from over string
        let overNum = entry.overNumber
        if (!overNum) {
          const overPart = (entry.over || '0').toString().split('.')[0]
          overNum = Number.parseInt(overPart, 10)
          if (Number.isNaN(overNum) || overNum < 0) {
            overNum = 0
          }
        }
        // Ensure over number is at least 1 (1-based, not 0-based)
        if (overNum === 0) {
          overNum = 1
        }
        if (!indexMap.has(overNum)) {
          indexMap.set(overNum, overs.length)
          overs.push({
            number: overNum,
            balls: [],
            totalRuns: 0,
            isLocked: false, // Track if over is complete and locked
          })
        }
        const target = overs[indexMap.get(overNum)]
        const badge = buildBallBadge(entry).label || ''
        
        // Check if this is a wide/no-ball that doesn't count as a ball
        const isExtra = entry.extraType === EXTRA_TYPES.WIDE || entry.extraType === EXTRA_TYPES.NO_BALL
        // ICC Rule: Wide/No-ball don't count as legal balls (countsBall = false)
        // But they should still be displayed in the over
        // For extras: countsBall should be false (default), only true if explicitly set
        const countsBall = isExtra ? (entry.countsBall === true) : (entry.countsBall !== false)
        
        // Add runs to over total
        const runs = entry.runs || 0
        target.totalRuns = (target.totalRuns || 0) + runs
        
        // Process balls in chronological order
        // For extras that don't count: add badge + blank placeholder
        // For legal balls: replace the LAST blank placeholder (most recent extra's retry slot)
        if (isExtra && !countsBall) {
          // Wide/no-ball that doesn't count as a legal ball
          // Add the extra badge, then add a blank placeholder for the retry ball
          // IMPORTANT: Always display wide/no-ball badges, even if they don't count
          if (badge && badge.trim() !== '') {
            target.balls.push(badge)
            target.balls.push('') // Blank placeholder - will be replaced by next legal ball
          }
        } else if (isExtra && countsBall) {
          // Rare case: Extra that counts as a ball (shouldn't happen for wide, but handle it)
          // Place it as a legal ball
          const ballNumber = entry.ball || 0
          if (ballNumber > 0 && ballNumber <= 6) {
            while (target.balls.length < ballNumber) {
              target.balls.push('')
            }
            target.balls[ballNumber - 1] = badge
          } else {
            target.balls.push(badge)
          }
        } else {
          // Legal ball (or extra that counts as a ball)
          // IMPORTANT: First check if there's a blank placeholder from a recent extra (wide/no-ball)
          // Replace the LAST blank placeholder (most recent extra's retry slot) to maintain chronological order
          let blankIndex = -1
          // Find the LAST blank placeholder (most recent extra's placeholder)
          for (let i = target.balls.length - 1; i >= 0; i--) {
            if (target.balls[i] === '') {
              blankIndex = i
              break // Found the last (most recent) blank placeholder
            }
          }
          
          if (blankIndex >= 0) {
            // Replace the blank placeholder with this legal ball
            // This ensures wide/no-ball badges are preserved
            target.balls[blankIndex] = badge
          } else {
            // No blank placeholder found, use ball number to place in correct position
            const ballNumber = entry.ball || 0
            
            if (ballNumber > 0 && ballNumber <= 6) {
              // Ensure we have enough positions in the array
              while (target.balls.length < ballNumber) {
                target.balls.push('')
              }
              // Place ball at correct position (ballNumber is 1-based, array is 0-based)
              // But only if that position is empty or we're not overwriting an extra badge
              const targetIndex = ballNumber - 1
              // Check if position is empty or contains a blank
              if (targetIndex < target.balls.length && (target.balls[targetIndex] === '' || target.balls[targetIndex] === undefined)) {
                target.balls[targetIndex] = badge
              } else {
                // Position might have an extra badge, find next empty position
                let foundEmpty = false
                for (let i = targetIndex; i < target.balls.length; i++) {
                  if (target.balls[i] === '' || target.balls[i] === undefined) {
                    target.balls[i] = badge
                    foundEmpty = true
                    break
                  }
                }
                if (!foundEmpty) {
                  target.balls.push(badge)
                }
              }
            } else {
              // No ball number, add this ball normally
              target.balls.push(badge)
            }
          }
        }
      })
    }
    
    // Always include current over with blank circles for remaining balls
    // Also create next over if current over is complete
    if (matchData && currentScore) {
      const currentBalls = currentScore.balls || 0
      // ICC Rule: Current over = Math.floor(balls / 6) + 1
      // Example: 0-5 balls = Over 1, 6-11 balls = Over 2, 12-17 balls = Over 3
      let currentOverNum = Math.floor(currentBalls / 6) + 1
      if (currentOverNum < 1) currentOverNum = 1
      
      const ballsInCurrentOver = currentBalls % 6
      const isCurrentOverComplete = ballsInCurrentOver === 0 && currentBalls > 0
      
      // Create/update current over
      if (!indexMap.has(currentOverNum)) {
        indexMap.set(currentOverNum, overs.length)
        overs.push({
          number: currentOverNum,
          balls: [],
          totalRuns: 0,
        })
      }
      
      const currentOver = overs[indexMap.get(currentOverNum)]
      
      // Check if last item is a placeholder blank (comes after wide/no-ball)
      const lastIndex = currentOver.balls.length - 1
      const hasPlaceholderAtEnd = lastIndex >= 0 && 
        currentOver.balls[lastIndex] === '' &&
        lastIndex > 0 &&
        (String(currentOver.balls[lastIndex - 1] || '').toLowerCase().startsWith('wd') ||
         String(currentOver.balls[lastIndex - 1] || '').toLowerCase().startsWith('nb'))
      
      // Only add remaining blanks if there's no placeholder waiting at the end
      // Placeholder blanks will be replaced by the next legal ball
      if (!hasPlaceholderAtEnd && ballsInCurrentOver < 6) {
        // Count how many legal balls we have (excluding wide/no-ball)
        const legalBallsCount = currentOver.balls.filter(b => {
          if (b === '') return false
          const str = String(b).toLowerCase()
          return !str.startsWith('wd') && !str.startsWith('nb')
        }).length
        
        // We need 6 legal ball positions total
        // Add blanks for remaining legal positions
        const remainingLegalPositions = 6 - legalBallsCount
        
        // Count existing remaining blanks (not placeholders)
        const existingRemainingBlanks = currentOver.balls.filter((b, idx) => {
          if (b !== '') return false
          // Check if it's a placeholder (comes after wide/no-ball)
          if (idx > 0) {
            const prevBall = String(currentOver.balls[idx - 1] || '').toLowerCase()
            if (prevBall.startsWith('wd') || prevBall.startsWith('nb')) {
              return false // It's a placeholder, not a remaining blank
            }
          }
          return true // It's a remaining blank
        }).length
        
        // Add blanks for remaining legal positions
        const blanksToAdd = Math.max(0, remainingLegalPositions - existingRemainingBlanks)
        for (let i = 0; i < blanksToAdd; i++) {
          currentOver.balls.push('')
        }
      }
      
      // Lock completed overs and create next over (only if innings is not complete)
      if (isCurrentOverComplete) {
        // Lock the completed over
        if (currentOver && !currentOver.isLocked) {
          currentOver.isLocked = true
        }
        
        // ICC Rule: Only create next over if innings is not complete
        // Check if innings is complete (InningsBreak, Finished, or overs limit reached)
        const oversLimit = matchData?.oversLimit || 20
        const oversLimitBalls = oversLimit * 6
        const isInningsComplete = 
          matchData?.matchPhase === 'InningsBreak' || 
          matchData?.matchPhase === 'Finished' ||
          matchData?.status === 'Finished' ||
          currentBalls >= oversLimitBalls
        
        // Only create next over if innings is still ongoing
        if (!isInningsComplete) {
          const nextOverNum = currentOverNum + 1
          // Also check if next over would exceed overs limit
          const nextOverBalls = nextOverNum * 6
          if (nextOverBalls <= oversLimitBalls && !indexMap.has(nextOverNum)) {
            indexMap.set(nextOverNum, overs.length)
            overs.push({
              number: nextOverNum,
              balls: [],
              totalRuns: 0,
              isLocked: false, // New over is not locked yet
            })
            
            // Add 6 blank circles for the new over
            const nextOver = overs[indexMap.get(nextOverNum)]
            for (let i = 0; i < 6; i++) {
              nextOver.balls.push('')
            }
          }
        }
      }
      
      // Also lock any overs that are complete (have 6 legal balls)
      overs.forEach((over) => {
        if (!over.isLocked && over.number < currentOverNum) {
          // Count legal balls (excluding wide/no-ball)
          const legalBallsCount = over.balls.filter(b => {
            if (b === '') return false
            const str = String(b).toLowerCase()
            return !str.startsWith('wd') && !str.startsWith('nb')
          }).length
          
          // If over has 6 legal balls, it's complete - lock it
          if (legalBallsCount >= 6) {
            over.isLocked = true
          }
        }
      })
    }
    
    // Sort overs by number (ascending - Over 1, Over 2, etc.)
    // This ensures proper chronological order
    return overs.sort((a, b) => {
      // Ensure proper numeric sorting
      const aNum = Number(a.number) || 0
      const bNum = Number(b.number) || 0
      return aNum - bNum
    })
  }, [ballEventsFeed, matchData, currentScore])

  const autoCommentaryEntries = useMemo(() => {
    const flattened = [...ballEventsFeed]
    const unique = []
    const seen = new Set()
    flattened.forEach((ball, idx) => {
      const overValue = ball.over || '0.0'
      const ballNumber = ball.ball || ((idx % 6) + 1)
      const key = `${overValue}-${ballNumber}`
      if (seen.has(key)) return
      seen.add(key)
      unique.push({
        id: ball.id || `auto-${key}`,
        over: overValue,
        ball: ballNumber,
        runs: ball.runs || 0,
        isWicket: Boolean(ball.isWicket),
        isBoundary: Boolean(ball.isBoundary),
        batsman: ball.batsman || '',
        bowler: ball.bowler || '',
        text: ball.text || '',
        timestamp: ball.timestamp || null,
        autoGenerated: true,
        entryKey: key,
      })
    })
    return unique
  }, [ballEventsFeed])

  const commentaryEntries = useMemo(() => {
    const mappedCommentary = (commentary || []).map((entry, idx) => {
      const overValue = entry.over || '0.0'
      const ballNumber = entry.ball || ((idx % 6) + 1)
      return {
        ...entry,
        entryKey: `${overValue}-${ballNumber}`,
        autoGenerated: false,
      }
    })
    
    // Merge manual commentary with auto commentary
    // If both exist for the same ball, show manual first, then auto
    const manualKeys = new Set(mappedCommentary.map((entry) => entry.entryKey))
    const autoOnly = autoCommentaryEntries.filter((entry) => !manualKeys.has(entry.entryKey))
    
    // Combine: manual commentary first, then auto-only entries, then auto entries that have manual (for same ball)
    const combined = [...mappedCommentary]
    
    // Add auto commentary entries that don't have manual commentary
    combined.push(...autoOnly)
    
    // Also add auto commentary for balls that have manual commentary (so both appear)
    const autoWithManual = autoCommentaryEntries.filter((entry) => manualKeys.has(entry.entryKey))
    combined.push(...autoWithManual)
    
    // Sort by timestamp (newest first) - this ensures recent entries always appear at top
    return combined.sort((a, b) => {
      const aTime = a.timestamp ? (a.timestamp.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime()) : 0
      const bTime = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime()) : 0
      if (aTime !== bTime) return bTime - aTime // Newest first
      // If same timestamp, sort by over and ball
      const aOver = Number.parseFloat(a.over || '0')
      const bOver = Number.parseFloat(b.over || '0')
      if (aOver !== bOver) return bOver - aOver // Reverse: newest first
      const aBall = Number.parseInt(a.ball || '1', 10)
      const bBall = Number.parseInt(b.ball || '1', 10)
      return bBall - aBall // Reverse: newest first
    })
  }, [commentary, autoCommentaryEntries])

  // Subscribe to real-time match updates
  useEffect(() => {
    if (!matchId) {
      setLoading(false)
      return
    }

    const unsubscribeMatch = subscribeToMatch(matchId, async (match) => {
      if (match) {
        setMatchData(match)
        setLoading(false)

        // Load squads and players when match data is available
        if (match.teamASquadId) {
          loadSquadData(match.teamASquadId, 'A')
        }
        if (match.teamBSquadId) {
          loadSquadData(match.teamBSquadId, 'B')
        }
      } else {
        setLoading(false)
      }
    })

    const unsubscribeCommentary = subscribeToCommentary(matchId, (comments) => {
      setCommentary(comments || [])
    })

    return () => {
      unsubscribeMatch()
      unsubscribeCommentary()
    }
  }, [matchId])

  // Load squad and player data
  const loadSquadData = async (squadId, team) => {
    try {
      // Get squad data
      const squadResponse = await squadsAPI.getById(squadId)
      const squad = squadResponse.data

      if (team === 'A') {
        setTeamASquad(squad.players || [])
      } else {
        setTeamBSquad(squad.players || [])
      }

      // Get players for this squad
      const playersResponse = await playersAPI.getAll({ squadId })
      const players = playersResponse.data || []

      if (team === 'A') {
        setTeamAPlayers(players)
      } else {
        setTeamBPlayers(players)
      }
    } catch (error) {
      console.error(`Error loading squad data for team ${team}:`, error)
    }
  }

  // Auto-scroll disabled - user can manually scroll if needed
  // useEffect(() => {
  //   if (commentaryEndRef.current && commentary.length > 0 && activeTab === 'live') {
  //     commentaryEndRef.current.scrollIntoView({ behavior: 'smooth' })
  //   }
  // }, [commentary, activeTab])

  const handlePlayerClick = (playerId) => {
    if (playerId) {
      navigate(`/player/${playerId}`)
    }
  }

  // All hooks must be called before any conditional returns
  const formatDateTime = (date, time) => {
    if (!date) return '-'
    const dateTime = time ? new Date(`${date}T${time}`) : new Date(date)
    return dateTime.toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    } catch {
      return timestamp || ''
    }
  }

  const tabs = [
    { id: 'info', label: 'Info' },
    { id: 'live', label: 'Live' },
    { id: 'scoreboard', label: 'Scoreboard' },
    { id: 'squads', label: 'Playing XI' },
  ]


  // Early returns after all hooks
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4 animate-pulse">🏏</div>
          <p className="text-gray-500">Loading match...</p>
        </div>
      </div>
    )
  }

  if (!matchData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">❌</div>
          <p className="text-gray-500 text-lg">Match not found</p>
          <Link
            to="/"
            className="mt-4 inline-block text-cricbuzz-green hover:text-green-700 font-semibold"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Premium Match Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#015f44] to-[#0e8d6f] text-white">
        {/* Texture Overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[radial-gradient(circle_at_50%_50%,_rgba(255,255,255,0.1),_transparent_70%)]" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 text-sm font-medium transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>

          {/* Top Bar - Venue, Time, LIVE Badge */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-white/70">📍</span>
                <span className="text-white/90 font-medium">{matchData?.venue || 'Main Ground'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white/70">⏱</span>
                <span className="text-white/90 font-medium">{formatDateTime(matchData?.date, matchData?.time)}</span>
              </div>
              {/* ICC Rule: Only show target in second innings */}
              {matchData?.targetRuns && matchData.matchPhase === 'SecondInnings' && (
                <div className="flex items-center gap-2">
                  <span className="text-white/70">🎯</span>
                  <span className="text-white/90 font-medium">Target: {matchData.targetRuns}</span>
                </div>
              )}
            </div>
            {matchData?.status === 'Live' && (
              <div className="flex items-center gap-2 bg-[#FF3B30] text-white font-semibold px-4 py-2 rounded-full shadow-lg animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full"></span>
                LIVE
              </div>
            )}
            {matchData?.status === 'Upcoming' && (
              <span className="bg-blue-500 px-4 py-2 rounded-full text-sm font-semibold">UPCOMING</span>
            )}
            {matchData?.status === 'Completed' && (
              <span className="bg-gray-500 px-4 py-2 rounded-full text-sm font-semibold">COMPLETED</span>
            )}
          </div>

          {/* Two Mini Scorecards Side-by-Side (Cricbuzz Style) */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Team A Scorecard */}
            <div className="rounded-xl border border-white/20 bg-white/10 backdrop-blur-md p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-white">{teamAName}</h3>
                {matchData?.currentBatting === teamAName && (
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-semibold">Batting</span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold text-white">
                  {teamAScore.runs}/{teamAScore.wickets}
                </span>
                <span className="text-lg text-white/80">({teamAScore.overs} ov)</span>
              </div>
              {getRunRate(teamAScore.runs, teamAScore.balls) && (
                <p className="text-sm text-white/70">RR: {getRunRate(teamAScore.runs, teamAScore.balls)}</p>
              )}
            </div>

            {/* Team B Scorecard */}
            <div className="rounded-xl border border-white/20 bg-white/10 backdrop-blur-md p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-white">{teamBName}</h3>
                {matchData?.currentBatting === teamBName && (
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-semibold">Batting</span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold text-white">
                  {teamBScore.runs}/{teamBScore.wickets}
                </span>
                <span className="text-lg text-white/80">({teamBScore.overs} ov)</span>
              </div>
              {getRunRate(teamBScore.runs, teamBScore.balls) && (
                <p className="text-sm text-white/70">RR: {getRunRate(teamBScore.runs, teamBScore.balls)}</p>
              )}
            </div>
          </div>

          {/* Toss Info */}
          {tossSummary && (
            <div className="mb-4 text-sm text-white/90 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 inline-block">
              🪙 {tossSummary}
            </div>
          )}

          {/* Result Summary */}
          {matchData?.resultSummary && (
            <div className="mb-4 text-base font-semibold text-yellow-100 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 inline-block">
              {matchData.resultSummary}
            </div>
          )}

        </div>
      </div>

      {/* Premium Tabs with Gradient Border */}
      <div className="bg-white border-b-2 border-[#0D8F61]/20 shadow-sm sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex -mb-px overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-6 py-4 text-sm font-semibold transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'text-[#0D8F61]'
                    : 'text-[#042F2E] hover:text-[#0D8F61]'
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  {tab.label}
                  {tab.id === 'live' && matchData?.status === 'Live' && (
                    <span className="w-2 h-2 bg-[#FF3B30] rounded-full inline-block animate-pulse"></span>
                  )}
                </span>
                {/* Active Underline */}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0D8F61] rounded-t-full"></span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content - 40px top margin */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
        {/* Info Tab */}
        {activeTab === 'info' && (
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Match Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Teams</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-900">Team A</span>
                    <span className="text-gray-700">{matchData.teamAName || matchData.team1 || matchData.teamA}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-900">Team B</span>
                    <span className="text-gray-700">{matchData.teamBName || matchData.team2 || matchData.teamB}</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Match Details</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-900">Date & Time</span>
                    <span className="text-gray-700">{formatDateTime(matchData.date, matchData.time)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-900">Venue</span>
                    <span className="text-gray-700">{matchData.venue || 'Main Ground'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-900">Format</span>
                    <span className="text-gray-700">{matchData.format || 'T20'}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-900">Status</span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        matchData.status === 'Live'
                          ? 'bg-red-100 text-red-800'
                          : matchData.status === 'Completed'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {matchData.status}
                    </span>
                  </div>
                  {matchData.tournamentName && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-900">Tournament</span>
                      <span className="text-gray-700">{matchData.tournamentName}</span>
                    </div>
                  )}
                  {matchData.resultSummary && (
                    <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-900 mr-4">Result</span>
                      <span className="text-gray-700 text-right text-sm leading-relaxed">
                        {matchData.resultSummary}
                      </span>
                    </div>
                  )}
                  {tossSummary && (
                    <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium text-gray-900 mr-4">Toss</span>
                      <span className="text-gray-700 text-right text-sm leading-relaxed">{tossSummary}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Tab */}
        {activeTab === 'live' && (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Column - 8 columns */}
            <div className="space-y-6 lg:col-span-8">
              {/* Current Innings Widget */}
              <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#042F2E]">Current Innings</h3>
                  {matchData?.freeHit && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#FF3B30] text-white font-semibold text-xs">
                      Free Hit Active
                    </span>
                  )}
                </div>
                <div className="mb-4">
                  <h2 className="text-2xl font-bold text-[#042F2E] mb-2">{battingTeamName}</h2>
                  <div className="flex items-baseline gap-3">
                    <span className="text-4xl font-bold text-[#042F2E]">
                      {currentScore.runs}/{currentScore.wickets}
                    </span>
                    <span className="text-lg text-gray-600">({currentScore.overs} ov)</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">🔥</span>
                    <div>
                      <p className="text-xs text-gray-500">Run Rate</p>
                      <p className="text-sm font-bold text-[#042F2E]">
                        {runRate !== null ? runRate.toFixed(2) : '0.00'}
                      </p>
                    </div>
                  </div>
                  {/* ICC Rule: Only show target in second innings */}
                  {matchData?.targetRuns && matchData.matchPhase === 'SecondInnings' && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">🎯</span>
                      <div>
                        <p className="text-xs text-gray-500">Target</p>
                        <p className="text-sm font-bold text-[#042F2E]">{matchData.targetRuns}</p>
                      </div>
                    </div>
                  )}
                  {matchData?.oversLimit && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">⚡</span>
                      <div>
                        <p className="text-xs text-gray-500">Remaining</p>
                        <p className="text-sm font-bold text-[#042F2E]">
                          {Math.max(0, matchData.oversLimit * 6 - currentScore.balls)} balls
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {chase && chase.runsNeeded > 0 && (
                  <div className="mt-4 rounded-lg bg-[#0D8F61]/10 border border-[#0D8F61]/20 p-3">
                    <p className="text-sm font-semibold text-[#0D8F61]">
                      💡 Need {chase.runsNeeded} runs to win
                      {chase.requiredRunRate !== null && ` • RRR: ${chase.requiredRunRate.toFixed(2)}`}
                    </p>
                  </div>
                )}
              </div>

                {/* Players Grid - 24px gap */}
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {striker ? renderBatterCard(striker, true) : renderEmptyCard('Waiting for striker')}
                  {nonStriker ? renderBatterCard(nonStriker, false) : renderEmptyCard('Waiting for non-striker')}
                  {currentBowler
                    ? renderBowlerCard(currentBowler)
                    : renderEmptyCard('Bowler info coming soon')}
                </div>

              {/* Partnership & Stats - 24px gap */}
              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase text-[#042F2E] font-bold tracking-wide mb-2">Partnership</p>
                  <div className="text-2xl font-bold text-[#042F2E] mb-1">
                    {partnership.runs} <span className="text-base font-normal text-gray-500">({partnership.balls} balls)</span>
                  </div>
                  <p className="text-xs text-gray-500">Since last wicket • {partnershipOvers} overs</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-xs uppercase text-[#042F2E] font-bold tracking-wide mb-2">This Innings</p>
                  <div className="text-2xl font-bold text-[#042F2E] mb-1">
                    RR {runRate !== null ? runRate.toFixed(2) : '0.00'}
                  </div>
                  <p className="text-xs text-gray-500">
                    {currentScore.runs} runs off {ballsToOvers(currentScore.balls)} overs
                  </p>
                </div>
              </div>

              {/* Recent Overs - 24px gap */}
              <div className="mt-6">
                <RecentOvers overs={oversSummaryData} maxPast={4} currentScore={currentScore} />
              </div>

              {/* Performance Graph - Manhattan */}
              {ballEventsFeed && ballEventsFeed.length > 0 && (
                <ManhattanGraph 
                  ballEvents={ballEventsFeed} 
                  maxOvers={matchData?.oversLimit || 20}
                  className="animate-fade-in"
                  teamName={
                    currentInnings === 'teamA' 
                      ? (teamAName || matchData?.teamAName || matchData?.team1 || matchData?.teamA || 'Team A')
                      : (teamBName || matchData?.teamBName || matchData?.team2 || matchData?.teamB || 'Team B')
                  }
                  currentScore={currentScore}
                  fallOfWickets={fallOfWicketsByTeam[currentInnings] || []}
                  currentInnings={currentInnings}
                />
              )}

              {/* Commentary Section - 24px gap */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-800">Ball-by-Ball Commentary</h2>
                    {matchData.status === 'Live' && (
                      <span className="flex items-center text-sm text-red-600 font-semibold">
                        <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                        Live Updates
                      </span>
                    )}
                  </div>
                </div>
                <div className="max-h-[500px] sm:max-h-[600px] overflow-y-auto">
                  {commentaryEntries.length === 0 ? (
                    <div className="p-8 sm:p-12 text-center">
                      <div className="text-gray-400 text-5xl mb-4">📝</div>
                      <p className="text-gray-500 text-sm sm:text-base">No commentary available yet</p>
                      <p className="text-gray-400 text-xs sm:text-sm mt-2">
                        Commentary will appear here when the match starts
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="divide-y divide-gray-100">
                        {commentaryEntries.map((comment, idx) => {
                          const timestamp = comment.timestamp ? formatTime(comment.timestamp) : ''
                          return (
                            <div
                              key={comment.id || comment.entryKey || idx}
                              className={`p-3 sm:p-4 hover:bg-gray-50 transition-colors ${
                                idx === 0 && matchData.status === 'Live' ? 'bg-green-50' : ''
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 gap-2">
                                <div className="flex items-center flex-wrap gap-2 sm:gap-3">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                      {comment.over || '0.0'}
                                    </span>
                                    {comment.ball && (
                                      <span className="text-xs text-gray-500">ball {comment.ball}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <span
                                      className={`text-xs sm:text-sm font-semibold px-2 py-0.5 rounded ${
                                        comment.isWicket
                                          ? 'bg-red-100 text-red-800'
                                          : comment.runs === 4 || comment.runs === 6
                                          ? 'bg-green-100 text-green-800'
                                          : comment.runs === 0
                                          ? 'bg-gray-100 text-gray-600'
                                          : 'bg-blue-100 text-blue-800'
                                      }`}
                                    >
                                      {comment.isWicket ? 'W' : comment.runs === 0 ? '•' : comment.runs}
                                    </span>
                                    {comment.isBoundary && (
                                      <span className="text-xs font-semibold text-green-600">
                                        {comment.runs === 4 ? 'FOUR' : comment.runs === 6 ? 'SIX' : ''}
                                      </span>
                                    )}
                                    {comment.isWicket && (
                                      <span className="text-xs font-semibold text-red-600">WICKET</span>
                                    )}
                                  </div>
                                </div>
                                {timestamp && (
                                  <span className="text-xs text-gray-400 self-end sm:self-auto">{timestamp}</span>
                                )}
                              </div>

                              <div className="text-xs sm:text-sm text-gray-700 mt-2">
                                {comment.batsman && (
                                  <>
                                    <span className="font-medium text-gray-900">{comment.batsman}</span>
                                    {comment.bowler && comment.batsman !== comment.bowler && (
                                      <>
                                        {' '}to{' '}
                                        <span className="font-medium text-gray-900">{comment.bowler}</span>
                                      </>
                                    )}
                                    {': '}
                                  </>
                                )}
                                <span className="italic">{comment.text}</span>
                                {comment.autoGenerated && (
                                  <span className="ml-2 text-[10px] uppercase tracking-wide text-gray-400">
                                    Auto
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <div ref={commentaryEndRef} />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - 4 columns */}
            <div className="space-y-6 lg:col-span-4">
              {/* Match Summary Card */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-[#042F2E] mb-4 pb-3 border-b border-gray-200">
                  Match Summary
                </h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#042F2E]">{teamAName}</span>
                      <span className="font-bold text-[#042F2E]">
                        {teamAScore.runs}/{teamAScore.wickets}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Overs {teamAScore.overs}</p>
                  </div>
                  <div className="h-px bg-gray-200"></div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#042F2E]">{teamBName}</span>
                      <span className="font-bold text-[#042F2E]">
                        {teamBScore.runs}/{teamBScore.wickets}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">Overs {teamBScore.overs}</p>
                  </div>
                  <div className="h-px bg-gray-200"></div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={`text-sm font-semibold ${
                      matchData?.status === 'Live' 
                        ? 'text-[#FF3B30]' 
                        : matchData?.status === 'Completed' 
                        ? 'text-gray-600' 
                        : 'text-blue-600'
                    }`}>
                      {matchData?.status || 'Upcoming'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-800">Fall of Wickets ({battingTeamName})</h3>
                {currentFall.length === 0 ? (
                  <p className="text-sm text-gray-500 mt-3">No wickets yet in this innings.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {currentFall.map((fow) => (
                      <div key={fow.id} className="flex items-center justify-between text-sm text-gray-700">
                        <div>
                          <span className="font-semibold text-gray-900">{fow.wicket}/{fow.runs}</span>{' '}
                          <span className="text-xs text-gray-500">({fow.over} ov)</span>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{fow.batsmanName || 'Batsman'}</p>
                          <p className="text-xs text-gray-500">{fow.wicketType || 'Wicket'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {otherFall.length > 0 && (
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-800">Fall of Wickets ({otherFallTeamName})</h3>
                  <div className="mt-4 space-y-3">
                    {otherFall.map((fow) => (
                      <div key={fow.id} className="flex items-center justify-between text-sm text-gray-700">
                        <div>
                          <span className="font-semibold text-gray-900">{fow.wicket}/{fow.runs}</span>{' '}
                          <span className="text-xs text-gray-500">({fow.over} ov)</span>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{fow.batsmanName || 'Batsman'}</p>
                          <p className="text-xs text-gray-500">{fow.wicketType || 'Wicket'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scoreboard Tab */}
        {activeTab === 'scoreboard' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-gray-800">Scoreboard</h2>
              {matchData.tournamentId && (
                <button
                  type="button"
                  onClick={() => navigate(`/schedule?tournament=${matchData.tournamentId}`)}
                  className="inline-flex items-center gap-2 rounded-full border border-cricbuzz-green px-4 py-2 text-xs font-semibold text-cricbuzz-green transition hover:bg-cricbuzz-green hover:text-white"
                >
                  View Points Table
                  <span aria-hidden>→</span>
                </button>
              )}
            </div>
            {(() => {
              const selectedTeam = selectedScoreboardTeam === 'teamA' ? 'teamA' : 'teamB'
              const selectedTeamName = selectedTeam === 'teamA' ? teamAName : teamBName
              const selectedTeamScore = selectedTeam === 'teamA' ? teamAScore : teamBScore
              const selectedPlayingXI = selectedTeam === 'teamA' ? teamAPlayingXI : teamBPlayingXI
              const teamFallOfWickets = selectedTeam === 'teamA' ? fallOfWicketsByTeam.teamA : fallOfWicketsByTeam.teamB
              
              // Create dismissal map
              const dismissalMap = new Map()
              teamFallOfWickets.forEach((fow) => {
                if (fow?.batsmanId) {
                  dismissalMap.set(fow.batsmanId, {
                    dismissalText: fow.dismissalText || fow.wicketType || '',
                    wicketType: fow.wicketType || '',
                  })
                }
              })
              
              // Filter players from selected team who bowled (have bowling stats)
              const bowlers = selectedPlayingXI.filter(player => {
                const ballsBowled = player.bowlingBalls || 0
                const wickets = player.bowlingWickets || 0
                return ballsBowled > 0 || wickets > 0
              })

              return (
                <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                    <h2 className="text-2xl font-bold text-gray-900">Scorecard</h2>
                  </div>

                  {/* Match Summary - Clickable Team Cards */}
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Team A Summary - Clickable */}
                      <button
                        onClick={() => setSelectedScoreboardTeam('teamA')}
                        className={`bg-white rounded-lg p-4 border-2 transition-all text-left ${
                          selectedScoreboardTeam === 'teamA'
                            ? 'border-[#0D8F61] shadow-md bg-[#0D8F61]/5'
                            : 'border-gray-200 hover:border-[#0D8F61]/50 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className={`text-lg font-bold ${selectedScoreboardTeam === 'teamA' ? 'text-[#0D8F61]' : 'text-gray-900'}`}>
                            {teamAName}
                          </h3>
                          <span className="text-sm font-semibold text-gray-600">
                            {teamAScore.runs}/{teamAScore.wickets} ({teamAScore.overs} ov)
                          </span>
                        </div>
                        {selectedScoreboardTeam === 'teamA' && (
                          <p className="text-xs text-[#0D8F61] font-semibold mt-2">Click to view details →</p>
                        )}
                      </button>

                      {/* Team B Summary - Clickable */}
                      <button
                        onClick={() => setSelectedScoreboardTeam('teamB')}
                        className={`bg-white rounded-lg p-4 border-2 transition-all text-left ${
                          selectedScoreboardTeam === 'teamB'
                            ? 'border-[#0D8F61] shadow-md bg-[#0D8F61]/5'
                            : 'border-gray-200 hover:border-[#0D8F61]/50 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h3 className={`text-lg font-bold ${selectedScoreboardTeam === 'teamB' ? 'text-[#0D8F61]' : 'text-gray-900'}`}>
                            {teamBName}
                          </h3>
                          <span className="text-sm font-semibold text-gray-600">
                            {teamBScore.runs}/{teamBScore.wickets} ({teamBScore.overs} ov)
                          </span>
                        </div>
                        {selectedScoreboardTeam === 'teamB' && (
                          <p className="text-xs text-[#0D8F61] font-semibold mt-2">Click to view details →</p>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Selected Team Details */}
                  <div className="divide-y divide-gray-200">
                    {/* Batting Scorecard */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-900 mb-4">{selectedTeamName} - Batting</h3>
                      <div className="overflow-x-auto">
                        {(() => {
                          // Create a map of actual batting positions from fallOfWickets
                          const actualBattingOrder = new Map()
                          teamFallOfWickets.forEach((fow, index) => {
                            actualBattingOrder.set(fow.batsmanId, index + 1)
                          })
                          
                          // Get players who batted (have runs or balls)
                          const battedPlayers = selectedPlayingXI.filter(player => {
                            const runs = player.runs || 0
                            const balls = player.balls || 0
                            return runs > 0 || balls > 0
                          })
                          
                          // Assign batting positions
                          let nextPosition = teamFallOfWickets.length + 1
                          const notOutPlayers = battedPlayers.filter(player => {
                            const playerId = player.playerId || player.id
                            const isOut = player.status === 'out' || player.isOut
                            return !actualBattingOrder.has(playerId) && !isOut
                          })
                          
                          notOutPlayers.sort((a, b) => (a.battingPosition ?? 999) - (b.battingPosition ?? 999))
                          
                          notOutPlayers.forEach(player => {
                            const playerId = player.playerId || player.id
                            if (!actualBattingOrder.has(playerId)) {
                              actualBattingOrder.set(playerId, nextPosition)
                              nextPosition++
                            }
                          })
                          
                          // Handle first two batsmen
                          const hasPosition1 = Array.from(actualBattingOrder.values()).includes(1)
                          const hasPosition2 = Array.from(actualBattingOrder.values()).includes(2)
                          
                          if (!hasPosition1 || !hasPosition2) {
                            const unassignedBatted = battedPlayers.filter(player => {
                              const playerId = player.playerId || player.id
                              return !actualBattingOrder.has(playerId)
                            }).sort((a, b) => (a.battingPosition ?? 999) - (b.battingPosition ?? 999))
                            
                            let pos = 1
                            unassignedBatted.forEach(player => {
                              const playerId = player.playerId || player.id
                              if (!actualBattingOrder.has(playerId)) {
                                actualBattingOrder.set(playerId, pos)
                                pos++
                              }
                            })
                          }
                          
                          // Sort players by actual batting order
                          const sortedBattedPlayers = [...battedPlayers].sort((a, b) => {
                            const aId = a.playerId || a.id
                            const bId = b.playerId || b.id
                            const aPos = actualBattingOrder.get(aId) ?? 999
                            const bPos = actualBattingOrder.get(bId) ?? 999
                            return aPos - bPos
                          })
                          
                          // Add players who didn't bat at the end
                          const didNotBat = selectedPlayingXI.filter(player => {
                            const runs = player.runs || 0
                            const balls = player.balls || 0
                            return runs === 0 && balls === 0
                          })
                          
                          const allPlayers = [...sortedBattedPlayers, ...didNotBat]
                          
                          return (
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b-2 border-gray-300">
                                  <th className="text-center py-3 px-2 font-bold text-gray-900">Pos</th>
                                  <th className="text-left py-3 px-2 font-bold text-gray-900">Batter</th>
                                  <th className="text-center py-3 px-2 font-bold text-gray-900">R</th>
                                  <th className="text-center py-3 px-2 font-bold text-gray-900">B</th>
                                  <th className="text-center py-3 px-2 font-bold text-gray-900">4s</th>
                                  <th className="text-center py-3 px-2 font-bold text-gray-900">6s</th>
                                  <th className="text-center py-3 px-2 font-bold text-gray-900">SR</th>
                                </tr>
                              </thead>
                              <tbody>
                                {allPlayers.map((player, idx) => {
                                  const runs = player.runs || 0
                                  const balls = player.balls || 0
                                  const fours = player.fours || 0
                                  const sixes = player.sixes || 0
                                  const strikeRate = balls > 0 ? ((runs / balls) * 100).toFixed(2) : '0.00'
                                  const isOut = player.status === 'out' || player.isOut
                                  const dismissal = player.dismissalText || (isOut ? 'Out' : '')
                                  const notOut = !isOut && (runs > 0 || balls > 0)
                                  const dismissalInfo = dismissalMap.get(player.playerId || player.id)
                                  const playerId = player.playerId || player.id
                                  const actualPosition = actualBattingOrder.get(playerId)
                                  const hasBatted = runs > 0 || balls > 0
                                  
                                  // Get dismissal text and format to show only first names
                                  const rawDismissalText = dismissal || dismissalInfo?.dismissalText || ''
                                  const dismissalText = formatDismissalText(rawDismissalText)
                                  const showDismissal = dismissalText && isOut && !notOut

                                  return (
                                    <tr
                                      key={playerId || idx}
                                      className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                                    >
                                      <td className="text-center py-3 px-2 text-gray-600 font-semibold">
                                        {hasBatted && actualPosition ? actualPosition : '-'}
                                      </td>
                                      <td className="py-3 px-2">
                                        <div className="flex flex-col">
                                          {playerId ? (
                                            <Link
                                              to={`/player/${playerId}`}
                                              className="font-semibold text-gray-900 hover:text-[#0D8F61] transition-colors cursor-pointer"
                                            >
                                              {player.name}
                                              {player.isCaptain && <span className="text-gray-600 ml-1">(c)</span>}
                                              {player.isKeeper && <span className="text-gray-600 ml-1">(wk)</span>}
                                            </Link>
                                          ) : (
                                            <span className="font-semibold text-gray-900">
                                              {player.name}
                                              {player.isCaptain && <span className="text-gray-600 ml-1">(c)</span>}
                                              {player.isKeeper && <span className="text-gray-600 ml-1">(wk)</span>}
                                            </span>
                                          )}
                                          {showDismissal && (
                                            <span className="text-xs text-gray-500 mt-0.5 italic">
                                              {dismissalText}
                                            </span>
                                          )}
                                          {notOut && hasBatted && (
                                            <span className="text-xs text-gray-500 mt-0.5 italic">
                                              not out
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="text-center py-3 px-2 font-semibold text-gray-900">
                                        {hasBatted ? (notOut ? `${runs}*` : runs) : '-'}
                                      </td>
                                      <td className="text-center py-3 px-2 text-gray-700">{balls > 0 ? balls : '-'}</td>
                                      <td className="text-center py-3 px-2 text-gray-700">{fours > 0 ? fours : '-'}</td>
                                      <td className="text-center py-3 px-2 text-gray-700">{sixes > 0 ? sixes : '-'}</td>
                                      <td className="text-center py-3 px-2 text-gray-700">{strikeRate}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          )
                        })()}
                      </div>
                    </div>

                    {/* Bowling Scorecard */}
                    {bowlers.length > 0 && (
                      <div className="p-6">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">{selectedTeamName} - Bowling</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b-2 border-gray-300">
                                <th className="text-left py-3 px-2 font-bold text-gray-900">Bowler</th>
                                <th className="text-center py-3 px-2 font-bold text-gray-900">O</th>
                                <th className="text-center py-3 px-2 font-bold text-gray-900">M</th>
                                <th className="text-center py-3 px-2 font-bold text-gray-900">R</th>
                                <th className="text-center py-3 px-2 font-bold text-gray-900">W</th>
                                <th className="text-center py-3 px-2 font-bold text-gray-900">Econ</th>
                                <th className="text-center py-3 px-2 font-bold text-gray-900">Wd</th>
                                <th className="text-center py-3 px-2 font-bold text-gray-900">Nb</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bowlers.map((player, idx) => {
                                const ballsBowled = player.bowlingBalls || 0
                                const runsConceded = player.bowlingRuns || 0
                                const wickets = player.bowlingWickets || 0
                                const wides = player.bowlingWides || 0
                                const noBalls = player.bowlingNoBalls || 0
                                const overs = ballsToOvers(ballsBowled)
                                const economy = ballsBowled > 0 ? ((runsConceded / ballsBowled) * 6).toFixed(2) : '0.00'
                                const maidens = player.bowlingMaidens || 0
                                const playerId = player.playerId || player.id

                                return (
                                  <tr
                                    key={playerId || idx}
                                    className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                                  >
                                    <td className="py-3 px-2">
                                      {playerId ? (
                                        <Link
                                          to={`/player/${playerId}`}
                                          className="font-semibold text-gray-900 hover:text-[#0D8F61] transition-colors cursor-pointer"
                                        >
                                          {player.name}
                                        </Link>
                                      ) : (
                                        <span className="font-semibold text-gray-900">{player.name}</span>
                                      )}
                                    </td>
                                    <td className="text-center py-3 px-2 text-gray-700">{overs}</td>
                                    <td className="text-center py-3 px-2 text-gray-700">{maidens}</td>
                                    <td className="text-center py-3 px-2 text-gray-700">{runsConceded}</td>
                                    <td className="text-center py-3 px-2 font-semibold text-gray-900">{wickets}</td>
                                    <td className="text-center py-3 px-2 text-gray-700">{economy}</td>
                                    <td className="text-center py-3 px-2 text-gray-700">{wides > 0 ? wides : '-'}</td>
                                    <td className="text-center py-3 px-2 text-gray-700">{noBalls > 0 ? noBalls : '-'}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Playing XI Tab */}
        {activeTab === 'squads' && (
          <div className="space-y-6">
            {/* Team A Playing XI */}
            {(() => {
              const playingXI = matchData.teamAPlayingXI || []
              const playingXIPlayerIds = new Set(playingXI.map(p => p.playerId || p.id).filter(Boolean))
              const benchPlayers = teamAPlayers.filter(p => p.id && !playingXIPlayerIds.has(p.id))
              const lineupSet = matchData.teamALineupSet
              
              return (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="bg-cricbuzz-green text-white px-6 py-4">
                    <h3 className="text-xl font-bold">
                      {matchData.teamAName || matchData.team1 || matchData.teamA}
                    </h3>
                  </div>
                  <div className="p-6">
                    {lineupSet && playingXI.length > 0 ? (
                      <>
                        {/* Playing XI Section */}
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Playing XI</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {playingXI.map((player) => {
                              const playerData = teamAPlayers.find(p => (p.id || p.playerId) === (player.playerId || player.id)) || player
                              return (
                                <div
                                  key={player.playerId || player.id || player.name}
                                  onClick={() => handlePlayerClick(player.playerId || player.id)}
                                  className="p-4 border border-gray-200 rounded-lg hover:border-cricbuzz-green hover:shadow-md transition-all cursor-pointer"
                                >
                                  <div className="flex items-center space-x-3">
                                    {playerData.photo && (
                                      <img
                                        src={playerData.photo}
                                        alt={playerData.name || player.name}
                                        className="w-12 h-12 rounded-full object-cover"
                                        onError={(e) => {
                                          e.target.style.display = 'none'
                                        }}
                                      />
                                    )}
                                    <div className="flex-1">
                                      <div className="font-semibold text-gray-900">
                                        {playerData.name || player.name}
                                        {player.isCaptain && <span className="text-yellow-600 ml-1">(c)</span>}
                                        {player.isKeeper && <span className="text-yellow-600 ml-1">(wk)</span>}
                                      </div>
                                      <div className="text-sm text-gray-600">{playerData.role || player.role || 'Player'}</div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        
                        {/* Bench Section */}
                        {benchPlayers.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">On Bench</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {benchPlayers.map((player) => (
                                <div
                                  key={player.id}
                                  onClick={() => handlePlayerClick(player.id)}
                                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-all cursor-pointer opacity-75"
                                >
                                  <div className="flex items-center space-x-3">
                                    {player.photo && (
                                      <img
                                        src={player.photo}
                                        alt={player.name}
                                        className="w-12 h-12 rounded-full object-cover"
                                        onError={(e) => {
                                          e.target.style.display = 'none'
                                        }}
                                      />
                                    )}
                                    <div className="flex-1">
                                      <div className="font-semibold text-gray-600">{player.name}</div>
                                      <div className="text-sm text-gray-500">{player.role}</div>
                                      <div className="text-xs text-red-600 font-semibold mt-1">OUT ▼</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">Playing XI will be announced closer to the start of play.</div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Team B Playing XI */}
            {(() => {
              const playingXI = matchData.teamBPlayingXI || []
              const playingXIPlayerIds = new Set(playingXI.map(p => p.playerId || p.id).filter(Boolean))
              const benchPlayers = teamBPlayers.filter(p => p.id && !playingXIPlayerIds.has(p.id))
              const lineupSet = matchData.teamBLineupSet
              
              return (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="bg-blue-600 text-white px-6 py-4">
                    <h3 className="text-xl font-bold">
                      {matchData.teamBName || matchData.team2 || matchData.teamB}
                    </h3>
                  </div>
                  <div className="p-6">
                    {lineupSet && playingXI.length > 0 ? (
                      <>
                        {/* Playing XI Section */}
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Playing XI</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {playingXI.map((player) => {
                              const playerData = teamBPlayers.find(p => (p.id || p.playerId) === (player.playerId || player.id)) || player
                              return (
                                <div
                                  key={player.playerId || player.id || player.name}
                                  onClick={() => handlePlayerClick(player.playerId || player.id)}
                                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-600 hover:shadow-md transition-all cursor-pointer"
                                >
                                  <div className="flex items-center space-x-3">
                                    {playerData.photo && (
                                      <img
                                        src={playerData.photo}
                                        alt={playerData.name || player.name}
                                        className="w-12 h-12 rounded-full object-cover"
                                        onError={(e) => {
                                          e.target.style.display = 'none'
                                        }}
                                      />
                                    )}
                                    <div className="flex-1">
                                      <div className="font-semibold text-gray-900">
                                        {playerData.name || player.name}
                                        {player.isCaptain && <span className="text-yellow-600 ml-1">(c)</span>}
                                        {player.isKeeper && <span className="text-yellow-600 ml-1">(wk)</span>}
                                      </div>
                                      <div className="text-sm text-gray-600">{playerData.role || player.role || 'Player'}</div>
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        
                        {/* Bench Section */}
                        {benchPlayers.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">On Bench</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {benchPlayers.map((player) => (
                                <div
                                  key={player.id}
                                  onClick={() => handlePlayerClick(player.id)}
                                  className="p-4 border border-gray-200 rounded-lg hover:border-gray-300 transition-all cursor-pointer opacity-75"
                                >
                                  <div className="flex items-center space-x-3">
                                    {player.photo && (
                                      <img
                                        src={player.photo}
                                        alt={player.name}
                                        className="w-12 h-12 rounded-full object-cover"
                                        onError={(e) => {
                                          e.target.style.display = 'none'
                                        }}
                                      />
                                    )}
                                    <div className="flex-1">
                                      <div className="font-semibold text-gray-600">{player.name}</div>
                                      <div className="text-sm text-gray-500">{player.role}</div>
                                      <div className="text-xs text-red-600 font-semibold mt-1">OUT ▼</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">Playing XI will be announced closer to the start of play.</div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

export default LiveMatch
