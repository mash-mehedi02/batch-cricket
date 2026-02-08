import OneSignalWeb from 'react-onesignal';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

class OneSignalService {
    private initialized = false;
    private isNative = Capacitor.isNativePlatform();
    private initPromise: Promise<void> | null = null;

    async init() {
        if (!ONESIGNAL_APP_ID) {
            console.error('[OneSignal] Missing App ID');
            return;
        }
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                if (this.isNative) {
                    console.log('[OneSignal] Initializing Native SDK...');
                    // toast('OneSignal Starting...', { id: 'os-init' });

                    try {
                        const OneSignalNative = (await import('onesignal-cordova-plugin')).default;

                        // Verbose logging for debugging
                        OneSignalNative.Debug.setLogLevel(6);

                        OneSignalNative.initialize(ONESIGNAL_APP_ID);
                        console.log('[OneSignal] Native SDK initialized');

                        // Request permission with a slight delay to ensure UI is ready
                        setTimeout(() => {
                            // toast('Requesting Permission...', { icon: '🔔' });
                            OneSignalNative.Notifications.requestPermission(true).then((accepted: boolean) => {
                                console.log('[OneSignal] Permission result:', accepted);
                                if (accepted) {
                                    // toast.success('Notifications Enabled! ✅');
                                } else {
                                    console.warn('[OneSignal] Permission Denied');
                                    // toast.error('Notifications Denied ❌');
                                }
                            });
                        }, 2000);

                        this.initialized = true;
                    } catch (nativeError) {
                        console.error('[OneSignal] Native Init Failed:', nativeError);
                        toast.error('Push Init Failed: ' + nativeError);
                    }
                } else {
                    // Web Initialization
                    await OneSignalWeb.init({
                        appId: ONESIGNAL_APP_ID,
                        allowLocalhostAsSecureOrigin: true,
                    });
                    this.initialized = true;
                }
            } catch (error) {
                console.error('[OneSignal] Global Init Error:', error);
            } finally {
                this.initPromise = null;
            }
        })();

        return this.initPromise;
    }

    async isSubscribed(): Promise<boolean> {
        if (!this.isNative && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            return true; // Mock for local testing
        }
        try {
            if (!this.initialized) await this.init();
            if (this.isNative) return true;

            const permission = OneSignalWeb.Notifications.permission === true;
            console.log('[OneSignal] Current permission state:', OneSignalWeb.Notifications.permission);
            return permission;
        } catch (e) {
            console.error('[OneSignal] isSubscribed error:', e);
            return false;
        }
    }

    async requestPermission(): Promise<boolean> {
        if (!this.isNative && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            return true;
        }
        try {
            if (!this.initialized) await this.init();

            if (this.isNative) {
                const OneSignalNative = (await import('onesignal-cordova-plugin')).default;
                console.log('[OneSignal] Requesting native permission explicitly...');

                return new Promise((resolve) => {
                    OneSignalNative.Notifications.requestPermission(true).then((accepted: boolean) => {
                        console.log('[OneSignal] Native permission decision:', accepted);
                        if (accepted) toast.success('Notifications Enabled! ✅');
                        else toast.error('Permission Denied ❌');
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
            const tag = `match_${matchId}`;
            console.log(`[OneSignal] Subscribing to: ${tag}`);

            if (this.isNative) {
                if (!this.initialized) await this.init();
                const OneSignalNative = (await import('onesignal-cordova-plugin')).default;

                // Native v5 Tagging
                OneSignalNative.User.addTag(tag, 'subscribed');
                console.log(`[OneSignal Native] Tag added: ${tag}`);
                toast.success('Match notifications enabled! 🏏');
            } else {
                if (!this.initialized) await this.init();
                await OneSignalWeb.User.addTag(tag, 'subscribed');
                toast.success('Notifications enabled! 🔔');
            }
        } catch (error) {
            console.error('[OneSignal] Match tag failed:', error);
            toast.error('Failed to enable notifications');
        }
    }

    async unsubscribeFromMatch(matchId: string, adminId: string): Promise<void> {
        try {
            if (!this.initialized) await this.init();
            const tag = `match_${matchId}`;

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
            const tag = `match_${matchId}`;
            const targetUrl = url || `https://batchcrick.vercel.app/match/${matchId}`;

            console.log(`[OneSignal] Attempting to notify match: ${tag}`);

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
                    url: targetUrl
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[OneSignal] Proxy send failed:', errorData);
                toast.error('Notification failed: ' + (errorData.errors?.[0] || errorData.error || 'Server error'));
                return false;
            }

            console.log('[OneSignal] Notification sent via proxy successfully');
            toast.success('Notification Sent! 🚀');
            return true;
        } catch (error: any) {
            console.error('[OneSignal] Notification send failed:', error);
            toast.error('Notification system unavailable');
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
