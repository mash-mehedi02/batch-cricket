/**
 * BatchCrick BD - Knockout Generator
 * Supports:
 * - auto pairing: high vs low, cross-group, avoid same-group
 * - custom mapping: seed labels like "senior:1 vs group-b:3"
 */

import type {
  Bracket,
  BracketMatch,
  KnockoutConfig,
  KnockoutMatchSpec,
  KnockoutRound,
  QualificationSlot,
  SeedLabel,
  TournamentConfig,
  ValidationIssue,
} from './types'
import { buildSeedIndex } from './qualification'
import { getAuth } from 'firebase/auth'
import { auth } from '@/config/firebase'

const err = (code: string, message: string, path?: string): ValidationIssue => ({ severity: 'error', code, message, path })

export function generateKnockoutBracket(config: TournamentConfig, slots: QualificationSlot[]): { bracket: Bracket | null; errors: ValidationIssue[] } {
  const errors: ValidationIssue[] = []
  const k = config.knockout
  if (!k) return { bracket: null, errors: [err('KNOCKOUT_MISSING', 'Knockout config missing.', 'knockout')] }

  const seedIndex = buildSeedIndex(slots)

  if (k.mode === 'custom_mapping') {
    const specs = k.custom?.matches || []
    const validation = validateCustomMapping(specs, seedIndex)
    if (validation.length) return { bracket: null, errors: validation }
    return {
      bracket: {
        mode: 'custom_mapping',
        rounds: k.rounds,
        matches: specs.map((m) => toBracketMatch(m, seedIndex)),
      },
      errors: [],
    }
  }

  // Auto mode: generate first round only (next rounds can be generated after results)
  const auto = k.auto || {}
  const avoidSameGroup = auto.avoidSameGroup !== false
  const crossGroup = auto.crossGroupPairing !== false
  const highVsLow = auto.highVsLow !== false

  const firstRound: KnockoutRound = k.rounds[0] || 'semi_final'
  const teams = slots.filter((s) => s.groupId !== 'overall')

  // Build seeding order: per-group ranks. WinnerPriority: treat group winners first
  const winnersFirst: QualificationSlot[] = []
  const rest: QualificationSlot[] = []
  teams.forEach((s) => (s.rank === 1 ? winnersFirst.push(s) : rest.push(s)))
  const ordered = [...winnersFirst, ...rest]
  if (!highVsLow) {
    // keep input order
  } else {
    // already roughly high to low due to rank
  }

  // Pair high vs low
  const paired: Array<[QualificationSlot, QualificationSlot]> = []
  const pool = [...ordered]
  while (pool.length >= 2) {
    const a = pool.shift()!
    let bIndex = pool.length - 1
    let b = pool[bIndex]
    if (avoidSameGroup || crossGroup) {
      // try find best compatible opponent from end
      for (let i = pool.length - 1; i >= 0; i--) {
        const cand = pool[i]
        const sameGroup = cand.groupId === a.groupId
        if (avoidSameGroup && sameGroup) continue
        if (crossGroup && sameGroup) continue
        bIndex = i
        b = cand
        break
      }
    }
    pool.splice(bIndex, 1)
    paired.push([a, b])
  }

  const matches: BracketMatch[] = paired.map(([a, b], idx) => ({
    id: `ko:${firstRound}:${idx + 1}`,
    round: firstRound,
    teamASeed: a.seedLabel,
    teamBSeed: b.seedLabel,
    teamASquadId: a.squadId,
    teamBSquadId: b.squadId,
  }))

  return { bracket: { mode: 'auto', rounds: k.rounds, matches }, errors }
}

function toBracketMatch(spec: KnockoutMatchSpec, seedIndex: Map<SeedLabel, string>): BracketMatch {
  return {
    id: spec.id,
    round: spec.round,
    teamASeed: spec.a,
    teamBSeed: spec.b,
    teamASquadId: seedIndex.get(spec.a),
    teamBSquadId: seedIndex.get(spec.b),
  }
}

export function validateCustomMapping(specs: KnockoutMatchSpec[], seedIndex: Map<SeedLabel, string>): ValidationIssue[] {
  const errors: ValidationIssue[] = []
  const usedSeeds = new Set<string>()
  specs.forEach((m, idx) => {
    const base = `knockout.custom.matches[${idx}]`
    if (!m.id) errors.push(err('KO_MATCH_ID', 'Match id is required.', `${base}.id`))
    if (!m.a || !m.b) errors.push(err('KO_SEED_MISSING', 'Both seed labels are required.', base))
    if (m.a === m.b) errors.push(err('KO_SEED_DUP', 'A and B cannot be the same seed.', base))
    ;[m.a, m.b].forEach((s) => {
      if (!s) return
      if (usedSeeds.has(s)) errors.push(err('KO_SEED_REUSED', `Seed "${s}" is used multiple times.`, base))
      usedSeeds.add(s)
      // If we already know seeds, validate existence. If not present, allow (will resolve later).
      if (seedIndex.size > 0 && !seedIndex.has(s)) {
        errors.push(err('KO_SEED_UNKNOWN', `Unknown seed "${s}".`, base))
      }
    })
  })
  return errors
}

export async function generateKnockoutFixtures(tournamentId: string): Promise<void> {
  try {
    // Call the backend API to generate knockout fixtures based on group results
    // Get the Firebase authentication token
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error('Authentication token not found');
    }
    
    const response = await fetch(`/api/tournaments/${tournamentId}/seed-knockout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to generate knockout fixtures');
    }
    
    const result = await response.json();
    console.log('Knockout fixtures generated successfully:', result);
  } catch (error) {
    console.error('Error generating knockout fixtures:', error);
    throw error;
  }
}

