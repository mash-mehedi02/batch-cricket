import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

const db = admin.firestore();

// Shared Transporter Logic
// Shared Transporter Logic (Legacy/Gmail)
const getTransporter = () => {
    const user = process.env.EMAIL_USER || 'batchcrick@gmail.com';
    const pass = process.env.EMAIL_PASS || 'gocf vzpf kbjt qlqh';

    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });
};

/**
 * Send email using Brevo API (Preferred) or Nodemailer (Fallback)
 */
export async function sendEmail(to: string, subject: string, html: string, contextInfo?: any) {
    if (!to) return;

    try {
        const brevoKey = process.env.BREVO_API_KEY;

        if (brevoKey) {
            // USE BREVO API (No sender email/password required, just Key)
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': brevoKey,
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    sender: { name: 'BatchCrick BD', email: 'noreply@batchcrick.com' },
                    to: [{ email: to }],
                    subject: subject,
                    htmlContent: html
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(`Brevo API Error: ${JSON.stringify(errData)}`);
            }

            console.log(`[Email Sent] (Brevo API) To: ${to}, Subject: ${subject}`);
        } else {
            // FALBACK TO NODEMAILER
            const transporter = getTransporter();
            await transporter.sendMail({
                from: '"BatchCrick BD" <noreply@batchcrick.com>',
                to,
                subject,
                html
            });
            console.log(`[Email Sent] (SMTP) To: ${to}, Subject: ${subject}`);
        }

        // Log the email success
        await db.collection('email_logs').add({
            to,
            subject,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'sent',
            method: brevoKey ? 'brevo_api' : 'stmp_fallback',
            context: contextInfo || {}
        });

    } catch (error) {
        console.error(`[Email Failed] To: ${to}`, error);

        // Log failure
        await db.collection('email_logs').add({
            to,
            subject,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'failed',
            error: error instanceof Error ? error.message : JSON.stringify(error),
            context: contextInfo || {}
        });
    }
}

/**
 * Trigger: Profile Update Email
 * Sends email when admin updates profile or player updates own profile
 */
export const onPlayerUpdate = functions.firestore
    .document('players/{playerId}')
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();
        const playerId = context.params.playerId;

        // Check if email exists
        if (!newData.maskedEmail) return; // Can't send if we don't know email (masked is proxy for existence here, but we need real email)

        // Only send on significant changes (name, role, stats, etc.)
        // Avoid sending on trivial updates like 'updatedAt'
        const significantFields = ['name', 'role', 'battingStyle', 'bowlingStyle', 'bio', 'photoUrl'];
        const hasChange = significantFields.some(field => JSON.stringify(newData[field]) !== JSON.stringify(oldData[field]));

        if (!hasChange) return;

        // Retrieve real email from player_secrets
        const secretDoc = await db.collection('player_secrets').doc(playerId).get();
        if (!secretDoc.exists) return;
        const email = secretDoc.data()?.email;
        if (!email) return;

        const subject = 'Your BatchCrick BD Profile Updated';
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Profile Updated</h2>
                <p>Hello ${newData.name},</p>
                <p>Your player profile details have been updated.</p>
                <p>If you did not make this change, please contact your admin.</p>
                <br>
                <p>BatchCrick BD Team</p>
            </div>
        `;

        await sendEmail(email, subject, html, {
            type: 'profile_update',
            playerId,
            updatedBy: newData.updatedBy || 'system'
        });
    });

/**
 * Helper: Send Batch Match End Emails
 * Called by finalizeMatch
 */
export async function sendMatchEndEmails(matchId: string) {
    console.log(`[Match End Email] Starting for match ${matchId}`);

    const matchDoc = await db.collection('matches').doc(matchId).get();
    if (!matchDoc.exists) return;
    const match = matchDoc.data();
    if (!match) return;

    // Get stats
    const inningsARef = db.collection('matches').doc(matchId).collection('innings').doc('teamA');
    const inningsBRef = db.collection('matches').doc(matchId).collection('innings').doc('teamB');

    const [statsA, statsB] = await Promise.all([
        inningsARef.get(),
        inningsBRef.get()
    ]);

    // Combine 11s
    const allPlayerIds = [...(match.teamAPlayingXI || []), ...(match.teamBPlayingXI || [])];
    // Remove duplicates
    const uniqueIds = [...new Set(allPlayerIds)];

    // Fetch players and secrets for emails
    // We do this individually or in batches roughly
    // Since uniqueIds typicaly < 22, Promise.all is fine

    const emailPromises = uniqueIds.map(async (playerId) => {
        // Get Player & Secret
        const playerDoc = await db.collection('players').doc(playerId).get();
        const secretDoc = await db.collection('player_secrets').doc(playerId).get();

        if (!playerDoc.exists || !secretDoc.exists) return;

        const player = playerDoc.data();
        const email = secretDoc.data()?.email;

        if (!email || !player) return;

        // Calculate Personal Performance
        let performanceHtml = '<ul>';
        let hasPerformance = false;

        // Check Batting in both innings (could be T20, so 1 inning usually per team)
        const checkBatting = (stats: any) => {
            const batStats = (stats.batsmanStats || []).find((b: any) => b.batsmanId === playerId);
            if (batStats) {
                performanceHtml += `<li>Batting: <strong>${batStats.runs}</strong> (${batStats.balls}) - 4s: ${batStats.fours}, 6s: ${batStats.sixes}</li>`;
                hasPerformance = true;
            }
        };

        // Check Bowling
        const checkBowling = (stats: any) => {
            const bowlStats = (stats.bowlerStats || []).find((b: any) => b.bowlerId === playerId);
            if (bowlStats) {
                performanceHtml += `<li>Bowling: <strong>${bowlStats.wickets}/${bowlStats.runsConceded}</strong> (${bowlStats.overs} ov)</li>`;
                hasPerformance = true;
            }
        };

        if (statsA.exists) {
            checkBatting(statsA.data());
            checkBowling(statsA.data());
        }
        if (statsB.exists) {
            checkBatting(statsB.data());
            checkBowling(statsB.data());
        }

        performanceHtml += '</ul>';

        if (!hasPerformance) {
            performanceHtml = '<p>You played in this match.</p>';
        }

        const subject = `Match Result: ${match.teamAName} vs ${match.teamBName}`;
        const html = `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
                <h2 style="color: #0f766e;">Match Finished</h2>
                <h3>${match.teamAName} vs ${match.teamBName}</h3>
                <p><strong>Result:</strong> ${match.resultSummary || 'Match Concluded'}</p>
                
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                
                <h4>Your Performance</h4>
                ${performanceHtml}
                
                <p style="margin-top: 30px; font-size: 12px; color: #666;">
                    <a href="https://batchcrick.com/match/${matchId}">View Full Scorecard</a>
                </p>
            </div>
        `;

        await sendEmail(email, subject, html, {
            type: 'match_end',
            matchId,
            playerId
        });
    });

    await Promise.all(emailPromises);
    console.log(`[Match End Email] Completed for match ${matchId}`);
}

/**
 * Callable: Send Manual Email (Super Admin Only)
 */
export const sendManualEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

    // Check Super Admin
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    if (userDoc.data()?.role !== 'super_admin') {
        throw new functions.https.HttpsError('permission-denied', 'Super Admin only');
    }

    const { recipients, subject, message } = data;
    // recipients: array of email strings OR array of playerIds

    if (!recipients || !Array.isArray(recipients) || !subject || !message) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid fields');
    }

    // Process recipients
    const emailList = [];
    for (const r of recipients) {
        if (r.includes('@')) {
            emailList.push(r);
        } else {
            // Assume ID
            const secretDoc = await db.collection('player_secrets').doc(r).get();
            if (secretDoc.exists && secretDoc.data()?.email) {
                emailList.push(secretDoc.data()?.email);
            }
        }
    }

    const uniqueEmails = [...new Set(emailList)];

    const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h3>${subject}</h3>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <hr>
            <p style="font-size: 12px; color: #888;">Sent by BatchCrick Admin</p>
        </div>
    `;

    // Batch send
    const promises = uniqueEmails.map(email => sendEmail(email, subject, html, { type: 'manual', by: context.auth?.uid }));
    await Promise.all(promises);

    return { success: true, count: uniqueEmails.length };
});

/**
 * Trigger: Tournament End Email
 */
export const onTournamentEnd = functions.firestore
    .document('tournaments/{tournamentId}')
    .onUpdate(async (change, context) => {
        const newData = change.after.data();
        const oldData = change.before.data();

        if (oldData?.status !== 'completed' && newData?.status === 'completed') {
            await sendTournamentEndEmails(context.params.tournamentId, newData);
        }
    });

async function sendTournamentEndEmails(tournamentId: string, tournament: any) {
    console.log(`[Tournament End] Processing for ${tournamentId}`);

    // 1. Get all finished matches
    const matchesSnap = await db.collection('matches')
        .where('tournamentId', '==', tournamentId)
        .where('status', '==', 'finished')
        .get();

    if (matchesSnap.empty) {
        console.log('No matches found for tournament');
        return;
    }

    // 2. Aggregate Stats
    const playerStats: Record<string, { matches: number, runs: number, wickets: number }> = {};
    const playerIds = new Set<string>();

    for (const doc of matchesSnap.docs) {
        const m = doc.data();

        // We need to fetch innings to get actual stats. 
        // OPTIMIZATION: Instead of reading ALL innings docs (expensive), 
        // we can rely on `playersDataSynced` and `players` collection if standard stats were updated.
        // BUT `player` stats are career/season total.
        // For accurate "Tournament Summary", we should ideally query match stats.
        // Given complexity, we will rely on fetching innings.

        const innA = await db.collection('matches').doc(doc.id).collection('innings').doc('teamA').get();
        const innB = await db.collection('matches').doc(doc.id).collection('innings').doc('teamB').get();

        const processInnings = (inn: any) => {
            if (!inn) return;
            (inn.batsmanStats || []).forEach((b: any) => {
                if (!playerStats[b.batsmanId]) playerStats[b.batsmanId] = { matches: 0, runs: 0, wickets: 0 };
                playerStats[b.batsmanId].runs += b.runs || 0;
                playerIds.add(b.batsmanId);
            });
            (inn.bowlerStats || []).forEach((b: any) => {
                if (!playerStats[b.bowlerId]) playerStats[b.bowlerId] = { matches: 0, runs: 0, wickets: 0 };
                playerStats[b.bowlerId].wickets += b.wickets || 0;
                playerIds.add(b.bowlerId);
            });
        };

        if (innA.exists) processInnings(innA.data());
        if (innB.exists) processInnings(innB.data());

        const participants = [...(m.teamAPlayingXI || []), ...(m.teamBPlayingXI || [])];
        participants.forEach(pid => {
            if (!playerStats[pid]) playerStats[pid] = { matches: 0, runs: 0, wickets: 0 };
            playerStats[pid].matches += 1;
            playerIds.add(pid);
        });
    }

    // 3. Send Emails in batches
    const allIds = Array.from(playerIds);
    const BATCH_SIZE = 10;

    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
        const batchIds = allIds.slice(i, i + BATCH_SIZE);
        await Promise.all(batchIds.map(async (pid) => {
            const secretDoc = await db.collection('player_secrets').doc(pid).get();
            const playerDoc = await db.collection('players').doc(pid).get();

            if (!secretDoc.exists || !playerDoc.exists) return; // No email/player

            const email = secretDoc.data()?.email;
            const player = playerDoc.data();
            const stats = playerStats[pid];

            if (!email || !player || !stats) return; // Validation

            const subject = `Tournament Finished: ${tournament.name}`;
            const html = `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #0f766e;">${tournament.name} Concluded</h2>
                    <p>Hi ${player.name},</p>
                    <p>The tournament has officially ended. Here is your performance summary:</p>
                    
                    <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
                        <h3 style="margin-top:0;">Your Stats</h3>
                        <p><strong>Matches:</strong> ${stats.matches}</p>
                        <p><strong>Runs:</strong> ${stats.runs}</p>
                        <p><strong>Wickets:</strong> ${stats.wickets}</p>
                    </div>
                    
                    <p>Thank you for participating!</p>
                </div>
            `;

            await sendEmail(email, subject, html, { type: 'tournament_end', tournamentId, playerId: pid });
        }));
    }

    console.log(`[Tournament End] Emails sent to ${allIds.length} players`);
}
