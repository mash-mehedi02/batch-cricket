/**
 * Live Matches Monitor Page
 * Real-time list of all live matches
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { Match } from '@/types'
import { SkeletonCard } from '@/components/skeletons/SkeletonCard'

export default function AdminLiveMatches() {
  const [liveMatches, setLiveMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadLiveMatches = async () => {
      try {
        const matches = await matchService.getLiveMatches()
        setLiveMatches(matches)
        setLoading(false)
      } catch (error) {
        console.error('Error loading live matches:', error)
        setLoading(false)
      }
    }

    loadLiveMatches()

    // Subscribe to live matches
    const interval = setInterval(loadLiveMatches, 5000) // Refresh every 5 seconds

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Live Matches</h1>
          <p className="text-gray-600 mt-1">Monitor and score live matches in real-time</p>
        </div>
      </div>

      {liveMatches.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 border border-gray-200 text-center">
          <div className="text-6xl mb-4">⚽</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Live Matches</h3>
          <p className="text-gray-600 mb-6">There are no matches currently in progress.</p>
          <Link
            to="/admin/matches/new"
            className="inline-block px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700"
          >
            Create New Match
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveMatches.map((match) => (
            <div
              key={match.id}
              className="bg-white rounded-xl shadow-md p-6 border-2 border-red-200 hover:shadow-lg transition"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-semibold text-red-700 uppercase">LIVE</span>
                </div>
                <span className="text-sm text-gray-600">{match.venue || 'Venue TBD'}</span>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {match.teamAName || (match as any).teamA} vs {match.teamBName || (match as any).teamB}
              </h3>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Current Score</div>
                <div className="text-2xl font-bold text-gray-900">
                  {/* Score is dynamically fetched/calculated by MatchCard in public view, 
                      here we just show a placeholder or basic info */}
                  Live Scoring...
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  to={`/admin/live/${match.id}/scoring`}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 text-center transition"
                >
                  Score Match
                </Link>
                <Link
                  to={`/match/${match.id}`}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

