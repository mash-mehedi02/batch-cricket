/**
 * Admin Dashboard Home Page
 * Main control center with widgets, charts, and quick actions
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { squadService } from '@/services/firestore/squads'
import { playerService } from '@/services/firestore/players'
import { matchService } from '@/services/firestore/matches'
import AdminDashboardSkeleton from '@/components/skeletons/AdminDashboardSkeleton'

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

        const liveMatches = matches.filter(m => m.status === 'live' || m.status === 'Live')
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        setStats({
          tournaments: tournaments.length,
          matches: matches.length,
          liveMatches: liveMatches.length,
          squads: squads.length,
          players: players.length,
          ballsToday: 0, // TODO: Calculate from balls collection
        })

        setRecentMatches(matches.slice(0, 5))
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/admin/tournaments/new"
            className="px-4 py-2 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 transition"
          >
            + New Tournament
          </Link>
          <Link
            to="/admin/matches/new"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            + New Match
          </Link>
        </div>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Tournaments"
          value={stats.tournaments}
          icon="🏆"
          color="from-purple-500 to-purple-600"
          link="/admin/tournaments"
        />
        <StatCard
          title="Matches"
          value={stats.matches}
          icon="⚽"
          color="from-blue-500 to-blue-600"
          link="/admin/matches"
        />
        <StatCard
          title="Live Now"
          value={stats.liveMatches}
          icon="🔴"
          color="from-red-500 to-red-600"
          link="/admin/live"
        />
        <StatCard
          title="Squads"
          value={stats.squads}
          icon="👥"
          color="from-green-500 to-green-600"
          link="/admin/squads"
        />
        <StatCard
          title="Players"
          value={stats.players}
          icon="🏏"
          color="from-orange-500 to-orange-600"
          link="/admin/players"
        />
        <StatCard
          title="Balls Today"
          value={stats.ballsToday}
          icon="⚾"
          color="from-teal-500 to-teal-600"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickActionCard
          title="Start New Match"
          description="Create and start a live match"
          icon="⚽"
          link="/admin/matches/new"
          color="bg-blue-600 hover:bg-blue-700"
        />
        <QuickActionCard
          title="Create Tournament"
          description="Set up a new tournament"
          icon="🏆"
          link="/admin/tournaments/new"
          color="bg-purple-600 hover:bg-purple-700"
        />
        <QuickActionCard
          title="Add New Squad"
          description="Create a team squad"
          icon="👥"
          link="/admin/squads/new"
          color="bg-green-600 hover:bg-green-700"
        />
        <QuickActionCard
          title="Add Player"
          description="Register a new player"
          icon="🏏"
          link="/admin/players/new"
          color="bg-orange-600 hover:bg-orange-700"
        />
      </div>

      {/* Charts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity Chart */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Scoring Activity</h3>
          <div className="h-64 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <p>Chart coming soon</p>
              <p className="text-sm">Integration with chart library</p>
            </div>
          </div>
        </div>

        {/* Recent Matches */}
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Matches</h3>
            <Link to="/admin/matches" className="text-sm text-teal-600 hover:underline">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentMatches.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No matches yet</p>
            ) : (
              recentMatches.map((match) => (
                <Link
                  key={match.id}
                  to={`/admin/matches/${match.id}`}
                  className="block p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {match.teamAName || match.teamA} vs {match.teamBName || match.teamB}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {match.status} • {new Date(match.date?.toDate?.() || match.date).toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        match.status === 'live' || match.status === 'Live'
                          ? 'bg-red-100 text-red-700'
                          : match.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {match.status}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Top Players */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Players</h3>
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-2">🏆</div>
          <p>Player stats coming soon</p>
          <p className="text-sm">Auto-calculated from match data</p>
        </div>
      </div>
    </div>
  )
}

// Stat Card Component
function StatCard({
  title,
  value,
  icon,
  color,
  link,
}: {
  title: string
  value: number
  icon: string
  color: string
  link?: string
}) {
  const content = (
    <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200 hover:shadow-lg transition">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-2xl`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-600">{title}</div>
    </div>
  )

  if (link) {
    return <Link to={link}>{content}</Link>
  }

  return content
}

// Quick Action Card Component
function QuickActionCard({
  title,
  description,
  icon,
  link,
  color,
}: {
  title: string
  description: string
  icon: string
  link: string
  color: string
}) {
  return (
    <Link
      to={link}
      className={`${color} rounded-xl shadow-md p-6 text-white hover:shadow-lg transition transform hover:scale-105`}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-white/80">{description}</p>
    </Link>
  )
}

