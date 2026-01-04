/**
 * BatchCrick BD - Qualification Engine
 * Select qualified teams per-group + optional overall wildcards.
 */

import type { TournamentConfig, GroupStandings, QualificationResult, QualificationSlot, SeedLabel, StandingRow } from './types'

const seed = (groupId: string, rank: number): SeedLabel => `${groupId}:${rank}`
const overallSeed = (rank: number): SeedLabel => `overall:${rank}`

export function computeQualification(config: TournamentConfig, standings: GroupStandings[]): QualificationResult {
  const qualified: QualificationSlot[] = []

  const groupMap = new Map<string, StandingRow[]>()
  standings.forEach((g) => groupMap.set(g.groupId, g.rows))

  config.groups.forEach((g) => {
    const rows = groupMap.get(g.id) || []
    const count = Math.max(0, g.qualification?.qualifyCount || 0)
    const top = rows.slice(0, count)
    top.forEach((r, idx) => {
      qualified.push({
        groupId: g.id,
        rank: idx + 1,
        seedLabel: seed(g.id, idx + 1),
        squadId: r.squadId,
      })
    })
  })

  // Wildcards from overall standings (across groups)
  const wildcards: QualificationSlot[] = []
  const wc = Math.max(0, config.wildcards?.count || 0)
  if (wc > 0) {
    const all = standings.flatMap((g) => g.rows)
    const taken = new Set(qualified.map((q) => q.squadId))
    const overall = all.filter((r) => !taken.has(r.squadId))
    // overall is expected pre-ranked in each group; we need a global comparator.
    overall.sort((a, b) => b.points - a.points || b.nrr - a.nrr || b.won - a.won)
    overall.slice(0, wc).forEach((r, idx) => {
      wildcards.push({
        groupId: 'overall',
        rank: idx + 1,
        seedLabel: overallSeed(idx + 1),
        squadId: r.squadId,
      })
    })
  }

  const allSlots = [...qualified, ...wildcards]
  return { qualified, wildcards, allSlots }
}

export function buildSeedIndex(slots: QualificationSlot[]): Map<SeedLabel, string> {
  const map = new Map<SeedLabel, string>()
  slots.forEach((s) => map.set(s.seedLabel, s.squadId))
  return map
}


