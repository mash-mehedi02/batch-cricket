import { useState, useEffect } from 'react'
import { matchService } from '@/services/firestore/matches'
import { playerService } from '@/services/firestore/players'
import { useAuthStore } from '@/store/authStore'
import { Match, Player } from '@/types'
import { BarChart3, TrendingUp, User, Activity, AlertCircle } from 'lucide-react'

export default function AdminAnalytics() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [recentMatches, setRecentMatches] = useState<Match[]>([])
  const [topBatsmen, setTopBatsmen] = useState<Player[]>([])
  const [topBowlers, setTopBowlers] = useState<Player[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return
      try {
        setLoading(true)
        const isSuperAdmin = user.role === 'super_admin'
        const [matches, players] = await Promise.all([
          matchService.getByAdmin(user.uid, isSuperAdmin),
          playerService.getByAdmin(user.uid, isSuperAdmin)
        ])

        // Process Matches for Chart (Last 5 finished matches)
        const finishedMatches = matches
          .filter(m => m.status === 'finished' || m.status === 'completed')
          .slice(0, 5)
          .reverse() // Oldest to newest for chart L-R flow
        setRecentMatches(finishedMatches)

        // Process Top Batsmen
        const batsmen = [...players]
          .sort((a, b) => (b.stats?.runs || 0) - (a.stats?.runs || 0))
          .slice(0, 5)
        setTopBatsmen(batsmen)

        // Process Top Bowlers
        const bowlers = [...players]
          .sort((a, b) => (b.stats?.wickets || 0) - (a.stats?.wickets || 0))
          .slice(0, 5)
        setTopBowlers(bowlers)

      } catch (error) {
        console.error("Failed to load analytics data:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // Find max score for scaling graph
  const maxMatchScore = Math.max(
    ...recentMatches.map(m => Math.max(m.score?.teamA?.runs || 0, m.score?.teamB?.runs || 0, 100))
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Analytics & Insights</h1>
        <p className="text-slate-500 mt-1">Platform performance overview</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Scoring Activity Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-600" />
              Scoring Activity
            </h3>
            <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded">Last 5 Matches</span>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-end">
            {recentMatches.length > 0 ? (
              <div className="flex items-end justify-between gap-4 h-64 w-full">
                {recentMatches.map((match) => {
                  // Safe access to runs
                  const runsA = match.score?.teamA?.runs || 0
                  const runsB = match.score?.teamB?.runs || 0
                  const heightA = Math.max((runsA / maxMatchScore) * 100, 5)
                  const heightB = Math.max((runsB / maxMatchScore) * 100, 5)

                  return (
                    <div key={match.id} className="flex flex-col items-center gap-2 w-full group">
                      <div className="relative w-full flex justify-center gap-1 h-full items-end">
                        {/* Team A Bar */}
                        <div
                          className="w-3 md:w-6 bg-teal-500 rounded-t-sm transition-all duration-500 group-hover:bg-teal-600 relative"
                          style={{ height: `${heightA}%` }}
                        >
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {match.teamAName}: {runsA}
                          </div>
                        </div>
                        {/* Team B Bar */}
                        <div
                          className="w-3 md:w-6 bg-blue-500 rounded-t-sm transition-all duration-500 group-hover:bg-blue-600 relative"
                          style={{ height: `${heightB}%` }}
                        >
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                            {match.teamBName}: {runsB}
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium truncate max-w-[60px] text-center">
                        {new Date((match.date as any)?.toDate ? (match.date as any).toDate() : match.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm italic">
                No finished matches data available
              </div>
            )}
            <div className="mt-4 flex justify-center gap-6 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-teal-500 rounded-sm"></div> Run A
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Run B
              </div>
            </div>
          </div>
        </div>

        {/* Top Performers */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              Top Performers
            </h3>
          </div>

          <div className="p-0 overflow-y-auto max-h-[400px]">
            {/* Batsmen Section */}
            <div className="p-4 bg-slate-50/50 border-b border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Batting Board (Runs)</h4>
              <div className="space-y-3">
                {topBatsmen.map((player, idx) => (
                  <div key={player.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100 shadow-sm hover:border-purple-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-slate-300' : idx === 2 ? 'bg-amber-600' : 'bg-slate-200 text-slate-500'
                        }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 leading-tight">{player.name}</p>
                        <p className="text-[10px] text-slate-500">{player.battingStyle || 'Batsman'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-purple-700">{player.stats?.runs || 0}</span>
                      <span className="text-[10px] text-slate-400 block">runs</span>
                    </div>
                  </div>
                ))}
                {topBatsmen.length === 0 && <p className="text-xs text-slate-400 italic">No batting stats yet</p>}
              </div>
            </div>

            {/* Bowlers Section */}
            <div className="p-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Bowling Board (Wickets)</h4>
              <div className="space-y-3">
                {topBowlers.map((player, idx) => (
                  <div key={player.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100 shadow-sm hover:border-teal-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-slate-300' : idx === 2 ? 'bg-amber-600' : 'bg-slate-200 text-slate-500'
                        }`}>
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 leading-tight">{player.name}</p>
                        <p className="text-[10px] text-slate-500">{player.bowlingStyle || 'Bowler'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-teal-700">{player.stats?.wickets || 0}</span>
                      <span className="text-[10px] text-slate-400 block">wickets</span>
                    </div>
                  </div>
                ))}
                {topBowlers.length === 0 && <p className="text-xs text-slate-400 italic">No bowling stats yet</p>}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

