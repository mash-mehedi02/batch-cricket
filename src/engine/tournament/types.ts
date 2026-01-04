/**
 * BatchCrick BD - Tournament Engine Types
 * Config-driven tournament structure supporting standard + custom/hybrid formats.
 */

export type TournamentKind = 'standard' | 'custom'

export type GroupType = 'normal' | 'priority'

export type RoundFormat = 'round_robin' | 'single_match' | 'custom'

export type RankingTieBreaker = 'points' | 'nrr' | 'head_to_head' | 'wins'

export type PointsRule = {
  win: number
  tie: number
  noResult: number
  loss: number
}

export type RankingRule = {
  // Order matters
  order: RankingTieBreaker[]
}

export type GroupQualificationRule = {
  qualifyCount: number
  // Labels for qualified slots (e.g. ["1st","2nd"])
  rankLabels?: string[]
  // If true, group winner is treated as "priority seed" in knockout auto pairing
  winnerPriority?: boolean
}

export type GroupConfig = {
  id: string // stable key
  name: string // "Senior", "Group A"
  type: GroupType
  teamCount: number
  roundFormat: RoundFormat
  // teams assigned to this group (squadIds)
  squadIds: string[]
  qualification: GroupQualificationRule
}

export type TournamentStage = 'group' | 'knockout'

export type KnockoutRound =
  | 'round_of_16'
  | 'quarter_final'
  | 'semi_final'
  | 'final'
  | 'third_place'

export type KnockoutMode = 'auto' | 'custom_mapping'

/**
 * Seed label format:
 * - "{GroupId}:{Rank}" e.g. "group-a:1", "senior:2"
 * - "overall:{Rank}" e.g. "overall:1" (wildcards / overall table)
 */
export type SeedLabel = string

export type KnockoutMatchSpec = {
  id: string
  round: KnockoutRound
  // Seed labels define which qualified team fills which slot
  a: SeedLabel
  b: SeedLabel
  // Constraints
  avoidSameGroup?: boolean
}

export type KnockoutConfig = {
  mode: KnockoutMode
  rounds: KnockoutRound[] // ordered progression
  // Auto mode options
  auto?: {
    crossGroupPairing?: boolean
    avoidSameGroup?: boolean
    highVsLow?: boolean
  }
  // Custom mapping (admin-defined)
  custom?: {
    matches: KnockoutMatchSpec[]
  }
  includeThirdPlace?: boolean
}

export type TournamentConfig = {
  version: 1
  kind: TournamentKind
  season?: string // "Season-2"
  year: number
  stage: TournamentStage
  points: PointsRule
  ranking: RankingRule
  groups: GroupConfig[]
  // Optional global qualification controls (e.g. wildcard spots from overall table)
  wildcards?: {
    count: number
    method: 'overall'
  }
  knockout?: KnockoutConfig
  locks?: {
    // prevents structural edits once true
    groupsLocked?: boolean
    fixturesLocked?: boolean
    knockoutLocked?: boolean
  }
}

export type ValidationSeverity = 'error' | 'warning'

export type ValidationIssue = {
  severity: ValidationSeverity
  code: string
  message: string
  path?: string
}

export type ValidationResult = {
  ok: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

export type TeamResult = 'win' | 'loss' | 'tie' | 'no_result'

export type MatchResult = {
  matchId: string
  tournamentId: string
  // Squad IDs
  teamA: string
  teamB: string
  // Optional group IDs (when known)
  groupA?: string
  groupB?: string
  // Result + NRR inputs
  result: TeamResult
  // "for" teamA perspective
  teamARunsFor: number
  teamABallsFaced: number
  teamARunsAgainst: number
  teamABallsBowled: number
}

export type StandingRow = {
  squadId: string
  groupId: string
  played: number
  won: number
  lost: number
  tied: number
  noResult: number
  points: number
  runsFor: number
  ballsFaced: number
  runsAgainst: number
  ballsBowled: number
  nrr: number
}

export type GroupStandings = {
  groupId: string
  rows: StandingRow[]
}

export type QualificationSlot = {
  groupId: string
  rank: number
  seedLabel: SeedLabel
  squadId: string
}

export type QualificationResult = {
  qualified: QualificationSlot[]
  wildcards: QualificationSlot[]
  allSlots: QualificationSlot[]
}

export type BracketMatch = {
  id: string
  round: KnockoutRound
  // resolved squad IDs (or empty if unknown)
  teamASeed: SeedLabel
  teamBSeed: SeedLabel
  teamASquadId?: string
  teamBSquadId?: string
}

export type Bracket = {
  mode: KnockoutMode
  rounds: KnockoutRound[]
  matches: BracketMatch[]
}


