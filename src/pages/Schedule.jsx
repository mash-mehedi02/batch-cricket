import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { matchesAPI, tournamentsAPI } from '../services/api'

const Schedule = () => {
  const [activeTab, setActiveTab] = useState('all')
  const [allMatches, setAllMatches] = useState([])
  const [liveMatches, setLiveMatches] = useState([])
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [completedMatches, setCompletedMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tournaments, setTournaments] = useState([])
  const [selectedTournamentId, setSelectedTournamentId] = useState('all')
  const [tournamentLoading, setTournamentLoading] = useState(true)

  // Load tournaments
  useEffect(() => {
    const loadTournaments = async () => {
      try {
        setTournamentLoading(true)
        const response = await tournamentsAPI.getAll()
        const list = response.data || []
        setTournaments(list)
        if (list.length > 0 && selectedTournamentId === 'all') {
          setSelectedTournamentId(list[0].id)
        }
      } catch (err) {
        console.error('Error loading tournaments:', err)
        setTournaments([])
      } finally {
        setTournamentLoading(false)
      }
    }
    loadTournaments()
  }, [])

  // Load all matches
  useEffect(() => {
    const loadMatches = async () => {
      try {
        setLoading(true)
        setError('')
        
        const [liveResponse, upcomingResponse, completedResponse, finishedResponse] = await Promise.all([
          matchesAPI.getAll({ status: 'Live' }),
          matchesAPI.getAll({ status: 'Upcoming' }),
          matchesAPI.getAll({ status: 'Completed' }),
          matchesAPI.getAll({ status: 'Finished' }),
        ])

        console.log('Schedule API Responses:', {
          live: liveResponse,
          upcoming: upcomingResponse,
          completed: completedResponse,
          finished: finishedResponse,
        })

        // Handle different response structures
        const liveData = Array.isArray(liveResponse?.data) ? liveResponse.data : (Array.isArray(liveResponse) ? liveResponse : [])
        const upcomingData = Array.isArray(upcomingResponse?.data) ? upcomingResponse.data : (Array.isArray(upcomingResponse) ? upcomingResponse : [])
        const completedData = [
          ...(Array.isArray(completedResponse?.data) ? completedResponse.data : (Array.isArray(completedResponse) ? completedResponse : [])),
          ...(Array.isArray(finishedResponse?.data) ? finishedResponse.data : (Array.isArray(finishedResponse) ? finishedResponse : [])),
        ]

        console.log('Processed match data:', {
          live: liveData.length,
          upcoming: upcomingData.length,
          completed: completedData.length,
        })

        // Combine all matches
        const allMatchesData = [...liveData, ...upcomingData, ...completedData]
        
        // Sort by date and time
        const sortedMatches = allMatchesData.sort((a, b) => {
          const dateA = new Date(`${a.date}T${a.time || '00:00'}`)
          const dateB = new Date(`${b.date}T${b.time || '00:00'}`)
          return dateA - dateB
        })

        setAllMatches(sortedMatches)
        setLiveMatches(liveData)
        setUpcomingMatches(upcomingData)
        setCompletedMatches(completedData)
      } catch (err) {
        console.error('Error loading matches:', err)
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
        })
        setError(`Failed to load match schedule: ${err.message || 'Please check if backend server is running on port 5050'}`)
        setAllMatches([])
        setLiveMatches([])
        setUpcomingMatches([])
        setCompletedMatches([])
      } finally {
        setLoading(false)
      }
    }

    loadMatches()
    
    // Refresh every 30 seconds for live matches
    const interval = setInterval(() => {
      loadMatches()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const selectedTournament = tournaments.find((t) => t.id === selectedTournamentId) || null

  // Filter matches based on active tab and tournament
  const filteredMatches = useMemo(() => {
    let matches = []
    
    switch (activeTab) {
      case 'live':
        matches = liveMatches
        break
      case 'upcoming':
        matches = upcomingMatches
        break
      case 'completed':
        matches = completedMatches
        break
      default:
        matches = allMatches
    }

    // Filter by tournament if selected
    if (selectedTournamentId && selectedTournamentId !== 'all') {
      matches = matches.filter((match) => match.tournamentId === selectedTournamentId)
    }

    // Sort matches by date and time
    return matches.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || '00:00'}`)
      const dateB = new Date(`${b.date}T${b.time || '00:00'}`)
      return dateA - dateB
    })
  }, [activeTab, selectedTournamentId, allMatches, liveMatches, upcomingMatches, completedMatches])

  // Group matches by date
  const matchesByDate = useMemo(() => {
    const grouped = {}
    filteredMatches.forEach((match) => {
      const dateKey = match.date || 'TBD'
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(match)
    })
    return grouped
  }, [filteredMatches])

  // Format date for display
  const formatDateHeader = (dateString) => {
    if (!dateString || dateString === 'TBD') return 'TBD'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  // Format time
  const formatTime = (time) => {
    if (!time) return 'TBD'
    try {
      const [hours, minutes] = time.split(':')
      const hour12 = parseInt(hours) % 12 || 12
      const ampm = parseInt(hours) >= 12 ? 'PM' : 'AM'
      return `${hour12}:${minutes} ${ampm}`
    } catch {
      return time
    }
  }

  // Format score
  const formatScore = (match, teamKey) => {
    if (match.status === 'Live' || match.status === 'Completed' || match.status === 'Finished') {
      if (match.score?.[teamKey]) {
        const score = match.score[teamKey]
        return `${score.runs}/${score.wickets} (${score.overs} ov)`
      }
      // Fallback to old format
      if (teamKey === 'teamA') {
        return `${match.runs1 || 0}/${match.wickets1 || 0} (${match.overs1 || '0.0'} ov)`
      }
      return `${match.runs2 || 0}/${match.wickets2 || 0} (${match.overs2 || '0.0'} ov)`
    }
    return null
  }

  // Get team names
  const getTeamName = (match, key) => {
    if (key === 'teamA') {
      return match.teamAName || match.team1 || match.teamA || 'Team A'
    }
    return match.teamBName || match.team2 || match.teamB || 'Team B'
  }

  // Get status color and style
  const getStatusStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'live':
        return {
          bg: 'bg-red-50',
          text: 'text-red-700',
          border: 'border-red-200',
          badge: 'bg-red-500',
          pulse: true,
        }
      case 'upcoming':
        return {
          bg: 'bg-blue-50',
          text: 'text-blue-700',
          border: 'border-blue-200',
          badge: 'bg-blue-500',
          pulse: false,
        }
      case 'completed':
      case 'finished':
        return {
          bg: 'bg-green-50',
          text: 'text-green-700',
          border: 'border-green-200',
          badge: 'bg-green-500',
          pulse: false,
        }
      case 'cancelled':
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          border: 'border-gray-200',
          badge: 'bg-gray-500',
          pulse: false,
        }
      default:
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          border: 'border-gray-200',
          badge: 'bg-gray-500',
          pulse: false,
        }
    }
  }

  // Render match card
  const renderMatchCard = (match) => {
    const teamA = getTeamName(match, 'teamA')
    const teamB = getTeamName(match, 'teamB')
    const status = match.status || 'Upcoming'
    const statusStyle = getStatusStyle(status)
    const scoreA = formatScore(match, 'teamA')
    const scoreB = formatScore(match, 'teamB')
    const isLive = status === 'Live'
    const isCompleted = status === 'Completed' || status === 'Finished'

    return (
      <Link
        key={match.id}
        to={`/match/${match.id}`}
        className="group block bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-fade-in"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Teams & Score Section */}
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              {/* Team A */}
              <div className="flex items-center gap-3 flex-1">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0D8F61] to-[#18a56f] flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {teamA.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-900 text-lg">{teamA}</div>
                  {scoreA && (
                    <div className="text-sm font-semibold text-gray-700 mt-1">{scoreA}</div>
                  )}
                </div>
              </div>

              {/* VS */}
              <div className="text-gray-400 font-semibold text-lg">vs</div>

              {/* Team B */}
              <div className="flex items-center gap-3 flex-1">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {teamB.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-900 text-lg">{teamB}</div>
                  {scoreB && (
                    <div className="text-sm font-semibold text-gray-700 mt-1">{scoreB}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Result or Status */}
            {isCompleted && match.resultSummary && (
              <div className="mt-3 text-sm font-semibold text-green-700">
                🎯 {match.resultSummary}
              </div>
            )}
          </div>

          {/* Status & Info Section */}
          <div className="flex flex-col items-end gap-3 md:min-w-[200px]">
            {/* Status Badge */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusStyle.bg} ${statusStyle.border} border ${statusStyle.text} font-semibold text-sm`}>
              {isLive && (
                <span className={`w-2 h-2 rounded-full ${statusStyle.badge} ${statusStyle.pulse ? 'animate-pulse' : ''}`}></span>
              )}
              {isLive ? '🔥 LIVE' : status}
            </div>

            {/* Time & Venue */}
            <div className="text-right text-sm text-gray-600 space-y-1">
              <div className="flex items-center justify-end gap-1">
                <span>🕒</span>
                <span>{formatTime(match.time)}</span>
              </div>
              {match.venue && (
                <div className="flex items-center justify-end gap-1">
                  <span>📍</span>
                  <span>{match.venue}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F7F9FA] to-white">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-[#0D8F61] via-[#0d6b53] to-[#18a56f] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📅</span>
            <h1 className="text-4xl md:text-5xl font-bold">Tournament Schedule</h1>
          </div>
          {selectedTournament && selectedTournamentId !== 'all' ? (
            <div className="text-lg md:text-xl text-white/90 mt-2">
              {selectedTournament.name} {selectedTournament.year} • {selectedTournament.groupStage?.enabled ? 'Group Stage' : 'Knockout'} • {selectedTournament.knockoutStage?.enabled ? 'Knockouts' : ''}
            </div>
          ) : (
            <div className="text-lg md:text-xl text-white/90 mt-2">
              All Tournaments • Complete Match Schedule
            </div>
          )}
        </div>
        <div className="h-1 bg-white/20"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tournament Filter */}
        {!tournamentLoading && tournaments.length > 0 && (
          <div className="mb-6 flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedTournamentId('all')}
              className={`flex-shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                selectedTournamentId === 'all'
                  ? 'bg-[#0D8F61] text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-[#0D8F61] hover:text-[#0D8F61]'
              }`}
            >
              All Matches
            </button>
            {tournaments.map((tournament) => (
              <button
                key={tournament.id}
                onClick={() => setSelectedTournamentId(tournament.id)}
                className={`flex-shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                  selectedTournamentId === tournament.id
                    ? 'bg-[#0D8F61] text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:border-[#0D8F61] hover:text-[#0D8F61]'
                }`}
              >
                {tournament.name} {tournament.year}
              </button>
            ))}
          </div>
        )}

        {/* Filter Tabs - Cricbuzz Style */}
        <div className="mb-8 sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-gray-200 rounded-t-xl">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide px-2">
            {[
              { key: 'all', label: 'All Matches' },
              { key: 'upcoming', label: 'Upcoming' },
              { key: 'completed', label: 'Completed' },
              { key: 'live', label: 'Live', icon: '🔴' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-shrink-0 px-6 py-3 rounded-full font-semibold text-sm transition-all relative ${
                  activeTab === tab.key
                    ? 'bg-[#0D8F61] text-white shadow-md'
                    : 'bg-[#E5E7EB] text-gray-700 hover:bg-gray-300'
                }`}
              >
                {tab.icon && <span className="mr-2">{tab.icon}</span>}
                {tab.label}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white rounded-full"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4 animate-pulse">📅</div>
            <p className="text-gray-500 text-lg">Loading match schedule...</p>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-gray-500 text-lg">No matches found for this filter.</p>
          </div>
        ) : (
          /* Match List - Grouped by Date */
          <div className="space-y-8">
            {Object.keys(matchesByDate)
              .sort((a, b) => {
                if (a === 'TBD') return 1
                if (b === 'TBD') return -1
                return new Date(a) - new Date(b)
              })
              .map((dateKey) => (
                <div key={dateKey} className="animate-fade-in">
                  {/* Date Header */}
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 whitespace-nowrap">
                      {formatDateHeader(dateKey)}
                    </h2>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                  </div>

                  {/* Match Cards for this Date */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                    {matchesByDate[dateKey].map((match) => renderMatchCard(match))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Schedule
