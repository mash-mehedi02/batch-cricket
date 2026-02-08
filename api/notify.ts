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

    const { title, message, tag, appId, url } = req.body;
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
                    { field: 'tag', key: 'all_matches', relation: '=', value: 'active' }
                ],
                headings: { en: title },
                contents: { en: message },
                url: url
            })
        });

        const data = await response.json();
        return res.status(response.status).json(data);
    } catch (error: any) {
        console.error('[Notify API] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
