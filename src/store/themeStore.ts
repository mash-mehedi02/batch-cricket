import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
    isDarkMode: boolean
    toggleDarkMode: () => void
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            isDarkMode: false,
            toggleDarkMode: () => set((state) => {
                const nextMode = !state.isDarkMode
                if (nextMode) {
                    document.documentElement.classList.add('dark')
                } else {
                    document.documentElement.classList.remove('dark')
                }
                return { isDarkMode: nextMode }
            }),
        }),
        {
            name: 'theme-storage',
            onRehydrateStorage: () => (state) => {
                if (state?.isDarkMode) {
                    document.documentElement.classList.add('dark')
                } else {
                    document.documentElement.classList.remove('dark')
                }
            },
        }
    )
)
