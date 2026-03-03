import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';

/**
 * Vercel Serverless Function: Send FCM Topic Notification
 * Replaces OneSignal with Firebase Cloud Messaging HTTP v1 API
 * 
 * POST /api/fcm-send
 * Body: { topic, title, message, data?, icon?, url? }
 */

async function getAccessToken(): Promise<string | null> {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
        console.error('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON env var not set');
        return null;
    }

    try {
        const sa = JSON.parse(serviceAccountJson);
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
        const now = Math.floor(Date.now() / 1000);
        const payload = Buffer.from(JSON.stringify({
            iss: sa.client_email,
            scope: 'https://www.googleapis.com/auth/firebase.messaging',
            aud: sa.token_uri,
            exp: now + 3600,
            iat: now
        })).toString('base64url');

        const signInput = `${header}.${payload}`;
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(signInput);
        const signature = sign.sign(sa.private_key, 'base64url');
        const jwt = `${signInput}.${signature}`;

        const tokenRes = await fetch(sa.token_uri, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
        });

        const tokenData = await tokenRes.json();
        return tokenData.access_token || null;
    } catch (err: any) {
        console.error('[FCM] Token generation failed:', err?.message);
        return null;
    }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { topic, title, message, data, icon, url } = req.body;
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'sma-cricket-league';

    if (!topic || !title || !message) {
        return res.status(400).json({ error: 'Missing required fields: topic, title, message' });
    }

    console.log(`[FCM Send] Topic: ${topic}, Title: ${title}`);

    const accessToken = await getAccessToken();
    if (!accessToken) {
        return res.status(500).json({ error: 'Failed to generate FCM access token' });
    }

    const fcmPayload: any = {
        message: {
            topic: topic,
            notification: {
                title: title,
                body: message,
            },
            data: {
                ...(data || {}),
                click_action: url || `https://batchcrick.vercel.app`,
                icon: icon || '',
            },
            webpush: {
                notification: {
                    title: title,
                    body: message,
                    icon: icon || '/icons/icon-192x192.png',
                    badge: '/icons/icon-72x72.png',
                    click_action: url || `https://batchcrick.vercel.app`,
                    vibrate: [200, 100, 200],
                },
                fcm_options: {
                    link: url || `https://batchcrick.vercel.app`,
                }
            },
            android: {
                priority: 'high' as const,
                notification: {
                    icon: 'ic_notification',
                    color: '#0D9488',
                    sound: 'default',
                    click_action: 'OPEN_MATCH',
                }
            }
        }
    };

    try {
        const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
        const fcmRes = await fetch(fcmUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(fcmPayload),
        });

        const fcmData = await fcmRes.json();
        console.log(`[FCM Send] Response (${fcmRes.status}):`, JSON.stringify(fcmData));

        if (!fcmRes.ok) {
            return res.status(fcmRes.status).json({ error: 'FCM send failed', details: fcmData });
        }

        return res.status(200).json({ success: true, messageId: fcmData.name });
    } catch (err: any) {
        console.error('[FCM Send] Error:', err?.message);
        return res.status(500).json({ error: err.message });
    }
}
