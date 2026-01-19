import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
// Rebuild trigger 1
import Layout from './components/Layout'
import AdminLayout from './components/admin/AdminLayout'
import Home from './pages/Home'
import Login from './pages/Login'
import Tournaments from './pages/Tournaments'
import TournamentDetails from './pages/TournamentDetails'
import TournamentPointsTable from './pages/TournamentPointsTable'
import TournamentKeyStats from './pages/TournamentKeyStats'
import Squads from './pages/Squads'
import SquadDetails from './pages/SquadDetails'
import Players from './pages/Players'
import PlayerProfile from './pages/PlayerProfile'
import Champions from './pages/Champions'
import MatchLive from './pages/MatchLive'
import MatchInfo from './pages/MatchInfo'
import MatchScorecard from './pages/MatchScorecard'
import MatchGraphs from './pages/MatchGraphs'
import MatchPlayingXI from './pages/MatchPlayingXI'
import Schedule from './pages/Schedule'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminTournaments from './pages/admin/AdminTournaments'
import AdminSquads from './pages/admin/AdminSquads'
import AdminPlayers from './pages/admin/AdminPlayers'
import AdminMatches from './pages/admin/AdminMatches'
import AdminLiveMatches from './pages/admin/AdminLiveMatches'
import AdminLiveScoring from './pages/admin/AdminLiveScoring'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import AdminSettings from './pages/admin/AdminSettings'

function LayoutWrapper() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

function AdminLayoutWrapper() {
  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}

function TournamentTabRedirect({ tab }: { tab: 'points' | 'stats' }) {
  const tournamentId = window.location.pathname.split('/')[2]
  return <Navigate to={`/tournaments/${tournamentId}?tab=${tab}`} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login Route - No Layout */}
        <Route path="/login" element={<Login />} />

        {/* Public Routes - Wrapped in Layout */}
        <Route element={<LayoutWrapper />}>
          <Route path="/" element={<Home />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/tournaments/:tournamentId" element={<TournamentDetails />} />
          <Route path="/tournaments/:tournamentId/points" element={<TournamentTabRedirect tab="points" />} />
          <Route path="/tournaments/:tournamentId/stats" element={<TournamentTabRedirect tab="stats" />} />
          <Route path="/squads" element={<Squads />} />
          <Route path="/squads/:squadId" element={<SquadDetails />} />
          <Route path="/players" element={<Players />} />
          <Route path="/players/:playerId" element={<PlayerProfile />} />
          <Route path="/champions" element={<Champions />} />
          <Route path="/schedule" element={<Schedule />} />

          {/* Match Routes */}
          <Route path="/match/:matchId" element={<MatchLive />} />
          <Route path="/match/:matchId/info" element={<MatchInfo />} />
          <Route path="/match/:matchId/scorecard" element={<MatchScorecard />} />
          <Route path="/match/:matchId/graphs" element={<MatchGraphs />} />
          <Route path="/match/:matchId/playing-xi" element={<MatchPlayingXI />} />
        </Route>

        {/* Admin Routes - Wrapped in AdminLayout */}
        <Route element={<AdminLayoutWrapper />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/tournaments" element={<AdminTournaments />} />
          <Route path="/admin/tournaments/:id/dashboard" element={<AdminTournaments mode="dashboard" />} />
          <Route path="/admin/tournaments/:id/groups" element={<AdminTournaments mode="groups" />} />
          <Route path="/admin/tournaments/:id/fixtures" element={<AdminTournaments mode="fixtures" />} />
          <Route path="/admin/tournaments/:id/knockout" element={<AdminTournaments mode="knockout" />} />
          <Route path="/admin/tournaments/:id/standings" element={<AdminTournaments mode="standings" />} />
          <Route path="/admin/tournaments/:id/settings" element={<AdminTournaments mode="settings" />} />
          <Route path="/admin/tournaments/:id/edit" element={<AdminTournaments mode="edit" />} />
          <Route path="/admin/tournaments/new" element={<AdminTournaments mode="create" />} />
          <Route path="/admin/squads" element={<AdminSquads />} />
          <Route path="/admin/squads/new" element={<AdminSquads mode="create" />} />
          <Route path="/admin/squads/:id/edit" element={<AdminSquads mode="edit" />} />
          <Route path="/admin/players" element={<AdminPlayers />} />
          <Route path="/admin/players/new" element={<AdminPlayers mode="create" />} />
          <Route path="/admin/players/:id/edit" element={<AdminPlayers mode="edit" />} />
          <Route path="/admin/matches" element={<AdminMatches />} />
          <Route path="/admin/matches/new" element={<AdminMatches mode="create" />} />
          <Route path="/admin/matches/:id/edit" element={<AdminMatches mode="edit" />} />
          <Route path="/admin/matches/:id" element={<AdminMatches mode="view" />} />
          <Route path="/admin/live" element={<AdminLiveMatches />} />
          <Route path="/admin/live/:matchId" element={<AdminLiveScoring />} />
          <Route path="/admin/live/:matchId/scoring" element={<AdminLiveScoring />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>

        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
