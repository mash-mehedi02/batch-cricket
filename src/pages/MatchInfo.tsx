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
import { coerceToDate, formatTimeLabel, formatTimeHMTo12h } from '@/utils/date'

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
            if (squadA) {
              setTeamASquad(squadA)
            }
          } catch (err) {
            console.warn('Error loading team A squad:', err)
          }
        }

        if (squadIdB) {
          try {
            const squadB = await squadService.getById(squadIdB)
            if (squadB) {
              setTeamBSquad(squadB)
            }
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

  // Handle date (Timestamp or string)
  const matchDate = coerceToDate((match as any).date)
  const rawTime = String((match as any).time || '').trim()
  const timeText = rawTime
    ? (rawTime.match(/^\d{1,2}:\d{2}$/) ? formatTimeHMTo12h(rawTime) : rawTime)
    : (matchDate ? formatTimeLabel(matchDate) : '')

  const InfoCard = ({ title, icon, value, subValue, bg, border, iconBg }: { title: string, icon: React.ReactNode, value: string, subValue?: string, bg: string, border: string, iconBg?: string }) => (
    <div className={`p-6 rounded-[1.5rem] border ${border} ${bg} transition-all hover:shadow-md space-y-4`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${iconBg || 'bg-white/50'} flex items-center justify-center text-lg`}>
          {icon}
        </div>
        <h3 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-400 font-bold">{title}</h3>
      </div>
      <div className="space-y-1">
        <p className="text-base sm:text-xl font-black text-slate-800 leading-tight">{value}</p>
        {subValue && <p className="text-[10px] sm:text-[11px] text-slate-400 font-black uppercase tracking-wider">{subValue}</p>}
      </div>
    </div>
  )

  return (
    <div className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 ${compact ? 'py-6' : 'py-12'} space-y-6`}>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Match Ref */}
        <InfoCard
          title="Match Ref"
          icon={<span className="text-slate-500">#️⃣</span>}
          value={(match as any).matchNo || `#${match.id.substring(0, 6).toUpperCase()}`}
          subValue={(match as any).matchNo ? 'OFFICIAL ID' : 'SYSTEM ID'}
          bg="bg-[#f8fafc]"
          border="border-[#f1f5f9]"
        />

        {/* Teams */}
        <InfoCard
          title="Teams"
          icon={<span className="text-indigo-600">👥</span>}
          value={`${firstName} vs ${secondName}`}
          bg="bg-[#f4f7ff]"
          border="border-[#e0e9ff]"
        />

        {/* Venue */}
        <InfoCard
          title="Venue"
          icon={<span className="text-rose-500">📍</span>}
          value={match.venue || 'SMA Home Ground'}
          bg="bg-[#f0fff9]"
          border="border-[#e1fdf2]"
        />

        {/* Tournament */}
        {tournament && (
          <InfoCard
            title="Tournament"
            icon={<span className="text-amber-500">🏆</span>}
            value={tournament.name}
            subValue={`YEAR: ${tournament.year} • ${tournament.format || 'T20'}`}
            bg="bg-[#f4f7ff]"
            border="border-[#e0e9ff]"
          />
        )}

        {/* Date & Time */}
        <InfoCard
          title="Date & Time"
          icon={<span className="text-blue-500">📅</span>}
          value={matchDate ? matchDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBA'}
          subValue={timeText ? `AT ${timeText.toUpperCase()}` : ''}
          bg="bg-[#faf5ff]"
          border="border-[#f3e8ff]"
        />

        {/* Match Format */}
        <InfoCard
          title="Match Format"
          icon={<span className="text-purple-400">⚙️</span>}
          value={match.oversLimit ? `${match.oversLimit} Overs Match` : '6 Overs Match'}
          bg="bg-[#f8fafc]"
          border="border-[#f1f5f9]"
        />

        {/* Match Status */}
        <InfoCard
          title="Status"
          icon={<span className="text-emerald-500">📊</span>}
          value={String(match.status || 'upcoming').toLowerCase()}
          bg="bg-[#f0fff9]"
          border="border-[#e1fdf2]"
        />

        {/* Toss - Only show if available */}
        {match.tossWinner && (
          <InfoCard
            title="Toss"
            icon={<span className="text-amber-600">🪙</span>}
            value={`${(match.tossWinner === 'teamA' || match.tossWinner === (match as any).teamAId || match.tossWinner === (match as any).teamASquadId) ? teamAName : teamBName} won the toss`}
            subValue={`Elected to ${match.electedTo || 'bat/bowl'}`}
            bg="bg-[#fffcfa]"
            border="border-[#fff1e7]"
          />
        )}
      </div>
    </div>
  )
}
