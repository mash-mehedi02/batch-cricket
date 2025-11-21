import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { adminLogout } from '../../services/adminsService'
import { useFirebase } from '../../contexts/FirebaseContext'
import { playersService } from '../../services/firestore/playersService'
import { matchesService } from '../../services/firestore/matchesService'
import { tournamentsService } from '../../services/firestore/tournamentsService'
import { MATCH_STATUS } from '../../types'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import CardSkeleton from '../../components/skeletons/CardSkeleton'

const AdminDashboard = () => {
  const { currentAdmin } = useFirebase()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalPlayers: 0,
    totalMatches: 0,
    liveMatches: 0,
    completedMatches: 0,
    upcomingMatches: 0,
    totalTournaments: 0,
  })

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true)
        
        // Load all data in parallel
        const [players, matches, tournaments] = await Promise.all([
          playersService.getAll().catch(() => []),
          matchesService.getAll().catch(() => []),
          tournamentsService.getAll().catch(() => []),
        ])

        // Calculate stats
        const liveMatches = matches.filter((m) => m.status === MATCH_STATUS.LIVE).length
        const completedMatches = matches.filter((m) => m.status === MATCH_STATUS.FINISHED).length
        const upcomingMatches = matches.filter((m) => m.status === MATCH_STATUS.UPCOMING).length

        setStats({
          totalPlayers: players.length,
          totalMatches: matches.length,
          liveMatches,
          completedMatches,
          upcomingMatches,
          totalTournaments: tournaments.length,
        })
      } catch (error) {
        console.error('Error loading dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  const handleLogout = async () => {
    try {
      await adminLogout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  if (!currentAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please login to access this page</p>
          <Link
            to="/admin"
            className="mt-4 inline-block bg-cricbuzz-green text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  const adminFeatures = [
    {
      title: 'Tournament Management',
      description: 'Create and manage cricket tournaments',
      icon: '🏆',
      link: '/admin/tournaments',
      color: 'from-yellow-400 to-yellow-600',
    },
    {
      title: 'Squad Management',
      description: 'Manage team squads by batch',
      icon: '👥',
      link: '/admin/squads',
      color: 'from-blue-400 to-blue-600',
    },
    {
      title: 'Player Management',
      description: 'Manage player profiles and statistics',
      icon: '👤',
      link: '/admin/players',
      color: 'from-green-400 to-green-600',
    },
    {
      title: 'Match Management',
      description: 'Create and manage match schedules',
      icon: '📅',
      link: '/admin/matches',
      color: 'from-purple-400 to-purple-600',
    },
    {
      title: 'Live Scoring',
      description: 'Update live match scores and commentary',
      icon: '🏏',
      link: '/admin',
      color: 'from-red-400 to-red-600',
    },
  ]

  const statCards = [
    {
      title: 'Total Players',
      value: stats.totalPlayers,
      icon: '👤',
      color: 'blue',
      link: '/admin/players',
    },
    {
      title: 'Total Matches',
      value: stats.totalMatches,
      icon: '🏏',
      color: 'green',
      link: '/admin/matches',
    },
    {
      title: 'Live Matches',
      value: stats.liveMatches,
      icon: '🔴',
      color: 'red',
      link: '/schedule?filter=live',
    },
    {
      title: 'Completed',
      value: stats.completedMatches,
      icon: '✅',
      color: 'gray',
      link: '/schedule?filter=completed',
    },
    {
      title: 'Upcoming',
      value: stats.upcomingMatches,
      icon: '📅',
      color: 'purple',
      link: '/schedule?filter=upcoming',
    },
    {
      title: 'Tournaments',
      value: stats.totalTournaments,
      icon: '🏆',
      color: 'yellow',
      link: '/admin/tournaments',
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">Welcome back, {currentAdmin.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="self-start sm:self-auto bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors text-sm font-semibold"
          >
            Logout
          </button>
        </div>

        {/* Stats Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Summary Statistics</h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {statCards.map((stat) => (
                <Link key={stat.title} to={stat.link}>
                  <Card hover className="text-center">
                    <div className="text-4xl mb-2">{stat.icon}</div>
                    <div className="text-3xl font-bold text-gray-800 mb-1">{stat.value}</div>
                    <div className="text-gray-600 text-sm">{stat.title}</div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            {adminFeatures.map((feature) => (
              <Link
                key={feature.link}
                to={feature.link}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${feature.color} flex items-center justify-center text-3xl mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard
