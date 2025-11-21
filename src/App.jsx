import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { FirebaseProvider } from './contexts/FirebaseContext'
import ErrorBoundary from './components/ErrorBoundary'
import Navbar from './components/Navbar'
import ProtectedRoute from './layouts/ProtectedRoute'
import Home from './pages/Home'
import LiveMatch from './pages/LiveMatch'
import MatchDetails from './pages/MatchDetails'
import Schedule from './pages/Schedule'
import Squad from './pages/Squad'
import Champion from './pages/Champion'
import PlayerProfile from './pages/PlayerProfile'
import AdminPanel from './pages/AdminPanel'
import AdminDashboard from './pages/admin/AdminDashboard'
import TournamentManagement from './pages/admin/TournamentManagement'
import SquadManagement from './pages/admin/SquadManagement'
import PlayerManagement from './pages/admin/PlayerManagement'
import MatchManagement from './pages/admin/MatchManagement'

function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <Router>
          <div className="min-h-screen bg-gray-50">
            <Navbar />
            <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/squad" element={<Squad />} />
            <Route path="/champions" element={<Champion />} />
            <Route path="/player/:playerId" element={<PlayerProfile />} />
            <Route path="/live/:matchId" element={<LiveMatch />} />
            <Route path="/match/:matchId" element={<MatchDetails />} />

            {/* Admin Routes - Protected */}
            {/* AdminPanel handles its own login, so no ProtectedRoute wrapper */}
            <Route path="/admin" element={<AdminPanel />} />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/tournaments"
              element={
                <ProtectedRoute requiredRole="admin">
                  <TournamentManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/squads"
              element={
                <ProtectedRoute requiredRole="admin">
                  <SquadManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/players"
              element={
                <ProtectedRoute requiredRole="admin">
                  <PlayerManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/matches"
              element={
                <ProtectedRoute requiredRole="admin">
                  <MatchManagement />
                </ProtectedRoute>
              }
            />

            {/* Legacy Routes - Redirect to admin */}
            <Route
              path="/tournaments"
              element={
                <ProtectedRoute requiredRole="admin">
                  <TournamentManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/squads"
              element={
                <ProtectedRoute requiredRole="admin">
                  <SquadManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/players"
              element={
                <ProtectedRoute requiredRole="admin">
                  <PlayerManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/matches"
              element={
                <ProtectedRoute requiredRole="admin">
                  <MatchManagement />
                </ProtectedRoute>
              }
            />
            </Routes>
          </div>
        </Router>
      </FirebaseProvider>
    </ErrorBoundary>
  )
}

export default App
