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

    if (!restKey || !appId) {
        return res.status(500).json({ error: 'Server configuration error: Missing API Key' });
    }

    try {
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${restKey}`
            },
            body: JSON.stringify({
                app_id: appId,
                filters: [
                    { field: 'tag', key: tag, relation: '=', value: 'subscribed' },
                    { operator: 'OR' },
                    { field: 'tag', key: 'all_matches', relation: '=', value: 'active' }
                ],
                headings: { en: title },
                contents: { en: message },
                url: url,
                large_icon: icon, // Professional team logo
                buttons: buttons, // Action buttons like "Open Match"
                collapse_id: collapseId, // Makes notifications dynamic (replaces previous score)
                android_group: 'match_updates',
                thread_id: collapseId, // iOS equivalent for grouping

                // Heads-up display (popup) settings
                priority: 10, // High priority for immediate popup
                android_visibility: 1, // Public
                android_accent_color: '0D9488', // Teal accent matching app theme
                android_led_color: '0D9488',
                huawei_priority: 10,

                // Ensure it makes sound/vibrates to trigger the popup
                vibration_pattern: [200, 200, 200],
                android_channel_id: 'match_alerts' // Ensure this channel has high importance in Android settings
            })
        });

        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (error: any) {
        console.error('[Notify API] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
