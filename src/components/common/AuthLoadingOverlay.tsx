import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ShieldCheck, Zap } from 'lucide-react';
import schoolConfig from '@/config/school';

interface AuthLoadingOverlayProps {
    isVisible: boolean;
    message?: string;
}

export default function AuthLoadingOverlay({ isVisible, message = "Securing Workspace..." }: AuthLoadingOverlayProps) {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
                >
                    {/* Decorative Circles */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
                        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-teal-500/20 rounded-full blur-[100px]" />
                        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-emerald-500/20 rounded-full blur-[100px]" />
                    </div>

                    <div className="relative">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                            className="w-24 h-24 border-2 border-dashed border-teal-500/30 rounded-full flex items-center justify-center"
                        >
                            <div className="w-20 h-20 border-2 border-teal-500/50 rounded-full animate-pulse" />
                        </motion.div>

                        <div className="absolute inset-0 flex items-center justify-center">
                            <motion.div
                                initial={{ scale: 0.8 }}
                                animate={{ scale: [0.8, 1.1, 1] }}
                                transition={{ duration: 0.5 }}
                                className="bg-gradient-to-br from-teal-500 to-emerald-600 p-4 rounded-2xl shadow-2xl shadow-teal-500/20 rotate-3"
                            >
                                <img
                                    src={schoolConfig.batchLogo}
                                    alt="Logo"
                                    className="w-10 h-10 object-contain brightness-0 invert"
                                />
                            </motion.div>
                        </div>
                    </div>

                    <div className="mt-10 space-y-4 max-w-xs">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter flex items-center justify-center gap-2">
                                <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                                {message}
                            </h3>
                            <p className="text-slate-400 text-xs font-semibold mt-2 uppercase tracking-[0.2em] leading-relaxed">
                                Syncing with identity engine
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="flex items-center justify-center gap-6 mt-8 border-t border-white/5 pt-8"
                        >
                            <div className="flex flex-col items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-teal-500" />
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Secure</span>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <Zap className="w-5 h-5 text-emerald-500" />
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Fast</span>
                            </div>
                        </motion.div>
                    </div>

                    <div className="absolute bottom-10 text-[10px] text-slate-600 font-black uppercase tracking-[0.3em]">
                        Powered by {schoolConfig.appName} Core
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
