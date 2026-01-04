/**
 * Not Out Detection Module
 * Determines if a player's innings ended with "not out" status
 */

import { WICKET_TYPES } from './iccDefinitions'

export interface MatchContext {
  inningsComplete?: boolean
  targetReached?: boolean
  oversComplete?: boolean
  allOut?: boolean
  matchAbandoned?: boolean
}

export interface PlayerInnings {
  runs?: number
  balls?: number
  notOut?: boolean
  dismissed?: boolean
  wicketType?: string
  status?: string
  retiredHurt?: boolean
}

/**
 * ICC Rule: Determine if player is Not Out
 * 
 * A player is NOT OUT if:
 * 1. Innings ended (target chased, overs finished, partner got out)
 * 2. Retired hurt
 * 3. Match abandoned
 * 4. Explicitly marked as not out
 */
export function detectNotOut(
  playerInnings: PlayerInnings,
  matchContext: MatchContext
): boolean {
  // Explicitly marked as not out
  if (playerInnings.notOut === true) return true
  
  // Explicitly dismissed
  if (playerInnings.dismissed === true || playerInnings.notOut === false) return false
  
  // Has wicket type
  if (playerInnings.wicketType) {
    // Retired hurt is not out
    if (playerInnings.wicketType === WICKET_TYPES.RETIRED_HURT) return true
    if (playerInnings.retiredHurt === true) return true
    // All other wicket types = dismissed
    return false
  }
  
  // Match abandoned = not out
  if (matchContext.matchAbandoned === true) return true
  
  // If innings completed but player wasn't dismissed
  if (matchContext.inningsComplete === true && !playerInnings.wicketType) {
    // Check if target was reached (chase completed)
    if (matchContext.targetReached === true) return true
    
    // Check if overs completed
    if (matchContext.oversComplete === true) return true
    
    // Check if all out (last partner got out)
    if (matchContext.allOut === true) return true
    
    // Innings ended for other reason = not out
    return true
  }
  
  // If player has runs/balls but no dismissal = not out
  if ((playerInnings.runs || 0) > 0 || (playerInnings.balls || 0) > 0) {
    if (!playerInnings.wicketType && playerInnings.dismissed !== true) {
      return true
    }
  }
  
  // Default: if no clear indication, assume not out
  return true
}

/**
 * Get not out status from match summary
 */
export function getNotOutFromSummary(matchSummary: {
  notOut?: boolean
  dismissed?: boolean
  wicketType?: string
  status?: string
  retiredHurt?: boolean
}): boolean {
  // Explicit flags
  if (matchSummary.notOut === true) return true
  if (matchSummary.dismissed === true || matchSummary.notOut === false) return false
  
  // Wicket type
  if (matchSummary.wicketType) {
    if (matchSummary.wicketType === WICKET_TYPES.RETIRED_HURT) return true
    if (matchSummary.retiredHurt === true) return true
    return false
  }
  
  // Status field
  if (matchSummary.status === 'not out' || matchSummary.status === 'not-out') return true
  if (matchSummary.status === 'out' || matchSummary.status === 'dismissed') return false
  
  // Default: assume not out if no dismissal info
  return true
}

