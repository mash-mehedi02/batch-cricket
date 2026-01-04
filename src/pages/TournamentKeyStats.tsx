/**
 * Tournament Key Stats (Public)
 * Most Runs, Most Wickets, Best Strike Rate, Most 50s, Most 100s
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { tournamentService } from '@/services/firestore/tournaments'
import { matchService } from '@/services/firestore/matches'
import { squadService } from '@/services/firestore/squads'
import { playerService } from '@/services/firestore/players'
import type { InningsStats, Match, Tournament } from '@/types'

type BatAgg = {
  playerId: string
  playerName: string
  squadName: string
  runs: number
  balls: number
  inns: number
  outs: number
  hundreds: number
  fifties: number
  fours: number
  sixes: number
  strikeRate: number
}

type BowlAgg = {
  playerId: string
  playerName: string
  squadName: string
  wickets: number
  balls: number
  runsConceded: number
  economy: number
}

const safeNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0)

export default function TournamentKeyStats(
  { embedded = false, tournamentId: tournamentIdProp }: { embedded?: boolean; tournamentId?: string } = {}
) {
  const params = useParams<{ tournamentId: string }>()
  const tournamentId = tournamentIdProp || params.tournamentId
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [inningsMap, setInningsMap] = useState<Map<string, { teamA: InningsStats | null; teamB: InningsStats | null }>>(new Map())
  const [playersById, setPlayersById] = useState<Map<string, any>>(new Map())
  const [squadsById, setSquadsById] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)

  if (!tournamentId) return null

  useEffect(() => {
    const run = async () => {
      if (!tournamentId) return
      setLoading(true)
      try {
        const t = await tournamentService.getById(tournamentId)
        setTournament(t)

        const ms = await matchService.getByTournament(tournamentId)
        setMatches(ms)

        // Realtime: keep player/squad names in sync after renames
        const unsubPlayers = playerService.subscribeAll((list) => {
          const pMap = new Map<string, any>()
          ;(list as any[]).forEach((p) => p?.id && pMap.set(p.id, p))
          setPlayersById(pMap)
        })
        const unsubSquads = squadService.subscribeAll((list) => {
          const sMap = new Map<string, any>()
          ;(list as any[]).forEach((s) => s?.id && sMap.set(s.id, s))
          setSquadsById(sMap)
        })

        const entries = await Promise.all(
          ms.map(async (m) => {
            const [a, b] = await Promise.all([
              matchService.getInnings(m.id, 'teamA'),
              matchService.getInnings(m.id, 'teamB'),
            ])
            return [m.id, { teamA: a, teamB: b }] as const
          })
        )
        const im = new Map<string, { teamA: InningsStats | null; teamB: InningsStats | null }>()
        entries.forEach(([id, v]) => im.set(id, v))
        setInningsMap(im)

        return () => {
          unsubPlayers()
          unsubSquads()
        }
      } finally {
        setLoading(false)
      }
    }
    let cleanup: undefined | (() => void)
    run().then((c: any) => { cleanup = typeof c === 'function' ? c : undefined }).catch(() => {})
    return () => cleanup?.()
  }, [tournamentId])

  const { mostRuns, mostWickets, bestStrikeRate, mostFifties, mostHundreds } = useMemo(() => {
    const getPlayerName = (id: string) => String(playersById.get(id)?.name || '').trim() || 'Player'
    const getSquadName = (playerId: string) => {
      const squadId = playersById.get(playerId)?.squadId
      const fromSquad = String(squadsById.get(squadId)?.name || squadsById.get(squadId)?.teamName || '').trim()
      if (fromSquad) return fromSquad
      // tournament meta fallback
      const meta = (tournament as any)?.participantSquadMeta || {}
      const m = meta?.[squadId]
      return String(m?.name || '').trim() || 'Team'
    }

    const bat = new Map<string, BatAgg>()
    const bowl = new Map<string, BowlAgg>()

    const addBat = (playerId: string, patch: Partial<BatAgg>) => {
      if (!playerId) return
      if (!bat.has(playerId)) {
        bat.set(playerId, {
          playerId,
          playerName: getPlayerName(playerId),
          squadName: getSquadName(playerId),
          runs: 0,
          balls: 0,
          inns: 0,
          outs: 0,
          hundreds: 0,
          fifties: 0,
          fours: 0,
          sixes: 0,
          strikeRate: 0,
        })
      }
      const r = bat.get(playerId)!
      r.runs += safeNum(patch.runs)
      r.balls += safeNum(patch.balls)
      r.inns += safeNum(patch.inns)
      r.outs += safeNum(patch.outs)
      r.hundreds += safeNum(patch.hundreds)
      r.fifties += safeNum(patch.fifties)
      r.fours += safeNum(patch.fours)
      r.sixes += safeNum(patch.sixes)
    }

    const addBowl = (playerId: string, patch: Partial<BowlAgg>) => {
      if (!playerId) return
      if (!bowl.has(playerId)) {
        bowl.set(playerId, {
          playerId,
          playerName: getPlayerName(playerId),
          squadName: getSquadName(playerId),
          wickets: 0,
          balls: 0,
          runsConceded: 0,
          economy: 0,
        })
      }
      const r = bowl.get(playerId)!
      r.wickets += safeNum(patch.wickets)
      r.balls += safeNum(patch.balls)
      r.runsConceded += safeNum(patch.runsConceded)
    }

    // Aggregate from innings docs (already computed)
    inningsMap.forEach((inn) => {
      ;[inn.teamA, inn.teamB].filter(Boolean).forEach((i) => {
        const innings = i as any
        ;(innings?.batsmanStats || []).forEach((b: any) => {
          const pid = String(b.batsmanId || '')
          const runs = safeNum(b.runs)
          const balls = safeNum(b.balls)
          const notOut = Boolean(b.notOut)
          addBat(pid, {
            runs,
            balls,
            inns: 1,
            outs: notOut ? 0 : 1,
            hundreds: runs >= 100 ? 1 : 0,
            fifties: runs >= 50 && runs < 100 ? 1 : 0,
            fours: safeNum(b.fours),
            sixes: safeNum(b.sixes),
          })
        })
        ;(innings?.bowlerStats || []).forEach((bw: any) => {
          const pid = String(bw.bowlerId || '')
          addBowl(pid, {
            wickets: safeNum(bw.wickets),
            balls: safeNum(bw.ballsBowled),
            runsConceded: safeNum(bw.runsConceded),
          })
        })
      })
    })

    // finalize SR + economy
    bat.forEach((r) => {
      r.strikeRate = r.balls > 0 ? Number(((r.runs / r.balls) * 100).toFixed(2)) : 0
    })
    bowl.forEach((r) => {
      const overs = r.balls / 6
      r.economy = overs > 0 ? Number((r.runsConceded / overs).toFixed(2)) : 0
    })

    const batArr = Array.from(bat.values())
    const bowlArr = Array.from(bowl.values())

    const mostRuns = [...batArr].sort((a, b) => b.runs - a.runs).slice(0, 15)
    const mostFifties = [...batArr].sort((a, b) => b.fifties - a.fifties || b.runs - a.runs).slice(0, 15)
    const mostHundreds = [...batArr].sort((a, b) => b.hundreds - a.hundreds || b.runs - a.runs).slice(0, 15)

    // Best strike rate: ignore tiny samples
    const MIN_BALLS = 10
    const bestStrikeRate = [...batArr]
      .filter((r) => r.balls >= MIN_BALLS)
      .sort((a, b) => b.strikeRate - a.strikeRate || b.runs - a.runs)
      .slice(0, 15)

    const mostWickets = [...bowlArr].sort((a, b) => b.wickets - a.wickets || a.economy - b.economy).slice(0, 15)

    return { mostRuns, mostWickets, bestStrikeRate, mostFifties, mostHundreds }
  }, [inningsMap, playersById, squadsById, tournament])

  if (!tournamentId) return <div className="max-w-4xl mx-auto px-4 py-10">Tournament not found</div>

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-8 w-64 bg-slate-200 rounded animate-pulse mb-4" />
        <div className="h-4 w-80 bg-slate-200 rounded animate-pulse mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-80 bg-slate-100 rounded-2xl animate-pulse" />
          <div className="h-80 bg-slate-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    )
  }

  const Section = ({
    title,
    subtitle,
    children,
  }: {
    title: string
    subtitle?: string
    children: React.ReactNode
  }) => (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
        <div className="text-lg font-extrabold text-slate-900">{title}</div>
        {subtitle ? <div className="text-xs text-slate-500 mt-1">{subtitle}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )

  const Table = ({
    columns,
    rows,
  }: {
    columns: Array<{ key: string; label: string; align?: 'left' | 'right' }>
    rows: Array<Record<string, any>>
  }) => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-600 border-b border-slate-200">
            {columns.map((c) => (
              <th key={c.key} className={`py-3 px-3 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, idx) => (
            <tr key={r.id || r.playerId || idx} className="hover:bg-slate-50">
              {columns.map((c) => (
                <td key={c.key} className={`py-3 px-3 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-8 text-center text-slate-500">
                No data yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )

  const title = tournament?.name || 'Tournament'

  return (
    <div className={embedded ? 'space-y-6' : 'max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6'}>
      {!embedded ? (
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link to={`/tournaments/${tournamentId}`} className="text-sm font-semibold text-teal-700 hover:underline">
              ← Back to Tournament
            </Link>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mt-2">Key Stats</h1>
            <p className="text-slate-600 mt-1">
              <span className="font-semibold">{title}</span>
              {tournament?.year ? <> • {tournament.year}</> : null}
            </p>
          </div>
          <div className="flex gap-3">
            <Link
            to={`/tournaments/${tournamentId}?tab=points`}
              className="px-4 py-2 rounded-xl bg-white text-slate-900 border-2 border-slate-200 font-semibold hover:bg-slate-50"
            >
              Points Table
            </Link>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Most Runs" subtitle="Total runs across all matches in this tournament">
          <Table
            columns={[
              { key: 'rank', label: 'No.' },
              { key: 'playerName', label: 'Player' },
              { key: 'squadName', label: 'Team' },
              { key: 'runs', label: 'Runs', align: 'right' },
              { key: 'inns', label: 'Inns', align: 'right' },
              { key: 'strikeRate', label: 'SR', align: 'right' },
            ]}
            rows={mostRuns.map((r, i) => ({ ...r, rank: i + 1 }))}
          />
        </Section>

        <Section title="Most Wickets" subtitle="Total wickets across all matches in this tournament">
          <Table
            columns={[
              { key: 'rank', label: 'No.' },
              { key: 'playerName', label: 'Player' },
              { key: 'squadName', label: 'Team' },
              { key: 'wickets', label: 'Wkts', align: 'right' },
              { key: 'economy', label: 'Econ', align: 'right' },
            ]}
            rows={mostWickets.map((r, i) => ({ ...r, rank: i + 1 }))}
          />
        </Section>

        <Section title="Best Strike Rate" subtitle="Min 10 balls faced">
          <Table
            columns={[
              { key: 'rank', label: 'No.' },
              { key: 'playerName', label: 'Player' },
              { key: 'squadName', label: 'Team' },
              { key: 'strikeRate', label: 'SR', align: 'right' },
              { key: 'runs', label: 'Runs', align: 'right' },
              { key: 'balls', label: 'Balls', align: 'right' },
            ]}
            rows={bestStrikeRate.map((r, i) => ({ ...r, rank: i + 1 }))}
          />
        </Section>

        <Section title="Most 50s" subtitle="Count of innings with 50–99">
          <Table
            columns={[
              { key: 'rank', label: 'No.' },
              { key: 'playerName', label: 'Player' },
              { key: 'squadName', label: 'Team' },
              { key: 'fifties', label: '50s', align: 'right' },
              { key: 'runs', label: 'Runs', align: 'right' },
            ]}
            rows={mostFifties.map((r, i) => ({ ...r, rank: i + 1 }))}
          />
        </Section>

        <div className="lg:col-span-2">
          <Section title="Most 100s" subtitle="Count of innings with 100+">
            <Table
              columns={[
                { key: 'rank', label: 'No.' },
                { key: 'playerName', label: 'Player' },
                { key: 'squadName', label: 'Team' },
                { key: 'hundreds', label: '100s', align: 'right' },
                { key: 'runs', label: 'Runs', align: 'right' },
              ]}
              rows={mostHundreds.map((r, i) => ({ ...r, rank: i + 1 }))}
            />
          </Section>
        </div>
      </div>
    </div>
  )
}


