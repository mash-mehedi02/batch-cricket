import { motion, AnimatePresence } from 'framer-motion';
import { useLanguageStore } from '@/store/languageStore';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';

interface LanguageSelectionSheetProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function LanguageSelectionSheet({ isOpen, onClose }: LanguageSelectionSheetProps) {
    const { language, setLanguage } = useLanguageStore();
    const { isDarkMode } = useThemeStore();
    const { t } = useTranslation();

    const handleLanguageSelect = (lang: 'en' | 'bn') => {
        setLanguage(lang);
    };

    const handleSave = () => {
        onClose();
    };

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

                            <h2 className={`text-xl font-bold mb-8 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                {t('menu_select_language')}
                            </h2>

                            {/* Language Options Row */}
                            <div className="w-full flex justify-around mb-10 px-4">
                                {/* English Option */}
                                <button
                                    className="flex flex-col items-center gap-4 transition-all active:scale-95 group"
                                    onClick={() => handleLanguageSelect('en')}
                                >
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-sm border-2 transition-all ${language === 'en' ? 'bg-[#4285F4]/10 border-[#4285F4]' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent dark:border-white/5'}`}>
                                        🇺🇸
                                    </div>
                                    <div className="flex flex-col items-center gap-1.5">
                                        <span className={`text-[15px] font-bold tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                            {t('language_english')}
                                        </span>
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${language === 'en' ? 'border-[#4285F4]' : 'border-slate-300 dark:border-slate-600'}`}>
                                            {language === 'en' && (
                                                <div className="w-2.5 h-2.5 rounded-full bg-[#4285F4]" />
                                            )}
                                        </div>
                                    </div>
                                </button>

                                {/* Bengali Option */}
                                <button
                                    className="flex flex-col items-center gap-4 transition-all active:scale-95 group"
                                    onClick={() => handleLanguageSelect('bn')}
                                >
                                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-sm border-2 transition-all ${language === 'bn' ? 'bg-[#4285F4]/10 border-[#4285F4]' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent dark:border-white/5'}`}>
                                        🇧🇩
                                    </div>
                                    <div className="flex flex-col items-center gap-1.5">
                                        <span className={`text-[15px] font-bold tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                            {t('language_bengali')}
                                        </span>
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors ${language === 'bn' ? 'border-[#4285F4]' : 'border-slate-300 dark:border-slate-600'}`}>
                                            {language === 'bn' && (
                                                <div className="w-2.5 h-2.5 rounded-full bg-[#4285F4]" />
                                            )}
                                        </div>
                                    </div>
                                </button>
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                className="w-full bg-[#0d3b66] hover:bg-[#114b82] text-white py-4 rounded-[16px] font-bold text-[16px] transition-all active:scale-[0.98] shadow-lg shadow-blue-900/20"
                            >
                                {t('status_success')}
                            </button>
                        </motion.div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}
