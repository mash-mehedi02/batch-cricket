/**
 * Squads Page
 * Display all squads from Firebase
 */

import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { squadService } from '@/services/firestore/squads'
import { Squad } from '@/types'
import { SkeletonCard } from '@/components/skeletons/SkeletonCard'
import { useTranslation } from '@/hooks/useTranslation'

export default function Squads() {
  const [squads, setSquads] = useState<Squad[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null)
  const [batches, setBatches] = useState<string[]>([])
  const { t } = useTranslation()

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


      } catch (error) {
        console.error('Error loading squads:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)

  const filteredSquads = selectedBatch
    ? squads.filter((s: any) => String(s.batch || s.year || '') === selectedBatch)
    : squads

  // GSAP Animations
  useEffect(() => {
    if (!loading && filteredSquads.length > 0) {
      const ctx = gsap.context(() => {
        // Stagger cards entrance
        gsap.fromTo(".squad-card",
          {
            y: 40,
            opacity: 0,
            scale: 0.95
          },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.6,
            stagger: 0.08,
            ease: "power3.out",
            clearProps: "all"
          }
        )

        // Header animation
        gsap.fromTo(".squads-header",
          { y: -20, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, ease: "power4.out" }
        )
      }, containerRef)

      return () => ctx.revert()
    }
  }, [loading, selectedBatch, filteredSquads.length])

  return (
    <div ref={containerRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10 squads-header">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"></div>
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-slate-900 via-blue-600 to-indigo-600 dark:from-white dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent italic tracking-tighter uppercase leading-[0.8]">
            {t('nav_squads')}
          </h1>
          <div className="h-1 flex-1 bg-gradient-to-r from-blue-500/30 to-transparent rounded-full"></div>
        </div>

        {/* Batch Filter - Compressed Layout */}
        {batches.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedBatch(null)}
                className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all duration-200 shadow-sm ${selectedBatch === null
                  ? 'bg-teal-600 text-white shadow-teal-500/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/5'
                  }`}
              >
                {t('all_batches')}
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {batches.map((batch) => (
                <button
                  key={batch}
                  onClick={() => setSelectedBatch(batch)}
                  className={`px-2 py-1.5 rounded-lg text-[10px] md:text-xs font-black transition-all duration-200 shadow-sm border ${selectedBatch === batch
                    ? 'bg-teal-600 text-white border-teal-600 shadow-teal-500/20'
                    : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-white/5 hover:border-slate-300'
                    }`}
                >
                  {batch}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-3 md:gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredSquads.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-sm p-16 text-center border border-slate-100 dark:border-white/5">
          <div className="text-6xl mb-6">👥</div>
          <p className="text-xl text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight italic">{t('no_squads_found')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-3 md:gap-6">
          {filteredSquads.map((squad) => {
            const logo = (squad as any).logoUrl
            const name = squad.name || 'Unnamed'

            return (
              <div
                key={squad.id}
                className="squad-card group bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm hover:shadow-2xl transition-all duration-500 border border-slate-100 dark:border-white/5 hover:border-teal-500/30 overflow-hidden flex flex-col"
              >
                {/* Header Decoration */}
                <div className="h-2 w-full bg-linear-to-r from-teal-500 to-emerald-500" />

                <div className="p-4 md:p-8 flex-1">
                  <div className="flex flex-col gap-4 mb-6">
                    <div className="flex items-center gap-5">
                      {/* Squad Logo Container */}
                      <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-110 transition-transform duration-700 shadow-sm">
                        {logo ? (
                          <img src={logo} className="w-full h-full object-contain p-2" alt={name} />
                        ) : (
                          <span className="text-3xl md:text-5xl font-black text-slate-300 dark:text-slate-600 uppercase select-none italic">
                            {name[0]}
                          </span>
                        )}
                      </div>

                      <div className="px-3 py-1.5 bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest border border-teal-100 dark:border-teal-500/20">
                        {(squad as any).batch || squad.year}
                      </div>
                    </div>

                    <div className="min-w-0 pr-1">
                      <h3 className="text-lg md:text-3xl font-black text-slate-900 dark:text-white leading-[0.85] tracking-tighter uppercase italic break-words">
                        {name}
                      </h3>
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-white/5 w-fit">
                      <span className="text-lg md:text-2xl font-black text-slate-900 dark:text-white leading-none">{squad.playerIds?.length || 0}</span>
                      <span className="text-[10px] md:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('nav_players')}</span>
                    </div>
                  </div>

                  <Link
                    to={`/squads/${squad.id}`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 hover:bg-teal-600 text-white rounded-xl transition-all duration-300 font-bold text-[11px] md:text-xs uppercase tracking-wider shadow-lg shadow-slate-900/10 hover:shadow-teal-500/20 active:scale-[0.98]"
                  >
                    {t('view_squad')}
                    <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
} // Added missing brace


