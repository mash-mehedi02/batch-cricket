import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react';
import { SplashScreen as NativeSplash } from '@capacitor/splash-screen';
import Layout from './components/Layout'
import AdminLayout from './components/admin/AdminLayout'
import Home from './pages/Home'
import Login from './pages/Login'
import Tournaments from './pages/Tournaments'
import TermsPage from './pages/Terms';
import TournamentDetails from './pages/TournamentDetails'
import Squads from './pages/Squads'
import SquadDetails from './pages/SquadDetails'
import Players from './pages/Players'
import PlayerProfile from './pages/PlayerProfile'
import Champions from './pages/Champions'
import Rankings from './pages/Rankings'
import Menu from './pages/Menu'
import Account from './pages/Account'
import EditProfile from './pages/EditProfile'
import MatchLive from './pages/MatchLive'
import MatchInfo from './pages/MatchInfo'
import MatchScorecard from './pages/MatchScorecard'
import MatchGraphs from './pages/MatchGraphs'
import MatchPlayingXI from './pages/MatchPlayingXI'
import Schedule from './pages/Schedule'
import AdminDashboard from './pages/admin/AdminDashboard'
import Search from './pages/Search'
import AdminTournaments from './pages/admin/AdminTournaments'
import TournamentControlSystem from './pages/admin/TournamentControlSystem'
import AdminSquads from './pages/admin/AdminSquads'
import AdminPlayers from './pages/admin/AdminPlayers'
import AdminMatches from './pages/admin/AdminMatches'
import AdminLiveMatches from './pages/admin/AdminLiveMatches'
import AdminLiveScoring from './pages/admin/AdminLiveScoring'
import AdminAnalytics from './pages/admin/AdminAnalytics'
import AdminUsers from './pages/admin/AdminUsers'
import AdminEmailBroadcast from './pages/admin/AdminEmailBroadcast'
import AdminSettings from './pages/admin/AdminSettings'
import RegisterPlayer from './pages/RegisterPlayer'
import AdminPlayerRequests from './pages/admin/AdminPlayerRequests'
import AppSplashScreen from './components/common/SplashScreen'
import ScrollToTop from './components/common/ScrollToTop'
import NativeAppWrapper from './components/common/NativeAppWrapper'
import AuthLoadingOverlay from './components/common/AuthLoadingOverlay'
import PageTransition from './components/common/PageTransition'
import { useAuthStore } from './store/authStore'
import { AnimatePresence } from 'framer-motion'


function LayoutWrapper() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

function TournamentTabRedirect({ tab }: { tab: 'points' | 'stats' }) {
  const tournamentId = window.location.pathname.split('/')[2]
  return <Navigate to={`/tournaments/${tournamentId}?tab=${tab}`} replace />
}



function App() {
  const [showSplash, setShowSplash] = useState(true);
  const isAuthProcessing = useAuthStore(s => s.isProcessing);

  useEffect(() => {
    // Hide the native splash immediately so our custom React splash can show
    NativeSplash.hide().catch(() => { });

    // OneSignal is already initialized in main.tsx — no need to init again here
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <AppSplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NativeAppWrapper />
      <ScrollToTop />
      <AuthLoadingOverlay isVisible={isAuthProcessing} />
      <AnimatePresence mode="wait">
        <Routes>
          {/* Login Route - Redirect to Home with popup trigger */}
          <Route path="/login" element={<Navigate to="/menu?login=true" replace />} />
          <Route path="/admin/auth" element={<Login />} />
          <Route path="/search" element={<Search />} />

          {/* Public Routes - Wrapped in Layout */}
          <Route element={<LayoutWrapper />}>
            <Route path="/" element={<PageTransition><Home /></PageTransition>} />
            <Route path="/tournaments" element={<PageTransition><Tournaments /></PageTransition>} />
            <Route path="/tournaments/:tournamentId" element={<PageTransition><TournamentDetails /></PageTransition>} />
            <Route path="/tournaments/:tournamentId/points" element={<TournamentTabRedirect tab="points" />} />
            <Route path="/tournaments/:tournamentId/stats" element={<TournamentTabRedirect tab="stats" />} />
            <Route path="/terms" element={<PageTransition><TermsPage /></PageTransition>} />
            <Route path="/squads" element={<PageTransition><Squads /></PageTransition>} />
            <Route path="/squads/:squadId" element={<PageTransition><SquadDetails /></PageTransition>} />
            <Route path="/players" element={<PageTransition><Players /></PageTransition>} />
            <Route path="/players/:playerId" element={<PageTransition><PlayerProfile /></PageTransition>} />
            <Route path="/champions" element={<PageTransition><Champions /></PageTransition>} />
            <Route path="/rankings" element={<PageTransition><Rankings /></PageTransition>} />
            <Route path="/schedule" element={<PageTransition><Schedule /></PageTransition>} />
            <Route path="/menu" element={<PageTransition><Menu /></PageTransition>} />
            <Route path="/account" element={<PageTransition><Account /></PageTransition>} />
            <Route path="/edit-profile" element={<PageTransition><EditProfile /></PageTransition>} />
            <Route path="/register-player" element={<PageTransition><RegisterPlayer /></PageTransition>} />

            {/* Match Routes */}
            <Route path="/match/:matchId" element={<PageTransition><MatchLive /></PageTransition>} />
            <Route path="/match/:matchId/info" element={<PageTransition><MatchInfo /></PageTransition>} />
            <Route path="/match/:matchId/scorecard" element={<PageTransition><MatchScorecard /></PageTransition>} />
            <Route path="/match/:matchId/graphs" element={<PageTransition><MatchGraphs /></PageTransition>} />
            <Route path="/match/:matchId/playing-xi" element={<PageTransition><MatchPlayingXI /></PageTransition>} />
          </Route>

          {/* Admin Routes - Wrapped in AdminLayout */}
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/tournaments" element={<AdminTournaments />} />
            <Route path="/admin/tournaments/:id/dashboard" element={<TournamentControlSystem />} />
            <Route path="/admin/tournaments/:id/groups" element={<TournamentControlSystem />} />
            <Route path="/admin/tournaments/:id/fixtures" element={<TournamentControlSystem />} />
            <Route path="/admin/tournaments/:id/knockout" element={<TournamentControlSystem />} />
            <Route path="/admin/tournaments/:id/standings" element={<TournamentControlSystem />} />
            <Route path="/admin/tournaments/:id/settings" element={<TournamentControlSystem />} />
            <Route path="/admin/tournaments/:id/edit" element={<TournamentControlSystem />} />
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
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/player-approvals" element={<AdminPlayerRequests />} />
            <Route path="/admin/broadcast" element={<AdminEmailBroadcast />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>

          {/* Catch all - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </BrowserRouter>
  )
}

export default App
