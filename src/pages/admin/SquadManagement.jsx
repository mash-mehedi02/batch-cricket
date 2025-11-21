import { useState, useEffect, useMemo, useCallback } from 'react'
import { squadsAPI, tournamentsAPI } from '../../services/api'
import { useFirebase } from '../../contexts/FirebaseContext'

const SquadManagement = () => {
  const { currentAdmin } = useFirebase()
  const [squads, setSquads] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSquad, setEditingSquad] = useState(null)
  const [filterTournamentId, setFilterTournamentId] = useState('')
  const [formData, setFormData] = useState({
    teamName: '',
    year: new Date().getFullYear(),
    tournamentId: '',
    groupKey: '',
    players: [{ name: '', role: 'Batsman', village: '', batch: '' }],
    captain: '',
    viceCaptain: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadTournaments = useCallback(async () => {
    try {
      const response = await tournamentsAPI.getAll()
      setTournaments(response.data || [])
    } catch (error) {
      console.error('Error loading tournaments:', error)
    }
  }, [])

  const loadSquads = useCallback(async () => {
    try {
      setLoading(true)
      const params = {}
      if (filterTournamentId) {
        params.tournamentId = filterTournamentId
      }

      const response = await squadsAPI.getAll(params)
      setSquads(response.data || [])
      setError('')
    } catch (error) {
      console.error('Error loading squads:', error)
      setError('Failed to load squads')
    } finally {
      setLoading(false)
    }
  }, [filterTournamentId])

  useEffect(() => {
    loadTournaments()
  }, [loadTournaments])

  useEffect(() => {
    loadSquads()
  }, [loadSquads])

  const selectedTournament = useMemo(
    () => tournaments.find((tournament) => tournament.id === formData.tournamentId),
    [tournaments, formData.tournamentId]
  )

  const availableGroups = useMemo(() => {
    if (!selectedTournament?.groupStage?.enabled) {
      return []
    }
    return selectedTournament.groupStage.groups || []
  }, [selectedTournament])

  useEffect(() => {
    if (availableGroups.length === 0) {
      if (formData.groupKey !== '') {
        setFormData((prev) => ({ ...prev, groupKey: '' }))
      }
      return
    }

    const exists = availableGroups.some((grp) => grp.key === formData.groupKey)
    if (!exists) {
      setFormData((prev) => ({ ...prev, groupKey: availableGroups[0].key }))
    }
  }, [availableGroups, formData.groupKey])

  const handleAddPlayer = () => {
    setFormData({
      ...formData,
      players: [...formData.players, { name: '', role: 'Batsman', village: '', batch: '' }],
    })
  }

  const handleRemovePlayer = (index) => {
    const newPlayers = formData.players.filter((_, i) => i !== index)
    setFormData({ ...formData, players: newPlayers })
  }

  const handlePlayerChange = (index, field, value) => {
    const newPlayers = [...formData.players]
    newPlayers[index][field] = value
    setFormData({ ...formData, players: newPlayers })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Tournament is now optional - squads can be independent
    // Validation removed to allow independent squad creation

    // Group is only required if tournament is selected and has groups
    if (formData.tournamentId && availableGroups.length > 0 && !formData.groupKey) {
      setError('Please select a group')
      return
    }

    try {
      const submitData = {
        teamName: formData.teamName,
        year: formData.year,
        tournamentId: formData.tournamentId || null, // Optional - squads can be independent
        groupKey: formData.tournamentId && availableGroups.length > 0 ? formData.groupKey : '',
        players: formData.players.filter((p) => p.name.trim() !== ''),
        captain: formData.captain || null,
        viceCaptain: formData.viceCaptain || null,
      }

      if (editingSquad) {
        await squadsAPI.update(editingSquad.id, submitData)
        setSuccess('Squad updated successfully!')
      } else {
        await squadsAPI.create(submitData)
        setSuccess('Squad created successfully!')
      }

      setShowModal(false)
      setEditingSquad(null)
      setFormData({
        teamName: '',
        year: new Date().getFullYear(),
        tournamentId: '',
        groupKey: '',
        players: [{ name: '', role: 'Batsman', village: '', batch: '' }],
        captain: '',
        viceCaptain: '',
      })
      loadSquads()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError(error.message || 'Failed to save squad')
    }
  }

  const handleEdit = (squad) => {
    setEditingSquad(squad)
    setFormData({
      teamName: squad.teamName || squad.batch || '',
      year: squad.year || parseInt(squad.batch) || new Date().getFullYear(),
      tournamentId: squad.tournamentId || '',
      groupKey: squad.groupKey || '',
      players: squad.players?.length > 0
        ? squad.players.map((p) => ({
            name: p.name || '',
            role: p.role || 'Batsman',
            village: p.village || '',
            batch: p.batch || '',
          }))
        : [{ name: '', role: 'Batsman', village: '', batch: '' }],
      captain: squad.captain || '',
      viceCaptain: squad.viceCaptain || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this squad?')) {
      return
    }

    try {
      await squadsAPI.delete(id)
      setSuccess('Squad deleted successfully!')
      loadSquads()
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError(error.message || 'Failed to delete squad')
    }
  }

  const openCreateModal = () => {
    setEditingSquad(null)
    setFormData({
      teamName: '',
      year: new Date().getFullYear(),
      tournamentId: '',
      groupKey: '',
      players: [{ name: '', role: 'Batsman', village: '', batch: '' }],
      captain: '',
      viceCaptain: '',
    })
    setError('')
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingSquad(null)
    setError('')
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
            <h1 className="text-3xl font-bold text-gray-800">Squad Management</h1>
            <p className="text-gray-600 mt-1">Manage team squads under tournaments</p>
          </div>
          <button
            onClick={openCreateModal}
            className="bg-cricbuzz-green text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center gap-2"
          >
            <span>+</span>
            <span>Add Squad</span>
          </button>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Filter by Tournament:
            </label>
            <select
              value={filterTournamentId}
              onChange={(e) => setFilterTournamentId(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
            >
              <option value="">All Tournaments</option>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name} ({tournament.year})
                </option>
              ))}
            </select>
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

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">
                  {editingSquad ? 'Edit Squad' : 'Create New Squad'}
                </h2>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tournament (Optional)
                    </label>
                    <p className="text-xs text-gray-500 mb-2">Squads can be created independently without a tournament</p>
                    <select
                      value={formData.tournamentId}
                      onChange={(e) => setFormData({ ...formData, tournamentId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                    >
                      <option value="">Select Tournament (Optional)</option>
                      {tournaments.map((tournament) => (
                        <option key={tournament.id} value={tournament.id}>
                          {tournament.name} ({tournament.year})
                        </option>
                      ))}
                    </select>
                  </div>
                  {availableGroups.length > 0 && formData.tournamentId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Group <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.groupKey}
                        onChange={(e) => setFormData({ ...formData, groupKey: e.target.value })}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                      >
                        {availableGroups.map((group) => (
                          <option key={group.key} value={group.key}>
                            {group.name} ({group.key})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Tournament groups enabled. Assign this squad to the appropriate group.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Team Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.teamName}
                      onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                      required
                      placeholder="e.g., Rangers 19, Demons 20"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Year <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                      required
                      min="2020"
                      max="2100"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">Players (Optional)</label>
                    <button
                      type="button"
                      onClick={handleAddPlayer}
                      className="text-sm text-cricbuzz-green hover:text-green-700 font-semibold"
                    >
                      + Add Player
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {formData.players.map((player, index) => (
                      <div key={index} className="flex gap-2 items-start p-2 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Player Name</label>
                            <input
                              type="text"
                              value={player.name}
                              onChange={(e) => handlePlayerChange(index, 'name', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                            <select
                              value={player.role}
                              onChange={(e) => handlePlayerChange(index, 'role', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
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
                              value={player.village || ''}
                              onChange={(e) => handlePlayerChange(index, 'village', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Batch / Passing Year</label>
                            <input
                              type="number"
                              value={player.batch || ''}
                              onChange={(e) => handlePlayerChange(index, 'batch', e.target.value ? Number.parseInt(e.target.value, 10) : '')}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => handleRemovePlayer(index)}
                              className="w-full bg-red-100 text-red-600 px-3 py-2 rounded-lg hover:bg-red-200 transition-colors"
                              disabled={formData.players.length === 1}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Captain (Optional)</label>
                    <input
                      type="text"
                      value={formData.captain}
                      onChange={(e) => setFormData({ ...formData, captain: e.target.value })}
                      placeholder="Captain name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vice Captain (Optional)</label>
                    <input
                      type="text"
                      value={formData.viceCaptain}
                      onChange={(e) => setFormData({ ...formData, viceCaptain: e.target.value })}
                      placeholder="Vice captain name"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricbuzz-green"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    className="flex-1 bg-cricbuzz-green text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-semibold"
                  >
                    {editingSquad ? 'Update Squad' : 'Create Squad'}
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

        {/* Table View */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4 animate-pulse">🏏</div>
            <p className="text-gray-500">Loading squads...</p>
          </div>
        ) : squads.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">👥</div>
            <p className="text-gray-500 text-lg">No squads found</p>
            <p className="text-gray-400 text-sm mt-2">
              {filterTournamentId ? 'No squads found for selected tournament' : 'Create your first squad to get started'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tournament
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Players
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Captain
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Group
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {squads.map((squad) => (
                    <tr key={squad.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {squad.teamName || `Batch ${squad.batch || squad.year}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {squad.tournamentName || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{squad.year || squad.batch || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{squad.players?.length || 0}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{squad.captain || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {squad.groupKey ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                            {squad.groupName || `Group ${squad.groupKey}`}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(squad)}
                            className="text-blue-600 hover:text-blue-900 font-semibold"
                          >
                            Edit
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => handleDelete(squad.id)}
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

export default SquadManagement
