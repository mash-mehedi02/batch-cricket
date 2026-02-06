import OneSignal from 'react-onesignal';

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

export const oneSignalService = {
    /**
     * Initialize OneSignal
     */
    async init() {
        if (!ONESIGNAL_APP_ID) {
            console.warn('[OneSignal] Missing VITE_ONESIGNAL_APP_ID in .env');
            return;
        }

        try {
            await OneSignal.init({
                appId: ONESIGNAL_APP_ID,
                allowLocalhostAsSecureOrigin: true,
                welcomeNotification: {
                    title: "BatchCrick BD",
                    message: "Welcome! You'll receive live match updates here."
                }
            });
            console.log('[OneSignal] Initialized');
        } catch (error) {
            console.error('[OneSignal] Init failed:', error);
        }
    },

    /**
     * Send a notification to all users via REST API
     * Note: For security, REST API calls should ideally be from backend,
     * but since we are avoiding Cloud Functions, we use foreground API.
     * This requires the REST API Key.
     */
    async sendBroadcast(title: string, message: string, url?: string) {
        const apiKey = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;
        if (!apiKey || !ONESIGNAL_APP_ID) {
            console.error('[OneSignal] Missing API Key or App ID in .env');
            return;
        }

        try {
            console.log('[OneSignal] Attempting to send broadcast...', { title, message });
            const response = await fetch('https://onesignal.com/api/v1/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Authorization': `Basic ${apiKey}`
                },
                body: JSON.stringify({
                    app_id: ONESIGNAL_APP_ID,
                    included_segments: ['Subscribed Users'],
                    headings: { en: title },
                    contents: { en: message },
                    url: url || window.location.origin
                })
            });

            const data = await response.json();
            if (data.errors) {
                console.error('[OneSignal] API Errors:', data.errors);
            } else {
                console.log('[OneSignal] Broadcast success:', data);
            }
            return data;
        } catch (error) {
            console.error('[OneSignal] Broadcast fetch failed (likely CORS):', error);
        }
    }
};
