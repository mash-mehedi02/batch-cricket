/**
 * Admin Dashboard - Professional Redesign
 * Focus: Clean Data, Quick Access, Enterprise Aesthetics
 * Optimized for Mobile-First with compact, professional layout
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
          tournamentService.getByAdmin(user.uid, isSuperAdmin).catch(err => {
            console.error('[Dashboard] Tournaments load failed:', err);
            return [];
          }),
          squadService.getByAdmin(user.uid, isSuperAdmin).catch(err => {
            console.error('[Dashboard] Squads load failed:', err);
            return [];
          }),
          playerService.getByAdmin(user.uid, isSuperAdmin).catch(err => {
            console.error('[Dashboard] Players load failed:', err);
            return [];
          }),
          matchService.getByAdmin(user.uid, isSuperAdmin).catch(err => {
            console.error('[Dashboard] Matches load failed:', err);
            return [];
          }),
          isSuperAdmin ? adminService.getAll().catch(err => {
            console.error('[Dashboard] Admins load failed:', err);
            return [];
          }) : Promise.resolve([]),
          playerRequestService.getPendingRequests().catch(err => {
            console.error('[Dashboard] PlayerRequests load failed:', err);
            return [];
          })
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
      } catch (error) {
        console.error('Fatal error loading dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [user])

  if (loading) {
    return <AdminDashboardSkeleton />
  }

  return (
    <div className="space-y-5 sm:space-y-8 max-w-[1600px] mx-auto">
      {/* 1. Header Section — compact on mobile */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase italic">Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5 font-medium truncate">Real-time insights and management control.</p>
        </div>

        {/* Primary Actions — compact pills on mobile */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/admin/matches/new"
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all shadow-sm active:scale-95"
          >
            <Play size={14} fill="currentColor" />
            <span className="hidden xs:inline">Start</span> Match
          </Link>
          <Link
            to="/admin/tournaments/new"
            className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Tournament</span>
            <span className="sm:hidden">New</span>
          </Link>
        </div>
      </div>

      {/* 2. Key Metrics Grid — 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Live"
          value={stats.liveMatches}
          icon={<Activity size={16} />}
          trend="Active Now"
          trendColor="text-emerald-600"
          bgIcon="bg-emerald-500/10"
          iconColor="text-emerald-600"
          link="/admin/live"
          pulse={stats.liveMatches > 0}
        />
        <StatCard
          title="Matches"
          value={stats.matches}
          icon={<Calendar size={16} />}
          trend="Total"
          iconColor="text-blue-600"
          bgIcon="bg-blue-500/10"
          link="/admin/matches"
        />
        <StatCard
          title="Players"
          value={stats.players}
          icon={<UserPlus size={16} />}
          trend="Registered"
          iconColor="text-purple-600"
          bgIcon="bg-purple-500/10"
          link="/admin/players"
        />
        <StatCard
          title="Tournaments"
          value={stats.tournaments}
          icon={<Trophy size={16} />}
          trend="Season 2026"
          iconColor="text-orange-600"
          bgIcon="bg-orange-500/10"
          link="/admin/tournaments"
        />
      </div>

      {/* 2b. Secondary metrics — horizontal scroll on mobile */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-3 sm:overflow-visible">
        <MiniStatCard
          title="Requests"
          value={stats.newRegistrations}
          icon={<Zap size={14} />}
          iconColor="text-pink-600"
          bgIcon="bg-pink-500/10"
          link="/admin/player-approvals"
          badge={stats.newRegistrations > 0}
        />
        <MiniStatCard
          title="Squads"
          value={stats.squads}
          icon={<Users size={14} />}
          iconColor="text-teal-600"
          bgIcon="bg-teal-500/10"
          link="/admin/squads"
        />
        {(user?.role === 'super_admin') && (
          <MiniStatCard
            title="Admins"
            value={stats.admins}
            icon={<Shield size={14} />}
            iconColor="text-indigo-600"
            bgIcon="bg-indigo-500/10"
            link="/admin/users"
          />
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">

        {/* 3. Recent Matches */}
        <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 sm:px-6 py-3 sm:py-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
            <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white uppercase tracking-tight italic">Recent Activity</h3>
            <Link to="/admin/matches" className="text-[10px] sm:text-sm font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 uppercase tracking-wider">
              All <ArrowRight size={12} />
            </Link>
          </div>

          <div className="flex-1">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
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
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {match.teamAName || match.teamA} <span className="text-slate-400 font-normal px-1 italic text-[10px]">vs</span> {match.teamBName || match.teamB}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{match.tournamentName || 'Friendly Match'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={match.status} />
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-medium">
                          {match.date ? new Date(match.date?.toDate?.() || match.date).toLocaleDateString() : 'TBA'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            to={`/admin/matches/${match.id}`}
                            className="text-slate-400 hover:text-blue-600 font-bold transition-colors uppercase text-[10px] tracking-widest"
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

            {/* Mobile Card View — tighter spacing */}
            <div className="lg:hidden divide-y divide-slate-100 dark:divide-white/5">
              {recentMatches.length === 0 ? (
                <div className="px-4 py-10 text-center text-slate-400 text-sm">No recent activity</div>
              ) : (
                recentMatches.map((match) => (
                  <Link
                    key={match.id}
                    to={`/admin/matches/${match.id}`}
                    className="flex items-center gap-3 px-4 py-3 active:bg-slate-50 dark:active:bg-slate-800 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[13px] text-slate-900 dark:text-white truncate">
                        {match.teamAName || match.teamA} <span className="text-slate-300 font-normal mx-0.5 text-[10px]">vs</span> {match.teamBName || match.teamB}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">
                          {match.tournamentName || 'Friendly'}
                        </span>
                        <span className="text-slate-200 dark:text-slate-700">·</span>
                        <span className="text-[10px] font-medium text-slate-400">
                          {match.date ? new Date(match.date?.toDate?.() || match.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBA'}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={match.status} />
                    <ArrowRight size={14} className="text-slate-300 shrink-0" />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 4. Quick Actions Panel */}
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm p-4 sm:p-6">
            <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white mb-3 sm:mb-4 uppercase tracking-tight italic">Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 sm:gap-3">
              <QuickLink
                to="/admin/squads/new"
                title="Create Squad"
                subtitle="Add new team"
                icon={<Users size={16} />}
              />
              <QuickLink
                to="/admin/players/new"
                title="Add Player"
                subtitle="Manual register"
                icon={<UserPlus size={16} />}
              />
              <QuickLink
                to="/admin/analytics"
                title="Analytics"
                subtitle="Match stats"
                icon={<BarChart3 size={16} />}
              />
              <QuickLink
                to="/admin/player-approvals"
                title="Approvals"
                subtitle="Review new"
                icon={<Zap size={16} />}
                badge={stats.newRegistrations > 0 ? stats.newRegistrations.toString() : null}
              />
            </div>
          </div>

          {/* Help Card — hidden on small mobile, visible on sm+ */}
          <div className="hidden sm:block bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
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

function StatCard({ title, value, icon, trend, link, iconColor, bgIcon, trendColor = 'text-slate-500', pulse = false }: any) {
  const content = (
    <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden h-full">
      <div className="flex items-center justify-between mb-2 sm:mb-3 relative z-10">
        <div className={`p-2 sm:p-2.5 rounded-lg sm:rounded-xl ${bgIcon} ${iconColor}`}>
          {icon}
        </div>
        {link && <ArrowRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-colors" />}
      </div>
      <div className="relative z-10">
        <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tighter leading-none">
          {pulse && <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-1.5 animate-pulse align-middle" />}
          {value}
        </h3>
        <p className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">{title}</p>
        {trend && <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-tight mt-0.5 ${trendColor}`}>{trend}</p>}
      </div>
    </div>
  )
  return link ? <Link to={link} className="block h-full">{content}</Link> : content
}

function MiniStatCard({ title, value, icon, link, iconColor, bgIcon, badge = false }: any) {
  const content = (
    <div className="bg-white dark:bg-slate-900 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm flex items-center gap-3 min-w-[140px] sm:min-w-0 group hover:shadow-md transition-all relative">
      <div className={`p-2 rounded-lg ${bgIcon} ${iconColor} shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-none tracking-tight">{value}</div>
        <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{title}</div>
      </div>
      {badge && (
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
      )}
      <ArrowRight size={12} className="text-slate-300 group-hover:text-blue-500 transition-colors ml-auto shrink-0" />
    </div>
  )
  return link ? <Link to={link} className="block shrink-0 sm:shrink">{content}</Link> : content
}

function QuickLink({ to, title, subtitle, icon, badge }: any) {
  return (
    <Link to={to} className="flex items-center gap-3 p-2.5 sm:p-3 rounded-lg sm:rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-white/5 sm:border-transparent sm:hover:border-slate-100 dark:sm:hover:border-white/5 transition-all group relative">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 flex items-center justify-center text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors truncate">{title}</h4>
          {badge && <span className="bg-rose-500 text-white text-[8px] sm:text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">{badge}</span>}
        </div>
        <p className="text-[9px] sm:text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate">{subtitle}</p>
      </div>
      <ArrowRight size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all shrink-0 hidden sm:block" />
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: any = {
    live: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    finished: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    completed: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    upcoming: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
  }
  const defaultStyle = 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-white/5'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status?.toLowerCase()] || defaultStyle}`}>
      {status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1 animate-pulse" />}
      {status || 'N/A'}
    </span>
  )
}
