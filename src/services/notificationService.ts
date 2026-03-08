import { getToken, onMessage, type Messaging } from 'firebase/messaging'
import { Capacitor } from '@capacitor/core'
import toast from 'react-hot-toast'

export type NotificationType = 'all' | 'wickets' | 'reminders'

interface MatchNotificationSettings {
    all: boolean
    wickets: boolean
    reminders: boolean
}

const STORAGE_KEY = 'batchcrick_notifications'
const TOURNAMENT_STORAGE_KEY = 'batchcrick_tournament_notifications'

const PRODUCTION_URL = 'https://batchcrick.vercel.app'

// Determine the base URL for API calls. 
// On web, use relative URLs. On native (Capacitor), use absolute production URL.
const getBaseUrl = () => {
    if (typeof window === 'undefined') return '';
    if (Capacitor.isNativePlatform()) return PRODUCTION_URL;
    // If on localhost, use the production API for testing as localhost doesn't host /api
    if (window.location.hostname === 'localhost') return PRODUCTION_URL;
    return '';
};

const BASE_URL = getBaseUrl();
const FCM_SUBSCRIBE_URL = `${BASE_URL}/api/fcm-subscribe`;
const FCM_SEND_URL = `${BASE_URL}/api/fcm-send`;

class NotificationService {
    private messaging: Messaging | null = null
    private token: string | null = null
    private listeners: ((id: string, settings: any) => void)[] = []

    constructor() {
        this.initMessaging()
    }

    private async initMessaging() {
        if (typeof window === 'undefined') return
        try {
            const { messaging: firebaseMessaging } = await import('../config/firebase')
            this.messaging = firebaseMessaging
        } catch (error) {
            console.warn('[NotificationService] Failed to init messaging:', error)
        }
    }

    private async getMessagingInstance(): Promise<Messaging | null> {
        if (this.messaging) return this.messaging;

        // Retry initialization once if it was still in progress
        await this.initMessaging();
        return this.messaging;
    }

    /**
     * Subscribe to settings changes
     */
    addChangeListener(listener: (id: string, settings: any) => void) {
        this.listeners.push(listener)
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener)
        }
    }

    private notifyListeners(id: string, settings: any) {
        this.listeners.forEach(l => l(id, settings))
    }

    /**
     * Request notification permission and get FCM token
     */
    async requestPermission(): Promise<string | null> {
        // Handle Native Platform (Android/iOS)
        if (Capacitor.isNativePlatform()) {
            try {
                // Use dynamic import so it doesn't break web if not installed correctly
                const { PushNotifications } = await import('@capacitor/push-notifications');
                let perm = await PushNotifications.checkPermissions();

                if (perm.receive === 'prompt') {
                    perm = await PushNotifications.requestPermissions();
                }

                if (perm.receive !== 'granted') {
                    console.warn('[FCM] Native notification permission denied');
                    return null;
                }

                // Register with Apple/Google to receive a token
                await PushNotifications.register();

                // The actual token is received via the 'registration' listener
                // We'll return a promise that resolves when the listener fires
                return new Promise((resolve) => {
                    const setupListeners = async () => {
                        const regListener = await PushNotifications.addListener('registration', (token) => {
                            this.token = token.value;
                            console.log('[FCM] Native Token obtained:', token.value.substring(0, 20) + '...');
                            regListener.remove();
                            resolve(token.value);
                        });

                        const errListener = await PushNotifications.addListener('registrationError', (err) => {
                            console.error('[FCM] Native Registration error:', err);
                            errListener.remove();
                            resolve(null);
                        });
                    };

                    setupListeners();

                    // Set a timeout in case listeners don't fire
                    setTimeout(() => resolve(this.token), 10000);
                });
            } catch (error) {
                console.error('[FCM] Error in native notification setup:', error);
                // Fallback to web logic if plugin fails
            }
        }

        // Web/Browser Logic
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const msg = await this.getMessagingInstance();
                if (!msg) return null;

                // Explicitly register service worker to avoid "no active service worker" error
                if ('serviceWorker' in navigator) {
                    try {
                        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                        // Wait for service worker to be ready
                        await navigator.serviceWorker.ready;

                        const token = await getToken(msg, {
                            vapidKey: 'BK-cF82hQXHEq99VRHFqfJGcO1oQLiifIK_9RZbwkKTdlsg9ixWIB28cjrZAiR03gQGhhQtF_A77UUUmfBU_CWM',
                            serviceWorkerRegistration: registration
                        });

                        this.token = token;
                        console.log('[FCM] Web Token obtained:', token.substring(0, 20) + '...');
                        return token;
                    } catch (swError) {
                        console.error('[FCM] Service Worker registration failed:', swError);
                        // Fallback without explicit registration if it fails
                    }
                }

                // Fallback for environments where SW might be handled differently
                const token = await getToken(msg, {
                    vapidKey: 'BK-cF82hQXHEq99VRHFqfJGcO1oQLiifIK_9RZbwkKTdlsg9ixWIB28cjrZAiR03gQGhhQtF_A77UUUmfBU_CWM'
                });
                this.token = token;
                console.log('[FCM] Web Token obtained (fallback):', token.substring(0, 20) + '...');
                return token;
            } else {
                console.warn('[FCM] Web Notification permission denied');
                return null;
            }
        } catch (error) {
            console.error('[FCM] Error requesting web notification permission:', error);
            return null;
        }
    }

    /**
     * Get current FCM token (request permission if needed)
     */
    async getToken(): Promise<string | null> {
        if (this.token) return this.token
        return this.requestPermission()
    }

    /**
     * Subscribe to match notifications
     */
    async updateMatchSubscription(matchId: string, settings: MatchNotificationSettings) {
        this.saveSettings(matchId, settings)
        const anyEnabled = settings.all || settings.wickets || settings.reminders

        if (!anyEnabled) {
            const topic = `match_${matchId}`
            if (this.token) {
                await this.unsubscribe(topic)
            }
            toast.success('Match notifications disabled')
            return
        }

        if (!this.token) {
            const token = await this.requestPermission()
            if (!token) {
                this.saveSettings(matchId, { all: false, wickets: false, reminders: false })
                toast.error('Please allow notifications in your browser settings')
                return
            }
        }

        // Subscribe to match topic
        const topic = `match_${matchId}`
        await this.subscribe(topic)
        toast.success('Match notification settings updated! 🔔')
    }

    /**
     * Subscribe to tournament notifications
     */
    async updateTournamentSubscription(tournamentId: string, enabled: boolean) {
        if (!this.token) {
            const token = await this.requestPermission()
            if (!token) return
        }

        const topic = `tournament_${tournamentId}`

        if (enabled) {
            await this.subscribe(topic)
        } else {
            await this.unsubscribe(topic)
        }

        const stored = localStorage.getItem(TOURNAMENT_STORAGE_KEY)
        const data = stored ? JSON.parse(stored) : {}
        data[tournamentId] = enabled
        localStorage.setItem(TOURNAMENT_STORAGE_KEY, JSON.stringify(data))

        this.notifyListeners(tournamentId, enabled)
        toast.success(enabled ? 'Subscribed to tournament 🔔' : 'Unsubscribed from tournament')
    }

    /**
     * Send FCM notification to a match topic (called from admin scoring page)
     */
    async sendToMatch(
        matchId: string,
        title: string,
        message: string,
        url?: string,
        icon?: string,
        _buttons?: any[],
        _collapseId?: string,
        tournamentId?: string
    ): Promise<boolean> {
        try {
            const topic = `match_${matchId}`
            const targetUrl = url || `https://batchcrick.vercel.app/match/${matchId}`

            console.log(`[FCM] Sending notification to topic: ${topic}`)

            const response = await fetch(FCM_SEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: topic,
                    title: title,
                    message: message,
                    url: targetUrl,
                    icon: icon,
                    data: {
                        matchId: matchId,
                        type: 'match_update',
                    }
                })
            })

            const data = await response.json()

            if (!response.ok) {
                console.error('[FCM] Send failed:', data)
                return false
            }

            console.log('[FCM] ✅ Notification sent:', data)

            // Also send to tournament topic if available
            if (tournamentId) {
                fetch(FCM_SEND_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic: `tournament_${tournamentId}`,
                        title: title,
                        message: message,
                        url: targetUrl,
                        icon: icon,
                        data: { matchId, type: 'match_update' }
                    })
                }).catch(err => console.warn('[FCM] Tournament notification failed:', err))
            }

            return true
        } catch (error: any) {
            console.error('[FCM] Notification send failed:', error?.message || error)
            return false
        }
    }

    private async subscribe(topic: string) {
        if (!this.token) return
        try {
            console.log(`[FCM] Subscribing to topic: ${topic}`)
            const res = await fetch(FCM_SUBSCRIBE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: this.token,
                    topic: topic,
                    action: 'subscribe'
                })
            })

            if (!res.ok) {
                const text = await res.text();
                let errorDetails: any = text;
                try { errorDetails = JSON.parse(text); } catch (e) { /* ignore */ }
                console.error(`[FCM] Subscribe failed (${res.status}):`, errorDetails);
                if (errorDetails?.details) {
                    console.error('[FCM] Error Details:', errorDetails.details);
                }
                return;
            }

            const data = await res.json()
            console.log(`[FCM] ✅ Subscribed to ${topic}`, data)
        } catch (error) {
            console.error(`[FCM] Failed to subscribe to ${topic}`, error)
        }
    }

    private async unsubscribe(topic: string) {
        if (!this.token) return
        try {
            const res = await fetch(FCM_SUBSCRIBE_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: this.token,
                    topic: topic,
                    action: 'unsubscribe'
                })
            })

            if (!res.ok) {
                const text = await res.text();
                let errorDetails: any = text;
                try { errorDetails = JSON.parse(text); } catch (e) { /* ignore */ }
                console.error(`[FCM] Unsubscribe failed (${res.status}):`, errorDetails);
                if (errorDetails?.details) {
                    console.error('[FCM] Error Details:', errorDetails.details);
                }
                return;
            }

            const data = await res.json()
            console.log(`[FCM] ✅ Unsubscribed from ${topic}`, data)
        } catch (error) {
            console.error(`[FCM] Failed to unsubscribe from ${topic}`, error)
        }
    }

    getSettings(matchId: string): MatchNotificationSettings {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
            const data = JSON.parse(stored)
            return data[matchId] || { all: false, wickets: false, reminders: false }
        }
        return { all: false, wickets: false, reminders: false }
    }

    getTournamentSettings(tournamentId: string): boolean {
        const stored = localStorage.getItem(TOURNAMENT_STORAGE_KEY)
        if (stored) {
            const data = JSON.parse(stored)
            return data[tournamentId] || false
        }
        return false
    }

    private saveSettings(matchId: string, settings: MatchNotificationSettings) {
        const stored = localStorage.getItem(STORAGE_KEY)
        const data = stored ? JSON.parse(stored) : {}
        data[matchId] = settings
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        this.notifyListeners(matchId, settings)
    }

    async initForegroundMessages() {
        if (typeof window === 'undefined' || Capacitor.isNativePlatform()) return

        const msg = await this.getMessagingInstance();
        if (!msg) return;

        onMessage(msg, (payload) => {
            console.log('[FCM] Foreground message received:', payload)
            const { title, body } = payload.notification || {}
            if (title && body) {
                toast(body, {
                    icon: '🏏',
                    style: {
                        borderRadius: '10px',
                        background: '#333',
                        color: '#fff',
                    },
                    duration: 4000
                })
            }
        })
    }

    // Handle foreground messages (legacy support)
    onMessage(callback: (payload: any) => void) {
        this.getMessagingInstance().then(msg => {
            if (msg) onMessage(msg, callback);
        });
        return () => { }; // Note: Cannot easily return unregister function from async
    }
}

export const notificationService = new NotificationService()
