/**
 * BatchCrick BD - Standings + Ranking Engine
 * Points -> NRR -> Head-to-Head -> Wins
 */

import type { MatchResult, TournamentConfig, GroupStandings, StandingRow, RankingTieBreaker } from './types'

const safe = (n: any) => (Number.isFinite(Number(n)) ? Number(n) : 0)

const oversDec = (balls: number) => (balls > 0 ? balls / 6 : 0)

function computeNRR(r: StandingRow): number {
  const rf = oversDec(r.ballsFaced) > 0 ? r.runsFor / oversDec(r.ballsFaced) : 0
  const ra = oversDec(r.ballsBowled) > 0 ? r.runsAgainst / oversDec(r.ballsBowled) : 0
  return Number((rf - ra).toFixed(3))
}

export function computeGroupStandings(config: TournamentConfig, results: MatchResult[]): GroupStandings[] {
  const groupIdByTeam = new Map<string, string>()
  config.groups.forEach((g) => (g.squadIds || []).forEach((sid) => groupIdByTeam.set(sid, g.id)))

  const points = config.points

  const rows = new Map<string, StandingRow>() // key: `${groupId}:${squadId}`

  const ensure = (groupId: string, squadId: string): StandingRow => {
    const key = `${groupId}:${squadId}`
    if (!rows.has(key)) {
      rows.set(key, {
        squadId,
        groupId,
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        noResult: 0,
        points: 0,
        runsFor: 0,
        ballsFaced: 0,
        runsAgainst: 0,
        ballsBowled: 0,
        nrr: 0,
      })
    }
    return rows.get(key)!
  }

  // initialize all teams
  config.groups.forEach((g) => (g.squadIds || []).forEach((sid) => ensure(g.id, sid)))

  const apply = (r: StandingRow, patch: Partial<StandingRow>) => {
    r.played += safe(patch.played)
    r.won += safe(patch.won)
    r.lost += safe(patch.lost)
    r.tied += safe(patch.tied)
    r.noResult += safe(patch.noResult)
    r.points += safe(patch.points)
    r.runsFor += safe(patch.runsFor)
    r.ballsFaced += safe(patch.ballsFaced)
    r.runsAgainst += safe(patch.runsAgainst)
    r.ballsBowled += safe(patch.ballsBowled)
  }

  results.forEach((m) => {
    const gA = m.groupA || groupIdByTeam.get(m.teamA) || ''
    const gB = m.groupB || groupIdByTeam.get(m.teamB) || ''
    if (!gA || !gB) return
    // For group stage standings, only count matches within same group.
    if (gA !== gB) return

    const a = ensure(gA, m.teamA)
    const b = ensure(gB, m.teamB)

    // NRR aggregates for both sides
    apply(a, { played: 1, runsFor: m.teamARunsFor, ballsFaced: m.teamABallsFaced, runsAgainst: m.teamARunsAgainst, ballsBowled: m.teamABallsBowled })
    apply(b, { played: 1, runsFor: m.teamARunsAgainst, ballsFaced: m.teamABallsBowled, runsAgainst: m.teamARunsFor, ballsBowled: m.teamABallsFaced })

    // points + W/L/T/NR
    if (m.result === 'win') {
      apply(a, { won: 1, points: points.win })
      apply(b, { lost: 1, points: points.loss })
    } else if (m.result === 'loss') {
      apply(a, { lost: 1, points: points.loss })
      apply(b, { won: 1, points: points.win })
    } else if (m.result === 'tie') {
      apply(a, { tied: 1, points: points.tie })
      apply(b, { tied: 1, points: points.tie })
    } else {
      apply(a, { noResult: 1, points: points.noResult })
      apply(b, { noResult: 1, points: points.noResult })
    }
  })

  // finalize NRR
  rows.forEach((r) => (r.nrr = computeNRR(r)))

  // group
  const out: GroupStandings[] = []
  config.groups.forEach((g) => {
    const groupRows = (g.squadIds || []).map((sid) => rows.get(`${g.id}:${sid}`)!).filter(Boolean)
    const ranked = rankRows(config, groupRows, results, g.id)
    out.push({ groupId: g.id, rows: ranked })
  })
  return out
}

export function rankRows(
  config: TournamentConfig,
  rows: StandingRow[],
  results: MatchResult[],
  groupId: string
): StandingRow[] {
  const order = config.ranking.order

  // quick comparator for non-H2H tie breakers
  const cmp = (a: StandingRow, b: StandingRow, key: Exclude<RankingTieBreaker, 'head_to_head'>) => {
    if (key === 'points') return b.points - a.points
    if (key === 'nrr') return b.nrr - a.nrr
    if (key === 'wins') return b.won - a.won
    return 0
  }

  // Mini-table for head-to-head among a set of tied teams (points only + NRR is expensive; we use points+wins)
  const headToHeadScore = (teamA: string, teamB: string): number => {
    // Return +1 if A beat B, -1 if lost, 0 otherwise
    for (const m of results) {
      const gA = m.groupA || ''
      if (gA !== groupId) continue
      if (!((m.teamA === teamA && m.teamB === teamB) || (m.teamA === teamB && m.teamB === teamA))) continue
      if (m.teamA === teamA) {
        if (m.result === 'win') return 1
        if (m.result === 'loss') return -1
      } else {
        // teamB is teamA in record
        if (m.result === 'win') return -1
        if (m.result === 'loss') return 1
      }
    }
    return 0
  }

  const stableName = (r: StandingRow) => `${r.groupId}:${r.squadId}`

  const sorted = [...rows].sort((a, b) => stableName(a).localeCompare(stableName(b)))

  // Apply tie-breakers in order; for head-to-head, handle only when prior keys are equal
  sorted.sort((a, b) => {
    for (const k of order) {
      if (k === 'head_to_head') {
        const h = headToHeadScore(a.squadId, b.squadId)
        if (h !== 0) return -h // A beat B => A ranks higher => return -1
        continue
      }
      const d = cmp(a, b, k as any)
      if (d !== 0) return d
    }
    return 0
  })

  return sorted
}


