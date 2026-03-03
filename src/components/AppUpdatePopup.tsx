/**
 * App Update Popup — Premium "New Update Available" modal
 * Shows on app launch if the current version is older than the latest.
 * User can dismiss, but popup returns on next app open.
 * If isForceUpdate is true, user cannot dismiss.
 */

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Rocket, Download } from 'lucide-react'
import { appUpdateService, AppUpdateInfo, APP_VERSION } from '@/services/appUpdateService'
import { Capacitor } from '@capacitor/core'

export default function AppUpdatePopup() {
    const [show, setShow] = useState(false)
    const [info, setInfo] = useState<AppUpdateInfo | null>(null)

    useEffect(() => {
        const check = async () => {
            try {
                const { available, info: updateInfo } = await appUpdateService.isUpdateAvailable()
                if (!available) return

                // If force update, always show. Otherwise check dismiss.
                if (!updateInfo.isForceUpdate && appUpdateService.hasDismissedVersion(updateInfo.latestVersion)) {
                    // Dismissed — but show again on next session
                    // We clear the dismiss on every new app launch so it shows again
                    // Only skip if user dismissed in THIS session
                    const sessionKey = sessionStorage.getItem('update_dismissed_session')
                    if (sessionKey === updateInfo.latestVersion) return
                }

                setInfo(updateInfo)
                // Small delay for better UX
                setTimeout(() => setShow(true), 1500)
            } catch (err) {
                console.error('[AppUpdate] Check failed:', err)
            }
        }

        check()
    }, [])

    const handleDismiss = () => {
        if (info?.isForceUpdate) return
        setShow(false)
        if (info) {
            appUpdateService.dismissVersion(info.latestVersion)
            sessionStorage.setItem('update_dismissed_session', info.latestVersion)
        }
    }

    const handleUpdate = () => {
        if (!info?.downloadUrl) return

        // On native Android, open the URL in the system browser
        if (Capacitor.isNativePlatform()) {
            // Use browser plugin or window.open
            window.open(info.downloadUrl, '_system')
        } else {
            window.open(info.downloadUrl, '_blank')
        }
    }

    if (!show || !info) return null

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
                >
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={info.isForceUpdate ? undefined : handleDismiss}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.85, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.85, opacity: 0, y: 30 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-[340px] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
                    >
                        {/* Close Button */}
                        {!info.isForceUpdate && (
                            <button
                                onClick={handleDismiss}
                                className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-colors"
                            >
                                <X size={16} strokeWidth={3} />
                            </button>
                        )}

                        {/* Header Gradient with Rocket */}
                        <div className="relative bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600 pt-10 pb-14 px-6 flex flex-col items-center overflow-hidden">
                            {/* Floating Circles */}
                            <div className="absolute top-4 left-8 w-16 h-16 bg-white/10 rounded-full blur-md" />
                            <div className="absolute bottom-6 right-6 w-24 h-24 bg-white/5 rounded-full blur-lg" />
                            <div className="absolute top-10 right-16 w-8 h-8 bg-white/15 rounded-full" />

                            {/* Rocket Icon */}
                            <div className="relative z-10 w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center shadow-xl border border-white/20 mb-2">
                                <Rocket size={40} className="text-white drop-shadow-lg" />
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-8 pt-6 pb-8 -mt-6 bg-white dark:bg-slate-900 rounded-t-3xl relative z-10">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white text-center tracking-tight">
                                New Update Available
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-2 leading-relaxed">
                                {info.releaseNotes || "It seems you're using an older app version. Update for the newest features and experience."}
                            </p>

                            {/* Version Badge */}
                            <div className="flex items-center justify-center gap-3 mt-4">
                                <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 py-1 rounded-full">
                                    v{APP_VERSION}
                                </span>
                                <span className="text-slate-300 dark:text-slate-600">→</span>
                                <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full">
                                    v{info.latestVersion}
                                </span>
                            </div>

                            {/* Update Button */}
                            <button
                                onClick={handleUpdate}
                                className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl shadow-xl shadow-emerald-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <Download size={16} strokeWidth={3} />
                                GET UPDATE NOW
                            </button>

                            {/* Skip text for non-force updates */}
                            {!info.isForceUpdate && (
                                <button
                                    onClick={handleDismiss}
                                    className="w-full mt-3 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors text-center py-2"
                                >
                                    Maybe later
                                </button>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
