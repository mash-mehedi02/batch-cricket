import OneSignalWeb from 'react-onesignal';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

// IMPORTANT: Always use the absolute production URL for the notification proxy.
// Relative '/api/notify' only works when admin is on the deployed Vercel site.
// When scoring from localhost or native app, relative URLs fail silently.
const NOTIFY_API_URL = 'https://batchcrick.vercel.app/api/notify';

class OneSignalService {
    private initialized = false;
    private isNative = Capacitor.isNativePlatform();
    private initPromise: Promise<void> | null = null;

    private async checkStorageSupport(): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('storage_test');
                request.onerror = () => resolve(false);
                request.onsuccess = () => {
                    indexedDB.deleteDatabase('storage_test');
                    resolve(true);
                };
            } catch {
                resolve(false);
            }
        });
    }

    async init() {
        if (!ONESIGNAL_APP_ID) {
            console.error('[OneSignal] Missing App ID');
            return;
        }
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        const isStorageAvailable = await this.checkStorageSupport();
        if (!isStorageAvailable) {
            console.warn('[OneSignal] Storage (IndexedDB) is blocked. Initiative aborted to prevent crash.');
            this.initialized = true; // Mark as done to prevent retries
            return;
        }

        this.initPromise = (async () => {
            try {
                if (this.isNative) {
                    console.log('[OneSignal] Initializing Native SDK...');
                    try {
                        const OneSignalNative = (await import('onesignal-cordova-plugin')).default;
                        OneSignalNative.Debug.setLogLevel(6);
                        OneSignalNative.initialize(ONESIGNAL_APP_ID);

                        setTimeout(async () => {
                            try {
                                await OneSignalNative.Notifications.requestPermission(true);
                            } catch (permErr) {
                                console.error('[OneSignal] Permission request error:', permErr);
                            }
                        }, 2000);
                    } catch (nativeError) {
                        console.error('[OneSignal] Native Init Failed:', nativeError);
                    }
                } else {
                    // Web Initialization
                    try {
                        console.log('[OneSignal] Initializing Web SDK with App ID:', ONESIGNAL_APP_ID);

                        // Add a timeout to prevent hanging if script is blocked by Ad-blocker
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('init_timeout')), 10000)
                        );

                        await Promise.race([
                            OneSignalWeb.init({
                                appId: ONESIGNAL_APP_ID,
                                allowLocalhostAsSecureOrigin: true,
                                serviceWorkerParam: { scope: '/' },
                                serviceWorkerPath: 'OneSignalSDKWorker.js',
                                path: '/',
                            }),
                            timeoutPromise
                        ]);

                        console.log('[OneSignal] Web SDK initialized successfully');
                    } catch (webError: any) {
                        if (webError?.message === 'init_timeout') {
                            console.warn('[OneSignal] Initialization timed out. Likely an Ad-blocker.');
                        } else {
                            const msg = webError?.message || '';
                            if (msg.includes('already initialized')) {
                                console.warn('[OneSignal] SDK already initialized');
                            } else if (msg.includes('ServiceWorker')) {
                                console.warn('[OneSignal] Service worker error');
                            } else {
                                console.error('[OneSignal] Web Init Failed:', webError);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('[OneSignal] Global Init Error:', error);
            } finally {
                this.initialized = true;
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

    async subscribeToMatch(matchId: string): Promise<void> {
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

                console.log('[OneSignal Native] Requesting permission on trigger...');
                const accepted = await OneSignalNative.Notifications.requestPermission(true);

                if (accepted) {
                    OneSignalNative.User.addTag(tag, 'subscribed');
                    toast.success('Notifications enabled! 🔔');
                } else {
                    toast.error('Notification permission denied ❌');
                }
            } else {
                if (!this.initialized) await this.init();

                // Add safety delay
                await new Promise(resolve => setTimeout(resolve, 800));

                try {
                    // DYNAMIC METHOD DETECTION (v16 vs v15)
                    if ((OneSignalWeb as any).User?.addTag) {
                        console.log('[OneSignal Web] Using v16 User.addTag');
                        await (OneSignalWeb as any).User.addTag(tag, 'subscribed');
                    } else if ((OneSignalWeb as any).sendTag) {
                        console.log('[OneSignal Web] Using v15 sendTag');
                        await (OneSignalWeb as any).sendTag(tag, 'subscribed');
                    } else {
                        throw new Error('No tagging method found in OneSignal SDK');
                    }

                    toast.success('Notifications enabled! 🔔');
                } catch (err: any) {
                    // Handle 409 Conflict or other non-fatal errors
                    if (err?.message?.includes('Conflict') || err?.status === 409) {
                        console.warn('[OneSignal] Tag conflict (already updating), but subscription is likely processing.');
                        toast.success('Notifications enabled! 🔔');
                    } else {
                        throw err;
                    }
                }
            }
        } catch (error) {
            console.error('[OneSignal] Match tag failed:', error);
            // toast.error('Failed to enable notifications');
        }
    }

    async unsubscribeFromMatch(matchId: string): Promise<void> {
        try {
            if (!this.initialized) await this.init();
            const tag = `match_${matchId}`;

            if (this.isNative) {
                const OneSignalNative = (await import('onesignal-cordova-plugin')).default;
                OneSignalNative.User.removeTag(tag);
            } else {
                if ((OneSignalWeb as any).User?.removeTag) {
                    await (OneSignalWeb as any).User.removeTag(tag);
                } else if ((OneSignalWeb as any).deleteTag) {
                    await (OneSignalWeb as any).deleteTag(tag);
                }
            }
        } catch (error) {
            console.error('[OneSignal] Match untag failed:', error);
        }
    }

    async subscribeToTournament(tournamentId: string, adminId?: string): Promise<void> {
        try {
            if (!this.initialized) await this.init();
            const tag = `tournament_${adminId || 'admin'}_${tournamentId}`;

            if (this.isNative) {
                const OneSignalNative = (await import('onesignal-cordova-plugin')).default;
                OneSignalNative.User.addTag(tag, 'subscribed');
            } else {
                if ((OneSignalWeb as any).User?.addTag) {
                    await (OneSignalWeb as any).User.addTag(tag, 'subscribed');
                } else if ((OneSignalWeb as any).sendTag) {
                    await (OneSignalWeb as any).sendTag(tag, 'subscribed');
                }
            }
        } catch (error) {
            console.error('[OneSignal] Tournament tag failed:', error);
        }
    }

    async unsubscribeFromTournament(tournamentId: string, adminId?: string): Promise<void> {
        try {
            if (!this.initialized) await this.init();
            const tag = `tournament_${adminId || 'admin'}_${tournamentId}`;

            if (this.isNative) {
                const OneSignalNative = (await import('onesignal-cordova-plugin')).default;
                OneSignalNative.User.removeTag(tag);
            } else {
                if ((OneSignalWeb as any).User?.removeTag) {
                    await (OneSignalWeb as any).User.removeTag(tag);
                } else if ((OneSignalWeb as any).deleteTag) {
                    await (OneSignalWeb as any).deleteTag(tag);
                }
            }
        } catch (error) {
            console.error('[OneSignal] Tournament untag failed:', error);
        }
    }

    async sendToMatch(
        matchId: string,
        _adminId: string, // Kept with prefix to indicate intentionally unused but part of legacy API
        title: string,
        message: string,
        url?: string,
        icon?: string,
        buttons?: any[],
        collapseId?: string
    ): Promise<boolean> {
        if (!ONESIGNAL_APP_ID) {
            console.error('[OneSignal] Missing APP ID in environment');
            return false;
        }

        try {
            const tag = `match_${matchId}`;
            const targetUrl = url || `https://batchcrick.vercel.app/match/${matchId}`;

            console.log(`[OneSignal] Sending notification for match: ${tag}`);
            console.log(`[OneSignal] Title: ${title}`);
            console.log(`[OneSignal] Message: ${message}`);
            console.log(`[OneSignal] API URL: ${NOTIFY_API_URL}`);

            // ALWAYS use absolute URL for the Vercel API proxy.
            // This ensures notifications work whether admin is scoring from:
            // - localhost (dev server)
            // - deployed Vercel site 
            // - native Android app
            const response = await fetch(NOTIFY_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    appId: ONESIGNAL_APP_ID,
                    tag: tag,
                    title: title,
                    message: message,
                    url: targetUrl,
                    icon: icon,
                    buttons: buttons,
                    collapseId: collapseId || `match_${matchId}`
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('[OneSignal] Proxy send failed:', data);
                // Don't show toast for every failed notification to avoid spamming during scoring
                console.error('[OneSignal] Error details:', JSON.stringify(data));
                return false;
            }

            console.log('[OneSignal] ✅ Notification sent successfully:', data);
            // Only show success toast occasionally to avoid spam
            // toast.success('Notification Sent! 🚀');
            return true;
        } catch (error: any) {
            console.error('[OneSignal] Notification send failed:', error?.message || error);
            // Don't show error toast for every failed send to avoid disrupting scoring flow
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
