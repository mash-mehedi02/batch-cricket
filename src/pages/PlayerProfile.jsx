import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { subscribeToPlayer } from '../services/playersService'
import { playersAPI, tournamentsAPI, squadsAPI } from '../services/api'
import PerformanceGraph from '../components/graphs/PerformanceGraph'

const PlayerProfile = () => {
  const { playerId } = useParams()
  const [playerData, setPlayerData] = useState(null)
  const [tournament, setTournament] = useState(null)
  const [squad, setSquad] = useState(null)
  const [matchPerformances, setMatchPerformances] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Subscribe to real-time player updates
  useEffect(() => {
    if (!playerId) {
      setLoading(false)
      return
    }

    // Load initial player data
    loadPlayerData()

    // Subscribe to real-time updates
    let unsubscribe = null
    try {
      unsubscribe = subscribeToPlayer(playerId, (player) => {
        if (player) {
          console.log('Player data updated via subscription:', player.name)
          setPlayerData(player)
          setError('')
          // Load tournament and matches when player data updates
          if (player.tournamentId) {
            loadTournamentData(player.tournamentId)
          }
          if (player.squadId) {
            loadSquadData(player.squadId)
          }
          loadMatchPerformances(player)
        } else {
          console.warn('Player subscription returned null for ID:', playerId)
          // Don't set error immediately, wait for initial load to complete
          // The error will be set in loadPlayerData if player doesn't exist
        }
      })
    } catch (subError) {
      console.error('Error setting up player subscription:', subError)
      // Continue with initial load even if subscription fails
    }

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [playerId])

  const loadPlayerData = async () => {
    try {
      setLoading(true)
      setError('')
      
      if (!playerId) {
        setError('Player ID is required')
        setLoading(false)
        return
      }

      console.log('Loading player data for ID:', playerId)
      const response = await playersAPI.getById(playerId)
      console.log('API Response:', response)
      
      // Handle different response structures
      // Backend returns: { success: true, data: {...} }
      // apiRequest returns the full JSON response
      let player = null
      if (response?.success && response?.data) {
        player = response.data
      } else if (response?.data) {
        player = response.data
      } else if (response?.id) {
        // Direct player object
        player = response
      } else {
        player = response
      }
      
      if (!player) {
        console.error('Player not found or invalid response:', response)
        setError('Player not found. The player may not exist in the database.')
        setLoading(false)
        return
      }

      // Ensure player has an id
      if (!player.id && playerId) {
        player.id = playerId
      }

      if (!player.id) {
        console.error('Player data missing ID:', player)
        setError('Invalid player data received')
        setLoading(false)
        return
      }

      console.log('Player data loaded successfully:', player.name || playerId)
      setPlayerData(player)

      // Load tournament if available
      if (player.tournamentId) {
        await loadTournamentData(player.tournamentId)
      }

      if (player.squadId) {
        await loadSquadData(player.squadId)
      }

      // Load match performances
      loadMatchPerformances(player)
    } catch (error) {
      console.error('Error loading player:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        playerId,
      })
      setError(error.message || 'Failed to load player data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadTournamentData = async (tournamentId) => {
    try {
      const response = await tournamentsAPI.getById(tournamentId)
      setTournament(response.data)
    } catch (error) {
      console.error('Error loading tournament:', error)
    }
  }

  const loadSquadData = async (squadId) => {
    try {
      const response = await squadsAPI.getById(squadId)
      setSquad(response.data)
    } catch (error) {
      console.error('Error loading squad:', error)
      setSquad(null)
    }
  }

  // Helper functions - defined before use
  const roundTo = (value, digits = 2) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return 0
    return Number(num.toFixed(digits))
  }

  const loadMatchPerformances = (player) => {
    const numeric = (value) => {
      const num = Number(value)
      return Number.isFinite(num) ? num : 0
    }

    const summaries = Array.isArray(player?.pastMatches) ? [...player.pastMatches] : []
    const performances = summaries.map((summary) => {
      const timestampValue =
        typeof summary.timestamp === 'number'
          ? summary.timestamp
          : summary.timestamp?.seconds
          ? summary.timestamp.seconds * 1000
          : summary.createdAt?.toDate
          ? summary.createdAt.toDate().getTime()
          : summary.date
          ? new Date(summary.date).getTime()
          : Date.now()
      const opponentName =
        summary.opponentName ||
        summary.opponent ||
        (summary.opponentSquadId ? `Opponent ${summary.opponentSquadId.slice(-4)}` : 'Opponent')
      return {
        ...summary,
        opponent: opponentName,
        timestamp: timestampValue,
        year:
          summary.year ||
          (summary.date
            ? new Date(summary.date).getFullYear()
            : new Date(timestampValue).getFullYear()),
        batted:
          summary.batted !== undefined
            ? summary.batted
            : numeric(summary.runs) > 0 || numeric(summary.balls) > 0,
        bowled:
          summary.bowled !== undefined
            ? summary.bowled
            : numeric(summary.ballsBowled) > 0 || numeric(summary.wickets) > 0,
        // notOut: true = not out, false = dismissed, undefined = didn't bat
        // If notOut is undefined, only set to true/false if player actually batted (has runs or balls)
        notOut: summary.notOut !== undefined 
          ? summary.notOut 
          : (summary.runs > 0 || summary.balls > 0 ? true : undefined),
        strikeRate:
          summary.strikeRate !== undefined
            ? summary.strikeRate
            : numeric(summary.balls) > 0
            ? (numeric(summary.runs) / numeric(summary.balls)) * 100
            : 0,
        economy:
          summary.economy !== undefined
            ? summary.economy
            : numeric(summary.ballsBowled) > 0
            ? numeric(summary.runsConceded) / (numeric(summary.ballsBowled) / 6)
            : 0,
      }
    })

    performances.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    setMatchPerformances(performances)
  }

  // Calculate overall stats
  const calculateStats = () => {
    if (!playerData) return null

    const stats = playerData.stats || {}
    const pastMatches = Array.isArray(playerData.pastMatches) ? playerData.pastMatches : []

    const numeric = (value) => {
      const num = Number(value)
      return Number.isFinite(num) ? num : 0
    }

    const aggregateFromMatches = pastMatches.reduce(
      (acc, match) => {
        const runs = numeric(match.runs)
        const balls = numeric(match.balls)
        const wickets = numeric(match.wickets)
        const ballsBowled = numeric(match.ballsBowled)
        const runsConceded = numeric(match.runsConceded)
        const fours = numeric(match.fours)
        const sixes = numeric(match.sixes)

        // Count match if:
        // 1. Player is in Playing XI and match started (played = true from backend)
        // 2. OR player has matchId (meaning they were in the match)
        // 3. OR player has any stats (runs, balls, wickets, ballsBowled) - means they participated
        const playedInMatch = match.played === true || 
                             match.matchId !== undefined || 
                             runs > 0 || balls > 0 || wickets > 0 || ballsBowled > 0
        if (playedInMatch) {
          acc.matches += 1
        }

        // Count batting innings if player batted in the match
        // ICC Rule: Innings count ONLY if player faced at least 1 ball (balls > 0) OR was dismissed (status === 'out')
        // If dismissed (e.g., run out on 0 balls), innings still count
        // Backend sets batted = true if: balls > 0 || status === 'out'
        // IMPORTANT: Don't count if player has runs = 0 AND balls = 0 (didn't actually bat)
        // Only count innings if:
        // 1. Player faced at least 1 ball (balls > 0), OR
        // 2. Backend says batted = true AND (runs > 0 OR balls > 0 OR notOut === false), OR
        // 3. Player was dismissed (notOut === false) AND has some batting activity (runs > 0 OR balls === 0 but was in lineup)
        const isDismissed = match.notOut === false
        // Strict check: Only count innings if player actually batted (ICC Rule)
        // Innings count ONLY if:
        // 1. Player faced at least 1 ball (balls > 0), OR
        // 2. Player was dismissed (notOut === false) - even if 0 balls (run out case)
        // Don't count if runs = 0 AND balls = 0 AND notOut is not false (didn't bat)
        const hasBatted = balls > 0 || isDismissed
        if (hasBatted) {
          acc.battingInnings += 1
          if (match.notOut === true) {
            acc.notOuts += 1
          } else if (isDismissed) {
            acc.dismissals += 1
          } else {
            // If notOut is undefined but player has runs/balls, assume not out
            acc.notOuts += 1
          }
        }

        // Count bowling innings if player bowled at least 1 ball (bowled = true from backend)
        // Backend sets bowled = true if ballsBowled > 0
        const bowledInMatch = match.bowled === true || ballsBowled > 0
        if (bowledInMatch) {
          acc.bowlingInnings += 1
        }

        // Count match results
        if (match.result === 'Won') acc.wins += 1
        if (match.result === 'Lost') acc.losses += 1
        if (match.result === 'Tied') acc.ties += 1

        acc.runs += runs
        acc.balls += balls
        acc.wickets += wickets
        acc.ballsBowled += ballsBowled
        acc.runsConceded += runsConceded
        acc.fours += fours
        acc.sixes += sixes
        if (runs >= 50 && runs < 100) acc.fifties += 1
        if (runs >= 100) acc.hundreds += 1
        if (runs > acc.highest) acc.highest = runs

        return acc
      },
      {
        matches: 0,
        battingInnings: 0,
        bowlingInnings: 0,
        dismissals: 0,
        notOuts: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        runs: 0,
        balls: 0,
        wickets: 0,
        ballsBowled: 0,
        runsConceded: 0,
        fours: 0,
        sixes: 0,
        highest: 0,
        fifties: 0,
        hundreds: 0,
      }
    )

    // Use aggregateFromMatches.matches if available, otherwise use stats.matches, otherwise use pastMatches.length
    // This ensures we count matches where player was in Playing XI
    const matchesPlayed = aggregateFromMatches.matches > 0
      ? aggregateFromMatches.matches
      : numeric(stats.matches) > 0
      ? numeric(stats.matches)
      : pastMatches.length
    // Always use calculated innings from pastMatches (fresh calculation)
    // This ensures innings are recalculated correctly even if old stats are wrong
    // Only fallback to stats if pastMatches is empty
    const battingInnings = pastMatches.length > 0
      ? aggregateFromMatches.battingInnings
      : numeric(stats.battingInnings) || 0
    const bowlingInnings = numeric(stats.bowlingInnings) || aggregateFromMatches.bowlingInnings
    const dismissals = numeric(stats.dismissals) || aggregateFromMatches.dismissals
    const notOuts = numeric(stats.notOuts) || aggregateFromMatches.notOuts
    const wins = numeric(stats.wins) || aggregateFromMatches.wins
    const losses = numeric(stats.losses) || aggregateFromMatches.losses
    const ties = numeric(stats.ties) || aggregateFromMatches.ties
    const runs = numeric(stats.runs) || aggregateFromMatches.runs
    const balls = numeric(stats.balls) || aggregateFromMatches.balls
    const wickets = numeric(stats.wickets) || aggregateFromMatches.wickets
    const ballsBowled = numeric(stats.ballsBowled) || aggregateFromMatches.ballsBowled
    const runsConceded = numeric(stats.runsConceded) || aggregateFromMatches.runsConceded
    const fours = numeric(stats.fours) || aggregateFromMatches.fours
    const sixes = numeric(stats.sixes) || aggregateFromMatches.sixes
    const highest = numeric(stats.highest) || aggregateFromMatches.highest
    const fifties = numeric(stats.fifties) || aggregateFromMatches.fifties
    const hundreds = numeric(stats.hundreds) || aggregateFromMatches.hundreds

    const strikeRate = balls > 0 ? roundTo((runs / balls) * 100, 2) : 0
    // ICC Rule: Batting Average = Total Runs / Dismissals
    // If dismissals = 0 but player has innings, average = runs (not out)
    // If no innings, average = 0
    const average =
      dismissals > 0 
        ? roundTo(runs / dismissals, 2) 
        : battingInnings > 0 && runs > 0 
        ? roundTo(runs, 2) 
        : battingInnings > 0 
        ? '0.00' 
        : 0
    const economy = ballsBowled > 0 ? roundTo(runsConceded / (ballsBowled / 6), 2) : 0
    // ICC Rule: Bowling Average = Runs Conceded / Wickets
    // If wickets = 0, bowling average is undefined (not 0)
    // Display as Infinity (∞) or '-' if no wickets
    const bowlingAverage = wickets > 0 ? roundTo(runsConceded / wickets, 2) : runsConceded > 0 ? Infinity : 0
    const bowlingStrikeRate = wickets > 0 ? roundTo(ballsBowled / wickets, 2) : 0
    const winPercentage =
      matchesPlayed > 0 ? roundTo((wins / matchesPlayed) * 100, 1) : 0

    // Calculate best bowling figures
    let bestBowling = '0/0'
    let bestBowlingWickets = 0
    let bestBowlingRuns = 999
    pastMatches.forEach((match) => {
      const matchWickets = numeric(match.wickets)
      const matchRuns = numeric(match.runsConceded)
      if (matchWickets > bestBowlingWickets || (matchWickets === bestBowlingWickets && matchRuns < bestBowlingRuns)) {
        bestBowlingWickets = matchWickets
        bestBowlingRuns = matchRuns
        bestBowling = `${matchWickets}/${matchRuns}`
      }
    })

    return {
      matches: matchesPlayed,
      battingInnings,
      bowlingInnings,
      dismissals,
      notOuts,
      wins,
      losses,
      ties,
      winPercentage,
      runs,
      balls,
      wickets,
      ballsBowled,
      runsConceded,
      fours,
      sixes,
      highest,
      fifties,
      hundreds,
      strikeRate,
      average,
      economy,
      bowlingAverage,
      bowlingStrikeRate,
      bestBowling,
    }
  }

  // Calculate season-wise stats
  const seasonStats = useMemo(() => {
    if (!matchPerformances.length) return {}

    const grouped = {}
    matchPerformances.forEach((match) => {
      const year = match.year || new Date(match.timestamp || Date.now()).getFullYear()
      if (!grouped[year]) {
        grouped[year] = {
          matches: 0,
          battingInnings: 0,
          dismissals: 0,
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          highest: 0,
          fifties: 0,
          hundreds: 0,
          bowlingInnings: 0,
          ballsBowled: 0,
          runsConceded: 0,
          wickets: 0,
          bestBowling: '0/0',
          bestBowlingWickets: 0,
          bestBowlingRuns: 999,
        }
      }

      const numeric = (v) => {
        const n = Number(v)
        return Number.isFinite(n) ? n : 0
      }

      const runs = numeric(match.runs)
      const balls = numeric(match.balls)
      const wickets = numeric(match.wickets)
      const ballsBowled = numeric(match.ballsBowled)
      const runsConceded = numeric(match.runsConceded)
      const fours = numeric(match.fours)
      const sixes = numeric(match.sixes)

      // Count match if player is in Playing XI and match started OR has any participation stats
      const playedInMatch = match.played === true || 
                           match.matchId !== undefined || 
                           runs > 0 || balls > 0 || wickets > 0 || ballsBowled > 0
      if (playedInMatch) {
        grouped[year].matches += 1
      }

      // Count batting innings if player batted in the match
      // ICC Rule: Innings count ONLY if player faced at least 1 ball (balls > 0) OR was dismissed (status === 'out')
      // If dismissed (e.g., run out on 0 balls), innings still count
      // Backend sets batted = true if: balls > 0 || status === 'out'
      // IMPORTANT: Don't count if player has runs = 0 AND balls = 0 (didn't actually bat)
      // Only count innings if:
      // 1. Player faced at least 1 ball (balls > 0), OR
      // 2. Backend says batted = true AND (runs > 0 OR balls > 0 OR notOut === false), OR
      // 3. Player was dismissed (notOut === false) AND has some batting activity
      const isDismissed = match.notOut === false
      // Strict check: Only count innings if player actually batted (ICC Rule)
      // Innings count ONLY if:
      // 1. Player faced at least 1 ball (balls > 0), OR
      // 2. Player was dismissed (notOut === false) - even if 0 balls (run out case)
      // Don't count if runs = 0 AND balls = 0 AND notOut is not false (didn't bat)
      const hasBatted = balls > 0 || isDismissed
      if (hasBatted) {
        grouped[year].battingInnings += 1
        if (isDismissed) grouped[year].dismissals += 1
      }

      // Count bowling innings if player bowled at least 1 ball (bowled = true from backend)
      const bowledInMatch = match.bowled === true || ballsBowled > 0
      if (bowledInMatch) {
        grouped[year].bowlingInnings += 1
      }

      grouped[year].runs += runs
      grouped[year].balls += balls
      grouped[year].fours += fours
      grouped[year].sixes += sixes
      if (runs > grouped[year].highest) grouped[year].highest = runs
      if (runs >= 50 && runs < 100) grouped[year].fifties += 1
      if (runs >= 100) grouped[year].hundreds += 1

      grouped[year].wickets += wickets
      grouped[year].ballsBowled += ballsBowled
      grouped[year].runsConceded += runsConceded

      if (wickets > grouped[year].bestBowlingWickets || 
          (wickets === grouped[year].bestBowlingWickets && runsConceded < grouped[year].bestBowlingRuns)) {
        grouped[year].bestBowlingWickets = wickets
        grouped[year].bestBowlingRuns = runsConceded
        grouped[year].bestBowling = `${wickets}/${runsConceded}`
      }
    })

    // Calculate derived stats for each season
    Object.keys(grouped).forEach((year) => {
      const season = grouped[year]
      season.average = season.dismissals > 0 
        ? roundTo(season.runs / season.dismissals, 1) 
        : season.battingInnings > 0 ? roundTo(season.runs, 1) : 0
      season.strikeRate = season.balls > 0 
        ? roundTo((season.runs / season.balls) * 100, 1) 
        : 0
      season.economy = season.ballsBowled > 0 
        ? roundTo(season.runsConceded / (season.ballsBowled / 6), 2) 
        : 0
      // ICC Rule: Bowling Average = Runs Conceded / Wickets
      // If wickets = 0, bowling average is undefined (not 0)
      season.bowlingAverage = season.wickets > 0 
        ? roundTo(season.runsConceded / season.wickets, 1) 
        : season.runsConceded > 0 ? Infinity : 0
      season.bowlingStrikeRate = season.wickets > 0 
        ? roundTo(season.ballsBowled / season.wickets, 1) 
        : 0
    })

    return grouped
  }, [matchPerformances])

  const formatStat = (value, digits = 2) => {
    const num = Number(value)
    if (!Number.isFinite(num)) {
      // Handle Infinity (for bowling average when wickets = 0 but runsConceded > 0)
      if (num === Infinity || num === -Infinity) {
        return '∞'
      }
      return digits > 0 ? (0).toFixed(digits) : '0'
    }
    return digits > 0 ? num.toFixed(digits) : Math.round(num).toString()
  }

  const formatInteger = (value) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return '0'
    return Math.round(num).toLocaleString()
  }

  // Get role badge
  const getRoleBadge = (role) => {
    const roleLower = (role || '').toLowerCase()
    if (roleLower.includes('bat')) return '🏏 Batsman'
    if (roleLower.includes('bowl')) return '🎯 Bowler'
    if (roleLower.includes('all') || roleLower.includes('round')) return '🏏🎯 All-rounder'
    if (roleLower.includes('keep') || roleLower.includes('wicket')) return '👕 Wicket-keeper'
    return role || 'Player'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#0D8F61] text-6xl mb-4 animate-pulse">🏏</div>
          <p className="text-gray-600 font-medium">Loading player profile...</p>
        </div>
      </div>
    )
  }

  if (error || !playerData) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">❌</div>
          <p className="text-gray-600 text-lg mb-4 font-medium">{error || 'Player not found'}</p>
          <Link
            to="/squad"
            className="inline-block text-[#0D8F61] hover:text-[#0a7049] font-semibold transition-colors"
          >
            ← Back to Squad
          </Link>
        </div>
      </div>
    )
  }

  const stats = calculateStats()
  const seasons = Object.keys(seasonStats).sort((a, b) => parseInt(b) - parseInt(a))

  return (
    <div className="min-h-screen bg-[#F6F7F9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link
          to="/squad"
          className="inline-flex items-center text-[#0D8F61] hover:text-[#0a7049] mb-6 font-medium transition-colors"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Squad
        </Link>

        {/* 1️⃣ Player Profile Header (Hero Card) */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
          {/* Gradient Strip */}
          <div className="h-2 bg-gradient-to-r from-[#0D8F61] via-[#1FA06B] to-[#0D8F61]"></div>
          
          <div className="p-8 md:p-10">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
              {/* Player Photo */}
              <div className="relative flex-shrink-0">
                {playerData.photo ? (
                  <img
                    src={playerData.photo}
                    alt={playerData.name}
                    className="w-40 h-40 md:w-48 md:h-48 rounded-full border-4 border-[#0D8F61]/20 shadow-2xl object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div
                  className={`w-40 h-40 md:w-48 md:h-48 bg-gradient-to-br from-[#0D8F61] to-[#1FA06B] rounded-full flex items-center justify-center text-6xl md:text-7xl font-bold text-white shadow-2xl border-4 border-white ${
                    playerData.photo ? 'hidden' : ''
                  }`}
                >
                  {playerData.name?.charAt(0) || 'P'}
                </div>
              </div>

              {/* Player Info */}
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                  {playerData.name}
                </h1>
                
                {/* Role & Specialty Badges */}
                <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-4">
                  <span className="bg-[#0D8F61]/10 text-[#0D8F61] px-4 py-2 rounded-lg text-sm font-semibold border border-[#0D8F61]/20">
                    {getRoleBadge(playerData.role)}
                  </span>
                  {playerData.batch && (
                    <span className="bg-[#FFBA08]/10 text-[#FFBA08] px-4 py-2 rounded-lg text-sm font-semibold border border-[#FFBA08]/20">
                      Player of SMA '{playerData.batch}
                    </span>
                  )}
                  {playerData.batch && (
                    <span className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold">
                      Batch {playerData.batch}
                    </span>
                  )}
                </div>

                {/* Team & Tournament */}
                <div className="space-y-2 text-gray-600">
                  {(playerData?.squadName || squad?.teamName || squad?.name) && (
                    <div className="text-base">
                      <span className="font-semibold text-gray-700">Team:</span>{' '}
                      {playerData?.squadName || squad?.teamName || squad?.name}
                    </div>
                  )}
                  {tournament && (
                    <div className="text-base">
                      <span className="font-semibold text-gray-700">Tournament:</span>{' '}
                      {tournament.name} ({tournament.year || 'N/A'})
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Stats Badges */}
              {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full md:w-auto">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200 text-center">
                    <div className="text-xs text-blue-600 font-medium mb-1">Matches</div>
                    <div className="text-2xl font-bold text-blue-900">{formatInteger(stats.matches)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200 text-center">
                    <div className="text-xs text-green-600 font-medium mb-1">Runs</div>
                    <div className="text-2xl font-bold text-green-900">{formatInteger(stats.runs)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200 text-center">
                    <div className="text-xs text-purple-600 font-medium mb-1">Wickets</div>
                    <div className="text-2xl font-bold text-purple-900">{formatInteger(stats.wickets)}</div>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200 text-center">
                    <div className="text-xs text-orange-600 font-medium mb-1">Best</div>
                    <div className="text-2xl font-bold text-orange-900">
                      {stats.highest > 0 ? `${stats.highest}*` : '-'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2️⃣ Performance Graphs */}
        {matchPerformances.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {stats && stats.runs > 0 && (
              <PerformanceGraph 
                matchPerformances={matchPerformances} 
                type="runs"
                className="animate-fade-in"
                stats={stats}
              />
            )}
            {stats && stats.wickets > 0 && (
              <PerformanceGraph 
                matchPerformances={matchPerformances} 
                type="wickets"
                className="animate-fade-in"
              />
            )}
          </div>
        )}

        {/* 3️⃣ Career & Season Overview Cards */}
        {stats && (
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Batting Summary Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-[#0D8F61] to-[#1FA06B] px-6 py-4">
                <h2 className="text-xl font-bold text-white">Batting Summary</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-b border-gray-100 pb-3">
                    <div className="text-xs text-gray-500 mb-1">Matches</div>
                    <div className="text-2xl font-bold text-gray-900">{formatInteger(stats.matches)}</div>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <div className="text-xs text-gray-500 mb-1">Innings</div>
                    <div className="text-2xl font-bold text-gray-900">{formatInteger(stats.battingInnings)}</div>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <div className="text-xs text-gray-500 mb-1">Runs</div>
                    <div className="text-2xl font-bold text-gray-900">{formatInteger(stats.runs)}</div>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <div className="text-xs text-gray-500 mb-1">SR</div>
                    <div className="text-2xl font-bold text-gray-900">{formatStat(stats.strikeRate, 1)}</div>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <div className="text-xs text-gray-500 mb-1">Average</div>
                    <div className="text-2xl font-bold text-gray-900">{formatStat(stats.average, 1)}</div>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <div className="text-xs text-gray-500 mb-1">50s</div>
                    <div className="text-2xl font-bold text-gray-900">{formatInteger(stats.fifties)}</div>
                  </div>
                  <div className="pb-3">
                    <div className="text-xs text-gray-500 mb-1">100s</div>
                    <div className="text-2xl font-bold text-gray-900">{formatInteger(stats.hundreds)}</div>
                  </div>
                  <div className="pb-3">
                    <div className="text-xs text-gray-500 mb-1">HS</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {stats.highest > 0 ? `${stats.highest}*` : '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bowling Summary Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-r from-[#FFBA08] to-[#FFC940] px-6 py-4">
                <h2 className="text-xl font-bold text-white">Bowling Summary</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="border-b border-gray-100 pb-3">
                    <div className="text-xs text-gray-500 mb-1">Overs</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatStat(stats.ballsBowled / 6, 1)}
                    </div>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <div className="text-xs text-gray-500 mb-1">Wickets</div>
                    <div className="text-2xl font-bold text-gray-900">{formatInteger(stats.wickets)}</div>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <div className="text-xs text-gray-500 mb-1">Econ</div>
                    <div className="text-2xl font-bold text-gray-900">{formatStat(stats.economy, 2)}</div>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <div className="text-xs text-gray-500 mb-1">Best</div>
                    <div className="text-2xl font-bold text-gray-900">{stats.bestBowling || '-'}</div>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <div className="text-xs text-gray-500 mb-1">Avg</div>
                    <div className="text-2xl font-bold text-gray-900">{formatStat(stats.bowlingAverage, 1)}</div>
                  </div>
                  <div className="border-b border-gray-100 pb-3">
                    <div className="text-xs text-gray-500 mb-1">SR</div>
                    <div className="text-2xl font-bold text-gray-900">{formatStat(stats.bowlingStrikeRate, 1)}</div>
                  </div>
                  <div className="pb-3">
                    <div className="text-xs text-gray-500 mb-1">5w</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {matchPerformances.filter(m => m.wickets >= 5).length}
                    </div>
                  </div>
                  <div className="pb-3">
                    <div className="text-xs text-gray-500 mb-1">Innings</div>
                    <div className="text-2xl font-bold text-gray-900">{formatInteger(stats.bowlingInnings)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5️⃣ Season-by-Season Stats Tables */}
        {seasons.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8 border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-2xl font-bold text-gray-900">Season-by-Season Statistics</h2>
            </div>
            
            <div className="overflow-x-auto">
              {/* Batting Table */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  📌 Batting (Season-wise)
                </h3>
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b-2 border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Season</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Matches</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Runs</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Avg</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">SR</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">50s</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">HS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {seasons.map((year, idx) => {
                      const season = seasonStats[year]
                      return (
                        <tr key={year} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">{year}</td>
                          <td className="px-4 py-3 text-sm text-center text-gray-700">{formatInteger(season.matches)}</td>
                          <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900">{formatInteger(season.runs)}</td>
                          <td className="px-4 py-3 text-sm text-center text-gray-700">{formatStat(season.average, 1)}</td>
                          <td className="px-4 py-3 text-sm text-center text-gray-700">{formatStat(season.strikeRate, 1)}</td>
                          <td className="px-4 py-3 text-sm text-center text-gray-700">{formatInteger(season.fifties)}</td>
                          <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900">
                            {season.highest > 0 ? `${season.highest}*` : '-'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bowling Table */}
              {stats && stats.wickets > 0 && (
                <div className="p-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    📌 Bowling (Season-wise)
                  </h3>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b-2 border-gray-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Season</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Balls</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Runs</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Wkts</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Econ</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Best</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {seasons.map((year, idx) => {
                        const season = seasonStats[year]
                        if (season.wickets === 0) return null
                        return (
                          <tr key={year} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{year}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-700">{formatInteger(season.ballsBowled)}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-700">{formatInteger(season.runsConceded)}</td>
                            <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900">{formatInteger(season.wickets)}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-700">{formatStat(season.economy, 2)}</td>
                            <td className="px-4 py-3 text-sm text-center font-semibold text-gray-900">{season.bestBowling}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6️⃣ Recent Matches List */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-2xl font-bold text-gray-900">Recent Matches</h2>
            <p className="text-sm text-gray-600 mt-1">
              {matchPerformances.length} match{matchPerformances.length !== 1 ? 'es' : ''} played
            </p>
          </div>

          {matchPerformances.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="text-5xl mb-4">📊</div>
              <p className="text-lg font-medium">No match performances recorded yet</p>
              <p className="text-sm mt-2">Performance will appear here after matches are completed</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {matchPerformances.slice(0, 10).map((match, idx) => {
                const matchDateObj = match.date
                  ? new Date(match.date)
                  : new Date(match.timestamp || Date.now())
                const formattedDate = matchDateObj.toLocaleDateString('en-US', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
                const showedBatting = match.batted || match.runs > 0 || match.balls > 0
                const showedBowling =
                  match.bowled ||
                  match.wickets > 0 ||
                  (match.oversBowled && match.oversBowled !== '0.0')

                return (
                  <Link
                    key={idx}
                    to={match.matchId ? `/match/${match.matchId}` : '#'}
                    className="block p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      {/* Match Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-bold text-gray-900">
                            vs {match.opponent}
                          </h4>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              match.result === 'Won'
                                ? 'bg-green-100 text-green-800'
                                : match.result === 'Lost'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {match.result || 'N/A'}
                          </span>
                        </div>

                        {/* Performance Stats */}
                        <div className="flex flex-wrap items-center gap-4 text-sm mb-2">
                          {showedBatting && (
                            <span className="text-gray-700">
                              <span className="font-semibold text-gray-900">Runs:</span>{' '}
                              {formatInteger(match.runs)}
                              {match.balls > 0 && `(${match.balls})`}
                              {match.notOut && ' *'}
                              {match.strikeRate !== undefined && match.balls > 0 && (
                                <> • <span className="font-semibold">SR {formatStat(match.strikeRate, 1)}</span></>
                              )}
                            </span>
                          )}
                          {showedBowling && (
                            <span className="text-gray-700">
                              <span className="font-semibold text-gray-900">Wkts:</span>{' '}
                              {formatInteger(match.wickets)}
                              {match.runsConceded > 0 && `/${formatInteger(match.runsConceded)}`}
                              {match.economy !== undefined && (
                                <> • <span className="font-semibold">Eco {formatStat(match.economy, 2)}</span></>
                              )}
                            </span>
                          )}
                        </div>

                        {/* Match Result */}
                        {match.resultSummary && (
                          <div className="mt-2 text-sm font-semibold text-[#0D8F61]">
                            Result: {match.resultSummary}
                          </div>
                        )}
                        {!match.resultSummary && match.result && (
                          <div className="mt-2 text-sm text-gray-600">
                            {match.result === 'Won' && match.teamName && (
                              <span className="font-semibold text-green-700">
                                {match.teamName} won the match
                              </span>
                            )}
                            {match.result === 'Lost' && match.opponent && (
                              <span className="font-semibold text-red-700">
                                {match.opponent} won the match
                              </span>
                            )}
                            {match.result === 'Tied' && (
                              <span className="font-semibold text-gray-700">Match tied</span>
                            )}
                          </div>
                        )}

                        {/* Match Details */}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>{formattedDate}</span>
                          {match.venue && (
                            <>
                              <span>•</span>
                              <span>{match.venue}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Performance Badges */}
                      <div className="flex flex-wrap gap-2">
                        {match.runs >= 100 && (
                          <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-lg text-xs font-semibold">
                            💯 Century
                          </div>
                        )}
                        {match.runs >= 50 && match.runs < 100 && (
                          <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-lg text-xs font-semibold">
                            50+
                          </div>
                        )}
                        {match.wickets >= 5 && (
                          <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-lg text-xs font-semibold">
                            5 Wickets
                          </div>
                        )}
                        {match.wickets >= 3 && match.wickets < 5 && (
                          <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-lg text-xs font-semibold">
                            {formatInteger(match.wickets)} Wkts
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PlayerProfile
