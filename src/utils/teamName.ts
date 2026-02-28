/**
 * Formats a team name into a short code (3 letters for single word, initials for multiple words)
 * and appends the batch/year if available.
 * 
 * Rules:
 * - "Rangers - 19" -> "RAN - 19"
 * - "Night Owls - 22" -> "NO - 22"
 */
export function formatShortTeamName(name: string, batch?: string): string {
    if (!name) return ''

    // Split name and batch if batch is not explicitly provided
    let teamNamePart = name
    let extractedBatch = batch || ''

    // If name contains a hyphen and it looks like a year/batch at the end
    if (name.includes('-')) {
        const lastHyphenIndex = name.lastIndexOf('-')
        const potentialBatch = name.substring(lastHyphenIndex + 1).trim()

        // Check if the part after hyphen is purely numerical (likely a batch/year)
        if (/^\d+$/.test(potentialBatch)) {
            teamNamePart = name.substring(0, lastHyphenIndex).trim()
            if (!extractedBatch) {
                extractedBatch = potentialBatch
            }
        }
    }

    // Handle team name short code
    const nameWords = teamNamePart.split(/\s+/).filter(Boolean)
    let shortCode = ''

    if (nameWords.length === 1) {
        // Single word: take first 3 letters OR 2 if it's very short
        const word = nameWords[0]
        if (word.length <= 3) {
            shortCode = word.toUpperCase()
        } else {
            shortCode = word.substring(0, 3).toUpperCase()
        }
    } else {
        // Multiple words: take first letter of each word
        // Special case: "Sri Lanka" -> "SL", "Night Owls" -> "NO"
        shortCode = nameWords.map(word => word[0].toUpperCase()).join('')
    }

    // Clean the batch to only include last 2 digits if it's a year/number
    let cleanBatch = ''
    if (extractedBatch) {
        const match = extractedBatch.match(/\d+/)
        if (match) {
            const fullNum = match[0]
            cleanBatch = fullNum.length > 2 ? fullNum.slice(-2) : fullNum
        }
    }

    return cleanBatch ? `${shortCode} - ${cleanBatch}` : shortCode
}
