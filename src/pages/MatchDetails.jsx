import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { subscribeToCommentary, subscribeToMatch } from '../services/matchesService'
import { playersAPI } from '../services/api'

const ballsToOvers = (balls = 0) => {
  const total = Number.isFinite(balls) ? balls : 0
  const overs = Math.floor(total / 6)
  const remaining = total % 6
  return `${overs}.${remaining}`
}

const oversToBalls = (oversValue = '0.0') => {
  if (oversValue === undefined || oversValue === null) return 0
  if (typeof oversValue === 'number') {
    const oversInt = Math.floor(oversValue)
    const balls = Math.round((oversValue - oversInt) * 10)
    return oversInt * 6 + balls
  }
  const [oversPart, ballsPart] = oversValue.split('.')
  const oversInt = Number.parseInt(oversPart || '0', 10)
  const ballsInt = Number.parseInt(ballsPart || '0', 10)
  return oversInt * 6 + ballsInt
}

const formatDateTimeLong = (date, time) => {
  if (!date) return 'TBA'
  try {
    return new Date(`${date}T${time || '00:00'}`).toLocaleString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (err) {
    return `${date} ${time || ''}`.trim()
  }
}

const formatDateShort = (date) => {
  if (!date) return 'TBA'
  try {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch (err) {
    return date
  }
}

const formatTimeOnly = (date, time) => {
  if (!date) return time || 'TBA'
  try {
    return new Date(`${date}T${time || '00:00'}`).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (err) {
    return time || 'TBA'
  }
}

const getTeamDisplayName = (match, primary, fallback, fallbackKey = 'team') => {
  return match?.[primary] || match?.[fallback] || match?.[fallbackKey] || 'Team'
}

const sortLineupByBattingOrder = (lineup = []) =>
  [...lineup].sort((a, b) => (a.battingPosition ?? 999) - (b.battingPosition ?? 999))

const getInningsTotals = (match, teamKey) => {
  if (!match) {
    return { runs: 0, wickets: 0, overs: '0.0', balls: 0 }
  }
  const suffix = teamKey === 'teamA' ? '1' : '2'
  const scoreChunk = match.score?.[teamKey] || {}
  const runs = scoreChunk.runs ?? match[`runs${suffix}`] ?? 0
  const wickets = scoreChunk.wickets ?? match[`wickets${suffix}`] ?? 0
  const overs = scoreChunk.overs ?? match[`overs${suffix}`] ?? '0.0'
  const balls = scoreChunk.balls ?? match[`balls${suffix}`] ?? oversToBalls(overs)
  return { runs, wickets, overs, balls }
}

const getRunRate = (runs, balls) => {
  if (!balls) return null
  return (runs / (balls / 6)).toFixed(2)
}

// Extract first name from full name
const getFirstName = (fullName) => {
  if (!fullName) return ''
  return fullName.trim().split(' ')[0]
}

// Format dismissal text to show only first names
const formatDismissalText = (dismissalText) => {
  if (!dismissalText) return ''
  
  // Common dismissal patterns:
  // "c Full Name b Full Name" -> "c FirstName b FirstName"
  // "st Full Name b Full Name" -> "st FirstName b FirstName"
  // "lbw Full Name" -> "lbw FirstName"
  // "b Full Name" -> "b FirstName"
  // "run out (Full Name)" -> "run out (FirstName)"
  
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
  
  // Pattern: "obstructing the field" - keep as is
  // Pattern: "retired hurt" or "retired not out" - keep as is
  
  return formatted
}

const getPlayerStatusLabel = (player, dismissalMap) => {
  if (!player) return ''
  if (player.status === 'out') {
    const dismissal =
      player.dismissalText ||
      dismissalMap?.get(player.playerId)?.dismissalText ||
      dismissalMap?.get(player.playerId)?.wicketType
    return dismissal ? dismissal : 'Out'
  }
  // ICC Rule: Only show crease status if player is NOT out
  if (player.isOnCrease && player.status !== 'out') {
    const runs = player.runs ?? 0
    const balls = player.balls ?? 0
    return `${player.isOnStrike ? 'On strike' : 'On crease'} • ${runs} (${balls})`
  }
  if ((player.runs ?? 0) > 0 || (player.balls ?? 0) > 0) {
    return `Scored ${player.runs ?? 0} (${player.balls ?? 0})`
  }
  return 'Yet to bat'
}

const getPlayerStatLines = (player) => {
  const batting =
    (player.runs ?? 0) > 0 || (player.balls ?? 0) > 0
      ? `${player.runs ?? 0} (${player.balls ?? 0})`
      : null
  const bowlingBalls = player.bowlingBalls ?? 0
  const bowling =
    bowlingBalls > 0 || (player.bowlingWickets ?? 0) > 0
      ? `${ballsToOvers(bowlingBalls)} • ${player.bowlingRuns ?? 0}/${player.bowlingWickets ?? 0}`
      : null
  return { batting, bowling }
}

const getStatusAccent = (status) => {
  switch (status) {
    case 'Live':
      return 'bg-gradient-to-r from-emerald-500 to-green-600'
    case 'Upcoming':
      return 'bg-gradient-to-r from-blue-500 to-sky-500'
    default:
      return 'bg-gradient-to-r from-slate-600 to-slate-700'
  }
}

const MatchDetails = () => {
  const { matchId } = useParams()
  const location = useLocation()
  const commentaryEndRef = useRef(null)

  const [matchData, setMatchData] = useState(location.state || null)
  const [commentary, setCommentary] = useState([])
  const [loading, setLoading] = useState(true)
  const [teamASquadPlayers, setTeamASquadPlayers] = useState([])
  const [teamBSquadPlayers, setTeamBSquadPlayers] = useState([])
  const [playingXICollapsed, setPlayingXICollapsed] = useState({ teamA: false, teamB: false })
  const [selectedScoreboardTeam, setSelectedScoreboardTeam] = useState('teamA')

  useEffect(() => {
    if (!matchId) {
      setLoading(false)
      return
    }

    const unsubscribeMatch = subscribeToMatch(matchId, async (match) => {
      setMatchData(match || null)
      setLoading(false)
      
      // Load squad players for both teams
      if (match) {
        try {
          const [teamAPlayers, teamBPlayers] = await Promise.all([
            match.teamASquadId ? playersAPI.getAll({ squadId: match.teamASquadId }) : Promise.resolve({ data: [] }),
            match.teamBSquadId ? playersAPI.getAll({ squadId: match.teamBSquadId }) : Promise.resolve({ data: [] }),
          ])
          setTeamASquadPlayers(teamAPlayers.data || [])
          setTeamBSquadPlayers(teamBPlayers.data || [])
        } catch (error) {
          console.error('Error loading squad players:', error)
          setTeamASquadPlayers([])
          setTeamBSquadPlayers([])
        }
      } else {
        setTeamASquadPlayers([])
        setTeamBSquadPlayers([])
      }
    })

    const unsubscribeCommentary = subscribeToCommentary(matchId, (comments) => {
      setCommentary(comments || [])
    })

    return () => {
      unsubscribeMatch?.()
      unsubscribeCommentary?.()
    }
  }, [matchId])

  useEffect(() => {
    if (matchData?.status === 'Live' && commentaryEndRef.current && commentary.length > 0) {
      commentaryEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [commentary, matchData?.status])

  // All hooks must be called before any conditional returns
  const isLive = matchData?.status === 'Live'
  const isUpcoming = matchData?.status === 'Upcoming'
  const isFinished = matchData?.status === 'Finished' || matchData?.status === 'Completed'

  const teamAName = useMemo(() => getTeamDisplayName(matchData, 'teamAName', 'team1', 'teamA'), [matchData])
  const teamBName = useMemo(() => getTeamDisplayName(matchData, 'teamBName', 'team2', 'teamB'), [matchData])

  const teamAStats = useMemo(() => matchData ? getInningsTotals(matchData, 'teamA') : { runs: 0, wickets: 0, overs: '0.0', balls: 0 }, [matchData])
  const teamBStats = useMemo(() => matchData ? getInningsTotals(matchData, 'teamB') : { runs: 0, wickets: 0, overs: '0.0', balls: 0 }, [matchData])

  const fallOfWicketsByTeam = useMemo(() => {
    const result = { teamA: [], teamB: [] }
    if (matchData?.fallOfWickets) {
      matchData.fallOfWickets.forEach((entry) => {
        if (entry.team === 'teamA') result.teamA.push(entry)
        if (entry.team === 'teamB') result.teamB.push(entry)
      })
    }
    return result
  }, [matchData?.fallOfWickets])

  const dismissalMap = useMemo(
    () => ({
      teamA: new Map(fallOfWicketsByTeam.teamA.map((fow) => [fow.batsmanId, fow])),
      teamB: new Map(fallOfWicketsByTeam.teamB.map((fow) => [fow.batsmanId, fow])),
    }),
    [fallOfWicketsByTeam]
  )

  const teamAPlayingXI = useMemo(() => matchData ? sortLineupByBattingOrder(matchData.teamAPlayingXI || []) : [], [matchData?.teamAPlayingXI])
  const teamBPlayingXI = useMemo(() => matchData ? sortLineupByBattingOrder(matchData.teamBPlayingXI || []) : [], [matchData?.teamBPlayingXI])

  const targetRuns = useMemo(() => matchData?.targetRuns ?? null, [matchData?.targetRuns])
  const runsRequired = useMemo(() => targetRuns != null ? Math.max(targetRuns - (teamBStats.runs || 0), 0) : null, [targetRuns, teamBStats.runs])
  const displayCommentary = useMemo(() => commentary.length > 0 ? commentary : (matchData?.commentary || []), [commentary, matchData?.commentary])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <div className="text-6xl text-gray-300 mb-4">🏏</div>
            <p className="text-gray-600 text-lg">Loading match data...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!matchData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <div className="text-6xl text-gray-300 mb-4">❌</div>
            <p className="text-gray-600 text-lg">Match not found.</p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center text-teal-600 hover:text-teal-700"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const renderPlayingXI = (teamKey) => {
    const lineup = teamKey === 'teamA' ? teamAPlayingXI : teamBPlayingXI
    const lineupSet = teamKey === 'teamA' ? matchData.teamALineupSet : matchData.teamBLineupSet
    const teamLabel = teamKey === 'teamA' ? teamAName : teamBName
    const map = teamKey === 'teamA' ? dismissalMap.teamA : dismissalMap.teamB
    const squadPlayers = teamKey === 'teamA' ? teamASquadPlayers : teamBSquadPlayers
    
    // Get Playing XI player IDs (handle both playerId and id fields)
    const playingXIPlayerIds = new Set(
      lineup
        .map(p => p.playerId || p.id)
        .filter(Boolean)
    )
    
    // Separate bench players (in squad but not in Playing XI)
    const benchPlayers = squadPlayers.filter(p => {
      const playerId = p.id || p.playerId
      return playerId && !playingXIPlayerIds.has(playerId)
    })

    const renderPlayerCard = (player, isBench = false) => {
      const statusLabel = getPlayerStatusLabel(player, map)
      const { batting, bowling } = getPlayerStatLines(player)
      const linkProps = player.playerId || player.id ? { to: `/player/${player.playerId || player.id}` } : { to: '#', onClick: (e) => e.preventDefault() }
      const playerName = player.name
      const playerRole = player.role || 'Player'
      const playerPhoto = player.photo
      const isCaptain = player.isCaptain
      const isKeeper = player.isKeeper
      
      return (
        <Link
          key={player.playerId || player.id || player.name}
          {...linkProps}
          className={`flex items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition hover:shadow-md ${
            player.playerId || player.id ? '' : 'pointer-events-none'
          }`}
        >
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600">
            {playerPhoto ? (
              <img
                src={playerPhoto}
                alt={playerName}
                className="h-full w-full object-cover"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            ) : (
              playerName?.charAt(0) || 'P'
            )}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`text-sm font-semibold ${isBench ? 'text-gray-600' : 'text-gray-900'}`}>
                {playerName}
                {isKeeper && <span className="text-yellow-600 ml-1">(wk)</span>}
                {isCaptain && <span className="text-yellow-600 ml-1">(c)</span>}
              </p>
            </div>
            <p className="text-xs text-gray-500">{playerRole}</p>
            {!isBench && statusLabel && (
              <p className="mt-1 text-xs text-gray-700">{statusLabel}</p>
            )}
            {!isBench && batting && (
              <p className="mt-1 text-[11px] text-gray-500">Batting: {batting}</p>
            )}
            {!isBench && bowling && <p className="text-[11px] text-gray-500">Bowling: {bowling}</p>}
            {isBench && (
              <p className="mt-1 text-xs text-red-600 font-semibold">OUT ▼</p>
            )}
            {!isBench && !statusLabel && !batting && !bowling && (
              <p className="mt-1 text-xs text-gray-500">Yet to play</p>
            )}
          </div>
        </Link>
      )
    }

    const isCollapsed = playingXICollapsed[teamKey]
    const toggleCollapse = () => {
      setPlayingXICollapsed(prev => ({
        ...prev,
        [teamKey]: !prev[teamKey]
      }))
    }

    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">{teamLabel}</h3>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold ${lineupSet ? 'text-green-600' : 'text-gray-400'}`}>
              {lineupSet ? 'Confirmed' : 'Not announced'}
            </span>
            {lineupSet && lineup.length > 0 && (
              <button
                onClick={toggleCollapse}
                className="text-xs text-gray-500 hover:text-gray-700 font-semibold"
              >
                {isCollapsed ? 'Expand' : 'Minimize'}
              </button>
            )}
          </div>
        </div>
        {lineupSet && lineup.length > 0 ? (
          <div className={isCollapsed ? 'p-6' : 'p-6'}>
            {!isCollapsed && (
              <>
                {/* Playing XI Section */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Playing XI</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    {lineup.map((player) => renderPlayerCard(player, false))}
                  </div>
                </div>
                
                {/* Bench Section */}
                {benchPlayers.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">On Bench</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      {benchPlayers.map((player) => renderPlayerCard(player, true))}
                    </div>
                  </div>
                )}
              </>
            )}
            {isCollapsed && (
              <div className="text-sm text-gray-600">
                <p className="font-semibold mb-2">Playing XI: {lineup.length} players</p>
                {benchPlayers.length > 0 && (
                  <p className="text-gray-500">On Bench: {benchPlayers.length} players</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-sm text-gray-500">
            Playing XI will be announced closer to the start of play.
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        <Link
          to="/"
          className="inline-flex items-center text-cricbuzz-green hover:text-green-700 font-medium transition"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>

        <div className="rounded-3xl overflow-hidden shadow-lg">
          <div className={`${getStatusAccent(matchData.status)} text-white px-6 py-6`}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-white/80">{matchData.venue || 'Venue TBA'}</p>
                <p className="text-xs text-white/70">
                  {formatDateShort(matchData.date)} • {formatTimeOnly(matchData.date, matchData.time)} • {matchData.format || 'T20'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {isLive && (
                  <span className="flex items-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-red-600">
                    <span className="mr-2 h-2 w-2 animate-ping rounded-full bg-red-500" />
                    Live
                  </span>
                )}
                {isUpcoming && (
                  <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white">
                    Upcoming
                  </span>
                )}
                {isFinished && (
                  <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white">
                    Completed
                  </span>
                )}
                {isLive && (
                  <Link
                    to={`/live/${matchData.id}`}
                    className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white/90 hover:bg-white/25"
                  >
                    Open Live Scoreboard
                    <span aria-hidden>→</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Show scores for live/finished matches, team names for upcoming */}
            {isUpcoming ? (
              <div className="mt-6">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{teamAName}</p>
                    {matchData.teamALineupSet && (
                      <p className="text-xs text-white/70 mt-1">Playing XI Set</p>
                    )}
                  </div>
                  <span className="text-xl font-bold text-white/80">vs</span>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{teamBName}</p>
                    {matchData.teamBLineupSet && (
                      <p className="text-xs text-white/70 mt-1">Playing XI Set</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <p className="text-lg font-semibold text-white/80">{teamAName}</p>
                  <div className="mt-2 flex items-end gap-3">
                    <span className="text-4xl font-bold">{teamAStats.runs}</span>
                    <span className="text-2xl font-semibold text-white/80">/{teamAStats.wickets}</span>
                  </div>
                  <p className="text-xs text-white/80 mt-1">Overs: {teamAStats.overs}</p>
                  {getRunRate(teamAStats.runs, teamAStats.balls) && (
                    <p className="text-xs text-white/70">Run rate: {getRunRate(teamAStats.runs, teamAStats.balls)}</p>
                  )}
                </div>
                <div className="text-left md:text-right">
                  <p className="text-lg font-semibold text-white/80">{teamBName}</p>
                  <div className="mt-2 flex items-end gap-3 justify-start md:justify-end">
                    <span className="text-4xl font-bold">{teamBStats.runs}</span>
                    <span className="text-2xl font-semibold text-white/80">/{teamBStats.wickets}</span>
                  </div>
                  <p className="text-xs text-white/80 mt-1">Overs: {teamBStats.overs}</p>
                  {getRunRate(teamBStats.runs, teamBStats.balls) && (
                    <p className="text-xs text-white/70">Run rate: {getRunRate(teamBStats.runs, teamBStats.balls)}</p>
                  )}
                </div>
              </div>
            )}

            {matchData.resultSummary && (
              <p className="mt-4 text-sm font-semibold text-white/90">
                {matchData.resultSummary}
              </p>
            )}
            {matchData.matchPhase === 'InningsBreak' && matchData.inningsBreakMessage && (
              <p className="mt-2 text-xs text-white/75">{matchData.inningsBreakMessage}</p>
            )}
            {isUpcoming && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-white/75">
                  Starts {formatDateTimeLong(matchData.date, matchData.time)}
                </p>
                {matchData.tossWinnerName && matchData.tossDecision && (
                  <p className="text-sm font-semibold text-white/90">
                    🪙 {matchData.tossWinnerName} won the toss and chose to{' '}
                    {matchData.tossDecision === 'bat' ? 'bat first' : 'field first'}
                  </p>
                )}
                {matchData.teamALineupSet && matchData.teamBLineupSet && (
                  <p className="text-xs text-white/80">✓ Playing XI confirmed</p>
                )}
              </div>
            )}
            {isFinished && matchData.resultSummary && (
              <div className="mt-4">
                <p className="text-base font-bold text-white">{matchData.resultSummary}</p>
              </div>
            )}
            {targetRuns != null && !isFinished && (
              <p className="mt-2 text-xs font-semibold text-white">
                Target: {targetRuns} • {runsRequired > 0 ? `${runsRequired} more needed` : 'Scores level'}
              </p>
            )}
          </div>

          <div className="bg-white px-6 py-5 border-t border-gray-100 grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Match Info</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Venue</span>
                  <span className="font-semibold text-gray-800">{matchData.venue || 'TBA'}</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Date</span>
                  <span className="font-semibold text-gray-800">{formatDateShort(matchData.date)}</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Start Time</span>
                  <span className="font-semibold text-gray-800">{formatTimeOnly(matchData.date, matchData.time)}</span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Overs / Innings</span>
                  <span className="font-semibold text-gray-800">{matchData.oversLimit ? `${matchData.oversLimit} overs` : 'Not set'}</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Status</h3>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-gray-500">Phase</span>
                  <span className="font-semibold text-gray-800">{matchData.matchPhase || matchData.status}</span>
                </li>
                {matchData.currentBatting && (
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-gray-500">Batting</span>
                    <span className="font-semibold text-gray-800">{matchData.currentBatting}</span>
                  </li>
                )}
                {matchData.currentBowler && (
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-gray-500">Bowler</span>
                    <span className="font-semibold text-gray-800">{matchData.currentBowler}</span>
                  </li>
                )}
                {targetRuns != null && (
                  <li className="flex items-center justify-between gap-3">
                    <span className="text-gray-500">Target</span>
                    <span className="font-semibold text-gray-800">{targetRuns}</span>
                  </li>
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Toss</h3>
              <div className="mt-3 text-sm text-gray-600">
                {matchData.tossWinnerName ? (
                  <p>
                    {matchData.tossWinnerName} won the toss and chose to{' '}
                    {matchData.tossDecision === 'bat' ? 'bat' : matchData.tossDecision === 'bowl' ? 'field' : 'decide later'}.
                  </p>
                ) : (
                  <p>Toss not recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scoreboard for Finished Matches */}
        {isFinished && (() => {
          const selectedTeam = selectedScoreboardTeam === 'teamA' ? 'teamA' : 'teamB'
          const selectedTeamName = selectedTeam === 'teamA' ? teamAName : teamBName
          const selectedTeamStats = selectedTeam === 'teamA' ? teamAStats : teamBStats
          const selectedPlayingXI = selectedTeam === 'teamA' ? teamAPlayingXI : teamBPlayingXI
          const selectedDismissalMap = selectedTeam === 'teamA' ? dismissalMap.teamA : dismissalMap.teamB
          
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
                        {teamAStats.runs}/{teamAStats.wickets} ({teamAStats.overs} ov)
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
                        {teamBStats.runs}/{teamBStats.wickets} ({teamBStats.overs} ov)
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
                      // Get fall of wickets for selected team
                      const teamFallOfWickets = selectedTeam === 'teamA' ? fallOfWicketsByTeam.teamA : fallOfWicketsByTeam.teamB
                      
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
                      // Players in fallOfWickets get their position from the array order
                      // For players who batted but didn't get out, assign positions sequentially after last wicket
                      let nextPosition = teamFallOfWickets.length + 1
                      const notOutPlayers = battedPlayers.filter(player => {
                        const playerId = player.playerId || player.id
                        const isOut = player.status === 'out' || player.isOut
                        return !actualBattingOrder.has(playerId) && !isOut
                      })
                      
                      // Sort not-out players by their original batting position (battingPosition field) to maintain order
                      notOutPlayers.sort((a, b) => (a.battingPosition ?? 999) - (b.battingPosition ?? 999))
                      
                      notOutPlayers.forEach(player => {
                        const playerId = player.playerId || player.id
                        if (!actualBattingOrder.has(playerId)) {
                          actualBattingOrder.set(playerId, nextPosition)
                          nextPosition++
                        }
                      })
                      
                      // Also handle case where first two batsmen might not be in fallOfWickets (if they're still batting)
                      // Check if positions 1 and 2 are missing
                      const hasPosition1 = Array.from(actualBattingOrder.values()).includes(1)
                      const hasPosition2 = Array.from(actualBattingOrder.values()).includes(2)
                      
                      if (!hasPosition1 || !hasPosition2) {
                        // Find players who batted but don't have positions yet
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
                              const dismissalInfo = selectedDismissalMap.get(player.playerId || player.id)
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
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">{selectedTeamName} - Bowling</h3>
                  <div className="overflow-x-auto">
                    {bowlers.length > 0 ? (
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
                            const maidens = player.bowlingMaidens || 0
                            const economy = ballsBowled > 0 ? ((runsConceded / ballsBowled) * 6).toFixed(2) : '0.00'

                            return (
                              <tr
                                key={player.playerId || player.id || idx}
                                className={`border-b border-gray-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                              >
                                <td className="py-3 px-2">
                                  {player.playerId || player.id ? (
                                    <Link
                                      to={`/player/${player.playerId || player.id}`}
                                      className="font-semibold text-gray-900 hover:text-[#0D8F61] transition-colors cursor-pointer"
                                    >
                                      {player.name}
                                      {player.isCaptain && <span className="text-gray-600 ml-1">(c)</span>}
                                    </Link>
                                  ) : (
                                    <span className="font-semibold text-gray-900">
                                      {player.name}
                                      {player.isCaptain && <span className="text-gray-600 ml-1">(c)</span>}
                                    </span>
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
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No bowling statistics available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        <div className="grid gap-6 lg:grid-cols-2">
          {renderPlayingXI('teamA')}
          {renderPlayingXI('teamB')}
        </div>

        <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">Ball-by-Ball Commentary</h2>
            {isLive && (
              <span className="flex items-center text-sm font-semibold text-red-600">
                <span className="mr-2 h-2 w-2 animate-ping rounded-full bg-red-500" />
                Live updates
              </span>
            )}
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            <div className="divide-y divide-gray-100">
              {displayCommentary.length > 0 ? (
                displayCommentary.map((comment, idx) => (
                  <div
                    key={`${comment.over}-${comment.ball}-${idx}`}
                    className={`px-6 py-4 transition-colors ${idx === 0 && isLive ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="rounded bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">
                          {comment.over}
                        </span>
                        <span className="text-xs text-gray-500">ball {comment.ball}</span>
                        <span
                          className={`text-sm font-bold px-2 py-1 rounded ${
                            comment.isWicket
                              ? 'bg-red-100 text-red-700'
                              : comment.runs === 4 || comment.runs === 6
                              ? 'bg-green-100 text-green-700'
                              : comment.runs === 0
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {comment.isWicket ? 'W' : comment.runs === 0 ? '•' : comment.runs}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {comment.timestamp?.toDate
                          ? comment.timestamp
                              .toDate()
                              .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : comment.timestamp || ''}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-700">
                      {comment.batsman && (
                        <span className="font-semibold text-gray-900">{comment.batsman}</span>
                      )}
                      {comment.bowler && comment.batsman !== comment.bowler && (
                        <span className="text-gray-600"> to {comment.bowler}</span>
                      )}
                      {comment.batsman && <span className="text-gray-600">: </span>}
                      <span className="italic text-gray-700">{comment.text}</span>
                      {comment.dismissal && (
                        <p className="mt-2 text-xs font-semibold text-red-600">{comment.dismissal}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-12 text-center text-gray-500">
                  <div className="text-4xl mb-3">📝</div>
                  <p>No commentary yet. Updates will appear once play begins.</p>
                </div>
              )}
              <div ref={commentaryEndRef} />
            </div>
          </div>
          {isLive && (
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 text-center text-xs text-gray-500">
              Commentary refreshes automatically. Scroll down for latest updates.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MatchDetails

