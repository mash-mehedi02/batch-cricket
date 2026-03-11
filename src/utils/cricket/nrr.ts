/**
 * Net Run Rate (NRR) Utility
 * 
 * Implements ICC standard NRR calculation rules:
 * 1. NRR = (Total Runs Scored / Total Overs Faced) - (Total Runs Conceded / Total Overs Bowled)
 * 2. If a team is bowled out, the full quota of overs is used for that innings.
 * 3. Partial overs are converted to decimals (balls / 6).
 */

import { Match, InningsStats } from '@/types';
import { MatchResult } from '@/engine/tournament';

/**
 * Normalizes balls to decimal overs
 */
export const ballsToOversDecimal = (balls: number): number => {
    return balls > 0 ? balls / 6 : 0;
};

/**
 * Prepares match result data for NRR calculation according to ICC rules
 */
export const calculateMatchNRRData = (
    match: Match,
    innA: InningsStats | null,
    innB: InningsStats | null
): MatchResult | null => {
    if (!innA || !innB) return null;

    const status = String(match.status || '').toLowerCase();
    const isFinished = status === 'finished' || status === 'completed';

    // NRR is typically only calculated for completed matches
    if (!isFinished) return null;

    // Use squad IDs from match
    const teamAId = match.teamAId || (match as any).teamASquadId || (match as any).teamA;
    const teamBId = match.teamBId || (match as any).teamBSquadId || (match as any).teamB;

    if (!teamAId || !teamBId) return null;

    // Standard match quota (e.g. 20 overs)
    // Convert to balls
    const matchQuotaBalls = (match.oversLimit || 20) * 6;

    // Determine result
    let result: 'win' | 'loss' | 'tie' | 'no_result' = 'tie';
    const mainARuns = Number(innA.totalRuns || 0);
    const mainBRuns = Number(innB.totalRuns || 0);

    // Initial result determination
    if (mainARuns > mainBRuns) result = 'win';
    else if (mainBRuns > mainARuns) result = 'loss';
    else {
        // Handle super over or other tie-breakers if needed
        // For now, keep it simple as the engine handles the points separately if needed
        // But for NRR, we just need the runs and overs.
        result = 'tie';
    }

    // ICC ALL OUT RULE:
    // If a team is bowled out, the full quota of overs is used for that innings.
    // This applies to both the team that was bowled out (overs faced) 
    // and the bowling team (overs bowled).

    // Standard cricket is 10 wickets, but Batch Cricket might be different.
    // We'll check if totalWickets is 10 or if the innings is marked as finished/all-out elsewhere.
    // robust check: if wickets >= 10, it's all out.
    const isTeamAAllOut = (innA.totalWickets || 0) >= 10;
    const isTeamBAllOut = (innB.totalWickets || 0) >= 10;

    // effective balls faced
    const teamAFacedBalls = isTeamAAllOut ? matchQuotaBalls : (innA.legalBalls || 0);
    const teamBFacedBalls = isTeamBAllOut ? matchQuotaBalls : (innB.legalBalls || 0);

    return {
        matchId: match.id,
        tournamentId: match.tournamentId || '',
        teamA: teamAId,
        teamB: teamBId,
        groupA: match.groupId || '',
        groupB: match.groupId || '',
        result,
        teamARunsFor: mainARuns,
        teamABallsFaced: teamAFacedBalls,
        teamARunsAgainst: mainBRuns,
        teamABallsBowled: teamBFacedBalls
    };
};
