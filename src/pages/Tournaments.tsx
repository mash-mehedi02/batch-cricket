/**
 * Tournaments Page
 * Display all tournaments from Firebase
 */

import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { tournamentService } from '@/services/firestore/tournaments'
import { Tournament } from '@/types'
import { SkeletonCard } from '@/components/skeletons/SkeletonCard'

export default function Tournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [years, setYears] = useState<number[]>([])

  useEffect(() => {
    const loadTournaments = async () => {
      try {
        setLoading(true)
        const allTournaments = await tournamentService.getAll()
        setTournaments(allTournaments)

        // Extract unique years
        const uniqueYears = [...new Set(allTournaments.map(t => t.year))].sort((a, b) => b - a)
        setYears(uniqueYears)
      } catch (error) {
        console.error('Error loading tournaments:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTournaments()
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)

  const filteredTournaments = selectedYear
    ? tournaments.filter(t => t.year === selectedYear)
    : tournaments

  // GSAP Animations
  useEffect(() => {
    if (!loading && filteredTournaments.length > 0) {
      const ctx = gsap.context(() => {
        // Card entrance
        gsap.fromTo(".tournament-card",
          { y: 30, opacity: 0, scale: 0.98 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.5,
            stagger: 0.08,
            ease: "power3.out",
            clearProps: "all"
          }
        )

        // Header animation
        gsap.fromTo(".tournaments-header",
          { x: -30, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.8, ease: "power2.out" }
        )
      }, containerRef)
      return () => ctx.revert()
    }
  }, [loading, selectedYear, filteredTournaments.length])

  return (
    <div ref={containerRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10 tournaments-header">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-1 w-12 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-full"></div>
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-slate-900 via-amber-600 to-yellow-600 bg-clip-text text-transparent">
            Tournaments
          </h1>
          <div className="h-1 flex-1 bg-gradient-to-r from-amber-500/30 to-transparent rounded-full"></div>
        </div>

        {/* Year Filter - Compressed Grid Layout */}
        {years.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedYear(null)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm ${selectedYear === null
                  ? 'bg-teal-600 text-white shadow-teal-500/20'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
              >
                All Years
              </button>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-5 gap-2 max-w-sm">
              {years.map(year => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all duration-200 shadow-sm border ${selectedYear === year
                    ? 'bg-teal-600 text-white border-teal-600 shadow-teal-500/20'
                    : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredTournaments.length === 0 ? (
        <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl shadow-lg p-12 text-center border-2 border-dashed border-slate-200">
          <div className="text-5xl mb-4">🏆</div>
          <p className="text-lg text-slate-600 font-medium">No tournaments found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((tournament) => {
            const statusColor =
              tournament.status === 'ongoing' ? 'from-green-500 to-emerald-600' :
                tournament.status === 'completed' ? 'from-slate-500 to-slate-600' :
                  'from-blue-500 to-blue-600'

            return (
              <div
                key={tournament.id}
                className="tournament-card group bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 p-6 border-2 border-slate-200 hover:border-amber-400 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full -mr-16 -mt-16"></div>
                <div className="relative">
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex-1">
                      <h3 className="text-xl font-extrabold text-slate-900 mb-2 group-hover:text-amber-700 transition">
                        {tournament.name}
                      </h3>
                      <p className="text-sm font-semibold text-amber-600">{tournament.year}</p>
                    </div>
                    <span className={`px-3 py-1.5 bg-gradient-to-r ${statusColor} text-white rounded-full text-xs font-bold shadow-lg whitespace-nowrap`}>
                      {tournament.status}
                    </span>
                  </div>

                  <div className="space-y-2 mb-5">
                    <p className="text-sm text-slate-600">
                      <span className="font-semibold text-slate-900">Format:</span> {tournament.format}
                    </p>
                    {tournament.school && (
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold text-slate-900">School:</span> {tournament.school}
                      </p>
                    )}
                    {tournament.startDate && (
                      <p className="text-sm text-slate-600">
                        <span className="font-semibold text-slate-900">Start:</span>{' '}
                        {new Date(tournament.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>

                  {tournament.description && (
                    <p className="text-sm text-slate-700 mb-5 line-clamp-2 bg-slate-50 rounded-lg p-3">
                      {tournament.description}
                    </p>
                  )}

                  <Link
                    to={`/tournaments/${tournament.id}`}
                    className="block w-full text-center px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl hover:from-teal-700 hover:to-emerald-700 transition-all font-semibold shadow-lg shadow-teal-500/30 hover:shadow-xl"
                  >
                    View Details →
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


