import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import * as https from 'https'

const db = admin.firestore()

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

/**
 * Notification Trigger: Match Status Updates (Start, Result, Toss, Innings Changes)
 */
export const onMatchUpdate = functions.firestore
    .document('matches/{matchId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data()
        const after = change.after.data()
        const matchId = context.params.matchId

        const teamAName = after.teamAName || 'Team A'
        const teamBName = after.teamBName || 'Team B'
        const matchTitle = `${teamAName} vs ${teamBName}`
        const tag = `match_${matchId}`

        // 1. Toss Update
        if (!before.tossWinner && after.tossWinner) {
            const winnerName = after.tossWinner === 'teamA' ? teamAName : teamBName
            const decision = after.electedTo || (after as any).tossDecision || 'bat'
            await sendOneSignalNotification(tag, 'Toss Update 🎲', `${winnerName} won the toss and chose to ${decision}`, matchId);
        }

        // 2. Match Start
        if (before.status !== 'live' && after.status === 'live') {
            await sendOneSignalNotification(tag, 'Match Started 🏏', `${matchTitle} is now LIVE!`, matchId);
        }

        // 3. Innings Break
        if (before.matchPhase !== 'InningsBreak' && after.matchPhase === 'InningsBreak') {
            const inningsScore = after.innings1Score || 0;
            const inningsWickets = after.innings1Wickets || 0;
            const inningsOvers = after.innings1Overs || '0.0';
            const battingTeam = after.currentBatting === 'teamA' ? teamAName : teamBName;
            await sendOneSignalNotification(tag, 'Innings Break ☕', `${battingTeam} finished with ${inningsScore}/${inningsWickets} (${inningsOvers} ov)`, matchId);
        }

        // 4. Second Innings Start
        if (before.matchPhase !== 'SecondInnings' && after.matchPhase === 'SecondInnings' || (before.matchPhase === 'InningsBreak' && after.matchPhase === 'SecondInnings')) {
            const target = after.target || 0;
            await sendOneSignalNotification(tag, 'Second Innings Started ⚡', `Target: ${target} runs in ${after.oversLimit || 20} overs.`, matchId);
        }

        // 5. Match Result
        if (before.status !== 'finished' && after.status === 'finished') {
            const resultText = after.resultSummary || 'Match Completed!';
            await sendOneSignalNotification(tag, 'Match Result 🏆', resultText, matchId);
        }
    })

/**
 * Notification Trigger: Ball Events (Wickets, Milestones, Boundaries)
 */
export const onBallCreated = functions.firestore
    .document('matches/{matchId}/innings/{inningId}/balls/{ballId}')
    .onCreate(async (snap, context) => {
        const ball = snap.data()
        const { matchId, inningId } = context.params

        const matchDoc = await db.collection('matches').doc(matchId).get()
        if (!matchDoc.exists) return;
        const match = matchDoc.data()!
        const tag = `match_${matchId}`

        // 1. Wicket Notification
        if (ball.isWicket || ball.wicket) {
            const batterName = ball.batsmanName || ball.batsman || 'Batter'
            const wicketType = ball.wicket?.type || ball.wicketType || 'out'
            const score = `${ball.runsHistory?.totalRuns || match.innings1Score || 'Score'} / ${ball.runsHistory?.totalWickets || match.innings1Wickets || 'W'}`

            await sendOneSignalNotification(tag, 'Wicket! 🔴', `${batterName} is OUT (${wicketType})! Current Score: ${score}`, matchId);
        }

        // 3. Milestone Notifications (50/100)
        try {
            const inningDoc = await db.collection('matches').doc(matchId).collection('innings').doc(inningId).get();
            if (inningDoc.exists) {
                const inningData = inningDoc.data()!;
                const batsmanId = ball.batsmanId;
                const stats = inningData.batsmanStats?.find((s: any) => s.batsmanId === batsmanId);

                if (stats) {
                    const currentRuns = stats.runs || 0;
                    const ballRuns = ball.runs || 0;

                    if (currentRuns >= 100 && currentRuns - ballRuns < 100) {
                        await sendOneSignalNotification(tag, 'CENTURY! 💯🏏', `${stats.batsmanName} scored a MASSIVE 100! 🌟`, matchId);
                    } else if (currentRuns >= 50 && currentRuns - ballRuns < 50) {
                        await sendOneSignalNotification(tag, 'Milestone! 🏏✨', `${stats.batsmanName} reached 50 runs! 🔥`, matchId);
                    }
                }
            }
        } catch (err) {
            console.error("Error checking milestones:", err);
        }
    })

/**
 * OneSignal Helper Function using native HTTPS module
 */
function sendOneSignalNotification(tag: string, title: string, body: string, matchId: string): Promise<any> {
    return new Promise((resolve, reject) => {
        if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
            console.warn("OneSignal credentials missing, skipping notification");
            return resolve(false);
        }

        const data = JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            filters: [
                { field: "tag", key: tag, relation: "=", value: "subscribed" },
                { operator: "OR" },
                { field: "tag", key: "all_matches", relation: "=", value: "active" }
            ],
            headings: { en: title },
            contents: { en: body },
            android_accent_color: "0D9488",
            small_icon: "ic_stat_onesignal_default",
            large_icon: "https://batchcrick.vercel.app/logo.png",
            url: `https://batchcrick.vercel.app/match/${matchId}`,
            android_visibility: 1,
            priority: 10,
            // android_channel_id: "match_alerts", // Removed to avoid 400 error if not created in OneSignal dashboard
            collapse_id: tag,
            thread_id: tag
        });

        const options = {
            hostname: 'onesignal.com',
            port: 443,
            path: '/api/v1/notifications',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let resData = '';
            res.on('data', (chunk) => { resData += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`Successfully sent OneSignal notification: ${title}`);
                    resolve(true);
                } else {
                    console.error(`OneSignal API error (${res.statusCode}): ${resData}`);
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            console.error("Error calling OneSignal API:", e);
            reject(e);
        });

        req.write(data);
        req.end();
    });
}
