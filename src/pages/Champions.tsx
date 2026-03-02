import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { Tournament } from '@/types'
import { Trophy, Medal, Crown, Target, Zap, ChevronRight, Calendar } from 'lucide-react'

export default function Champions() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'schools' | 'seasons' | 'champion'>('schools')
  const [selectedSchool, setSelectedSchool] = useState<string | null>(null)
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)

  useEffect(() => {
    const loadTournaments = async () => {
      try {
        setLoading(true)
        const allTournaments = await tournamentService.getAll()
        // Filter completed tournaments (or ones with winners)
        const completedTournaments = allTournaments.filter(
          t => t.status === 'completed' || t.winnerSquadId
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

  // Group tournaments by school
  const schoolGroups = tournaments.reduce((acc, t) => {
    const schoolName = (t.school || 'Independent').trim()
    if (!acc[schoolName]) {
      acc[schoolName] = []
    }
    acc[schoolName].push(t)
    return acc
  }, {} as Record<string, Tournament[]>)

  // Sort schools alphabetically
  const sortedSchools = Object.keys(schoolGroups).sort((a, b) => a.localeCompare(b))

  const handleBack = () => {
    if (view === 'champion') {
      setView('seasons')
      setSelectedTournament(null)
    } else if (view === 'seasons') {
      setView('schools')
      setSelectedSchool(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#05060f] pb-24">
        {/* Hero Header Skeleton */}
        <div className="bg-[#050B18] text-white pt-20 pb-16 px-6 relative overflow-hidden">
          <div className="max-w-5xl mx-auto flex flex-col items-center">
            <div className="w-20 h-20 bg-white/5 rounded-3xl border border-white/10 mb-8 animate-pulse" />
            <div className="w-64 h-10 bg-white/5 rounded-lg mb-4 animate-pulse" />
            <div className="w-48 h-4 bg-white/5 rounded animate-pulse" />
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="max-w-5xl mx-auto px-6 -mt-10 relative z-20 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2].map(i => (
              <div key={i} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden h-[480px] animate-pulse">
                <div className="p-7 space-y-8">
                  <div className="flex justify-between items-start">
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <div className="w-12 h-5 rounded-md bg-slate-200 dark:bg-slate-800" />
                        <div className="w-16 h-5 rounded-md bg-slate-200 dark:bg-slate-800" />
                      </div>
                      <div className="w-40 h-7 rounded-lg bg-slate-200 dark:bg-slate-800" />
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800" />
                  </div>
                  <div className="h-24 rounded-2xl bg-slate-200/50 dark:bg-white/5" />
                  <div className="grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4].map(j => (
                      <div key={j} className="h-24 rounded-2xl bg-slate-100 dark:bg-white/5" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#05060f] pb-24">
      {/* Hero Header */}
      <div className="bg-[#050B18] text-white pt-20 pb-16 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 blur-[120px] rounded-full -mr-32 -mt-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/10 blur-[100px] rounded-full -ml-32 -mb-32 pointer-events-none" />

        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-500/10 rounded-3xl border border-amber-500/20 mb-8 backdrop-blur-sm shadow-2xl">
            <Trophy size={40} className="text-amber-500" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight uppercase">
            {view === 'schools' ? 'CHAMPIONS ARCHIVE' : view === 'seasons' ? selectedSchool : selectedTournament?.name}
          </h1>
          <p className="text-slate-400 font-medium max-w-xl mx-auto uppercase tracking-[0.2em] text-[10px] md:text-sm">
            {view === 'schools'
              ? 'Honoring the legends and elite squads of BatchCrick platform'
              : view === 'seasons'
                ? `Select a season to view Champions of ${selectedSchool}`
                : `${selectedTournament?.year} Champion Details`}
          </p>

          {view !== 'schools' && (
            <button
              onClick={handleBack}
              className="mt-8 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
            >
              ← Back {view === 'champion' ? 'to Seasons' : 'to Schools'}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 -mt-10 relative z-20">
        {tournaments.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-16 text-center border border-slate-100 dark:border-white/5 shadow-xl transition-all">
            <Trophy size={64} className="mx-auto text-slate-200 dark:text-slate-800 mb-6" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">The quest continues...</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto text-sm">Winners will be immortalized here once tournaments reach their finale.</p>
          </div>
        ) : view === 'schools' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedSchools.map((school) => (
              <button
                key={school}
                onClick={() => {
                  setSelectedSchool(school)
                  setView('seasons')
                }}
                className="group bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200/60 dark:border-white/5 shadow-sm hover:shadow-xl transition-all duration-500 text-left relative overflow-hidden"
              >
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-amber-500/5 blur-2xl rounded-full group-hover:bg-amber-500/10 transition-colors" />

                <div className="relative z-10 flex flex-col h-full">
                  <div className="w-14 h-14 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-amber-500/10 transition-all">
                    <Crown size={28} className="text-slate-400 dark:text-slate-500 group-hover:text-amber-500" />
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-amber-500 transition-colors">
                    {school}
                  </h3>

                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {schoolGroups[school].length} {schoolGroups[school].length === 1 ? 'Tournament' : 'Tournaments'}
                    </span>
                    <ChevronRight size={18} className="text-slate-300 dark:text-slate-700 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : view === 'seasons' ? (
          <div className="max-w-2xl mx-auto space-y-4">
            {schoolGroups[selectedSchool!]
              .sort((a, b) => Number(b.year || 0) - Number(a.year || 0))
              .map((tournament) => (
                <button
                  key={tournament.id}
                  onClick={() => {
                    setSelectedTournament(tournament)
                    setView('champion')
                  }}
                  className="w-full group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-white/5 shadow-sm hover:shadow-md transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-xl flex items-center justify-center group-hover:bg-amber-500/10 transition-all">
                      <Calendar size={20} className="text-slate-400 group-hover:text-amber-500" />
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-0.5">{tournament.year} Season</div>
                      <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 group-hover:text-amber-500 transition-colors">{tournament.name}</h4>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <Link
              to={`/tournaments/${selectedTournament?.id}`}
              className="group block bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200/60 dark:border-white/5 shadow-2xl hover:shadow-amber-500/10 transition-all duration-500 overflow-hidden relative"
            >
              {/* Subtle Glow */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/5 blur-[100px] rounded-full group-hover:bg-amber-500/10 transition-colors" />

              <div className="p-8 md:p-12 relative">
                {/* Card Header - Refined */}
                <div className="flex items-start justify-between mb-10">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-slate-200/50 dark:border-white/5">
                        {selectedTournament?.year}
                      </span>
                      <span className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest rounded-lg border border-slate-200/50 dark:border-white/5">
                        {selectedTournament?.format}
                      </span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight group-hover:text-amber-600 transition-colors">
                      {selectedTournament?.name}
                    </h3>
                  </div>
                  <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-white/10 p-2 shrink-0 overflow-hidden group-hover:scale-110 transition-transform">
                    <img src={selectedTournament?.logoUrl || '/placeholder-tournament.png'} alt="" className="w-full h-full object-contain" />
                  </div>
                </div>

                {/* High Profile Champion Section - Professional Look */}
                <div className="relative mb-10">
                  <div className="bg-[#1e293b] rounded-3xl p-10 text-white overflow-hidden relative border border-white/5 shadow-2xl">
                    {/* Subtler Decoration */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/20 blur-[60px] rounded-full -mr-24 -mt-24" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 blur-[40px] rounded-full -ml-16 -mb-16" />

                    <div className="relative z-10 flex flex-col items-center md:items-start">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-xl flex items-center justify-center">
                          <Crown size={18} className="text-amber-400" />
                        </div>
                        <span className="text-sm font-black text-amber-400 uppercase tracking-[0.3em]">Champions</span>
                      </div>
                      <div className="text-4xl md:text-5xl font-black tracking-tighter text-white drop-shadow-2xl text-center md:text-left">
                        {selectedTournament?.winnerSquadName || 'TBD'}
                      </div>
                    </div>

                    {/* Illustrative Icon */}
                    <Trophy size={120} className="absolute bottom-[-20px] right-[-20px] text-white/5 -rotate-12" />
                  </div>
                </div>

                {/* Awards Grid - Unified 2x2 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Runner Up - Now part of the grid */}
                  <div className="bg-slate-50 dark:bg-white/[0.02] rounded-3xl p-6 border border-slate-100 dark:border-white/5 flex flex-col gap-4 group/award">
                    <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-sm shrink-0 border border-slate-100 dark:border-white/5 group-hover/award:scale-110 transition-transform">
                      <Medal size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Runner Up</p>
                      <p className="text-xl font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{selectedTournament?.runnerUpSquadName || '---'}</p>
                    </div>
                  </div>

                  {[
                    { label: 'Player of Series', val: selectedTournament?.playerOfTheTournament, icon: <Zap size={24} />, color: 'text-blue-500' },
                    { label: 'Top Scorer', val: selectedTournament?.topRunScorer, icon: <Crown size={24} />, color: 'text-emerald-500' },
                    { label: 'Top Taker', val: selectedTournament?.topWicketTaker, icon: <Target size={24} />, color: 'text-rose-500' },
                  ].map((award, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-white/[0.02] rounded-3xl p-6 border border-slate-100 dark:border-white/5 flex flex-col gap-4 group/award">
                      <div className={`w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center ${award.color} shadow-sm shrink-0 border border-slate-100 dark:border-white/5 group-hover/award:scale-110 transition-transform`}>
                        {award.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{award.label}</p>
                        <p className="text-xl font-bold text-slate-800 dark:text-slate-200 truncate">{award.val || '---'}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Refined Footer */}
                <div className="mt-10 pt-8 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-slate-400">
                    <Calendar size={16} strokeWidth={2.5} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Platform Immortal</span>
                  </div>
                  <div className="flex items-center gap-2 text-amber-600 font-black text-[10px] uppercase tracking-[0.2em] group-hover:gap-3 transition-all">
                    Visit Tournament Page
                    <ChevronRight size={16} strokeWidth={3} />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
