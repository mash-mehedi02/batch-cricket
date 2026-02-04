/**
 * Champions Archive Page
 * Display tournament winners and champions
 */

import { useEffect, useState } from 'react'
import { tournamentService } from '@/services/firestore/tournaments'
import { Tournament } from '@/types'

export default function Champions() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadTournaments = async () => {
      try {
        setLoading(true)
        const allTournaments = await tournamentService.getAll()
        // Filter completed tournaments with winners
        const completedTournaments = allTournaments.filter(
          t => t.status === 'completed' && t.winnerSquadId
        )
        setTournaments(completedTournaments)
      } catch (error) {
        console.error('Error loading tournaments:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTournaments()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-batchcrick-teal"></div>
          <p className="mt-4 text-gray-600">Loading champions...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero Header */}
      <div className="text-center mb-16">
        <div className="inline-block mb-6">
          <div className="text-7xl mb-4 animate-bounce">🏆</div>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 bg-clip-text text-transparent">
          Champions Archive
        </h1>
        <p className="text-xl md:text-2xl text-slate-600 font-medium">Celebrating our tournament winners</p>
      </div>

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-14 w-14 border-4 border-amber-600 border-t-transparent"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading champions...</p>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 rounded-2xl shadow-lg p-12 text-center border-2 border-dashed border-amber-200">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-lg text-slate-600 font-medium">No completed tournaments yet</p>
          <p className="text-sm text-slate-500 mt-2">Tournament winners will appear here once tournaments are completed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <div
              key={tournament.id}
              className="group bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-6 border-4 border-amber-300 hover:border-yellow-400 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-400/20 rounded-full -mr-20 -mt-20"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-5">
                  <div className="text-5xl group-hover:scale-110 transition-transform">🏆</div>
                  <span className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-bold rounded-full shadow-lg">
                    {tournament.year}
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 mb-4 group-hover:text-amber-700 transition">
                  {tournament.name}
                </h3>

                {tournament.winnerSquadId && (
                  <div className="mt-6 pt-6 border-t-2 border-amber-300 bg-white/60 rounded-xl p-4">
                    <div className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Champions</div>
                    <div className="text-2xl font-extrabold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
                      {tournament.winnerSquadName || 'Winner'}
                    </div>
                  </div>
                )}

                {tournament.format && (
                  <div className="mt-4 text-sm font-semibold text-slate-600 bg-white/50 rounded-lg p-2">
                    Format: {tournament.format}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

