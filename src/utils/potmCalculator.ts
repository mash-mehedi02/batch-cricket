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
    playersB: Player[],
    inningsASO?: InningsStats | null,
    inningsBSO?: InningsStats | null
): Player | null {
    if (!inningsA || !inningsB) return null;

    const winnerResult = calculateMatchWinner(
        _match.teamAName || 'Team A',
        _match.teamBName || 'Team B',
        inningsA,
        inningsB,
        _match,
        inningsASO,
        inningsBSO
    );

    if (winnerResult.isTied || !winnerResult.winner) return null;

    // Resolve which internal side won (teamA or teamB)
    const winnerSide = winnerResult.winner === (_match.teamAName || 'Team A') ? 'teamA' : 'teamB';
    const winningPlayers = winnerSide === 'teamA' ? playersA : playersB;

    // Core Innings
    const winInnBat = winnerSide === 'teamA' ? inningsA : inningsB;
    const lossInnBowl = winnerSide === 'teamA' ? inningsB : inningsA;

    // Super Over Innings
    const winInnBatSO = winnerSide === 'teamA' ? inningsASO : inningsBSO;
    const lossInnBowlSO = winnerSide === 'teamA' ? inningsBSO : inningsASO;

    let bestPlayer: Player | null = null;
    let maxPoints = -1;

    winningPlayers.forEach(player => {
        // --- 1. Main Innings Stats ---
        const mainBattingStats = winInnBat.batsmanStats?.find(s => s.batsmanId === player.id) || { runs: 0, balls: 0, fours: 0, sixes: 0 };
        const mainBowlingStats = lossInnBowl.bowlerStats?.find(s => s.bowlerId === player.id) || { wickets: 0, runsConceded: 0, maidens: 0 };

        // --- 2. Super Over Stats (Incremental) ---
        const soBattingStats = winInnBatSO?.batsmanStats?.find(s => s.batsmanId === player.id) || { runs: 0, balls: 0, fours: 0, sixes: 0 };
        const soBowlingStats = lossInnBowlSO?.bowlerStats?.find(s => s.bowlerId === player.id) || { wickets: 0, runsConceded: 0, maidens: 0 };

        // Aggregate stats
        const aggregatedStats: any = {
            batting: {
                runs: (mainBattingStats.runs || 0) + (soBattingStats.runs || 0),
                balls: (mainBattingStats.balls || 0) + (soBattingStats.balls || 0),
                fours: (mainBattingStats.fours || 0) + (soBattingStats.fours || 0),
                sixes: (mainBattingStats.sixes || 0) + (soBattingStats.sixes || 0)
            },
            bowling: {
                wickets: (mainBowlingStats.wickets || 0) + (soBowlingStats.wickets || 0),
                runsConceded: (mainBowlingStats.runsConceded || 0) + (soBowlingStats.runsConceded || 0),
                maidens: (mainBowlingStats.maidens || 0) + (soBowlingStats.maidens || 0)
            }
        };

        const points = calculateFantasyPoints(aggregatedStats);

        if (points > maxPoints) {
            maxPoints = points;
            bestPlayer = player;
        }
    });

    return bestPlayer;
}
