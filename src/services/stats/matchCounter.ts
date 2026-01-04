/**
 * Match Counter Module
 * ICC-Compliant match counting logic
 */

import { shouldCountMatch } from './iccDefinitions'

export interface MatchData {
  id?: string
  matchId?: string
  status?: string
  playingXI?: string[]
  teamAPlayingXI?: string[]
  teamBPlayingXI?: string[]
  played?: boolean
}

/**
 * Count matches for a player based on ICC rules
 * 
 * ICC Rule: Match counts if:
 * 1. Match status is "live" or "finished"
 * 2. Player is in Playing XI
 */
export function countMatches(
  matches: MatchData[],
  playerId: string
): number {
  if (!matches || !Array.isArray(matches)) return 0
  
  return matches.filter((match) => {
    // Check if match should count
    if (!shouldCountMatch(match, playerId)) return false
    
    // Additional check: played flag
    if (match.played === false) return false
    
    return true
  }).length
}

/**
 * Check if a specific match should count for a player
 */
export function shouldMatchCount(
  match: MatchData,
  playerId: string
): boolean {
  return shouldCountMatch(match, playerId) && match.played !== false
}

/**
 * Get matches that count for a player
 */
export function getCountedMatches(
  matches: MatchData[],
  playerId: string
): MatchData[] {
  if (!matches || !Array.isArray(matches)) return []
  
  return matches.filter((match) => shouldMatchCount(match, playerId))
}

