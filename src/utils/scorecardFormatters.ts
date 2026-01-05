/**
 * Scorecard Formatter Utilities
 * Formatting functions for scorecard display
 */

/**
 * Format overs (e.g., "3.2" or "12.5")
 */
export function formatOvers(overs: string | number): string {
  if (typeof overs === 'number') {
    const overPart = Math.floor(overs)
    const ballPart = Math.round((overs - overPart) * 10)
    return `${overPart}.${ballPart}`
  }

  if (typeof overs === 'string') {
    // Validate format (e.g., "3.2")
    const parts = overs.split('.')
    if (parts.length === 2) {
      const overPart = parseInt(parts[0], 10) || 0
      const ballPart = parseInt(parts[1], 10) || 0
      if (ballPart >= 0 && ballPart <= 5) {
        return `${overPart}.${ballPart}`
      }
    }
    return overs
  }

  return '0.0'
}

/**
 * Format dismissal text
 * Example: "c Carey b Starc" or "b Starc" or "run out (Smith)"
 */
export function formatDismissal(
  dismissalType: string,
  dismissedBy?: string,
  bowler?: string,
  fielder?: string
): string {
  if (!dismissalType) return ''

  const type = dismissalType.toLowerCase().trim()

  // Bowled
  if (type.includes('bowled') || type === 'b') {
    return bowler ? `b ${bowler}` : 'b'
  }

  // Caught
  if (type.includes('caught') || type === 'c') {
    if (fielder && bowler) {
      return `c ${fielder} b ${bowler}`
    }
    if (fielder) {
      return `c ${fielder}`
    }
    if (bowler) {
      return `c & b ${bowler}`
    }
    return 'c'
  }

  // Caught & Bowled
  if (type.includes('caught & bowled') || type === 'c&b') {
    return bowler ? `c & b ${bowler}` : 'c & b'
  }

  // LBW
  if (type.includes('lbw') || type === 'lbw') {
    return bowler ? `lbw b ${bowler}` : 'lbw'
  }

  // Stumped
  if (type.includes('stumped') || type === 'st') {
    if (fielder && bowler) {
      return `st ${fielder} b ${bowler}`
    }
    if (fielder) {
      return `st ${fielder}`
    }
    return 'st'
  }

  // Run Out
  if (type.includes('run out') || type.includes('runout') || type === 'ro') {
    if (fielder) {
      return `run out (${fielder})`
    }
    return 'run out'
  }

  // Hit Wicket
  if (type.includes('hit wicket') || type === 'hw') {
    return bowler ? `hit wicket b ${bowler}` : 'hit wicket'
  }

  // Return original if no match
  return dismissalType
}

/**
 * Format extras breakdown
 * Example: "7 (4b, 3lb)" or "12 (5wd, 4nb, 2b, 1lb)"
 */
export function formatExtras(extras: {
  byes?: number
  legByes?: number
  wides?: number
  noBalls?: number
  penalty?: number
}): string {
  const parts: string[] = []

  if (extras.byes && extras.byes > 0) {
    parts.push(`${extras.byes}b`)
  }
  if (extras.legByes && extras.legByes > 0) {
    parts.push(`${extras.legByes}lb`)
  }
  if (extras.wides && extras.wides > 0) {
    parts.push(`${extras.wides}wd`)
  }
  if (extras.noBalls && extras.noBalls > 0) {
    parts.push(`${extras.noBalls}nb`)
  }
  if (extras.penalty && extras.penalty > 0) {
    parts.push(`${extras.penalty}pen`)
  }

  const total = (extras.byes || 0) +
    (extras.legByes || 0) +
    (extras.wides || 0) +
    (extras.noBalls || 0) +
    (extras.penalty || 0)

  if (parts.length === 0) {
    return '0'
  }

  return `${total} (${parts.join(', ')})`
}

/**
 * Format strike rate
 */
export function formatStrikeRate(strikeRate: number): string {
  if (!Number.isFinite(strikeRate)) return '0.00'
  return strikeRate.toFixed(2)
}

/**
 * Format economy rate
 */
export function formatEconomy(economy: number): string {
  if (!Number.isFinite(economy)) return '0.00'
  return economy.toFixed(2)
}

