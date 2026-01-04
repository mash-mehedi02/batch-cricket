/**
 * BatchCrick BD - Tournament Engine Validation
 * Enforces config correctness, prevents invalid/harmful setups.
 */

import type {
  TournamentConfig,
  ValidationIssue,
  ValidationResult,
  GroupConfig,
  KnockoutConfig,
} from './types'

const err = (code: string, message: string, path?: string): ValidationIssue => ({ severity: 'error', code, message, path })
const warn = (code: string, message: string, path?: string): ValidationIssue => ({ severity: 'warning', code, message, path })

const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)))

export function validateTournamentConfig(config: TournamentConfig): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  if (!config || config.version !== 1) {
    errors.push(err('CONFIG_VERSION', 'Unsupported or missing tournament config version.', 'version'))
    return { ok: false, errors, warnings }
  }

  if (!Number.isFinite(config.year) || config.year < 1900) {
    errors.push(err('YEAR_INVALID', 'Tournament year is invalid.', 'year'))
  }

  if (!config.points) {
    errors.push(err('POINTS_RULES_MISSING', 'Points rules are required.', 'points'))
  } else {
    ;(['win', 'loss', 'tie', 'noResult'] as const).forEach((k) => {
      const v = (config.points as any)[k]
      if (!Number.isFinite(v)) errors.push(err('POINTS_RULE_INVALID', `Points.${k} must be a number.`, `points.${k}`))
    })
  }

  if (!config.ranking?.order?.length) {
    errors.push(err('RANKING_RULES_MISSING', 'Ranking rule order is required.', 'ranking.order'))
  }

  if (!Array.isArray(config.groups) || config.groups.length === 0) {
    errors.push(err('GROUPS_MISSING', 'At least one group must be defined.', 'groups'))
  } else {
    validateGroups(config.groups, errors, warnings)
  }

  // Qualification totals sanity
  const totalQualifiedFromGroups = (config.groups || []).reduce((acc, g) => acc + Math.max(0, g.qualification?.qualifyCount || 0), 0)
  const wildcardCount = Math.max(0, config.wildcards?.count || 0)
  const totalQualified = totalQualifiedFromGroups + wildcardCount
  if (totalQualified < 2) {
    warnings.push(warn('QUALIFICATION_TOO_SMALL', 'Less than 2 teams qualify. Knockout cannot be generated.', 'wildcards'))
  }

  // Knockout sanity
  if (config.stage === 'knockout') {
    if (!config.knockout) {
      errors.push(err('KNOCKOUT_MISSING', 'Knockout config required when stage=knockout.', 'knockout'))
    } else {
      validateKnockout(config.knockout, totalQualified, errors, warnings)
    }
  } else if (config.knockout?.includeThirdPlace) {
    warnings.push(warn('THIRD_PLACE_IGNORED', 'Third place match is configured but stage is not knockout.', 'knockout.includeThirdPlace'))
  }

  // Locks
  if (config.locks?.knockoutLocked && config.stage !== 'knockout') {
    warnings.push(warn('LOCK_STATE', 'Knockout is locked but stage is not knockout.', 'locks.knockoutLocked'))
  }

  return { ok: errors.length === 0, errors, warnings }
}

function validateGroups(groups: GroupConfig[], errors: ValidationIssue[], warnings: ValidationIssue[]) {
  const ids = groups.map((g) => g.id)
  if (uniq(ids).length !== ids.length) {
    errors.push(err('GROUP_ID_DUP', 'Group IDs must be unique.', 'groups'))
  }

  groups.forEach((g, idx) => {
    const base = `groups[${idx}]`
    if (!g.id) errors.push(err('GROUP_ID_MISSING', 'Group id is required.', `${base}.id`))
    if (!g.name) errors.push(err('GROUP_NAME_MISSING', 'Group name is required.', `${base}.name`))
    if (!Number.isFinite(g.teamCount) || g.teamCount <= 1) errors.push(err('GROUP_TEAMCOUNT_INVALID', 'Group teamCount must be > 1.', `${base}.teamCount`))
    if (!g.qualification) errors.push(err('GROUP_QUAL_MISSING', 'Group qualification rule required.', `${base}.qualification`))
    else {
      const qc = Math.max(0, g.qualification.qualifyCount || 0)
      if (qc > g.teamCount) errors.push(err('GROUP_QUAL_TOO_HIGH', 'qualifyCount cannot exceed teamCount.', `${base}.qualification.qualifyCount`))
      if (Array.isArray(g.qualification.rankLabels) && g.qualification.rankLabels.length && g.qualification.rankLabels.length !== qc) {
        warnings.push(warn('QUAL_LABELS_MISMATCH', 'rankLabels length does not match qualifyCount.', `${base}.qualification.rankLabels`))
      }
    }

    const squads = Array.isArray(g.squadIds) ? g.squadIds.filter(Boolean) : []
    if (squads.length !== uniq(squads).length) errors.push(err('GROUP_DUP_TEAM', 'Duplicate teams in group.', `${base}.squadIds`))
    if (squads.length !== g.teamCount) {
      warnings.push(warn('GROUP_TEAMCOUNT_MISMATCH', `Assigned teams (${squads.length}) != teamCount (${g.teamCount}).`, `${base}.squadIds`))
    }
  })

  // Team cannot appear in multiple groups
  const allTeams = groups.flatMap((g) => g.squadIds || []).filter(Boolean)
  const seen = new Set<string>()
  const dup: string[] = []
  allTeams.forEach((t) => {
    if (seen.has(t)) dup.push(t)
    else seen.add(t)
  })
  if (dup.length) errors.push(err('TEAM_MULTI_GROUP', 'A team cannot be assigned to multiple groups.', 'groups'))
}

function validateKnockout(knockout: KnockoutConfig, totalQualified: number, errors: ValidationIssue[], warnings: ValidationIssue[]) {
  if (!Array.isArray(knockout.rounds) || knockout.rounds.length === 0) {
    errors.push(err('KNOCKOUT_ROUNDS_MISSING', 'At least one knockout round must be configured.', 'knockout.rounds'))
  }

  if (knockout.mode === 'custom_mapping') {
    const matches = knockout.custom?.matches || []
    if (!matches.length) errors.push(err('KNOCKOUT_CUSTOM_EMPTY', 'Custom mapping requires matches.', 'knockout.custom.matches'))
    const ids = matches.map((m) => m.id)
    if (uniq(ids).length !== ids.length) errors.push(err('KNOCKOUT_MATCH_ID_DUP', 'Knockout match IDs must be unique.', 'knockout.custom.matches'))
    matches.forEach((m, idx) => {
      const base = `knockout.custom.matches[${idx}]`
      if (!m.round) errors.push(err('KNOCKOUT_MATCH_ROUND', 'Match round required.', `${base}.round`))
      if (!m.a || !m.b) errors.push(err('KNOCKOUT_MATCH_SEEDS', 'Both seeds required.', base))
      if (m.a === m.b) errors.push(err('KNOCKOUT_MATCH_SAME_SEED', 'A and B seeds cannot be same.', base))
    })
    if (matches.length > totalQualified / 2 + 2) {
      warnings.push(warn('KNOCKOUT_MATCH_COUNT', 'Custom matches count seems larger than expected for qualified teams.', 'knockout.custom.matches'))
    }
  } else if (knockout.mode === 'auto') {
    if (knockout.auto?.highVsLow === false) {
      warnings.push(warn('AUTO_PAIRING_FAIRNESS', 'Auto pairing is not high-vs-low; bracket fairness may reduce.', 'knockout.auto.highVsLow'))
    }
  } else {
    errors.push(err('KNOCKOUT_MODE_INVALID', 'Invalid knockout mode.', 'knockout.mode'))
  }
}


