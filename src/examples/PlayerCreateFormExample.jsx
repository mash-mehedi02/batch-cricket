/**
 * Example: Player Create Form with Photo Uploader
 * 
 * This is an example showing how to use PlayerPhotoUploader component
 * in a player creation form.
 */

import { useState } from 'react'
import PlayerPhotoUploader from '../components/PlayerPhotoUploader'
import { playersAPI } from '../services/api'

const PlayerCreateFormExample = () => {
  const [formState, setFormState] = useState({
    name: '',
    role: 'Batsman',
    photoURL: '',
    tournamentId: '',
    squadId: '',
    year: new Date().getFullYear(),
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formState.name.trim()) {
      setError('Player name is required')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      const playerData = {
        name: formState.name,
        role: formState.role,
        photo: formState.photoURL, // Cloudinary URL from uploader
        tournamentId: formState.tournamentId,
        squadId: formState.squadId,
        year: formState.year,
        batch: formState.year.toString(),
        stats: {
          matches: 0,
          runs: 0,
          wickets: 0,
          battingInnings: 0,
          bowlingInnings: 0,
          dismissals: 0,
          notOuts: 0,
          strikeRate: 0,
          average: 0,
          economy: 0,
          bowlingAverage: 0,
          bowlingStrikeRate: 0,
          highest: 0,
          fifties: 0,
          hundreds: 0,
          wins: 0,
          losses: 0,
          ties: 0,
        },
      }

      const response = await playersAPI.create(playerData)
      
      if (response.success) {
        setSuccess('Player created successfully!')
        // Reset form
        setFormState({
          name: '',
          role: 'Batsman',
          photoURL: '',
          tournamentId: '',
          squadId: '',
          year: new Date().getFullYear(),
        })
      }
    } catch (err) {
      console.error('Error creating player:', err)
      setError(err.message || 'Failed to create player')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Player</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Photo Uploader */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Player Photo
          </label>
          <PlayerPhotoUploader
            playerId={null} // null for new player
            onUploaded={(url) => {
              setFormState({ ...formState, photoURL: url })
              setSuccess('Photo uploaded! Now fill other details and submit.')
            }}
            folder="players"
            className="mb-4"
          />
        </div>

        {/* Player Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Player Name *
          </label>
          <input
            type="text"
            value={formState.name}
            onChange={(e) => setFormState({ ...formState, name: e.target.value })}
            placeholder="Enter player name"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D8F61]"
            required
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            value={formState.role}
            onChange={(e) => setFormState({ ...formState, role: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D8F61]"
          >
            <option value="Batsman">Batsman</option>
            <option value="Bowler">Bowler</option>
            <option value="All-rounder">All-rounder</option>
            <option value="Wicket-keeper">Wicket-keeper</option>
          </select>
        </div>

        {/* Year */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Year / Batch
          </label>
          <input
            type="number"
            value={formState.year}
            onChange={(e) => setFormState({ ...formState, year: parseInt(e.target.value) || new Date().getFullYear() })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0D8F61]"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full px-6 py-3 rounded-lg font-semibold text-white transition-all ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#0D8F61] hover:bg-[#0a7049] shadow-md hover:shadow-lg'
          }`}
        >
          {loading ? 'Creating...' : 'Create Player'}
        </button>
      </form>
    </div>
  )
}

export default PlayerCreateFormExample

