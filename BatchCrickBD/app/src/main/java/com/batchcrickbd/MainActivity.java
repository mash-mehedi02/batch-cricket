package com.batchcrickbd;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Native OneSignal Initialization (Bulletproof)
        try {
            com.onesignal.OneSignal.initWithContext(this, "76d0d60c-60ce-4e15-adf7-21166ae3522a");

            // Set global tags for production analytics
            com.onesignal.OneSignal.getUser().addTag("platform", "android");
            com.onesignal.OneSignal.getUser().addTag("all_matches", "active");
            com.onesignal.OneSignal.getUser().addTag("app_version", "1.0.1");

            // Request permission (Crucial for Android 13+)
            com.onesignal.OneSignal.getNotifications().requestPermission(true, com.onesignal.Continue.with(r -> {
                // Silently handle
            }));
        } catch (Exception e) {
            android.util.Log.e("OneSignal", "Init Error: " + e.getMessage());
        }

        // Enable edge-to-edge display with transparent status bar
        setTransparentStatusBar();

        // Create notification channel for Android 8.0+
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            String channelId = "match_updates";
            CharSequence name = "Match Updates";
            String description = "Notifications for wickets, boundaries, and match results";
            int importance = android.app.NotificationManager.IMPORTANCE_HIGH;
            android.app.NotificationChannel channel = new android.app.NotificationChannel(channelId, name, importance);
            channel.setDescription(description);
            channel.enableLights(true);
            channel.setLightColor(android.graphics.Color.RED);
            channel.enableVibration(true);

            android.app.NotificationManager notificationManager = getSystemService(
                    android.app.NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private void setTransparentStatusBar() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);

            // Matches PageHeader background #0f172a
            getWindow().setStatusBarColor(android.graphics.Color.parseColor("#0f172a"));

            // Set navigation bar color to match dark theme
            getWindow().setNavigationBarColor(android.graphics.Color.parseColor("#020617"));

            // Ensure icons are white (not dark)
            View decorView = getWindow().getDecorView();
            int flags = decorView.getSystemUiVisibility();
            flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            flags &= ~View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN; // Keep it fixed
            flags |= View.SYSTEM_UI_FLAG_LAYOUT_STABLE;
            decorView.setSystemUiVisibility(flags);
        }
    }
}
