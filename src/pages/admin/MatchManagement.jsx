import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { matchesAPI, tournamentsAPI, squadsAPI } from '../../services/api'
import { useFirebase } from '../../contexts/FirebaseContext'

const MatchManagement = () => {
  const { currentAdmin } = useFirebase()
  const [matches, setMatches] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [squads, setSquads] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState('all') // all, upcoming, live, completed
  const [formData, setFormData] = useState({
    tournamentId: '',
    teamASquadId: '',
    teamBSquadId: '',
    date: '',
    time: '',
    venue: 'Main Ground',
    format: 'T20',
    oversLimit: 10,
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadTournaments()
    loadMatches()
    
    // Auto-update match statuses every minute
    const interval = setInterval(() => {
      autoUpdateMatchStatuses()
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    loadMatches()
  }, [activeTab])

  useEffect(() => {
    if (formData.tournamentId) {
      loadSquadsForTournament(formData.tournamentId)
    } else {
      setSquads([])
      setFormData((prev) => ({ ...prev, teamASquadId: '', teamBSquadId: '' }))
    }
  }, [formData.tournamentId])

  const loadTournaments = async () => {
    try {
      const response = await tournamentsAPI.getAll()
      setTournaments(response.data || [])
    } catch (error) {
      console.error('Error loading tournaments:', error)
    }
  }

  const loadSquadsForTournament = async (tournamentId) => {
    try {
      // First try: Load squads by tournamentId
      let squadsList = []
      try {
        const response = await squadsAPI.getAll({ tournamentId })
        squadsList = response.data || []
      } catch (error) {
        console.error('Error loading squads by tournamentId:', error)
      }
      
      // If no squads found, try loading from tournament's participantSquads
      if (!squadsList.length) {
        try {
          const tournamentResponse = await tournamentsAPI.getById(tournamentId)
          const tournament = tournamentResponse.data
          
          if (tournament) {
            // Try participantSquads
            if (tournament.participantSquads && tournament.participantSquads.length > 0) {
              const allSquadsResponse = await squadsAPI.getAll()
              const allSquads = allSquadsResponse.data || []
              const participantIds = tournament.participantSquads.map(p => p.squadId || p.id).filter(Boolean)
              squadsList = allSquads.filter(squad => participantIds.includes(squad.id))
            }
            
            // Try group stage squads if still empty
            if (!squadsList.length && tournament.groupStage?.enabled && tournament.groupStage?.groups) {
              const allSquadsResponse = await squadsAPI.getAll()
              const allSquads = allSquadsResponse.data || []
              const groupSquadIds = new Set()
              tournament.groupStage.groups.forEach(group => {
                if (group.squads && Array.isArray(group.squads)) {
                  group.squads.forEach(squad => {
                    const squadId = squad.squadId || squad.id
                    if (squadId) groupSquadIds.add(squadId)
                  })
                }
              })
              squadsList = allSquads.filter(squad => groupSquadIds.has(squad.id))
            }
          }
        } catch (error) {
          console.error('Error loading squads from tournament data:', error)
        }
      }
      
      setSquads(squadsList)
      
      // Clear team selections if no squads available
      if (squadsList.length === 0) {
        setFormData((prev) => ({ ...prev, teamASquadId: '', teamBSquadId: '' }))
        // Don't show error here - it will be shown in the UI warning box
      } else {
        // Clear any previous errors if squads loaded successfully
        setError('')
      }
    } catch (error) {
      console.error('Error loading squads:', error)
      setSquads([])
      setFormData((prev) => ({ ...prev, teamASquadId: '', teamBSquadId: '' }))
    }
  }

  const loadMatches = async () => {
    try {
      setLoading(true)
      const params = {}
      if (activeTab !== 'all') {
        params.status = activeTab.charAt(0).toUpperCase() + activeTab.slice(1)
      }

      const response = await matchesAPI.getAll(params)
      setMatches(response.data || [])
      setError('')
    } catch (error) {
      console.error('Error loading matches:', error)
      setError('Failed to load matches')
    } finally {
      setLoading(false)
    }
  }

  const autoUpdateMatchStatuses = async () => {
    try {
      // Call backend API to auto-update match statuses
      await matchesAPI.autoUpdateStatus()
      // Reload matches to get updated statuses
      loadMatches()
    } catch (error) {
      console.error('Error auto-updating match statuses:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // ICC Rule: Validate Team A and Team B are different
    if (formData.teamASquadId === formData.teamBSquadId) {
      setError('⚠️ Team A and Team B cannot be the same squad (ICC Rule)')
      return
    }

    // Validate required fields
    if (!formData.tournamentId) {
      setError('Please select a tournament')
      return
    }

    if (!formData.teamASquadId) {
      setError('Please select Team A')
      return
    }

    if (!formData.teamBSquadId) {
      setError('Please select Team B')
      return
    }

    if (!formData.date) {
      setError('Please select match date')
      return
    }

    if (!formData.time) {
      setError('Please select match time')
      return
    }

    // Validate date is not in the past (allow same day)
    const matchDateTime = new Date(`${formData.date}T${formData.time}`)
    const now = new Date()
    if (matchDateTime < now && matchDateTime.toDateString() !== now.toDateString()) {
      setError('⚠️ Match date cannot be in the past')
      return
    }

    // Validate overs limit
    if (formData.oversLimit && (formData.oversLimit < 1 || formData.oversLimit > 50)) {
      setError('Overs limit must be between 1 and 50')
      return
    }

    try {
      await matchesAPI.create(formData)
      setSuccess('✅ Match created successfully!')
      closeModal()
      loadMatches()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError(error.message || 'Failed to create match')
    }
  }

  const handleMarkComplete = async (matchId) => {
    if (!window.confirm('Mark this match as finished?')) {
      return
    }

    try {
      // Use updateStatus endpoint to properly mark as Finished (manually ended)
      await matchesAPI.updateStatus(matchId, 'Finished')
      setSuccess('Match marked as finished!')
      loadMatches()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError(error.message || 'Failed to update match status')
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this match?')) {
      return
    }

    try {
      await matchesAPI.delete(id)
      setSuccess('Match deleted successfully!')
      loadMatches()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError(error.message || 'Failed to delete match')
    }
  }

  const openCreateModal = () => {
    setFormData({
      tournamentId: '',
      teamASquadId: '',
      teamBSquadId: '',
      date: '',
      time: '',
      venue: 'Main Ground',
      format: 'T20',
      oversLimit: 10,
    })
    setError('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setError('')
  }

  const formatDateTime = (date, time) => {
    if (!date) return '-'
    const dateTime = time ? new Date(`${date}T${time}`) : new Date(date)
    return dateTime.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getStatusBadge = (status) => {
    const statusColors = {
      Upcoming: 'bg-blue-100 text-blue-800',
      Live: 'bg-red-100 text-red-800',
      Completed: 'bg-gray-100 text-gray-800',
      Finished: 'bg-gray-100 text-gray-800',
    }
    return statusColors[status] || 'bg-gray-100 text-gray-800'
  }

  if (!currentAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please login to access this page</p>
        </div>
      </div>
    )
  }

  const filteredMatches = matches.filter((match) => {
    if (activeTab === 'all') return true
    // Handle both 'Completed' and 'Finished' for completed tab
    if (activeTab === 'completed') {
      return match.status.toLowerCase() === 'completed' || match.status.toLowerCase() === 'finished'
    }
    return match.status.toLowerCase() === activeTab
  })

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Match Management</h1>
            <p className="text-gray-600 mt-1">Manage cricket matches and schedules</p>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-cricbuzz-green text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-2"
          >
            <span>+</span>
            <span>Create Match</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'all', label: 'All Matches' },
                { id: 'upcoming', label: 'Upcoming' },
                { id: 'live', label: 'Live' },
                { id: 'completed', label: 'Completed' },
                { id: 'finished', label: 'Finished' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-cricbuzz-green text-cricbuzz-green'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.label}
                  {tab.id !== 'all' && (
                    <span className="ml-2 px-2 py-1 text-xs bg-gray-100 rounded-full">
                      {matches.filter((m) => m.status.toLowerCase() === tab.id).length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Create Match Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Create New Match</h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tournament <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.tournamentId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tournamentId: e.target.value,
                        teamASquadId: '',
                        teamBSquadId: '',
                      })
                    }
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                  >
                    <option value="">Select Tournament</option>
                    {tournaments.length === 0 ? (
                      <option value="" disabled>No tournaments available. Create a tournament first.</option>
                    ) : (
                      tournaments.map((tournament) => (
                        <option key={tournament.id} value={tournament.id}>
                          {tournament.name} ({tournament.year})
                        </option>
                      ))
                    )}
                  </select>
                  {tournaments.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600 font-semibold">
                      ⚠️ No tournaments available. Please create a tournament first.
                    </p>
                  )}
                </div>
                
                {/* Squads availability warning */}
                {formData.tournamentId && squads.length === 0 && !loading && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800 font-semibold">
                      ⚠️ No squads found for this tournament. Please create squads under Squad Management first.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Team A <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.teamASquadId}
                      onChange={(e) => {
                        const newTeamA = e.target.value
                        // If Team B is same as new Team A, clear Team B
                        if (newTeamA === formData.teamBSquadId) {
                          setFormData({ ...formData, teamASquadId: newTeamA, teamBSquadId: '' })
                          setError('Team A and Team B cannot be the same. Please select a different team for Team B.')
                        } else {
                          setFormData({ ...formData, teamASquadId: newTeamA })
                          setError('')
                        }
                      }}
                      required
                      disabled={!formData.tournamentId}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green disabled:bg-gray-100 ${
                        formData.teamASquadId && formData.teamASquadId === formData.teamBSquadId
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select Team A</option>
                      {squads.map((squad) => (
                        <option key={squad.id} value={squad.id} disabled={squad.id === formData.teamBSquadId}>
                          {squad.teamName || `Batch ${squad.batch}`}
                          {squad.id === formData.teamBSquadId ? ' (Selected as Team B)' : ''}
                        </option>
                      ))}
                    </select>
                    {formData.teamASquadId && formData.teamASquadId === formData.teamBSquadId && (
                      <p className="mt-1 text-xs text-red-600 font-semibold">
                        ⚠️ Cannot select same squad for both teams
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Team B <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.teamBSquadId}
                      onChange={(e) => {
                        const newTeamB = e.target.value
                        // If Team A is same as new Team B, clear Team A
                        if (newTeamB === formData.teamASquadId) {
                          setFormData({ ...formData, teamASquadId: '', teamBSquadId: newTeamB })
                          setError('Team A and Team B cannot be the same. Please select a different team for Team A.')
                        } else {
                          setFormData({ ...formData, teamBSquadId: newTeamB })
                          setError('')
                        }
                      }}
                      required
                      disabled={!formData.tournamentId}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green disabled:bg-gray-100 ${
                        formData.teamBSquadId && formData.teamBSquadId === formData.teamASquadId
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select Team B</option>
                      {squads.map((squad) => (
                        <option key={squad.id} value={squad.id} disabled={squad.id === formData.teamASquadId}>
                          {squad.teamName || `Batch ${squad.batch}`}
                          {squad.id === formData.teamASquadId ? ' (Selected as Team A)' : ''}
                        </option>
                      ))}
                    </select>
                    {formData.teamBSquadId && formData.teamBSquadId === formData.teamASquadId && (
                      <p className="mt-1 text-xs text-red-600 font-semibold">
                        ⚠️ Cannot select same squad for both teams
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Match Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => {
                        const selectedDate = e.target.value
                        setFormData({ ...formData, date: selectedDate })
                        // Validate date
                        if (selectedDate) {
                          const matchDate = new Date(selectedDate)
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          if (matchDate < today) {
                            setError('⚠️ Match date cannot be in the past')
                          } else {
                            setError('')
                          }
                        }
                      }}
                      min={new Date().toISOString().split('T')[0]}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Match Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                    <input
                      type="text"
                      value={formData.venue}
                      onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
                    <select
                      value={formData.format}
                      onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                    >
                      <option value="T20">T20</option>
                      <option value="ODI">ODI</option>
                      <option value="Test">Test</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Overs Per Innings <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={formData.oversLimit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          oversLimit: Math.max(1, Math.min(50, Number(e.target.value))),
                        })
                      }
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      School matches vary—set the number of overs for this game.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    className="flex-1 bg-cricbuzz-green text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold"
                  >
                    Create Match
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Matches List */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4 animate-pulse">🏏</div>
            <p className="text-gray-500">Loading matches...</p>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📅</div>
            <p className="text-gray-500 text-lg">No matches found</p>
            <p className="text-gray-400 text-sm mt-2">
              {activeTab === 'all'
                ? 'Create your first match to get started'
                : `No ${activeTab} matches found`}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Match
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tournament
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Venue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMatches.map((match) => (
                    <tr key={match.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {match.teamAName || match.team1} vs {match.teamBName || match.team2}
                        </div>
                        {match.format && (
                          <div className="text-xs text-gray-500">{match.format}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{match.tournamentName || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDateTime(match.date, match.time)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{match.venue || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                            match.status
                          )}`}
                        >
                          {match.status}
                          {match.status === 'Live' && (
                            <span className="ml-1 w-2 h-2 bg-red-500 rounded-full inline-block animate-pulse"></span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          {match.status === 'Live' && (
                            <>
                              <Link
                                to={`/live/${match.id}`}
                                className="text-blue-600 hover:text-blue-900 font-semibold"
                              >
                                View Live
                              </Link>
                              <span className="text-gray-300">|</span>
                            </>
                          )}
                          {match.status === 'Live' && (
                            <>
                              <button
                                onClick={() => handleMarkComplete(match.id)}
                                className="text-green-600 hover:text-green-900 font-semibold"
                              >
                                Mark Complete
                              </button>
                              <span className="text-gray-300">|</span>
                            </>
                          )}
                          <button
                            onClick={() => handleDelete(match.id)}
                            className="text-red-600 hover:text-red-900 font-semibold"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MatchManagement

