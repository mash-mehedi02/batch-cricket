/**
 * Format Helpers for Cricket Scorecard
 * CREX-style formatting utilities
 */

/**
 * Format overs (ICC Standard)
 * @param {string|number} overs - Overs value (e.g., "13.4" or 13.67)
 * @returns {string} - Formatted overs (e.g., "13.4")
 */
export function formatOvers(overs) {
  if (typeof overs === 'number') {
    const wholeOvers = Math.floor(overs)
    const balls = Math.round((overs - wholeOvers) * 6)
    return `${wholeOvers}.${balls}`
  }
  if (typeof overs === 'string') {
    // Validate format
    const parts = overs.split('.')
    if (parts.length === 2) {
      const whole = parseInt(parts[0]) || 0
      const balls = parseInt(parts[1]) || 0
      if (balls >= 0 && balls <= 5) {
        return `${whole}.${balls}`
      }
    }
    return overs
  }
  return '0.0'
}

/**
 * Format dismissal text (e.g., "c Feroza b Hani")
 * @param {string} dismissalType - Dismissal type
 * @param {string} bowlerName - Bowler name
 * @param {string} fielderName - Fielder name (optional)
 * @returns {string} - Formatted dismissal text
 */
export function formatDismissal(dismissalType, bowlerName = '', fielderName = '') {
  if (!dismissalType) return ''
  
  const type = dismissalType.toLowerCase().trim()
  const bowler = bowlerName.trim()
  const fielder = fielderName.trim()
  
  // Extract first name from full name
  const getFirstName = (name) => {
    if (!name) return ''
    return name.trim().split(' ')[0]
  }
  
  const bowlerFirst = getFirstName(bowler)
  const fielderFirst = getFirstName(fielder)
  
  // Bowled
  if (type.includes('bowled') || type === 'b') {
    return bowlerFirst ? `b ${bowlerFirst}` : 'b'
  }
  
  // Caught
  if (type.includes('caught') || type === 'c') {
    if (fielderFirst && bowlerFirst) {
      return `c ${fielderFirst} b ${bowlerFirst}`
    }
    if (fielderFirst) {
      return `c ${fielderFirst}`
    }
    if (bowlerFirst) {
      return `c & b ${bowlerFirst}`
    }
    return 'c'
  }
  
  // Caught & Bowled
  if (type.includes('caught & bowled') || type === 'c&b') {
    return bowlerFirst ? `c & b ${bowlerFirst}` : 'c & b'
  }
  
  // LBW
  if (type.includes('lbw') || type === 'lbw') {
    return bowlerFirst ? `lbw b ${bowlerFirst}` : 'lbw'
  }
  
  // Stumped
  if (type.includes('stumped') || type === 'st') {
    if (fielderFirst && bowlerFirst) {
      return `st ${fielderFirst} b ${bowlerFirst}`
    }
    if (fielderFirst) {
      return `st ${fielderFirst}`
    }
    return 'st'
  }
  
  // Run Out
  if (type.includes('run out') || type.includes('runout') || type === 'ro') {
    if (fielderFirst) {
      return `run out (${fielderFirst})`
    }
    return 'run out'
  }
  
  // Hit Wicket
  if (type.includes('hit wicket') || type === 'hw') {
    return bowlerFirst ? `hit wicket b ${bowlerFirst}` : 'hit wicket'
  }
  
  // Return original if no match
  return dismissalType
}

/**
 * Format extras breakdown
 * @param {Object} extras - Extras object
 * @returns {string} - Formatted extras (e.g., "8 (b 0, lb 1, w 7, nb 0, p 0)")
 */
export function formatExtras(extras) {
  if (!extras) return '0'
  
  const byes = extras.byes || 0
  const legByes = extras.legByes || 0
  const wides = extras.wides || 0
  const noBalls = extras.noBalls || 0
  const penalty = extras.penalty || 0
  
  const total = byes + legByes + wides + noBalls + penalty
  
  if (total === 0) return '0'
  
  const parts = []
  if (byes > 0) parts.push(`b ${byes}`)
  if (legByes > 0) parts.push(`lb ${legByes}`)
  if (wides > 0) parts.push(`w ${wides}`)
  if (noBalls > 0) parts.push(`nb ${noBalls}`)
  if (penalty > 0) parts.push(`p ${penalty}`)
  
  return `${total} (${parts.join(', ')})`
}

/**
 * Format strike rate
 * @param {number} runs - Runs scored
 * @param {number} balls - Balls faced
 * @returns {string} - Formatted strike rate (e.g., "68.63")
 */
export function formatStrikeRate(runs, balls) {
  if (!balls || balls === 0) return '0.00'
  const sr = (runs / balls) * 100
  return sr.toFixed(2)
}

/**
 * Format economy rate
 * @param {number} runs - Runs conceded
 * @param {number} overs - Overs bowled (as number, e.g., 4.2)
 * @returns {string} - Formatted economy rate (e.g., "4.75")
 */
export function formatEconomy(runs, overs) {
  if (!overs || overs === 0) return '0.00'
  const economy = runs / overs
  return economy.toFixed(2)
}

