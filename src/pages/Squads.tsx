/**
 * Squads Page
 * Display all squads from Firebase
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { squadService } from '@/services/firestore/squads'
import { tournamentService } from '@/services/firestore/tournaments'
import { Squad, Tournament } from '@/types'
import { SkeletonCard } from '@/components/skeletons/SkeletonCard'

export default function Squads() {
  const [squads, setSquads] = useState<Squad[]>([])
  const [tournaments, setTournaments] = useState<Map<string, Tournament>>(new Map())
  const [loading, setLoading] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [batches, setBatches] = useState<string[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        // Load squads
        const allSquads = await squadService.getAll()
        setSquads(allSquads)
        
        // Extract unique batches (fallback to year for legacy squads)
        const uniqueBatches = [...new Set(allSquads.map((s: any) => String(s.batch || s.year || '')))]
          .filter(Boolean)
          .sort((a, b) => {
            const na = parseInt(a, 10)
            const nb = parseInt(b, 10)
            if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na
            return b.localeCompare(a)
          })
        setBatches(uniqueBatches)
        
        // Load tournaments for mapping
        const allTournaments = await tournamentService.getAll()
        const tournamentMap = new Map<string, Tournament>()
        allTournaments.forEach(t => tournamentMap.set(t.id, t))
        setTournaments(tournamentMap)
      } catch (error) {
        console.error('Error loading squads:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const filteredSquads = selectedBatch
    ? squads.filter((s: any) => String(s.batch || s.year || '') === selectedBatch)
    : squads

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"></div>
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-slate-900 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Squads
          </h1>
          <div className="h-1 flex-1 bg-gradient-to-r from-blue-500/30 to-transparent rounded-full"></div>
        </div>
        
        {/* Batch Filter */}
        {batches.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSelectedBatch(null)}
              className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 shadow-lg ${
                selectedBatch === null
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-teal-500/50 scale-105'
                  : 'bg-white text-slate-700 hover:bg-slate-50 shadow-md hover:shadow-lg border-2 border-slate-200'
              }`}
            >
              All Batches
            </button>
            {batches.map((batch) => (
              <button
                key={batch}
                onClick={() => setSelectedBatch(batch)}
                className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 shadow-lg ${
                  selectedBatch === batch
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-teal-500/50 scale-105'
                    : 'bg-white text-slate-700 hover:bg-slate-50 shadow-md hover:shadow-lg border-2 border-slate-200'
                }`}
              >
                {batch}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredSquads.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl shadow-lg p-12 text-center border-2 border-dashed border-slate-200">
          <div className="text-5xl mb-4">👥</div>
          <p className="text-lg text-slate-600 font-medium">No squads found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSquads.map((squad) => {
            const tournament = tournaments.get(squad.tournamentId)
            return (
              <div
                key={squad.id}
                className="group bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border-2 border-slate-200 hover:border-blue-400 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="mb-5">
                    <h3 className="text-xl font-extrabold text-slate-900 mb-2 group-hover:text-blue-600 transition">
                      {squad.name}
                    </h3>
                    <p className="text-sm font-semibold text-blue-600 mb-2">{(squad as any).batch || squad.year}</p>
                    {tournament && (
                      <div className="bg-blue-50 rounded-lg p-2 border border-blue-100">
                        <p className="text-sm text-slate-700">
                          <span className="font-bold text-blue-700">Tournament:</span> {tournament.name}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2 mb-5">
                    <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                      <span className="text-sm font-semibold text-slate-700">Players</span>
                      <span className="text-lg font-extrabold text-slate-900">{squad.playerIds?.length || 0}</span>
                    </div>
                    {squad.captainId && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold">C</span>
                        <span className="text-slate-600 font-medium">Captain Set</span>
                      </div>
                    )}
                    {squad.wicketKeeperId && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">WK</span>
                        <span className="text-slate-600 font-medium">Wicket Keeper Set</span>
                      </div>
                    )}
                  </div>

                  <Link
                    to={`/squads/${squad.id}`}
                    className="block w-full text-center px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
                  >
                    View Squad →
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


