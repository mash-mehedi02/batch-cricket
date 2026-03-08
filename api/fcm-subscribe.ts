import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as crypto from 'crypto';

/**
 * Vercel Serverless Function: Subscribe/Unsubscribe FCM token to/from a topic
 * Uses the Firebase Instance ID API
 * 
 * POST /api/fcm-subscribe
 * Body: { token, topic, action: 'subscribe' | 'unsubscribe' }
 */

async function getAccessToken(): Promise<string | null> {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
        console.error('[FCM Subscribe] FIREBASE_SERVICE_ACCOUNT_JSON env var not set');
        return null;
    }

    try {
        const sa = JSON.parse(serviceAccountJson);
        const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
        const now = Math.floor(Date.now() / 1000);

        // Scope needs to be broad enough for IID API topic management via Bearer token
        const scope = [
            'https://www.googleapis.com/auth/firebase.messaging',
            'https://www.googleapis.com/auth/cloud-platform'
        ].join(' ');

        const payload = Buffer.from(JSON.stringify({
            iss: sa.client_email,
            scope: scope,
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
        if (!tokenData.access_token) {
            console.error('[FCM Subscribe] No access token in response:', tokenData);
        }
        return tokenData.access_token || null;
    } catch (err: any) {
        console.error('[FCM Subscribe] Token generation failed:', err?.message);
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

    const { token, topic, action } = req.body;

    if (!token || !topic) {
        return res.status(400).json({ error: 'Missing required fields: token, topic' });
    }

    const subscribeAction = action === 'unsubscribe' ? 'unsubscribe' : 'subscribe';
    console.log(`[FCM ${subscribeAction}] Token: ${token.substring(0, 20)}... Topic: ${topic}`);

    const accessToken = await getAccessToken();
    if (!accessToken) {
        return res.status(500).json({ error: 'Failed to generate access token' });
    }

    try {
        // Use the IID (Instance ID) API v1 for topic management
        const iidUrl = `https://iid.googleapis.com/iid/v1:batch${subscribeAction === 'subscribe' ? 'Add' : 'Remove'}`;

        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        const sa = JSON.parse(serviceAccountJson || '{}'); // Parse again to get project_id
        const projectId = sa.project_id || 'sma-cricket-league';
        console.log(`[FCM ${subscribeAction}] Using project: ${projectId}`);
        console.log(`[FCM ${subscribeAction}] Token starts with: ${token.substring(0, 10)}...`);

        const iidRes = await fetch(iidUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'x-goog-user-project': projectId // Sometimes required for certain APIs
            },
            body: JSON.stringify({
                to: `/topics/${topic}`,
                registration_tokens: [token],
            }),
        });

        const iidData = await iidRes.json();
        console.log(`[FCM ${subscribeAction}] Google API Status: ${iidRes.status}`);

        if (!iidRes.ok) {
            console.error(`[FCM ${subscribeAction}] Google API Error (${iidRes.status}):`, JSON.stringify(iidData));
            return res.status(iidRes.status).json({
                error: `${subscribeAction} failed`,
                status: iidRes.status,
                details: iidData,
                projectId: projectId
            });
        }

        return res.status(200).json({ success: true, action: subscribeAction, topic });
    } catch (err: any) {
        console.error(`[FCM ${subscribeAction}] Unexpected Error:`, err?.message);
        return res.status(500).json({ error: err.message });
    }
}
