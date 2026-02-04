package com.batchcrickbd;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable edge-to-edge display with transparent status bar
        setTransparentStatusBar();
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
