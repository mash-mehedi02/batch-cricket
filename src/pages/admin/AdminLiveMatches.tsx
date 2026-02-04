/**
 * Live Matches Monitor Page
 * Real-time list of all live matches
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { useAuthStore } from '@/store/authStore'
import { Match } from '@/types'
import { SkeletonCard } from '@/components/skeletons/SkeletonCard'

export default function AdminLiveMatches() {
  const { user } = useAuthStore()
  const [liveMatches, setLiveMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [matchScores, setMatchScores] = useState<Record<string, string>>({})
  const [scoresLoading, setScoresLoading] = useState<Record<string, boolean>>({})

  // Helper function to determine which team is batting based on match state
  const resolveSideFromValue = (m: Match, v: any): 'teamA' | 'teamB' | null => {
    if (v === 'teamA' || v === 'teamB') return v;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s === 'teama' || s === 'team a' || s === 'team_a' || s === 'a') return 'teamA';
      if (s === 'teamb' || s === 'team b' || s === 'team_b' || s === 'b') return 'teamB';

      const aId = String((m as any).teamAId || (m as any).teamASquadId || (m as any).teamA || '').trim().toLowerCase();
      const bId = String((m as any).teamBId || (m as any).teamBSquadId || (m as any).teamB || '').trim().toLowerCase();
      const aName = String(m.teamAName || (m as any).teamA || '').trim().toLowerCase();
      const bName = String(m.teamBName || (m as any).teamB || '').trim().toLowerCase();

      if (aId && s === aId) return 'teamA';
      if (bId && s === bId) return 'teamB';
      if (aName && s === aName) return 'teamA';
      if (bName && s === bName) return 'teamB';
    }
    return null;
  };

  const normalizeElectedTo = (v: any): 'bat' | 'bowl' | null => {
    if (v === 'bat' || v === 'bowl') return v;
    if (typeof v !== 'string') return null;
    const s = v.trim().toLowerCase();
    if (s === 'bat' || s === 'batting' || s === 'choose bat' || s === 'chose bat') return 'bat';
    if (s === 'bowl' || s === 'bowling' || s === 'field' || s === 'fielding' || s === 'choose bowl' || s === 'chose bowl')
      return 'bowl';
    return null;
  };

  const inferFirstInningsBatting = (m: Match): 'teamA' | 'teamB' => {
    const tw = resolveSideFromValue(m, (m as any).tossWinner);
    const el = normalizeElectedTo((m as any).electedTo);
    if (!tw || !el) return 'teamA';
    if (el === 'bat') return tw;
    return tw === 'teamA' ? 'teamB' : 'teamA';
  };

  const otherSide = (s: 'teamA' | 'teamB'): 'teamA' | 'teamB' => (s === 'teamA' ? 'teamB' : 'teamA');

  const getCurrentScore = async (matchId: string, match: Match) => {
    setScoresLoading(prev => ({ ...prev, [matchId]: true }));
    try {
      const first = inferFirstInningsBatting(match);
      let effectiveCurrentBatting: 'teamA' | 'teamB';
      if (match.matchPhase === 'SecondInnings') {
        effectiveCurrentBatting = otherSide(first);
      } else {
        effectiveCurrentBatting = first;
      }

      const currentInnings = await matchService.getInnings(matchId, effectiveCurrentBatting);
      if (currentInnings) {
        const runs = currentInnings.totalRuns || 0;
        const wickets = currentInnings.totalWickets || 0;
        const overs = currentInnings.overs || '0.0';
        const battingTeamName = effectiveCurrentBatting === 'teamA' ? (match.teamAName || (match as any).teamA) : (match.teamBName || (match as any).teamB);
        const score = `${battingTeamName} ${runs}/${wickets} (${overs})`;
        setMatchScores(prev => ({ ...prev, [matchId]: score }));
      } else {
        const battingTeamName = effectiveCurrentBatting === 'teamA' ? (match.teamAName || (match as any).teamA) : (match.teamBName || (match as any).teamB);
        setMatchScores(prev => ({ ...prev, [matchId]: `${battingTeamName} 0/0 (0.0)` }));
      }
    } catch (error) {
      console.error(`Error getting score for match ${matchId}:`, error);
      setMatchScores(prev => ({ ...prev, [matchId]: 'Score unavailable' }));
    } finally {
      setScoresLoading(prev => ({ ...prev, [matchId]: false }));
    }
  };

  useEffect(() => {
    const loadLiveMatches = async () => {
      if (!user) return
      try {
        const matches = await matchService.getLiveMatches(user.uid, user.role === 'super_admin')
        setLiveMatches(matches)
        setLoading(false)

        for (const match of matches) {
          await getCurrentScore(match.id, match);
        }
      } catch (error) {
        console.error('Error loading live matches:', error)
        setLoading(false)
      }
    }

    loadLiveMatches()
    const interval = setInterval(loadLiveMatches, 5000);
    return () => clearInterval(interval)
  }, [user])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Live Matches</h1>
          <p className="text-gray-600 mt-1">Monitor and score live matches in real-time</p>
        </div>
      </div>

      {liveMatches.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 border border-gray-200 text-center">
          <div className="text-6xl mb-4">⚽</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Live Matches</h3>
          <p className="text-gray-600 mb-6">There are no matches currently in progress.</p>
          <Link
            to="/admin/matches/new"
            className="inline-block px-6 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700"
          >
            Create New Match
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {liveMatches.map((match) => (
            <div
              key={match.id}
              className="bg-white rounded-xl shadow-md p-6 border-2 border-red-200 hover:shadow-lg transition"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-semibold text-red-700 uppercase">LIVE</span>
                </div>
                <span className="text-sm text-gray-600">{match.venue || 'Venue TBD'}</span>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {match.teamAName || (match as any).teamA} vs {match.teamBName || (match as any).teamB}
              </h3>

              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">Current Score</div>
                <div className="text-2xl font-bold text-gray-900">
                  {scoresLoading[match.id] ? (
                    <span className="text-gray-500">Loading...</span>
                  ) : (
                    <>
                      {(() => {
                        const currentScoreText = matchScores[match.id] || 'Live Scoring...';
                        const scorePattern = /(\d+)\/(\d+) \((\d+\.\d+)\)/;
                        const scoreMatch = currentScoreText.match(scorePattern);

                        if (scoreMatch) {
                          const fullScore = `${scoreMatch[1]}/${scoreMatch[2]} (${scoreMatch[3]})`;
                          const teamName = currentScoreText.replace(fullScore, '').trim();

                          return (
                            <>
                              <span className="text-xs font-medium text-gray-600 truncate max-w-full">{teamName}</span>
                              <br />
                              <span className="text-3xl md:text-4xl font-black text-gray-900">{fullScore}</span>
                            </>
                          );
                        }
                        return currentScoreText;
                      })()}
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  to={`/admin/live/${match.id}/scoring`}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 text-center transition"
                >
                  Score Match
                </Link>
                <Link
                  to={`/match/${match.id}`}
                  className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}