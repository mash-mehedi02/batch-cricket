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
import { adminService } from '@/services/firestore/admins'
import { playerRequestService } from '@/services/firestore/playerRequests'
import { useAuthStore } from '@/store/authStore'
import AdminDashboardSkeleton from '@/components/skeletons/AdminDashboardSkeleton'
import {
  Trophy, Calendar, Users, UserPlus, Activity,
  BarChart3, Plus, ArrowRight, Play, Zap, Shield
} from 'lucide-react'

export default function AdminDashboard() {
  const { user } = useAuthStore()
  const [stats, setStats] = useState({
    tournaments: 0,
    matches: 0,
    liveMatches: 0,
    squads: 0,
    players: 0,
    admins: 0,
    newRegistrations: 0,
    ballsToday: 0,
  })
  const [loading, setLoading] = useState(true)
  const [recentMatches, setRecentMatches] = useState<any[]>([])

  useEffect(() => {
    const loadStats = async () => {
      if (!user) return
      const isSuperAdmin = user.role === 'super_admin'
      try {
        const [tournaments, squads, players, matches, admins, requests] = await Promise.all([
          tournamentService.getByAdmin(user.uid, isSuperAdmin),
          squadService.getByAdmin(user.uid, isSuperAdmin),
          playerService.getByAdmin(user.uid, isSuperAdmin),
          matchService.getByAdmin(user.uid, isSuperAdmin),
          isSuperAdmin ? adminService.getAll() : Promise.resolve([]),
          playerRequestService.getPendingRequests()
        ])

        const liveMatches = matches.filter((m: any) => m.status?.toLowerCase() === 'live')

        setStats({
          tournaments: tournaments.length,
          matches: matches.length,
          liveMatches: liveMatches.length,
          squads: squads.length,
          players: players.length,
          admins: admins.length,
          newRegistrations: requests.length,
          ballsToday: 0
        })

        // Sort by update time or creation time desc
        const sorted = [...matches].sort((a: any, b: any) => {
          const tA = (a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0) as number
          const tB = (b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0) as number
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
  }, [user])

  if (loading) {
    return <AdminDashboardSkeleton />
  }

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase italic">Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Real-time insights and management control.</p>
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
            className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
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
          trend="Managed entries"
          iconColor="text-blue-600"
          bgIcon="text-blue-500/10"
          link="/admin/matches"
        />
        <StatCard
          title="Players Registered"
          value={stats.players}
          icon={<UserPlus size={20} />}
          trend="Team roster"
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
        <StatCard
          title="Player Requests"
          value={stats.newRegistrations}
          icon={<UserPlus size={20} />}
          trend="Pending Approval"
          iconColor="text-pink-600"
          bgIcon="text-pink-500/10"
          link="/admin/player-approvals"
        />
        {(user?.role === 'super_admin') && (
          <StatCard
            title="Administration"
            value={stats.admins}
            icon={<Shield size={20} />}
            trend="System access"
            iconColor="text-indigo-600"
            bgIcon="text-indigo-500/10"
            link="/admin/users"
          />
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* 3. Recent Matches Table */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-white uppercase tracking-tight italic">Recent Activity</h3>
            <Link to="/admin/matches" className="text-sm font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 uppercase tracking-wider">
              View All <ArrowRight size={14} />
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest text-[10px]">
                <tr>
                  <th className="px-6 py-4">Match</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
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
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 dark:text-white mb-4 uppercase tracking-tight italic">Quick Management</h3>
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
                to="/admin/player-approvals"
                title="Player Approvals"
                subtitle="Review new registrations"
                icon={<Zap size={18} />}
                badge={stats.newRegistrations > 0 ? stats.newRegistrations.toString() : null}
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
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all group relative overflow-hidden h-full">
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-3 rounded-xl ${bgIcon ? bgIcon.replace('text-', 'bg-').replace('/10', '/20') : 'bg-slate-50 dark:bg-slate-800'} ${iconColor} dark:${iconColor}`}>
          {icon}
        </div>
        {link && <div className="text-slate-300 group-hover:text-blue-500 transition-colors"><ArrowRight size={16} /></div>}
      </div>
      <div className="relative z-10">
        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-1">{value}</h3>
        <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">{title}</p>
        {trend && <p className={`text-[10px] font-black uppercase tracking-tight ${trendColor}`}>{trend}</p>}
      </div>
    </div>
  )
  return link ? <Link to={link} className="block h-full">{content}</Link> : content
}

function QuickLink({ to, title, subtitle, icon, badge }: any) {
  return (
    <Link to={to} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 dark:hover:border-white/5 transition-all group">
      <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-black text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors uppercase tracking-tight">{title}</h4>
          {badge && <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{badge}</span>}
        </div>
        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-tight">{subtitle}</p>
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
