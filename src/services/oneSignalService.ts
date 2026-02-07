import OneSignalWeb from 'react-onesignal';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

class OneSignalService {
    private initialized = false;
    private isNative = Capacitor.isNativePlatform();
    private initPromise: Promise<void> | null = null;

    async init() {
        if (!ONESIGNAL_APP_ID) return;
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                if (this.isNative) {
                    // Native Android/iOS Initialization
                    console.log('[OneSignal] Initializing Native SDK...');
                    const OneSignalNative = (await import('onesignal-cordova-plugin')).default;
                    OneSignalNative.initialize(ONESIGNAL_APP_ID);

                    // Request permission on native
                    OneSignalNative.Notifications.requestPermission(true).then((accepted: boolean) => {
                        console.log('[OneSignal] Native permission:', accepted);
                    });

                    this.initialized = true;
                    console.log('[OneSignal] Native Initialized');
                } else {
                    // Web Initialization
                    console.log('[OneSignal] Initializing Web SDK...');
                    try {
                        await OneSignalWeb.init({
                            appId: ONESIGNAL_APP_ID,
                            allowLocalhostAsSecureOrigin: true,
                        });
                        this.initialized = true;
                        console.log('[OneSignal] Web Initialized');
                    } catch (e: any) {
                        const msg = e?.toString() || '';
                        if (msg.includes('already initialized')) {
                            this.initialized = true;
                            console.log('[OneSignal] Web SDK was already initialized');
                        } else {
                            throw e;
                        }
                    }
                }
            } catch (error: any) {
                const errMsg = error?.toString() || '';
                if (errMsg.includes('Can only be used on') && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                    console.warn('[OneSignal] Skipping web init on localhost due to domain restriction.');
                    this.initialized = true; // Set to true to prevent infinite retry loops on localhost
                } else {
                    console.error('[OneSignal] Init error:', error);
                }
            } finally {
                this.initPromise = null;
            }
        })();

        return this.initPromise;
    }

    async isSubscribed(): Promise<boolean> {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return true; // Mock for local testing
        }
        try {
            if (!this.initialized) await this.init();
            if (this.isNative) return true;
            return OneSignalWeb.Notifications.permission === true;
        } catch {
            return false;
        }
    }

    async requestPermission(): Promise<boolean> {
        if (!this.isNative && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            return true; // Mock for local testing
        }
        try {
            if (!this.initialized) await this.init();

            if (this.isNative) {
                const OneSignalNative = (await import('onesignal-cordova-plugin')).default;
                console.log('[OneSignal] Requesting native permission explicitly...');

                // OneSignal's prompt for push notifications
                return new Promise((resolve) => {
                    OneSignalNative.Notifications.requestPermission(true).then((accepted: boolean) => {
                        console.log('[OneSignal] Native permission decision:', accepted);
                        resolve(accepted);
                    });
                });
            } else {
                if (Notification.permission === 'denied') {
                    toast.error('Notifications blocked in browser settings');
                    return false;
                }
                const result = await OneSignalWeb.Notifications.requestPermission();
                console.log('[OneSignal] Web permission request result:', result);
                return result === true;
            }
        } catch (error) {
            console.error('[OneSignal] Permission request failed:', error);
            return false;
        }
    }

    async subscribeToMatch(matchId: string, adminId: string): Promise<void> {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log(`[OneSignal Mock] Subscribed to match locally: ${matchId}`);
            return;
        }
        try {
            if (!this.initialized) await this.init();
            const tag = `match_${adminId || 'admin'}_${matchId}`;

            if (this.isNative) {
                const OneSignalNative = (await import('onesignal-cordova-plugin')).default;
                OneSignalNative.User.addTag(tag, 'subscribed');
            } else {
                await OneSignalWeb.User.addTag(tag, 'subscribed');
            }
            console.log(`[OneSignal] Subscribed to match: ${tag}`);
        } catch (error) {
            console.error('[OneSignal] Match tag failed:', error);
        }
    }

    async unsubscribeFromMatch(matchId: string, adminId: string): Promise<void> {
        try {
            if (!this.initialized) await this.init();
            const tag = `match_${adminId || 'admin'}_${matchId}`;

            if (this.isNative) {
                const OneSignalNative = (await import('onesignal-cordova-plugin')).default;
                OneSignalNative.User.removeTag(tag);
            } else {
                await OneSignalWeb.User.removeTag(tag);
            }
        } catch (error) {
            console.error('[OneSignal] Match untag failed:', error);
        }
    }

    async subscribeToTournament(tournamentId: string, adminId: string): Promise<void> {
        try {
            if (!this.initialized) await this.init();
            const tag = `tournament_${adminId || 'admin'}_${tournamentId}`;

            if (this.isNative) {
                const OneSignalNative = (await import('onesignal-cordova-plugin')).default;
                OneSignalNative.User.addTag(tag, 'subscribed');
            } else {
                await OneSignalWeb.User.addTag(tag, 'subscribed');
            }
        } catch (error) {
            console.error('[OneSignal] Tournament tag failed:', error);
        }
    }

    async unsubscribeFromTournament(tournamentId: string, adminId: string): Promise<void> {
        try {
            if (!this.initialized) await this.init();
            const tag = `tournament_${adminId || 'admin'}_${tournamentId}`;

            if (this.isNative) {
                const OneSignalNative = (await import('onesignal-cordova-plugin')).default;
                OneSignalNative.User.removeTag(tag);
            } else {
                await OneSignalWeb.User.removeTag(tag);
            }
        } catch (error) {
            console.error('[OneSignal] Tournament untag failed:', error);
        }
    }

    async sendToMatch(
        matchId: string,
        adminId: string,
        title: string,
        message: string,
        url?: string
    ): Promise<boolean> {
        if (!ONESIGNAL_APP_ID) {
            console.error('[OneSignal] Missing APP ID in environment');
            return false;
        }

        try {
            const tag = `match_${adminId || 'admin'}_${matchId}`;
            // Use our Vercel API route as a proxy to avoid CORS and hide the REST Key
            const response = await fetch('/api/notify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    appId: ONESIGNAL_APP_ID,
                    tag: tag,
                    title: title,
                    message: message,
                    url: url || `${window.location.origin}/match/${matchId}`
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[OneSignal] Proxy send failed:', errorData);
                // toast.error('Failed to send notification: ' + (errorData.error || 'Unknown error'));
                return false;
            }

            console.log('[OneSignal] Notification sent via proxy successfully');
            return true;
        } catch (error: any) {
            console.error('[OneSignal] Notification send failed:', error);
            // toast.error('Notification error: ' + error.message);
            return false;
        }
    }

    async getPlayerId(): Promise<string | null> {
        if (!this.initialized) return null;
        if (this.isNative) {
            // Native player ID tracking is slightly different
            return 'native-user';
        }
        return OneSignalWeb.User.onesignalId || null;
    }
}

export const oneSignalService = new OneSignalService();
