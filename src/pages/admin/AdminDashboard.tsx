/**
 * Admin Dashboard - Professional Redesign
 * Focus: Clean Data, Quick Access, Enterprise Aesthetics
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { squadService } from '@/services/firestore/squads'
import { playerService } from '@/services/firestore/players'
import { matchService } from '@/services/firestore/matches'
import AdminDashboardSkeleton from '@/components/skeletons/AdminDashboardSkeleton'
import {
  Trophy, Calendar, Users, UserPlus, Activity,
  BarChart3, Plus, ArrowRight, Play, Zap
} from 'lucide-react'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    tournaments: 0,
    matches: 0,
    liveMatches: 0,
    squads: 0,
    players: 0,
    ballsToday: 0,
  })
  const [loading, setLoading] = useState(true)
  const [recentMatches, setRecentMatches] = useState<any[]>([])

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [tournaments, squads, players, matches] = await Promise.all([
          tournamentService.getAll(),
          squadService.getAll(),
          playerService.getAll(),
          matchService.getAll(),
        ])

        const liveMatches = matches.filter((m: any) => m.status === 'live')

        setStats({
          tournaments: tournaments.length,
          matches: matches.length,
          liveMatches: liveMatches.length,
          squads: squads.length,
          players: players.length,
          ballsToday: 0, // Placeholder
        })

        // Sort by date desc
        const sorted = matches.sort((a: any, b: any) => {
          const tA = a.updatedAt?.toMillis?.() || 0
          const tB = b.updatedAt?.toMillis?.() || 0
          return tB - tA
        })
        setRecentMatches(sorted.slice(0, 5))
        setLoading(false)
      } catch (error) {
        console.error('Error loading dashboard stats:', error)
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  if (loading) {
    return <AdminDashboardSkeleton />
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time insights and management control.</p>
        </div>

        {/* Primary Action */}
        <div className="flex items-center gap-3">
          <Link
            to="/admin/matches/new"
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm active:scale-95"
          >
            <Play size={16} fill="currentColor" />
            Start Match
          </Link>
          <Link
            to="/admin/tournaments/new"
            className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
          >
            <Plus size={16} />
            Tournament
          </Link>
        </div>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Live Matches"
          value={stats.liveMatches}
          icon={<Activity size={20} />}
          trend="Active Now"
          trendColor="text-emerald-600"
          bgIcon="text-emerald-500/10"
          iconColor="text-emerald-600"
          link="/admin/live"
        />
        <StatCard
          title="Total Matches"
          value={stats.matches}
          icon={<Calendar size={20} />}
          trend="+12 this week"
          iconColor="text-blue-600"
          bgIcon="text-blue-500/10"
          link="/admin/matches"
        />
        <StatCard
          title="Players Registered"
          value={stats.players}
          icon={<UserPlus size={20} />}
          trend="Growing database"
          iconColor="text-purple-600"
          bgIcon="text-purple-500/10"
          link="/admin/players"
        />
        <StatCard
          title="Tournaments"
          value={stats.tournaments}
          icon={<Trophy size={20} />}
          trend="Season 2026"
          iconColor="text-orange-600"
          bgIcon="text-orange-500/10"
          link="/admin/tournaments"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* 3. Recent Matches Table */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Recent Activity</h3>
            <Link to="/admin/matches" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-3">Match</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentMatches.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      No recent matches found. Start one!
                    </td>
                  </tr>
                ) : (
                  recentMatches.map((match) => (
                    <tr key={match.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {match.teamAName || match.teamA} <span className="text-slate-400 font-normal px-1">vs</span> {match.teamBName || match.teamB}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{match.tournamentName || 'Friendly Match'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={match.status} />
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {match.date ? new Date(match.date?.toDate?.() || match.date).toLocaleDateString() : 'TBA'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/admin/matches/${match.id}`}
                          className="text-slate-400 hover:text-blue-600 font-medium transition-colors"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Quick Actions Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Quick Management</h3>
            <div className="grid grid-cols-1 gap-3">
              <QuickLink
                to="/admin/squads/new"
                title="Create Squad"
                subtitle="Add a new team to the roster"
                icon={<Users size={18} />}
              />
              <QuickLink
                to="/admin/players/new"
                title="Register Player"
                subtitle="Create player profile manually"
                icon={<UserPlus size={18} />}
              />
              <QuickLink
                to="/admin/analytics"
                title="View Analytics"
                subtitle="Deep dive into match stats"
                icon={<BarChart3 size={18} />}
              />
              <QuickLink
                to="/admin/users"
                title="Pending Claims"
                subtitle="Review player identity claims"
                icon={<Zap size={18} />}
                badge="3"
              />
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
            {/* Decorative */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10"></div>

            <h3 className="font-bold text-lg mb-2 relative z-10">Need Help?</h3>
            <p className="text-slate-300 text-sm mb-4 relative z-10">Check the documentation for scoring rules and admin guides.</p>
            <button className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all relative z-10">
              Read Guide
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

// --- Components ---

function StatCard({ title, value, icon, trend, link, iconColor, bgIcon, trendColor = 'text-slate-500' }: any) {
  const content = (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden h-full">
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-2.5 rounded-lg ${bgIcon ? bgIcon.replace('text-', 'bg-') : 'bg-slate-50'} ${iconColor}`}>
          {icon}
        </div>
        {link && <div className="text-slate-300 group-hover:text-blue-500 transition-colors"><ArrowRight size={16} /></div>}
      </div>
      <div className="relative z-10">
        <h3 className="text-3xl font-bold text-slate-800 tracking-tight mb-1">{value}</h3>
        <p className="text-sm font-medium text-slate-500 mb-2">{title}</p>
        {trend && <p className={`text-xs font-semibold ${trendColor}`}>{trend}</p>}
      </div>
    </div>
  )
  return link ? <Link to={link} className="block h-full">{content}</Link> : content
}

function QuickLink({ to, title, subtitle, icon, badge }: any) {
  return (
    <Link to={to} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group">
      <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 group-hover:text-slate-700 group-hover:bg-white transition-colors">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{title}</h4>
          {badge && <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{badge}</span>}
        </div>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
      <ArrowRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    live: 'bg-rose-50 text-rose-600 border-rose-100',
    finished: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    completed: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    upcoming: 'bg-blue-50 text-blue-600 border-blue-100',
  }
  const defaultStyle = 'bg-slate-50 text-slate-600 border-slate-100'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${styles[status?.toLowerCase()] || defaultStyle}`}>
      {status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 animate-pulse" />}
      {status}
    </span>
  )
}
