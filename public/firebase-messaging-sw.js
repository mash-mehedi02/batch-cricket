importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyBBspPU6lQyxbuU0Bt8L2UKEThGlmYHiYc",
    authDomain: "sma-cricket-league.firebaseapp.com",
    projectId: "sma-cricket-league",
    storageBucket: "sma-cricket-league.firebasestorage.app",
    messagingSenderId: "899272110972",
    appId: "1:899272110972:web:62fe0c9bddf2129f7e6af9"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[FCM SW] Background message received:', payload);

    const title = payload.notification?.title || 'Cricket Update 🏏';
    const body = payload.notification?.body || '';
    const icon = payload.notification?.icon || '/icons/icon-192x192.png';
    const clickAction = payload.data?.click_action || payload.fcmOptions?.link || 'https://batchcrick.vercel.app';

    const notificationOptions = {
        body: body,
        icon: icon,
        badge: '/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        tag: payload.data?.matchId ? `match_${payload.data.matchId}` : 'default',
        renotify: true,
        data: {
            url: clickAction,
            matchId: payload.data?.matchId || null
        },
        actions: [
            { action: 'open', title: 'Open Match' }
        ]
    };

    self.registration.showNotification(title, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[FCM SW] Notification clicked:', event);
    event.notification.close();

    const url = event.notification.data?.url || 'https://batchcrick.vercel.app';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If a window is already open, focus it
            for (const client of clientList) {
                if (client.url.includes('batchcrick') && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            // Otherwise open a new window
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
