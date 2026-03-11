/**
 * Formats a team name into a short code (3 letters for single word, initials for multiple words)
 * without any batch/year suffix.
 */

/**
 * Strips the batch/year suffix from a team name.
 * E.g., "Rangers - 19" -> "Rangers", "Boring Lagce 10" -> "Boring Lagce"
 */
export function stripBatch(name: string): string {
    if (!name) return ''
    // Matches suffixes like " - 19", "-19", " 19", "'19" at the end
    const match = name.match(/^(.*?)\s*[-']?\s*\d{2,4}$/)
    if (match) {
        return match[1].trim()
    }
    return name.trim()
}

/**
 * Formats a team name into a short code.
 * Rules:
 * - 1 word: first 3 letters (e.g., "Rangers" -> "RAN")
 * - 2+ words: initials (e.g., "Elite Eagle" -> "EE")
 * - Batch preservation: re-attach batch as " - XX" (e.g., "Rangers - 19" -> "RAN - 19")
 */
export function formatShortTeamName(name: string): string {
    if (!name) return ''

    // Extract batch suffix if exists (2-4 digits at the end)
    const batchMatch = name.match(/\s*[-']?\s*(\d{2,4})$/)
    const batch = batchMatch ? batchMatch[1] : null

    // Get the clean team name part
    const cleanName = stripBatch(name)
    const words = cleanName.split(/\s+/).filter(Boolean)

    let shortCode = ''

    if (words.length === 0) {
        shortCode = 'TM'
    } else if (words.length === 1) {
        // Single word: first 3 characters
        const word = words[0]
        shortCode = word.length <= 3 ? word.toUpperCase() : word.substring(0, 3).toUpperCase()
    } else {
        // Multiple words: initials of the first two words
        shortCode = (words[0][0] + words[1][0]).toUpperCase()
    }

    // Re-attach batch if it existed
    return batch ? `${shortCode} - ${batch}` : shortCode
}
