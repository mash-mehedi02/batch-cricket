import OneSignal from 'react-onesignal';
import toast from 'react-hot-toast';

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = import.meta.env.VITE_ONESIGNAL_REST_API_KEY;

class OneSignalService {
    private initialized = false;

    /**
     * Initialize OneSignal
     */
    async init() {
        if (!ONESIGNAL_APP_ID) {
            console.warn('[OneSignal] Missing VITE_ONESIGNAL_APP_ID in .env');
            return;
        }

        if (this.initialized) {
            console.log('[OneSignal] Already initialized');
            return;
        }

        try {
            await OneSignal.init({
                appId: ONESIGNAL_APP_ID,
                allowLocalhostAsSecureOrigin: true,
                notifyButton: {
                    enable: false // We'll use our own UI
                }
            });
            this.initialized = true;
            console.log('[OneSignal] Initialized successfully');
        } catch (error) {
            console.error('[OneSignal] Init failed:', error);
        }
    }

    /**
     * Check if user is subscribed to push notifications
     */
    async isSubscribed(): Promise<boolean> {
        if (!this.initialized) return false;
        try {
            return await OneSignal.isPushNotificationsEnabled();
        } catch {
            return false;
        }
    }

    /**
     * Request notification permission
     */
    async requestPermission(): Promise<boolean> {
        if (!this.initialized) {
            await this.init();
        }

        try {
            await OneSignal.showNativePrompt();
            const subscribed = await OneSignal.isPushNotificationsEnabled();
            if (subscribed) {
                toast.success('Notifications enabled!');
            }
            return subscribed;
        } catch (error) {
            console.error('[OneSignal] Permission request failed:', error);
            toast.error('Failed to enable notifications');
            return false;
        }
    }

    /**
     * Subscribe to a specific match
     */
    async subscribeToMatch(matchId: string, adminId: string): Promise<void> {
        if (!this.initialized) {
            await this.init();
        }

        try {
            const tag = `match_${adminId}_${matchId}`;
            await OneSignal.sendTag(tag, 'subscribed');
            console.log(`[OneSignal] Subscribed to ${tag}`);
        } catch (error) {
            console.error('[OneSignal] Failed to subscribe to match:', error);
            throw error;
        }
    }

    /**
     * Unsubscribe from a specific match
     */
    async unsubscribeFromMatch(matchId: string, adminId: string): Promise<void> {
        if (!this.initialized) return;

        try {
            const tag = `match_${adminId}_${matchId}`;
            await OneSignal.deleteTag(tag);
            console.log(`[OneSignal] Unsubscribed from ${tag}`);
        } catch (error) {
            console.error('[OneSignal] Failed to unsubscribe from match:', error);
        }
    }

    /**
     * Subscribe to tournament notifications
     */
    async subscribeToTournament(tournamentId: string, adminId: string): Promise<void> {
        if (!this.initialized) {
            await this.init();
        }

        try {
            const tag = `tournament_${adminId}_${tournamentId}`;
            await OneSignal.sendTag(tag, 'subscribed');
            console.log(`[OneSignal] Subscribed to ${tag}`);
        } catch (error) {
            console.error('[OneSignal] Failed to subscribe to tournament:', error);
            throw error;
        }
    }

    /**
     * Unsubscribe from tournament notifications
     */
    async unsubscribeFromTournament(tournamentId: string, adminId: string): Promise<void> {
        if (!this.initialized) return;

        try {
            const tag = `tournament_${adminId}_${tournamentId}`;
            await OneSignal.deleteTag(tag);
            console.log(`[OneSignal] Unsubscribed from ${tag}`);
        } catch (error) {
            console.error('[OneSignal] Failed to unsubscribe from tournament:', error);
        }
    }

    /**
     * Send notification to specific match subscribers (from backend/admin)
     * This should ideally be called from backend, but can work from frontend with REST API key
     */
    async sendToMatch(
        matchId: string,
        adminId: string,
        title: string,
        message: string,
        url?: string
    ): Promise<boolean> {
        if (!ONESIGNAL_REST_API_KEY || !ONESIGNAL_APP_ID) {
            console.error('[OneSignal] Missing API credentials');
            return false;
        }

        try {
            const tag = `match_${adminId}_${matchId}`;
            const response = await fetch('https://onesignal.com/api/v1/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`
                },
                body: JSON.stringify({
                    app_id: ONESIGNAL_APP_ID,
                    filters: [
                        { field: 'tag', key: tag, relation: '=', value: 'subscribed' }
                    ],
                    headings: { en: title },
                    contents: { en: message },
                    url: url || `${window.location.origin}/match/${matchId}`
                })
            });

            const data = await response.json();
            if (data.errors) {
                console.error('[OneSignal] Send failed:', data.errors);
                return false;
            }
            console.log('[OneSignal] Notification sent:', data);
            return true;
        } catch (error) {
            console.error('[OneSignal] Send failed:', error);
            return false;
        }
    }

    /**
     * Get user's OneSignal Player ID
     */
    async getPlayerId(): Promise<string | null> {
        if (!this.initialized) return null;
        try {
            const userId = await OneSignal.getUserId();
            return userId;
        } catch {
            return null;
        }
    }
}

export const oneSignalService = new OneSignalService();
