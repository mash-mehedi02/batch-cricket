import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { matchesAPI, playersAPI, squadsAPI } from '../services/api'
import { subscribeToLiveMatches } from '../services/matchesService'

const getTeamName = (match, keyA = 'teamAName', keyFallbackA = 'team1', fallback = 'teamA') => {
  return match[keyA] || match[keyFallbackA] || match[fallback] || 'Team'
}

const formatDate = (date) => {
  if (!date) return 'TBD'
  try {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return date
  }
}

const formatDateTime = (date, time) => {
  if (!date) return 'TBD'
  try {
    return new Date(`${date}T${time || '00:00'}`).toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return time || ''
  }
}

const getInningsScore = (match, teamKey) => {
  const scoreKey = teamKey === 'teamA' ? 'score1' : 'score2'
  const ballsKey = teamKey === 'teamA' ? 'overs1' : 'overs2'
  const runsKey = teamKey === 'teamA' ? 'runs1' : 'runs2'
  const wicketsKey = teamKey === 'teamA' ? 'wickets1' : 'wickets2'
  const innings =
    match.score && match.score[teamKey]
      ? `${match.score[teamKey].runs}/${match.score[teamKey].wickets}`
      : match[scoreKey] || `${match[runsKey] || 0}/${match[wicketsKey] || 0}`
  const overs =
    match.score && match.score[teamKey] ? match.score[teamKey].overs : match[ballsKey] || '0.0'
  return { innings, overs }
}

const Home = () => {
  const [liveMatches, setLiveMatches] = useState([])
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [completedMatches, setCompletedMatches] = useState([])
  const [topPerformers, setTopPerformers] = useState([])
  const [teams, setTeams] = useState([])
  const [loadingLive, setLoadingLive] = useState(true)
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)
  const [loadingCompleted, setLoadingCompleted] = useState(true)
  const [activeTab, setActiveTab] = useState('live')
  const [error, setError] = useState('')

  useEffect(() => {
    let unsubscribe = null

    const loadLiveFallback = async () => {
      try {
        const response = await matchesAPI.getAll({ status: 'Live' })
        setLiveMatches(response.data || [])
      } catch (err) {
        console.error('Error loading live matches:', err)
        setError((prev) => prev || 'Failed to load live matches')
      } finally {
        setLoadingLive(false)
      }
    }

    try {
      unsubscribe = subscribeToLiveMatches((matches) => {
        setLiveMatches(matches)
        setLoadingLive(false)
      })
    } catch (err) {
      console.error('Live subscription failed:', err)
      loadLiveFallback()
    }

    loadLiveFallback()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  useEffect(() => {
    const loadMatchLists = async () => {
      try {
        const [upcomingResponse, completedResponse, finishedResponse] = await Promise.all([
          matchesAPI.getAll({ status: 'Upcoming' }),
          matchesAPI.getAll({ status: 'Completed' }),
          matchesAPI.getAll({ status: 'Finished' }),
        ])

        const upcomingData = (upcomingResponse.data || []).sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        )
        // Combine Completed and Finished matches
        const allFinishedMatches = [
          ...(completedResponse.data || []),
          ...(finishedResponse.data || [])
        ]
        const completedData = allFinishedMatches
          .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt))
          .slice(0, 10)

        setUpcomingMatches(upcomingData)
        setCompletedMatches(completedData)
      } catch (err) {
        console.error('Error loading match schedules:', err)
        setError((prev) => prev || 'Failed to load match schedules')
        setUpcomingMatches([])
        setCompletedMatches([])
      } finally {
        setLoadingUpcoming(false)
        setLoadingCompleted(false)
      }
    }

    loadMatchLists()
    
    // Set up real-time subscription for finished matches
    const interval = setInterval(() => {
      loadMatchLists()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const loadTopPerformers = async () => {
      try {
        const response = await playersAPI.getAll()
        const allPlayers = response.data || []
        
        // Calculate top performers based on stats
        const performers = allPlayers
          .filter(p => {
            const stats = p.baseStats || {}
            const runs = stats.runs || 0
            const wickets = stats.wickets || 0
            return runs > 0 || wickets > 0
          })
          .map(p => {
            const stats = p.baseStats || {}
            const runs = stats.runs || 0
            const wickets = stats.wickets || 0
            const score = runs + (wickets * 20) // Weight wickets higher
            return {
              ...p,
              score,
              runs,
              wickets,
            }
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 6)
        
        setTopPerformers(performers)
      } catch (err) {
        console.error('Error loading top performers:', err)
      }
    }

    loadTopPerformers()
  }, [])

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const response = await squadsAPI.getAll()
        const allSquads = response.data || []
        setTeams(allSquads.slice(0, 6))
      } catch (err) {
        console.error('Error loading teams:', err)
      }
    }

    loadTeams()
  }, [])

  const nextMatch = useMemo(() => {
    if (upcomingMatches.length === 0) return null
    return upcomingMatches[0]
  }, [upcomingMatches])

  const renderMatchCard = (match) => {
    const teamA = getTeamName(match, 'teamAName', 'team1', 'teamA')
    const teamB = getTeamName(match, 'teamBName', 'team2', 'teamB')
    const scoreA = getInningsScore(match, 'teamA')
    const scoreB = getInningsScore(match, 'teamB')
    const isLive = match.status === 'Live'
    const isUpcoming = match.status === 'Upcoming'
    const isFinished = match.status === 'Finished' || match.status === 'Completed'
    
    const matchLink = isLive ? `/live/${match.id}` : `/match/${match.id}`

    return (
      <Link
        key={match.id}
        to={matchLink}
        className={`group relative rounded-2xl border-2 bg-white p-6 shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
          isLive
            ? 'border-green-400 shadow-green-100'
            : isUpcoming
            ? 'border-blue-200 shadow-blue-50'
            : 'border-gray-200'
        }`}
      >
        {/* Live pulse effect */}
        {isLive && (
          <div className="absolute -top-2 -right-2 h-4 w-4 animate-pulse rounded-full bg-red-500">
            <div className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-75"></div>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500"></span>
                LIVE
              </span>
            )}
            {isUpcoming && (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                Scheduled
              </span>
            )}
            {isFinished && (
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                Completed
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">{match.venue || 'Main Ground'}</span>
        </div>

        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900 mb-1">
            {teamA} <span className="mx-2 text-gray-400">vs</span> {teamB}
          </h3>
          {match.format && (
            <p className="text-xs text-gray-500">{match.format} • {match.oversLimit ? `${match.oversLimit} overs` : 'Unlimited'}</p>
          )}
        </div>

        {isLive || isFinished ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{teamA}</span>
              <span className="text-base font-bold text-gray-900">
                {scoreA.innings} <span className="text-sm font-normal text-gray-500">({scoreA.overs})</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">{teamB}</span>
              <span className="text-base font-bold text-gray-900">
                {scoreB.innings} <span className="text-sm font-normal text-gray-500">({scoreB.overs})</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-gray-600">
              {formatDateTime(match.date, match.time)}
            </p>
            {match.tossWinnerName && match.tossDecision && (
              <p className="mt-2 text-xs text-gray-500">
                🪙 {match.tossWinnerName} chose to {match.tossDecision === 'bat' ? 'bat' : 'field'}
              </p>
            )}
          </div>
        )}

        {isFinished && match.resultSummary && (
          <p className="mt-4 text-sm font-semibold text-gray-700 border-t pt-3">
            {match.resultSummary}
          </p>
        )}
      </Link>
    )
  }

  const renderMatches = () => {
    let matches = []
    let loading = false

    if (activeTab === 'live') {
      matches = liveMatches
      loading = loadingLive
    } else if (activeTab === 'upcoming') {
      matches = upcomingMatches
      loading = loadingUpcoming
    } else if (activeTab === 'finished') {
      matches = completedMatches
      loading = loadingCompleted
    } else {
      matches = []
      loading = false
    }

    if (loading) {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <div className="text-4xl text-gray-300 mb-4">🏏</div>
          <p className="text-gray-500">Loading matches...</p>
        </div>
      )
    }

    if (matches.length === 0) {
      return (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
          <div className="text-4xl text-gray-300 mb-4">
            {activeTab === 'live' ? '🔴' : activeTab === 'upcoming' ? '📅' : '🏆'}
          </div>
          <p className="text-gray-500">
            {activeTab === 'live' 
              ? 'No live matches at the moment' 
              : activeTab === 'upcoming'
              ? 'No upcoming matches scheduled'
              : 'No completed matches yet'}
          </p>
        </div>
      )
    }

    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {matches.map(renderMatchCard)}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Hero Section */}
      <section className="relative min-h-[60vh] overflow-hidden bg-gradient-to-br from-[#0A2540] via-[#0d3a5c] to-[#0A2540] text-white">
        {/* Background Effects */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,_rgba(0,146,112,0.3),_transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,_rgba(79,156,249,0.2),_transparent_50%)]" />
        </div>
        
        {/* Cricket field texture */}
        <div className="absolute inset-0 opacity-10">
          <div className="h-full w-full bg-[repeating-linear-gradient(90deg,_transparent,_transparent_49px,_rgba(255,255,255,0.05)_50px,_rgba(255,255,255,0.05)_51px,_transparent_52px)]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8 animate-fade-in">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white/80 mb-6">
                  School Cricket Platform
                </p>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-4">
                  A New Era of
                  <br />
                  <span className="text-[#009270]">School Cricket.</span>
                </h1>
                <p className="text-xl md:text-2xl text-white/80 mb-2">
                  A Universe of School Cricket.
                </p>
                <p className="text-base text-white/70">
                  Live Scores • Player Stats • Tournament History — All in One Platform.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Link
                  to={liveMatches.length > 0 ? `/live/${liveMatches[0].id}` : '/schedule'}
                  className="group inline-flex items-center gap-2 rounded-full bg-[#009270] px-8 py-4 text-sm font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl hover:bg-[#007a5a]"
                >
                  View Live Matches
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </Link>
                <Link
                  to="/squad"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 bg-white/10 backdrop-blur-sm px-8 py-4 text-sm font-semibold text-white transition-all hover:bg-white/20"
                >
                  Explore Teams
                </Link>
              </div>
            </div>

            {/* Right Content - Next Match Card */}
            <div className="lg:pl-8">
              {nextMatch ? (
                <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-6 shadow-2xl">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-4">
                    Next Match
                  </p>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {getTeamName(nextMatch, 'teamAName', 'team1', 'teamA')} vs{' '}
                    {getTeamName(nextMatch, 'teamBName', 'team2', 'teamB')}
                  </h3>
                  <p className="text-sm text-white/80 mb-4">
                    {formatDateTime(nextMatch.date, nextMatch.time)} • {nextMatch.venue || 'Main Ground'}
                  </p>
                  <Link
                    to={`/match/${nextMatch.id}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-[#009270] transition"
                  >
                    View Details →
                  </Link>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-12 text-center">
                  <div className="text-6xl mb-4">🏏</div>
                  <p className="text-white/70">No upcoming matches</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Match Categories Section */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-full bg-white p-1.5 shadow-lg border border-gray-200">
            <button
              onClick={() => setActiveTab('live')}
              className={`relative px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                activeTab === 'live'
                  ? 'bg-[#009270] text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {activeTab === 'live' && (
                <span className="absolute -top-1 -right-1 h-3 w-3 animate-pulse rounded-full bg-red-500"></span>
              )}
              LIVE ({liveMatches.length})
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                activeTab === 'upcoming'
                  ? 'bg-[#009270] text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              UPCOMING ({upcomingMatches.length})
            </button>
            <button
              onClick={() => setActiveTab('finished')}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                activeTab === 'finished'
                  ? 'bg-[#009270] text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              FINISHED
            </button>
          </div>
        </div>

        {/* Match Cards Grid */}
        {renderMatches()}
      </section>

      {/* Featured Sections */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Top Performers */}
        {topPerformers.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Top Performers</h2>
              <Link
                to="/squad"
                className="text-sm font-semibold text-[#009270] hover:text-[#007a5a] transition"
              >
                View All →
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              {topPerformers.map((player) => (
                <Link
                  key={player.id}
                  to={`/player/${player.id}`}
                  className="group flex-shrink-0 w-48 rounded-xl border border-gray-200 bg-white p-4 shadow-md transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-12 w-12 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center overflow-hidden">
                      {player.photo ? (
                        <img
                          src={player.photo}
                          alt={player.name}
                          className="h-full w-full object-cover"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      ) : (
                        <span className="text-lg font-semibold text-gray-600">
                          {player.name?.charAt(0) || 'P'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{player.name}</p>
                      <p className="text-xs text-gray-500">{player.role || 'Player'}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {player.runs > 0 && (
                      <p className="text-xs text-gray-600">
                        <span className="font-semibold text-gray-900">{player.runs}</span> runs
                      </p>
                    )}
                    {player.wickets > 0 && (
                      <p className="text-xs text-gray-600">
                        <span className="font-semibold text-gray-900">{player.wickets}</span> wickets
                      </p>
                    )}
                  </div>
                  <span className="mt-2 inline-block rounded-full bg-[#009270]/10 px-2 py-0.5 text-xs font-semibold text-[#009270]">
                    Star Performer
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Teams Showcase */}
        {teams.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Teams & Squads</h2>
              <Link
                to="/squad"
                className="text-sm font-semibold text-[#009270] hover:text-[#007a5a] transition"
              >
                View All →
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <Link
                  key={team.id}
                  to={`/squad/${team.id}`}
                  className="group rounded-xl border border-gray-200 bg-white p-6 shadow-md transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      {team.teamName || `Batch ${team.batch}`}
                    </h3>
                    <span className="text-2xl">🏏</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    {team.players?.length || 0} players
                  </p>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#009270] group-hover:gap-3 transition-all">
                    View Squad →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Recent Highlights Strip */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-4">
            Recent Highlights
          </h3>
          <div className="flex flex-wrap gap-4 text-sm">
            {completedMatches.slice(0, 3).map((match) => {
              const teamA = getTeamName(match, 'teamAName', 'team1', 'teamA')
              const teamB = getTeamName(match, 'teamBName', 'team2', 'teamB')
              return (
                <Link
                  key={match.id}
                  to={`/match/${match.id}`}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 hover:border-[#009270] hover:bg-[#009270]/5 transition"
                >
                  <span className="text-gray-600">
                    {teamA} vs {teamB}
                  </span>
                  {match.resultSummary && (
                    <span className="text-xs text-gray-500">• {match.resultSummary}</span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0A2540] text-white mt-16">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-bold text-lg mb-4">About</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link to="/" className="hover:text-white transition">Home</Link></li>
                <li><Link to="/schedule" className="hover:text-white transition">Schedule</Link></li>
                <li><Link to="/squad" className="hover:text-white transition">Squads</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Tournaments</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link to="/champions" className="hover:text-white transition">Champions</Link></li>
                <li><Link to="/schedule" className="hover:text-white transition">Fixtures</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Teams</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link to="/squad" className="hover:text-white transition">All Squads</Link></li>
                <li><Link to="/squad" className="hover:text-white transition">Players</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-lg mb-4">Live Scores</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><Link to="/live" className="hover:text-white transition">Live Matches</Link></li>
                <li><Link to="/admin" className="hover:text-white transition">Admin Panel</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/10 text-center text-sm text-white/60">
            <p>©2025 COPYRIGHT BY BATCH-19 — Made by Mehedi Hasan</p>
          </div>
        </div>
      </footer>

      {error && (
        <div className="fixed bottom-4 right-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-lg">
          {error}
        </div>
      )}
    </div>
  )
}

export default Home
