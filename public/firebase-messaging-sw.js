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
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
