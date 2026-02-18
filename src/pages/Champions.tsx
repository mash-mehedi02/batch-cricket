import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { Tournament } from '@/types'
import { Trophy, Medal, Crown, Target, Zap, ChevronRight, Calendar } from 'lucide-react'

export default function Champions() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#05060f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-800 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">Loading wall of fame...</p>
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
          <h1 className="text-4xl md:text-6xl font-black mb-4 tracking-tight">
            CHAMPIONS <span className="text-amber-500 uppercase">ARCHIVE</span>
          </h1>
          <p className="text-slate-400 font-medium max-w-xl mx-auto uppercase tracking-[0.2em] text-[10px] md:text-sm">
            Honoring the legends and elite squads of BatchCrick platform
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 -mt-10 relative z-20">
        {tournaments.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-16 text-center border border-slate-100 dark:border-white/5 shadow-xl transition-all">
            <Trophy size={64} className="mx-auto text-slate-200 dark:text-slate-800 mb-6" />
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">The quest continues...</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto text-sm">Winners will be immortalized here once tournaments reach their finale.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {tournaments.map((tournament) => (
              <Link
                to={`/tournaments/${tournament.id}`}
                key={tournament.id}
                className="group block bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden relative"
              >
                {/* Visual Flair */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-2xl rounded-full -mr-16 -mt-16 group-hover:bg-amber-500/10 transition-colors" />

                <div className="p-8 relative">
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-full border border-amber-500/10">
                          {tournament.year}
                        </span>
                        <span className="px-3 py-1 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                          {tournament.format}
                        </span>
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-none group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors">
                        {tournament.name}
                      </h3>
                    </div>
                    <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-50 dark:border-white/5 p-1 shrink-0 overflow-hidden group-hover:scale-110 transition-transform">
                      <img src={tournament.logoUrl || '/placeholder-tournament.png'} alt="" className="w-full h-full object-contain" />
                    </div>
                  </div>

                  {/* Main Champion Card - High Profile */}
                  <div className="relative mb-6">
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-6 text-white shadow-xl shadow-amber-500/20 overflow-hidden relative">
                      {/* Decoration */}
                      <Crown size={80} className="absolute -bottom-4 -right-4 opacity-10 -rotate-12" />

                      <div className="relative">
                        <div className="flex items-center gap-2 mb-1">
                          <Crown size={14} className="fill-white/80" />
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Champions</span>
                        </div>
                        <div className="text-3xl font-black tracking-tight leading-none">
                          {tournament.winnerSquadName || 'TBD'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Awards Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Runner Up */}
                    <div className="col-span-2 bg-slate-50 dark:bg-white/[0.03] rounded-2xl p-4 border border-slate-100 dark:border-white/5 flex items-center gap-4">
                      <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 shadow-sm shrink-0">
                        <Medal size={20} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Runner Up</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{tournament.runnerUpSquadName || '---'}</p>
                      </div>
                    </div>

                    {/* Individual Awards */}
                    {[
                      { label: 'Player of Series', val: tournament.playerOfTheTournament, icon: <Zap size={18} />, color: 'text-blue-500' },
                      { label: 'Top Scorer', val: tournament.topRunScorer, icon: <Crown size={18} />, color: 'text-emerald-500' },
                      { label: 'Top Taker', val: tournament.topWicketTaker, icon: <Target size={18} />, color: 'text-rose-500' },
                    ].map((award, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-white/[0.03] rounded-2xl p-4 border border-slate-100 dark:border-white/5 flex items-center gap-4">
                        <div className={`w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center ${award.color} shadow-sm shrink-0`}>
                          {award.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{award.label}</p>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{award.val || '---'}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer Context */}
                  <div className="mt-8 pt-6 border-t border-slate-50 dark:border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
                      <Calendar size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-tight">Hall of Fame Member</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600 dark:text-amber-500 text-[10px] font-black uppercase tracking-widest group-hover:gap-2 transition-all">
                      View Details
                      <ChevronRight size={14} />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

