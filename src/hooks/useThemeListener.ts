import { useEffect } from 'react';
import { useThemeStore } from '@/store/themeStore';

export function useThemeListener() {
    const { themePreference, isDarkMode, setThemePreference } = useThemeStore();

    useEffect(() => {
        // Only attach listener if preference is explicitly 'system'
        if (themePreference !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = () => {
            // Because our store logic updates `isDarkMode` based on media query when preference is 'system',
            // we just need to re-trigger the set logic to apply classes. 
            // The cleanest way is to just call setThemePreference('system') again.
            setThemePreference('system');
        };

        // Modern browser API
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
        } else {
            // Fallback for older browsers
            mediaQuery.addListener(handleChange);
        }

        return () => {
            if (mediaQuery.removeEventListener) {
                mediaQuery.removeEventListener('change', handleChange);
            } else {
                mediaQuery.removeListener(handleChange);
            }
        };
    }, [themePreference, setThemePreference]);

    // We intentionally return the resolved state boolean for convenience if needed
    return { isDarkMode };
}
