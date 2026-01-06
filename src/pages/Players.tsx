/**
 * Players Page
 * Display all players from Firebase
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { playerService } from '@/services/firestore/players'
import { Player } from '@/types'
import { SkeletonCard } from '@/components/skeletons/SkeletonCard'
import PlayerAvatar from '@/components/common/PlayerAvatar'

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const loadPlayers = async () => {
      try {
        setLoading(true)
        const allPlayers = await playerService.getAll()
        setPlayers(allPlayers)
      } catch (error) {
        console.error('Error loading players:', error)
      } finally {
        setLoading(false)
      }
    }

    loadPlayers()
  }, [])

  const filteredPlayers = players.filter(player =>
    player.name.toLowerCase().includes(searchQuery.toLowerCase())
  )


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-1 w-12 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-full"></div>
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-slate-900 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
            Players
          </h1>
          <div className="h-1 flex-1 bg-gradient-to-r from-emerald-500/30 to-transparent rounded-full"></div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="Search players by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-5 py-3 pl-12 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-lg placeholder:text-slate-400 font-medium"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            🔍
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <SkeletonCard key={i} showAvatar={true} />
          ))}
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl shadow-lg p-12 text-center border-2 border-dashed border-slate-200">
          <div className="text-5xl mb-4">🏏</div>
          <p className="text-lg text-slate-600 font-medium">
            {searchQuery ? 'No players found matching your search' : 'No players found'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPlayers.map((player) => (
            <Link
              key={player.id}
              to={`/players/${player.id}`}
              className="group bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border-2 border-slate-200 hover:border-emerald-400 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-400/10 rounded-full -mr-12 -mt-12"></div>
              <div className="relative">
                <div className="flex items-center gap-4 mb-5">
                  <PlayerAvatar
                    photoUrl={player.photoUrl || (player as any).photo}
                    name={player.name}
                    size="md"
                    className="w-16 h-16 border-4 border-emerald-200 shadow-lg group-hover:border-emerald-400 transition"
                  />
                  <div className="flex-1">
                    <h3 className="text-lg font-extrabold text-slate-900 group-hover:text-emerald-600 transition">
                      {player.name}
                    </h3>
                    <p className="text-sm font-semibold text-slate-500 capitalize">{player.role}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {player.battingStyle && (
                    <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                      <p className="text-slate-700">
                        <span className="font-bold text-blue-700">Bat:</span> {player.battingStyle}
                      </p>
                    </div>
                  )}
                  {player.bowlingStyle && (
                    <div className="bg-purple-50 rounded-lg p-2 border border-purple-100">
                      <p className="text-slate-700">
                        <span className="font-bold text-purple-700">Bowl:</span> {player.bowlingStyle}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}


