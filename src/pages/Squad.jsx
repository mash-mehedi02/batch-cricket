import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { playersAPI, tournamentsAPI, squadsAPI, matchesAPI } from '../services/api'

const Squad = () => {
  const [players, setPlayers] = useState([])
  const [tournaments, setTournaments] = useState({})
  const [squads, setSquads] = useState({})
  const [selectedSquad, setSelectedSquad] = useState(null)
  const [squadStats, setSquadStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const navigate = useNavigate()

  const CACHE_KEY = 'squad_page_cache_v1'
  const CACHE_TTL = 5 * 60 * 1000

  useEffect(() => {
    let isMounted = true
    let hasWarmData = false

    const hydrateFromCache = (cache) => {
      setPlayers(Array.isArray(cache.players) ? cache.players : [])
      setTournaments(cache.tournaments || {})
      setSquads(cache.squads || {})
    }

    if (typeof window !== 'undefined') {
      const cachedRaw = sessionStorage.getItem(CACHE_KEY)
      if (cachedRaw) {
        try {
          const parsed = JSON.parse(cachedRaw)
          if (parsed?.timestamp && Date.now() - parsed.timestamp < CACHE_TTL) {
            hydrateFromCache(parsed)
            hasWarmData = true
            setLoading(false)
            setError('')
          } else {
            sessionStorage.removeItem(CACHE_KEY)
          }
        } catch (cacheError) {
          console.warn('Failed to parse squad cache:', cacheError)
          sessionStorage.removeItem(CACHE_KEY)
        }
      }
    }

    const loadData = async (showSpinner = !hasWarmData) => {
      try {
        if (showSpinner && isMounted) {
          setLoading(true)
        }

        const [playersRes, tournamentsRes, squadsRes] = await Promise.all([
          playersAPI.getAll({ includeRelations: false }),
          tournamentsAPI.getAll(),
          squadsAPI.getAll(),
        ])

        if (!isMounted) {
          return
        }

        const playersData = playersRes.data || []
        const tournamentsData = (tournamentsRes.data || []).reduce((acc, tournament) => {
          acc[tournament.id] = tournament
          return acc
        }, {})

        const squadsData = (squadsRes.data || []).reduce((acc, squad) => {
          acc[squad.id] = squad
          return acc
        }, {})

        setPlayers(playersData)
        setTournaments(tournamentsData)
        setSquads(squadsData)
        setError('')

        if (showSpinner) {
          setLoading(false)
        }

        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              timestamp: Date.now(),
              players: playersData,
              tournaments: tournamentsData,
              squads: squadsData,
            })
          )
        }
      } catch (err) {
        console.error('Error loading squad data:', err)
        if (!hasWarmData && isMounted) {
          setError('Failed to load squad data. Please try again later.')
          setPlayers([])
          setTournaments({})
          setSquads({})
        }
        if (showSpinner && isMounted) {
          setLoading(false)
        }
      }
    }

    loadData(!hasWarmData)

    return () => {
      isMounted = false
    }
  }, [])

  // Load squad stats when squad is selected
  useEffect(() => {
    const loadSquadStats = async () => {
      if (!selectedSquad?.squadId) return

      try {
        // Get all matches for this squad
        const matchesResponse = await matchesAPI.getAll({
          tournamentId: selectedSquad.tournamentId,
        })
        const allMatches = matchesResponse.data || []

        // Filter matches where this squad participated
        const squadMatches = allMatches.filter(
          (match) =>
            match.teamASquadId === selectedSquad.squadId ||
            match.teamBSquadId === selectedSquad.squadId
        )

        // Calculate stats
        let matches = 0
        let wins = 0
        let losses = 0
        let ties = 0

        squadMatches.forEach((match) => {
          if (match.status === 'Completed' || match.status === 'Finished') {
            matches += 1
            const isTeamA = match.teamASquadId === selectedSquad.squadId
            const runs1 = match.runs1 ?? match.score?.teamA?.runs ?? 0
            const runs2 = match.runs2 ?? match.score?.teamB?.runs ?? 0

            if (runs1 === runs2) {
              ties += 1
            } else if ((isTeamA && runs1 > runs2) || (!isTeamA && runs2 > runs1)) {
              wins += 1
            } else {
              losses += 1
            }
          }
        })

        const winPercentage = matches > 0 ? ((wins / matches) * 100).toFixed(1) : 0

        setSquadStats({
          matches,
          wins,
          losses,
          ties,
          winPercentage,
        })
      } catch (err) {
        console.error('Error loading squad stats:', err)
        setSquadStats({ matches: 0, wins: 0, losses: 0, ties: 0, winPercentage: 0 })
      }
    }

    loadSquadStats()
  }, [selectedSquad])

  const [activeTournamentId, setActiveTournamentId] = useState('all')
  const [activeYear, setActiveYear] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('cards')

  const tournamentsList = useMemo(() => {
    const entries = Object.values(tournaments)
    return entries.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name))
  }, [tournaments])

  const allYears = useMemo(() => {
    const set = new Set()
    players.forEach((player) => {
      if (player.year || player.batch) {
        set.add(player.year || player.batch)
      }
    })
    return Array.from(set).sort((a, b) => {
      const numA = Number.parseInt(a, 10)
      const numB = Number.parseInt(b, 10)
      if (Number.isNaN(numA) || Number.isNaN(numB)) {
        return String(a).localeCompare(String(b))
      }
      return numB - numA
    })
  }, [players])

  const filteredGroups = useMemo(() => {
    const result = []
    const term = searchTerm.trim().toLowerCase()

    players.forEach((player) => {
      const tournamentId = player.tournamentId || 'unknown'
      if (activeTournamentId !== 'all' && tournamentId !== activeTournamentId) return

      const year = player.year || player.batch || 'Unassigned'
      if (activeYear !== 'all' && year !== activeYear) return

      const matchString = `${player.name || ''} ${player.role || ''} ${player.batch || ''} ${player.village || ''}`.toLowerCase()
      if (term && !matchString.includes(term)) return

      const tournament = tournaments[tournamentId]
      const squad = squads[player.squadId] || {}
      const groupKey = `${tournamentId}-${player.squadId || 'unknown'}`
      const existingGroup = result.find((group) => group.groupKey === groupKey)
      const groupEntry = existingGroup || {
        groupKey,
        tournamentId,
        tournamentLabel: tournament ? `${tournament.name} ${tournament.year || ''}`.trim() : 'Unassigned Tournament',
        tournamentSchool: tournament?.schoolName || '',
        year,
        squadId: player.squadId,
        squadLabel: squad.teamName || squad.name || player.squadName || 'Unassigned Squad',
        squadLogo: squad.logo || '',
        players: [],
      }

      groupEntry.players.push(player)

      if (!existingGroup) {
        result.push(groupEntry)
      }
    })

    return result.sort((a, b) => {
      const tournamentCompare = a.tournamentLabel.localeCompare(b.tournamentLabel)
      if (tournamentCompare !== 0) return tournamentCompare
      const yearA = Number.parseInt(a.year, 10)
      const yearB = Number.parseInt(b.year, 10)
      if (!Number.isNaN(yearA) && !Number.isNaN(yearB)) {
        if (yearB !== yearA) return yearB - yearA
      }
      return a.squadLabel.localeCompare(b.squadLabel)
    })
  }, [players, squads, tournaments, activeTournamentId, activeYear, searchTerm])

  const handlePlayerClick = (playerId) => {
    navigate(`/player/${playerId}`)
    closeSquadModal()
  }

  const openSquadModal = ({
    tournamentLabel,
    tournamentSchool,
    year,
    squadLabel,
    squadLogo,
    squadPlayers,
    tournamentId,
    squadId,
  }) => {
    const totalRuns = squadPlayers.reduce((sum, player) => sum + (player.stats?.runs ?? player.runs ?? 0), 0)
    const totalWickets = squadPlayers.reduce((sum, player) => sum + (player.stats?.wickets ?? player.wickets ?? 0), 0)
    const totalMatches = squadPlayers.reduce((sum, player) => sum + (player.stats?.matches ?? player.matches ?? 0), 0)

    setSelectedSquad({
      tournamentLabel,
      tournamentSchool,
      year,
      squadLabel,
      squadLogo,
      squadPlayers,
      tournamentId,
      squadId,
      totals: {
        runs: totalRuns,
        wickets: totalWickets,
        matches: totalMatches,
      },
    })
  }

  const closeSquadModal = () => {
    setSelectedSquad(null)
    setSquadStats(null)
    setActiveFilter('all')
  }

  // Filter players by role
  const filteredPlayers = useMemo(() => {
    if (!selectedSquad?.squadPlayers) return []
    const players = selectedSquad.squadPlayers

    if (activeFilter === 'all') return players
    if (activeFilter === 'batters') {
      return players.filter((p) => {
        const role = (p.role || '').toLowerCase()
        return role.includes('bat') || role.includes('wicket') || role.includes('keeper')
      })
    }
    if (activeFilter === 'bowlers') {
      return players.filter((p) => {
        const role = (p.role || '').toLowerCase()
        return role.includes('bowl') && !role.includes('all')
      })
    }
    if (activeFilter === 'allrounders') {
      return players.filter((p) => {
        const role = (p.role || '').toLowerCase()
        return role.includes('all') || role.includes('round')
      })
    }
    if (activeFilter === 'wicketkeepers') {
      return players.filter((p) => {
        const role = (p.role || '').toLowerCase()
        return role.includes('wicket') || role.includes('keeper') || role.includes('wk')
      })
    }
    return players
  }, [selectedSquad, activeFilter])

  // Get role badge
  const getRoleBadge = (role, isCaptain = false, isViceCaptain = false) => {
    const roleLower = (role || '').toLowerCase()
    let badgeClass = 'bg-gray-100 text-gray-700'
    let badgeText = role || 'Player'

    if (roleLower.includes('bat') && !roleLower.includes('all')) {
      badgeClass = 'bg-blue-100 text-blue-700'
      badgeText = '🏏 BAT'
    } else if (roleLower.includes('bowl') && !roleLower.includes('all')) {
      badgeClass = 'bg-red-100 text-red-700'
      badgeText = '🎯 BOWL'
    } else if (roleLower.includes('all') || roleLower.includes('round')) {
      badgeClass = 'bg-green-100 text-green-700'
      badgeText = '⚡ ALL'
    } else if (roleLower.includes('wicket') || roleLower.includes('keeper') || roleLower.includes('wk')) {
      badgeClass = 'bg-yellow-100 text-yellow-700'
      badgeText = '🧤 WK'
    }

    return { badgeClass, badgeText }
  }

  const totalPlayers = useMemo(
    () => filteredGroups.reduce((sum, group) => sum + group.players.length, 0),
    [filteredGroups]
  )
  const totalSquads = filteredGroups.length

  // If squad modal is open, show premium squad detail page
  if (selectedSquad) {
    const squad = squads[selectedSquad.squadId] || {}
    const tournament = tournaments[selectedSquad.tournamentId] || {}
    const captainName = squad.captain || ''
    const viceCaptainName = squad.viceCaptain || ''

    return (
      <div className="min-h-screen bg-[#F7F9FA]">
        {/* 1️⃣ Page Header (Team Identity Section) */}
        <div className="bg-gradient-to-r from-[#0d6b53] via-[#0D8F61] to-[#18a56f] relative overflow-hidden">
          {/* Glassmorphism strip */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 backdrop-blur-sm"></div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
              {/* Team Logo */}
              <div className="relative flex-shrink-0">
                {selectedSquad.squadLogo ? (
                  <img
                    src={selectedSquad.squadLogo}
                    alt={selectedSquad.squadLabel}
                    className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-white/30 shadow-2xl object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.nextSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div
                  className={`w-32 h-32 md:w-40 md:h-40 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-5xl md:text-6xl font-bold text-white border-4 border-white/30 shadow-2xl ${
                    selectedSquad.squadLogo ? 'hidden' : ''
                  }`}
                >
                  {selectedSquad.squadLabel?.charAt(0) || 'S'}
                </div>
              </div>

              {/* Team Info */}
              <div className="flex-1 text-center md:text-left text-white">
                <h1 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
                  {selectedSquad.squadLabel}
                </h1>
                <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm md:text-base">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold opacity-90">Established:</span>
                    <span>{selectedSquad.year || 'N/A'}</span>
                  </div>
                  <span className="opacity-50">|</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold opacity-90">Tournament:</span>
                    <span>{selectedSquad.tournamentLabel || 'N/A'}</span>
                  </div>
                  {captainName && (
                    <>
                      <span className="opacity-50">|</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold opacity-90">Captain:</span>
                        <span>{captainName}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={closeSquadModal}
                className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition text-white backdrop-blur-sm"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 2️⃣ Quick Stats Section */}
          {squadStats && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-lg overflow-hidden border-l-4 border-[#0D8F61]">
                <div className="p-6">
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Matches</div>
                  <div className="text-4xl font-black text-gray-900">{squadStats.matches}</div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg overflow-hidden border-l-4 border-green-500">
                <div className="p-6">
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Wins</div>
                  <div className="text-4xl font-black text-gray-900">{squadStats.wins}</div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg overflow-hidden border-l-4 border-[#4B9CE2]">
                <div className="p-6">
                  <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Win %</div>
                  <div className="text-4xl font-black text-gray-900">{squadStats.winPercentage}%</div>
                </div>
              </div>
            </div>
          )}

          {/* 5️⃣ Filter Bar */}
          <div className="mb-6 flex flex-wrap gap-2">
            {['all', 'batters', 'bowlers', 'allrounders', 'wicketkeepers'].map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeFilter === filter
                    ? 'bg-[#0D8F61] text-white shadow-md'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {filter === 'all' ? 'All' : filter === 'batters' ? 'Batters' : filter === 'bowlers' ? 'Bowlers' : filter === 'allrounders' ? 'All Rounders' : 'WK'}
              </button>
            ))}
          </div>

          {/* 3️⃣ Squad List (Players Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredPlayers.map((player) => {
              const { badgeClass, badgeText } = getRoleBadge(player.role)
              const isCaptain = captainName && (player.name === captainName || player.name?.includes(captainName))
              const isViceCaptain = viceCaptainName && (player.name === viceCaptainName || player.name?.includes(viceCaptainName))

              return (
                <div
                  key={player.id}
                  onClick={() => handlePlayerClick(player.id)}
                  className="group bg-white rounded-xl shadow-sm hover:shadow-xl border border-gray-200 hover:border-[#0D8F61] transition-all duration-300 hover:-translate-y-1 cursor-pointer overflow-hidden"
                >
                  {/* Player Photo */}
                  <div className="relative pt-6 pb-4 px-6 flex flex-col items-center">
                    <div className="relative">
                      {player.photo ? (
                        <img
                          src={player.photo}
                          alt={player.name}
                          className="w-24 h-24 rounded-full border-4 border-[#0D8F61]/20 object-cover shadow-lg group-hover:border-[#0D8F61]/40 transition-all"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-24 h-24 rounded-full bg-gradient-to-br from-[#0D8F61] to-[#18a56f] flex items-center justify-center text-3xl font-bold text-white shadow-lg border-4 border-[#0D8F61]/20 ${
                          player.photo ? 'hidden' : ''
                        }`}
                      >
                        {player.name?.charAt(0) || 'P'}
                      </div>
                      
                      {/* Captain/Vice-Captain Badge */}
                      {(isCaptain || isViceCaptain) && (
                        <div className="absolute -top-2 -right-2 bg-[#0D8F61] text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold shadow-lg border-2 border-white">
                          {isCaptain ? '🔥' : '⭐'}
                        </div>
                      )}
                    </div>

                    {/* Player Name */}
                    <h3 className="mt-4 text-lg font-bold text-gray-900 text-center">{player.name}</h3>

                    {/* Role Badge */}
                    <div className="mt-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
                        {badgeText}
                      </span>
                    </div>

                    {/* Captain/Vice-Captain Label */}
                    {(isCaptain || isViceCaptain) && (
                      <div className="mt-2 text-xs font-semibold">
                        {isCaptain ? (
                          <span className="text-[#0D8F61]">🛡️ Captain</span>
                        ) : (
                          <span className="text-gray-600">⭐ Vice-Captain</span>
                        )}
                      </div>
                    )}

                    {/* View Profile Link */}
                    <div className="mt-4 text-sm font-semibold text-[#0D8F61] opacity-0 group-hover:opacity-100 transition-opacity">
                      View Profile →
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {filteredPlayers.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500 font-medium">No players found for this filter.</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Original listing page
  return (
    <div className="max-w-7xl mx-auto px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-6 rounded-3xl bg-gradient-to-r from-[#0e7f4a] via-[#0b6e40] to-[#0a5d37] px-6 py-8 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-white/70">Squad Showcase</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Elite Rosters Hub</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/85">
            Explore every roster in one curated experience. Filter by tournament, batch, or player name and open any squad for the full profile view.
          </p>
        </div>
        <div className="grid w-full max-w-sm grid-cols-2 gap-3 text-sm font-semibold tracking-wide text-white sm:w-auto">
          <div className="rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-center backdrop-blur-lg shadow-inner">
            <p className="text-[11px] uppercase text-white/70">Total Squads</p>
            <p className="text-2xl font-bold">{totalSquads}</p>
          </div>
          <div className="rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-center backdrop-blur-lg shadow-inner">
            <p className="text-[11px] uppercase text-white/70">Listed Players</p>
            <p className="text-2xl font-bold">{totalPlayers}</p>
          </div>
        </div>
      </header>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 shadow-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 rounded-3xl border border-dashed border-gray-200 bg-white p-16 text-center shadow">
          <div className="text-6xl text-gray-200">🏏</div>
          <p className="mt-4 text-lg font-semibold text-gray-500">Loading squad universe...</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-gray-200 bg-white p-16 text-center shadow">
          <div className="text-6xl text-gray-200">📭</div>
          <p className="mt-4 text-lg font-semibold text-gray-600">No squads match your filters.</p>
          <p className="text-sm text-gray-400">Try a different tournament, year, or search keyword.</p>
        </div>
      ) : (
        <>
          <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Tournament
                  </label>
                  <select
                    value={activeTournamentId}
                    onChange={(e) => setActiveTournamentId(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm focus:border-cricbuzz-green focus:outline-none focus:ring-2 focus:ring-cricbuzz-green/40"
                  >
                    <option value="all">All tournaments</option>
                    {tournamentsList.map((tournament) => (
                      <option key={tournament.id} value={tournament.id}>
                        {tournament.name} {tournament.year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Batch / Year
                  </label>
                  <select
                    value={activeYear}
                    onChange={(e) => setActiveYear(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm focus:border-cricbuzz-green focus:outline-none focus:ring-2 focus:ring-cricbuzz-green/40"
                  >
                    <option value="all">All years</option>
                    {allYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Search Players
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by player, role, or village..."
                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm focus:border-cricbuzz-green focus:outline-none focus:ring-2 focus:ring-cricbuzz-green/40"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 self-start rounded-full border border-gray-200 bg-gray-50 p-1 text-sm font-semibold text-gray-500 md:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`rounded-full px-4 py-2 transition ${
                    viewMode === 'cards' ? 'bg-white text-cricbuzz-green shadow-sm' : ''
                  }`}
                >
                  Card view
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`rounded-full px-4 py-2 transition ${
                    viewMode === 'list' ? 'bg-white text-cricbuzz-green shadow-sm' : ''
                  }`}
                >
                  Compact view
                </button>
              </div>
            </div>
          </section>

          <section
            className={`mt-8 ${
              viewMode === 'cards'
                ? 'grid gap-6 sm:grid-cols-2 xl:grid-cols-3'
                : 'space-y-4'
            }`}
          >
            {filteredGroups.map((group) => {
              const sortedPlayers = [...group.players].sort((a, b) => a.name.localeCompare(b.name))
              const totals = sortedPlayers.reduce(
                (acc, player) => ({
                  runs: acc.runs + (player.stats?.runs ?? player.runs ?? 0),
                  wickets: acc.wickets + (player.stats?.wickets ?? player.wickets ?? 0),
                  matches: acc.matches + (player.stats?.matches ?? player.matches ?? 0),
                }),
                { runs: 0, wickets: 0, matches: 0 }
              )
              const featurePlayers = sortedPlayers.slice(0, 4)

              const openModal = () =>
                openSquadModal({
                  tournamentLabel: group.tournamentLabel,
                  tournamentSchool: group.tournamentSchool,
                  year: group.year,
                  squadLabel: group.squadLabel,
                  squadLogo: group.squadLogo,
                  squadPlayers: sortedPlayers,
                  tournamentId: group.tournamentId,
                  squadId: group.squadId,
                })

              if (viewMode === 'list') {
                return (
                  <button
                    key={group.groupKey}
                    type="button"
                    onClick={openModal}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-6 py-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-cricbuzz-green hover:shadow-lg"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {group.squadLogo ? (
                          <img
                            src={group.squadLogo}
                            alt={group.squadLabel}
                            className="h-12 w-12 rounded-full object-cover ring-2 ring-white shadow"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#155e39] text-base font-bold text-white">
                            {group.squadLabel.charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-400">
                            {group.tournamentLabel}
                          </p>
                          <h3 className="text-lg font-bold text-gray-900">{group.squadLabel}</h3>
                          <p className="text-xs font-semibold text-gray-500">Batch {group.year}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-gray-600">
                        <span className="rounded-full bg-green-50 px-3 py-1 text-green-600">
                          Runs {totals.runs}
                        </span>
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-600">
                          Wickets {totals.wickets}
                        </span>
                        {totals.matches > 0 && (
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-600">
                            Matches {totals.matches}
                          </span>
                        )}
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">
                          {sortedPlayers.length} player{sortedPlayers.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              }

              return (
                <button
                  key={group.groupKey}
                  type="button"
                  onClick={openModal}
                  className="group relative h-full overflow-hidden rounded-3xl border border-gray-200 bg-white text-left shadow-sm transition-all hover:-translate-y-2 hover:border-cricbuzz-green hover:shadow-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-cricbuzz-green/10 via-transparent to-blue-500/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="relative flex h-full flex-col gap-5 px-6 py-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.45em] text-gray-400">
                          {group.tournamentLabel}
                        </p>
                        <h2 className="text-xl font-bold text-gray-900">{group.squadLabel}</h2>
                        <p className="text-xs font-semibold text-gray-500">Batch {group.year}</p>
                      </div>
                      {group.squadLogo ? (
                        <img
                          src={group.squadLogo}
                          alt={group.squadLabel}
                          className="h-12 w-12 rounded-full border border-white/80 shadow-sm"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2b89ff] text-base font-bold text-white">
                          {group.squadLabel.charAt(0)}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-green-700">
                        Runs {totals.runs}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                        Wickets {totals.wickets}
                      </span>
                      {totals.matches > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                          Matches {totals.matches}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-gray-700">
                        {sortedPlayers.length} player{sortedPlayers.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {featurePlayers.map((player) => (
                        <div
                          key={player.id}
                          className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600"
                        >
                          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cricbuzz-green to-green-500 text-white">
                            {player.photo ? (
                              <img
                                src={player.photo}
                                alt={player.name}
                                className="h-full w-full object-cover"
                                onError={(e) => (e.currentTarget.style.display = 'none')}
                              />
                            ) : (
                              player.name?.charAt(0) || 'P'
                            )}
                          </div>
                          <div>
                            <p className="text-gray-800">{player.name}</p>
                            <p className="text-[11px] text-gray-400">{player.role || 'Player'}</p>
                          </div>
                        </div>
                      ))}
                      {sortedPlayers.length > featurePlayers.length && (
                        <span className="rounded-2xl border border-dashed border-gray-300 px-3 py-2 text-xs font-semibold text-cricbuzz-green">
                          +{sortedPlayers.length - featurePlayers.length} more
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </section>
        </>
      )}

      {filteredGroups.length > 0 && (
        <div className="mt-10 rounded-3xl bg-gradient-to-r from-cricbuzz-green to-blue-600 px-6 py-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-white/70">Snapshot</p>
              <h3 className="text-2xl font-bold">Total Players {totalPlayers}</h3>
              <p className="text-sm text-white/80">
                Across {totalSquads} squad{totalSquads === 1 ? '' : 's'} • {tournamentsList.length} tournament
                {tournamentsList.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {filteredGroups.slice(0, 6).map((group) => (
                <span key={group.groupKey} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                  {group.squadLabel} · {group.year}
                </span>
              ))}
              {filteredGroups.length > 6 && (
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                  +{filteredGroups.length - 6} more
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Squad
