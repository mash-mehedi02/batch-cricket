import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { playersAPI, tournamentsAPI, squadsAPI } from '../../services/api'
import { useFirebase } from '../../contexts/FirebaseContext'
import PlayerPhotoUploader from '../../components/PlayerPhotoUploader'

const TOTAL_STEPS = 5
const STEP_LABELS = ['Player Info', 'Tournament', 'Squad', 'Year', 'Review']

const PlayerManagement = () => {
  const { currentAdmin } = useFirebase()
  const navigate = useNavigate()
  const [players, setPlayers] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [squads, setSquads] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterTournament, setFilterTournament] = useState('')
  const [filterSquad, setFilterSquad] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    role: 'Batsman',
    village: '',
    photo: '',
    stats: {
      runs: 0,
      wickets: 0,
    },
    tournamentId: '',
    squadId: '',
    year: new Date().getFullYear(),
    batch: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    loadTournaments()
    loadPlayers()
  }, [])

  useEffect(() => {
    if (formData.tournamentId) {
      loadSquadsForTournament(formData.tournamentId)
    } else {
      setSquads([])
      setFormData({ ...formData, squadId: '' })
    }
  }, [formData.tournamentId])

  useEffect(() => {
    loadPlayers()
  }, [searchTerm, filterYear, filterTournament, filterSquad])

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
      const response = await squadsAPI.getAll({ tournamentId })
      setSquads(response.data || [])
    } catch (error) {
      console.error('Error loading squads:', error)
      setSquads([])
    }
  }

  const loadPlayers = async () => {
    try {
      setLoading(true)
      const params = {}
      if (filterYear) params.year = filterYear
      if (filterTournament) params.tournamentId = filterTournament
      if (filterSquad) params.squadId = filterSquad
      if (searchTerm) params.search = searchTerm

      const response = await playersAPI.getAll(params)
      setPlayers(response.data || [])
      setError('')
    } catch (error) {
      console.error('Error loading players:', error)
      setError('Failed to load players')
    } finally {
      setLoading(false)
    }
  }

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        setError('Player name is required')
        return
      }
      setCurrentStep(2)
    } else if (currentStep === 2) {
      // Tournament is now optional - players can be independent
      // Skip to next step regardless of tournament selection
      setCurrentStep(3)
    } else if (currentStep === 3) {
      // Squad is now optional - players can be independent
      // Skip to next step regardless of squad selection
      setCurrentStep(4)
    } else if (currentStep === 4) {
      if (!formData.year || Number.isNaN(formData.year)) {
        setError('Please enter a valid year')
        return
      }
      setCurrentStep(5)
    }
    setError('')
  }

  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // If user presses Enter before reaching final step, move to next step instead of submitting
    if (currentStep < TOTAL_STEPS) {
      handleNextStep()
      return
    }

    if (!formData.year || Number.isNaN(formData.year)) {
      setError('Please select a valid year')
      return
    }

    try {
      const submitData = {
        name: formData.name,
        role: formData.role,
        village: formData.village || '',
        photo: formData.photo || '',
        stats: {
          matches: 0,
          runs: parseInt(formData.stats.runs) || 0,
          wickets: parseInt(formData.stats.wickets) || 0,
          strikeRate: 0,
          average: 0,
        },
        tournamentId: formData.tournamentId,
        squadId: formData.squadId,
        year: formData.year,
        batch: formData.batch || '',
      }

      if (editingPlayer) {
        await playersAPI.update(editingPlayer.id, submitData)
        setSuccess('Player updated successfully!')
      } else {
        await playersAPI.create(submitData)
        setSuccess('Player created successfully!')
      }

      closeModal()
      loadPlayers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError(error.message || 'Failed to save player')
    }
  }

  const handleEdit = (player) => {
    setEditingPlayer(player)
    setFormData({
      name: player.name,
      role: player.role,
      village: player.village || '',
      photo: player.photo || '',
      stats: {
        runs: player.stats?.runs || 0,
        wickets: player.stats?.wickets || 0,
      },
      tournamentId: player.tournamentId || '',
      squadId: player.squadId || '',
      year: player.year || parseInt(player.batch) || new Date().getFullYear(),
      batch: player.batch || '',
    })
    setCurrentStep(1)
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this player?')) {
      return
    }

    try {
      await playersAPI.delete(id)
      setSuccess('Player deleted successfully!')
      loadPlayers()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError(error.message || 'Failed to delete player')
    }
  }

  const openCreateModal = () => {
    setEditingPlayer(null)
    setCurrentStep(1)
    setFormData({
      name: '',
      role: 'Batsman',
      village: '',
      photo: '',
      stats: {
        runs: 0,
        wickets: 0,
      },
      tournamentId: '',
      squadId: '',
      year: new Date().getFullYear(),
      batch: '',
    })
    setError('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingPlayer(null)
    setCurrentStep(1)
    setError('')
  }

  const handlePlayerClick = (playerId) => {
    navigate(`/player/${playerId}`)
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Player Management</h1>
            <p className="text-gray-600 mt-1">Manage player profiles and statistics</p>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-cricbuzz-green text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-2"
          >
            <span>+</span>
            <span>Add Player</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Year</label>
              <input
                type="number"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                placeholder="e.g., 2024"
                min="2020"
                max="2100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Tournament</label>
              <select
                value={filterTournament}
                onChange={(e) => setFilterTournament(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
              >
                <option value="">All Tournaments</option>
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Squad</label>
              <input
                type="text"
                value={filterSquad}
                onChange={(e) => setFilterSquad(e.target.value)}
                placeholder="Squad ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
              />
            </div>
          </div>
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

        {/* Multi-step Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Step Indicator */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-800">
                    {editingPlayer ? 'Edit Player' : 'Create New Player'}
                  </h2>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
                    aria-label="Close modal"
                  >
                    ×
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  {STEP_LABELS.map((label, index) => (
                    <div key={index} className="flex items-center flex-1">
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                            currentStep > index + 1
                              ? 'bg-green-500 text-white'
                              : currentStep === index + 1
                              ? 'bg-cricbuzz-green text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {currentStep > index + 1 ? '✓' : index + 1}
                        </div>
                        <span className="text-xs mt-1 text-gray-600 hidden sm:block">{label}</span>
                      </div>
                      {index < TOTAL_STEPS - 1 && (
                        <div
                          className={`h-1 flex-1 mx-2 ${
                            currentStep > index + 1 ? 'bg-green-500' : 'bg-gray-200'
                          }`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {/* Step 1: Player Info */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Player Information</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Player Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                        placeholder="Enter player name"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                        >
                          <option value="Batsman">Batsman</option>
                          <option value="Bowler">Bowler</option>
                          <option value="All-rounder">All-rounder</option>
                          <option value="Wicket-keeper">Wicket-keeper</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Village</label>
                        <input
                          type="text"
                          value={formData.village}
                          onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                          placeholder="Village name"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Player Photo</label>
                      <PlayerPhotoUploader
                        playerId={editingPlayer?.id || null}
                        onUploaded={(url) => {
                          setFormData({ ...formData, photo: url })
                          setSuccess('Photo uploaded successfully!')
                        }}
                        folder="players"
                        initialPhotoUrl={formData.photo || editingPlayer?.photo || null}
                        className="mb-4"
                      />
                      {/* Fallback: Manual URL input */}
                      <div className="mt-2">
                        <label className="block text-xs text-gray-500 mb-1">Or enter photo URL manually</label>
                        <input
                          type="url"
                          value={formData.photo}
                          onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                          placeholder="https://..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Runs</label>
                        <input
                          type="number"
                          value={formData.stats.runs}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              stats: { ...formData.stats, runs: parseInt(e.target.value) || 0 },
                            })
                          }
                          min="0"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Wickets</label>
                        <input
                          type="number"
                          value={formData.stats.wickets}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              stats: { ...formData.stats, wickets: parseInt(e.target.value) || 0 },
                            })
                          }
                          min="0"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Tournament */}
                {currentStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Tournament (Optional)</h3>
                    <p className="text-sm text-gray-500 mb-2">Players can be created independently without a tournament</p>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tournament (Optional)
                      </label>
                      <select
                        value={formData.tournamentId}
                        onChange={(e) => setFormData({ ...formData, tournamentId: e.target.value, squadId: '' })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                      >
                        <option value="">Select Tournament</option>
                        {tournaments.map((tournament) => (
                          <option key={tournament.id} value={tournament.id}>
                            {tournament.name} ({tournament.year})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Step 3: Squad */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Squad (Optional)</h3>
                    <p className="text-sm text-gray-500 mb-2">Players can be created independently without a squad</p>
                    {!formData.tournamentId ? (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-blue-800">No tournament selected. You can create a player without a squad.</p>
                      </div>
                    ) : squads.length === 0 ? (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800">No squads found for this tournament. You can still create a player without a squad.</p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Squad (Optional)
                        </label>
                        <select
                          value={formData.squadId}
                          onChange={(e) => setFormData({ ...formData, squadId: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green max-h-60 overflow-y-auto"
                        >
                          <option value="">Select Squad</option>
                          {squads.map((squad) => (
                            <option key={squad.id} value={squad.id}>
                              {squad.teamName || `Batch ${squad.batch}`} ({squad.year})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: Year */}
                {currentStep === 4 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Year</h3>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Session / Playing Year <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.year}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            year: Number.parseInt(e.target.value, 10) || '',
                          })
                        }
                        required
                        min="2020"
                        max="2100"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Batch / Passing Year</label>
                      <input
                        type="number"
                        value={formData.batch}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            batch: e.target.value ? Number.parseInt(e.target.value, 10) : '',
                          })
                        }
                        placeholder="Year the player passed out"
                        min="2000"
                        max="2100"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                      />
                    </div>
                  </div>
                )}

                {/* Step 5: Review */}
                {currentStep === 5 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Review Player Details</h3>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                      <div>
                        <p className="text-sm text-gray-500">Name</p>
                        <p className="text-base font-semibold text-gray-900">{formData.name}</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Role</p>
                          <p className="text-base font-semibold text-gray-900">{formData.role}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Village</p>
                          <p className="text-base font-semibold text-gray-900">{formData.village || '-'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Tournament</p>
                          <p className="text-base font-semibold text-gray-900">
                            {tournaments.find((t) => t.id === formData.tournamentId)?.name || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Squad</p>
                          <p className="text-base font-semibold text-gray-900">
                            {squads.find((s) => s.id === formData.squadId)?.teamName ||
                              squads.find((s) => s.id === formData.squadId)?.name ||
                              '-'}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Session / Year</p>
                        <p className="text-base font-semibold text-gray-900">{formData.year}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Batch / Passing Year</p>
                        <p className="text-base font-semibold text-gray-900">{formData.batch || '-'}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Review the information above before saving. Click "Previous" if you need to make changes.
                    </p>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="flex gap-3 pt-6 border-t border-gray-200 mt-6">
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold"
                    >
                      Previous
                    </button>
                  )}
                  <div className="flex-1" />
                  {currentStep < TOTAL_STEPS ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-6 py-2 bg-cricbuzz-green text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="px-6 py-2 bg-cricbuzz-green text-white rounded-lg hover:bg-green-700 transition-colors font-semibold"
                    >
                      {editingPlayer ? 'Update Player' : 'Create Player'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Table View */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4 animate-pulse">🏏</div>
            <p className="text-gray-500">Loading players...</p>
          </div>
        ) : players.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">👤</div>
            <p className="text-gray-500 text-lg">No players found</p>
            <p className="text-gray-400 text-sm mt-2">Create your first player to get started</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Player
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tournament
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Squad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Batch
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Stats
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {players.map((player) => (
                    <tr
                      key={player.id}
                      onClick={() => handlePlayerClick(player.id)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {player.photo && (
                            <img
                              src={player.photo}
                              alt={player.name}
                              className="w-10 h-10 rounded-full object-cover mr-3"
                              onError={(e) => {
                                e.target.style.display = 'none'
                              }}
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{player.name}</div>
                            {player.village && <div className="text-xs text-gray-500">{player.village}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {player.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{player.tournamentName || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{player.squadName || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{player.year || '-'}</div>
                        {player.batch && (
                          <div className="text-xs text-gray-500">Batch / Passing Year: {player.batch}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          Runs: {player.stats?.runs || 0} | Wickets: {player.stats?.wickets || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div
                          className="flex justify-end gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleEdit(player)}
                            className="text-blue-600 hover:text-blue-900 font-semibold"
                          >
                            Edit
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => handleDelete(player.id)}
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

export default PlayerManagement
