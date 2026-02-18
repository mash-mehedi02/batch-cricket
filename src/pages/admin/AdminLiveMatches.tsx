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
import { Calendar, MapPin, Trophy, ArrowRight, Activity, Shield } from 'lucide-react'
import { format } from 'date-fns'
import { formatShortTeamName } from '@/utils/teamName'

interface TeamScore {
  runs: number
  wickets: number
  overs: string
  played: boolean
}

interface MatchScoreData {
  teamA: TeamScore
  teamB: TeamScore
  currentBatting: 'teamA' | 'teamB' | null
}

export default function AdminLiveMatches() {
  const { user } = useAuthStore()
  const [liveMatches, setLiveMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [scores, setScores] = useState<Record<string, MatchScoreData>>({})

  const fetchMatchScores = async (match: Match) => {
    try {
      const [innA, innB] = await Promise.all([
        matchService.getInnings(match.id, 'teamA'),
        matchService.getInnings(match.id, 'teamB')
      ])

      setScores(prev => ({
        ...prev,
        [match.id]: {
          teamA: {
            runs: innA?.totalRuns || 0,
            wickets: innA?.totalWickets || 0,
            overs: innA?.overs || '0.0',
            played: !!innA || (match.currentBatting === 'teamA')
          },
          teamB: {
            runs: innB?.totalRuns || 0,
            wickets: innB?.totalWickets || 0,
            overs: innB?.overs || '0.0',
            played: !!innB || (match.currentBatting === 'teamB')
          },
          currentBatting: match.currentBatting as 'teamA' | 'teamB'
        }
      }))
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    const loadLiveMatches = async () => {
      if (!user) return
      try {
        const matches = await matchService.getLiveMatches(user.uid, user.role === 'super_admin')
        setLiveMatches(matches)
        setLoading(false)

        matches.forEach(m => fetchMatchScores(m))
      } catch (error) {
        console.error('Error loading live matches:', error)
        setLoading(false)
      }
    }

    loadLiveMatches()
    const interval = setInterval(loadLiveMatches, 10000) // Refresh every 10s
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
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Live Matches</h1>
          <p className="text-slate-500 mt-1 font-medium">Monitor and score live matches in real-time</p>
        </div>
        <Link
          to="/admin/matches/new"
          className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/30"
        >
          + Create New Match
        </Link>
      </div>

      {liveMatches.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 border border-slate-200 text-center max-w-lg mx-auto mt-12">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
            🏏
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">No Live Matches</h3>
          <p className="text-slate-500 mb-8 font-medium">There are no matches currently in progress. Start a new match to get the crowd cheering!</p>
          <Link
            to="/admin/matches/new"
            className="inline-block px-8 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-xl"
          >
            Start a Match
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {liveMatches.map((match) => {
            const scoreData = scores[match.id];
            const isTeamABatting = match.currentBatting === 'teamA';
            const isTeamBBatting = match.currentBatting === 'teamB';

            // Format Date
            let dateStr = 'Date TBD';
            if (match.date) {
              // Handle Firestore Timestamp or Date string
              const d = (match.date as any).toDate ? (match.date as any).toDate() : new Date(match.date);
              if (!isNaN(d.getTime())) {
                dateStr = format(d, 'MMM dd, yyyy • h:mm a');
              }
            }

            return (
              <div
                key={match.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-blue-200 transition-all duration-300 group flex flex-col overflow-hidden"
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                    <span className="text-[11px] font-black text-red-600 uppercase tracking-widest">LIVE</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                    <Trophy size={12} className="text-amber-500" />
                    <span className="truncate max-w-[150px]">{(match as any).tournamentName || 'Friendly Match'}</span>
                  </div>
                </div>

                {/* Match Content */}
                <div className="p-5 flex-1 flex flex-col justify-center">
                  <div className="flex flex-col gap-4">
                    {/* Team A */}
                    <div className={`flex justify-between items-center p-3 rounded-xl transition-colors ${isTeamABatting ? 'bg-blue-50/60 border border-blue-100' : 'bg-white'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black ${isTeamABatting ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                          {formatShortTeamName(match.teamAName)}
                        </div>
                        <div>
                          <div className={`font-bold text-sm ${isTeamABatting ? 'text-slate-900' : 'text-slate-600'}`}>{match.teamAName}</div>
                          {isTeamABatting && <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1"><Activity size={10} /> Batting</div>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-black tabular-nums ${isTeamABatting ? 'text-slate-900' : 'text-slate-600'}`}>
                          {scoreData ? scoreData.teamA.runs : 0}/{scoreData ? scoreData.teamA.wickets : 0}
                        </div>
                        <div className="text-xs font-bold text-slate-400">
                          {scoreData ? scoreData.teamA.overs : '0.0'} ov
                        </div>
                      </div>
                    </div>

                    {/* Vs Divider */}
                    <div className="hidden">VS</div>

                    {/* Team B */}
                    <div className={`flex justify-between items-center p-3 rounded-xl transition-colors ${isTeamBBatting ? 'bg-blue-50/60 border border-blue-100' : 'bg-white'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black ${isTeamBBatting ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                          {formatShortTeamName(match.teamBName)}
                        </div>
                        <div>
                          <div className={`font-bold text-sm ${isTeamBBatting ? 'text-slate-900' : 'text-slate-600'}`}>{match.teamBName}</div>
                          {isTeamBBatting && <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1"><Activity size={10} /> Batting</div>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xl font-black tabular-nums ${isTeamBBatting ? 'text-slate-900' : 'text-slate-600'}`}>
                          {scoreData ? scoreData.teamB.runs : 0}/{scoreData ? scoreData.teamB.wickets : 0}
                        </div>
                        <div className="text-xs font-bold text-slate-400">
                          {scoreData ? scoreData.teamB.overs : '0.0'} ov
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3 text-xs text-slate-400 font-medium pl-1">
                    <Calendar size={12} /> {dateStr}
                    {match.venue && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <MapPin size={12} /> {match.venue}
                      </>
                    )}
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/30 grid grid-cols-2 gap-3">
                  <Link
                    to={`/admin/live/${match.id}/scoring`}
                    className="flex justify-center items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 active:scale-95"
                  >
                    Score Match <ArrowRight size={16} />
                  </Link>
                  <Link
                    to={`/match/${match.id}`}
                    target="_blank"
                    className="flex justify-center items-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition hover:border-slate-300 active:scale-95"
                  >
                    <Shield size={16} className="text-slate-400" /> View Public
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}