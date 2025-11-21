import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { tournamentsAPI, matchesAPI, squadsAPI, playersAPI } from '../services/api'

const Champion = () => {
  const [champions, setChampions] = useState([])
  const [expandedYears, setExpandedYears] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadChampions()
  }, [])

  const loadChampions = async () => {
    try {
      setLoading(true)
      
      // Get all completed tournaments
      const tournamentsResponse = await tournamentsAPI.getAll()
      const tournaments = tournamentsResponse.data || []
      
      // Filter completed tournaments
      const completedTournaments = tournaments.filter(
        (t) => t.status === 'completed' || t.status === 'Completed'
      )

      // For each completed tournament, find the champion
      const championsData = []

      for (const tournament of completedTournaments) {
        try {
          // Get final match for this tournament
          const matchesResponse = await matchesAPI.getAll({
            tournamentId: tournament.id,
            status: 'Completed',
          })

          const matches = matchesResponse.data || []
          
          if (matches.length === 0) continue

          // Find the final match (usually the last completed match or marked as final)
          const finalMatch = matches.find((m) => m.isFinal) || matches[0]

          // Determine winner
          const winnerSquadId = 
            finalMatch.runs1 > finalMatch.runs2
              ? finalMatch.teamASquadId
              : finalMatch.runs2 > finalMatch.runs1
              ? finalMatch.teamBSquadId
              : null

          if (!winnerSquadId) continue

          // Get winner squad details
          const squadResponse = await squadsAPI.getById(winnerSquadId)
          const winnerSquad = squadResponse.data

          // Get runner-up squad
          const runnerUpSquadId = 
            winnerSquadId === finalMatch.teamASquadId
              ? finalMatch.teamBSquadId
              : finalMatch.teamASquadId

          const runnerUpResponse = await squadsAPI.getById(runnerUpSquadId)
          const runnerUpSquad = runnerUpResponse.data

          // Get squad players
          const playersResponse = await playersAPI.getAll({ squadId: winnerSquadId })
          const squadPlayers = playersResponse.data || []

          // Get key players (top performers from final match or overall)
          const keyPlayers = squadPlayers
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
              class: p.class,
              runs: p.matchStats?.runs || 0,
              wickets: p.matchStats?.wickets || 0,
            }))

          // Calculate final score
          const margin = Math.abs(finalMatch.runs1 - finalMatch.runs2)
          const winnerRuns = finalMatch.runs1 > finalMatch.runs2 ? finalMatch.runs1 : finalMatch.runs2
          const winnerWickets = finalMatch.runs1 > finalMatch.runs2 ? finalMatch.wickets1 : finalMatch.wickets2
          const runnerUpRuns = finalMatch.runs1 > finalMatch.runs2 ? finalMatch.runs2 : finalMatch.runs1
          const runnerUpWickets = finalMatch.runs1 > finalMatch.runs2 ? finalMatch.wickets2 : finalMatch.wickets1

          const finalScore = `${winnerSquad.teamName || `Batch ${winnerSquad.batch}`} won by ${margin} ${margin === 1 ? 'run' : 'runs'}`

          championsData.push({
            id: tournament.id,
            year: tournament.year,
            tournamentName: tournament.name,
            tournamentId: tournament.id,
            team: winnerSquad.teamName || `Batch ${winnerSquad.batch}`,
            teamId: winnerSquadId,
            captain: winnerSquad.captain || 'N/A',
            viceCaptain: winnerSquad.viceCaptain || null,
            runnerUp: runnerUpSquad.teamName || `Batch ${runnerUpSquad.batch}`,
            finalScore: finalScore,
            finalMatchSummary: `${tournament.name} ${tournament.year} - ${finalScore}. ${winnerSquad.teamName || `Batch ${winnerSquad.batch}`} scored ${winnerRuns}/${winnerWickets} and ${runnerUpSquad.teamName || `Batch ${runnerUpSquad.batch}`} scored ${runnerUpRuns}/${runnerUpWickets}.`,
            venue: finalMatch.venue || 'Main Ground',
            date: finalMatch.date,
            time: finalMatch.time,
            squad: squadPlayers.map((p) => ({
              id: p.id,
              name: p.name,
              role: p.role,
              class: p.class || '',
              photo: p.photo || null,
            })),
            keyPlayers: keyPlayers,
            trophyDetails: {
              tournament: tournament.name,
              year: tournament.year,
              format: tournament.format || 'T20',
              schoolName: tournament.schoolName || 'School',
            },
          })
        } catch (error) {
          console.error(`Error processing tournament ${tournament.id}:`, error)
        }
      }

      // Sort by year (newest first)
      championsData.sort((a, b) => b.year - a.year)
      setChampions(championsData)
    } catch (error) {
      console.error('Error loading champions:', error)
      setError('Failed to load champions data')
    } finally {
      setLoading(false)
    }
  }

  const toggleSquad = (year) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !prev[year],
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4 animate-pulse">🏆</div>
          <p className="text-gray-500">Loading champions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-gray-400 text-6xl mb-4">❌</div>
          <p className="text-gray-500 text-lg mb-4">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-3">
            🏆 Champions History
          </h1>
          <p className="text-lg text-gray-600">Year-wise winning teams and their championship squads</p>
        </div>

        {champions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">🏆</div>
            <p className="text-gray-500 text-lg mb-2">No champions recorded yet</p>
            <p className="text-gray-400 text-sm">
              Champions will appear here after tournaments are completed
            </p>
          </div>
        ) : (
          <>
        {/* Champions Grid - Cricbuzz Style Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-12">
              {champions.map((champion) => {
                const isExpanded = expandedYears[champion.year]

                return (
                  <div
                    key={champion.id || champion.year}
                    className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-200"
                  >
                    {/* Year Badge */}
                    <div className="bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 text-white p-5 text-center relative">
                      <div className="text-4xl font-bold mb-1">{champion.year}</div>
                      <div className="text-sm opacity-90">Championship Year</div>
                      <div className="absolute top-4 right-4 text-3xl">🏆</div>
                    </div>

                    {/* Champion Info */}
                    <div className="p-6">
                      {/* Tournament Name */}
                      <div className="text-center mb-4 pb-4 border-b border-gray-200">
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                          Tournament
                        </div>
                        <h3 className="text-lg font-bold text-gray-800">
                          {champion.tournamentName}
                        </h3>
                      </div>

                      {/* Team Name */}
                      <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                          {champion.team}
                        </h2>
                        <div className="text-sm text-gray-600">
                          <span className="font-semibold">Captain:</span> {champion.captain}
                        </div>
                        {champion.viceCaptain && (
                          <div className="text-xs text-gray-500 mt-1">
                            Vice Captain: {champion.viceCaptain}
                          </div>
                        )}
                      </div>

                      {/* Key Players */}
                      {champion.keyPlayers && champion.keyPlayers.length > 0 && (
                        <div className="mb-4 pb-4 border-b border-gray-200">
                          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                            Key Players
                          </div>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {champion.keyPlayers.slice(0, 3).map((player, idx) => (
                              <div
                                key={idx}
                                className="bg-gray-50 px-2 py-1 rounded text-xs font-medium text-gray-700"
                              >
                                {player.name}
                                {player.runs > 0 && ` (${player.runs}R)`}
                                {player.wickets > 0 && ` (${player.wickets}W)`}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Final Match Summary */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-4 border-l-4 border-yellow-500">
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          Final Match
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed mb-2">
                          {champion.finalMatchSummary}
                        </p>
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs text-gray-600">
                            <span className="font-semibold">vs {champion.runnerUp}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(champion.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}{' '}
                            • {champion.venue}
                          </div>
                        </div>
                      </div>

                      {/* Trophy Details */}
                      <div className="mb-4 pb-4 border-b border-gray-200">
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          Trophy Details
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div>
                            <span className="font-semibold">Format:</span> {champion.trophyDetails?.format || 'T20'}
                          </div>
                          <div>
                            <span className="font-semibold">School:</span> {champion.trophyDetails?.schoolName || 'N/A'}
                          </div>
                        </div>
                      </div>

                      {/* Squad Toggle Button */}
                      <button
                        onClick={() => toggleSquad(champion.year)}
                        className="w-full bg-gradient-to-r from-cricbuzz-green to-green-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all duration-200 flex items-center justify-center space-x-2"
                      >
                        <span>
                          {isExpanded ? 'Hide' : 'Show'} Full Squad ({champion.squad.length} players)
                        </span>
                        <svg
                          className={`w-5 h-5 transition-transform ${
                            isExpanded ? 'transform rotate-180' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {/* Expandable Squad Section */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200 animate-fadeIn">
                          <div className="mb-3">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">
                              Championship Squad
                            </h3>
                          </div>
                          <div className="space-y-2 max-h-96 overflow-y-auto">
                            {champion.squad.map((player, idx) => (
                              <Link
                                key={player.id || idx}
                                to={`/player/${player.id}`}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center space-x-3 flex-1">
                                  {player.photo ? (
                                    <img
                                      src={player.photo}
                                      alt={player.name}
                                      className="w-10 h-10 rounded-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none'
                                        e.target.nextSibling.style.display = 'flex'
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className={`w-10 h-10 bg-gradient-to-br from-cricbuzz-green to-green-600 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                      player.photo ? 'hidden' : ''
                                    }`}
                                  >
                                    {player.name.charAt(0)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-gray-900 truncate">
                                      {player.name}
                                    </div>
                                    <div className="flex items-center space-x-2 mt-1">
                                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-medium">
                                        {player.role}
                                      </span>
                                      {player.class && (
                                        <span className="text-xs text-gray-600">{player.class}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                {champion.captain === player.name && (
                                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-semibold ml-2">
                                    C
                                  </span>
                                )}
                                {champion.viceCaptain === player.name && (
                                  <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded font-semibold ml-2">
                                    VC
                                  </span>
                                )}
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Trophy Display */}
            {champions.length > 0 && (
              <div className="bg-gradient-to-r from-yellow-50 via-yellow-100 to-yellow-50 rounded-xl p-8 md:p-12 text-center border-2 border-yellow-200 shadow-lg">
                <div className="text-7xl mb-4">🏆</div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-3">
                  School Cricket Championship
                </h2>
                <p className="text-lg text-gray-700 mb-4">
                  Celebrating excellence in cricket since {champions[champions.length - 1]?.year || '2020'}
                </p>
                <div className="flex flex-wrap justify-center gap-4 mt-6">
                  {champions.map((champion) => (
                    <div
                      key={champion.id || champion.year}
                      className="bg-white px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
                    >
                      <div className="text-sm font-semibold text-gray-600">{champion.year}</div>
                      <div className="text-xs text-gray-500 mt-1">{champion.team}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Champion
