
import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar } from '@capacitor/status-bar';
import { useLocation, useNavigate } from 'react-router-dom';

export default function NativeAppWrapper() {
    const location = useLocation();
    const navigate = useNavigate();
    const locationRef = useRef(location);

    // Keep refs updated with latest state for use in listener
    useEffect(() => {
        locationRef.current = location;
    }, [location]);

    useEffect(() => {
        let backButtonListener: any = null;

        // 1. Handle Hardware Back Button
        const setupBackButton = async () => {
            try {
                if (backButtonListener) backButtonListener.remove();
                backButtonListener = await CapacitorApp.addListener('backButton', () => {
                    const currentPath = locationRef.current.pathname;
                    const isTabRoot = ['/', '/login', '/admin', '/admin/tournaments', '/admin/matches', '/admin/players', '/admin/squads'].includes(currentPath);

                    if (!isTabRoot) {
                        navigate(-1);
                    } else {
                        CapacitorApp.exitApp();
                    }
                });
            } catch (e) { }
        };

        // 2. Configure Status Bar
        const setupStatusBar = async () => {
            try {
                const currentPath = locationRef.current.pathname;

                // Show status bar
                await StatusBar.show();

                // Fallback background color (important for some Android versions)
                await StatusBar.setBackgroundColor({ color: '#0f172a' });

                // Disable overlay (Content starts BELOW status bar)
                await StatusBar.setOverlaysWebView({ overlay: false });

                // Logic for icon style:
                // Style.Dark = White text/icons (for dark backgrounds)
                // Style.Light = Dark text/icons (for light backgrounds)

                // Match Pages (Detail), Home, Squad Details, Tournament Details, Player Details are all DARK BLUE
                const isDarkBluePage = currentPath === '/' ||
                    /^\/(match|squads|players|tournaments)\/.+/.test(currentPath);

                if (isDarkBluePage) {
                    await StatusBar.setStyle({ style: 'DARK' as any });
                } else {
                    // Admin pages or List pages are usually LIGHT/WHITE
                    await StatusBar.setBackgroundColor({ color: '#ffffff' });
                    await StatusBar.setStyle({ style: 'LIGHT' as any });
                }
            } catch (e) { }
        };

        setupBackButton();
        setupStatusBar();

        return () => {
            if (backButtonListener) {
                backButtonListener.remove();
            }
        };
    }, [navigate, location.pathname]);

    return null;
}
