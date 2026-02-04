
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
                // Remove existing listeners if any
                if (backButtonListener) backButtonListener.remove();

                backButtonListener = await CapacitorApp.addListener('backButton', () => {
                    const currentPath = locationRef.current.pathname;

                    // Logic: If we are at the home/dashboard page, we exit.
                    // Otherwise, we try to go back in React Router history.
                    const isTabRoot = ['/', '/login', '/admin', '/admin/tournaments', '/admin/matches', '/admin/players', '/admin/squads'].includes(currentPath);

                    if (!isTabRoot) {
                        console.log('[Native] Navigating back from:', currentPath);
                        navigate(-1);
                    } else {
                        console.log('[Native] At root page or no history, exiting app');
                        CapacitorApp.exitApp();
                    }
                });
            } catch (e) {
                console.warn('Native back button handling failed', e);
            }
        };

        // 2. Configure Status Bar to be Transparent/Overlay
        const setupStatusBar = async () => {
            try {
                // Show status bar (don't hide)
                await StatusBar.show();

                // Set status bar background color to match PageHeader
                await StatusBar.setBackgroundColor({ color: '#0f172a' });

                // Ensure icons are white (for dark background)
                await StatusBar.setStyle({ style: 'DARK' as any });

                // Disable overlay so the status bar is fixed and doesn't overlap content
                await StatusBar.setOverlaysWebView({ overlay: false });
            } catch (e) {
                console.warn('Status bar setup failed', e);
            }
        };

        setupBackButton();
        setupStatusBar();

        // Cleanup listeners
        return () => {
            if (backButtonListener) {
                backButtonListener.remove();
            }
        };
    }, [navigate]);

    return null;
}
