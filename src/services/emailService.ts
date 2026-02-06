/**
 * Frontend Email Service (Brevo API)
 * Allows sending emails directly from the client without Cloud Functions.
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const API_KEY = import.meta.env.VITE_BREVO_API_KEY;

import { matchService } from './firestore/matches';
import { playerService } from './firestore/players';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from './firestore/collections';

export interface EmailRecipient {
    email: string;
    name?: string;
}

export interface SendEmailPayload {
    to: EmailRecipient[];
    subject: string;
    htmlContent: string;
    sender?: EmailRecipient;
}

/**
 * Send a single or batch email via Brevo
 */
export async function sendEmail(payload: SendEmailPayload) {
    if (!API_KEY) {
        console.error("[EmailService] Missing VITE_BREVO_API_KEY");
        return { success: false, error: "Configuration missing" };
    }

    try {
        const response = await fetch(BREVO_API_URL, {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: payload.sender || { name: 'BatchCrick BD', email: 'batchcrick@gmail.com' },
                to: payload.to,
                subject: payload.subject,
                htmlContent: payload.htmlContent
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(JSON.stringify(error));
        }

        // Log to Firestore for auditing
        try {
            const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
            await addDoc(collection(db, 'email_logs'), {
                to: payload.to.map(r => r.email).join(','),
                subject: payload.subject,
                sentAt: serverTimestamp(),
                status: 'sent',
                method: 'Brevo Frontend API',
                sender: payload.sender?.email || 'noreply@batchcrick.com'
            });
        } catch (logErr) {
            console.warn("[EmailService] Log to Firestore failed (permissions/blocked):", logErr);
        }

        return { success: true };
    } catch (err: any) {
        console.error("[EmailService] Failed to send email:", err);

        // Log failure to Firestore
        try {
            const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
            await addDoc(collection(db, 'email_logs'), {
                to: payload.to.map(r => r.email).join(','),
                subject: payload.subject,
                sentAt: serverTimestamp(),
                status: 'failed',
                error: err?.message || JSON.stringify(err),
                method: 'Brevo Frontend API'
            });
        } catch (logErr) {
            console.warn("[EmailService] Log error to Firestore failed:", logErr);
        }

        return { success: false, error: err };
    }
}

/**
 * Helper to build Match Summary Email HTML
 */
export function buildMatchSummaryHtml(match: any, player: any, stats: { bat?: any, bowl?: any }, resultSummary: string) {
    let performanceHtml = '<ul>';
    let hasPerformance = false;

    if (stats.bat) {
        performanceHtml += `<li>Batting: <strong>${stats.bat.runs}</strong> (${stats.bat.balls}) - 4s: ${stats.bat.fours}, 6s: ${stats.bat.sixes}</li>`;
        hasPerformance = true;
    }

    if (stats.bowl) {
        performanceHtml += `<li>Bowling: <strong>${stats.bowl.wickets}/${stats.bowl.runsConceded}</strong> (${stats.bowl.overs} ov)</li>`;
        hasPerformance = true;
    }

    performanceHtml += '</ul>';

    if (!hasPerformance) {
        performanceHtml = '<p>You were part of the Playing XI for this match.</p>';
    }

    return `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
            <h2 style="color: #0f766e;">Match Finished</h2>
            <h3>${match.teamAName} vs ${match.teamBName}</h3>
            <p><strong>Result:</strong> ${resultSummary || 'Match Concluded'}</p>
            
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            
            <h4 style="color: #333;">Hello ${player.name},</h4>
            <p>Here is your performance summary for the match:</p>
            ${performanceHtml}
            
            <p style="margin-top: 30px; font-size: 12px; color: #666;">
                <a href="https://batchcrick.com/match/${match.id}" style="color: #0f766e; font-weight: bold; text-decoration: none;">View Full Scorecard</a>
            </p>
            <p style="color: #999; font-size: 10px;">Sent via BatchCrick BD Automatic Report System</p>
        </div>
    `;
}

/**
 * Dispatch personalized emails for a match end
 */
export async function sendMatchEndEmails(matchId: string, resultSummary: string) {
    try {
        const match = await matchService.getById(matchId);
        if (!match) return;

        const [teamAInnings, teamBInnings] = await Promise.all([
            matchService.getInnings(matchId, 'teamA'),
            matchService.getInnings(matchId, 'teamB')
        ]);

        const playersToEmail = new Set([...(match as any).teamAPlayingXI || [], ...(match as any).teamBPlayingXI || []]);
        const playerIds = Array.from(playersToEmail).filter(Boolean);

        const emailPromises = playerIds.map(async (pid) => {
            // Get player and secret (for email)
            const player = await playerService.getById(pid as string);
            if (!player) return;

            // Fetch real email from secrets
            const secretSnap = await getDocs(query(collection(db, 'player_secrets'), where('playerId', '==', pid)));
            const email = secretSnap.docs[0]?.data()?.email;
            if (!email) return;

            // Calculate stats
            const batStatA = teamAInnings?.batsmanStats?.find(b => b.batsmanId === pid);
            const batStatB = teamBInnings?.batsmanStats?.find(b => b.batsmanId === pid);
            const bowlStatA = teamAInnings?.bowlerStats?.find(b => b.bowlerId === pid);
            const bowlStatB = teamBInnings?.bowlerStats?.find(b => b.bowlerId === pid);

            const combinedStats = {
                bat: batStatA || batStatB,
                bowl: bowlStatA || bowlStatB
            };

            const html = buildMatchSummaryHtml(match, player, combinedStats, resultSummary);
            await sendEmail({
                to: [{ email, name: player.name }],
                subject: `Match Report: ${match.teamAName} vs ${match.teamBName}`,
                htmlContent: html
            });
        });

        await Promise.all(emailPromises);
        return { success: true };
    } catch (err) {
        console.error("sendMatchEndEmails failed:", err);
        return { success: false, error: err };
    }
}

/**
 * Dispatch personalized emails for a tournament end
 */
export async function sendTournamentEndEmails(tournamentId: string) {
    try {
        const tSnap = await getDocs(query(collection(db, COLLECTIONS.TOURNAMENTS), where('id', '==', tournamentId)));
        const tournament = tSnap.docs[0]?.data();
        if (!tournament) return;

        // Fetch all finished matches for this tournament
        const matchesSnap = await getDocs(query(collection(db, COLLECTIONS.MATCHES), where('tournamentId', '==', tournamentId), where('status', '==', 'finished')));

        // Aggregate stats per player
        // (Similar to Cloud Function logic but in frontend)
        const playerStatsMap: Record<string, { matches: number, runs: number, wickets: number, name: string }> = {};

        for (const mDoc of matchesSnap.docs) {
            const m = mDoc.data();
            const [innA, innB] = await Promise.all([
                matchService.getInnings(mDoc.id, 'teamA'),
                matchService.getInnings(mDoc.id, 'teamB')
            ]);

            const pxi = [...(m.teamAPlayingXI || []), ...(m.teamBPlayingXI || [])];
            pxi.forEach(pid => {
                if (!playerStatsMap[pid]) playerStatsMap[pid] = { matches: 0, runs: 0, wickets: 0, name: '' };
                playerStatsMap[pid].matches += 1;
            });

            [innA, innB].forEach(inn => {
                inn?.batsmanStats?.forEach(b => {
                    if (!playerStatsMap[b.batsmanId]) playerStatsMap[b.batsmanId] = { matches: 0, runs: 0, wickets: 0, name: b.batsmanName };
                    playerStatsMap[b.batsmanId].runs += b.runs;
                    playerStatsMap[b.batsmanId].name = b.batsmanName;
                });
                inn?.bowlerStats?.forEach(b => {
                    if (!playerStatsMap[b.bowlerId]) playerStatsMap[b.bowlerId] = { matches: 0, runs: 0, wickets: 0, name: b.bowlerName };
                    playerStatsMap[b.bowlerId].wickets += b.wickets;
                    playerStatsMap[b.bowlerId].name = b.bowlerName;
                });
            });
        }

        const playerIds = Object.keys(playerStatsMap);
        await Promise.all(playerIds.map(async (pid) => {
            const secretSnap = await getDocs(query(collection(db, 'player_secrets'), where('playerId', '==', pid)));
            const email = secretSnap.docs[0]?.data()?.email;
            if (!email) return;

            const stats = playerStatsMap[pid];
            const html = `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #0f766e;">${tournament.name} Finished!</h2>
                    <p>Hi ${stats.name},</p>
                    <p>The tournament has officially ended. Here is your summary:</p>
                    <div style="background: #f0fdfa; padding: 15px; border-radius: 8px; border: 1px solid #0f766e;">
                        <p><strong>Matches Played:</strong> ${stats.matches}</p>
                        <p><strong>Total Runs:</strong> ${stats.runs}</p>
                        <p><strong>Total Wickets:</strong> ${stats.wickets}</p>
                    </div>
                </div>
            `;

            await sendEmail({
                to: [{ email, name: stats.name }],
                subject: `Tournament Summary: ${tournament.name}`,
                htmlContent: html
            });
        }));

        return { success: true };
    } catch (err) {
        console.error("sendTournamentEndEmails failed:", err);
        return { success: false, error: err };
    }
}
