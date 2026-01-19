/**
 * BatchCrick BD - Fixture Generator (Group Stage)
 * - round_robin: single round robin
 * - single_match: requires custom match list (admin)
 * - custom: placeholder for future complex formats
 */

import type { GroupConfig, TournamentConfig, ValidationIssue } from './types'

export type FixtureMatch = {
  id: string
  stage: 'group'
  groupId: string
  home: string // squadId
  away: string // squadId
  // Admin editable scheduling fields (not set here)
  date?: string
  time?: string
  venue?: string
}

export type FixturePlan = {
  matches: FixtureMatch[]
  warnings: ValidationIssue[]
}

const warn = (code: string, message: string, path?: string): ValidationIssue => ({ severity: 'warning', code, message, path })

export function generateGroupFixtures(config: TournamentConfig): FixturePlan {
  const warnings: ValidationIssue[] = []
  const matches: FixtureMatch[] = []

  config.groups.forEach((g) => {
    if (g.roundFormat === 'round_robin') {
      matches.push(...roundRobin(g))
    } else if (g.roundFormat === 'single_match') {
      warnings.push(warn('FIXTURES_SINGLE_MATCH', `Group "${g.name}" uses single_match. Admin must create fixtures manually.`, `groups.${g.id}`))
    } else {
      warnings.push(warn('FIXTURES_CUSTOM', `Group "${g.name}" uses custom format. Admin must create fixtures manually.`, `groups.${g.id}`))
    }
  })

  return { matches, warnings }
}

// Note: generateTournamentFixtures is not implemented as a standalone function.
// The fixture generation logic is implemented in the AdminTournaments component.

function roundRobin(group: GroupConfig): FixtureMatch[] {
  const teams = (group.squadIds || []).filter(Boolean)
  const out: FixtureMatch[] = []
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const a = teams[i]
      const b = teams[j]
      out.push({
        id: `g:${group.id}:${a}:${b}`,
        stage: 'group',
        groupId: group.id,
        home: a,
        away: b,
      })
    }
  }
  return out
}


