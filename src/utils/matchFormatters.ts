import { Match } from '@/types';

/**
 * Formats a knockout match stage into a human-readable title.
 * Examples: 
 *   - round: 'quarter_final', matchNo: 'QF1' -> 'Quarter Final 1'
 *   - round: 'semi_final', matchNo: 'SF2' -> 'Semi Final 2'
 *   - round: 'final' -> 'Final'
 */
export function formatKnockoutTitle(match: Match): string | null {
    if (match.stage !== 'knockout') return null;

    let baseName = '';

    // First try to use the round name
    const round = String(match.round || '').toLowerCase();
    if (round.includes('quarter')) baseName = 'Quarter Final';
    else if (round.includes('semi')) baseName = 'Semi Final';
    else if (round === 'final' || round.includes('final')) baseName = 'Final';

    // If we have a matchNo (e.g. QF1, SF2), extract the number to append it
    const matchNo = String(match.matchNo || '').toUpperCase();

    if (baseName) {
        if (baseName === 'Final') {
            // Just return "Final", optionally checking if it has a number but usually finals don't
            return 'Final';
        }

        // Extract number from matchNo like "QF1" -> "1"
        const matchIndex = matchNo.match(/\d+/);
        if (matchIndex) {
            return `${baseName} ${matchIndex[0]}`;
        }
        return baseName;
    }

    // Fallback if round name isn't recognized
    if (matchNo) {
        if (matchNo.startsWith('QF')) return `Quarter Final ${matchNo.replace('QF', '')}`;
        if (matchNo.startsWith('SF')) return `Semi Final ${matchNo.replace('SF', '')}`;
        if (matchNo.startsWith('F')) return `Final`;
    }

    return 'Knockout Match';
}
