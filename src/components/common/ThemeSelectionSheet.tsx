import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '@/store/themeStore';

interface ThemeSelectionSheetProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ThemeSelectionSheet({ isOpen, onClose }: ThemeSelectionSheetProps) {
    const { themePreference, setThemePreference, isDarkMode } = useThemeStore();

    const handleThemeSelect = (pref: 'light' | 'dark') => {
        setThemePreference(pref);
    };

    const handleDeviceSettingsToggle = () => {
        if (themePreference === 'system') {
            // Revert back to what it currently resolves to
            setThemePreference(isDarkMode ? 'dark' : 'light');
        } else {
            setThemePreference('system');
        }
    };

    const handleSave = () => {
        onClose(); // Changes are applied instantly to the store
    };

    const isSystemMuted = themePreference === 'system';

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Sheet Container */}
                    <div className="relative w-full max-w-sm">
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className={`${isDarkMode ? 'bg-[#151f2e]' : 'bg-white'} rounded-t-[24px] p-6 pb-10 shadow-2xl flex flex-col items-center safe-area-pb`}
                        >
                            {/* Drag Handle */}
                            <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mb-6 -mt-2 opacity-50" />

                            {/* App Preview Image Container */}
                            <div className="w-full h-auto aspect-[4/3] bg-slate-100 dark:bg-[#0f172a] rounded-[20px] relative overflow-hidden mb-6 shadow-xl border border-black/5 dark:border-white/5 flex items-center justify-center p-2">
                                <img
                                    src={isDarkMode ? '/images/theme/dark.png' : '/images/theme/light.png'}
                                    alt={isDarkMode ? 'Dark Theme Preview' : 'Light Theme Preview'}
                                    className="w-full h-full object-contain rounded-[16px] overflow-hidden"
                                />
                            </div>

                            {/* Theme Selection Row */}
                            <div className="w-full flex justify-around mb-8 px-4">
                                {/* Dark Option */}
                                <div
                                    className={`flex flex-col items-center gap-3 transition-opacity ${isSystemMuted ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
                                    onClick={() => handleThemeSelect('dark')}
                                >
                                    <span className={`text-[15px] font-semibold tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Dark</span>
                                    <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center border-2 transition-colors ${themePreference === 'dark' ? 'border-[#4285F4]' : 'border-slate-300 dark:border-slate-600'}`}>
                                        {themePreference === 'dark' && (
                                            <div className="w-3 h-3 rounded-full bg-[#4285F4]" />
                                        )}
                                    </div>
                                </div>

                                {/* Light Option */}
                                <div
                                    className={`flex flex-col items-center gap-3 transition-opacity ${isSystemMuted ? 'opacity-30 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`}
                                    onClick={() => handleThemeSelect('light')}
                                >
                                    <span className={`text-[15px] font-semibold tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Light</span>
                                    <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center border-2 transition-colors ${themePreference === 'light' ? 'border-[#4285F4]' : 'border-slate-300 dark:border-slate-600'}`}>
                                        {themePreference === 'light' && (
                                            <div className="w-3 h-3 rounded-full bg-[#4285F4]" />
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="w-full border-b border-slate-100 dark:border-white/5 mb-6" />

                            {/* Device Settings Toggle */}
                            <div className="w-full flex items-center justify-between mb-8">
                                <div className="flex flex-col">
                                    <span className={`text-[15px] font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Use device settings</span>
                                    <span className="text-[13px] text-slate-500 dark:text-slate-400">Your phone theme</span>
                                </div>

                                {/* Custom Toggle */}
                                <div
                                    className={`w-12 h-[26px] rounded-full flex items-center transition-colors px-1 cursor-pointer shadow-inner ${themePreference === 'system' ? 'bg-[#0d3b66]' : 'bg-slate-200 dark:bg-slate-700'}`}
                                    onClick={handleDeviceSettingsToggle}
                                >
                                    <motion.div
                                        className="w-[18px] h-[18px] rounded-full bg-white shadow-md relative"
                                        animate={{ x: themePreference === 'system' ? 22 : 0 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                    >
                                    </motion.div>
                                </div>
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                className="w-full bg-[#0d3b66] hover:bg-[#114b82] text-white py-3.5 rounded-[12px] font-semibold text-[15px] transition-colors active:scale-[0.98]"
                            >
                                Save Changes
                            </button>
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}

