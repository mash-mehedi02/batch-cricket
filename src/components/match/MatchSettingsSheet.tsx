
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pin, Settings, Bell, Info } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    matchId: string;
    matchTitle: string;
}

export const MatchSettingsSheet: React.FC<Props> = ({ isOpen, onClose, matchId, matchTitle }) => {
    const [isPinned, setIsPinned] = useState(false);

    useEffect(() => {
        const pinnedId = localStorage.getItem('pinnedMatchId');
        setIsPinned(pinnedId === matchId);
    }, [matchId, isOpen]);

    const togglePin = () => {
        import('react-hot-toast').then(({ default: toast }) => {
            toast('Premium subscription is required to pin scores 🏏', {
                icon: '💎',
                style: { fontSize: '14px', fontWeight: 'bold', borderRadius: '12px', background: '#0f172a', color: '#fff' }
            });
        });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
                    />

                    {/* Sheet */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-[2.5rem] shadow-2xl z-[101] max-h-[85vh] overflow-hidden flex flex-col"
                    >
                        {/* Handle */}
                        <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto mt-4 mb-2" />

                        {/* Header */}
                        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                                    <Settings className="text-slate-600 dark:text-slate-400" size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 dark:text-white tracking-tight leading-none">Match Settings</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Preferences for this match</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* Note about Pinning */}
                            <div className="flex items-center gap-4 p-4 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                                <Pin size={20} className="text-slate-300 shrink-0" />
                                <p className="text-xs font-bold text-slate-400 leading-tight">
                                    Pin the live score to your screen using the pin icon in the match header.
                                </p>
                            </div>

                            {/* Note about Notifications */}
                            <div className="flex items-center gap-4 p-4 rounded-3xl border-2 border-dashed border-slate-100 dark:border-slate-800">
                                <Bell size={20} className="text-slate-300 shrink-0" />
                                <p className="text-xs font-bold text-slate-400 leading-tight">
                                    Notification settings can be accessed via the bell icon in the header.
                                </p>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-6 pt-2 pb-10">
                            <button
                                onClick={onClose}
                                className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-slate-200 dark:shadow-none hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                Close Settings
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
