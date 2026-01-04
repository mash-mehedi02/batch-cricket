/**
 * Match Info Page
 * Display comprehensive match information from Firebase
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { matchService } from '@/services/firestore/matches'
import { tournamentService } from '@/services/firestore/tournaments'
import { squadService } from '@/services/firestore/squads'
import { Match, Tournament } from '@/types'
import { Timestamp } from 'firebase/firestore'
import { SkeletonCard } from '@/components/skeletons/SkeletonCard'
import { coerceToDate, formatTimeLabel } from '@/utils/date'

export default function MatchInfo() {
  const { matchId } = useParams<{ matchId: string }>()
  const [match, setMatch] = useState<Match | null>(null)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [teamASquad, setTeamASquad] = useState<any>(null)
  const [teamBSquad, setTeamBSquad] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!matchId) return

    // Load match
    matchService.getById(matchId).then((matchData) => {
      if (matchData) {
        setMatch(matchData)
        setLoading(false)
      } else {
        setLoading(false)
      }
    }).catch((error) => {
      console.error('Error loading match:', error)
      setLoading(false)
    })

    // Subscribe to match updates
    const unsubscribe = matchService.subscribeToMatch(matchId, (matchData) => {
      if (matchData) {
        setMatch(matchData)
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [matchId])

  // Load tournament and squads
  useEffect(() => {
    if (!match) return

    const loadRelatedData = async () => {
      try {
        // Load tournament
        if (match.tournamentId) {
          const tournamentData = await tournamentService.getById(match.tournamentId)
          if (tournamentData) setTournament(tournamentData)
        }

        // Load squads
        if (match.teamA) {
          try {
            const squadA = await squadService.getById(match.teamA)
            if (squadA) setTeamASquad(squadA)
          } catch (err) {
            console.warn('Error loading team A squad:', err)
          }
        }

        if (match.teamB) {
          try {
            const squadB = await squadService.getById(match.teamB)
            if (squadB) setTeamBSquad(squadB)
          } catch (err) {
            console.warn('Error loading team B squad:', err)
          }
        }
      } catch (error) {
        console.error('Error loading related data:', error)
      }
    }

    loadRelatedData()
  }, [match])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-pulse">
        <div className="mb-10">
          <div className="h-10 bg-gray-200 rounded w-64 mb-6"></div>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-gray-200 space-y-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-6">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
              <div className="h-6 bg-gray-200 rounded w-48"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 text-lg mb-4">Match not found</p>
        </div>
      </div>
    )
  }

  const teamAName = match.teamAName || teamASquad?.name || match.teamA || 'Team A'
  const teamBName = match.teamBName || teamBSquad?.name || match.teamB || 'Team B'
  
  // Handle date (Timestamp or string)
  const matchDate = coerceToDate((match as any).date)
  const timeText = (match as any).time || (matchDate ? formatTimeLabel(matchDate) : '')

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-1 w-12 bg-gradient-to-r from-teal-500 to-emerald-600 rounded-full"></div>
          <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-slate-900 via-teal-600 to-emerald-600 bg-clip-text text-transparent">
            Match Information
          </h1>
          <div className="h-1 flex-1 bg-gradient-to-r from-teal-500/30 to-transparent rounded-full"></div>
        </div>
      </div>
      
      <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-xl p-8 border-2 border-slate-200 space-y-6">
        {/* Teams */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-100">
          <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-3">Teams</h3>
          <p className="text-2xl font-extrabold text-slate-900">
            {teamAName} <span className="text-blue-500">vs</span> {teamBName}
          </p>
        </div>
        
        {/* Venue */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border-2 border-emerald-100">
          <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-3">📍 Venue</h3>
          <p className="text-xl font-bold text-slate-900">{match.venue || 'Venue TBA'}</p>
        </div>
        
        {/* Tournament */}
        {tournament && (
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border-2 border-indigo-100">
            <h3 className="text-sm font-bold text-indigo-700 uppercase tracking-wider mb-3">🏆 Tournament</h3>
            <p className="text-xl font-bold text-slate-900">{tournament.name}</p>
            <p className="text-sm text-slate-600 mt-1">Year: {tournament.year} • Format: {tournament.format}</p>
          </div>
        )}

        {/* Date & Time */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-100">
          <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wider mb-3">📅 Date & Time</h3>
          <p className="text-xl font-bold text-slate-900">
            {matchDate 
              ? matchDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
              : 'TBA'} 
            {timeText ? ` at ${timeText}` : ''}
          </p>
        </div>
        
        {/* Toss */}
        {match.tossWinner && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-6 border-2 border-amber-100">
            <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-3">🪙 Toss</h3>
            <p className="text-xl font-bold text-slate-900">
              {match.tossWinner === 'teamA' ? teamAName : teamBName} won the toss and elected to{' '}
              <span className="text-amber-600 capitalize">{match.electedTo || 'bat/bowl'}</span>
            </p>
          </div>
        )}

        {/* Match Format */}
        {match.oversLimit && (
          <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-6 border-2 border-slate-100">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">⚙️ Match Format</h3>
            <p className="text-xl font-bold text-slate-900">
              {match.oversLimit} overs match
            </p>
          </div>
        )}

        {/* Match Status */}
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl p-6 border-2 border-teal-100">
          <h3 className="text-sm font-bold text-teal-700 uppercase tracking-wider mb-3">📊 Status</h3>
          <p className="text-xl font-bold text-slate-900 capitalize">
            {match.status || 'Upcoming'}
          </p>
        </div>

        {/* Squads Info */}
        {(teamASquad || teamBSquad) && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-6 border-2 border-orange-100">
            <h3 className="text-sm font-bold text-orange-700 uppercase tracking-wider mb-3">👥 Squads</h3>
            <div className="space-y-2">
              {teamASquad && (
                <p className="text-lg font-semibold text-slate-900">
                  {teamAName}: {teamASquad.playerIds?.length || 0} players
                </p>
              )}
              {teamBSquad && (
                <p className="text-lg font-semibold text-slate-900">
                  {teamBName}: {teamBSquad.playerIds?.length || 0} players
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

