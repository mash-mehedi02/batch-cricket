/**
 * Generate unique match number based on tournament name
 * Format: Tournament Initials + Serial Number (e.g., SFM01, SMT02)
 * If collision occurs, adds 'B' suffix (e.g., SFM01B)
 */

import { matchService } from '@/services/firestore/matches'

/**
 * Extract initials from tournament name
 * Example: "SMA Friendly Match" -> "SFM"
 */
export function getTournamentInitials(tournamentName: string): string {
    if (!tournamentName) return 'M' // Default to 'M' for Match

    const words = tournamentName
        .trim()
        .split(/\s+/) // Split by whitespace
        .filter(word => word.length > 0)

    // Take first letter of each word, uppercase
    const initials = words
        .map(word => word[0].toUpperCase())
        .join('')

    return initials || 'M'
}

/**
 * Generate unique match number for a tournament
 * @param tournamentId - Tournament ID
 * @param tournamentName - Tournament name for generating initials
 * @returns Promise<string> - Unique match number (e.g., "SFM01", "SMT02B")
 */
export async function generateMatchNumber(
    tournamentId: string,
    tournamentName: string
): Promise<string> {
    try {
        // Get tournament initials
        const initials = getTournamentInitials(tournamentName)

        // Get all matches for this tournament
        const tournamentMatches = await matchService.getByTournament(tournamentId)

        // Calculate next serial number (1-based)
        const nextSerial = tournamentMatches.length + 1
        const serialStr = String(nextSerial).padStart(2, '0') // Pad to 2 digits: 01, 02, etc.

        // Generate base match number
        let matchNumber = `${initials}${serialStr}`

        // Check for uniqueness across ALL matches (not just this tournament)
        // This prevents collisions between different tournaments
        const allMatches = await matchService.getAll()
        const existingNumbers = new Set(
            allMatches
                .map(m => (m as any).matchNo || (m as any).matchNumber)
                .filter(Boolean)
        )

        // If collision exists, add 'B' suffix
        if (existingNumbers.has(matchNumber)) {
            matchNumber = `${matchNumber}B`

            // If still collision (unlikely), keep adding B's
            while (existingNumbers.has(matchNumber)) {
                matchNumber = `${matchNumber}B`
            }
        }

        return matchNumber
    } catch (error) {
        console.error('[generateMatchNumber] Error:', error)
        // Fallback to timestamp-based number
        return `M${Date.now().toString().slice(-6)}`
    }
}

/**
 * Validate match number format
 * @param matchNumber - Match number to validate
 * @returns boolean - True if valid format
 */
export function isValidMatchNumber(matchNumber: string): boolean {
    if (!matchNumber) return false

    // Format: 2+ letters + 2+ digits + optional B's
    // Examples: SFM01, SMT02, ABC123, SFM01B, SMT02BB
    const pattern = /^[A-Z]{1,}[0-9]{2,}B*$/
    return pattern.test(matchNumber)
}
