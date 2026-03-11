import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { SplashScreen as NativeSplash } from '@capacitor/splash-screen';
import AppSplashScreen from './components/common/SplashScreen'
import ScrollToTop from './components/common/ScrollToTop'
import NativeAppWrapper from './components/common/NativeAppWrapper'
import AuthLoadingOverlay from './components/common/AuthLoadingOverlay'
import PageTransition from './components/common/PageTransition'
import { useAuthStore } from './store/authStore'
import { AnimatePresence } from 'framer-motion'
import AppUpdatePopup from './components/AppUpdatePopup'
import { useThemeListener } from './hooks/useThemeListener'
import Layout from './components/Layout'
import AdminLayout from './components/admin/AdminLayout'

const Home = React.lazy(() => import('./pages/Home'))
const Login = React.lazy(() => import('./pages/Login'))
const Tournaments = React.lazy(() => import('./pages/Tournaments'))
const TermsPage = React.lazy(() => import('./pages/Terms'))
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'))
const TournamentDetails = React.lazy(() => import('./pages/TournamentDetails'))
const Squads = React.lazy(() => import('./pages/Squads'))
const SquadDetails = React.lazy(() => import('./pages/SquadDetails'))
const Players = React.lazy(() => import('./pages/Players'))
const PlayerProfile = React.lazy(() => import('./pages/PlayerProfile'))
const Champions = React.lazy(() => import('./pages/Champions'))
const Rankings = React.lazy(() => import('./pages/Rankings'))
const Menu = React.lazy(() => import('./pages/Menu'))
const Account = React.lazy(() => import('./pages/Account'))
const EditProfile = React.lazy(() => import('./pages/EditProfile'))
const MatchLive = React.lazy(() => import('./pages/MatchLive'))
const MatchInfo = React.lazy(() => import('./pages/MatchInfo'))
const MatchScorecard = React.lazy(() => import('./pages/MatchScorecard'))
const MatchGraphs = React.lazy(() => import('./pages/MatchGraphs'))
const MatchPlayingXI = React.lazy(() => import('./pages/MatchPlayingXI'))
const Schedule = React.lazy(() => import('./pages/Schedule'))
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'))
const Search = React.lazy(() => import('./pages/Search'))
const AdminTournaments = React.lazy(() => import('./pages/admin/AdminTournaments'))
const TournamentControlSystem = React.lazy(() => import('./pages/admin/TournamentControlSystem'))
const AdminSquads = React.lazy(() => import('./pages/admin/AdminSquads'))
const AdminPlayers = React.lazy(() => import('./pages/admin/AdminPlayers'))
const AdminMatches = React.lazy(() => import('./pages/admin/AdminMatches'))
const AdminLiveMatches = React.lazy(() => import('./pages/admin/AdminLiveMatches'))
const AdminLiveScoring = React.lazy(() => import('./pages/admin/AdminLiveScoring'))
const AdminAnalytics = React.lazy(() => import('./pages/admin/AdminAnalytics'))
const AdminUsers = React.lazy(() => import('./pages/admin/AdminUsers'))
const AdminEmailBroadcast = React.lazy(() => import('./pages/admin/AdminEmailBroadcast'))
const AdminSettings = React.lazy(() => import('./pages/admin/AdminSettings'))
const RegisterPlayer = React.lazy(() => import('./pages/RegisterPlayer'))
const AdminPlayerRequests = React.lazy(() => import('./pages/admin/AdminPlayerRequests'))


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
  useThemeListener(); // Global theme listener for system preference

  const [showSplash, setShowSplash] = useState(true);
  const isAuthProcessing = useAuthStore(s => s.isProcessing);

  useEffect(() => {
    // Hide the native splash immediately so our custom React splash can show
    NativeSplash.hide().catch(() => { });
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
      <AppUpdatePopup />
      <AnimatePresence mode="wait">
        <Suspense fallback={<div className="h-screen w-screen bg-[#050B18]" />}>
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
              <Route path="/privacy" element={<PageTransition><PrivacyPolicy /></PageTransition>} />
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
        </Suspense>
      </AnimatePresence>
    </BrowserRouter>
  )
}

export default App
