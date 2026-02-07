import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

const db = admin.firestore()
const messaging = admin.messaging()

/**
 * Subscribe a user device to a specific topic
 * Topics: match_{matchId}_reminders, match_{matchId}_wickets
 */
export const subscribeToTopic = functions.https.onCall(async (data, context) => {
    const { token, topic } = data

    if (!token || !topic) {
        throw new functions.https.HttpsError('invalid-argument', 'Token and topic are required')
    }

    try {
        await messaging.subscribeToTopic(token, topic)
        console.log(`Subscribed ${token} to ${topic}`)
        return { success: true, message: `Subscribed to ${topic}` }
    } catch (error) {
        console.error('Error subscribing to topic:', error)
        throw new functions.https.HttpsError('internal', 'Failed to subscribe to topic')
    }
})

/**
 * Unsubscribe a user device from a specific topic
 */
export const unsubscribeFromTopic = functions.https.onCall(async (data, context) => {
    const { token, topic } = data

    if (!token || !topic) {
        throw new functions.https.HttpsError('invalid-argument', 'Token and topic are required')
    }

    try {
        await messaging.unsubscribeFromTopic(token, topic)
        console.log(`Unsubscribed ${token} from ${topic}`)
        return { success: true, message: `Unsubscribed from ${topic}` }
    } catch (error) {
        console.error('Error unsubscribing from topic:', error)
        throw new functions.https.HttpsError('internal', 'Failed to unsubscribe from topic')
    }
})

/**
 * Notification Trigger: Match Status Updates (Start, Result, Toss)
 */
export const onMatchUpdate = functions.firestore
    .document('matches/{matchId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data()
        const after = change.after.data()
        const matchId = context.params.matchId

        // Get team names for messages
        const teamAName = after.teamA?.name || 'Team A'
        const teamBName = after.teamB?.name || 'Team B'
        const matchTitle = `${teamAName} vs ${teamBName}`

        // Get adminId for topic
        const adminId = after.adminId || after.createdBy
        if (!adminId) {
            console.warn(`Match ${matchId} has no adminId, skipping notifications`)
            return
        }

        const topicBase = `admin_${adminId}_match_${matchId}`

        // 1. Toss Update
        // Check if toss info was added or changed significantly
        if (!before.tossWinner && after.tossWinner) {
            const winnerName = after.tossWinner === 'teamA' ? teamAName : teamBName
            const decision = after.electedTo // 'bat' or 'bowl'

            await sendNotificationToTopic(`${topicBase}_reminders`, {
                title: 'Toss Update',
                body: `${winnerName} won the toss and chose to ${decision}`,
                data: {
                    type: 'toss',
                    matchId: matchId
                }
            })
        }

        // 2. Match Start
        if (before.status !== 'live' && after.status === 'live') {
            await sendNotificationToTopic(`${topicBase}_reminders`, {
                title: 'Match Started 🏏',
                body: matchTitle,
                data: {
                    type: 'match_start',
                    matchId: matchId
                }
            })
        }

        // 3. Match Result
        if (before.status !== 'finished' && after.status === 'finished') {
            let resultText = after.resultSummary || ''

            if (!resultText && after.result?.winner) {
                const winnerName = after.result.winner === 'teamA' ? teamAName : teamBName
                const margin = after.result.margin || ''
                const winType = after.result.winType || '' // runs or wickets
                resultText = `${winnerName} won by ${margin} ${winType}`
            } else if (after.result?.draw) {
                resultText = 'Match Drawn'
            } else if (after.result?.tie) {
                resultText = 'Match Tied'
            }

            if (resultText) {
                await sendNotificationToTopic(`${topicBase}_reminders`, {
                    title: 'Match Result 🏆',
                    body: resultText,
                    data: {
                        type: 'match_result',
                        matchId: matchId
                    }
                })
            }
        }
    })


/**
 * Notification Trigger: Ball Events (Wickets, Milestones)
 * Listens to new balls
 */
export const onBallCreated = functions.firestore
    .document('matches/{matchId}/innings/{inningId}/balls/{ballId}')
    .onCreate(async (snap, context) => {
        const ball = snap.data()
        const matchId = context.params.matchId

        // Fetch match to get adminId
        const matchDoc = await db.collection('matches').doc(matchId).get()
        if (!matchDoc.exists) {
            console.warn(`Match ${matchId} not found for ball notification`)
            return
        }

        const match = matchDoc.data()!
        const adminId = match.adminId || match.createdBy
        if (!adminId) {
            console.warn(`Match ${matchId} has no adminId, skipping ball notifications`)
            return
        }

        const topicBase = `admin_${adminId}_match_${matchId}`

        // 1. Wicket
        if (ball.wicket || ball.isWicket) {
            const wicketType = ball.wicket?.type || ball.wicketType || 'out'
            const batterName = ball.batter?.name || ball.batterName || 'Batter'
            const bowlerName = ball.bowler?.name || ball.bowlerName || 'Bowler'

            // Construct message
            const body = `${batterName} ${getWicketDescription(wicketType, bowlerName)}`

            await sendNotificationToTopic(`${topicBase}_wickets`, {
                title: 'Wicket! 🔴',
                body: body,
                data: {
                    type: 'wicket',
                    matchId: matchId,
                    ballId: context.params.ballId
                }
            })
        }

        // 50s and 100s - requiring stats calculation or simple milestone check
        // For now, if ball.isMilestone is present (if engine adds it) we could use it.
    })

/**
 * Scheduled Task: Check for upcoming matches (15 mins before)
 * Runs every 15 minutes
 */
export const checkMatchReminders = functions.pubsub.schedule('every 15 minutes').onRun(async (context) => {
    const now = admin.firestore.Timestamp.now()

    // Query matches starting in near future
    const matchesSnap = await db.collection('matches')
        .where('status', 'in', ['upcoming', 'scheduled'])
        .get()

    for (const doc of matchesSnap.docs) {
        const match = doc.data()
        if (match.reminderSent) continue // Already sent

        // Get adminId
        const adminId = match.adminId || match.createdBy
        if (!adminId) {
            console.warn(`Match ${doc.id} has no adminId, skipping reminder`)
            continue
        }

        // Calculate start time
        let startTime: Date | null = null
        if (match.date) {
            let dStr = match.date
            if (typeof dStr !== 'string') {
                // handle timestamp
                dStr = dStr.toDate().toISOString().split('T')[0]
            }
            const d = new Date(dStr)

            if (match.time) {
                const [h, m] = match.time.split(':').map(Number)
                d.setHours(h, m)
            }
            startTime = d
        }

        if (!startTime) continue

        const diff = startTime.getTime() - now.toDate().getTime()
        const diffMins = diff / (60 * 1000)

        // If between 10 and 25 minutes (targeting 15 min mark)
        if (diffMins >= 10 && diffMins <= 25) {
            // Send Reminder
            const topic = `admin_${adminId}_match_${doc.id}_reminders`
            const title = `${match.teamAName || 'Team A'} vs ${match.teamBName || 'Team B'}`

            await sendNotificationToTopic(topic, {
                title: title,
                body: 'Match starts in 15 minutes',
                data: { type: 'reminder', matchId: doc.id }
            })

            // Mark as sent
            await doc.ref.update({ reminderSent: true })
        }
    }
})


// Helper to send FCM
async function sendNotificationToTopic(topic: string, message: { title: string, body: string, data?: any }) {
    try {
        const payload: admin.messaging.Message = {
            topic: topic,
            notification: {
                title: message.title,
                body: message.body,
            },
            data: message.data || {},
            android: {
                notification: {
                    icon: 'stock_ticker_update', // standard icon, customizable
                    color: '#ffffff',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK', // or PWA equivalent
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: 'default'
                    }
                }
            }
        }

        await messaging.send(payload)
        console.log(`Sent notification to ${topic}: ${message.title}`)
    } catch (error) {
        console.error(`Error sending notification to ${topic}:`, error)
    }
}

function getWicketDescription(type: string, bowler: string): string {
    if (!type) return `b ${bowler}`
    switch (type.toLowerCase()) {
        case 'bowled': return `b ${bowler}`
        case 'caught': return `c & b ${bowler}`
        case 'lbw': return `lbw ${bowler}`
        default: return `OUT (${type}) b ${bowler}`
    }
}
