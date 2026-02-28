import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { title, message, tag, appId, url, icon, buttons, collapseId } = req.body;
    const restKey = process.env.ONESIGNAL_REST_API_KEY;

    console.log('[Notify API] Received request:', { title, message, tag, appId: appId?.substring(0, 8) + '...', url });

    if (!restKey) {
        console.error('[Notify API] ONESIGNAL_REST_API_KEY is not set in Vercel environment!');
        return res.status(500).json({ error: 'Server configuration error: Missing REST API Key. Set ONESIGNAL_REST_API_KEY in Vercel environment variables.' });
    }

    if (!appId) {
        return res.status(400).json({ error: 'Missing appId in request body' });
    }

    try {
        const payload = {
            app_id: appId,
            filters: [
                { field: 'tag', key: tag, relation: '=', value: 'subscribed' },
                { operator: 'OR' },
                { field: 'tag', key: 'all_matches', relation: '=', value: 'active' }
            ],
            headings: { en: title },
            contents: { en: message },
            url: url,
            large_icon: icon,
            buttons: buttons,
            collapse_id: collapseId,
            android_group: 'match_updates',
            thread_id: collapseId,

            // High priority for immediate popup
            priority: 10,
            android_visibility: 1,
            android_accent_color: '0D9488',
            android_led_color: '0D9488',
            huawei_priority: 10,

            // Sound/vibration
            vibration_pattern: [200, 200, 200],
            // android_channel_id: 'match_alerts', // Removed to avoid 400 error if not created in OneSignal dashboard

            // Target ALL platforms (web + mobile)
            isAnyWeb: true,
        };

        console.log('[Notify API] Sending to OneSignal with tag filter:', tag);

        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${restKey}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        console.log('[Notify API] OneSignal response status:', response.status);
        console.log('[Notify API] OneSignal response:', JSON.stringify(data));

        // OneSignal returns 200 even if no subscribers match — check recipients
        if (data.recipients === 0) {
            console.warn('[Notify API] No subscribers matched the tag filter:', tag);
        }

        return res.status(response.status).json(data);
    } catch (error: any) {
        console.error('[Notify API] Error:', error?.message || error);
        return res.status(500).json({ error: error.message });
    }
}
