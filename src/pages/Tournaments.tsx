/**
 * All Series (Tournaments) Page
 * Displays a professional list of all tournaments grouped by month/year.
 */

import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { Tournament } from '@/types'
import { ChevronRight, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { bn as bnLocale } from 'date-fns/locale'
import { useTranslation } from '@/hooks/useTranslation'

export default function Tournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const { t, language } = useTranslation()

  useEffect(() => {
    const loadTournaments = async () => {
      try {
        const data = await tournamentService.getAll()
        // Sort by start date descending (newest first)
        const sorted = data.sort((a, b) => {
          const dateA = new Date(a.startDate || 0)
          const dateB = new Date(b.startDate || 0)
          return dateB.getTime() - dateA.getTime()
        })
        setTournaments(sorted)
      } catch (error) {
        console.error('Error loading tournaments:', error)
      } finally {
        setLoading(false)
      }
    }
    loadTournaments()
  }, [])

  // Group tournaments by "Month Year" (e.g., "January 2026")
  const groupedTournaments = useMemo(() => {
    return tournaments.reduce((groups, tournament) => {
      const date = tournament.startDate ? new Date(tournament.startDate) : new Date()
      const key = date.toLocaleString('en-US', { month: 'long', year: 'numeric' })
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(tournament)
      return groups
    }, {} as Record<string, Tournament[]>)
  }, [tournaments])

  const sortedGroupKeys = useMemo(() => {
    return Object.keys(groupedTournaments).sort((a, b) => {
      const dateA = new Date(a)
      const dateB = new Date(b)
      return dateB.getTime() - dateA.getTime() // Descending
    })
  }, [groupedTournaments])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
        <div className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
            <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse" />
            <div className="w-32 h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
          {[1, 2].map(g => (
            <div key={g} className="space-y-4">
              <div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 md:pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-4">
            <Link to="/" className="p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </Link>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{t('nav_series')}</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {tournaments.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('no_series_found')}</h3>
            <p className="text-slate-500">{t('check_back_later')}</p>
          </div>
        ) : (
          sortedGroupKeys.map((groupKey: string) => {
            // Translate the Group Header (Month Year)
            // groupKey is "January 2026" (English)
            const groupDate = new Date(groupKey);
            const displayDate = !isNaN(groupDate.getTime())
              ? format(groupDate, 'MMMM yyyy', { locale: language === 'bn' ? bnLocale : undefined })
              : groupKey;

            return (
              <div key={groupKey} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4 px-1">
                  {displayDate}
                </h2>

                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {groupedTournaments[groupKey].map((tournament: Tournament) => (
                    <Link
                      key={tournament.id}
                      to={`/tournaments/${tournament.id}`}
                      className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      {/* Series Logo */}
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 p-2 flex-shrink-0 border border-slate-200 dark:border-slate-700">
                        {tournament.logoUrl ? (
                          <img src={tournament.logoUrl} alt={tournament.name} className="w-full h-full object-contain" />
                        ) : (
                          <Trophy className="w-full h-full text-slate-300 p-1" />
                        )}
                      </div>

                      {/* Series Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          {tournament.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mt-1">
                          <span className="truncate">
                            {tournament.startDate && format(new Date(tournament.startDate), 'd MMM', { locale: language === 'bn' ? bnLocale : undefined })}
                            {' - '}
                            {tournament.endDate && format(new Date(tournament.endDate), 'd MMM yyyy', { locale: language === 'bn' ? bnLocale : undefined })}
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-teal-500 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
