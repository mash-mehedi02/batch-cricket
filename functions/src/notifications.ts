import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

const db = admin.firestore()

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
            await sendFcmNotification(tag, 'Toss Update 🎲', `${winnerName} won the toss and chose to ${decision}`, matchId);
        }

        // 2. Match Start
        if (before.status !== 'live' && after.status === 'live') {
            await sendFcmNotification(tag, 'Match Started 🏏', `${matchTitle} is now LIVE!`, matchId);
        }

        // 3. Innings Break
        if (before.matchPhase !== 'InningsBreak' && after.matchPhase === 'InningsBreak') {
            const inningsScore = after.innings1Score || 0;
            const inningsWickets = after.innings1Wickets || 0;
            const inningsOvers = after.innings1Overs || '0.0';
            const battingTeam = after.currentBatting === 'teamA' ? teamAName : teamBName;
            await sendFcmNotification(tag, 'Innings Break ☕', `${battingTeam} finished with ${inningsScore}/${inningsWickets} (${inningsOvers} ov)`, matchId);
        }

        // 4. Second Innings Start
        if (before.matchPhase !== 'SecondInnings' && after.matchPhase === 'SecondInnings' || (before.matchPhase === 'InningsBreak' && after.matchPhase === 'SecondInnings')) {
            const target = after.target || 0;
            await sendFcmNotification(tag, 'Second Innings Started ⚡', `Target: ${target} runs in ${after.oversLimit || 20} overs.`, matchId);
        }

        // 5. Match Result
        if (before.status !== 'finished' && after.status === 'finished') {
            const resultText = after.resultSummary || 'Match Completed!';
            await sendFcmNotification(tag, 'Match Result 🏆', resultText, matchId);
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

            await sendFcmNotification(tag, 'Wicket! 🔴', `${batterName} is OUT (${wicketType})! Current Score: ${score}`, matchId);
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
                        await sendFcmNotification(tag, 'CENTURY! 💯🏏', `${stats.batsmanName} scored a MASSIVE 100! 🌟`, matchId);
                    } else if (currentRuns >= 50 && currentRuns - ballRuns < 50) {
                        await sendFcmNotification(tag, 'Milestone! 🏏✨', `${stats.batsmanName} reached 50 runs! 🔥`, matchId);
                    }
                }
            }
        } catch (err) {
            console.error("Error checking milestones:", err);
        }
    })

/**
 * FCM Helper Function using Firebase Admin SDK
 */
async function sendFcmNotification(topic: string, title: string, body: string, matchId: string): Promise<any> {
    try {
        const message = {
            notification: {
                title: title,
                body: body
            },
            topic: topic,
            data: {
                matchId: matchId,
                click_action: `https://batchcrick.vercel.app/match/${matchId}`
            },
            android: {
                priority: 'high' as const,
                notification: {
                    icon: 'ic_notification',
                    color: '#0D9488',
                    sound: 'default'
                }
            },
            webpush: {
                headers: {
                    Urgency: 'high'
                },
                notification: {
                    icon: '/logo.png',
                    badge: '/logo.png',
                    click_action: `https://batchcrick.vercel.app/match/${matchId}`
                }
            }
        };

        const response = await admin.messaging().send(message);
        console.log(`Successfully sent FCM message to ${topic}:`, response);
        return true;
    } catch (error) {
        console.error(`Error sending FCM message to ${topic}:`, error);
        return false;
    }
}
