import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
    themePreference: ThemePreference;
    isDarkMode: boolean; // Keep for backward compatibility so existing UI doesn't break
    toggleDarkMode: () => void;
    setThemePreference: (pref: ThemePreference) => void;
}

const applyThemeRules = (isDark: boolean) => {
    if (isDark) {
        document.documentElement.classList.add('dark')
    } else {
        document.documentElement.classList.remove('dark')
    }
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            themePreference: 'system',
            // Initial isDarkMode computation is deferred to first client mount using mostly default False
            isDarkMode: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,

            toggleDarkMode: () => {
                const currentIsDark = get().isDarkMode;
                const newPref = currentIsDark ? 'light' : 'dark';
                set({ themePreference: newPref, isDarkMode: !currentIsDark });
                applyThemeRules(!currentIsDark);
            },

            setThemePreference: (pref: ThemePreference) => {
                let resolvedIsDark = false;
                if (pref === 'system') {
                    resolvedIsDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                } else {
                    resolvedIsDark = pref === 'dark';
                }

                set({ themePreference: pref, isDarkMode: resolvedIsDark });
                applyThemeRules(resolvedIsDark);
            }
        }),
        {
            name: 'theme-storage',
            // Correctly derive state when rehydrating based on saved preference
            onRehydrateStorage: () => (state) => {
                if (!state) return;

                let resolvedIsDark = false;
                if (state.themePreference === 'system') {
                    resolvedIsDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                } else {
                    resolvedIsDark = state.themePreference === 'dark';
                }

                // Immediately apply classes correctly
                applyThemeRules(resolvedIsDark);

                // Ensure state matches the resolved truth to prevent hydration mismatch quirks
                if (state.isDarkMode !== resolvedIsDark) {
                    useThemeStore.setState({ isDarkMode: resolvedIsDark });
                }
            },
        }
    )
)
