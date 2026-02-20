import { InningsStats, Match, Player } from '@/types';
import { calculateFantasyPoints } from './statsCalculator';
import { calculateMatchWinner } from './matchWinner';

/**
 * Automatically determines the Player of the Match based on Fantasy Points.
 * The player MUST be from the winning team.
 */
export function calculatePotM(
    _match: Match,
    inningsA: InningsStats | null,
    inningsB: InningsStats | null,
    playersA: Player[],
    playersB: Player[]
): Player | null {
    if (!inningsA || !inningsB) return null;

    const winnerResult = calculateMatchWinner(
        _match.teamAName || 'Team A',
        _match.teamBName || 'Team B',
        inningsA,
        inningsB,
        _match
    );

    if (winnerResult.isTied || !winnerResult.winner) return null;

    // Resolve which internal side won (teamA or teamB)
    const winnerSide = winnerResult.winner === (_match.teamAName || 'Team A') ? 'teamA' : 'teamB';
    const winningPlayers = winnerSide === 'teamA' ? playersA : playersB;
    const winningInnings = winnerSide === 'teamA' ? inningsA : inningsB;
    const losingInnings = winnerSide === 'teamA' ? inningsB : inningsA;

    let bestPlayer: Player | null = null;
    let maxPoints = -1;

    winningPlayers.forEach(player => {
        // Collect stats for this player from the winning team's innings (batting)
        // AND from the losing team's innings (bowling/fielding)
        const battingStats = winningInnings.batsmanStats?.find(s => s.batsmanId === player.id);
        const bowlingStats = losingInnings.bowlerStats?.find(s => s.bowlerId === player.id);

        // We can also try to find fielding stats if they are in FallOfWickets or similar,
        // but for now, Batting + Bowling is the core of PotM.

        const stats: any = {
            batting: battingStats || { runs: 0, balls: 0, fours: 0, sixes: 0 },
            bowling: bowlingStats || { wickets: 0, runsConceded: 0, maidens: 0 }
        };

        const points = calculateFantasyPoints(stats);

        if (points > maxPoints) {
            maxPoints = points;
            bestPlayer = player;
        }
    });

    return bestPlayer;
}
