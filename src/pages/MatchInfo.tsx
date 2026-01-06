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
import { coerceToDate, formatTimeLabel } from '@/utils/date'

interface MatchInfoProps {
  compact?: boolean
}

export default function MatchInfo({ compact = false }: MatchInfoProps) {
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
        const squadIdA = match.teamAId || (match as any).teamASquadId || (match as any).teamA
        const squadIdB = match.teamBId || (match as any).teamBSquadId || (match as any).teamB

        if (squadIdA) {
          try {
            const squadA = await squadService.getById(squadIdA)
            if (squadA) setTeamASquad(squadA)
          } catch (err) {
            console.warn('Error loading team A squad:', err)
          }
        }

        if (squadIdB) {
          try {
            const squadB = await squadService.getById(squadIdB)
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
      <div className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${compact ? 'py-4' : 'py-12'} animate-pulse`}>
        {!compact && (
          <div className="mb-10">
            <div className="h-10 bg-gray-200 rounded w-64 mb-6"></div>
          </div>
        )}
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

  const teamAName = match.teamAName || teamASquad?.name || (match as any).teamA || 'Team A'
  const teamBName = match.teamBName || teamBSquad?.name || (match as any).teamB || 'Team B'

  // Batting Order logic
  const { firstSide, secondSide } = (() => {
    if (!match) return { firstSide: 'teamA', secondSide: 'teamB' }
    const tw = String((match as any).tossWinner || '').trim()
    const decRaw = String((match as any).electedTo || (match as any).tossDecision || '').trim().toLowerCase()
    if (!tw || !decRaw) return { firstSide: 'teamA', secondSide: 'teamB' }

    const tossSide = (tw === 'teamA' || tw === (match as any).teamAId || tw === (match as any).teamASquadId) ? 'teamA' : 'teamB'
    const battedFirst = decRaw.includes('bat') ? tossSide : (tossSide === 'teamA' ? 'teamB' : 'teamA')
    return {
      firstSide: battedFirst as 'teamA' | 'teamB',
      secondSide: (battedFirst === 'teamA' ? 'teamB' : 'teamA') as 'teamA' | 'teamB'
    }
  })()

  const firstName = firstSide === 'teamA' ? teamAName : teamBName
  const secondName = secondSide === 'teamA' ? teamAName : teamBName
  const firstSquad = firstSide === 'teamA' ? teamASquad : teamBSquad
  const secondSquad = secondSide === 'teamA' ? teamASquad : teamBSquad

  // Handle date (Timestamp or string)
  const matchDate = coerceToDate((match as any).date)
  const timeText = (match as any).time || (matchDate ? formatTimeLabel(matchDate) : '')

  const InfoCard = ({ title, icon, value, subValue, gradient }: { title: string, icon: string, value: string, subValue?: string, gradient: string }) => (
    <div className={`p-5 rounded-2xl border-2 transition-all hover:shadow-lg ${gradient}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] opacity-60">{title}</h3>
      </div>
      <p className="text-base sm:text-xl font-black text-slate-900 leading-tight">{value}</p>
      {subValue && <p className="text-[11px] sm:text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">{subValue}</p>}
    </div>
  )

  return (
    <div className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${compact ? 'py-6' : 'py-12'}`}>
      {/* Header */}
      {!compact && (
        <div className="mb-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-1.5 w-16 bg-gradient-to-r from-batchcrick-navy to-blue-600 rounded-full"></div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
              Match <span className="text-blue-600">Info</span>
            </h1>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Teams */}
        <InfoCard
          title="Teams"
          icon="👥"
          value={`${firstName} vs ${secondName}`}
          gradient="bg-blue-50/50 border-blue-100 hover:border-blue-200"
        />

        {/* Venue */}
        <InfoCard
          title="Venue"
          icon="📍"
          value={match.venue || 'Venue TBA'}
          gradient="bg-emerald-50/50 border-emerald-100 hover:border-emerald-200"
        />

        {/* Tournament */}
        {tournament && (
          <InfoCard
            title="Tournament"
            icon="🏆"
            value={tournament.name}
            subValue={`Year: ${tournament.year} • ${tournament.format}`}
            gradient="bg-indigo-50/50 border-indigo-100 hover:border-indigo-200"
          />
        )}

        {/* Date & Time */}
        <InfoCard
          title="Date & Time"
          icon="📅"
          value={matchDate ? matchDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBA'}
          subValue={timeText ? `At ${timeText}` : ''}
          gradient="bg-purple-50/50 border-purple-100 hover:border-purple-200"
        />

        {/* Toss */}
        {match.tossWinner && (
          <InfoCard
            title="Toss"
            icon="🪙"
            value={`${(match.tossWinner === 'teamA' || match.tossWinner === (match as any).teamAId || match.tossWinner === (match as any).teamASquadId) ? teamAName : teamBName} won the toss`}
            subValue={`Elected to ${match.electedTo || 'bat/bowl'}`}
            gradient="bg-amber-50/50 border-amber-100 hover:border-amber-200"
          />
        )}

        {/* Match Format */}
        {match.oversLimit && (
          <InfoCard
            title="Match Format"
            icon="⚙️"
            value={`${match.oversLimit} Overs Match`}
            gradient="bg-slate-50/50 border-slate-200 hover:border-slate-300"
          />
        )}

        {/* Match Status */}
        <InfoCard
          title="Status"
          icon="📊"
          value={match.status || 'Upcoming'}
          gradient="bg-teal-50/50 border-teal-100 hover:border-teal-200"
        />

        {/* Squads Info */}
        {(firstSquad || secondSquad) && (
          <InfoCard
            title="Squad Size"
            icon="📋"
            value={`${firstName}: ${firstSquad?.playerIds?.length || 0} players`}
            subValue={`${secondName}: ${secondSquad?.playerIds?.length || 0} players`}
            gradient="bg-orange-50/50 border-orange-100 hover:border-orange-200"
          />
        )}
      </div>
    </div>
  )
}

